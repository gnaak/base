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

# ── Cloudflare IP — 80/443 은 CF 를 거친 요청만 받는다 ──────────────
# 인증 없는 공개 API 라 CF 토큰 없이도 된다 (Phase 4 전에도 plan 이 돈다)
data "http" "cloudflare_ips" {
  url = "https://api.cloudflare.com/client/v4/ips"

  lifecycle {
    # 실패했는데 그냥 넘어가면 빈 목록으로 보안그룹이 만들어져 사이트가 조용히 막힌다
    postcondition {
      condition     = self.status_code == 200
      error_message = "Cloudflare IP 목록을 받지 못했습니다."
    }
  }
}

locals {
  cloudflare = jsondecode(data.http.cloudflare_ips.response_body).result
}

resource "aws_security_group" "app" {
  name   = "${var.project}-app"
  vpc_id = data.aws_vpc.default.id
  # description 은 영문만 된다 (AWS 제약)
  description = "${var.project} app - HTTP/HTTPS from Cloudflare only, no SSH (use SSM)"

  # ⚠️ 22(SSH)·8000(앱)은 열지 않는다. 접속은 SSM, 앱은 127.0.0.1 에만 바인딩된다
  #    (deploy/fastapi.service 의 --forwarded-allow-ips 주석 참고)
  dynamic "ingress" {
    for_each = [80, 443]
    content {
      description      = "Cloudflare"
      from_port        = ingress.value
      to_port          = ingress.value
      protocol         = "tcp"
      cidr_blocks      = local.cloudflare.ipv4_cidrs
      ipv6_cidr_blocks = local.cloudflare.ipv6_cidrs
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

# SSM 접속용. Phase 3 에서 "자기 설정 읽기" 권한이 여기 추가된다
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
    #    정말 교체해야 하면 여기를 풀고, jwt_secret 도 같이 새로 뽑을 것 (PROJECT.md)
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
