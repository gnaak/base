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

output "ssm_connect" {
  description = "서버 접속 (AWS CLI + Session Manager 플러그인 필요. 콘솔 EC2 → 연결 → Session Manager 도 된다)"
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${data.aws_region.current.region}"
}
