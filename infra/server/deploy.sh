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

# nginx -t 가 실패하면 옛 설정으로 되돌린다 — 그대로 두면 다음 재부팅에 nginx 가 안 뜬다
backup=$(mktemp -d)
cp -a /etc/nginx/nginx.conf "$backup/"
[ -f /etc/nginx/sites-available/app ] && cp -a /etc/nginx/sites-available/app "$backup/"
render "$src/deploy/nginx.conf" > /etc/nginx/nginx.conf
render "$src/deploy/site.conf" > /etc/nginx/sites-available/app
ln -sf /etc/nginx/sites-available/app /etc/nginx/sites-enabled/app
if ! nginx -t; then
  cp -a "$backup/nginx.conf" /etc/nginx/nginx.conf
  if [ -f "$backup/app" ]; then cp -a "$backup/app" /etc/nginx/sites-available/app; else rm -f /etc/nginx/sites-enabled/app; fi
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

# ② nginx 경유 (임시 인증서라 -k)
curl -fsSk -o /dev/null --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" ||
  fail "nginx 를 거친 헬스체크 실패 — deploy/site.conf 확인"
echo "✓ nginx 경유 헬스체크"

echo
echo "배포 완료: $src"
