#!/bin/bash
# deploy.sh · rollback.sh 스모크 테스트 — 진짜 서버 없이 임시 폴더에서 돈다. CI infra 잡이 돌린다.
#
#   bash infra/tests/deploy_smoke.sh                         (Linux)
#   wsl bash infra/tests/deploy_smoke.sh                     (Windows — Git Bash 는 심볼릭 링크를 못 만든다)
#
# 서버 명령(aws · systemctl · nginx · journalctl · curl · sudo · uv · sleep)은 PATH 앞에 둔 가짜로 바꾸고,
# 경로(/srv/app · /etc/…)는 lib.sh 의 환경변수로 임시 폴더를 가리킨다. 설정은 deploy/ 의 진짜 파일을 렌더링한다.
# 가짜 앱은 릴리스에 BROKEN 파일이 있으면 헬스체크에 실패한다.
set -euo pipefail

repo=$(cd "$(dirname "$0")/../.." && pwd)
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
real_sleep=$(command -v sleep)

export APP_ENV_FILE=$T/etc/app.env APP_SETUP_DONE=$T/setup.done NGINX_DIR=$T/etc/nginx SSL_DIR=$T/etc/ssl/app \
  UNIT_FILE=$T/etc/fastapi.service APP_USER APP_GROUP CALLS=$T/calls.log
APP_USER=$(id -un)
APP_GROUP=$(id -gn)

mkdir -p "$T/bin" "$NGINX_DIR/sites-available" "$NGINX_DIR/sites-enabled" "$NGINX_DIR/conf.d" "$SSL_DIR"
cat > "$APP_ENV_FILE" <<'EOF'
PROJECT=smoke
AWS_REGION=ap-northeast-2
DOMAIN=smoke.test
RELEASE_BUCKET=bucket
EOF
touch "$APP_SETUP_DONE"

# ── 가짜 서버 명령 ─────────────────────────────────────────────
shim() { printf '#!/bin/bash\n%s\n' "$2" > "$T/bin/$1" && chmod +x "$T/bin/$1"; }
shim systemctl 'echo "systemctl $*" >> "$CALLS"'
shim journalctl 'echo "설정: env=prod (근거: APP_ENV)"'
shim sleep 'exit 0'
shim sudo 'while [ $# -gt 0 ]; do case $1 in -u) shift 2 ;; -H) shift ;; *) break ;; esac; done; exec "$@"'
# nginx -t: 사이트 설정에 BROKEN_NGINX 가 있으면 문법 오류
shim nginx '[ "${1:-}" = -t ] || exit 0; ! grep -q BROKEN_NGINX "$NGINX_DIR/sites-available/app"'
shim uv 'case $1 in
  sync) mkdir -p .venv/bin && touch .venv/bin/gunicorn && echo "uv sync $PWD" >> "$CALLS" ;;
  run) [ ! -e FAIL_MIGRATION ] || { echo "가짜 마이그레이션 실패" >&2; exit 1; }; echo "migrate $PWD" >> "$CALLS" ;;
esac'
shim aws 'case "$*" in
  *get-parameters-by-path*) printf "/smoke/backend/jwt_secret\tsmoke-secret\n/smoke/backend/prod_domain\tsmoke.test\n" ;;
  *server/edge*) echo cloudflare ;;
  *tls/cert*) echo NEW-CERT ;;
  *tls/key*) echo NEW-KEY ;;
  *) exit 255 ;;
esac'
# 헬스체크: 지금 켜진 코드(current, 없으면 예전 구조 /srv/app)에 BROKEN 이 있으면 실패
shim curl 'case "$*" in
  *ips-v4*) echo 173.245.48.0/20 ;;
  *ips-v6*) echo 2400:cb00::/32 ;;
  *api/health*) if [ -L "$APP_DIR/current" ]; then [ ! -e "$APP_DIR/current/backend/BROKEN" ]; else [ ! -e "$APP_DIR/backend/BROKEN" ]; fi ;;
  *) exit 1 ;;
