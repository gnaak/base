# ── 릴리스 버킷 — CI 가 빌드한 묶음을 올리고, 서버가 받아 간다 ───────────
# 서버는 git 을 모른다. GitHub 열쇠도, Node 도 없다 — 테스트를 통과한 빌드가 그대로 온다.
resource "aws_s3_bucket" "releases" {
  bucket = "${var.project}-releases-${var.aws_account_id}"
}

resource "aws_s3_bucket_public_access_block" "releases" {
  bucket                  = aws_s3_bucket.releases.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "releases" {
  bucket = aws_s3_bucket.releases.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# 옛 릴리스는 60일 뒤 지운다. 롤백은 그 안의 것으로 한다
resource "aws_s3_bucket_lifecycle_configuration" "releases" {
  bucket = aws_s3_bucket.releases.id
  rule {
    id     = "expire-old-releases"
    status = "Enabled"
    filter {}
    expiration {
      days = 60
    }
  }
}

# ── 서버 시크릿 — 사람이 볼 일이 없다 ─────────────────────────────────
resource "random_password" "jwt_secret" {
  length  = 64
  special = false

  # ⚠️ EC2 가 교체되면 같이 바뀐다. Redis(로그아웃·비번변경으로 끊은 세션 목록)가
  #    새 서버에서 비어 있으므로, 옛 토큰을 전부 무효로 만들어야 끊긴 세션이 안 살아난다.
  #    대가는 전원 재로그인 한 번 (backend/CLAUDE.md "세션 무효화")
  keepers = {
    instance = aws_instance.app.id
  }
}

# jwt_secret 과 달리 고정이다 — 데이터 해싱에 쓰기 시작하면 바뀌는 순간 기존 값이 전부 안 맞는다
resource "random_password" "hash_key" {
  length  = 64
  special = false
}

resource "random_password" "redis" {
  length  = 48
  special = false # redis.conf 에 그대로 적힌다
}

# ── SSM /<project>/backend/<키> → deploy.sh 가 backend/.env 로 쓴다 ──────
# DB 접속 정보는 rds.tf. OAuth·외부 API 키는 여기 없다 — 콘솔(SSM Parameter Store)에서
# 같은 경로에 SecureString 으로 넣으면 다음 배포부터 실린다:
#   /<project>/backend/kakao_client_id · kakao_client_secret · google_client_id · google_client_secret (외부 API 키도 같은 경로에 RawEnv 필드 이름으로)
locals {
  backend_env = {
    prod_domain              = var.domain
    prod_redis_host          = "127.0.0.1"
    prod_redis_port          = "6379"
    prod_kakao_redirect_uri  = "https://${var.domain}/kakao/login"
    prod_google_redirect_uri = "https://${var.domain}/google/login"
  }
  backend_secrets = {
    jwt_secret          = random_password.jwt_secret.result
    hash_key            = random_password.hash_key.result
    prod_redis_password = random_password.redis.result
  }
}

resource "aws_ssm_parameter" "backend_env" {
  for_each = local.backend_env
  name     = "/${var.project}/backend/${each.key}"
  type     = "String"
  value    = each.value
}

resource "aws_ssm_parameter" "backend_secrets" {
  # for_each 키는 plan 에 보이므로 값(비밀)이 아니라 이름으로 돈다
  for_each = nonsensitive(toset(keys(local.backend_secrets)))
  name     = "/${var.project}/backend/${each.key}"
  type     = "SecureString"
  value    = local.backend_secrets[each.key]
}

# ── 앞단 정보 — deploy.sh 가 nginx 의 "방문자 실제 IP" 설정을 여기에 맞춰 만든다 ──
# cloud-init(/etc/app.env)이 아니라 SSM 에 두는 이유: edge 를 나중에 바꿔도 다음 배포에 반영되게
resource "aws_ssm_parameter" "server" {
  for_each = {
    edge     = var.edge
    vpc_cidr = data.aws_vpc.default.cidr_block # edge=aws 일 때 ALB 가 이 대역에서 온다
  }
  name  = "/${var.project}/server/${each.key}"
  type  = "String"
  value = each.value
}

# ── 서버 권한 — 자기 설정 읽기 + 릴리스 받기. 그 외엔 아무것도 못 한다 ──────
resource "aws_iam_role_policy" "app" {
  name = "read-own-config"
  role = aws_iam_role.app.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
        Resource = "arn:aws:ssm:${data.aws_region.current.region}:${var.aws_account_id}:parameter/${var.project}/*"
      },
      {
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.releases.arn}/*"
      },
    ]
  })
}
