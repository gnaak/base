"""관리자 계정을 만든다 (또는 비밀번호를 바꾼다).

관리자 가입 API 는 일부러 없다 — 첫 관리자는 서버에서 이 스크립트로 만든다.

    cd backend
    uv run python -m scripts.create_admin admin@example.com            # 비밀번호는 프롬프트로 입력
    uv run python -m scripts.create_admin admin@example.com --password-env ADMIN_PASSWORD   # CI·E2E 용

운영 서버에서는 `APP_ENV=prod` 를 붙여 운영 DB 를 가리키게 한다:

    sudo -u ubuntu env APP_ENV=prod uv run python -m scripts.create_admin admin@example.com

이미 있는 이메일이면 `--reset` 을 줘야 비밀번호를 바꾼다 (실수로 덮어쓰지 않게).
비밀번호는 명령행 인자로 받지 않는다 — 셸 히스토리와 `ps` 에 남는다.
"""

import argparse
import asyncio
import getpass
import os
import sys

from sqlalchemy import select

from app.core.database.base import SessionLocal, engine
from app.module.admin.admin import Admin
from app.module.auth.auth_service import hash_password

MIN_PASSWORD = 8
MAX_PASSWORD = 128


def _read_password(env_name: str | None) -> str:
    if env_name:
        password = os.environ.get(env_name, "")
        if not password:
            sys.exit(f"환경변수 {env_name} 가 비어 있습니다")
        return password

    password = getpass.getpass("비밀번호: ")
    if password != getpass.getpass("비밀번호 확인: "):
        sys.exit("두 비밀번호가 다릅니다")
    return password


async def create_admin(email: str, password: str, *, reset: bool) -> str:
    async with SessionLocal() as db:
        admin = (await db.execute(select(Admin).where(Admin.email == email))).scalar_one_or_none()
        if admin and not reset:
            return "exists"
        if admin:
            admin.password = hash_password(password)
            result = "reset"
        else:
            db.add(Admin(email=email, password=hash_password(password)))
            result = "created"
        await db.commit()
    await engine.dispose()
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="관리자 계정을 만든다")
    parser.add_argument("email")
    parser.add_argument("--password-env", help="비밀번호를 읽을 환경변수 이름 (없으면 프롬프트)")
    parser.add_argument("--reset", action="store_true", help="이미 있으면 비밀번호를 바꾼다")
    args = parser.parse_args()

    email = args.email.strip().lower()
    if "@" not in email:
        sys.exit("이메일 형식이 아닙니다")

    password = _read_password(args.password_env)
    if not MIN_PASSWORD <= len(password) <= MAX_PASSWORD:
        sys.exit(f"비밀번호는 {MIN_PASSWORD}~{MAX_PASSWORD}자여야 합니다")

    result = asyncio.run(create_admin(email, password, reset=args.reset))
    messages = {
        "created": f"관리자를 만들었습니다: {email}",
        "reset": f"비밀번호를 바꿨습니다: {email}",
        "exists": f"이미 있는 관리자입니다: {email} (비밀번호를 바꾸려면 --reset)",
    }
    print(messages[result])


if __name__ == "__main__":
    main()
