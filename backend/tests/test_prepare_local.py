"""scripts/prepare_local — /start 가 로컬 DB · Redis 를 준비할 때 쓴다.

남의 데이터를 건드리지 않는 것이 핵심이라 그 부분만 본다 (실제 MySQL · Redis 접속은 /start 가 확인한다).
"""

from types import SimpleNamespace

import fakeredis

from scripts import prepare_local


def _raw(monkeypatch, redis_host="localhost"):
    # 개발 PC 의 backend/.env 가 아니라 테스트가 정한 값으로 (memory 로 적어 둔 PC 에서도 같은 결과)
    raw = SimpleNamespace(
        local_redis_host=redis_host, local_redis_port=6379,
        local_mysql_host="127.0.0.1", mysql_port=3306,
    )
    monkeypatch.setattr(prepare_local, "_raw", lambda: raw)


def _fake_redis(monkeypatch, used: tuple[int, ...]):
    _raw(monkeypatch)
    server = fakeredis.FakeServer()
    for n in used:
        fakeredis.FakeRedis(server=server, db=n).set("someone-else", "1")
    monkeypatch.setattr(prepare_local, "_redis", lambda db=0: fakeredis.FakeRedis(server=server, db=db))


class _FakeMySQL:
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def cursor(self):
        return self

    def execute(self, sql):
        pass

    def fetchone(self):
        return ("8.0.0",)


def _no_redis(db=0):
    raise AssertionError("메모리 Redis 인데 접속하려 했다")


def test_메모리_Redis면_접속하지_않고_통과한다(monkeypatch, capsys):
    _raw(monkeypatch, redis_host="memory")
    monkeypatch.setattr(prepare_local, "_mysql", _FakeMySQL)
    monkeypatch.setattr(prepare_local, "_redis", _no_redis)

    assert prepare_local.check() == 0
    assert "Redis 메모리" in capsys.readouterr().out


def test_메모리_Redis면_번호를_고르지_않는다(monkeypatch, capsys):
    _raw(monkeypatch, redis_host="memory")
    monkeypatch.setattr(prepare_local, "_redis", _no_redis)

    assert prepare_local.free_redis_db() == 0
    assert capsys.readouterr().out.strip() == "0"


def test_키가_있는_번호는_건너뛰고_비어_있는_가장_작은_번호를_고른다(monkeypatch, capsys):
    _fake_redis(monkeypatch, used=(1, 2, 4))
    assert prepare_local.free_redis_db() == 0
    assert capsys.readouterr().out.strip() == "3"


def test_0번과_15번은_비어_있어도_고르지_않는다(monkeypatch, capsys):
    # 0 은 다른 프로젝트의 기본값, 15 는 E2E 몫
    _fake_redis(monkeypatch, used=tuple(range(1, 15)))
    assert prepare_local.free_redis_db() == 1
    out = capsys.readouterr()
    assert out.out == ""
    assert "비어 있는 Redis 번호가 없습니다" in out.err


def test_이상한_DB_이름이면_접속하기_전에_멈춘다(monkeypatch, capsys):
    connected = []
    monkeypatch.setattr(prepare_local, "_mysql", lambda: connected.append(True))
    assert prepare_local.create_databases(["db_ok", "db`; DROP DATABASE db_ok; --"]) == 1
    assert connected == []
    assert "DB 이름이 이상합니다" in capsys.readouterr().out


def test_빈_시크릿만_채우고_값은_출력하지_않는다(tmp_path, capsys):
    env = tmp_path / ".env"
    env.write_text("jwt_secret=\nhash_key=keep-this-value\nother=1\n", encoding="utf-8")

    assert prepare_local.fill_secrets(env) == 0

    text = env.read_text(encoding="utf-8")
    secret = text.splitlines()[0].split("=", 1)[1]
    assert len(secret) >= 32
    assert "hash_key=keep-this-value" in text  # 이미 있는 값은 그대로
    out = capsys.readouterr().out
    assert "채움: jwt_secret" in out
    assert secret not in out  # 대화 기록에 남지 않게


def test_줄_번호만_알려주고_값은_출력하지_않는다(tmp_path, capsys):
    env = tmp_path / ".env"
    env.write_text("a=1\nlocal_mysql_password=s3cret\n", encoding="utf-8")

    assert prepare_local.env_line("local_mysql_password", env) == 0
    out = capsys.readouterr().out
    assert out.strip() == "2"
    assert "s3cret" not in out


def test_비밀이_아닌_값은_바꾸고_비밀값은_받지_않는다(tmp_path, capsys):
    env = tmp_path / ".env"
    env.write_text("local_mysql_db=db_example\nlocal_redis_password=old\n", encoding="utf-8")

    assert prepare_local.set_value("local_mysql_db", "db_dongne", env) == 0
    assert prepare_local.set_value("redis_db", "3", env) == 0  # 없으면 끝에 더한다
    assert prepare_local.set_value("local_redis_password", "new-secret", env) == 1  # 비밀값은 편집기로
    assert prepare_local.set_value("local_redis_password", "", env) == 0  # 비우기는 된다

    text = env.read_text(encoding="utf-8")
    assert "local_mysql_db=db_dongne" in text
    assert "redis_db=3" in text
    assert "local_redis_password=\n" in text
    assert "new-secret" not in capsys.readouterr().out


def test_관리자_비밀번호는_파일에만_적고_화면에_찍지_않는다(tmp_path, monkeypatch, capsys):
    import scripts.create_admin as create_admin_module

    made = {}

    async def fake_create_admin(email, password, *, reset):
        made["password"] = password
        return "created"

    monkeypatch.setattr(create_admin_module, "create_admin", fake_create_admin)
    out_file = tmp_path / "admin-password.local"

    assert prepare_local.make_admin("admin@example.com", out_file) == 0

    assert made["password"] in out_file.read_text(encoding="utf-8")
    assert made["password"] not in capsys.readouterr().out
