"""요청 빈도 제한 — IP 단위와 계정 단위.

Redis는 fakeredis로 대체되고 테스트마다 새로 만들어지므로, 카운터가
테스트 간에 새지 않는다 (conftest의 `fake_redis` 픽스처).
"""
import pytest

from app.core.utils import rate_limit as rl
from app.module.auth.auth_service import hash_password

LOGIN = "/api/auth/login"


def _body(email="me@example.com", password="pw1234"):
    return {"email": email, "password": password, "type": "user"}


# ──────────────────────────────────────────────────────────────
#  IP × 엔드포인트
# ──────────────────────────────────────────────────────────────
async def test_같은_IP에서_한도를_넘기면_429(client, make_user):
    """LOGIN_LIMIT 은 10회/분. 11번째가 막혀야 한다.

    계정 잠금(5회)보다 IP 한도가 늦게 걸리므로, 서로 다른 이메일로 보내서
    계정 카운터에 걸리지 않게 한다.
    """
    for i in range(10):
        res = await client.post(LOGIN, json=_body(email=f"u{i}@example.com"))
        assert res.status_code != 429, f"{i + 1}번째에서 막히면 안 된다"

    res = await client.post(LOGIN, json=_body(email="u99@example.com"))

    assert res.status_code == 429
    assert res.json()["errorCode"] == "TOO_MANY_REQUESTS"


async def test_429에_Retry_After가_붙는다(client):
    for i in range(11):
        res = await client.post(LOGIN, json=_body(email=f"u{i}@example.com"))

    assert res.status_code == 429
    assert int(res.headers["retry-after"]) > 0


async def test_429도_BaseResponse_형태를_지킨다(client):
    for i in range(11):
        res = await client.post(LOGIN, json=_body(email=f"u{i}@example.com"))

    body = res.json()
    assert set(body) == {"success", "message", "data", "errorCode"}
    assert body["success"] is False


async def test_제한이_걸리지_않은_엔드포인트는_막히지_않는다(client):
    """/api/health 처럼 규칙이 없는 경로는 몇 번을 불러도 통과한다."""
    for _ in range(30):
        res = await client.get("/api/health")
        assert res.status_code == 200


async def test_묶음이_다르면_한도를_나눠_쓰지_않는다(client, make_user):
    """auth_login 한도를 다 써도 다른 묶음은 영향이 없다.

    (예전 chatbase에서 챗봇을 20번 테스트한 사용자가 로그인까지 막힌 버그)
    """
    for i in range(11):
        await client.post(LOGIN, json=_body(email=f"u{i}@example.com"))

    # 로그인은 막혔지만 제한이 없는 경로는 멀쩡하다
    assert (await client.post(LOGIN, json=_body())).status_code == 429
    assert (await client.get("/api/health")).status_code == 200


# ──────────────────────────────────────────────────────────────
#  계정 × 실패 횟수 — IP를 바꿔도 막혀야 한다
# ──────────────────────────────────────────────────────────────
async def test_같은_계정으로_5번_실패하면_잠긴다(client, make_user):
    await make_user(email="me@example.com", password=hash_password("correct"))

    for _ in range(rl.LOGIN_FAIL_LIMIT):
        res = await client.post(LOGIN, json=_body(password="wrong"))
        assert res.status_code == 404

    res = await client.post(LOGIN, json=_body(password="wrong"))

    assert res.status_code == 429
    assert res.json()["errorCode"] == "TOO_MANY_REQUESTS"


async def test_잠긴_계정은_비밀번호가_맞아도_막힌다(client, make_user):
    """비밀번호 검사 **전에** 확인하므로 잠긴 계정엔 argon2 비용도 쓰지 않는다."""
    await make_user(email="me@example.com", password=hash_password("correct"))

    for _ in range(rl.LOGIN_FAIL_LIMIT):
        await client.post(LOGIN, json=_body(password="wrong"))

    res = await client.post(LOGIN, json=_body(password="correct"))

    assert res.status_code == 429


