# state 버킷 — Terraform 이 돌기 전에 있어야 하는 유일한 것.
#
#   ./infra/tf.ps1 bootstrap     (프로젝트당 최초 1회)
#
# 버킷을 만들고 ../backend.hcl 을 써 준다. 이 폴더의 state 는 로컬에 남는다
# (버킷을 담을 버킷이 없으므로). 잃어버려도 괜찮다 — 버킷은 prevent_destroy 라 안 지워지고,
# 다시 돌릴 일이 없다.

terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

# ../terraform.tfvars 를 같이 읽는다 (tf.ps1 이 -var-file 로 넘긴다).
# 여기서 안 쓰는 변수는 "undeclared variable" 경고가 뜨는데 무시해도 된다
variable "project" {
  type = string
}

variable "aws_account_id" {
  type = string
}

provider "aws" {
  allowed_account_ids = [var.aws_account_id]
}

data "aws_region" "current" {}

resource "aws_s3_bucket" "state" {
  # 버킷 이름은 전 세계에서 유일해야 해서 계정 ID 를 붙인다
  bucket = "${var.project}-tfstate-${var.aws_account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

# ⚠️ state 에는 비밀값이 평문으로 들어간다 (RDS 비번, Phase 4 의 Origin 인증서 개인키).
#    공개 차단 + 암호화 + 버전 관리(잘못된 apply 에서 되돌릴 수 있게)
resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# 비밀값이 아니므로 커밋한다 — 다른 사람이 clone 해도 같은 state 를 본다
resource "local_file" "backend" {
  filename = "${path.module}/../backend.hcl"
  content  = <<-EOT
    bucket       = "${aws_s3_bucket.state.id}"
    key          = "terraform.tfstate"
    region       = "${data.aws_region.current.region}"
    encrypt      = true
    use_lockfile = true
  EOT
}
