#!/usr/bin/env sh
# infra/tf.sh — tf.ps1 과 같다 (macOS·Linux·Git Bash 용). 사용법은 tf.ps1 주석 참고.
#
#   sh infra/tf.sh bootstrap | init | plan | apply | output
set -eu

root=$(cd "$(dirname "$0")" && pwd)

# ── terraform 바이너리 — .terraform-version 을 처음 한 번 받아 infra/.bin/ 에 둔다 ──
ver=$(tr -d ' \r\n' < "$root/.terraform-version")
case "$(uname -s)" in
  Linux*) os=linux; exe=terraform ;;
  Darwin*) os=darwin; exe=terraform ;;
  MINGW* | MSYS* | CYGWIN*) os=windows; exe=terraform.exe ;;
  *) echo "지원하지 않는 OS: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=amd64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) echo "지원하지 않는 CPU: $(uname -m)" >&2; exit 1 ;;
esac
bin_dir="$root/.bin/$ver"
terraform="$bin_dir/$exe"

if [ ! -f "$terraform" ]; then
  command -v unzip > /dev/null || { echo "unzip 이 필요합니다 (윈도우라면 tf.ps1 을 쓰세요)." >&2; exit 1; }
  echo "terraform $ver 받는 중 (이 PC 에서 최초 1회)..." >&2
  name="terraform_${ver}_${os}_${arch}.zip"
  base="https://releases.hashicorp.com/terraform/$ver"
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/$name" "$base/$name"
  curl -fsSL -o "$tmp/sums" "$base/terraform_${ver}_SHA256SUMS"

  expected=$(grep " $name\$" "$tmp/sums" | cut -d' ' -f1)
  if command -v sha256sum > /dev/null; then
    actual=$(sha256sum "$tmp/$name" | cut -d' ' -f1)
  else
    actual=$(shasum -a 256 "$tmp/$name" | cut -d' ' -f1) # macOS
  fi
  if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
    rm -rf "$tmp"
    echo "terraform 체크섬이 맞지 않습니다 ($name). 다운로드가 깨졌거나 변조됐습니다." >&2
    exit 1
  fi
  mkdir -p "$bin_dir"
  unzip -oq "$tmp/$name" -d "$bin_dir"
  chmod +x "$terraform"
  rm -rf "$tmp"
fi

# ── infra/.env → 환경변수 ────────────────────────────────────────
[ -f "$root/.env" ] || { echo "infra/.env 가 없습니다. infra/.env.example 을 복사해서 채우세요." >&2; exit 1; }
[ -f "$root/terraform.tfvars" ] || { echo "infra/terraform.tfvars 가 없습니다. infra/terraform.tfvars.example 을 복사해서 채우세요." >&2; exit 1; }

# 셸에 남아 있던 다른 계정의 프로필·세션이 infra/.env 보다 먼저 잡히지 않게 비운다
unset AWS_PROFILE AWS_SESSION_TOKEN AWS_DEFAULT_REGION

# 윈도우에서 편집한 .env 는 CRLF 라 \r 이 키 값에 붙는다 — 떼고 읽는다
set -a
eval "$(tr -d '\r' < "$root/.env")"
set +a

cmd=${1:-}
[ $# -gt 0 ] && shift

# bootstrap(state 버킷)은 AWS 만 쓴다. 본체는 Cloudflare 도 쓴다
required="AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION"
[ "$cmd" = "bootstrap" ] || required="$required CLOUDFLARE_API_TOKEN"
for k in $required; do
  eval "v=\${$k:-}"
  [ -n "$v" ] || { echo "infra/.env 에 $k 가 비어 있습니다." >&2; exit 1; }
done

# ── 실행 ─────────────────────────────────────────────────────────

if [ "$cmd" = "bootstrap" ]; then
  "$terraform" -chdir="$root/bootstrap" init
  exec "$terraform" -chdir="$root/bootstrap" apply -var-file="$root/terraform.tfvars" "$@"
fi

if [ "$cmd" = "init" ]; then
  [ -f "$root/backend.hcl" ] || { echo "infra/backend.hcl 이 없습니다. sh infra/tf.sh bootstrap 을 먼저 실행하세요." >&2; exit 1; }
  exec "$terraform" -chdir="$root" init -backend-config=backend.hcl "$@"
fi

exec "$terraform" -chdir="$root" "$cmd" "$@"
