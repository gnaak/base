---
name: setup
description: 템플릿을 새 프로젝트로 가져왔을 때 바꿔야 할 것들을 훑고 고친다. clone 직후 1회.
---

$ARGUMENTS

이 템플릿을 새 프로젝트로 가져왔을 때 **반드시 바꿔야 하는 것들**을 점검하고 고친다.
`$ARGUMENTS` 에 프로젝트명·도메인이 있으면 활용하고, 없으면 물어본다.

먼저 상태를 훑어서 **무엇이 아직 템플릿 기본값인지** 표로 보여주고, 항목별로 승인받아 고친다.
한 번에 다 하지 말고 ①시크릿 → ②도메인 → ③브랜딩 → ④정리 순서로 끊어서 진행한다.

---

## ① 시크릿 — 안 바꾸면 보안 사고

| 확인 | 어떻게 |
| ---- | ------ |
| `backend/.env` 존재 | 없으면 `cp backend/.env.example backend/.env` |
| `frontend/.env` 존재 | 없으면 `cp frontend/.env.example frontend/.env` |
| `jwt_secret` · `hash_key` | **비어 있거나 다른 프로젝트 값이면 반드시 새로 생성** |

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

> **왜 중요한가** — `jwt_secret` 을 그대로 두면 **다른 프로젝트에서 발급한 토큰이 이 서비스에서도
> 통과한다.** `backend/tests/test_user_router.py` 의 `test_서명이_다르면_401` 이 이걸 고정하고 있다.

`.env` 가 `.gitignore` 에 걸려 있는지도 확인한다 (`git check-ignore -v backend/.env`).

## ② 도메인 · 환경

| 파일 | 키 | 할 일 |
| ---- | -- | ---- |
| `backend/.env` | `prod_domain` | 운영 도메인. **CORS 오리진과 쿠키 도메인이 여기서 유도된다** |
| `backend/.env` | `local_mysql_db` | 프로젝트별 DB 이름 |
| `backend/.env` | `test_mysql_db` | `db_base_test` → 프로젝트명으로. local/prod 와 **절대 같으면 안 된다** |
| `backend/.env` | `access_token_minutes` · `refresh_token_hours` | 서비스 성격에 맞게 (기본 30분 / 7일) |
| `backend/.env` | `cookie_samesite` | 프론트·백엔드가 같은 사이트면 `lax` 유지 |
| `frontend/.env` | `VITE_APP_PUBLIC_BASE_URL` | 백엔드 오리진 |
| `frontend/.env.production` | 전부 | 운영 값. **비어 있으면 빌드가 빈 값으로 굳는다** |
| `docker/mysql/init.sql` | DB 이름 2개 | `.env` 와 맞출 것 |
| `deploy/nginx.conf` | `CHANGE` 표시 4곳 | 도메인·경로 |

`{env}_domain` 규칙: 스킴 없이, CORS 때문에 포트까지, 서브도메인 공유가 필요할 때만 앞에 점.

**OAuth 를 쓴다면** — Google·Kakao 콘솔에 새 redirect URI 를 등록하고
`{local,prod}_{google,kakao}_redirect_uri` 를 콘솔 값과 **정확히** 일치시킨다.
안 쓰면 키를 비워둬도 서버는 정상 기동한다.

## ③ 브랜딩 · 샘플 코드

| 위치 | 템플릿 기본값 | 할 일 |
| ---- | ------------- | ---- |
| `frontend/index.html` | `<title>BASE</title>` | 프로젝트명으로 |
| `frontend/index.html` | Apple 로그인 스크립트 | **안 쓰면 지운다** (외부 스크립트가 매 페이지 로드됨) |
| `frontend/index.html` | `google-site-verification` | **다른 프로젝트의 값이다. 지우거나 교체** |
| `frontend/index.html` | favicon `/image.png` | 교체 |
| `frontend/src/container/admin/layout.tsx` | `adminMenu` 샘플 | 실제 메뉴로 |
| `README.md` · `CLAUDE.md` | 템플릿 설명 | 프로젝트 설명으로 |

> `google-site-verification` 은 특히 챙길 것 — 남의 서치 콘솔 확인 토큰이 박혀 있으면
> 내 사이트를 내가 소유 확인하지 못한다.

## ④ 정리 · 결정

- **`backend/alembic/versions/`** — `User`·`Admin` 테이블을 그대로 쓸지 결정한다.
  새로 시작하려면 리비전을 지우고 `sh migrate.sh "init"` 으로 다시 만든다
- **`need.md`** — 템플릿 개선 기록이다. 새 프로젝트에서는 지워도 된다
- **`PROJECT.md` · `PROGRESS.md`** — 템플릿에 없다. 새로 만든다 (`CLAUDE.md` 의 Phase 양식)
- **`frontend/src/assets/`** · `public/image.png` — 샘플 이미지 교체
- **git 재시작** 여부 — `rm -rf .git && git init` 을 했는지

## ⑤ 동작 확인

승인받고 아래를 순서대로 돌려서 **실제로 뜨는지** 확인한다.

```bash
docker compose up -d && docker compose ps      # 둘 다 healthy
cd backend && sh migrate.sh "init"
cd backend && .venv/Scripts/python.exe -m pytest
cd frontend && npm install && npm run check:types && npm test
```

서버를 띄웠다면 기동 로그의 `설정: env=... | cookie(...)` 줄을 읽고 보고한다 —
여기서 `env` 가 의도와 다르면 쿠키가 통째로 어긋난다.

---

## 보고 형식

```
| 항목 | 상태 | 조치 |
|---|---|---|
| jwt_secret | ❌ 비어 있음 | 새로 생성 필요 |
| prod_domain | ❌ 비어 있음 | 운영 도메인 입력 필요 |
| index.html title | ⚠️ "BASE" | 프로젝트명으로 |
| adminMenu | ⚠️ 샘플 | 실제 메뉴로 |
```

## 하지 말 것

- **`.env` 값을 임의로 채우지 말 것.** 도메인·DB 이름은 물어본다. 시크릿만 생성해도 되는지
  확인하고 진행한다
- `.env` 를 커밋하지 말 것
- 기존 프로젝트에서 이 커맨드를 돌리지 말 것 — **clone 직후 1회용**이다.
  이미 운영 중인 값을 템플릿 기본값으로 되돌릴 수 있다
