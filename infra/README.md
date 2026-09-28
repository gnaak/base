# infra — EC2 생성부터 배포까지 자동으로

빈 AWS 계정에서 `apply` 한 번이면 서버·DB·도메인·HTTPS 가 다 서고,
그 뒤로는 **main 에 푸시하면 테스트 → 배포**가 알아서 돈다.

앞단(DNS·TLS)은 `terraform.tfvars` 의 **`edge` 하나로** 고른다.

```
edge = "cloudflare" (기본)
사용자 ─HTTPS─▶ Cloudflare ─HTTPS(Origin 인증서)─▶ EC2 ─ nginx ─ 앱(systemd) ─ Redis
               DNS · TLS · http→https                  │
                                                       └──▶ RDS (MySQL 8.4, 프라이빗)
edge = "aws"
사용자 ─HTTPS─▶ Route 53 → ALB(ACM 인증서) ─HTTPS─▶ EC2 ─ (위와 같음)
                          80 은 https 로 301

GitHub Actions ─ 테스트 → 빌드 → S3(릴리스) → SSM ─▶ 서버의 deploy.sh
```

| | `cloudflare` | `aws` |
|---|---|---|
| 비용 | 무료 | ALB 월 2~3만 원 + Route 53 월 $0.5 |
| 서버 IP | 숨겨진다 | ALB 뒤라 서버는 안 보이지만 ALB 는 공개 |
| DDoS · 캐시 | CF 가 해준다 | AWS 기본(Shield Standard)만 |
| 서버 여러 대 | 못 한다 (DNS 가 서버 하나를 가리킨다) | 대상 그룹에 붙이면 된다 |
| 필요한 것 | CF 계정 · API 토큰 | AWS 만 (CF 토큰 불필요) |

바꿔도 서버·DB·nginx 설정은 그대로다 — 앞단만 갈린다. 서버는 어느 쪽이든 443 하나만 연다.

| 누가 | 무엇을 |
|---|---|
| **사람 (프로젝트당 1회)** | AWS 키 · 도메인 네임서버(CF 또는 Route 53) · (cloudflare 면) CF 토큰 · 파일 2개 · OAuth 키 |
| **Terraform** | EC2 · 보안그룹 · 고정 IP · RDS · S3 · IAM · SSM 설정값 · 시크릿 생성 · 앞단(DNS · 인증서 · HTTPS 강제, ALB) |
| **cloud-init** (첫 부팅 1회) | nginx · AWS CLI · uv · Redis · 임시 인증서 |
| **GitHub Actions** (푸시마다) | 테스트 → 운영 값으로 빌드 → 릴리스 → 서버에 `deploy.sh` → 안팎 확인 |

**대략 월 $45 (6만 원 안팎)** — 서울 리전, EC2 t3.small + RDS db.t4g.micro + 고정 IP 기준, `edge = "cloudflare"`.
트래픽 제외. `aws` 면 ALB 만큼 더.

---

## 1. 1회 준비

### ① AWS — 액세스 키

1. (고객사 계정이면 받은 root 로 로그인해서) **IAM → 사용자 생성** → `AdministratorAccess` 부여
2. 그 사용자로 **액세스 키 발급**. **PC 마다 따로** 발급한다 (한 사용자에 키 2개까지) —
   PC 하나를 잃어버려도 그 키만 끄면 된다
3. 계정 ID(콘솔 우측 상단 12자리)를 적어 둔다

> 이 키가 쓰이는 곳은 **내 PC 에서 `apply` 할 때 하나뿐**이다. 서버는 IAM Role, GitHub Actions 는
> OIDC 로 권한을 받아서 키가 서버·GitHub 에 올라가지 않는다. root 는 이후로 쓰지 않는다.

### ② 도메인 — 네임서버를 앞단으로

어느 쪽이든 **도메인 구매처(가비아 등)의 네임서버를 바꾸는 것**만 사람이 한다. 자동화할 수 없는 유일한 부분이다.

**`edge = "cloudflare"`**

1. 대시보드 → **Add a site** → 도메인 입력 → Free 플랜
2. CF 가 알려주는 **네임서버 2개로 구매처의 네임서버를 바꾼다.**
   반영까지 몇 분~몇 시간. CF 대시보드에 **Active** 가 뜰 때까지 기다린다
   (CF 에서 산 도메인이면 이 단계는 없다)
3. My Profile → **API Tokens → Create Token → Custom token**
   - 권한: `Zone · Zone · Read` / `Zone · DNS · Edit` / `Zone · SSL and Certificates · Edit` / `Zone · Zone Settings · Edit`
   - Zone Resources: **Specific zone → 이 도메인만** (새도 그 도메인만 영향받게)

