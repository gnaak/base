terraform {
  # use_lockfile(S3 네이티브 잠금)이 1.10 부터다 — DynamoDB 테이블이 필요 없다
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # 버킷 이름은 backend.hcl 에 있다. `tf.ps1 bootstrap` 이 버킷과 함께 만들고,
  # `tf.ps1 init` 이 -backend-config 로 넘긴다 (backend 블록에는 변수를 못 쓴다)
  backend "s3" {}
}

provider "aws" {
  # 키·리전은 infra/.env → 환경변수로 들어온다 (tf.ps1)

  # ⚠️ 키가 다른 계정 것이면 아무것도 만들지 않고 멈춘다.
  #    다른 프로젝트의 infra/.env 를 복붙해 왔을 때 엉뚱한 계정에 서버가 뜨는 걸 막는다
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}

# 토큰은 infra/.env 의 CLOUDFLARE_API_TOKEN → 환경변수 (tf.ps1).
# edge = "aws" 면 CF 리소스가 하나도 없지만 provider 자체는 설정돼야 해서, 형식만 맞춘 자리표시를 준다
# (CF API 는 한 번도 불리지 않는다)
provider "cloudflare" {
  api_token = local.use_cf ? null : "unused-edge-is-aws-000000000000000000000"
}
