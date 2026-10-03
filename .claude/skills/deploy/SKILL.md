---
name: deploy
description: "이 템플릿의 배포(Terraform · EC2 · nginx · systemd · Cloudflare 또는 ALB · GitHub Actions)를 안내하고 장애를 진단한다. 첫 배포 준비, 앞단(edge) 고르기·바꾸기, CI deploy 잡 실패, 사이트가 526 · 521 · 522 · 502 · 503 · 504, 로그인은 200 인데 세션이 안 잡힘, 모두가 429, APP_ENV, 롤백, 마이그레이션 호환. '배포 어떻게 해', '배포 실패', '526 떠', '서버가 안 떠', '롤백해줘', 'deploy failed', 'how do I deploy' 요청에 사용."
---

# deploy — 이 템플릿의 배포

원문은 둘이다 — **`infra/README.md`**(자동 배포: Terraform · CI · 서버 구조 · 롤백 · 트러블슈팅)와
**`deploy/README.md`**(nginx · systemd 설정과 손으로 올리는 절차 · 자주 밟는 지뢰). 이 스킬은 **길 찾기와 진단 순서**다.
원문을 베끼지 않는다 — 복사본은 어긋난다. 답할 때는 원문의 해당 절을 열어 확인하고 그 위치를 같이 알려준다.

## 구성 한 장

```
사용자 ─▶ 앞단 (edge = cloudflare: CF 프록시 · Origin 인증서 / aws: Route 53 · ALB · ACM)
       ─▶ EC2: nginx(443) ─▶ gunicorn+uvicorn(127.0.0.1:8000, systemd fastapi) ─▶ Redis(같은 서버)
                                                                              └▶ RDS MySQL (프라이빗)
main 푸시 ─▶ CI: backend · frontend · e2e · infra ─▶ deploy: 운영 값으로 빌드 → S3 → SSM → 서버의 deploy.sh
서버: /srv/app/releases/<시각>-<sha>/ (최근 3개) · shared/backend/{logs,media} · current → 켜진 릴리스
```

| 누가 | 무엇을 |
| --- | --- |
| 사람 (프로젝트당 1회) | AWS 키 · 네임서버 · (cloudflare 면) CF 토큰 · `infra/.env` · `terraform.tfvars` · OAuth 키(Parameter Store) |
| Terraform (`./infra/tf.ps1`) | EC2 · RDS · S3 · IAM · SSM 값 · 시크릿 · 앞단 |
| cloud-init (첫 부팅 1회) | nginx · AWS CLI · uv · Redis · 임시 인증서 |
| `infra/server/deploy.sh` (배포마다) | 새 릴리스 준비 → 마이그레이션 → 인증서 · real IP → 전환 → 확인, 실패하면 이전 릴리스로 |

## 불변 원칙

1. **실제로 바꾸는 일은 사람이 요청했을 때만** — `apply` · 배포 · `rollback.sh` · Parameter Store 수정은 무엇을 할지 보여주고
   확인받은 뒤에 한다. 무인 실행(`/autopilot`) 중에는 하지 않는다 (PreToolUse 훅이 막는다)
2. **증거부터** — CI 의 실패 스텝 로그, 서버의 `journalctl -u fastapi`, `curl -sSI` 응답 코드. 추측으로 설정을 바꾸지 않는다
3. **키는 `infra/.env` 에만** — 대화나 다른 파일에 AWS 키 · CF 토큰 · 시크릿 값을 옮겨 적지 않는다
4. **DB 는 되돌리지 않는다** — 롤백을 말하기 전에 그 사이 마이그레이션이 있었는지 본다 (`references/rollback.md`)
5. **원문이 진실** — 이 스킬과 원문이 다르면 원문을 따르고 이 스킬을 고친다

## 무엇을 물었나 → 읽을 것

