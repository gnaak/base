# 서버 전용: 커밋된 alembic/versions/*.py를 DB에 적용만 한다.
# 리비전 생성(autogenerate)은 로컬 migrate.sh에서 — 서버에서 하면 히스토리가 갈라진다.
#
# 배포 절차: git pull → uv sync --no-dev --group prod → sh migrate_server.sh → 서버 재시작
#
# ⚠️ APP_ENV=prod가 설정돼 있어야 prod DB에 붙는다 (없으면 호스트명으로 추측 — CLAUDE.md 참고)
# ⚠️ 테이블이 이미 있는 DB에 최초 도입할 때는 이 스크립트 대신 `alembic stamp head`를 1회 실행
set -e

if [ -z "$APP_ENV" ]; then
    echo "⚠️  APP_ENV가 비어 있음 — 호스트명으로 env를 추측합니다 (의도한 DB인지 확인!)"
fi

# --frozen: lock 을 다시 풀지 않는다. 서버에서 조용히 버전이 올라가는 것을 막는다.
uv run --frozen alembic upgrade head
echo "현재 리비전:"
uv run --frozen alembic current
