# Base Template

풀스택 프로젝트 베이스 템플릿.

| 영역 | 기술 |
|------|------|
| Frontend | React 19 + TypeScript + Vite 6 + TanStack Query v5 + Tailwind CSS v3 + react-router v7 |
| Backend | FastAPI + SQLAlchemy 2.0 (async) + MySQL(aiomysql) + Redis + Alembic |
| 인증 | 쿠키 기반 JWT + OAuth (Google, Kakao) |

작업 규칙은 [CLAUDE.md](CLAUDE.md), [frontend/CLAUDE.md](frontend/CLAUDE.md), [backend/CLAUDE.md](backend/CLAUDE.md) 참고.

---

## 실행

### 0. DB / Redis

```bash
docker compose up -d
```

MySQL(3306)과 Redis(6379)가 뜬다. 계정 정보는 `backend/.env`의 `local_*` 값과 맞춰져 있다.
직접 설치해서 쓸 거면 `docker-compose.yml`을 안 띄우고 `.env`만 맞추면 된다.

### 1. Backend

```bash
cd backend
python -m venv venv && source venv/Scripts/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

sh migrate.sh    # alembic revision --autogenerate + upgrade head
sh run.sh        # uvicorn :8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev      # :3000
```

`http://localhost:3000` — 클라이언트 / `http://localhost:3000/admin/login` — 관리자

> ⚠️ **프론트와 백엔드 호스트를 반드시 통일할 것** (`localhost`끼리 또는 `127.0.0.1`끼리).
> 섞으면 cross-site가 돼서 `SameSite=Lax` 쿠키가 안 실리고, 로그인은 성공하는데 세션이 안 잡힌다.

---

## 환경 변수

`backend/.env`는 `local_` / `prod_` 접두사로 환경을 나눈다. 어느 쪽을 쓸지는 **`APP_ENV`** 가 정한다.

```bash
APP_ENV=prod uvicorn app.main:app     # 운영
```

> `APP_ENV`를 안 주면 호스트명으로 추측하는데, 이 추측은 EC2 기본 호스트명에서만 맞는다.
> Docker나 Cloud Run에 올리면 조용히 `local`로 떨어져서 쿠키가 `secure=False`로 나가고
> 세션이 안 잡힌다. **배포 시 반드시 명시할 것.** 기동 로그에 인식된 env가 찍히니 확인하면 된다.

| 키 | 설명 |
|----|------|
| `{env}_mysql_*`, `{env}_redis_*` | DB / Redis 접속 정보 |
| `{env}_cors_origins` | CORS 허용 오리진 (쉼표 구분) |
| `{env}_cookie_domain` | 쿠키 도메인. 비우면 host-only. 서브도메인 공유 시 `.example.com` |
| `jwt_secret`, `hash_key` | 토큰 서명 / 해시 |
| `{kakao,google}_client_*`, `{env}_*_redirect_uri` | OAuth |
| `openai_api_key` | GPT 연동 (선택) |

프론트는 `frontend/.env`(개발) / `frontend/.env.production`(빌드). `VITE_APP_PUBLIC_BASE_URL`이 백엔드 주소다.

---

## 새 프로젝트로 가져갈 때

| 위치 | 할 일 |
|------|-------|
| `backend/.env`, `frontend/.env*` | **키 전부 교체.** 특히 `jwt_secret`·`hash_key`는 프로젝트마다 새로 만들 것 |
| `prod_cors_origins`, `prod_cookie_domain` | 실제 도메인으로 채우기 |
| `frontend/.env.production` | `VITE_APP_PUBLIC_BASE_URL`이 비어 있음 |
| `backend/.gitignore` | `alembic/versions/*.py` 제외 줄을 **삭제** — 안 지우면 마이그레이션이 커밋되지 않는다 |
| `frontend/src/container/admin/layout.tsx` | `adminMenu` 샘플 메뉴 |
| `docker-compose.yml` | DB 이름·비밀번호 |
| `PROJECT.md` / `PROGRESS.md` | 새로 작성 (템플릿에는 없다) |

관리자 계정은 아직 생성 수단이 없다. `tb_admins`에 argon2 해시를 직접 넣거나
`auth_service.hash_password()`로 만들어서 INSERT할 것.
