"""세션 무효화 — 이미 발급된 토큰을 끊는다.

JWT는 stateless라 발급하고 나면 만료 전까지 스스로 유효하다. 그래서
"로그아웃했다", "비밀번호를 바꿨다", "계정을 정지시켰다"를 토큰만으로는
반영할 수 없다. Redis에 최소한의 상태를 둬서 그걸 가능하게 한다.

두 가지를 구분한다.

| 수단 | 범위 | 언제 |
| ---- | ---- | ---- |
| **거부 목록**(jti) | 그 세션 하나 | 로그아웃 — 다른 기기는 살아있어야 한다 |
| **버전 카운터**(ver) | 그 계정의 **모든** 세션 | 비밀번호 변경, 계정 정지, "모든 기기에서 로그아웃" |

**확인 시점은 refresh 뿐이다.** 매 요청마다 확인하면 Redis 왕복이 요청마다
생긴다. 대신 access 토큰을 짧게 가져가서(`settings.access_token_minutes`)
무효화 지연을 그 값으로 묶는다 — "access 15~30분" 권고의 근거가 이것이다.

**Redis가 죽으면 거부한다(fail-closed).** 레이트리밋(`core/utils/rate_limit.py`)이
fail-open인 것과 반대다. 거기는 가용성이 우선이지만 여기는 보안이 우선이라,
"무효화된 세션이 되살아나는" 쪽보다 "갱신이 안 되는" 쪽을 고른다.
access 토큰이 남아 있는 동안은 계속 쓸 수 있으므로 즉시 로그아웃되지는 않는다.
"""
from app.core.database.redis import get_redis
from app.core.logging import get_logger
from app.core.utils.response import fail

logger = get_logger(__name__)

#: 거부 목록 TTL 여유분(초). 토큰이 만료되면 어차피 검증에서 걸리므로
#: 남은 수명만큼만 들고 있으면 된다.
_DENY_SKEW = 60

#: 로테이션 유예(초). 이 시간 안에 같은 refresh 토큰이 다시 오면 **동시 갱신**으로 본다.
#:
#: 탭을 두 개 열어두면 각자 refresh를 시도한다 — 프론트의 `pendingRefresh` 맵은
#: 탭 *안에서만* 중복을 막으므로 탭끼리는 못 막는다. 유예가 없으면 이 정상 동작이
#: "재사용 공격"으로 오판돼 사용자가 통째로 로그아웃된다.
#:
#: ⚠️ 대가: 유예 시간 동안은 훔친 토큰도 한 번 더 통한다. 이 값이 그 노출 창이다.
ROTATION_GRACE_SECONDS = 10

#: 거부 사유. 재사용 탐지를 로테이션된 토큰에만 적용하기 위해 구분한다
#: (로그아웃한 토큰이 다시 오는 건 흔한 일이라 전체 세션을 끊을 이유가 없다).
DENY_LOGOUT = "logout"
DENY_ROTATED = "rotated"


def _ver_key(user_id: int, auth_type: str) -> str:
    return f"auth:ver:{auth_type}:{user_id}"


def _deny_key(jti: str) -> str:
    return f"auth:denied:{jti}"


def _grace_key(jti: str) -> str:
    return f"auth:grace:{jti}"


async def current_version(user_id: int, auth_type: str, *, strict: bool = True) -> int:
    """이 계정의 현재 세션 버전.

    `strict`로 Redis 장애 시 동작이 갈린다. **두 호출처의 성격이 다르기 때문이다.**

    - `strict=False` (토큰 **발급** 시): 버전 조회는 보안 검사가 아니라 *도장 찍기*다.
      못 찍었다고 로그인을 막을 이유가 없다 — 올바른 자격증명으로 새로 로그인하는 것은
      원래 허용돼야 하고, 무효화가 막으려는 건 *기존* 세션이다. 0으로 찍히면 나중에
      refresh에서 걸러지므로 안전한 쪽으로 자기 교정된다.
    - `strict=True` (**refresh 검증** 시): 이쪽이 진짜 검사다. 확인이 안 되면 거부한다.
    """
    try:
        raw = await get_redis().get(_ver_key(user_id, auth_type))
        return int(raw) if raw is not None else 0
    except Exception:
        logger.error("세션 버전 조회 실패 (strict=%s)", strict, exc_info=True)
        if strict:
            fail("세션을 확인할 수 없습니다", "SESSION_STORE_UNAVAILABLE", 503)
        return 0


