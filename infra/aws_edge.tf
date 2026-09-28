# ── edge = "aws" — Route 53 · ACM · ALB ─────────────────────────────────
# 사용자 → Route 53 → ALB(443, ACM 인증서 · 80 은 301) → EC2 nginx(443, 임시 인증서) → 앱
#
# ALB 는 서버 인증서를 검증하지 않는다 — 그래서 cloud-init 의 자체 서명 인증서로 ALB↔서버 구간도
# 암호화되고, nginx 설정(deploy/site.conf)은 CF 방식과 똑같이 쓴다.
#
# ⚠️ 전제: Route 53 에 호스팅 영역이 있고, 도메인 구매처의 네임서버가 그 영역을 가리켜야 한다
#    (Route 53 에서 산 도메인이면 이미 돼 있다). 안 돼 있으면 ACM 검증이 끝나지 않아 apply 가
#    한참 멈춰 있다가 실패한다 — infra/README.md "1회 준비"

data "aws_route53_zone" "site" {
  count        = local.use_aws ? 1 : 0
  name         = coalesce(var.dns_zone, var.domain)
  private_zone = false
}

# ── 인증서 — 무료 · 자동 갱신 ──────────────────────────────────────────
resource "aws_acm_certificate" "edge" {
  count             = local.use_aws ? 1 : 0
  domain_name       = var.domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true # 도메인을 바꿀 때 리스너가 인증서 없이 비는 순간을 없앤다
  }
}

resource "aws_route53_record" "acm_validation" {
  for_each = {
    for dvo in flatten(aws_acm_certificate.edge[*].domain_validation_options) : dvo.domain_name => dvo
  }
  zone_id         = one(data.aws_route53_zone.site[*].zone_id)
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "edge" {
  count                   = local.use_aws ? 1 : 0
  certificate_arn         = aws_acm_certificate.edge[0].arn
  validation_record_fqdns = [for r in aws_route53_record.acm_validation : r.fqdn]
}

# ── ALB ─────────────────────────────────────────────────────────
# 서브넷이 가용영역 2개 이상이어야 한다 (서버가 한 대여도). 기본 VPC 서브넷을 쓴다 (rds.tf)
resource "aws_security_group" "alb" {
  count       = local.use_aws ? 1 : 0
  name        = "${var.project}-alb"
  vpc_id      = data.aws_vpc.default.id
  description = "${var.project} alb - HTTP/HTTPS from anywhere"

  dynamic "ingress" {
    for_each = [80, 443]
    content {
      from_port        = ingress.value
      to_port          = ingress.value
      protocol         = "tcp"
      cidr_blocks      = ["0.0.0.0/0"]
      ipv6_cidr_blocks = ["::/0"]
    }
  }

  # 서버 쪽을 콕 집으면 SG 끼리 서로를 참조해 순환이 생긴다. 받는 쪽(앱 SG)이 ALB 만 허용한다
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "edge" {
  count              = local.use_aws ? 1 : 0
  name               = "${var.project}-alb"
  load_balancer_type = "application"
  subnets            = data.aws_subnets.default.ids
  security_groups    = [aws_security_group.alb[0].id]

  # WebSocket(/api/ws)이 오래 열려 있다. 기본 60초면 조용한 연결이 끊긴다 (nginx 도 3600s)
  idle_timeout = 3600
  # 잘못된 헤더(요청 밀반입에 쓰이는 것)는 버린다
  drop_invalid_header_fields = true
}

resource "aws_lb_target_group" "app" {
  count    = local.use_aws ? 1 : 0
  name     = "${var.project}-app"
  vpc_id   = data.aws_vpc.default.id
  port     = 443
  protocol = "HTTPS"

  health_check {
    protocol = "HTTPS"
    path     = "/api/health" # 레이트리밋을 안 거는 경로 (backend/CLAUDE.md)
    matcher  = "200"
  }

  # 재시작 때 진행 중 요청을 기다리는 시간 — gunicorn --graceful-timeout 30 과 맞춘다
  deregistration_delay = 30
}

resource "aws_lb_target_group_attachment" "app" {
  count            = local.use_aws ? 1 : 0
  target_group_arn = aws_lb_target_group.app[0].arn
  target_id        = aws_instance.app.id
  port             = 443
}

# http:// → https:// . 이게 없으면 Secure 쿠키가 저장되지 않아 "로그인은 200인데 세션이 안 잡힘"
resource "aws_lb_listener" "http" {
  count             = local.use_aws ? 1 : 0
  load_balancer_arn = aws_lb.edge[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      protocol    = "HTTPS"
      port        = "443"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  count             = local.use_aws ? 1 : 0
  load_balancer_arn = aws_lb.edge[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06" # TLS 1.2+
  certificate_arn   = aws_acm_certificate_validation.edge[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app[0].arn
  }
}

resource "aws_route53_record" "app" {
  count   = local.use_aws ? 1 : 0
  zone_id = data.aws_route53_zone.site[0].zone_id
  name    = var.domain
  type    = "A"

  alias {
    name                   = aws_lb.edge[0].dns_name
    zone_id                = aws_lb.edge[0].zone_id
    evaluate_target_health = true
  }
}
