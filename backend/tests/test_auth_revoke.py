"""세션 무효화 — 로그아웃·전체 종료·계정 비활성화.

핵심 계약: **쿠키를 지우는 것과 세션을 끊는 것은 다르다.**
쿠키는 브라우저에만 영향을 주고, 토큰 자체는 만료까지 유효하다.

⚠️ 테스트는 롤백되지만 AUTO_INCREMENT는 되돌아가지 않는다.
   `user.id == 1`을 가정하지 말고 만들어진 객체의 id를 쓸 것.
"""
import jwt

from app.core.config.settings import settings
from app.module.auth import auth_revoke
from app.module.auth.auth_service import hash_password
from tests.conftest import cookie_header, make_token

LOGIN = "/api/auth/login"
REFRESH = "/api/auth/refresh_token"
LOGOUT = "/api/auth/logout"


def _body(email="me@example.com", password="pw1234"):
    return {"email": email, "password": password, "type": "user"}


def _refresh_cookie(res) -> str:
    for raw in res.headers.get_list("set-cookie"):
        if raw.startswith("user_refresh_token="):
            return raw.split("=", 1)[1].split(";")[0]
    raise AssertionError("refresh 쿠키가 없다")


async def _login(client, email="me@example.com") -> str:
    """로그인해서 refresh 쿠키 값을 돌려준다."""
    res = await client.post(LOGIN, json=_body(email=email))
    assert res.status_code == 200, res.text
    return _refresh_cookie(res)


def _session_cookies(user_id: int, refresh: str) -> dict:
    """로그인 상태 + 해당 refresh 토큰을 함께 보내는 헤더."""
    return cookie_header(
        user_access_token=make_token(user_id, "user"),
        user_refresh_token=refresh,
    )


def _jti(refresh: str) -> str:
    return jwt.decode(refresh, settings.jwt_secret, algorithms=["HS256"])["jti"]


async def _expire_grace(fake_redis, refresh: str) -> None:
    """로테이션 유예를 끝낸 상태로 만든다 (10초 기다리는 대신)."""
    await fake_redis.delete(auth_revoke._grace_key(_jti(refresh)))


# ──────────────────────────────────────────────────────────────
#  로그아웃 — 이 세션 하나만
# ──────────────────────────────────────────────────────────────
async def test_로그아웃하면_그_refresh_토큰은_못_쓴다(client, make_user):
    """예전에는 쿠키만 지워서, 토큰을 캡처해뒀다면 만료까지 계속 쓸 수 있었다."""
    user = await make_user(email="me@example.com", password=hash_password("pw1234"))
    refresh = await _login(client)

    res = await client.post(LOGOUT, headers=_session_cookies(user.id, refresh))
    assert res.status_code == 200

    res = await client.post(REFRESH, headers=cookie_header(user_refresh_token=refresh))

    assert res.status_code == 401
    assert res.json()["errorCode"] == "SESSION_REVOKED"


async def test_로그아웃해도_다른_기기_세션은_살아있다(client, make_user):
    """거부 목록은 jti 단위다. 전체 종료는 revoke_all_sessions가 따로 한다."""
    user = await make_user(email="me@example.com", password=hash_password("pw1234"))
    first = await _login(client)
    second = await _login(client)

    await client.post(LOGOUT, headers=_session_cookies(user.id, first))

    res = await client.post(REFRESH, headers=cookie_header(user_refresh_token=second))

    assert res.status_code == 200


# ──────────────────────────────────────────────────────────────
#  전체 종료 — 비밀번호 변경·계정 정지·"모든 기기에서 로그아웃"
# ──────────────────────────────────────────────────────────────
async def test_전체_무효화하면_기존_세션이_전부_끊긴다(client, make_user, fake_redis):
    user = await make_user(email="me@example.com", password=hash_password("pw1234"))
    first = await _login(client)
    second = await _login(client)

    await auth_revoke.revoke_all_sessions(user.id, "user")

    for token in (first, second):
        res = await client.post(REFRESH, headers=cookie_header(user_refresh_token=token))
        assert res.status_code == 401
        assert res.json()["errorCode"] == "SESSION_REVOKED"


