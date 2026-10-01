"""OAuth 로그인 (Google · Kakao) — 업체만 MockTransport 로 바꿔 끼우고 라우터부터 DB 까지 진짜로 탄다.

막아야 하는 것:
- 업체가 검증하지 않은 이메일로 기존 계정에 붙는 것 (계정 탈취)
- 공격자가 피해자 이메일로 먼저 비밀번호 가입해 두고, 피해자의 OAuth 로그인을 그 계정에 붙이는 것 (계정 선점)
"""

import httpx
import pytest
from sqlalchemy import select

from app.core.utils import http_client as hc
from app.core.utils.error_code import ErrorCode
from app.module.user.user import User

GOOGLE = "/api/auth/google"
KAKAO = "/api/auth/kakao"


@pytest.fixture
def provider(monkeypatch):
    """업체 응답을 정한다. `provider(userinfo=…, token_status=…)`"""

    def install(*, userinfo: dict | None = None, token_status: int = 200, token_exc: type | None = None):
        def handler(request: httpx.Request) -> httpx.Response:
            host = request.url.host
            if host in ("oauth2.googleapis.com", "kauth.kakao.com"):  # 토큰 교환
                if token_exc:
                    raise token_exc("upstream", request=request)
                if token_status != 200:
                    return httpx.Response(token_status, json={"error": "invalid_grant"})
                return httpx.Response(200, json={"access_token": "upstream-access-token"})
            if host in ("www.googleapis.com", "kapi.kakao.com"):  # 사용자 정보
                return httpx.Response(200, json=userinfo or {})
            return httpx.Response(404)

        monkeypatch.setattr(hc, "_client", hc._build_client(httpx.MockTransport(handler)))

    return install


def kakao_userinfo(email="me@example.com", *, verified=True, valid=True, **account):
    return {
        "kakao_account": {
            "email": email,
            "is_email_verified": verified,
            "is_email_valid": valid,
            "profile": {"nickname": "카카오사람", "profile_image_url": "http://img.example/a.png"},
            **account,
        }
    }


def google_userinfo(email="me@example.com", *, verified=True):
    return {"email": email, "verified_email": verified, "name": "구글사람", "picture": "https://img.example/g.png"}


async def users_with(db, email: str) -> list[User]:
    return list((await db.execute(select(User).where(User.email == email))).scalars())


# ──────────────────────────────────────────────────────────────
#  Kakao
# ──────────────────────────────────────────────────────────────
async def test_카카오_검증된_이메일이면_계정을_만들고_로그인한다(client, db, provider):
    provider(userinfo=kakao_userinfo())

    res = await client.post(KAKAO, json={"code": "c"})

    assert res.status_code == 200
    assert res.json()["data"]["user_nickname"] == "카카오사람"
    assert "user_access_token" in res.cookies
    [user] = await users_with(db, "me@example.com")
    assert user.password is None
    assert user.profile_image.startswith("https://")  # http 이미지는 https 로


@pytest.mark.parametrize(
    "label, flags",
    [("검증 안 됨", {"verified": False}), ("다른 계정으로 옮겨 간 이메일", {"valid": False})],
)
async def test_카카오가_검증하지_않은_이메일이면_403(client, db, provider, label, flags):
    provider(userinfo=kakao_userinfo(**flags))

    res = await client.post(KAKAO, json={"code": "c"})

    assert res.status_code == 403, label
    assert res.json()["errorCode"] == ErrorCode.OAUTH_EMAIL_UNVERIFIED
    assert "user_access_token" not in res.cookies
    assert await users_with(db, "me@example.com") == []


async def test_카카오가_검증하지_않은_이메일로는_기존_계정에_붙지_않는다(client, provider, make_user):
    """계정 탈취 — 공격자가 카카오 계정 이메일을 피해자 주소로 바꿔 두는 경우."""
    await make_user(email="victim@example.com", password=None)
    provider(userinfo=kakao_userinfo("victim@example.com", verified=False))

    res = await client.post(KAKAO, json={"code": "c"})

    assert res.status_code == 403
    assert "user_access_token" not in res.cookies


async def test_카카오_이메일_동의가_없으면_400(client, provider):
    provider(userinfo={"kakao_account": {"profile": {"nickname": "x"}}})

    res = await client.post(KAKAO, json={"code": "c"})

    assert res.status_code == 400
    assert res.json()["errorCode"] == ErrorCode.OAUTH_EMAIL_REQUIRED


async def test_같은_이메일로_비밀번호_가입한_계정이_있으면_409(client, db, provider, make_user):
    """계정 선점 — 공격자가 피해자 이메일로 먼저 가입해 비밀번호를 걸어 둔 경우."""
    await make_user(email="me@example.com", password="attacker-hash")
    provider(userinfo=kakao_userinfo("me@example.com"))

    res = await client.post(KAKAO, json={"code": "c"})

    assert res.status_code == 409
    assert res.json()["errorCode"] == ErrorCode.OAUTH_ACCOUNT_CONFLICT
    assert "user_access_token" not in res.cookies


async def test_같은_이메일의_OAuth_계정에는_다시_로그인된다(client, db, provider, make_user):
    existing = await make_user(email="me@example.com", password=None)
    provider(userinfo=kakao_userinfo("me@example.com"))

    res = await client.post(KAKAO, json={"code": "c"})

    assert res.status_code == 200
    assert res.json()["data"]["id"] == existing.id
    assert len(await users_with(db, "me@example.com")) == 1


async def test_카카오_토큰_교환이_타임아웃이면_504(client, provider):
    provider(token_exc=httpx.ReadTimeout)

    res = await client.post(KAKAO, json={"code": "c"})

    assert res.status_code == 504
    assert res.json()["errorCode"] == ErrorCode.UPSTREAM_TIMEOUT


# ──────────────────────────────────────────────────────────────
#  Google
# ──────────────────────────────────────────────────────────────
async def test_구글_검증된_이메일이면_로그인한다(client, db, provider):
    provider(userinfo=google_userinfo())

    res = await client.post(GOOGLE, json={"code": "c"})

    assert res.status_code == 200
    assert res.json()["data"]["user_nickname"] == "구글사람"
    assert len(await users_with(db, "me@example.com")) == 1


@pytest.mark.parametrize("label, userinfo", [
    ("verified_email=false", google_userinfo(verified=False)),
    ("verified_email 없음", {"email": "me@example.com", "name": "x"}),
])
async def test_구글이_검증하지_않은_이메일이면_403(client, db, provider, label, userinfo):
    provider(userinfo=userinfo)

    res = await client.post(GOOGLE, json={"code": "c"})

    assert res.status_code == 403, label
    assert res.json()["errorCode"] == ErrorCode.OAUTH_EMAIL_UNVERIFIED
    assert await users_with(db, "me@example.com") == []


async def test_구글_토큰_교환이_거절되면_401(client, provider):
    provider(token_status=400)

    res = await client.post(GOOGLE, json={"code": "bad"})

    assert res.status_code == 401
    assert res.json()["errorCode"] == ErrorCode.OAUTH_TOKEN_FAILED