**`edge = "aws"`**

1. AWS 콘솔 → **Route 53 → 호스팅 영역 생성** → 도메인 입력 → 퍼블릭
2. 생긴 **NS 레코드 4개로 구매처의 네임서버를 바꾼다.** `nslookup -type=NS <도메인>` 에 AWS 네임서버가
   보일 때까지 기다린다 (Route 53 에서 산 도메인이면 1·2 가 이미 돼 있다)
3. 토큰은 필요 없다 — ①의 AWS 키로 전부 된다

> ⚠️ `aws` 는 네임서버가 넘어가기 전에 `apply` 하면 **ACM 인증서 검증이 끝나지 않아** apply 가 한참
> 멈춰 있다가 실패한다. 넘어간 걸 확인하고 돌린다.

### ③ 파일 두 개

```bash
cp infra/.env.example              infra/.env               # 키 — git 에 안 올라간다
cp infra/terraform.tfvars.example  infra/terraform.tfvars   # 설정 — 커밋한다
```

| 파일 | 내용 | 커밋 |
|---|---|---|
| `infra/.env` | `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` · `AWS_REGION` · `CLOUDFLARE_API_TOKEN`(cloudflare 만) | ❌ |
| `infra/terraform.tfvars` | `project` · `aws_account_id` · `domain` · `github_repo` · `edge`(생략하면 cloudflare) | ✅ |

> ⚠️ `infra/.env` 를 `backend/.env` 와 합치지 말 것. `backend/.env` 는 서버로 가는 파일이고,
> 이 키는 계정 전체 권한이다.

**terraform 은 설치하지 않는다.** `tf.ps1` / `tf.sh` 가 `.terraform-version` 의 버전을 처음 한 번
받아서 `infra/.bin/` 에 둔다 (uv 가 파이썬을 받아오는 것과 같다). AWS CLI 도 필요 없다.

---

## 2. 띄우기

```powershell
./infra/tf.ps1 bootstrap   # 최초 1회: state 버킷 + backend.hcl (backend.hcl 은 커밋한다)
./infra/tf.ps1 init
./infra/tf.ps1 plan        # 뭐가 만들어지는지 먼저 본다
./infra/tf.ps1 apply       # RDS 때문에 10분쯤
```

macOS·Linux·Git Bash 는 `sh infra/tf.sh …`. 실행 정책에 막히면
`powershell -ExecutionPolicy Bypass -File infra/tf.ps1 plan`.

### GitHub 연결 — 변수 3개

```powershell
./infra/tf.ps1 output -raw github_variables
```

나온 세 줄을 `gh` CLI 로 실행하거나, 저장소 **Settings → Secrets and variables → Actions → Variables**
에 손으로 넣는다 (비밀이 아니라 Variables 다). 넣기 전까지 CI 의 `deploy` 잡은 **건너뛴다** — 실패가 아니다.

### OAuth · OpenAI 키 (쓰는 것만)

**AWS 콘솔 → Systems Manager → Parameter Store** 에 이 이름으로 넣는다. 다음 배포부터 실린다.

| 이름 | 타입 | 값 |
|---|---|---|
| `/<project>/backend/kakao_client_id` · `kakao_client_secret` | SecureString | 카카오 REST API 키 · 시크릿 |
| `/<project>/backend/google_client_id` · `google_client_secret` | SecureString | 구글 OAuth |
| `/<project>/backend/openai_api_key` | SecureString | |
| `/<project>/frontend/VITE_APP_PUBLIC_KAKAO_REST_API_KEY` | String | 카카오 REST API 키 (위와 같은 값) |
| `/<project>/frontend/VITE_APP_PUBLIC_GOOGLE_CLIENT_ID` | String | 구글 클라이언트 ID (위와 같은 값) |

- 이름 끝이 `.env` 키가 된다. **`RawEnv` 에 없는 이름이면 앱이 기동을 거부한다** (오타가 조용히 무시되지 않는다)
- 같은 값을 backend/frontend 에 두 번 넣는 건 일부러다 — 배포 역할이 backend 시크릿을 못 읽게 경로를 나눴다
- OAuth 콘솔에 리다이렉트 URI 등록: `https://<domain>/kakao/login` · `https://<domain>/google/login`

나머지(DB 접속·비번, Redis 비번, `jwt_secret`, `hash_key`, 도메인, 리다이렉트 URI)는 Terraform 이 만들어 넣는다.

### 첫 배포

main 에 푸시하거나 **Actions → CI → Run workflow**. 초록불이면 끝이다.
`deploy` 잡이 `deploy/README.md` 의 "배포 후 확인" 을 전부 한다:

