# edge 스위치 검사 — AWS·Cloudflare 에 붙지 않고(mock) 두 방식의 plan 이 서는지,
# 리소스가 맞게 갈리는지 본다. 키가 필요 없다.
#
#   ./infra/.bin/<버전>/terraform -chdir=infra init -backend=false
#   ./infra/.bin/<버전>/terraform -chdir=infra test
#
# ⚠️ 실제 API 동작(권한·검증·요금)은 못 본다. 그건 첫 apply 가 본다.

variables {
  project        = "tst"
  aws_account_id = "123456789012"
  domain         = "example.com"
  github_repo    = "owner/repo"
}

mock_provider "aws" {
  override_during = plan

  mock_data "aws_region" {
    defaults = { region = "ap-northeast-2" }
  }
  mock_data "aws_vpc" {
    defaults = { id = "vpc-1", cidr_block = "172.31.0.0/16" }
  }
  mock_data "aws_subnet" {
    defaults = { id = "subnet-a", availability_zone = "ap-northeast-2a" }
  }
  mock_data "aws_subnets" {
    defaults = { ids = ["subnet-a", "subnet-b"] }
  }
  mock_data "aws_ami" {
    defaults = { id = "ami-1" }
  }
  mock_data "aws_route53_zone" {
    defaults = { zone_id = "Z1" }
  }
  mock_resource "aws_acm_certificate" {
    defaults = {
      arn = "arn:aws:acm:ap-northeast-2:123456789012:certificate/1"
      domain_validation_options = [{
        domain_name           = "example.com"
        resource_record_name  = "_x.example.com."
        resource_record_type  = "CNAME"
        resource_record_value = "_y.acm-validations.aws."
      }]
    }
  }
}

mock_provider "http" {
  override_during = plan
  mock_data "http" {
    defaults = {
      status_code   = 200
      response_body = "{\"result\":{\"ipv4_cidrs\":[\"173.245.48.0/20\"],\"ipv6_cidrs\":[\"2400:cb00::/32\"]}}"
    }
  }
}

mock_provider "cloudflare" {
  override_during = plan
  mock_data "cloudflare_zone" {
    defaults = { id = "zone-1" }
  }
}

mock_provider "tls" {
  override_during = plan
}

mock_provider "random" {
  override_during = plan
}

run "cloudflare" {
  command = plan

  variables {
    edge = "cloudflare"
  }

  assert {
    condition     = length(cloudflare_dns_record.app) == 1 && length(cloudflare_origin_ca_certificate.origin) == 1
    error_message = "cloudflare: DNS 레코드·Origin 인증서가 있어야 한다"
  }
  assert {
    condition     = length(aws_lb.edge) == 0 && length(aws_route53_record.app) == 0 && length(aws_acm_certificate.edge) == 0
    error_message = "cloudflare: ALB·Route 53·ACM 이 없어야 한다"
  }
  assert {
    condition     = length(aws_security_group.app.ingress) == 1 && tolist(one(aws_security_group.app.ingress).cidr_blocks) == tolist(["173.245.48.0/20"])
    error_message = "cloudflare: 서버 443 은 CF IP 만"
  }
  assert {
    condition     = aws_ssm_parameter.server["edge"].value == "cloudflare"
    error_message = "cloudflare: deploy.sh 가 읽는 edge 값"
  }
}

run "aws" {
  command = plan

  variables {
    edge = "aws"
  }

  assert {
    condition     = length(cloudflare_dns_record.app) == 0 && length(data.cloudflare_zone.site) == 0 && length(data.http.cloudflare_ips) == 0
    error_message = "aws: Cloudflare 리소스·조회가 없어야 한다"
  }
  assert {
    condition     = length(aws_lb.edge) == 1 && length(aws_route53_record.app) == 1 && length(aws_acm_certificate_validation.edge) == 1
    error_message = "aws: ALB·Route 53·ACM 이 있어야 한다"
  }
  assert {
    condition     = aws_lb_listener.http[0].default_action[0].redirect[0].status_code == "HTTP_301"
    error_message = "aws: 80 은 https 로 301 (없으면 Secure 쿠키가 안 잡힌다)"
  }
  assert {
    condition     = aws_lb_target_group.app[0].protocol == "HTTPS" && aws_lb_target_group.app[0].health_check[0].path == "/api/health"
    error_message = "aws: ALB→서버는 HTTPS 443, 헬스체크는 /api/health"
  }
  assert {
    condition     = length(aws_security_group.app.ingress) == 1 && length(coalesce(one(aws_security_group.app.ingress).cidr_blocks, [])) == 0 && length(one(aws_security_group.app.ingress).security_groups) == 1
    error_message = "aws: 서버 443 은 ALB 보안그룹에서만 (인터넷 대역 없이)"
  }
  assert {
    condition     = aws_lb.edge[0].idle_timeout == 3600
    error_message = "aws: WebSocket 이 60초에 끊기지 않게"
  }
  assert {
    condition     = aws_ssm_parameter.server["edge"].value == "aws" && aws_ssm_parameter.server["vpc_cidr"].value == "172.31.0.0/16"
    error_message = "aws: deploy.sh 가 real_ip 에 쓸 값"
  }
}
