#!/bin/bash
# EC2 최초 부팅 때 **한 번** 도는 서버 준비 (main.tf 가 templatefile 로 user_data 에 싣는다).
#
# 하는 것: 패키지 · AWS CLI · uv · Redis(비번·AOF) · 임시 인증서 · /srv/app
# 안 하는 것: 앱 코드 · nginx 사이트 · systemd 유닛 → 릴리스마다 바뀌므로 deploy.sh 가 매번 한다
#
# ⚠️ 이 파일을 고쳐도 **이미 떠 있는 서버에는 반영되지 않는다** (main.tf 의 ignore_changes).
#    새 서버부터 적용된다. 떠 있는 서버는 SSM 으로 들어가서 같은 명령을 손으로 친다.
# ⚠️ templatefile 을 거친다 — 셸 변수는 중괄호 없이 $VAR 로 쓴다 ($${VAR} 는 Terraform 이 먹는다)
#
# 로그: /var/log/app-setup.log   끝나면: /var/lib/app-setup.done (deploy.sh 가 이걸 확인한다)
set -euxo pipefail
exec > >(tee -a /var/log/app-setup.log) 2>&1

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx redis-server rsync unzip curl openssl

# ── AWS CLI v2 — SSM 에서 설정을 읽고 S3 에서 릴리스를 받는다 ────────────
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscli.zip
unzip -q /tmp/awscli.zip -d /tmp
/tmp/aws/install
rm -rf /tmp/aws /tmp/awscli.zip

# ── uv — 파이썬은 Ubuntu 24.04 기본 3.12 를 그대로 쓴다 (.python-version 과 같다) ──
curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh

# ── deploy.sh 가 읽는 값 ──────────────────────────────────────────
cat > /etc/app.env <<'EOF'
PROJECT=${project}
AWS_REGION=${region}
DOMAIN=${domain}
RELEASE_BUCKET=${release_bucket}
EOF

# ── Redis ──────────────────────────────────────────────────────
# ⚠️ 세션 무효화 상태(로그아웃한 토큰·비번 변경)가 여기 있다 — 날아가면 끊은 세션이 살아난다.
#    기본 RDB 스냅샷은 마지막 몇 분을 잃으므로 AOF(1초마다 기록)를 켠다.
#    bind 127.0.0.1 은 Ubuntu 기본값 그대로 (외부에서 못 붙는다)
set +x # 비번이 로그에 찍히지 않게
redis_pw=""
# 역할 권한이 인스턴스에 붙기까지 몇 초 걸린다 — 첫 부팅 직후엔 AccessDenied 가 날 수 있다
for _ in $(seq 1 30); do
  redis_pw=$(aws ssm get-parameter --region "${region}" --name "/${project}/backend/prod_redis_password" \
    --with-decryption --query Parameter.Value --output text) && break
  sleep 5
done
[ -n "$redis_pw" ] || { echo "SSM 에서 Redis 비번을 못 읽었습니다"; exit 1; }
printf '\n# ── app (cloud-init) — 뒤에 온 설정이 이긴다\nrequirepass %s\nappendonly yes\n' "$redis_pw" >> /etc/redis/redis.conf
unset redis_pw
set -x
systemctl enable redis-server
systemctl restart redis-server

# ── 임시 인증서 — nginx 443 블록이 뜨게 ────────────────────────────
# 첫 배포 때 deploy.sh 가 SSM 의 Origin 인증서(cloudflare.tf)로 같은 경로를 덮는다.
# 그 전까지는 CF Full (strict) 가 이 자체 서명 인증서를 거부하므로 526 이 난다 — 정상이다
install -d -m 755 /etc/ssl/app
openssl req -x509 -nodes -newkey rsa:2048 -days 3650 -subj "/CN=${domain}" \
  -keyout /etc/ssl/app/key.pem -out /etc/ssl/app/cert.pem
chmod 600 /etc/ssl/app/key.pem

# ── nginx — 사이트는 deploy.sh 가 깐다. 기본 페이지만 치운다 ───────────────
rm -f /etc/nginx/sites-enabled/default
systemctl enable nginx
systemctl restart nginx

install -d -o ubuntu -g ubuntu /srv/app
touch /var/lib/app-setup.done
