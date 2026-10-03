# 빼기 — 파일 업로드

파일 · 이미지를 받지 않을 때. 앱 · nginx · 배포 스크립트 · 스모크 테스트가 `media` 폴더 하나로 엮여 있다 — **같이 지워야 할 짝**이 많다.
(시험 적용: pytest · ruff · 타입 · 린트 · vitest · 빌드 · 배포 스모크 16개 통과)

## 백엔드

| 파일 | 할 일 |
| --- | --- |
| `backend/app/core/utils/upload.py` | 삭제 |
| `backend/app/module/upload/` | 폴더 삭제 |
| `module/__init__.py` | upload import 와 `include_router(… "/api/upload")` — 둘 다 (이 파일은 미사용 import 검사가 꺼져 있다) |
| `main.py` | `StaticFiles` import 와 `/media` mount — **mount 를 남긴 채 `media` 폴더가 없으면 앱이 import 때 죽는다** |
| `core/config/settings.py` | `MEDIA_ROOT` |
| `core/middleware/request_id.py` | 액세스 로그에서 `/media/` 를 빼는 상수와 그 사용처 · 주석("정적 파일 대량 요청") |
| `core/utils/error_code.py` ↔ `frontend/src/types/errorCode.ts` | `FILE_*` — 양쪽 같이 |
| `tests/test_upload_router.py` | 삭제 |
| `backend/media/.keep` · `backend/.gitignore` 의 media 두 줄 · `.claudeignore` 의 media 줄 | 삭제 |
| `pyproject.toml` | `python-multipart` 는 **남긴다** — 지우면 나중에 File · Form 을 쓰는 라우트가 생기는 순간 앱이 기동 실패한다 |

## 프론트

`src/hooks/common/useAPI.ts` 주석의 FormData 업로드 예시만 (업로드 화면은 없다).

## nginx · 배포 · 인프라 — 짝을 맞춘다

| 파일 | 할 일 | 짝 |
| --- | --- | --- |
| `deploy/site.conf` | `location /media/` 블록 · 위쪽 주석의 `/media/` · `client_max_body_size` 위 주석(`upload.py` · `MAX_UPLOAD_BYTES` 를 말한다 — 다시 쓴다) | 남기면 조용히 404 |
| `deploy/fastapi.service` | `ReadWritePaths` 를 `…/backend/logs` 만 · 그 위 주석 "(로그·업로드)" | ↔ `lib.sh` — 폴더가 없는데 경로가 남으면 **systemd 가 기동을 거부** → 배포 자동 롤백 |
| `infra/server/lib.sh` | `shared_dirs=(backend/logs)` · 맨 위 주석의 `{logs,media}` · "nginx 의 /media alias" 주석 | ↔ `fastapi.service` · `main.py` mount |
| `infra/server/deploy.sh` | "로그 · 업로드" 라고 적힌 주석들 | |
| `infra/tests/deploy_smoke.sh` | media 링크 · alias · `ReadWritePaths` 를 확인하는 줄 · 픽스처 · ok 메시지("logs · media 는 shared 링크") — **안 고치면 CI infra 잡이 실패** | |
| `.github/workflows/ci.yml` | 릴리스 묶음의 `--exclude=backend/media` | |
| `infra/README.md` · `main.tf` · `variables.tf` | `{logs,media}` · 업로드 디스크 설명 | |

## 서버에 남는 것 — 사람이 정한다 (`DECISIONS.md` 🧑)

- `/srv/app/shared/backend/media` 는 지워지지 않는다. **지우더라도 이 변경 뒤 배포가 3번 지난 다음에** — 그 전의 릴리스(최근 3개)로
  되돌리면 옛 `fastapi.service` · nginx 가 그 폴더를 가리켜서, 없으면 systemd 가 기동을 거부하고 롤백이 깨진다
- 이미 업로드를 쓰던 프로젝트면 DB 에 남은 `/media/…` 주소가 이제 404 가 아니라 **첫 화면(200)** 으로 열린다 (nginx 가 SPA 로 넘긴다) — `DECISIONS.md` 🔍

## 문서 · 스킬 · 에이전트

`README.md`(API 표 · 들어 있는 것) · `CLAUDE.md`(`client_max_body_size` 줄) · `backend/CLAUDE.md`(트리 · "파일 업로드" 절 · 로깅 절의 `/media/*`) · `deploy/README.md` ·
`skills/deploy/SKILL.md`(`{logs,media}`) · `references/troubleshoot.md` · `references/rollback.md` ·
`skills/security/SKILL.md`(frontmatter description 의 "업로드" · 5단계 — 뒤 단계 번호를 당긴다) + `references/upload.md` 삭제 · `references/nginx-headers.md` · `skills/seo/SKILL.md` ·
에이전트 `plan-researcher` · `prd-writer` · `commands/setup.md`

## 남겨 두는 것

레이트리밋의 일반 설명 세 줄 — "비싼 엔드포인트" 의 예로 업로드를 든다: `rate_limit.py`(디스크·대역폭) · `backend/CLAUDE.md` 레이트리밋 표(돈·자원) · `be-api-builder.md`(돈·자원)

## 확인

```bash
git grep --untracked -n -i -E "upload|MEDIA_ROOT|/media|backend/media|logs,media|media/\*|StaticFiles|FILE_(TOO_LARGE|TYPE_NOT_ALLOWED|REQUIRED)|업로드" -- . ':!CHANGELOG.md' ':!need.md' ':!backend/uv.lock' ':!frontend/package-lock.json' ':!.claude/skills/modules' \
  | grep -v -E "upload-artifact|python-multipart|돈·자원|디스크·대역폭"
git ls-files backend/media                 # 아무것도 안 나와야 한다 (로컬에 올려 둔 파일은 git 밖 — 지울지 사람이)
wsl bash infra/tests/deploy_smoke.sh       # Windows 는 WSL (Git Bash 는 심볼릭 링크를 못 만든다)
```

그리고 루트 `CLAUDE.md` 의 검증 명령 전부.
