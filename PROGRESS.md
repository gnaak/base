# 진행 기록 — 인프라 자동화

## 1 단계: EC2 + RDS

- 상태: 🔄 진행중 — 코드 완료, `apply` 는 키 발급 후 사용자가 실행
- 완료 시각:
- 수행 내용:
  - `infra/main.tf` — EC2(Ubuntu 24.04, IMDSv2, 암호화 디스크) · 보안그룹(80/443 은 CF IP 만, 22·8000 닫음) ·
    EIP · IAM Role(SSM) · `prevent_destroy` + `ignore_changes=[ami, user_data]` · `allowed_account_ids`
  - `infra/rds.tf` — MySQL 8.4(db.t4g.micro, gp3 20→100GB 자동 확장, 암호화) · 프라이빗 · EC2 와 같은 AZ ·
    보안그룹은 앱 서버 SG 에서만 3306 · 백업 7일(새벽 3시 KST) · 삭제 방지 + `prevent_destroy` + 최종 스냅샷 ·
    파라미터 그룹 `time_zone=Asia/Seoul`, `require_secure_transport=0`
  - 비번 `random_password` → SSM SecureString. 접속 정보는 `/<project>/backend/<.env 키>` 로 저장 (Phase 2 가 그대로 .env 로 쓴다)
  - `infra/bootstrap/` — state 버킷(공개 차단·암호화·버전 관리) + `backend.hcl` 자동 생성
  - `tf.ps1` / `tf.sh` — `.terraform-version` 의 terraform 을 받아 `infra/.bin/` 에 둔다(체크섬 확인).
    설치 불필요. `infra/.env` 를 환경변수로 올린다
  - `infra/.env.example` · `terraform.tfvars.example`
  - 검증: `terraform fmt -check` · `validate` 통과(본체·bootstrap), `tf.ps1`/`tf.sh` 다운로드·에러 경로 확인
- 이슈/메모:
  - 남은 완료 기준: `bootstrap` → `init` → `apply` 후 SSM 접속, EC2 에서 `nc -zv <db_host> 3306`
    (mysql 클라이언트는 Phase 2 에서 깔린다)
  - CF IP 목록은 인증 없는 공개 API(`http` provider)로 받는다 — Phase 3 전에는 CF 토큰이 필요 없다
  - Phase 2 전까지 80/443 이 CF IP 만 받으므로 헬스체크는 서버 안에서(`curl localhost`) 한다
  - 8.4 는 기본이 SSL 필수인데 aiomysql 은 SSL 없이 붙어서 껐다. VPC 내부 트래픽이라 공용망을 안 탄다.
    켜려면 앱의 엔진 생성에 RDS CA 번들을 넘기면 된다
  - 앱은 `now_kst()` 로 시간을 넣고 DB `server_default` 가 없다 — DB 시간대와 무관

## 2 단계: 서버 세팅

- 상태: 🔄 진행중 — 코드 완료, `apply` 는 사용자가 실행
- 완료 시각:
- 수행 내용:
  - `infra/server/cloud-init.sh` — 최초 부팅 1회. nginx · AWS CLI v2 · uv · Redis(`requirepass` + AOF) ·
    임시 자체서명 인증서(`/etc/ssl/app`, Phase 4 에서 Origin 인증서로 덮는다) · `/etc/app.env`
  - `infra/server/deploy.sh` — 릴리스마다. rsync 교체(`.venv`·`.env`·`logs`·`media` 보존) · SSM → `backend/.env`
    (`local_*` 더미 포함) · `uv sync --frozen --no-dev --group prod` · 마이그레이션 · `deploy/` 치환 설치
    (`nginx -t` 실패 시 되돌림) · 재시작 · 확인 3종(헬스체크 · `근거: APP_ENV` · nginx 경유)
  - `infra/server.tf` — 릴리스 버킷(60일 만료) · `jwt_secret`(EC2 교체 시 같이 교체) · `hash_key`(고정) ·
    Redis 비번 · SSM 파라미터 · 서버 IAM(자기 설정 읽기 + 릴리스 받기만)
  - `domain` 변수 추가 → `prod_domain` · OAuth 리다이렉트 URI · nginx `server_name`
  - 버그 수정 2건:
    - `deploy/fastapi.service` — 줄 끝 `# CHANGE` 주석. systemd 는 줄 끝 주석을 지원하지 않아 `User=ubuntu  # CHANGE`
      가 사용자 이름이 되어 기동 실패. 주석을 윗줄로 옮김 (deploy.sh 도 방어적으로 떼어낸다)
    - `backend/migrate_server.sh` — `uv run --frozen` 이 default-groups(dev) 로 다시 sync 해서 운영 서버에
      pytest·ruff 가 깔렸다 → `--no-sync`
  - 검증: `fmt`·`validate` · cloud-init 템플릿 렌더링 + `bash -n` · `.env` 생성 블록을 가짜 aws 로 돌려
    실제 `RawEnv` 로 읽힘 확인(`# $ ! [] {}` 든 비번 그대로)
- 이슈/메모:
  - nginx·systemd 설정의 실제 검사(`nginx -t`·`systemd-analyze`)는 서버에서 `deploy.sh` 가 한다 (로컬 컨테이너 검사는 생략)
  - OAuth·OpenAI 키는 SSM `/<project>/backend/<키>` 에 콘솔로 넣는다 — 이름이 `RawEnv` 필드와 다르면 기동 거부
  - Docker 는 쓰지 않는다. `ci.yml` 의 이미지 빌드 작업은 Phase 3 에서 정리