async def test_IP가_달라도_계정_잠금은_유지된다(client, make_user):
    """이게 IP 제한으로는 못 막는 부분이다 (nginx도 못 한다)."""
    await make_user(email="me@example.com", password=hash_password("correct"))

    for i in range(rl.LOGIN_FAIL_LIMIT):
        res = await client.post(
            LOGIN, json=_body(password="wrong"),
            headers={"X-Forwarded-For": f"203.0.113.{i}"},
        )
        assert res.status_code == 404

    # 또 다른 IP에서 시도해도 계정이 잠겨 있다
    res = await client.post(
        LOGIN, json=_body(password="wrong"),
        headers={"X-Forwarded-For": "203.0.113.200"},
    )

    assert res.status_code == 429


async def test_로그인에_성공하면_실패_카운터가_비워진다(client, make_user):
    await make_user(email="me@example.com", password=hash_password("correct"))

    for _ in range(rl.LOGIN_FAIL_LIMIT - 1):
        await client.post(LOGIN, json=_body(password="wrong"))

    assert (await client.post(LOGIN, json=_body(password="correct"))).status_code == 200

    # 카운터가 비었으므로 다시 4번까지는 실패해도 잠기지 않는다
    for _ in range(rl.LOGIN_FAIL_LIMIT - 1):
        res = await client.post(LOGIN, json=_body(password="wrong"))
        assert res.status_code == 404


async def test_없는_계정도_실패로_센다(client):
    """세지 않으면 "잠기는지 여부"로 이메일 존재를 알아낼 수 있다."""
    for _ in range(rl.LOGIN_FAIL_LIMIT):
        res = await client.post(LOGIN, json=_body(email="ghost@example.com"))
        assert res.status_code == 404

    res = await client.post(LOGIN, json=_body(email="ghost@example.com"))

    assert res.status_code == 429


async def test_이메일_대소문자는_같은_계정으로_센다(client):
    for _ in range(rl.LOGIN_FAIL_LIMIT):
        await client.post(LOGIN, json=_body(email="Me@Example.com"))

    res = await client.post(LOGIN, json=_body(email="me@example.com"))

    assert res.status_code == 429


# ──────────────────────────────────────────────────────────────
#  client_ip — 프록시 헤더 신뢰 규칙
# ──────────────────────────────────────────────────────────────
def _req(peer: str, headers: dict | None = None):
    from starlette.requests import Request

    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "headers": raw, "client": (peer, 1234)})


def test_로컬_프록시_뒤에서는_XFF를_믿는다():
    req = _req("127.0.0.1", {"X-Forwarded-For": "203.0.113.5, 10.0.0.1"})
    assert rl.client_ip(req) == "203.0.113.5"


def test_CF헤더가_XFF보다_우선한다():
    req = _req("127.0.0.1", {
        "CF-Connecting-IP": "203.0.113.9",
        "X-Forwarded-For": "203.0.113.5",
    })
    assert rl.client_ip(req) == "203.0.113.9"


def test_앱이_직접_노출되면_헤더를_무시한다():
    """peer가 공인 IP면 프록시를 거치지 않은 것이므로 헤더를 믿지 않는다.

    믿으면 XFF를 위조해 한도를 무한히 우회할 수 있다.
    (203.0.113.0/24 같은 문서용 대역은 파이썬이 is_global=False로 보므로
     진짜 공인 IP를 쓴다)
    """
    req = _req("8.8.8.8", {"X-Forwarded-For": "203.0.113.5"})
    assert rl.client_ip(req) == "8.8.8.8"


def test_IP가_아닌_헤더값은_무시한다():
    """검증 없이 키로 쓰면 아무 문자열이나 새 카운터를 만들 수 있다."""
    req = _req("127.0.0.1", {"X-Forwarded-For": "not-an-ip"})
    assert rl.client_ip(req) == "127.0.0.1"


async def test_Redis가_죽어도_로그인은_된다(client, make_user, monkeypatch):
    """레이트리밋은 fail-open이다 — 제한이 안 걸리는 것보다 전부 막히는 게 더 나쁘다."""
    await make_user(email="me@example.com", password=hash_password("correct"))

    class Broken:
        def __getattr__(self, _):
            raise ConnectionError("redis down")

    import app.core.database.redis as redis_module
    monkeypatch.setattr(redis_module, "_client", Broken())

    res = await client.post(LOGIN, json=_body(password="correct"))

    assert res.status_code == 200
