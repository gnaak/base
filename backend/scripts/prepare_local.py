"""로컬 개발 DB · Redis · 시크릿을 준비한다 — `/start` 가 부른다. 손으로 써도 된다.

한 PC 에서 여러 프로젝트가 MySQL · Redis 하나를 같이 쓰는 게 보통이다. 그래서 새 서버를 띄우기 전에
이미 떠 있는 것에 붙어 보고, 붙으면 **이 프로젝트 이름의 DB 만 만들고 비어 있는 Redis 번호를 고른다.**
남의 DB · 키는 건드리지 않는다 (`CREATE DATABASE IF NOT EXISTS` 와 읽기만).

**비밀값은 출력하지 않는다** — 화면에 찍히면 Claude 의 대화 기록에 남는다.
그래서 Claude 가 `.env` 를 읽지 않아도 되게:
`secrets` 는 `.env` 에 바로 쓰고, `set` 은 비밀이 아닌 값만 바꾸고, `admin` 은 비밀번호를 파일에만 적고,
`line` 은 줄 번호만 알려 준다(사람이 메모장으로 열어 직접 적게).

    uv --directory backend run python -m scripts.prepare_local <명령>

    secrets                  빈 jwt_secret · hash_key 채우기
    set local_mysql_db db_x  비밀이 아닌 값 바꾸기 (비밀값은 비우기만)
    set local_redis_host memory   Redis 설치 없이 — 로컬 전용 메모리 Redis
    admin                    로컬 관리자 — 비밀번호는 backend/admin-password.local 에만
    line local_mysql_password  그 키의 줄 번호
    check                    MySQL · Redis 에 붙는지
    databases db_x db_x_test db_x_e2e
    redis-db                 비어 있는 번호 (1~14) 하나

접속 정보는 backend/.env 의 local_* 를 쓴다 (APP_ENV 와 무관하게 로컬).
"""

import argparse
import re
import secrets as token
import sys
from pathlib import Path

import pymysql
import redis

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
ADMIN_FILE = ENV_FILE.parent / "admin-password.local"  # .gitignore 의 *.local
SECRET_KEYS = ("jwt_secret", "hash_key")
SECRET_HINT = re.compile(r"password|secret|token|api_key|hash_key|client_secret", re.I)
REDIS_MEMORY = "memory"  # settings.REDIS_MEMORY — 여기서 settings 를 불러오면 막 받은 .env 에서 검증에 걸린다
# 0 은 기본값이라 다른 프로젝트가 쓰고 있을 가능성이 가장 크고, 15 는 E2E 가 쓴다
CANDIDATE_REDIS_DBS = range(1, 15)
DB_NAME = re.compile(r"^[A-Za-z0-9_]{1,64}$")


def _raw():
    # 설정은 쓸 때 읽는다 — 모듈을 불러오는 순간 읽으면, jwt_secret 이 비어 있는 막 받은 .env 에서
    # 검증에 걸려 `secrets`(그걸 채우는 명령)조차 못 돈다
    from app.core.config.settings import settings

    return settings.raw


def fill_secrets(env_file: Path = ENV_FILE) -> int:
    """비어 있는 jwt_secret · hash_key 를 새 값으로 채운다. 값은 출력하지 않는다. 이미 있는 값은 그대로."""
    if not env_file.exists():
        print(f"{env_file.name} 이 없습니다 — .env.example 을 복사한 뒤 다시")
        return 1
    text = env_file.read_text(encoding="utf-8")
    filled = []
    for key in SECRET_KEYS:
        pattern = re.compile(rf"^{key}=[ \t]*$", re.M)
        if pattern.search(text):
            text = pattern.sub(f"{key}={token.token_urlsafe(48)}", text, count=1)
            filled.append(key)
    if filled:
        env_file.write_text(text, encoding="utf-8")
    print(f"채움: {', '.join(filled)}" if filled else "이미 채워져 있음")
    return 0


def set_value(key: str, value: str, env_file: Path = ENV_FILE) -> int:
    """`key=value` 로 바꾼다 (없으면 끝에 더한다). 비밀값은 받지 않는다 — 비우는 것(빈 값)만 된다.

    Claude 가 DB 이름 하나 바꾸려고 `.env` 를 열어 읽으면 그 안의 비밀값이 통째로 대화 기록에 들어간다.
    """
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
        print(f"키 이름이 이상합니다: {key!r}")
        return 1
    if SECRET_HINT.search(key) and value:
        print(f"{key} 는 비밀값이라 여기서 받지 않는다 — 편집기로 열어 사람이 적게 한다 (line {key})")
        return 1
    if not env_file.exists():
        print(f"{env_file.name} 이 없습니다")
        return 1
    text = env_file.read_text(encoding="utf-8")
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.M)
    if pattern.search(text):
        text = pattern.sub(lambda _: f"{key}={value}", text, count=1)
    else:
        text = text.rstrip("\n") + f"\n{key}={value}\n"
    env_file.write_text(text, encoding="utf-8")
    print(f"설정: {key}" + (f"={value}" if not SECRET_HINT.search(key) else " (비움)"))
    return 0


def make_admin(email: str = "admin@example.com", out: Path = ADMIN_FILE) -> int:
    """로컬 관리자를 만든다. 비밀번호는 화면에 찍지 않고 out 파일에만 적는다 (사람이 편집기로 열어 본다)."""
    import asyncio

    from scripts.create_admin import create_admin

    password = token.token_urlsafe(12)
    result = asyncio.run(create_admin(email, password, reset=False))
    if result == "exists":
        print(f"이미 있는 관리자: {email} — 비밀번호는 그대로 (바꾸려면 create_admin --reset)")
        return 0
    out.write_text(
        f"로컬 관리자\n이메일: {email}\n비밀번호: {password}\n\n"
        "이 파일은 git 에 올라가지 않는다 (*.local). 다른 곳에 옮겨 적었으면 지워도 된다.\n",
        encoding="utf-8",
    )
    print(f"관리자 {email} — 비밀번호는 {out.name} 에 적었다 (화면에는 찍지 않는다)")
    return 0