| 어디서 | 확인 |
|---|---|
| 서버 안 | 앱 헬스체크 · 기동 로그 `근거: APP_ENV` · nginx 경유 헬스체크 |
| 밖에서 | `https://<domain>/api/health` 200 · `http://` 가 301 |

---

## 3. 평소

| 하고 싶은 것 | 방법 |
|---|---|
| 배포 | main 에 푸시 (테스트 통과 시) |
| 재배포 | Actions → CI → Run workflow |
| 롤백 | `git revert` → 푸시 |
| 서버 접속 | 콘솔 EC2 → 연결 → **Session Manager** (22번은 닫혀 있다) |
| 앱 로그 | `sudo journalctl -u fastapi -f` · `/srv/app/backend/logs/app.log` |
| 설정값 바꾸기 | Parameter Store 수정 → 재배포 (`backend/.env` 는 배포마다 새로 만들어진다) |
| 다른 PC 에서 | clone → `infra/.env` 만 채우고 → `tf.ps1 init` (state 는 S3 에 있다) |

배포 도중 또 푸시하면 앞 배포가 끝날 때까지 기다린다 (취소하지 않는다 — 반쯤 교체된 서버가 남기 때문).

### 서버 안 구조

| 경로 | |
|---|---|
| `/srv/app` | 릴리스를 푼 것. 배포마다 `rsync --delete` 로 교체 (`.venv`·`.env`·`logs`·`media` 는 보존) |
| `/etc/app.env` | `PROJECT` · `AWS_REGION` · `DOMAIN` · `RELEASE_BUCKET` (cloud-init) |
| `/etc/ssl/app/` | cloudflare: Origin 인증서 (배포마다 SSM 에서) / aws: cloud-init 의 임시 인증서 (ALB 는 검증 안 함) |
| `/etc/nginx/conf.d/edge-realip.conf` | 방문자 실제 IP — 배포마다 edge 에 맞춰 만든다 (cloudflare: CF 대역 / aws: VPC 대역 + `CF-Connecting-IP` 덮어쓰기) |
| `/var/log/app-setup.log` | 첫 부팅 로그 |

앱이 서버에 쓰는 폴더를 추가했다면(예: 기록 데이터를 쓰는 `backend/data`) `infra/server/deploy.sh` 의 `keep`
과 `deploy/fastapi.service` 의 `ReadWritePaths` 둘 다에 넣는다 — 안 넣으면 배포 때 지워진다.

---

## 4. 고객사 계정에 올릴 때

- 1-① 을 고객사 계정에서 한다. 키는 그 프로젝트 폴더의 `infra/.env` 에만. **폴더마다 자기 계정이라 섞이지 않는다**
- `aws_account_id` 에 고객사 계정 ID. 키가 다른 계정 것이면 **아무것도 만들지 않고 멈춘다** (`allowed_account_ids`)
- 그 계정에 GitHub OIDC 공급자가 이미 있으면 `create_github_oidc_provider = false`
- 고객사가 CF 를 안 쓰면 `edge = "aws"` — Route 53 호스팅 영역만 있으면 CF 계정·토큰이 필요 없다
- 도메인이 고객사 CF 에 있으면 그쪽에서 **그 Zone 만 권한이 있는 토큰**을 받는다. 서브도메인으로 들어가면
  `dns_zone` 에 상위 도메인을 적는다 — ⚠️ SSL strict·Always HTTPS 는 **Zone 전체**에 걸린다
  (`aws` 는 레코드 하나만 건드리므로 이 문제가 없다)
- root 는 받은 뒤 MFA 켜서 돌려준다. 계약이 끝나면 고객사가 IAM 사용자를 지우면 된다 —
  서버·CI 는 그 키에 기대지 않으므로 **지워도 서비스는 계속 돈다**

---

## 5. 주의

- **EC2 는 교체되지 않게 막혀 있다** (`prevent_destroy`, `ignore_changes = [ami, user_data]`, 콘솔 종료 방지).
  Redis(로그아웃·비번 변경으로 끊은 세션 목록)와 업로드 파일이 그 디스크에 있기 때문이다.
  정말 교체하면 `jwt_secret` 이 같이 바뀌어 **전원 재로그인**된다 — 끊은 세션이 살아나지 않게 하려는 것