async def revoke_all_sessions(user_id: int, auth_type: str) -> None:
    """이 계정의 **모든** 세션을 끊는다.

    비밀번호 변경·계정 정지·"모든 기기에서 로그아웃"에서 부른다.
    버전을 올리면 기존 토큰의 `ver`가 뒤처져서 refresh가 거부된다.
    """
    try:
        await get_redis().incr(_ver_key(user_id, auth_type))
        logger.info("전체 세션 무효화: %s:%s", auth_type, user_id)
    except Exception:
        logger.error("전체 세션 무효화 실패", exc_info=True)
        fail("세션을 정리하지 못했습니다", "SESSION_STORE_UNAVAILABLE", 503)


async def deny_token(jti: str, ttl_seconds: int, reason: str = DENY_LOGOUT) -> None:
    """refresh 토큰 하나를 거부 목록에 올린다.

    TTL을 토큰의 남은 수명으로 두면 목록이 무한히 자라지 않는다.
    `reason`은 재사용 탐지를 로테이션된 토큰에만 적용하기 위해 쓴다.
    """
    if not jti or ttl_seconds <= 0:
        return
    try:
        await get_redis().set(_deny_key(jti), reason, ex=ttl_seconds + _DENY_SKEW)
    except Exception:
        # 로그아웃 자체는 성공시킨다 (쿠키는 지워진다). 남은 위험은 access 수명만큼.
        logger.error("토큰 거부 목록 등록 실패 — 쿠키만 삭제된다", exc_info=True)


async def rotate_token(jti: str, ttl_seconds: int) -> None:
    """refresh 로테이션 — 방금 쓴 토큰을 무효화한다.

    ⚠️ **유예 마커를 거부 목록보다 먼저 쓴다.** 순서가 반대면, 두 마커 사이의
    짧은 순간에 들어온 동시 요청이 "거부됐는데 유예도 없다"를 보고 재사용으로
    오판해 전체 세션을 끊어버린다.
    """
    if not jti:
        return
    try:
        await get_redis().set(_grace_key(jti), "1", ex=ROTATION_GRACE_SECONDS)
    except Exception:
        logger.error("로테이션 유예 마커 기록 실패", exc_info=True)
        return  # 유예 없이 거부하면 정상 사용자를 끊을 수 있다 — 차라리 로테이션을 건너뛴다

    await deny_token(jti, ttl_seconds, reason=DENY_ROTATED)


async def ensure_not_revoked(payload: dict) -> None:
    """refresh 토큰이 아직 유효한지 확인한다. 아니면 401.

    `verify_refresh_by_type()`이 서명·만료를 통과시킨 **뒤에** 부른다.
    """
    user_id = int(payload["sub"])
    auth_type = payload["user"]
    jti = payload.get("jti")

    if jti:
        try:
            reason = await get_redis().get(_deny_key(jti))
        except Exception:
            logger.error("거부 목록 조회 실패", exc_info=True)
            fail("세션을 확인할 수 없습니다", "SESSION_STORE_UNAVAILABLE", 503)

        if reason == DENY_ROTATED:
            # 이미 로테이션된 토큰이 또 왔다. 유예 안이면 동시 갱신(탭 여러 개),
            # 밖이면 누군가 옛 토큰을 들고 있다는 뜻 — 유출로 보고 전부 끊는다.
            try:
                in_grace = await get_redis().exists(_grace_key(jti))
            except Exception:
                logger.error("유예 마커 조회 실패", exc_info=True)
                fail("세션을 확인할 수 없습니다", "SESSION_STORE_UNAVAILABLE", 503)

            if not in_grace:
                logger.warning(
                    "refresh 토큰 재사용 감지 — 전체 세션 무효화: %s:%s", auth_type, user_id
                )
                await revoke_all_sessions(user_id, auth_type)
                fail(
                    "보안을 위해 모든 세션을 종료했습니다. 다시 로그인해 주세요",
                    "SESSION_REUSE_DETECTED",
                    401,
                )
        elif reason:
            # 로그아웃 등으로 끊긴 토큰. 흔한 일이라 전체 세션까지 끊지는 않는다.
            fail("로그아웃된 세션입니다", "SESSION_REVOKED", 401)

    if payload.get("ver", 0) != await current_version(user_id, auth_type):
        fail("세션이 만료되었습니다. 다시 로그인해 주세요", "SESSION_REVOKED", 401)
