# 넣기 — 스케줄러 (주기 작업)

매일 새벽 정리 · 매시 집계 · 마감 시각 처리처럼 **정해진 때 도는 일**. 요청에 붙는 일이 아니다.

## 방식 — 앱 안의 APScheduler 3

- 이 템플릿은 프로세스가 하나다 (`deploy/fastapi.service` 의 `--workers 1`). 앱 안에서 돌려도 두 번 돌지 않는다
- 그래도 **회차마다 Redis 잠금**을 건다 — 서버를 늘리거나 재시작이 겹쳐도 한 회차는 한 번만 (시제품으로 확인: 두 스케줄러 중 하나만 실행)
- 운영 서버에 따로 깔 것이 없다 (cron · systemd timer 불필요). 배포 스크립트도 그대로

**이 레시피 밖** — 한 번에 몇 분 넘게 CPU 를 쓰는 일(대량 변환 · 대용량 내보내기)은 요청 처리를 느리게 한다.
그건 별도 프로세스(`uv run python -m scripts.<작업>` + systemd timer)로 빼야 하고 `infra/server/deploy.sh` 를 고쳐야 한다 — 사람에게 먼저 묻는다.

## 1. 의존성

`backend/pyproject.toml` 의 `# ── 기타 ──` 아래에 한 줄 넣고 lock:

```toml
    "apscheduler>=3.11,<4",   # 주기 작업 (core/scheduler.py). 4.x 는 API 가 다르다
```

```bash
uv --directory backend lock && uv --directory backend sync
```

`uv add` 를 쓰지 않는 이유 — 파일의 주석 정렬을 통째로 바꿔 diff 가 지저분해진다.
`<4` 를 꼭 건다 — 4.x 는 API 가 완전히 다르다 (`AsyncScheduler`, 데이터 저장소 필수).

## 2. `backend/app/core/scheduler.py` (새 파일)

```python
"""주기 작업 — 앱 프로세스 안에서 돈다 (APScheduler 3).

프로세스가 하나라(--workers 1) 두 번 돌 일은 없지만, 회차마다 Redis 잠금을 건다 —
서버를 늘리거나 재시작이 겹쳐도 한 회차는 한 번만. 작업 등록은 app/module/jobs.py 한 곳.
"""

import functools
from collections.abc import Awaitable, Callable

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config.settings import settings
from app.core.database.base import SessionLocal
from app.core.database.redis import get_redis
from app.core.logging import get_logger
from app.core.provider.http.service import ServiceProvider

logger = get_logger(__name__)
KST = "Asia/Seoul"
_scheduler: AsyncIOScheduler | None = None


def job(name: str, lock_seconds: int = 300):
    """작업 본문 `async def body(p: ServiceProvider)` 을 스케줄러가 부를 함수로 감싼다.

    - DB 세션을 열고 닫는다. 커밋은 본문(서비스)이 한다
    - `job:{name}` 을 lock_seconds 동안 잡는다. 이미 잡혀 있으면 건너뛴다 —
      **주기보다 짧게, 작업 시간보다 길게** (매분 도는 작업이면 50)
    - 예외는 로그(error.log)로 남기고 삼킨다 — 스케줄러가 죽지 않게
    """

    def wrap(body: Callable[[ServiceProvider], Awaitable[None]]):
        @functools.wraps(body)
        async def run() -> None:
            if not await get_redis().set(f"job:{name}", "1", nx=True, ex=lock_seconds):
                logger.info("작업 건너뜀 — 다른 곳에서 도는 중: %s", name)
                return
            logger.info("작업 시작: %s", name)
            try:
                async with SessionLocal() as db:
                    await body(ServiceProvider(None, db))
                logger.info("작업 끝: %s", name)
            except Exception:
                logger.exception("작업 실패: %s", name)

        return run

    return wrap


def start_scheduler() -> None:
    global _scheduler
    if not settings.raw.scheduler_enabled:
        logger.info("스케줄러 꺼짐 (scheduler_enabled=false)")
        return
    from app.module.jobs import register  # 서비스를 끌어오므로 여기서 (순환 import 방지)

    _scheduler = AsyncIOScheduler(timezone=KST)
    register(_scheduler)
    _scheduler.start()
    for j in _scheduler.get_jobs():
        logger.info("작업 등록: %s — 다음 %s", j.id, j.next_run_time)


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
```

## 3. `backend/app/module/jobs.py` (새 파일) — 언제 도는지만 여기에

```python
"""주기 작업 등록 — 한 곳. 본문의 로직은 도메인 서비스에 두고, 여기서는 언제 돌지만 정한다."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.config.settings import settings
from app.core.provider.http.service import ServiceProvider
from app.core.scheduler import KST, job


@job("purge_deleted_users")
async def purge_deleted_users(p: ServiceProvider) -> None:
    await p.user_service.purge_deleted(days=30)  # 예시 — 실제 서비스 메서드로


def register(s: AsyncIOScheduler) -> None:
    s.add_job(
        purge_deleted_users,
        CronTrigger.from_crontab(settings.raw.purge_cron, timezone=KST),  # ⚠️ timezone 필수
        id="purge_deleted_users",
        coalesce=True,  # 서버가 꺼져 있다 켜져도 밀린 회차를 몰아서 돌리지 않고 한 번만
        max_instances=1,
        misfire_grace_time=600,  # 10분 안에 켜지면 놓친 회차를 돈다
    )
```

