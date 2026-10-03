# 증상 → 원인

원문 표: `infra/README.md` 6절(인프라 · CI) · `deploy/README.md` 3절(nginx · systemd 지뢰) · 루트 `README.md` 10절.
여기서는 **어디서 보이는 증상인지**로 나눠 순서를 정한다. 근거부터 얻고, 표에서 맞는 줄을 고른다.

## 1. CI 의 deploy 잡

먼저 **어느 스텝이 빨간지** 본다.

| 스텝 / 메시지 | 원인 | 고칠 곳 |
| --- | --- | --- |
| deploy 잡이 계속 skip | GitHub Variables 3개(`AWS_DEPLOY_ROLE_ARN` 등)가 없다 — 실패가 아니다 | `tf.ps1 output -raw github_variables` → 저장소 Variables |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | main 이 아닌 브랜치에서 돌았거나 `github_repo` 가 다르다 | `terraform.tfvars` |
| "배포 설정 읽기" 실패 (`VITE_APP_PUBLIC_BASE_URL` grep) | SSM `/<project>/frontend/*` 가 비었다 | Terraform apply 확인 |
| "서버에 배포" 실패 | 서버의 `deploy.sh` 가 실패 — **스텝 로그의 출력에서 아래 2번 표의 메시지를 찾는다** | |

## 2. `deploy.sh` 의 메시지 (CI "서버에 배포" 로그 / SSM 명령 출력)

| 메시지 | 원인 | 사이트 |
| --- | --- | --- |
| `서버 준비(cloud-init)가 안 끝났습니다` | 첫 부팅 중이거나 실패 — `/var/log/app-setup.log` | 그대로 |
| `릴리스에 … 가 없습니다` | 릴리스 묶음이 깨졌다 (CI tar 단계) | 그대로 |
| `SSM … 값에 ' 또는 \ 가 있습니다` | Parameter Store 값에 못 쓰는 글자 | 그대로 |
| `uv sync` 단계에서 멈춤 | `uv.lock` 과 `pyproject.toml` 불일치(`--frozen`) · 네트워크 | 그대로 |
| 마이그레이션 단계 실패 | 리비전 오류 · DB 접속. ⚠️ MySQL DDL 은 트랜잭션이 아니라 **일부만 적용됐을 수 있다** — `alembic current` | 그대로 (코드는 이전 것) |
| `nginx 설정이 틀려서 되돌렸습니다` | `deploy/nginx.conf` · `site.conf` 문법 — 서버에서 `nginx -t` | 그대로 |
| `앱이 30초 안에 뜨지 않았습니다` | 기동 실패 — 아래 줄의 `journalctl` 출력. DB·Redis 연결(fail-fast) · `.env` 키 | **이전 릴리스로 되돌아감** |
| `근거: APP_ENV 가 없습니다` | `fastapi.service` 의 `Environment="APP_ENV=prod"` 누락 | 되돌아감 |
| `nginx 를 거친 헬스체크 실패` | `site.conf` 의 `/api` 프록시 · `server_name` · 인증서 경로 | 되돌아감 |
| `… 로 되돌렸습니다` | 위 확인 중 하나가 실패해서 이전 릴리스로 돌아갔다 — 사이트는 산다. 원인은 그 위 줄 | 이전 릴리스 |
| `되돌리기도 실패` | 이전 릴리스도 안 뜬다 — 서버(Session Manager)에서 `journalctl -u fastapi`, `rollback.sh --list` | **죽어 있을 수 있다** |
| `첫 배포라 되돌릴 이전 릴리스가 없습니다` | 새 서버의 첫 배포 실패 | 아직 없음 |
| `Extra inputs are not permitted` (journalctl) | Parameter Store `/<project>/backend/` 에 `RawEnv` 에 없는 이름 | 되돌아감 |

## 3. 브라우저에서 보이는 응답 코드

| 코드 | edge | 원인 |
| --- | --- | --- |
| 526 | cloudflare | CF 가 서버 인증서를 거부 — 첫 배포 전이면 정상. 배포 뒤면 SSM `/<project>/tls/*` (`cloudflare.md`) |
| 521 · 522 | cloudflare | CF 가 서버에 못 붙음 — nginx 죽음 · 보안그룹 |
| 503 | aws | 대상 그룹에 건강한 서버 없음 — 첫 배포 전이면 정상 (`aws.md`) |
| 502 · 504 | aws | ALB → 서버 443 실패 · 느림 |
| 502 | 둘 다 (nginx 페이지) | nginx 는 사는데 앱(8000)이 죽음 — `systemctl status fastapi`, `journalctl -u fastapi` |
| 413 · 업로드가 HTML 로 끝남 | 둘 다 | `client_max_body_size` 가 `MAX_UPLOAD_BYTES` 보다 작다 |

## 4. 사이트는 뜨는데 동작이 이상하다

| 증상 | 원인 | 확인 |
| --- | --- | --- |
| 로그인은 200 인데 세션이 안 잡힘 | `APP_ENV` 누락(→ `env=local`) / HTTP 리다이렉트 없음 / 쿠키 도메인(`prod_domain`) 불일치 | 기동 로그 `설정: env=prod (근거: APP_ENV)` · `curl -sSI http://<도메인>` 이 301 |
| 사용자들이 서로 429 를 맞음 | real IP 를 안 풀어 앞단 IP 몇 개로 묶임 | `/etc/nginx/conf.d/edge-realip.conf` 가 있는지 |
| 로그인 한도가 안 걸림 | `location /auth` (실제는 `/api/auth`) | `deploy/site.conf` |
| 배포했는데 옛 화면 | `index.html` 캐시 — `no-store` 가 빠졌다 | `site.conf` 의 `location = /index.html` |
| WebSocket 이 5분마다 끊김 | `/api/ws` 의 `proxy_read_timeout` 이 기본값 | `site.conf` |
| CORS 차단 | `prod_domain` 에 스킴을 적었거나 포트가 다르다 | 루트 `README.md` 10절 |
| 재부팅 뒤 앱이 죽어 있음 | 유닛이 네트워크보다 먼저 떠서 DB 연결 fail-fast | `fastapi.service` 의 `After=network-online.target` |
| 업로드 · 로그가 배포마다 사라짐 | 앱이 쓰는 새 폴더를 `shared_dirs` 에 안 넣었다 | `infra/server/lib.sh` + `ReadWritePaths` |

## 5. Terraform

| 증상 | 원인 |
| --- | --- |
| `plan` 이 `allowed_account_ids` 로 멈춤 | `infra/.env` 키가 `aws_account_id` 와 다른 계정 것 |
| CF zone 을 못 찾음 | 도메인이 CF 에서 아직 Active 가 아니거나 토큰의 Zone 범위가 다르다 |
| `destroy` 실패 | 일부러 막아 둔 것(EC2 · RDS `prevent_destroy`, 삭제 방지) — `infra/README.md` 5절 |
| 첫 부팅 스크립트가 `$'\r'` | `cloud-init.sh` 가 CRLF — `.gitattributes` 가 막지만 에디터 설정 확인 |
