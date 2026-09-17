"""GET /api/user/me — 라우터 통합 테스트.

새 도메인 라우터를 만들 때 이 파일을 형태의 본보기로 삼는다.
정상 경로 하나에 엣지 케이스 여럿이 기본 구성이다.
"""
from datetime import timedelta

from tests.conftest import auth_header, cookie_header, make_token

ME = "/api/user/me"


# ──────────────────────────────────────────────────────────────
#  정상 경로
# ──────────────────────────────────────────────────────────────
async def test_내_정보를_반환한다(client, make_user):
    user = await make_user(email="me@example.com", name="나")

    res = await client.get(ME, headers=auth_header(user.id))

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["id"] == user.id
    assert body["data"]["email"] == "me@example.com"
    assert body["data"]["name"] == "나"


async def test_응답에_비밀번호가_실리지_않는다(client, make_user):
    """user_service.get_me가 필드를 골라 담는 이유를 고정하는 회귀 테스트.

    모델을 그대로 반환하도록 되돌리면 password 해시가 응답에 실리는데,
    상태코드는 200이라 눈으로는 안 보인다.
    """
    user = await make_user(password="super-secret-hash")

    res = await client.get(ME, headers=auth_header(user.id))

    assert res.status_code == 200
    assert "password" not in res.json()["data"]
    assert "super-secret-hash" not in res.text


# ──────────────────────────────────────────────────────────────
#  인증 엣지 케이스
# ──────────────────────────────────────────────────────────────
async def test_쿠키가_없으면_401(client):
    res = await client.get(ME)

    assert res.status_code == 401
    assert res.json()["errorCode"] == "ACCESS_TOKEN_MISSING"


async def test_만료된_토큰이면_401(client, make_user):
    user = await make_user()

    res = await client.get(
        ME, headers=auth_header(user.id, expires_in=timedelta(seconds=-1))
    )

    assert res.status_code == 401
    assert res.json()["errorCode"] == "ACCESS_TOKEN_EXPIRED"


async def test_서명이_다르면_401(client, make_user):
    """다른 프로젝트에서 발급한 토큰이 통과하면 안 된다.

    jwt_secret을 프로젝트마다 새로 만들라고 한 이유가 이것이다.
    """
    user = await make_user()

    # HS256 최소 권장 길이(32바이트)를 넘겨야 PyJWT가 경고를 내지 않는다
    other_secret = "another-project-secret-" + "x" * 16

    res = await client.get(ME, headers=auth_header(user.id, secret=other_secret))

    assert res.status_code == 401
    assert res.json()["errorCode"] == "ACCESS_TOKEN_INVALID"


async def test_refresh_토큰으로는_접근할_수_없다(client, make_user):
    user = await make_user()

    res = await client.get(ME, headers=auth_header(user.id, token_type="refresh"))

    assert res.status_code == 401
    assert res.json()["errorCode"] == "INVALID_TOKEN_TYPE"


async def test_admin_쿠키만_보내면_user_API는_401(client, make_user):
    """user_ 와 admin_ 은 독립 세션이다. admin_ 쿠키는 user API에서 안 보인다."""
    user = await make_user()

    res = await client.get(ME, headers=auth_header(user.id, auth_type="admin"))

    assert res.status_code == 401
    assert res.json()["errorCode"] == "ACCESS_TOKEN_MISSING"


async def test_admin용_토큰을_user_쿠키에_넣어도_401(client, make_user):
    """쿠키 이름만 user_ 로 바꿔치기해도 payload의 user 필드에서 걸러진다."""
    user = await make_user()

    res = await client.get(
        ME,
        headers=cookie_header(user_access_token=make_token(user.id, "admin")),
    )

    assert res.status_code == 401
    assert res.json()["errorCode"] == "INVALID_TOKEN_TYPE"


async def test_토큰은_유효하지만_사용자가_없으면_404(client):
    """탈퇴 직후 아직 살아있는 토큰으로 들어오는 상황."""
    res = await client.get(ME, headers=auth_header(999_999))

    assert res.status_code == 404
    assert res.json()["errorCode"] == "USER_NOT_FOUND"


async def test_토큰이_깨져_있으면_401(client):
    res = await client.get(ME, headers=cookie_header(user_access_token="not-a-jwt"))

    assert res.status_code == 401
    assert res.json()["errorCode"] == "ACCESS_TOKEN_INVALID"


# ──────────────────────────────────────────────────────────────
#  응답 규약
# ──────────────────────────────────────────────────────────────
async def test_실패_응답도_BaseResponse_형태를_지킨다(client):
    res = await client.get(ME)

    body = res.json()
    assert set(body) == {"success", "message", "data", "errorCode"}
    assert body["success"] is False
    assert body["data"] is None


async def test_요청마다_추적_헤더가_붙는다(client, make_user):
    user = await make_user()

    res = await client.get(ME, headers=auth_header(user.id))

    assert res.headers.get("x-request-id")
    assert res.headers.get("x-process-time", "").endswith("ms")


# ──────────────────────────────────────────────────────────────
#  인프라
# ──────────────────────────────────────────────────────────────
async def test_헬스체크는_인증이_필요없다(client):
    res = await client.get("/api/health")

    assert res.status_code == 200
    assert res.json()["data"]["status"] == "ok"


async def test_테스트끼리_데이터가_섞이지_않는다(client, make_user):
    """앞선 테스트들이 같은 이메일로 유저를 만들었어도 여기선 깨끗해야 한다.

    conftest의 트랜잭션 롤백이 실제로 도는지 확인하는 테스트다.
    """
    user = await make_user(email="tester@example.com")

    res = await client.get(ME, headers=auth_header(user.id))

    assert res.status_code == 200