- **`timezone=KST` 를 트리거에 꼭 준다.** 안 주면 스케줄러 설정이 아니라 **그 PC 의 시간대**를 쓴다 —
  로컬(KST)에선 맞고 서버(EC2, UTC)에선 9시간 어긋난다 (시제품으로 확인: 스케줄러를 UTC 로 줘도 트리거는 PC 시간대)
- 도는 시각이 PRD 의 U\*(마감 시각 등)에 걸리면 cron 식을 **설정값**으로 (`purge_cron: str = "0 4 * * *"`) — 아침의 결정이 값 하나가 되게
- 본문은 **중간에 끊겨도 다시 돌면 이어지게**(멱등) 쓴다 — 배포 · 재시작마다 진행 중인 작업이 끊길 수 있다 (`--graceful-timeout 30`)
- 돈이 오가는 작업(정산 · 자동 결제)은 회차 단위로 "이미 처리됨" 표시를 DB 에 남긴다. Redis 잠금은 겹침을 막을 뿐 두 번 처리를 막지는 못한다

## 4. 설정 — `RawEnv` (`backend/app/core/config/settings.py`)

```python
    # 스케줄러 — false 면 주기 작업을 돌리지 않는다 (서버를 여러 대로 늘려 한 대만 돌릴 때 등)
    scheduler_enabled: bool = True
    purge_cron: str = "0 4 * * *"  # 예시. PRD U* 에 걸린 시각이면 DECISIONS.md 에도
```

운영 값을 바꾸려면 Parameter Store `/<project>/backend/scheduler_enabled` — 이름이 필드와 다르면 기동 거부.
`backend/.env.example` 에도 같은 키를 주석과 함께.

## 5. 기동 · 종료 — `backend/app/main.py` lifespan

```python
from app.core.scheduler import start_scheduler, stop_scheduler
...
    get_http_client()
    start_scheduler()       # DB · Redis 확인 뒤에

    yield

    logger.info("🛑 Backend 종료 중...")
    stop_scheduler()        # 맨 먼저 — 닫힌 Redis · DB 로 작업이 돌지 않게
    await close_redis()
```

pytest 는 lifespan 을 타지 않으므로 테스트 중에는 스케줄러가 안 돈다. E2E · `run.sh` 는 돈다.

## 6. 로그

`EXTRA_LOG_CHANNELS` (`core/logging/config.py`)에 `"jobs": "app.core.scheduler"` — 작업 시작 · 끝 · 실패가 `logs/jobs.log` 에 따로.

## 7. 테스트 — `backend/tests/test_jobs.py`

시각을 기다리는 테스트는 쓰지 않는다. **본문 · 잠금 · 등록**을 따로 본다.

```python
import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler

import app.core.scheduler as scheduler
from app.core.provider.http.service import ServiceProvider
from app.module import jobs


async def test_본문이_지운_지_30일_넘은_회원을_정리한다(db, make_user):
    ...  # 데이터 준비
    await jobs.purge_deleted_users.__wrapped__(ServiceProvider(None, db))  # 잠금 · 세션 없이 본문만
    ...  # 결과 확인


@pytest.fixture
def test_session(monkeypatch, db):
    class _Same:  # 작업이 여는 세션을 테스트 세션으로 (개발 DB 에 붙지 않게)
        async def __aenter__(self):
            return db

        async def __aexit__(self, *exc):
            return False

    monkeypatch.setattr(scheduler, "SessionLocal", _Same)


async def test_같은_회차는_한_번만_돈다(fake_redis, test_session, monkeypatch):
    ran = []

    @scheduler.job("t", lock_seconds=60)
    async def body(p):
        ran.append(1)

    await body()
    await body()
    assert ran == [1]


def test_서버가_UTC여도_한국_시각에_돈다():
    s = AsyncIOScheduler(timezone="UTC")
    jobs.register(s)
    trigger = s.get_jobs()[0].trigger
    assert str(trigger.timezone) == "Asia/Seoul"
```

## 8. 문서

- `backend/CLAUDE.md` — "주기 작업" 절: 등록은 `module/jobs.py`, 본문은 서비스, `timezone` 필수, 멱등
- `PROJECT.md` 해당 phase 의 "모듈" 줄에서 `+scheduler` 를 ✅ 로

## 확인

```bash
uv --directory backend run ruff check . --fix   # main.py 에 넣은 import 순서를 맞춘다
uv --directory backend run pytest tests/test_jobs.py -v
sh run.sh                              # backend/ 에서. 기동 로그에 "작업 등록: … — 다음 …+09:00"
```
