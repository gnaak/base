"""jwt_secret 길이 — 빈 값이나 짧은 값이면 서버가 뜨지 않아야 한다.

빈 키로 서명하면 누구나 `jwt.encode({...}, "", "HS256")` 로 관리자 토큰을 만든다.
`.env.example` 을 그대로 복사하면 빈 값이라 실제로 일어날 수 있는 사고다.
나머지 필드는 `.env` 에서 그대로 읽고 jwt_secret 만 바꿔 끼운다.
"""
import pytest
from pydantic import ValidationError

from app.core.config.settings import RawEnv


@pytest.mark.parametrize("label, value", [("빈 값", ""), ("31자", "x" * 31)])
def test_jwt_secret_이_32자_미만이면_설정을_거부한다(label, value):
    with pytest.raises(ValidationError) as exc:
        RawEnv(jwt_secret=value)
    assert "jwt_secret" in str(exc.value), label


def test_jwt_secret_32자면_통과한다():
    assert RawEnv(jwt_secret="x" * 32).jwt_secret == "x" * 32
