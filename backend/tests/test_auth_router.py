"""POST /api/auth/** — 로그인과 **요청 스키마 검증 계약**.

이 파일의 절반은 "잘못된 입력이 500이 아니라 422로 나간다"를 고정하는 회귀 테스트다.
라우터가 `p.request.json()` 으로 되돌아가면 전부 깨진다 — 그게 의도다.
"""
import pytest

from app.module.auth.auth_service import hash_password
from tests.conftest import auth_header

LOGIN = "/api/auth/login"


# ──────────────────────────────────────────────────────────────
#  정상 경로
# ──────────────────────────────────────────────────────────────
async def test_로그인하면_쿠키_4종이_내려온다(client, make_user):
    await make_user(email="me@example.com", password=hash_password("pw1234"))

    res = await client.post(
        LOGIN, json={"email": "me@example.com", "password": "pw1234", "type": "user"}
    )

    assert res.status_code == 200
    assert res.json()["success"] is True
    names = {c.split("=")[0] for c in res.headers.get_list("set-cookie")}
    assert names == {
        "user_access_token",
        "user_refresh_token",
        "user_user_info",
        "user_refresh_exp",
    }


async def test_비밀번호가_틀리면_404(client, make_user):
    await make_user(email="me@example.com", password=hash_password("pw1234"))

    res = await client.post(
        LOGIN, json={"email": "me@example.com", "password": "wrong", "type": "user"}
    )

    assert res.status_code == 404
    assert res.json()["errorCode"] == "USER_DOES_NOT_EXISTS"


async def test_type을_생략하면_user로_동작한다(client, make_user):
    """LoginIn.type 의 기본값이 "user" 라는 계약."""
    await make_user(email="me@example.com", password=hash_password("pw1234"))

    res = await client.post(LOGIN, json={"email": "me@example.com", "password": "pw1234"})

    assert res.status_code == 200


# ──────────────────────────────────────────────────────────────
#  요청 스키마 검증 — 전부 422 + VALIDATION_ERROR
# ──────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "label, payload",
    [
        ("email 누락", {"password": "x", "type": "user"}),
        ("password 누락", {"email": "a@b.c", "type": "user"}),
        ("빈 password", {"email": "a@b.c", "password": "", "type": "user"}),
        ("모르는 type", {"email": "a@b.c", "password": "x", "type": "superuser"}),
        ("바디가 배열", [1, 2, 3]),
        ("바디가 문자열", "hello"),
    ],
)
async def test_잘못된_바디는_422(client, label, payload):
    res = await client.post(LOGIN, json=payload)

    assert res.status_code == 422, label
    assert res.json()["errorCode"] == "VALIDATION_ERROR", label


async def test_깨진_JSON도_422(client):
    """예전에는 `await request.json()` 이 그대로 터져서 500이 나갔다."""
    res = await client.post(
        LOGIN, content=b"{not json", headers={"Content-Type": "application/json"}
    )

    assert res.status_code == 422
    assert res.json()["errorCode"] == "VALIDATION_ERROR"


async def test_검증_실패_응답도_BaseResponse_형태를_지킨다(client):
    res = await client.post(LOGIN, json={})

    body = res.json()
    assert set(body) == {"success", "message", "data", "errorCode"}
    assert body["success"] is False
    assert body["data"] is None
    # 어느 필드가 왜 틀렸는지 메시지에 남는다 (프론트가 그대로 띄울 수 있게)
    assert "email" in body["message"]


async def test_OAuth_code가_없으면_422(client):
    res = await client.post("/api/auth/google", json={})

    assert res.status_code == 422
    assert res.json()["errorCode"] == "VALIDATION_ERROR"
    assert "code" in res.json()["message"]


# ──────────────────────────────────────────────────────────────
#  인증이 필요한 라우트
# ──────────────────────────────────────────────────────────────
async def test_로그아웃은_로그인_상태여야_한다(client):
    res = await client.post("/api/auth/logout")

    assert res.status_code == 401
    assert res.json()["errorCode"] == "ACCESS_TOKEN_MISSING"


async def test_admin_로그아웃에_user_토큰은_통하지_않는다(client, make_user):
    user = await make_user()

    res = await client.post("/api/auth/logout_admin", headers=auth_header(user.id, "user"))

    assert res.status_code == 401


async def test_로그아웃하면_쿠키가_만료된다(client, make_user):
    user = await make_user()

    res = await client.post("/api/auth/logout", headers=auth_header(user.id))

    assert res.status_code == 200
    # delete_cookie 는 Max-Age=0 으로 같은 이름을 덮어쓴다
    assert all("Max-Age=0" in c for c in res.headers.get_list("set-cookie"))
