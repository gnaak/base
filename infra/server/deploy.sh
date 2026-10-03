#!/bin/bash
# 릴리스 하나를 서버에 올린다. root 로 실행한다 (GitHub Actions → SSM Run Command 가 부른다).
#
#   sudo bash <릴리스>/infra/server/deploy.sh <릴리스 폴더>
#
# 릴리스 = CI 가 빌드해서 묶은 것 (backend/ · frontend/dist/ · deploy/ · infra/server/).
# 이 스크립트도 릴리스 안에 들어 있어서, 고치면 **다음 배포부터 바로** 적용된다.
# (cloud-init.sh 는 첫 부팅 1회라 고쳐도 떠 있는 서버에 안 먹는다 — 바뀔 일은 여기에 둔다)
#
# 서버 구조는 lib.sh 맨 위. 릴리스마다 폴더를 따로 만들고 /srv/app/current 링크만 바꿔 끼운다.
#
# 순서: 새 릴리스 준비(복사 · .env · uv sync) → 마이그레이션 → 인증서 · real IP → nginx·systemd → current 전환
#       → 재시작 → 확인
# - 전환 전에 실패하면 지금 사이트는 그대로다 (새 릴리스 폴더만 지운다)
# - 전환 뒤 확인이 실패하면 **이전 릴리스로 되돌리고** exit 1 — CI 는 빨갛게, 사이트는 살아 있게
# - **DB 는 되돌리지 않는다.** 이전 코드가 새 스키마 위에서 돌 수 있어야 한다 — 마이그레이션은 expand/contract
#   (backend/CLAUDE.md "마이그레이션 — 되돌릴 수 있게")
# 손으로 되돌리려면 rollback.sh (infra/README.md "롤백")
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$here/lib.sh"

src=$(cd "$1" && pwd)
# shellcheck disable=SC1090
. "$app_env_file" # PROJECT · AWS_REGION · DOMAIN · RELEASE_BUCKET (cloud-init.sh)

[ -f "$setup_done" ] || { echo "서버 준비(cloud-init)가 안 끝났습니다. /var/log/app-setup.log 확인" >&2; exit 1; }

# 다운로드가 반쯤 깨진 릴리스(빈 폴더)로 돌지 않게 필요한 게 다 있는지 먼저 본다
for f in backend/pyproject.toml backend/uv.lock backend/migrate_server.sh frontend/dist/index.html \
  deploy/nginx.conf deploy/site.conf deploy/fastapi.service infra/server/lib.sh infra/server/rollback.sh; do
  [ -f "$src/$f" ] || { echo "릴리스에 $f 가 없습니다 — 배포를 멈춥니다 (서버는 그대로)" >&2; exit 1; }
done

