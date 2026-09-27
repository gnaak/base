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