esac'
export PATH="$T/bin:$PATH"

# ── 도우미 ──────────────────────────────────────────────────────
passed=0
ok() { passed=$((passed + 1)) && echo "  ✓ $*"; }
die() {
  echo "  ✗ $*" >&2
  echo "── 마지막 실행 로그" >&2 && cat "$T/last.log" >&2
  exit 1
}
use_server() { # 서버 하나 = APP_DIR 하나
  export APP_DIR=$T/$1/srv/app
  mkdir -p "$APP_DIR"
  echo "# 기본" > "$NGINX_DIR/nginx.conf"
  rm -f "$NGINX_DIR/sites-available/app" "$NGINX_DIR/sites-enabled/app" "$NGINX_DIR/conf.d/edge-realip.conf"
  echo OLD-CERT > "$SSL_DIR/cert.pem" && echo OLD-KEY > "$SSL_DIR/key.pem"
}
make_release() { # make_release <sha> [BROKEN|BROKEN_NGINX|FAIL_MIGRATION|MISSING] → 폴더 경로
  local d=$T/src/release-$1
  rm -rf "$d" && mkdir -p "$d/backend" "$d/frontend/dist" "$d/infra/server"
  cp -r "$repo/deploy" "$d/deploy"
  cp "$repo/infra/server/deploy.sh" "$repo/infra/server/lib.sh" "$repo/infra/server/rollback.sh" "$d/infra/server/"
  cp "$repo/backend/migrate_server.sh" "$d/backend/"
  echo "[project]" > "$d/backend/pyproject.toml" && echo "lock" > "$d/backend/uv.lock"
  echo "<html>$1</html>" > "$d/frontend/dist/index.html"
  case ${2:-} in
    BROKEN) touch "$d/backend/BROKEN" ;;
    BROKEN_NGINX) echo "# BROKEN_NGINX" >> "$d/deploy/site.conf" ;;
    FAIL_MIGRATION) touch "$d/backend/FAIL_MIGRATION" ;;
    MISSING) rm "$d/frontend/dist/index.html" ;;
  esac
  echo "$d"
}
deploy() { # deploy <sha> [플래그] — deploy.sh 의 종료 코드를 그대로
  local d
  d=$(make_release "$@")
  "$real_sleep" 1 # 릴리스 이름이 초 단위 시각이라 같은 초에 두 번 배포하지 않게
  bash "$d/infra/server/deploy.sh" "$d" > "$T/last.log" 2>&1
}
rollback() { bash "$APP_DIR/current/infra/server/rollback.sh" "$@" > "$T/last.log" 2>&1; }
current() { basename "$(readlink "$APP_DIR/current")"; }
count() { find "$APP_DIR/releases" -mindepth 1 -maxdepth 1 -type d | wc -l; }

# ── 새 서버 ─────────────────────────────────────────────────────
echo "새 서버"
use_server fresh

deploy aaaaaaaaaaaa0001 || die "첫 배포가 실패했다"
first=$(current)
[[ $first == *-aaaaaaaaaaaa ]] || die "current 가 첫 릴리스가 아니다: $first"
ok "첫 배포 → current = $first"

rel=$APP_DIR/releases/$first
[ "$(readlink "$rel/backend/logs")" = "$APP_DIR/shared/backend/logs" ] || die "logs 가 shared 를 가리키지 않는다"
[ "$(readlink "$rel/backend/media")" = "$APP_DIR/shared/backend/media" ] || die "media 가 shared 를 가리키지 않는다"
grep -qx "jwt_secret='smoke-secret'" "$rel/backend/.env" || die ".env 에 SSM 값이 없다"
[ -f "$rel/backend/.venv/bin/gunicorn" ] || die "릴리스 안에 .venv 가 없다"
ok "릴리스 안에 .env · .venv, logs · media 는 shared 링크"

