#!/bin/bash
set -e

# MySQL 관련 변수만 로드
while IFS='=' read -r key value; do
  case "$key" in
    local_mysql_*)
      export "$key=$value"
      ;;
  esac
done < .env

mysql \
  -h "$local_mysql_host" \
  -u "$local_mysql_user" \
  -p"$local_mysql_password" \
  "$local_mysql_db" <<EOF
INSERT INTO tb_admins (id, admin_email, admin_password, created_at)
SELECT 1, '1',
       '$argon2id$v=19$m=65536,t=3,p=4$HGMMIURIaU1J6T0nJMTYuw$1dbpr6QsMQcpquaD+Ewd/AsLrtxgYBvlKMOK4R+f8Nc',
       '2025-11-03 09:12:59'
FROM DUAL
WHERE NOT EXISTS (
    SELECT 1 FROM tb_admins WHERE id = 1
);
EOF
