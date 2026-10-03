"""로컬 개발 DB · Redis 를 준비한다 — `/start` 가 부른다. 손으로 써도 된다.

한 PC 에서 여러 프로젝트가 MySQL · Redis 하나를 같이 쓰는 게 보통이다. 그래서 새 서버를 띄우기 전에
이미 떠 있는 것에 붙어 보고, 붙으면 **이 프로젝트 이름의 DB 만 만들고 비어 있는 Redis 번호를 고른다.**
남의 DB · 키는 건드리지 않는다 (`CREATE DATABASE IF NOT EXISTS` 와 읽기만).

    cd backend
    uv run python -m scripts.prepare_local check                          # MySQL · Redis 에 붙는지
    uv run python -m scripts.prepare_local databases db_x db_x_test db_x_e2e
    uv run python -m scripts.prepare_local redis-db                       # 비어 있는 번호 (1~14) 하나

접속 정보는 backend/.env 의 local_* 를 쓴다 (APP_ENV 와 무관하게 로컬).
"""

import argparse
import re
import sys

import pymysql
import redis

from app.core.config.settings import settings

# 0 은 기본값이라 다른 프로젝트가 쓰고 있을 가능성이 가장 크고, 15 는 E2E 가 쓴다
CANDIDATE_REDIS_DBS = range(1, 15)
DB_NAME = re.compile(r"^[A-Za-z0-9_]{1,64}$")


def _mysql() -> pymysql.connections.Connection:
    raw = settings.raw
    return pymysql.connect(
        host=raw.local_mysql_host,
        port=raw.mysql_port,
        user=raw.local_mysql_user,
        password=raw.local_mysql_password,
        connect_timeout=5,
    )


def _redis(db: int = 0) -> redis.Redis:
    raw = settings.raw
    return redis.Redis(
        host=raw.local_redis_host,
        port=raw.local_redis_port,
        password=raw.local_redis_password or None,
        db=db,
        protocol=2,  # 옛 Redis(3.x)는 RESP3 의 HELLO 를 모른다 — core/database/redis.py 와 같다
        socket_connect_timeout=5,
    )


def check() -> int:
    """둘 다 붙으면 0. 안 붙으면 무엇이 왜 안 되는지 출력하고 1."""
    ok = True
    try:
        with _mysql() as conn, conn.cursor() as cur:
            cur.execute("SELECT VERSION()")
            print(f"MySQL OK {cur.fetchone()[0]} ({settings.raw.local_mysql_host}:{settings.raw.mysql_port})")
    except pymysql.err.OperationalError as e:
        ok = False
        print(f"MySQL 실패 {e.args[-1]}")
    try:
        info = _redis().info("server")
        where = f"{settings.raw.local_redis_host}:{settings.raw.local_redis_port}"
        print(f"Redis OK {info.get('redis_version')} ({where})")
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

    parser = argparse.ArgumentParser(description="로컬 DB · Redis 준비")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check", help="MySQL · Redis 접속 확인")
    db = sub.add_parser("databases", help="DB 만들기 (이미 있으면 그대로)")
    db.add_argument("names", nargs="+")
    sub.add_parser("redis-db", help="비어 있는 Redis 번호")
    args = parser.parse_args()

    if args.command == "check":
        sys.exit(check())
    if args.command == "databases":
        sys.exit(create_databases(args.names))
    sys.exit(free_redis_db())


if __name__ == "__main__":
    main()
