# ── 네트워크 — 기본 VPC 를 그대로 쓴다 ─────────────────────────────
data "aws_region" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnet" "app" {
  vpc_id            = data.aws_vpc.default.id
  availability_zone = "${data.aws_region.current.region}a"
  default_for_az    = true
}

# ── 앞단 (variables.tf 의 edge) ─────────────────────────────────────
# cloudflare → cloudflare.tf / aws → aws_edge.tf. 어느 쪽이든 서버는 443 하나만 연다
locals {
  use_cf  = var.edge == "cloudflare"
  use_aws = var.edge == "aws"
}

# Cloudflare IP — edge=cloudflare 면 443 은 CF 를 거친 요청만 받는다.
# 인증 없는 공개 API 다 (cloudflare provider 를 거치지 않는다)
data "http" "cloudflare_ips" {
  count = local.use_cf ? 1 : 0
  url   = "https://api.cloudflare.com/client/v4/ips"

  lifecycle {
    # 실패했는데 그냥 넘어가면 빈 목록으로 보안그룹이 만들어져 사이트가 조용히 막힌다
    postcondition {
      condition     = self.status_code == 200
      error_message = "Cloudflare IP 목록을 받지 못했습니다."
    }
  }
}

locals {
  cloudflare = try(jsondecode(one(data.http.cloudflare_ips[*].response_body)).result, null)
}

resource "aws_security_group" "app" {
  name   = "${var.project}-app"
  vpc_id = data.aws_vpc.default.id
  # description 은 영문만 된다 (AWS 제약). 바꾸면 SG 가 교체되므로 edge 와 무관하게 고정
  description = "${var.project} app - HTTP/HTTPS from Cloudflare only, no SSH (use SSM)"

  # 443 만. http:// 리다이렉트는 앞단(CF 설정 / ALB 80 리스너)이 한다.
  # ⚠️ 22(SSH)·8000(앱)은 열지 않는다. 접속은 SSM, 앱은 127.0.0.1 에만 바인딩된다
  #    (deploy/fastapi.service 의 --forwarded-allow-ips 주석 참고)
  dynamic "ingress" {
    for_each = local.use_cf ? [local.cloudflare] : []
    content {
      description      = "Cloudflare"
      from_port        = 443
      to_port          = 443
      protocol         = "tcp"
      cidr_blocks      = ingress.value.ipv4_cidrs
      ipv6_cidr_blocks = ingress.value.ipv6_cidrs
    }
  }

  # ALB → 서버도 HTTPS 다. ALB 는 서버 인증서를 검증하지 않아서 cloud-init 의 임시 인증서로 된다
  dynamic "ingress" {
    for_each = local.use_aws ? [one(aws_security_group.alb[*].id)] : []
    content {
      description     = "ALB"
      from_port       = 443
      to_port         = 443
      protocol        = "tcp"
      security_groups = [ingress.value]
    }
  }

  # 패키지 설치·RDS·외부 API(OAuth·OpenAI) — 나가는 건 막지 않는다
  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}

# ── IAM — 서버는 키 파일 없이 역할로 권한을 받는다 ───────────────────
resource "aws_iam_role" "app" {
  name = "${var.project}-app"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# SSM 접속 · Run Command 수신용. "자기 설정 읽기" 권한은 server.tf
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.project}-app"
  role = aws_iam_role.app.name
}

# ── EC2 ──────────────────────────────────────────────────────────
# deploy/ 의 설정 파일이 Ubuntu 기준이다 (sites-available, www-data)
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnet.app.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  # 콘솔에서 실수로 "종료"를 눌러도 막힌다
  disable_api_termination = true

  # 최초 부팅 1회: 패키지 · Redis · 임시 인증서. 앱은 deploy.sh 가 올린다
  # CRLF 를 뗀다 — 윈도우 에디터가 저장하면 붙는데, 리눅스 bash 가 그걸로 죽는다 (.gitattributes 와 이중)
  user_data = replace(templatefile("${path.module}/server/cloud-init.sh", {
    project        = var.project
    region         = data.aws_region.current.region
    domain         = var.domain
    release_bucket = aws_s3_bucket.releases.id
  }), "\r\n", "\n")

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required" # IMDSv2 만 — SSRF 로 역할 자격증명을 빼가는 경로를 막는다
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.volume_size
    encrypted   = true
  }

  tags = {
    Name = "${var.project}-app"
  }

  lifecycle {
    # ⚠️ Redis(세션 무효화 상태)와 업로드 파일이 이 디스크에 있다.
    #    Terraform 은 AMI·user_data 가 바뀌면 인스턴스를 알아서 지우고 새로 만드는데,
    #    그걸 막는다. 새 Ubuntu 이미지가 나와도 기존 서버는 그대로 둔다.
    #    정말 교체해야 하면 여기를 풀고, jwt_secret 도 같이 새로 뽑을 것 (backend/CLAUDE.md "세션 무효화")
    prevent_destroy = true
    ignore_changes  = [ami, user_data]
  }
}

# 고정 IP — Cloudflare DNS 가 이걸 가리킨다. 서버를 재시작해도 안 바뀐다
resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id

  tags = {
    Name = "${var.project}-app"
  }

  lifecycle {
    prevent_destroy = true
  }
}