async def test_전체_무효화_후_다시_로그인하면_정상_동작한다(client, make_user, fake_redis):
    """무효화는 *기존* 세션을 끊는 것이지 로그인을 막는 게 아니다."""
    user = await make_user(email="me@example.com", password=hash_password("pw1234"))
    old = await _login(client)

    await auth_revoke.revoke_all_sessions(user.id, "user")

    fresh = await _login(client)

    assert (await client.post(REFRESH, headers=cookie_header(user_refresh_token=fresh))).status_code == 200
    assert (await client.post(REFRESH, headers=cookie_header(user_refresh_token=old))).status_code == 401


async def test_user와_admin_버전은_독립이다(client, make_user, fake_redis):
    user = await make_user(email="me@example.com", password=hash_password("pw1234"))
    refresh = await _login(client)

    await auth_revoke.revoke_all_sessions(user.id, "admin")  # admin 쪽만 올린다

    res = await client.post(REFRESH, headers=cookie_header(user_refresh_token=refresh))

    assert res.status_code == 200


# ──────────────────────────────────────────────────────────────
#  로테이션 — 갱신하면 옛 토큰이 죽는다
# ──────────────────────────────────────────────────────────────
async def test_갱신하면_옛_refresh_토큰은_죽는다(client, make_user, fake_redis):
    """이게 로테이션이다. 훔친 토큰은 정상 사용자가 한 번만 갱신해도 무력화된다."""
    await make_user(email="me@example.com", password=hash_password("pw1234"))
    first = await _login(client)

    res = await client.post(REFRESH, headers=cookie_header(user_refresh_token=first))
    assert res.status_code == 200
    second = _refresh_cookie(res)

    # 새 토큰은 잘 되고
    assert (await client.post(REFRESH, headers=cookie_header(user_refresh_token=second))).status_code == 200

    # 옛 토큰은 유예가 끝나면 죽는다
    await _expire_grace(fake_redis, first)
    assert (await client.post(REFRESH, headers=cookie_header(user_refresh_token=first))).status_code == 401


async def test_유예_안에_같은_토큰이_또_오면_통과한다(client, make_user, fake_redis):
    """탭을 여러 개 열어두면 각자 refresh를 시도한다 — 이걸 공격으로 오판하면 안 된다.

    프론트의 `pendingRefresh` 맵은 탭 *안에서만* 중복을 막는다.
    """
    await make_user(email="me@example.com", password=hash_password("pw1234"))
    first = await _login(client)

    assert (await client.post(REFRESH, headers=cookie_header(user_refresh_token=first))).status_code == 200
    # 유예를 지우지 않은 채 같은 토큰으로 한 번 더 (= 다른 탭이 거의 동시에 시도)
    res = await client.post(REFRESH, headers=cookie_header(user_refresh_token=first))

    assert res.status_code == 200


# ──────────────────────────────────────────────────────────────
#  재사용 탐지 — 유예 밖에서 죽은 토큰이 오면 유출로 본다
# ──────────────────────────────────────────────────────────────
async def test_재사용이_감지되면_전체_세션이_끊긴다(client, make_user, fake_redis):
    """죽은 토큰을 누가 들고 있다 = 유출됐다. 공격자가 먼저 갱신한 경우를 잡는 장치다."""
    await make_user(email="me@example.com", password=hash_password("pw1234"))
    other_device = await _login(client)
    stolen = await _login(client)

    live = _refresh_cookie(
        await client.post(REFRESH, headers=cookie_header(user_refresh_token=stolen))
    )
    await _expire_grace(fake_redis, stolen)

    # 공격자가 옛 토큰을 다시 들이민다
    res = await client.post(REFRESH, headers=cookie_header(user_refresh_token=stolen))
    assert res.status_code == 401
    assert res.json()["errorCode"] == "SESSION_REUSE_DETECTED"

    # 방금 갱신된 토큰도, 다른 기기 세션도 전부 끊겨야 한다
    for token in (live, other_device):
        res = await client.post(REFRESH, headers=cookie_header(user_refresh_token=token))
        assert res.status_code == 401


