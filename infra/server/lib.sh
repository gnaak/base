# deploy.sh · rollback.sh 가 같이 쓰는 것. 직접 실행하지 않는다 (source 한다).
#
# 서버 구조
#   /srv/app/releases/<시각>-<sha>/       릴리스마다 한 폴더 — backend/.venv · backend/.env 도 릴리스마다 따로
#   /srv/app/shared/backend/{logs,media}  릴리스가 바뀌어도 남는 것. 각 릴리스의 backend/ 에 링크로 걸린다
#   /srv/app/current → releases/<…>       nginx · systemd 는 이 경로만 본다. 바꿔 끼우는 게 배포이고 롤백이다
#
# .env 를 shared 에 두지 않는 이유 — 설정(RawEnv)은 모르는 키가 있으면 기동을 거부한다. 새 릴리스가 키를 더했는데
# 그 .env 로 이전 릴리스를 띄우면 롤백이 기동 실패로 끝난다. 그래서 배포할 때 만든 .env 를 그 릴리스에 같이 둔다.
#
# 경로 · 사용자는 환경변수로 덮을 수 있다 — 서버에선 기본값 그대로, infra/tests/deploy_smoke.sh 가 임시 폴더로 바꾼다.
# shellcheck shell=bash

app=${APP_DIR:-/srv/app}
user=${APP_USER:-ubuntu}
group=${APP_GROUP:-$user}
app_env_file=${APP_ENV_FILE:-/etc/app.env}
setup_done=${APP_SETUP_DONE:-/var/lib/app-setup.done}
nginx_dir=${NGINX_DIR:-/etc/nginx}
ssl_dir=${SSL_DIR:-/etc/ssl/app}
unit_file=${UNIT_FILE:-/etc/systemd/system/fastapi.service}
keep_releases=${KEEP_RELEASES:-3}

# 릴리스가 바뀌어도 남아야 하는 폴더 = 앱이 서버에서 쓰는 곳.
# CHANGE — 더 있으면 여기에 추가하고 deploy/fastapi.service 의 ReadWritePaths 에도 넣는다
shared_dirs=(backend/logs backend/media)

step() { printf '\n── %s\n' "$*"; }

# deploy/ 의 설정 파일을 이 서버 값으로 — 자리표시만 바꾼다. 설정의 본체는 deploy/ 에 있다.
#   render <파일> [루트]   루트 = 앱 코드 위치. 기본은 $app/current (예전 구조로 되돌릴 때만 $app)
# 공유 폴더(/srv/example/backend/logs 등)는 루트와 상관없이 shared 로 — nginx 의 /media alias, ReadWritePaths
render() {
  local root=${2:-$app/current} args=() d
  for d in "${shared_dirs[@]}"; do args+=(-e "s#/srv/example/$d#$app/shared/$d#g"); done
  sed "${args[@]}" \
    -e "s#/etc/letsencrypt/live/example\\.com/fullchain\\.pem#$ssl_dir/cert.pem#" \
    -e "s#/etc/letsencrypt/live/example\\.com/privkey\\.pem#$ssl_dir/key.pem#" \
    -e "s#/srv/example#$root#g" \
    -e "s#example\\.com#$DOMAIN#g" \
    -e 's/[[:space:]]*# CHANGE.*$//' \
    "$1"
}

# 지금 current 가 가리키는 릴리스 이름 (없으면 빈 값)
current_release() {
  if [ -L "$app/current" ]; then basename "$(readlink "$app/current")"; fi
}

# releases/ 의 릴리스 이름을 오래된 순으로 (이름이 시각으로 시작한다)
list_releases() {
  if [ -d "$app/releases" ]; then find "$app/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort; fi
}

