#!/bin/sh
# 운영 실행. 개발은 run.sh (--reload) 를 쓴다.
#
# APP_ENV 를 여기서 못 박는 이유 — 안 주면 settings 가 호스트명으로 추측하는데,
# 그 추측은 EC2 기본 호스트명에서만 맞는다. Docker·Cloud Run 에 올리면 조용히
# local 로 떨어져서 쿠키가 secure=False / SameSite=Lax 로 나가고 세션이 안 잡힌다.
# 배포 사고의 단골이라 스크립트에 박아둔다.
#
# ⚠️ --workers 를 올리지 말 것. 파일 로그 로테이션이 프로세스끼리 충돌한다
#    (core/logging/config.py 주석 참고). 프로세스를 늘려야 하면 파일 핸들러 대신
#    stdout 수집(systemd / docker 로그 드라이버)으로 먼저 바꾼다.
#
# 기동 로그의 `설정: env=prod (근거: APP_ENV)` 와 경고 줄을 한 번 확인할 것.

set -e

export APP_ENV=prod

exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers \
  --forwarded-allow-ips="${FORWARDED_ALLOW_IPS:-127.0.0.1}"
