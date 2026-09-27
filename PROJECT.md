# 인프라 자동화 — EC2 생성부터 배포까지

> 템플릿 자체를 고치는 작업이라 이 파일과 `PROGRESS.md` 를 임시로 둔다.
> 마지막 Phase 에서 내용을 `infra/README.md` · `deploy/README.md` 로 옮기고 지운다
> (루트 `CLAUDE.md`: "PROJECT.md, PROGRESS.md는 템플릿에 없다").
>
> 커밋 메시지는 `N단계:` 대신 `infra:` 접두사를 쓴다 (기존 `feat:`·`docs:` 와 맞춤).

## 구성

```
사용자 → Cloudflare(DNS·TLS) → EC2(nginx + 앱 + Redis) → RDS(MySQL)
```

| 결정 | 선택 | 이유 |
| --- | --- | --- |
| 로드밸런서 | 없음 | EC2 한 대. CF 가 앞단(TLS·DDoS·캐시)을 한다 |
| DB | RDS | Terraform 이 EC2 를 교체하면 같은 서버의 DB 는 같이 날아간다. 자동 백업·시점 복구 |
| Redis | EC2 안 | 비용 0. 단 세션 무효화 상태가 들어 있으므로 EC2 교체 시 `jwt_secret` 도 교체 |
| 네트워크 | 기본 VPC | 새로 만들 이유가 없다 |
| 접속 | SSM | 22번을 열지 않는다. 키 페어 없음 |
| terraform | `tf.ps1`/`tf.sh` 가 자동 다운로드 | 설치 불필요. `.terraform-version` 이 버전 고정 (uv 의 `.python-version` 처럼) |
| 로컬 키 | `infra/.env` | 폴더마다 자기 계정. `backend/.env`(서버로 가는 파일)와 섞지 않는다 |
| CI 키 | GitHub OIDC | 저장된 키 없음. 실행마다 임시 권한 |
| 서버 키 | IAM Role | 키 파일 없음. 권한은 SSM 에서 자기 설정 읽기뿐 |

**사람이 1회 하는 것**: AWS 액세스 키 · CF API 토큰 발급 → `infra/.env` / 도메인을 CF 에 올리기 /
OAuth 키를 SSM 에 넣기 / OAuth 콘솔에 리다이렉트 URI 등록.

## Phase 1: EC2 + RDS

**목표**: `apply` 한 번에 EC2 와 RDS 가 뜨고, EC2 에서 RDS 에 붙는다
**수행 내용**: state 버킷 bootstrap · EC2 + 보안그룹(80/443 은 CF IP 만) + EIP + IAM Role(SSM) ·
RDS(MySQL 8.4, 프라이빗, 백업 7일) · 비번 랜덤 생성 → SSM · `prevent_destroy` · `allowed_account_ids`
**완료 기준**:
- [x] `terraform validate` 통과
- [ ] `apply` 후 SSM 으로 접속된다
- [ ] EC2 에서 `nc -zv <db_host> 3306` 성공
**커밋**: `infra: EC2 · RDS · state 버킷 Terraform`

## Phase 2: 서버 세팅

**목표**: 부팅만으로 앱이 뜬다
**수행 내용**: cloud-init — nginx · uv · Node · Redis 설치, `deploy/` 배치, SSM 에서 시크릿을 받아
`backend/.env` 생성(`local_*` 은 더미 — `RawEnv` 필수값) · `jwt_secret`/`hash_key` 랜덤 생성
**완료 기준**: - [ ] 서버 안에서 `curl localhost/api/health` 200, 기동 로그 `근거: APP_ENV`
**커밋**: `infra: cloud-init 서버 세팅`

## Phase 3: Cloudflare

**목표**: 도메인으로 HTTPS 접속
**수행 내용**: DNS A 레코드(프록시) · Origin 인증서 발급·설치 → Full (strict) · Always Use HTTPS
**완료 기준**: - [ ] 도메인 헬스체크 200, `http://` 는 301
**커밋**: `infra: Cloudflare DNS·TLS`

## Phase 4: 배포 파이프라인 + 문서 정리

**목표**: 버튼 한 번으로 배포, README 만 보고 빈 계정에서 띄울 수 있다
**수행 내용**: GitHub OIDC 역할 · `workflow_dispatch` → SSM Run Command(pull · sync · build · migrate · restart) ·
`deploy/README.md` 의 확인 네 줄 자동 실행 · `infra/README.md` · `deploy/README.md` · 루트 `CLAUDE.md` 반영 ·
이 파일과 `PROGRESS.md` 삭제
**완료 기준**: - [ ] 버튼 한 번에 배포, 확인 실패 시 워크플로 실패 - [ ] 1회 준비물 → 명령 순서가 한 문서에 있다
**커밋**: `infra: GitHub Actions 배포`

> 문서는 각 Phase 에서 그 Phase 가 만든 것만큼 같이 쓴다. Phase 4 는 모으고 정리하는 것.
