# edge = "aws" (Route 53 · ALB · ACM)

원문: `infra/README.md` 1-② · 6절, `infra/aws_edge.tf`.

## 언제 이걸 고르나

- 고객사가 CF 를 못 쓴다 / CF 계정 · 토큰을 받기 어렵다 — AWS 키만으로 끝난다
- 서버를 여러 대로 늘릴 계획이 있다 — 대상 그룹에 붙이면 된다 (CF A 레코드는 서버 하나만 가리킨다)
- 비용: ALB 월 2~3만 원 + Route 53 월 $0.5 (cloudflare 는 0)

## 무엇이 만들어지나

| 것 | 메모 |
| --- | --- |
| ACM 인증서 + DNS 검증 레코드 | **네임서버가 Route 53 으로 넘어가기 전에 apply 하면 검증이 안 끝나 한참 멈췄다가 실패**한다 |
| ALB 80 리스너 | 443 으로 301 — HTTP→HTTPS 리다이렉트가 여기 있다 |
| ALB 443 리스너 | `ELBSecurityPolicy-TLS13-1-2-2021-06` (TLS 1.2+) |
| 대상 그룹 → EC2:443 | 헬스체크 `/api/health` 200. ALB→서버는 HTTPS(자체 서명, ALB 는 검증 안 함) |
| Route 53 A(별칭) → ALB | |
| 방문자 실제 IP | `deploy.sh` 가 `edge-realip.conf` 에 VPC 대역 + `X-Forwarded-For` + **`CF-Connecting-IP` 덮어쓰기** |

> ⚠️ 마지막 줄을 지우지 말 것. 앱 레이트리밋은 `CF-Connecting-IP` 를 1순위로 믿는데, ALB 는 사용자가 보낸 그 헤더를
> **그대로** 넘긴다 — 덮어쓰지 않으면 헤더 위조로 한도를 피한다.

## 사람이 할 것

1. Route 53 → 호스팅 영역 생성(퍼블릭) → NS 4개로 구매처 네임서버 교체
2. `nslookup -type=NS <도메인>` 에 AWS 네임서버가 보일 때까지 기다린 **뒤에** apply
3. CF 토큰은 필요 없다 (`infra/.env` 의 `CLOUDFLARE_API_TOKEN` 비워도 된다)

## 자주 묻는 것

- **503** — 대상 그룹에 건강한 서버가 없다. 콘솔 EC2 → 대상 그룹 → 상태. 첫 배포 전이면 정상(앱이 아직 없다)
- **502 / 504** — ALB 가 서버 443 에 못 붙거나 응답이 늦다. nginx · 앱 상태, `journalctl -u fastapi`
- **apply 가 ACM 검증에서 멈춤** — 네임서버가 아직 안 넘어갔다
- **cloudflare 로 바꿀 때** — `edge = "cloudflare"` → apply(네임서버를 CF 로) → 재배포. `deploy.sh` 가 ALB 용 real IP 설정을 지우고 CF 목록으로 바꾼다
