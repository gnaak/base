"""요청 빈도 제한.

두 층으로 나뉜다. 둘 다 Redis에 카운터를 둔다.

1. **IP × 엔드포인트** — 라우트의 `dependencies=` 에 건다.
   `@router.post("/login", dependencies=[LOGIN_LIMIT])`
2. **계정 × 실패 횟수** — 서비스에서 부른다 (`auth_service.login` 참고).
   IP를 바꿔가며 한 계정을 두드리는 공격은 1번으로 못 막는다.

**어디에 걸어야 하나** — 전부 거는 게 아니다. 정상 사용 빈도가 엔드포인트마다
달라서 한도를 하나로 잡을 수 없다.

    로그인·OAuth·비번 재설정   필수 — 시도만으로 정답 여부를 알 수 있다
    회원가입·문의·신고          스팸 방지
    외부 API/LLM 호출           돈이 나간다
    파일 업로드                 디스크·대역폭
    인증이 걸린 일반 읽기/쓰기  불필요 — 로그인이 이미 관문이다
    헬스체크                    걸지 말 것 (LB가 계속 때린다)

**앞단(nginx·Cloudflare)과 역할이 다르다.** 앞단은 "초당 수백 발"을 앱에 닿기
전에 쳐내고(싸다), 여기는 계정 단위처럼 앞단이 구조적으로 못 하는 걸 한다.
둘 다 있는 게 맞다.

**미들웨어가 아니라 의존성인 이유** — 미들웨어로 하면 규칙에 경로 문자열
(`"/api/auth/login"`)을 적어야 하는데, 라우터 prefix를 바꾸면 제한이 **조용히**
풀린다. 의존성은 라우트에 붙어 있어서 그럴 수가 없고, 어느 엔드포인트가
제한되는지 라우터만 봐도 보인다.
"""
import ipaddress

from fastapi import Depends, Request

from app.core.database.redis import get_redis
from app.core.logging import get_logger
from app.core.utils.response import fail

logger = get_logger(__name__)

#: 계정 단위 로그인 실패 한도. 비밀번호를 몇 번 틀리는 정상 사용자는 여기 닿지 않는다.
LOGIN_FAIL_LIMIT = 5
LOGIN_FAIL_WINDOW = 600  # 10분


def _valid_ip(raw: str | None) -> str | None:
    """IP 형식만 통과시킨다.

    헤더는 클라이언트가 보내는 값이라, 검증 없이 Redis 키로 쓰면 아무 문자열이나
    새 카운터를 만들어 키 공간을 불릴 수 있다.
    """
    if not raw:
        return None
    candidate = raw.strip()
    try:
        ipaddress.ip_address(candidate)
    except ValueError:
        return None
    return candidate


def _is_local_proxy(ip: str) -> bool:
    """직접 연결된 상대가 "인터넷에서 온 클라이언트가 아닌지" 판단한다.

    `is_global`의 반대를 쓴다 — 사설망·루프백뿐 아니라 link-local·예약 대역까지
    한 번에 걸러진다. (`is_private`는 문서용 대역 192.0.2.0/24 등도 포함해서
    의도가 덜 분명하다)
    """
    try:
        return not ipaddress.ip_address(ip).is_global
    except ValueError:
        return False


def client_ip(request: Request) -> str:
    """제한의 기준이 되는 클라이언트 IP.

    nginx 뒤에 있으면 `request.client.host`가 방문자가 아니라 nginx(127.0.0.1)다.
    그대로 쓰면 모든 방문자가 한 카운터에 뭉쳐서 서비스 전체가 10req/min으로 묶인다.

    ⚠️ **프록시 헤더는 직접 연결된 상대가 사설망·루프백일 때만 믿는다.**
    앱 포트가 외부에 그대로 열려 있으면 `X-Forwarded-For`를 위조해 한도를
    우회할 수 있기 때문이다. nginx를 같은 호스트에 두면(= peer가 127.0.0.1)
    자연히 통과하고, 앱이 직접 노출돼 있으면 헤더를 무시한다.

    Cloudflare가 nginx 없이 앱에 직접 붙는 구성이라면 peer가 Cloudflare의
    공인 IP라 헤더를 믿지 않는다 — 그 경우 전 세계가 엣지 IP 몇 개로 뭉치므로,
    그런 배포에서는 이 함수를 배포 형태에 맞게 고쳐야 한다.
    """
    peer = request.client.host if request.client else None

    if peer and _is_local_proxy(peer):
        # Cloudflare가 직접 세팅하는 값. 프록시 체인과 무관하게 방문자 IP 하나만 담긴다.
        cf_ip = _valid_ip(request.headers.get("CF-Connecting-IP"))
        if cf_ip:
            return cf_ip

        # "client, proxy1, proxy2" — 맨 왼쪽이 최초 클라이언트
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            first = _valid_ip(forwarded.split(",")[0])
            if first:
                return first

    return peer or "unknown"