- **`cloud-init.sh` 를 고쳐도 떠 있는 서버엔 안 먹는다** (첫 부팅 1회). 배포마다 바뀔 일은 `deploy.sh` 에 둔다
- **RDS 는 두 겹으로 지우기 어렵다** (삭제 방지 + `prevent_destroy`, 지워져도 최종 스냅샷). 백업 7일·시점 복구
- **state 에 비밀값이 평문으로 있다** (DB 비번, Origin 인증서 키). state 버킷은 비공개·암호화·버전 관리
- **MySQL 은 SSL 없이 붙는다** (VPC 내부). 그래서 백엔드에 `cryptography` 가 필수다 — 빼면 첫 접속에서 죽는다
- `terraform destroy` 는 위 보호 때문에 실패한다. 정말 내리려면 보호를 풀고(`prevent_destroy`·삭제 방지) 지운다

---

## 6. 트러블슈팅

| 증상 | 원인 |
|---|---|
| `plan` 이 `allowed_account_ids` 로 멈춤 | `infra/.env` 키가 `aws_account_id` 와 다른 계정 것 |
| `plan` 에서 CF zone 을 못 찾음 | 도메인이 CF 에 아직 Active 가 아니다 / 토큰의 Zone 범위가 다르다 |
| CI 의 `deploy` 가 계속 skip | GitHub Variables 3개를 안 넣었다 |
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | main 이 아닌 브랜치에서 돌았거나 `github_repo` 가 다르다 |
| 도메인이 **526** | CF 가 서버 인증서를 거부 — 첫 배포 전(임시 인증서)이면 정상. 배포 뒤에도면 SSM `/<project>/tls/*` 확인 |
| 도메인이 **521 / 522** | CF 가 서버에 못 붙음 — nginx 가 죽었거나 보안그룹 |
| (aws) `apply` 가 ACM 검증에서 한참 멈춤 | 네임서버가 아직 Route 53 으로 안 넘어갔다 — `nslookup -type=NS <도메인>` |
| (aws) 도메인이 **503** | 대상 그룹에 건강한 서버가 없다 — 콘솔 EC2 → 대상 그룹 → 상태. 첫 배포 전이면 정상 |
| (aws) 도메인이 **502 / 504** | ALB 가 서버 443 에 못 붙음 / 응답이 늦음 — nginx·앱 상태, `journalctl -u fastapi` |
| edge 를 바꿨다 | `apply` → 재배포. DNS 가 옮겨 가는 동안(수 분) 접속이 끊길 수 있다 |
| 배포가 `서버 준비(cloud-init)가 안 끝났습니다` | 첫 부팅 중. `/var/log/app-setup.log` |
| 배포가 `근거: APP_ENV 가 없습니다` | `deploy/fastapi.service` 의 `Environment="APP_ENV=prod"` |
| 앱이 `Extra inputs are not permitted` 로 안 뜸 | Parameter Store 의 `/<project>/backend/` 에 `RawEnv` 에 없는 이름이 있다 |
| 첫 부팅 스크립트가 `$'\r'` 로 실패 | `cloud-init.sh` 가 CRLF — `.gitattributes` 로 막혀 있지만 에디터 설정 확인 |

---

## 설계 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| 앞단 | `edge` 로 선택 (기본 cloudflare) | CF 는 무료에 DDoS·IP 숨김까지. CF 를 못 쓰는 고객사·여러 대 확장엔 aws(ALB). 서버 쪽은 같게 둬서 바꾸기 쉽게 |
| ALB→서버 | HTTPS 443 (자체 서명) | ALB 는 서버 인증서를 검증하지 않는다. nginx 설정을 edge 별로 나누지 않아도 되고 구간도 암호화된다 |
| DB | RDS | Terraform 이 EC2 를 교체하면 같은 서버의 DB 는 같이 날아간다 |
| Redis | EC2 안 | 비용 0. EC2 교체 시 `jwt_secret` 교체로 끊은 세션 부활을 막는다 |
| 코드 전달 | CI 빌드 → S3 → 서버는 교체만 | 테스트 통과한 빌드가 그대로 나간다 · 빌드가 깨져도 서버는 안 건드린다 · 서버에 Node·GitHub 키 없음 |
| Docker | 안 씀 | 한 대에선 이점이 약하다. 재현성은 `uv.lock` + Ubuntu 24.04 고정 |
| TLS | cloudflare: Full (strict) + Origin 인증서 / aws: ACM | 앞단↔서버도 암호화. CF Flexible 은 그 구간이 평문이라 안 쓴다 |
| 접속 | SSM | 22번을 열지 않는다. 키 페어 없음 |
| 네트워크 | 기본 VPC | 새로 만들 이유가 없다 |
| 키 | 로컬 `infra/.env` · 서버 IAM Role · CI OIDC | 계정 전체 권한 키는 내 PC 에만 |