| 상황 | 읽을 것 |
| --- | --- |
| 처음 올린다 · 앞단을 고른다 · 바꾼다 | `edge` 가 `cloudflare` 면 `references/cloudflare.md`, `aws` 면 `references/aws.md` (`infra/terraform.tfvars`, 없으면 cloudflare) |
| CI deploy 잡 실패 · 사이트 에러 코드 · 세션 · 429 · 업로드 | `references/troubleshoot.md` |
| 되돌리고 싶다 · 마이그레이션이 이전 코드와 맞나 | `references/rollback.md` |

처음 올리는 순서는 `infra/README.md` 1~2절 그대로다: AWS 키 → 네임서버 → 파일 두 개 → `tf.ps1 bootstrap · init · plan · apply`
→ GitHub Variables 3개 → Parameter Store 에 OAuth 키 → main 푸시. 각 단계에서 사람이 할 일과 기다릴 것(네임서버 반영)을 짚어 준다.

## 함정 — 여기서 제일 많이 틀린다

| 함정 | 결과 | 어디 |
| --- | --- | --- |
| `fastapi.service` 에 `APP_ENV=prod` 가 없다 | 호스트명 추측 → `env=local` → 쿠키 `secure=False` → **세션이 안 잡힌다** | 기동 로그 `설정: env=… (근거: …)` |
| HTTP→HTTPS 리다이렉트가 없다 | 평문 방문자에게 `Secure` 쿠키가 안 저장된다 — 로그인은 200 인데 세션 없음 | CF Always Use HTTPS · ALB 80 리스너 |
| 앞단 뒤에서 real IP 를 안 푼다 | 전 사용자가 앞단 IP 몇 개로 묶여 **서로 429** | `deploy.sh` 의 `edge-realip.conf` |
| `edge=aws` 에서 `edge-realip.conf` 의 `CF-Connecting-IP` 덮어쓰기를 지운다 | ALB 는 사용자가 보낸 헤더를 그대로 넘긴다 → 위조로 레이트리밋 우회 | 루트 `CLAUDE.md` 배포 절 |
| Parameter Store 이름 오타 | `RawEnv` 가 모르는 키 → `Extra inputs are not permitted` 로 기동 거부 | `/<project>/backend/*` |
| systemd 파일에 줄 끝 주석 · CRLF | `User=ubuntu  # …` · `User=ubuntu\r` 가 사용자 이름이 돼 기동 실패 | `deploy/*` 는 `.gitattributes` 로 LF |
| `location /auth` 로 적는다 | 실제 경로는 `/api/auth/**` — 로그인 한도가 조용히 안 걸린다 | `deploy/site.conf` |
| `client_max_body_size` < `MAX_UPLOAD_BYTES` | 업로드가 nginx 413 HTML 로 끝난다 | `site.conf` · `upload.py` |
| `--workers` 를 올린다 | 파일 로그 로테이션이 충돌한다 | `fastapi.service` 주석 |
| `cloud-init.sh` 를 고친다 | 떠 있는 서버엔 안 먹는다 (첫 부팅 1회) — 배포마다 바뀔 일은 `deploy.sh` | `infra/README.md` 5절 |
| EC2 를 교체한다 | 막혀 있다. 정말 바꾸면 `jwt_secret` 이 같이 바뀌어 전원 재로그인 | `main.tf` |
| 마이그레이션이 든 커밋을 `git revert` | 리비전 파일이 사라져 다음 배포의 `alembic upgrade` 가 멈춘다 → forward-fix | `backend/CLAUDE.md` |
| CF 서브도메인으로 들어간 고객사 Zone | `ssl=strict` · Always HTTPS 는 Zone 전체 — 같은 Zone 의 다른 사이트가 526 | `cloudflare.tf` 주석 |

## 진단 보고 형식

```
증상: (사용자가 본 것 — 응답 코드 · CI 스텝 · 화면)
근거: (로그 줄 · curl 결과 · 콘솔 상태 — 실제로 본 것)
원인: (한 줄)
고칠 곳: 파일:줄 / 콘솔 위치 / Parameter Store 이름
확인: (고친 뒤 무엇으로 확인하나 — deploy/README.md "배포 후 확인" 네 줄 중 해당하는 것)
```

근거가 없으면 원인을 단정하지 말고, 근거를 얻을 명령을 먼저 준다.