async def _hit(key: str, limit: int, window: int) -> tuple[bool, int]:
    """카운터를 1 올리고 (허용 여부, 남은 초)를 돌려준다.

    고정 윈도우(INCR + EXPIRE)다. 창 경계에서 최대 2배까지 몰릴 수 있지만,
    목적이 "자동화를 확실히 느리게 만드는 것"이라 이 정도로 충분하고
    슬라이딩 윈도우보다 훨씬 싸다.

    **Redis가 죽으면 통과시킨다(fail-open).** 제한이 안 걸리는 것보다
    모든 로그인이 막히는 쪽이 더 나쁘고, 앞단(nginx)이 여전히 버티고 있다.
    """
    redis = get_redis()
    try:
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window)
        if count > limit:
            ttl = await redis.ttl(key)
            return False, max(ttl, 1)
        return True, 0
    except Exception:
        logger.warning("rate limit 확인 실패 — 통과시킨다 (key=%s)", key, exc_info=True)
        return True, 0


def _too_many(retry_after: int):
    """429로 끊는다.

    `fail()`을 쓰므로 전역 예외 핸들러를 타고 BaseResponse 형태로 나간다
    (`errorCode`가 실려서 프론트가 분기할 수 있고, CORS 헤더도 정상적으로 붙는다 —
    미들웨어에서 JSONResponse를 직접 만들면 CORSMiddleware를 건너뛴다).
    """
    fail(
        "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        "TOO_MANY_REQUESTS",
        429,
        headers={"Retry-After": str(retry_after)},
    )


def rate_limit(name: str, *, limit: int, window: int = 60):
    """IP × 엔드포인트 묶음 제한. 라우트의 `dependencies=` 에 건다.

    `name`은 카운터를 나누는 **묶음 이름**이다. 성격이 다른 트래픽이 서로의
    한도를 깎지 않도록 묶음을 나눈다 — 예컨대 챗봇을 20번 테스트해 본 사용자가
    로그인까지 막히면 안 된다.
    """

    async def dep(request: Request) -> None:
        # preflight는 브라우저가 자동으로 보내는 것이라 사용자 행동이 아니다.
        # 세지 않으면 cross-origin 클라이언트의 실질 한도가 절반이 된다.
        if request.method == "OPTIONS":
            return

        allowed, retry_after = await _hit(
            f"rl:{name}:{client_ip(request)}", limit, window
        )
        if not allowed:
            logger.info("rate limit 초과: %s %s (%s)", name, request.url.path, client_ip(request))
            _too_many(retry_after)

    return Depends(dep)


#: 로그인·OAuth. 한 사람이 1분에 10번 넘게 로그인할 일은 없다.
LOGIN_LIMIT = rate_limit("auth_login", limit=10, window=60)

#: 회원가입. 한 사람이 1분에 다섯 번 넘게 가입할 이유가 없다.
SIGNUP_LIMIT = rate_limit("auth_signup", limit=5, window=60)


# ──────────────────────────────────────────────────────────────
#  계정 단위 — IP를 바꿔가며 한 계정을 두드리는 공격용
# ──────────────────────────────────────────────────────────────
def _login_key(email: str) -> str:
    return f"rl:login_fail:{email.strip().lower()}"


async def check_login_attempts(email: str) -> None:
    """이 계정이 최근에 너무 많이 실패했으면 429로 끊는다.

    비밀번호를 **검사하기 전에** 부른다 — 잠긴 계정에 argon2 비용을 쓰지 않는다.
    """
    try:
        count = await get_redis().get(_login_key(email))
    except Exception:
        logger.warning("로그인 실패 카운터 조회 실패 — 통과시킨다", exc_info=True)
        return

    if count is not None and int(count) >= LOGIN_FAIL_LIMIT:
        try:
            ttl = await get_redis().ttl(_login_key(email))
        except Exception:
            ttl = LOGIN_FAIL_WINDOW
        logger.info("계정 잠금: %s (실패 %s회)", email, count)
        _too_many(max(ttl, 1))


async def record_login_failure(email: str) -> None:
    """비밀번호가 틀렸을 때 부른다."""
    try:
        key = _login_key(email)
        count = await get_redis().incr(key)
        if count == 1:
            await get_redis().expire(key, LOGIN_FAIL_WINDOW)
    except Exception:
        logger.warning("로그인 실패 기록 실패", exc_info=True)


async def clear_login_failures(email: str) -> None:
    """로그인에 성공하면 카운터를 비운다."""
    try:
        await get_redis().delete(_login_key(email))
    except Exception:
        logger.warning("로그인 실패 카운터 삭제 실패", exc_info=True)
