# 로컬 개발 서버. http://localhost:8000 (문서: /docs)
#
# `uv run` 은 실행 전에 uv.lock 과 .venv 를 맞춰준다 —
# 누가 의존성을 추가하고 커밋했어도 pull 후 그냥 이걸 돌리면 된다.
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