# 릴리스 이름 = 시각 + 커밋. 이름순 = 시간순이라 정리 · 롤백이 이름으로 고른다
sha=$(basename "$src")
sha=${sha#release-}
name="$(date +%Y%m%d-%H%M%S)-${sha:0:12}"
rel=$app/releases/$name
[ ! -e "$rel" ] || { echo "$rel 이 이미 있습니다" >&2; exit 1; }

# 되돌릴 곳 — 지금 current, 없고 예전 구조(/srv/app/backend)면 legacy, 둘 다 없으면 첫 배포
prev=$(current_release)
if [ -z "$prev" ] && [ -d "$app/backend" ]; then prev=legacy; fi

# 전환 전에 실패하면 만들던 릴리스를 지운다 (사이트는 그대로)
switched=""
trap '[ -n "$switched" ] || rm -rf "$rel"' EXIT

install -d -o "$user" -g "$group" "$app" "$app/releases"
for d in "${shared_dirs[@]}"; do
  # 예전 구조에서 처음 바뀌는 배포 — 로그 · 업로드를 shared 로 옮기고, 옛 자리엔 링크를 남긴다.
  # 옛 코드도 그대로 돌 수 있어야 이번 배포가 실패했을 때 예전 구조로 되돌릴 수 있다 (한 번만 돈다)
  if [ -d "$app/$d" ] && [ ! -L "$app/$d" ] && [ ! -e "$app/shared/$d" ]; then
    install -d -o "$user" -g "$group" "$(dirname "$app/shared/$d")"
    mv "$app/$d" "$app/shared/$d"
    ln -s "$app/shared/$d" "$app/$d"
    echo "보존: $d → shared/$d"
  fi
  install -d -o "$user" -g "$group" "$app/shared/$d"
done

# ── 1. 새 릴리스 준비 ─────────────────────────────────────────────
step "새 릴리스: $name (이전: ${prev:-없음})"
mkdir "$rel"
cp -a "$src/." "$rel/"
for d in "${shared_dirs[@]}"; do
  rm -rf "${rel:?}/$d"
  ln -s "$app/shared/$d" "$rel/$d"
done
chown -R "$user:$group" "$rel"

# ── 2. backend/.env — SSM /<project>/backend/* 에서 만든다 ─────────────
step "backend/.env 생성 (SSM /$PROJECT/backend/)"
# 파라미터 이름 끝이 곧 키다. OAuth 키는 콘솔에서 같은 경로에 넣으면 여기 실린다.
# ⚠️ RawEnv 에 없는 이름을 넣으면 pydantic 이 기동을 거부한다 (오타가 조용히 무시되지 않는다)
tmp=$(mktemp)
{
  echo "# deploy.sh 가 SSM /$PROJECT/backend/ 에서 만든 파일. 손으로 고치지 말 것 — 다음 배포에 새로 만든다"
  # RawEnv 는 local_* 이 필수라 없으면 기동하다 죽는다. prod 에서는 안 읽으므로 자리만 채운다
  printf '%s\n' local_mysql_user=unused local_mysql_password=unused local_mysql_host=unused \
    local_mysql_db=unused local_redis_host=unused local_redis_port=6379
  aws ssm get-parameters-by-path --region "$AWS_REGION" --path "/$PROJECT/backend/" \
    --with-decryption --query 'Parameters[].[Name,Value]' --output text |
    while IFS=$'\t' read -r key value; do
      # 작은따옴표로 감싸 # · 공백이 그대로 들어가게 한다. 그 안에서 못 쓰는 두 글자만 막는다
      case $value in *"'"* | *\\*)
        echo "SSM ${key} 값에 ' 또는 \\ 가 있습니다. 다른 값으로 바꾸세요." >&2
        exit 1
        ;;
      esac
      printf "%s='%s'\n" "${key##*/}" "$value"
    done
} > "$tmp"
install -m 600 -o "$user" -g "$group" "$tmp" "$rel/backend/.env"
rm -f "$tmp"

# ── 3. 의존성 · 마이그레이션 ────────────────────────────────────────
cd "$rel/backend"
step "uv sync"
sudo -u "$user" -H uv sync --frozen --no-dev --group prod
step "마이그레이션"
# 여기서부터 DB 가 앞으로 간다. 이 뒤에 실패해서 이전 릴리스로 돌아가도 DB 는 그대로다
sudo -u "$user" -H env APP_ENV=prod sh migrate_server.sh

# ── 4. 인증서 · 방문자 실제 IP — 서버 단위 설정 (릴리스와 무관) ─────────────
step "인증서 · real IP"
ssm_get() {
  aws ssm get-parameter --region "$AWS_REGION" --name "/$PROJECT/$1" \
    --with-decryption --query Parameter.Value --output text 2>/dev/null
}
# 앞단 — infra/variables.tf 의 edge (cloudflare | aws). 예전 인프라엔 값이 없으므로 cloudflare
edge=$(ssm_get server/edge) || edge=cloudflare
echo "앞단: $edge"

