"""WebSocket 정책 — Origin, 방 권한, 메시지 빈도.

소켓 전체 흐름은 ASGI 테스트 클라이언트로 띄우기 번거로워서, 결정을 내리는 함수만 따로 본다.
이 함수들이 `init_state()` 가 연결을 받기 전에 부르는 관문이다.
"""
import pytest

from app.core.config.settings import settings
from app.core.provider.http.service import Auth
from app.module.web_socket import web_socket_service as ws


@pytest.fixture
def origins(monkeypatch):
    monkeypatch.setattr(type(settings), "cors_origins", property(lambda self: ["https://app.example.com"]))


def test_허용된_Origin_은_통과한다(origins):
    assert ws.origin_allowed("https://app.example.com")
    assert ws.origin_allowed("https://app.example.com/")


def test_다른_사이트의_Origin_은_거부한다(origins):
    """쿠키를 실은 소켓을 다른 사이트가 여는 것(CSWSH)을 막는다."""
    assert not ws.origin_allowed("https://evil.example.net")
    assert not ws.origin_allowed("http://app.example.com")  # 스킴이 다르면 다른 오리진


def test_Origin_이_없으면_브라우저가_아니라서_통과한다(origins):
    assert ws.origin_allowed(None)
    assert ws.origin_allowed("")


def test_공용_방은_누구나_들어간다():
    assert ws.can_join("lobby", None)
    assert ws.can_join("lobby", Auth(user_id=1, auth_type="user"))


def test_자기_방에만_들어간다():
    me = Auth(user_id=7, auth_type="user")
    assert ws.can_join("user:7", me)
    assert not ws.can_join("user:8", me)


def test_로그인_안_했으면_개인_방에_못_들어간다():
    assert not ws.can_join("user:7", None)


def test_모르는_방은_거부한다():
    """쿼리로 받은 room_id 를 그대로 믿으면 누구나 남의 방에 들어간다."""
    assert not ws.can_join("order:123", Auth(user_id=1, auth_type="user"))


def test_메시지_빈도_한도를_넘으면_막힌다():
    rate = ws.MessageRate(limit=3, window=60)
    assert [rate.allow() for _ in range(4)] == [True, True, True, False]


def test_창이_지나면_다시_보낼_수_있다():
    rate = ws.MessageRate(limit=1, window=0)
    assert rate.allow()
    assert rate.allow()
