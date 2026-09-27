variable "project" {
  description = "리소스 이름 접두사. state 버킷 이름에도 들어간다"
  type        = string

  validation {
    # S3 버킷 규칙(소문자·숫자·하이픈, 63자) — 뒤에 `-tfstate-<계정ID>` 21자가 붙는다
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$", var.project))
    error_message = "project 는 소문자·숫자·하이픈 3~42자여야 합니다."
  }
}

variable "aws_account_id" {
  description = "이 프로젝트가 쓰는 AWS 계정. 키가 다른 계정 것이면 plan 단계에서 멈춘다"
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id 는 숫자 12자리입니다 (콘솔 우측 상단)."
  }
}

variable "domain" {
  description = "서비스 도메인 (스킴 없이). CORS·쿠키(prod_domain)·nginx server_name·OAuth 리다이렉트가 여기서 나온다"
  type        = string

  validation {
    condition     = can(regex("^([a-z0-9-]+\\.)+[a-z]{2,}$", var.domain))
    error_message = "domain 은 example.com 처럼 적습니다 (https:// · 끝의 / 없이)."
  }
}

variable "cloudflare_zone" {
  description = "Cloudflare 에 올린 도메인(Zone). domain 이 서브도메인(app.example.com)일 때만 적는다 (example.com)"
  type        = string
  default     = null
}

variable "github_repo" {
  description = "배포 권한을 줄 저장소 (owner/name). 이 저장소의 main 브랜치 워크플로만 배포할 수 있다"
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repo))
    error_message = "github_repo 는 owner/name 형식입니다 (예: gnaak/myapp)."
  }
}

variable "create_github_oidc_provider" {
  description = "GitHub OIDC 공급자는 계정당 하나다. 이 계정에 이미 있으면(다른 프로젝트가 만들었으면) false"
  type        = bool
  default     = true
}

variable "instance_type" {
  description = "앱 + nginx + Redis 가 한 대에 올라간다 (빌드는 CI 가 한다). x86 만 — AMI 가 amd64 다"
  type        = string
  default     = "t3.small"
}

variable "volume_size" {
  description = "루트 디스크(GB). 로그 14일 + 업로드(media/)가 여기 쌓인다"
  type        = number
  default     = 20
}

variable "db_instance_class" {
  description = "RDS 크기. micro(1GB)로 시작해서 부족하면 올린다 — 올릴 때 수 분 끊긴다"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "RDS 안의 데이터베이스 이름 (backend/.env 의 prod_mysql_db)"
  type        = string
  default     = "app"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{0,63}$", var.db_name))
    error_message = "db_name 은 영문으로 시작하고 영문·숫자·밑줄만 됩니다 (하이픈 불가)."
  }
}