grep -qx "WorkingDirectory=$APP_DIR/current/backend" "$UNIT_FILE" || die "유닛 WorkingDirectory"
grep -qx "ReadWritePaths=$APP_DIR/shared/backend/logs $APP_DIR/shared/backend/media" "$UNIT_FILE" || die "유닛 ReadWritePaths"
grep -q "root $APP_DIR/current/frontend/dist;" "$NGINX_DIR/sites-available/app" || die "nginx root"
grep -q "alias $APP_DIR/shared/backend/media/;" "$NGINX_DIR/sites-available/app" || die "nginx /media alias"
! grep -q "/srv/example\|example\.com\|# CHANGE" "$NGINX_DIR/sites-available/app" "$UNIT_FILE" || die "자리표시가 남았다"
ok "설정: 코드는 current, 공유 폴더는 shared (자리표시 남김 없음)"

grep -qx NEW-CERT "$SSL_DIR/cert.pem" || die "Origin 인증서"
grep -q "set_real_ip_from 173.245.48.0/20;" "$NGINX_DIR/conf.d/edge-realip.conf" || die "real IP"
grep -q "systemctl restart fastapi" "$CALLS" || die "재시작 안 함"
ok "인증서 · real IP · 재시작"

deploy bbbbbbbbbbbb0002 || die "두 번째 배포가 실패했다"
second=$(current)
[[ $second == *-bbbbbbbbbbbb ]] && [ -d "$APP_DIR/releases/$first" ] || die "두 번째 배포 뒤 상태"
ok "두 번째 배포 → current = $second, 이전 릴리스는 남는다"

echo "실패하는 배포"
if deploy cccccccccccc0003 BROKEN; then die "확인에 실패한 배포가 성공으로 끝났다"; fi
[ "$(current)" = "$second" ] || die "확인 실패 뒤 current 가 이전 릴리스가 아니다: $(current)"
! ls "$APP_DIR/releases" | grep -q cccccccccccc || die "실패한 릴리스가 남았다"
grep -q "로 되돌렸습니다" "$T/last.log" || die "되돌렸다는 말이 없다"
ok "확인 실패 → 이전 릴리스로 되돌리고 exit 1"

if deploy dddddddddddd0004 BROKEN_NGINX; then die "nginx 설정이 틀린 배포가 성공으로 끝났다"; fi
[ "$(current)" = "$second" ] || die "nginx 실패 뒤 current 가 바뀌었다"
! grep -q BROKEN_NGINX "$NGINX_DIR/sites-available/app" || die "틀린 nginx 설정이 남았다"
! ls "$APP_DIR/releases" | grep -q dddddddddddd || die "실패한 릴리스가 남았다"
ok "nginx -t 실패 → 설정 되돌림, current 그대로"

if deploy eeeeeeeeeeee0005 FAIL_MIGRATION; then die "마이그레이션이 실패한 배포가 성공으로 끝났다"; fi
[ "$(current)" = "$second" ] || die "마이그레이션 실패 뒤 current 가 바뀌었다"
! ls "$APP_DIR/releases" | grep -q eeeeeeeeeeee || die "실패한 릴리스가 남았다"
ok "마이그레이션 실패 → 전환 전에 멈춤, current 그대로"

before=$(count)
if deploy ffffffffffff0006 MISSING; then die "파일이 빠진 릴리스가 배포됐다"; fi
[ "$(count)" = "$before" ] && [ "$(current)" = "$second" ] || die "빠진 릴리스가 서버를 건드렸다"
ok "필수 파일이 빠진 릴리스 → 아무것도 안 건드림"

echo "정리 · 롤백"
for sha in 111111111111 222222222222 333333333333; do deploy "${sha}0007" || die "배포 $sha"; done
[ "$(count)" = 3 ] && [[ $(current) == *-333333333333 ]] || die "릴리스가 3개가 아니다: $(ls "$APP_DIR/releases")"
ok "릴리스는 최근 3개만 (current 포함)"

rollback || die "롤백이 실패했다"
[[ $(current) == *-222222222222 ]] || die "바로 전 릴리스로 안 갔다: $(current)"
ok "rollback.sh → 바로 전 릴리스"

