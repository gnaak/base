# edge = "cloudflare" (기본)

원문: `infra/README.md` 1-②(네임서버 · 토큰) · 2절, `infra/cloudflare.tf`.

## 무엇이 만들어지나

| 것 | 어디서 | 메모 |
| --- | --- | --- |
| A 레코드 (프록시 켬) | `cloudflare.tf` | 서버 IP 가 숨고, 보안그룹은 CF IP 만 받는다 |
| Origin 인증서 (15년) | `cloudflare.tf` → SSM `/<project>/tls/{cert,key}` | `deploy.sh` 가 배포마다 `/etc/ssl/app/` 에 깐다. CF 만 신뢰하는 인증서 |
| SSL = Full (strict) | `cloudflare_zone_setting.ssl` | 앞단↔서버도 검증된 TLS. Flexible(그 구간 평문)은 안 쓴다 |
| Always Use HTTPS | `cloudflare_zone_setting.always_use_https` | **세션이 안 잡히는 사고를 막는 줄** — 지우지 말 것 |
| 최소 TLS 1.2 | `cloudflare_zone_setting.min_tls_version` | |
| 방문자 실제 IP | `deploy.sh` | CF IP 목록을 배포마다 받아 `set_real_ip_from` + `real_ip_header CF-Connecting-IP` |

비용은 무료. DDoS 완화 · 캐시는 CF 가 한다. 서버는 한 대만 가리킨다 (여러 대가 필요하면 `aws`).

## 사람이 할 것

1. CF 대시보드 → Add a site → Free → 구매처 네임서버를 CF 것 2개로 → **Active** 가 될 때까지 기다린다
2. API 토큰(Custom): `Zone·Zone·Read` · `Zone·DNS·Edit` · `Zone·SSL and Certificates·Edit` · `Zone·Zone Settings·Edit`,
   Zone Resources = **이 도메인만** → `infra/.env` 의 `CLOUDFLARE_API_TOKEN`
3. `terraform.tfvars` 에 `edge` 를 안 적거나 `"cloudflare"`

## 자주 묻는 것

- **첫 배포 전에 526** — 정상이다. 서버는 cloud-init 의 자체 서명 인증서를 쓰고 있고, CF strict 가 그걸 거부한다.
  첫 배포가 SSM 의 Origin 인증서로 덮으면 사라진다. 배포 뒤에도 526 이면 SSM `/<project>/tls/*` 가 있는지,
  `deploy.sh` 로그에 "Origin 인증서 설치" 가 찍혔는지 본다
- **521 / 522** — CF 가 서버에 못 붙는다. nginx 가 죽었거나(`systemctl status nginx`) 보안그룹. `troubleshoot.md`
- **서브도메인으로 고객사 Zone 에 들어갈 때** — `dns_zone` 에 상위 도메인. ⚠️ strict · Always HTTPS 는 Zone 전체에 걸린다 —
  같은 Zone 의 다른 사이트에 인증서가 없으면 그쪽이 526 이 된다. apply 전에 확인받는다
- **CF IP 목록을 못 받았다** — `deploy.sh` 가 이전 `edge-realip.conf` 를 유지한다 (경고만). 계속 실패하면 서버의 바깥 통신을 본다

## aws 로 바꿀 때

`terraform.tfvars` 의 `edge = "aws"` → `tf.ps1 apply` → 재배포. 네임서버를 Route 53 으로 옮겨야 한다(`aws.md`) —
옮기는 동안 수 분 끊길 수 있다. 서버 · nginx 설정은 그대로이고, `deploy.sh` 가 real IP 설정을 VPC 대역으로 바꾼다.