def env_line(key: str, env_file: Path = ENV_FILE) -> int:
    """`key=` 가 있는 줄 번호만 출력한다 (값은 출력하지 않는다). 편집기로 그 줄을 여는 데 쓴다."""
    if not env_file.exists():
        print(f"{env_file.name} 이 없습니다")
        return 1
    for n, line in enumerate(env_file.read_text(encoding="utf-8").splitlines(), 1):
        if line.startswith(f"{key}="):
            print(n)
            return 0
    print(f"{key} 줄이 없습니다", file=sys.stderr)
    return 1


def _in_memory(raw) -> bool:
    return raw.local_redis_host.strip().lower() == REDIS_MEMORY


def _mysql() -> pymysql.connections.Connection:
    raw = _raw()
    return pymysql.connect(
        host=raw.local_mysql_host,
        port=raw.mysql_port,
        user=raw.local_mysql_user,
        password=raw.local_mysql_password,
        connect_timeout=5,
    )


def _redis(db: int = 0) -> redis.Redis:
    raw = _raw()
    return redis.Redis(
        host=raw.local_redis_host,
        port=raw.local_redis_port,
        password=raw.local_redis_password or None,
        db=db,
        protocol=2,  # 옛 Redis(3.x)는 RESP3 의 HELLO 를 모른다 — core/database/redis.py 와 같다
        socket_connect_timeout=5,
    )


def check() -> int:
    """둘 다 붙으면 0. 안 붙으면 무엇이 왜 안 되는지 출력하고 1. 비밀번호는 출력하지 않는다."""
    raw = _raw()
    ok = True
    try:
        with _mysql() as conn, conn.cursor() as cur:
            cur.execute("SELECT VERSION()")
            print(f"MySQL OK {cur.fetchone()[0]} ({raw.local_mysql_host}:{raw.mysql_port})")
    except pymysql.err.OperationalError as e:
        ok = False
        # "Access denied … (using password: YES/NO)" — 비밀번호가 틀렸는지 / 비어 있는지까지만 알 수 있다
        print(f"MySQL 실패 {e.args[-1]} — backend/.env 의 local_mysql_user · local_mysql_password 를 맞출 것")
    if _in_memory(raw):
        print("Redis 메모리 — 설치 없이 (로컬 전용 · 재시작하면 비워진다)")
        return 0 if ok else 1
    try:
        info = _redis().info("server")
        print(f"Redis OK {info.get('redis_version')} ({raw.local_redis_host}:{raw.local_redis_port})")
    except redis.AuthenticationError as e:
        ok = False
        # 비밀번호가 없는 Redis 에 값을 줬거나, 있는 Redis 에 안 줬다 — local_redis_password 를 맞춘다
        print(f"Redis 실패 인증 — {e} (backend/.env 의 local_redis_password 를 실제 Redis 와 맞출 것)")
    except redis.RedisError as e:
        ok = False
        print(f"Redis 실패 {e}")
    return 0 if ok else 1


def create_databases(names: list[str]) -> int:
    for name in names:
        if not DB_NAME.match(name):
            print(f"DB 이름이 이상합니다: {name!r} (영문 · 숫자 · _ 만)")
            return 1
    with _mysql() as conn, conn.cursor() as cur:
        for name in names:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            print(f"DB OK {name}")
    return 0


def free_redis_db() -> int:
    """키가 하나도 없는 번호 중 가장 작은 것을 출력한다. 없으면 1."""
    if _in_memory(_raw()):
        print(0)  # 메모리 Redis 는 이 프로젝트 혼자 쓴다
        return 0
    for n in CANDIDATE_REDIS_DBS:
        with _redis(n) as client:
            if client.dbsize() == 0:
                print(n)
                return 0
    print("비어 있는 Redis 번호가 없습니다 (1~14 가 전부 쓰이는 중)", file=sys.stderr)
    return 1


def main() -> None:
    # 한글 Windows 의 기본 출력 인코딩(cp949)은 — 같은 글자를 못 찍고 죽는다.
    # Claude Code 의 셸(Git Bash)은 UTF-8 로 읽는다
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="로컬 DB · Redis · 시크릿 준비")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("secrets", help="빈 jwt_secret · hash_key 채우기 (값은 출력하지 않는다)")
    setter = sub.add_parser("set", help="비밀이 아닌 값 바꾸기 (비밀값은 비우기만)")
    setter.add_argument("key")
    setter.add_argument("value")
    sub.add_parser("admin", help="로컬 관리자 — 비밀번호는 admin-password.local 에만")
    line = sub.add_parser("line", help="backend/.env 에서 그 키의 줄 번호")
    line.add_argument("key")
    sub.add_parser("check", help="MySQL · Redis 접속 확인")
    db = sub.add_parser("databases", help="DB 만들기 (이미 있으면 그대로)")
    db.add_argument("names", nargs="+")
    sub.add_parser("redis-db", help="비어 있는 Redis 번호")
    args = parser.parse_args()

    if args.command == "secrets":
        sys.exit(fill_secrets())
    if args.command == "set":
        sys.exit(set_value(args.key, args.value))
    if args.command == "admin":
        sys.exit(make_admin())
    if args.command == "line":
        sys.exit(env_line(args.key))
    if args.command == "check":
        sys.exit(check())
    if args.command == "databases":
        sys.exit(create_databases(args.names))
    sys.exit(free_redis_db())


if __name__ == "__main__":
    main()