rollback --list || die "--list"
grep -q "222222222222  ← current" "$T/last.log" || die "--list 에 current 표시가 없다"
oldest=$(find "$APP_DIR/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | head -n 1)
rollback "$oldest" || die "골라서 롤백"
[ "$(current)" = "$oldest" ] || die "고른 릴리스로 안 갔다"
if rollback 99999999-nope; then die "없는 릴리스로 롤백이 됐다"; fi
if rollback "$oldest"; then die "current 로 롤백이 됐다"; fi
if rollback; then die "더 이전이 없는데 롤백이 됐다"; fi
ok "rollback.sh <릴리스> · 없는 것 · current · 더 이전 없음"

# ── 예전 구조(/srv/app 에 바로 풀던 것)에서 처음 바뀌는 서버 ──────────────
make_legacy() {
  mkdir -p "$APP_DIR/backend/logs" "$APP_DIR/backend/media/2026" "$APP_DIR/backend/.venv/bin" "$APP_DIR/frontend/dist"
  echo "old log" > "$APP_DIR/backend/logs/app.log"
  echo "png" > "$APP_DIR/backend/media/2026/up.png"
  echo "jwt_secret='old'" > "$APP_DIR/backend/.env"
  cp -r "$repo/deploy" "$APP_DIR/deploy"
}

echo "예전 구조 → 첫 전환이 실패"
use_server legacy-fail
make_legacy
if deploy 444444444444aaaa BROKEN; then die "확인에 실패한 첫 전환이 성공으로 끝났다"; fi
[ ! -e "$APP_DIR/current" ] || die "예전 구조로 되돌렸는데 current 가 남았다"
grep -qx "WorkingDirectory=$APP_DIR/backend" "$UNIT_FILE" || die "유닛이 예전 경로로 안 돌아갔다"
[ "$(cat "$APP_DIR/backend/logs/app.log")" = "old log" ] && [ -f "$APP_DIR/backend/media/2026/up.png" ] || die "예전 경로로 로그 · 업로드가 안 보인다"
[ -f "$APP_DIR/backend/.env" ] && ! ls "$APP_DIR" | grep -q '^legacy-' || die "예전 파일이 치워졌다"
ok "예전 구조로 되돌림 — 옛 코드 · .env 그대로, 로그 · 업로드는 shared 링크로 보인다"

deploy 555555555555aaaa || die "다시 한 첫 전환이 실패했다"
[[ $(current) == *-555555555555 ]] || die "current"
ok "같은 서버에서 다시 → 전환 (이미 옮긴 shared 는 그대로 쓴다)"

echo "예전 구조 → 첫 전환이 성공"
use_server legacy-ok
make_legacy
deploy 666666666666aaaa || die "첫 전환이 실패했다"
[[ $(current) == *-666666666666 ]] || die "current"
[ "$(cat "$APP_DIR/shared/backend/logs/app.log")" = "old log" ] || die "로그가 안 옮겨졌다"
[ -f "$APP_DIR/shared/backend/media/2026/up.png" ] || die "업로드가 안 옮겨졌다"
[ "$(cat "$APP_DIR/current/backend/media/2026/up.png")" = "png" ] || die "새 릴리스에서 업로드가 안 보인다"
legacy=$(find "$APP_DIR" -mindepth 1 -maxdepth 1 -name 'legacy-*' | head -n 1)
[ -n "$legacy" ] && [ -f "$legacy/backend/.env" ] && [ ! -e "$APP_DIR/backend" ] || die "예전 파일이 legacy-* 로 안 치워졌다"
ok "로그 · 업로드 보존(shared), 예전 파일은 legacy-* 로 (지우지 않음)"

deploy 777777777777aaaa || die "전환 뒤 배포"
[ "$(cat "$APP_DIR/shared/backend/logs/app.log")" = "old log" ] || die "두 번째 배포가 로그를 건드렸다"
ok "전환 뒤 배포는 평소대로 (한 번만 돈다)"

echo
echo "deploy_smoke: $passed 통과"
