#!/bin/bash
# 릴리스 하나를 서버에 올린다. root 로 실행한다 (GitHub Actions → SSM Run Command 가 부른다).
#
#   sudo bash <릴리스>/infra/server/deploy.sh <릴리스 폴더>
#
# 릴리스 = CI 가 빌드해서 묶은 것 (backend/ · frontend/dist/ · deploy/ · infra/server/).
# 이 스크립트도 릴리스 안에 들어 있어서, 고치면 **다음 배포부터 바로** 적용된다.
# (cloud-init.sh 는 첫 부팅 1회라 고쳐도 떠 있는 서버에 안 먹는다 — 바뀔 일은 여기에 둔다)
#
# 순서: 파일 교체 → .env → uv sync → 마이그레이션 → nginx·systemd → 재시작 → 확인
# 하나라도 실패하면 거기서 멈춘다. 되돌리려면 이전 릴리스를 다시 배포한다.
set -euo pipefail

src=$(cd "$1" && pwd)
app=/srv/app
user=ubuntu
# shellcheck disable=SC1091
. /etc/app.env # PROJECT · AWS_REGION · DOMAIN · RELEASE_BUCKET (cloud-init.sh)

[ -f /var/lib/app-setup.done ] || { echo "서버 준비(cloud-init)가 안 끝났습니다. /var/log/app-setup.log 확인" >&2; exit 1; }
step() { printf '\n── %s\n' "$*"; }

# ⚠️ 아래 rsync --delete 는 src 에 없는 걸 지운다. 다운로드가 반쯤 깨진 릴리스(빈 폴더)로
#    돌면 /srv/app 이 통째로 비워진다 — 필요한 게 다 있는지 먼저 본다
for f in backend/pyproject.toml backend/uv.lock backend/migrate_server.sh frontend/dist/index.html \
  deploy/nginx.conf deploy/site.conf deploy/fastapi.service; do
  [ -f "$src/$f" ] || { echo "릴리스에 $f 가 없습니다 — 배포를 멈춥니다 (서버는 그대로)" >&2; exit 1; }
done

# ── 1. 파일 교체 ─────────────────────────────────────────────────
step "파일 교체: $src → $app"
# 릴리스에 없는 것 = 서버에서 생긴 것. 여기 적지 않으면 --delete 가 지운다.
# CHANGE — 앱이 서버에 쓰는 폴더가 더 있으면 추가 (fastapi.service 의 ReadWritePaths 와 맞출 것)
keep=(backend/.venv backend/.env backend/logs backend/media)
excludes=()
for k in "${keep[@]}"; do excludes+=("--exclude=/$k"); done
rsync -a --delete --chown="$user:$user" "${excludes[@]}" "$src/" "$app/"
for d in backend/logs backend/media; do install -d -o "$user" -g "$user" "$app/$d"; done

# ── 2. backend/.env — SSM /<project>/backend/* 에서 만든다 ─────────────
step "backend/.env 생성 (SSM /$PROJECT/backend/)"
# 파라미터 이름 끝이 곧 키다. OAuth 키는 콘솔에서 같은 경로에 넣으면 여기 실린다.
# ⚠️ RawEnv 에 없는 이름을 넣으면 pydantic 이 기동을 거부한다 (오타가 조용히 무시되지 않는다)
tmp=$(mktemp)
{
  echo "# deploy.sh 가 SSM /$PROJECT/backend/ 에서 만든 파일. 손으로 고치지 말 것 — 다음 배포에 덮인다"
  # RawEnv 는 local_* 이 필수라 없으면 기동하다 죽는다. prod 에서는 안 읽으므로 자리만 채운다
  printf '%s\n' local_mysql_user=unused local_mysql_password=unused local_mysql_host=unused \
    local_mysql_db=unused local_redis_host=unused local_redis_port=6379
  aws ssm get-parameters-by-path --region "$AWS_REGION" --path "/$PROJECT/backend/" \
    --with-decryption --query 'Parameters[].[Name,Value]' --output text |
    while IFS=$'\t' read -r name value; do
      # 작은따옴표로 감싸 # · 공백이 그대로 들어가게 한다. 그 안에서 못 쓰는 두 글자만 막는다
      case $value in *"'"* | *\\*)
        echo "SSM ${name} 값에 ' 또는 \\ 가 있습니다. 다른 값으로 바꾸세요." >&2
        exit 1
        ;;
      esac
      printf "%s='%s'\n" "${name##*/}" "$value"
    done
} > "$tmp"
install -m 600 -o "$user" -g "$user" "$tmp" "$app/backend/.env"
rm -f "$tmp"

