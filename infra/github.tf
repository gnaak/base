# ── GitHub Actions 배포 권한 — 저장된 키 없이 (OIDC) ──────────────────────
# 워크플로가 돌 때마다 GitHub 이 "이 저장소의 main 에서 돈다" 는 서명된 토큰을 주고,
# AWS 가 그걸 확인해서 한 시간짜리 임시 권한을 준다. GitHub Secrets 에 AWS 키가 없다.

# 계정당 하나. 이미 있으면 create_github_oidc_provider = false 로 두고 기존 것을 쓴다
resource "aws_iam_openid_connect_provider" "github" {
  count          = var.create_github_oidc_provider ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

locals {
  github_oidc_arn = (var.create_github_oidc_provider
    ? aws_iam_openid_connect_provider.github[0].arn
  : data.aws_iam_openid_connect_provider.github[0].arn)
}

resource "aws_iam_role" "deploy" {
  name = "${var.project}-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = local.github_oidc_arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          # ⚠️ main 브랜치만. PR·다른 브랜치·포크의 워크플로는 이 역할을 못 빌린다.
          #    워크플로에 `environment:` 를 붙이면 sub 가 바뀌어서 여기에 안 맞는다
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/heads/main"
        }
      }
    }]
  })
}

# 할 수 있는 건 셋뿐: 릴리스 올리기 · 그 서버에 deploy.sh 실행 · 빌드용 공개 설정 읽기.
# backend 시크릿(/<project>/backend/*)은 못 읽는다 — 그건 서버만 읽는다
resource "aws_iam_role_policy" "deploy" {
  name = "deploy"
  role = aws_iam_role.deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.releases.arn}/releases/*"
      },
      {
        Effect = "Allow"
        Action = "ssm:SendCommand"
        Resource = [
          aws_instance.app.arn,
          "arn:aws:ssm:${data.aws_region.current.region}::document/AWS-RunShellScript",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations"]
        Resource = "*" # 이 두 API 는 리소스 단위 권한을 지원하지 않는다
      },
      {
        Effect = "Allow"
        Action = "ssm:GetParametersByPath"
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.region}:${var.aws_account_id}:parameter/${var.project}/deploy",
          "arn:aws:ssm:${data.aws_region.current.region}:${var.aws_account_id}:parameter/${var.project}/frontend",
        ]
      },
    ]
  })
}

# ── 워크플로가 읽는 값 ─────────────────────────────────────────────
# GitHub 변수에는 역할·리전·프로젝트 셋만 넣고(outputs.tf 의 github_variables), 나머지는 여기서 읽는다
resource "aws_ssm_parameter" "deploy" {
  for_each = {
    instance_id    = aws_instance.app.id
    release_bucket = aws_s3_bucket.releases.id
  }
  name  = "/${var.project}/deploy/${each.key}"
  type  = "String"
  value = each.value
}

# 프론트 빌드용 (frontend/.env.production). 번들에 박혀 브라우저에 보이는 값이라 비밀이 아니다.
# OAuth 공개 키는 콘솔에서 같은 경로에 String 으로 넣는다:
#   /<project>/frontend/VITE_APP_PUBLIC_KAKAO_REST_API_KEY · VITE_APP_PUBLIC_GOOGLE_CLIENT_ID
resource "aws_ssm_parameter" "frontend" {
  for_each = {
    VITE_APP_PUBLIC_BASE_URL            = "https://${var.domain}"
    VITE_APP_PUBLIC_KAKAO_REDIRECT_URI  = local.backend_env.prod_kakao_redirect_uri
    VITE_APP_PUBLIC_GOOGLE_REDIRECT_URI = local.backend_env.prod_google_redirect_uri
  }
  name  = "/${var.project}/frontend/${each.key}"
  type  = "String"
  value = each.value
}
