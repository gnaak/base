# syntax=docker/dockerfile:1
#
# 운영 배포용 이미지. 빌드 컨텍스트는 `backend/` 다.
#
#   docker build -t base-backend ./backend
#   docker run --rm -p 8000:8000 --env-file backend/.env base-backend
#
# ⚠️ 개발에는 쓰지 않는다. 소스를 바인드 마운트해야 핫리로드가 되는데, Windows 에서
#    `C:\...` 를 마운트하면 파일 I/O 가 느리고 inotify 이벤트가 넘어오지 않아
#    `--reload` 가 제대로 안 먹는다. 개발은 로컬 venv + `sh run.sh` 로 한다.
#    (MySQL·Redis 는 루트 docker-compose.yml 로 띄운다)

# ── builder ──────────────────────────────────────────────────
# 휠을 여기서 만들고 런타임 이미지에는 결과만 넣는다 — 컴파일러가 최종 이미지에 남지 않는다.
FROM python:3.12-slim AS builder

# argon2-cffi 등 일부 패키지가 C 확장을 빌드할 수 있다
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# ── runtime ──────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Seoul

# 이 이미지는 운영용이다. 이걸 안 박아두면 settings 가 호스트명으로 env 를 추측하는데,
# 컨테이너 호스트명은 EC2 패턴이 아니라 조용히 local 로 떨어진다 —
# 쿠키가 secure=False 로 나가고 세션이 안 잡히는, 이 템플릿의 단골 사고다.
# 스테이징 등으로 쓰려면 실행 시 -e APP_ENV=... 로 덮어쓴다.
ENV APP_ENV=prod

# tzdata: 없으면 TZ 가 무시돼 로그 시각이 UTC 로 찍힌다 (이 템플릿은 KST 기준)
RUN apt-get update && apt-get install -y --no-install-recommends \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

# 루트로 실행하지 않는다
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin app

WORKDIR /app

COPY --from=builder /wheels /wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

COPY --chown=app:app . .

# 로그·미디어는 볼륨으로 빼는 것을 전제하되, 안 빼도 기동되게 디렉토리는 만들어 둔다
RUN mkdir -p logs media && chown -R app:app logs media

USER app
EXPOSE 8000

# main.py 의 lifespan 이 DB·Redis 연결을 fail-fast 로 검증하므로,
# 컨테이너가 살아 있다 = 의존 서비스에도 붙었다는 뜻이다.
# curl 을 설치하지 않으려고 파이썬으로 확인한다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request as u; u.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"]

# ⚠️ --workers 를 올리지 말 것. 파일 로그 로테이션이 프로세스끼리 충돌한다
#    (core/logging/config.py 주석 참고). 프로세스를 늘려야 하면 컨테이너를 여러 개 띄우고
#    파일 핸들러 대신 stdout 수집으로 전환한다.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
