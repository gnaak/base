"""scripts/prepare_local — /start 가 로컬 DB · Redis 를 준비할 때 쓴다.

남의 데이터를 건드리지 않는 것이 핵심이라 그 부분만 본다 (실제 MySQL · Redis 접속은 /start 가 확인한다).
"""

import fakeredis

from scripts import prepare_local


def _fake_redis(monkeypatch, used: tuple[int, ...]):
    server = fakeredis.FakeServer()
    for n in used:
        fakeredis.FakeRedis(server=server, db=n).set("someone-else", "1")
    monkeypatch.setattr(prepare_local, "_redis", lambda db=0: fakeredis.FakeRedis(server=server, db=db))


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
