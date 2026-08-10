# 로컬 전용: 모델 변경 후 리비전 생성 + 로컬 DB에 적용.
# 생성된 alembic/versions/*.py는 반드시 커밋할 것 — 서버는 이 파일들로 upgrade한다.
# 사용법: sh migrate.sh "리비전 메시지"
#
# ⚠️ 서버에서는 이 스크립트를 쓰지 말 것 (autogenerate 금지).
#    배포 시에는 `alembic upgrade head`만 실행한다.
alembic revision --autogenerate -m "${1:-update}"
alembic upgrade head
