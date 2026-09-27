# ── RDS (MySQL) — EC2 에서만 붙는다 ────────────────────────────────
# 같은 EC2 에 DB 를 두지 않는 이유: Terraform 이 EC2 를 교체하면 디스크째 날아간다.
# 여기는 EC2 를 몇 번 바꿔도 남고, 자동 백업·시점 복구가 된다.

# RDS 는 서브넷이 가용영역 2개 이상이어야 한다 (한 대만 띄워도). 기본 VPC 는 AZ 마다 하나씩 있다
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

resource "aws_db_subnet_group" "db" {
  name       = "${var.project}-db"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_security_group" "db" {
  name        = "${var.project}-db"
  vpc_id      = data.aws_vpc.default.id
  description = "${var.project} db - MySQL from app server only"

  ingress {
    description     = "app server"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}

resource "aws_db_parameter_group" "db" {
  name   = "${var.project}-mysql84"
  family = "mysql8.4"

  # 앱은 now_kst() 로 시간을 넣으므로 DB 시간대에 기대지 않는다.
  # 다만 콘솔에서 NOW() 를 쳤을 때 9시간 어긋나 보이지 않게 맞춰 둔다
  parameter {
    name  = "time_zone"
    value = "Asia/Seoul"
  }

  # MySQL 8.4 기본값은 SSL 필수인데, aiomysql 은 SSL 설정 없이 붙는다 → 접속 거부.
  # EC2↔RDS 는 같은 VPC 안이라 공용 인터넷을 지나지 않는다. 앱에 RDS CA 를 붙이면 켜도 된다
  parameter {
    name  = "require_secure_transport"
    value = "0"
  }
}

# 비번은 여기서 만들어 SSM 으로 넘긴다 — 사람이 볼 일이 없다.
# RDS 가 거부하는 문자(/ @ " 공백)는 뺀다. 나머지는 settings.py 가 quote_plus 로 감싼다
resource "random_password" "db" {
  length           = 32
  override_special = "!#$%^&*()-_=+[]{}<>:?"
}

resource "aws_db_instance" "db" {
  identifier     = "${var.project}-db"
  engine         = "mysql"
  engine_version = "8.4" # 8.0 은 2026-07 표준 지원 종료
  instance_class = var.db_instance_class

  db_name  = var.db_name
  username = "app"
  password = random_password.db.result

  allocated_storage     = 20
  max_allocated_storage = 100 # 차면 알아서 늘어난다
  storage_type          = "gp3"
  storage_encrypted     = true

  db_subnet_group_name   = aws_db_subnet_group.db.name
  vpc_security_group_ids = [aws_security_group.db.id]
  parameter_group_name   = aws_db_parameter_group.db.name
  publicly_accessible    = false
  # EC2 와 같은 AZ — AZ 를 건너면 트래픽 요금이 붙고 왕복이 늘어난다
  availability_zone = data.aws_subnet.app.availability_zone

  # 백업 7일 + 시점 복구. 시간은 UTC — 새벽 3~4시(KST)
  backup_retention_period = 7
  backup_window           = "18:00-19:00"
  maintenance_window      = "sun:19:00-sun:20:00"
  copy_tags_to_snapshot   = true

  auto_minor_version_upgrade = true
  apply_immediately          = false # 크기 변경 등은 유지보수 시간에 반영된다

  # 지우려 해도 두 겹으로 막힌다 (콘솔의 삭제 방지 + Terraform). 지워져도 마지막 스냅샷은 남긴다
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-db-final"

  lifecycle {
    prevent_destroy = true
  }
}

# ── SSM — Phase 3 에서 서버가 이걸 읽어 backend/.env 를 만든다 ──────────
# 이름 끝이 곧 .env 키다: /<project>/backend/<key> → <key>=<value>
locals {
  backend_env_db = {
    prod_mysql_host = aws_db_instance.db.address
    prod_mysql_user = aws_db_instance.db.username
    prod_mysql_db   = aws_db_instance.db.db_name
  }
}

resource "aws_ssm_parameter" "backend_db" {
  for_each = local.backend_env_db
  name     = "/${var.project}/backend/${each.key}"
  type     = "String"
  value    = each.value
}

resource "aws_ssm_parameter" "backend_db_password" {
  name  = "/${var.project}/backend/prod_mysql_password"
  type  = "SecureString"
  value = random_password.db.result
}