# ── 3. 의존성 · 마이그레이션 ────────────────────────────────────────
cd "$app/backend"
step "uv sync"
sudo -u "$user" -H uv sync --frozen --no-dev --group prod
step "마이그레이션"
sudo -u "$user" -H env APP_ENV=prod sh migrate_server.sh

# ── 4. nginx · systemd — 저장소의 deploy/ 를 그대로 깐다 ────────────────
step "nginx · systemd 설정"
# 자리표시만 바꾼다. 설정의 본체는 deploy/ 에 있고, 프로젝트마다 거기서 고친다
render() {
  sed -e 's#/etc/letsencrypt/live/example\.com/fullchain\.pem#/etc/ssl/app/cert.pem#' \
    -e 's#/etc/letsencrypt/live/example\.com/privkey\.pem#/etc/ssl/app/key.pem#' \
    -e "s#/srv/example#$app#g" \
    -e "s#example\\.com#$DOMAIN#g" \
    -e 's/[[:space:]]*# CHANGE.*$//' \
    "$1"
}

ssm_get() {
  aws ssm get-parameter --region "$AWS_REGION" --name "/$PROJECT/$1" \
    --with-decryption --query Parameter.Value --output text 2>/dev/null
}
# 앞단 — infra/variables.tf 의 edge (cloudflare | aws). 예전 인프라엔 값이 없으므로 cloudflare
edge=$(ssm_get server/edge) || edge=cloudflare
echo "앞단: $edge"

# nginx -t 가 실패하면 옛 설정으로 되돌린다 — 그대로 두면 다음 재부팅에 nginx 가 안 뜬다
realip=/etc/nginx/conf.d/edge-realip.conf
backup=$(mktemp -d)
cp -a /etc/nginx/nginx.conf /etc/ssl/app/cert.pem /etc/ssl/app/key.pem "$backup/"
[ -f /etc/nginx/sites-available/app ] && cp -a /etc/nginx/sites-available/app "$backup/"
[ -f "$realip" ] && cp -a "$realip" "$backup/"
rm -f /etc/nginx/conf.d/cloudflare-realip.conf # 예전 이름

# ── 인증서 ──
# cloudflare: SSM 의 Origin 인증서 (cloudflare.tf). CF Full (strict) 가 이걸 검증한다
# aws:        cloud-init 의 임시 인증서 그대로 — ALB 는 서버 인증서를 검증하지 않는다 (사용자는 ACM 을 본다)
if [ "$edge" = cloudflare ]; then
  if cert=$(ssm_get tls/cert) && key=$(ssm_get tls/key) && [ -n "$cert" ] && [ -n "$key" ]; then
    printf '%s\n' "$cert" > /etc/ssl/app/cert.pem
    (umask 077 && printf '%s\n' "$key" > /etc/ssl/app/key.pem)
    echo "Origin 인증서 설치"
  else
    echo "⚠️ SSM 에 Origin 인증서가 없어 임시 인증서를 씁니다 — CF Full (strict) 에서는 526 이 납니다" >&2
  fi
fi

# ── 방문자 실제 IP ──
# 앞단 뒤에서는 $remote_addr 가 앞단(CF 서버 / ALB) IP 다. 안 풀면 nginx 레이트리밋(limit_req_zone)이
# 앞단 IP 몇 개에 **전 사용자를 묶는다**
if [ "$edge" = aws ]; then
  vpc_cidr=$(ssm_get server/vpc_cidr) || vpc_cidr=""
  [ -n "$vpc_cidr" ] || { echo "SSM /$PROJECT/server/vpc_cidr 가 없습니다 — infra 를 apply 하세요" >&2; exit 1; }
  cat > "$realip" <<EOF
