"""쿠키 SameSite 설정 — 브라우저의 CSRF 기본 방어를 켜고 끄는 스위치.

`Lax` 면 브라우저가 cross-site 요청에 쿠키를 붙이지 않는다. 그게 곧 CSRF 방어다.
`None` 은 그 방어를 끄는 값이라, 정말 cross-site 배포일 때만 써야 한다.
"""
import pytest

from app.core.config.settings import settings
from app.module.auth.auth_service import hash_password

LOGIN = "/api/auth/login"


@pytest.fixture
def samesite(monkeypatch):
    """`.env`의 cookie_samesite 를 바꿔 끼운다."""

    def _set(value):
        monkeypatch.setattr(settings.raw, "cookie_samesite", value)

    return _set


# ──────────────────────────────────────────────────────────────
#  값 해석
# ──────────────────────────────────────────────────────────────
def test_기본값은_Lax다(samesite):
    samesite("lax")
    assert settings.cookie_samesite == "Lax"


def test_대소문자를_가리지_않는다(samesite):
    samesite("NONE")
    assert settings.cookie_samesite == "None"


def test_모르는_값이면_가장_안전한_Lax로_떨어진다(samesite):
    """오타 하나로 CSRF 방어가 조용히 꺼지면 안 된다."""
    samesite("laxx")
    assert settings.cookie_samesite == "Lax"


def test_빈_값도_Lax다(samesite):
    samesite("")
    assert settings.cookie_samesite == "Lax"


# ──────────────────────────────────────────────────────────────
#  기동 경고
# ──────────────────────────────────────────────────────────────
def test_none이면_CSRF_경고가_뜬다(samesite):
    samesite("none")
    assert any("CSRF" in w for w in settings.config_warnings())


def test_none인데_secure가_아니면_거부된다고_경고한다(samesite):
    """local(http)에서 none 을 켜면 브라우저가 쿠키를 아예 안 받는다."""
    samesite("none")
    warnings = settings.config_warnings()
    assert settings.cookie_secure is False  # 테스트는 local 환경
    assert any("거부" in w for w in warnings)


def test_오타는_경고로_알려준다(samesite):
    samesite("laxx")
    assert any("알 수 없어" in w for w in settings.config_warnings())


def test_lax일_때는_쿠키_경고가_없다(samesite):
    samesite("lax")
    assert not any("samesite" in w.lower() or "CSRF" in w for w in settings.config_warnings())


# ──────────────────────────────────────────────────────────────
#  실제 응답에 반영되는지
# ──────────────────────────────────────────────────────────────
async def test_로그인_쿠키에_SameSite가_실린다(client, make_user, samesite):
    samesite("lax")
    await make_user(email="me@example.com", password=hash_password("pw1234"))

    res = await client.post(
        LOGIN, json={"email": "me@example.com", "password": "pw1234", "type": "user"}
    )

    cookies = res.headers.get_list("set-cookie")
    assert cookies
    for raw in cookies:
        assert "samesite=lax" in raw.lower(), raw