async def test_로그아웃된_토큰은_재사용_탐지를_건드리지_않는다(client, make_user, fake_redis):
    """로그아웃한 토큰이 다시 오는 건 흔한 일(멈춰있던 탭 등)이라
    전체 세션까지 끊을 이유가 없다. 로테이션된 토큰과 사유를 구분하는 이유."""
    user = await make_user(email="me@example.com", password=hash_password("pw1234"))
    other_device = await _login(client)
    to_logout = await _login(client)

    await client.post(LOGOUT, headers=_session_cookies(user.id, to_logout))

    res = await client.post(REFRESH, headers=cookie_header(user_refresh_token=to_logout))
    assert res.status_code == 401
    assert res.json()["errorCode"] == "SESSION_REVOKED"  # REUSE_DETECTED 가 아니다

    # 다른 기기는 멀쩡하다
    assert (await client.post(REFRESH, headers=cookie_header(user_refresh_token=other_device))).status_code == 200


# ──────────────────────────────────────────────────────────────
#  active 컬럼 — 예전에는 선언만 있고 아무도 안 봤다
# ──────────────────────────────────────────────────────────────
async def test_비활성_계정은_로그인할_수_없다(client, make_user):
    await make_user(email="off@example.com", password=hash_password("pw1234"), active=False)

    res = await client.post(LOGIN, json=_body(email="off@example.com"))

    assert res.status_code == 403
    assert res.json()["errorCode"] == "ACCOUNT_DISABLED"


async def test_비활성화되면_refresh도_막힌다(client, make_user, db):
    """이미 로그인해 있던 사람도 세션을 갱신할 수 없다.

    (access 토큰이 살아있는 동안은 계속 쓸 수 있다 — 무효화 지연 = access 수명)
    """
    user = await make_user(email="me@example.com", password=hash_password("pw1234"))
    refresh = await _login(client)

    user.active = False
    await db.commit()

    res = await client.post(REFRESH, headers=cookie_header(user_refresh_token=refresh))

    assert res.status_code == 403
    assert res.json()["errorCode"] == "ACCOUNT_DISABLED"


# ──────────────────────────────────────────────────────────────
#  토큰 수명 설정
# ──────────────────────────────────────────────────────────────
async def test_쿠키_수명이_설정을_따라간다(client, make_user):
    await make_user(email="me@example.com", password=hash_password("pw1234"))

    res = await client.post(LOGIN, json=_body())

    ages = {}
    for raw in res.headers.get_list("set-cookie"):
        name = raw.split("=", 1)[0]
        for part in raw.split(";"):
            if part.strip().lower().startswith("max-age="):
                ages[name] = int(part.split("=")[1])

    assert ages["user_access_token"] == settings.access_token_minutes * 60
    assert ages["user_user_info"] == settings.access_token_minutes * 60
    assert ages["user_refresh_token"] == settings.refresh_token_hours * 3600
    assert ages["user_refresh_exp"] == settings.refresh_token_hours * 3600


async def test_예전_토큰에는_ver가_없어_거부된다(client, make_user, fake_redis):
    """배포 전에 발급된 토큰(ver 클레임 없음)은 버전을 올린 뒤 걸러져야 한다."""
    user = await make_user(email="me@example.com", password=hash_password("pw1234"))
    await auth_revoke.revoke_all_sessions(user.id, "user")  # 버전 1

    legacy = make_token(user.id, "user", token_type="refresh")  # ver 없음

    res = await client.post(REFRESH, headers=cookie_header(user_refresh_token=legacy))

    assert res.status_code == 401
    assert res.json()["errorCode"] == "SESSION_REVOKED"