# deploy.sh 가 만든다 (edge=aws). 손으로 고치지 말 것
# ALB 는 VPC 안($vpc_cidr)에서 온다. X-Forwarded-For 를 오른쪽부터 읽어 ALB 를 건너뛴 첫 IP 가 방문자다
set_real_ip_from $vpc_cidr;
real_ip_header X-Forwarded-For;
real_ip_recursive on;
# ⚠️ 앱(core/utils/rate_limit.py)은 CF-Connecting-IP 를 1순위로 믿는다. CF 는 이 헤더를 덮어쓰지만
#    ALB 는 사용자가 보낸 값을 **그대로** 넘기므로, 위조하면 레이트리밋을 피할 수 있다 → 진짜 방문자 IP 로 덮는다
proxy_set_header CF-Connecting-IP \$remote_addr;
EOF
else
  # CF 목록은 CF 가 가끔 바꾸므로 배포마다 받는다. 받기에 실패하면 이전 파일을 그대로 쓴다
  ips=$(curl -fsS --max-time 10 https://www.cloudflare.com/ips-v4 && echo && curl -fsS --max-time 10 https://www.cloudflare.com/ips-v6) || ips=""
  ips=$(printf '%s\n' "$ips" | grep -E '^[0-9a-fA-F.:]+/[0-9]+$' || true)
  if [ -n "$ips" ]; then
    {
      echo "# deploy.sh 가 만든다 (edge=cloudflare, Cloudflare IP 목록). 손으로 고치지 말 것"
      printf '%s\n' "$ips" | sed 's/.*/set_real_ip_from &;/'
      echo "real_ip_header CF-Connecting-IP;"
    } > "$realip"
  elif grep -q 'edge=cloudflare' "$realip" 2>/dev/null; then
    echo "⚠️ Cloudflare IP 목록을 못 받아 이전 real_ip 설정을 유지합니다" >&2
  else
    # aws 에서 막 바꾼 경우의 옛 설정(ALB 용)은 CF 뒤에서 틀린 IP 를 믿게 하므로 지운다
    rm -f "$realip"
    echo "⚠️ Cloudflare IP 목록을 못 받았고 쓸 만한 이전 설정도 없습니다 — 다음 배포에서 다시 시도합니다" >&2
  fi
fi

render "$src/deploy/nginx.conf" > /etc/nginx/nginx.conf
render "$src/deploy/site.conf" > /etc/nginx/sites-available/app
ln -sf /etc/nginx/sites-available/app /etc/nginx/sites-enabled/app
if ! nginx -t; then
  cp -a "$backup/nginx.conf" /etc/nginx/nginx.conf
  cp -a "$backup/cert.pem" "$backup/key.pem" /etc/ssl/app/
  if [ -f "$backup/app" ]; then cp -a "$backup/app" /etc/nginx/sites-available/app; else rm -f /etc/nginx/sites-enabled/app; fi
  if [ -f "$backup/edge-realip.conf" ]; then cp -a "$backup/edge-realip.conf" "$realip"; else rm -f "$realip"; fi
  echo "nginx 설정이 틀려서 되돌렸습니다. deploy/nginx.conf · site.conf 를 확인하세요." >&2
  exit 1
fi
rm -rf "$backup"

render "$src/deploy/fastapi.service" > /etc/systemd/system/fastapi.service
systemctl daemon-reload
systemctl enable fastapi

# ── 5. 재시작 ─────────────────────────────────────────────────────
step "재시작"
since=$(date '+%Y-%m-%d %H:%M:%S')
systemctl restart fastapi
systemctl reload nginx

# ── 6. 확인 — deploy/README.md 의 "배포 후 확인" 중 서버 안에서 되는 것 ─────────
step "확인"
fail() {
  echo "✗ $*" >&2
  journalctl -u fastapi --since "$since" --no-pager | tail -n 40 >&2
  exit 1
}

ok=""
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null http://127.0.0.1:8000/api/health && ok=1 && break
  sleep 1
done
[ -n "$ok" ] || fail "앱이 30초 안에 뜨지 않았습니다"
echo "✓ 앱 헬스체크"

# ① env=local 로 뜨면 쿠키가 secure=False 로 나가서 세션이 안 잡힌다 — 다른 무엇보다 먼저
journalctl -u fastapi --since "$since" --no-pager | grep -q '근거: APP_ENV' ||
  fail "기동 로그에 '근거: APP_ENV' 가 없습니다 — fastapi.service 의 APP_ENV=prod 확인"
echo "✓ env=prod (근거: APP_ENV)"

# ② nginx 경유 (서버 인증서는 CF Origin / 자체 서명이라 브라우저용이 아니다 → -k)
curl -fsSk -o /dev/null --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" ||
  fail "nginx 를 거친 헬스체크 실패 — deploy/site.conf 확인"
echo "✓ nginx 경유 헬스체크"

echo
echo "배포 완료: $src"