# 아래가 바꾼 것을 nginx -t 실패 때 되돌릴 수 있게 둔다
realip=$nginx_dir/conf.d/edge-realip.conf
edge_backup=$(mktemp -d)
cp -a "$ssl_dir/cert.pem" "$ssl_dir/key.pem" "$edge_backup/"
if [ -f "$realip" ]; then cp -a "$realip" "$edge_backup/"; fi
rm -f "$nginx_dir/conf.d/cloudflare-realip.conf" # 예전 이름
restore_edge() {
  cp -a "$edge_backup/cert.pem" "$edge_backup/key.pem" "$ssl_dir/"
  if [ -f "$edge_backup/edge-realip.conf" ]; then cp -a "$edge_backup/edge-realip.conf" "$realip"; else rm -f "$realip"; fi
}

# cloudflare: SSM 의 Origin 인증서 (cloudflare.tf). CF Full (strict) 가 이걸 검증한다
# aws:        cloud-init 의 임시 인증서 그대로 — ALB 는 서버 인증서를 검증하지 않는다 (사용자는 ACM 을 본다)
if [ "$edge" = cloudflare ]; then
  if cert=$(ssm_get tls/cert) && key=$(ssm_get tls/key) && [ -n "$cert" ] && [ -n "$key" ]; then
    printf '%s\n' "$cert" > "$ssl_dir/cert.pem"
    (umask 077 && printf '%s\n' "$key" > "$ssl_dir/key.pem")
    echo "Origin 인증서 설치"
  else
    echo "⚠️ SSM 에 Origin 인증서가 없어 임시 인증서를 씁니다 — CF Full (strict) 에서는 526 이 납니다" >&2
  fi
fi

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

# ── 5. 전환 · 재시작 ─────────────────────────────────────────────
step "전환: current → $name"
since=$(date '+%Y-%m-%d %H:%M:%S')
if ! activate "$name"; then
  restore_edge
  rm -rf "$edge_backup"
  exit 1 # nginx 설정이 틀렸다 — current 는 그대로, 새 릴리스는 trap 이 지운다
fi
rm -rf "$edge_backup"
switched=1

# ── 6. 확인 — 실패하면 이전 릴리스로 ────────────────────────────────
step "확인"
if ! health "$since"; then
  show_logs "$since"
  if [ -z "$prev" ]; then
    echo "✗ 첫 배포라 되돌릴 이전 릴리스가 없습니다 — 위 로그를 보고 고친 뒤 다시 배포하세요" >&2
    exit 1
  fi
  step "되돌림: current → $prev"
  since=$(date '+%Y-%m-%d %H:%M:%S')
  if activate "$prev" && health "$since"; then
    rm -rf "$rel"
    echo "✗ $name 배포 실패 — $prev 로 되돌렸습니다 (사이트는 살아 있음, DB 마이그레이션은 그대로)" >&2
  else
    show_logs "$since"
    echo "✗✗ $name 배포 실패, $prev 로 되돌리기도 실패 — 서버에 들어가 확인하세요 (infra/README.md \"롤백\")" >&2
  fi
  exit 1
fi

# 예전 구조에서 처음 바뀐 배포가 성공했다 — 옛 파일은 더 안 쓴다. 지우지 않고 한쪽으로만 치운다
if [ "$prev" = legacy ]; then
  legacy=$app/legacy-$(date +%Y%m%d-%H%M%S)
  mkdir "$legacy"
  for f in "$app"/* "$app"/.[!.]*; do
    [ -e "$f" ] || [ -L "$f" ] || continue
    case $(basename "$f") in releases | shared | current | legacy-*) continue ;; esac
    mv "$f" "$legacy/"
  done
  echo "예전 구조의 파일: $legacy — 확인 뒤 지워도 된다 (로그 · 업로드는 shared 로 옮겨졌다)"
fi

step "정리 (최근 $keep_releases 개만)"
prune

echo
echo "배포 완료: $name"
