#!/bin/bash
# 이전 릴리스로 되돌린다 — S3 에서 다시 받지 않고, 서버에 남아 있는 릴리스(최근 3개)로 current 만 바꾼다.
# 사람이 부른다 (배포가 확인에 실패했을 때의 자동 되돌림은 deploy.sh 가 한다). SSM 으로 부르는 법은 infra/README.md "롤백".
#
#   sudo bash /srv/app/current/infra/server/rollback.sh             # 바로 전 릴리스로
#   sudo bash /srv/app/current/infra/server/rollback.sh <릴리스>     # 골라서 (ls /srv/app/releases)
#   sudo bash /srv/app/current/infra/server/rollback.sh --list       # 남아 있는 릴리스만 보기
#
# ⚠️ DB 는 되돌리지 않는다. 그 사이 마이그레이션이 있었다면 이전 코드가 새 스키마 위에서 돈다 —
#    그래서 마이그레이션은 이전 코드와 같이 돌 수 있게(expand/contract) 만든다 (backend/CLAUDE.md)
# ⚠️ .env 는 그 릴리스를 배포할 때 만든 것 그대로다 — 그 뒤 Parameter Store 에서 바꾼 값(비번 교체 등)은 안 따라온다.
#    그런 변경이 있었다면 롤백 대신 이전 커밋을 다시 배포한다 (Actions → Run workflow 또는 git revert)
# ⚠️ 다음 main 푸시가 다시 최신을 배포한다 — 롤백은 고칠 때까지 버티는 용도다
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=lib.sh
. "$here/lib.sh"
# shellcheck disable=SC1090
. "$app_env_file" # DOMAIN — 헬스체크가 nginx 를 거칠 때 쓴다

cur=$(current_release)

if [ "${1:-}" = --list ]; then
  list_releases | while read -r r; do
    if [ "$r" = "$cur" ]; then echo "$r  ← current"; else echo "$r"; fi
  done
  exit 0
fi

[ -n "$cur" ] || { echo "current 가 없습니다 — 아직 릴리스 구조로 배포된 적이 없습니다" >&2; exit 1; }

if [ $# -ge 1 ]; then
  target=$1
else
  # 이름 = 시각이라 이름순으로 current 바로 앞이 직전 릴리스다
  target=$(list_releases | awk -v c="$cur" '$0 < c' | tail -n 1)
  [ -n "$target" ] || { echo "current($cur)보다 이전 릴리스가 서버에 없습니다" >&2; exit 1; }
fi

if [ ! -d "$app/releases/$target" ]; then
  echo "없는 릴리스: $target — 남아 있는 것:" >&2
  list_releases >&2
  exit 1
fi
[ "$target" != "$cur" ] || { echo "이미 current 가 $target 입니다" >&2; exit 1; }

step "롤백: $cur → $target"
since=$(date '+%Y-%m-%d %H:%M:%S')
activate "$target" || exit 1

step "확인"
if ! health "$since"; then
  show_logs "$since"
  echo "✗ $target 도 확인에 실패했습니다 — 다른 릴리스를 고르거나($0 --list) 서버에서 로그를 보세요" >&2
  exit 1
fi

echo
echo "롤백 완료: $cur → $target (DB 는 그대로)"
