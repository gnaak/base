output "instance_id" {
  value = aws_instance.app.id
}

output "public_ip" {
  description = "Cloudflare DNS 가 가리킬 주소"
  value       = aws_eip.app.public_ip
}

output "db_host" {
  description = "비번은 SSM /<project>/backend/prod_mysql_password"
  value       = aws_db_instance.db.address
}

output "release_bucket" {
  description = "CI 가 빌드 묶음을 올리는 곳"
  value       = aws_s3_bucket.releases.id
}

output "github_variables" {
  description = "GitHub 저장소 → Settings → Secrets and variables → Actions → Variables 에 넣는다 (비밀 아님). gh CLI 가 있으면 그대로 실행"
  value       = <<-EOT
    gh variable set AWS_DEPLOY_ROLE_ARN --repo ${var.github_repo} --body "${aws_iam_role.deploy.arn}"
    gh variable set AWS_REGION          --repo ${var.github_repo} --body "${data.aws_region.current.region}"
    gh variable set APP_PROJECT         --repo ${var.github_repo} --body "${var.project}"
  EOT
}

output "ssm_connect" {
  description = "서버 접속 (AWS CLI + Session Manager 플러그인 필요. 콘솔 EC2 → 연결 → Session Manager 도 된다)"
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${data.aws_region.current.region}"
}