# 릴리스 하나를 실제로 켠다 — 그 릴리스의 deploy/ 로 nginx · systemd 를 깔고 current 를 바꾼 뒤 재시작.
#   activate <릴리스 이름>   또는   activate legacy   (예전 구조 /srv/app 바로 아래로 — 첫 전환이 실패했을 때만)
# nginx -t 가 실패하면 nginx 설정을 되돌리고 1 — current 와 앱은 그대로다.
# `if ! activate …` 처럼 조건 안에서 부르면 set -e 가 함수 안에서 꺼지므로, 실패할 수 있는 줄은 직접 return 한다
activate() {
  local name=$1 dir root backup
  if [ "$name" = legacy ]; then
    dir=$app root=$app
  else
    dir=$app/releases/$name root=$app/current
  fi

  backup=$(mktemp -d)
  cp -a "$nginx_dir/nginx.conf" "$backup/"
  if [ -f "$nginx_dir/sites-available/app" ]; then cp -a "$nginx_dir/sites-available/app" "$backup/"; fi
  render "$dir/deploy/nginx.conf" "$root" > "$nginx_dir/nginx.conf"
  render "$dir/deploy/site.conf" "$root" > "$nginx_dir/sites-available/app"
  ln -sf "$nginx_dir/sites-available/app" "$nginx_dir/sites-enabled/app"
  if ! nginx -t; then
    cp -a "$backup/nginx.conf" "$nginx_dir/nginx.conf"
    if [ -f "$backup/app" ]; then
      cp -a "$backup/app" "$nginx_dir/sites-available/app"
    else
      rm -f "$nginx_dir/sites-enabled/app" "$nginx_dir/sites-available/app"
    fi
    rm -rf "$backup"
    echo "nginx 설정이 틀려서 되돌렸습니다 ($name 의 deploy/nginx.conf · site.conf 확인)" >&2
    return 1
  fi
  rm -rf "$backup"

  render "$dir/deploy/fastapi.service" "$root" > "$unit_file" || return 1
  systemctl daemon-reload || return 1
  systemctl enable fastapi || return 1

  if [ "$name" = legacy ]; then
    rm -f "$app/current"
  else
    # 새 링크를 만들어 이름을 바꾼다 — 바꾸는 순간에도 current 가 비는 때가 없다
    ln -sfn "releases/$name" "$app/current.tmp" || return 1
    mv -Tf "$app/current.tmp" "$app/current" || return 1
  fi
  systemctl restart fastapi || return 1
  systemctl reload nginx || return 1
}

# deploy/README.md 의 "배포 후 확인" 중 서버 안에서 되는 것. 실패하면 이유를 출력하고 1
#   health <기동 시각>   — 그 시각 이후의 기동 로그만 본다
health() {
  local since=$1 ok=""
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null http://127.0.0.1:8000/api/health; then ok=1 && break; fi
    sleep 1
  done
  [ -n "$ok" ] || { echo "✗ 앱이 30초 안에 뜨지 않았습니다" >&2; return 1; }
  echo "✓ 앱 헬스체크"

  # env=local 로 뜨면 쿠키가 secure=False 로 나가서 세션이 안 잡힌다 — 다른 무엇보다 먼저
  journalctl -u fastapi --since "$since" --no-pager | grep -q '근거: APP_ENV' || {
    echo "✗ 기동 로그에 '근거: APP_ENV' 가 없습니다 — fastapi.service 의 APP_ENV=prod 확인" >&2
    return 1
  }
  echo "✓ env=prod (근거: APP_ENV)"

  # nginx 경유 (서버 인증서는 CF Origin / 자체 서명이라 브라우저용이 아니다 → -k)
  curl -fsSk -o /dev/null --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" || {
    echo "✗ nginx 를 거친 헬스체크 실패 — deploy/site.conf 확인" >&2
    return 1
  }
  echo "✓ nginx 경유 헬스체크"
}

show_logs() {
  journalctl -u fastapi --since "$1" --no-pager | tail -n 40 >&2
}

# 최근 keep_releases 개만 남긴다. current 는 몇 번째든 지우지 않는다
prune() {
  local cur all n i
  cur=$(current_release)
  mapfile -t all < <(list_releases)
  n=${#all[@]}
  for ((i = 0; i < n - keep_releases; i++)); do
    [ "${all[i]}" = "$cur" ] && continue
    rm -rf "${app:?}/releases/${all[i]}"
    echo "정리: ${all[i]}"
  done
}
