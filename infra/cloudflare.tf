# ── edge = "cloudflare" — DNS · TLS · HTTPS 강제 ─────────────────────────
# 사용자 → CF(HTTPS) → EC2 nginx(443, Origin 인증서) — Full (strict).
# CF↔서버 구간도 암호화되고, CF 가 서버 인증서를 검증한다 (Flexible 은 이 구간이 평문이다).
#
# ⚠️ 전제: 도메인이 CF 에 **Active** 로 올라가 있어야 한다 (대시보드에서 사이트 추가 → 네임서버 변경).
#    이건 도메인 구매처에서 해야 해서 자동화할 수 없다 — infra/README.md "1회 준비"

data "cloudflare_zone" "site" {
  count = local.use_cf ? 1 : 0
  filter = {
    name = coalesce(var.dns_zone, var.domain)
  }
}

locals {
  zone_id = one(data.cloudflare_zone.site[*].id)
}

resource "cloudflare_dns_record" "app" {
  count   = local.use_cf ? 1 : 0
  zone_id = local.zone_id
  name    = var.domain
  type    = "A"
  content = aws_eip.app.public_ip
  proxied = true # CF 를 거친다 — 서버 IP 가 숨고, 보안그룹이 CF IP 만 받는다
  ttl     = 1    # 프록시면 자동
  comment = "${var.project} (terraform)"
}

# ── Origin 인증서 — CF 만 신뢰하는 무료 인증서 (15년) ──────────────────────
# 키는 여기서 만들고 SSM 으로 넘긴다. deploy.sh 가 배포마다 /etc/ssl/app 에 깐다.
# ⚠️ 키가 state 에 평문으로 남는다 — state 버킷이 암호화·비공개인 이유 (bootstrap)
resource "tls_private_key" "origin" {
  count     = local.use_cf ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_cert_request" "origin" {
  count           = local.use_cf ? 1 : 0
  private_key_pem = tls_private_key.origin[0].private_key_pem
  subject {
    common_name = var.domain
  }
}

resource "cloudflare_origin_ca_certificate" "origin" {
  count              = local.use_cf ? 1 : 0
  csr                = tls_cert_request.origin[0].cert_request_pem
  hostnames          = [var.domain]
  request_type       = "origin-rsa"
  requested_validity = 5475
}

resource "aws_ssm_parameter" "tls_cert" {
  count = local.use_cf ? 1 : 0
  name  = "/${var.project}/tls/cert"
  type  = "SecureString"
  value = cloudflare_origin_ca_certificate.origin[0].certificate
}

resource "aws_ssm_parameter" "tls_key" {
  count = local.use_cf ? 1 : 0
  name  = "/${var.project}/tls/key"
  type  = "SecureString"
  value = tls_private_key.origin[0].private_key_pem
}

# ── Zone 설정 ────────────────────────────────────────────────────
# ⚠️ Zone 전체에 걸린다. 같은 Zone 에 다른 사이트가 있으면(서브도메인으로 들어온 고객사 Zone 등)
#    그쪽도 strict 가 된다 — 그쪽 서버에 인증서가 없으면 526 이 난다. 확인하고 apply 할 것
resource "cloudflare_zone_setting" "ssl" {
  count      = local.use_cf ? 1 : 0
  zone_id    = local.zone_id
  setting_id = "ssl"
  value      = "strict"
}

# HTTP→HTTPS 리다이렉트. **이게 없으면 평문으로 들어온 사용자에게 Secure 쿠키가 저장되지 않아
# "로그인은 200인데 세션이 안 잡힘" 이 난다** — CF 가 TLS 를 끝내므로 nginx 는 이걸 모른다
resource "cloudflare_zone_setting" "always_use_https" {
  count      = local.use_cf ? 1 : 0
  zone_id    = local.zone_id
  setting_id = "always_use_https"
  value      = "on"
}

resource "cloudflare_zone_setting" "min_tls_version" {
  count      = local.use_cf ? 1 : 0
  zone_id    = local.zone_id
  setting_id = "min_tls_version"
  value      = "1.2"
}
