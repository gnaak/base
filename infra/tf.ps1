# infra/tf.ps1 — terraform 을 받아오고, infra/.env 를 환경변수로 올려서 부른다.
#
#   ./infra/tf.ps1 bootstrap    # 프로젝트당 최초 1회: state 버킷 + backend.hcl
#   ./infra/tf.ps1 init         # backend.hcl 을 알아서 넘긴다
#   ./infra/tf.ps1 plan
#   ./infra/tf.ps1 apply
#   ./infra/tf.ps1 output
#
# terraform 을 따로 설치하지 않는다. .terraform-version 의 버전을 처음 한 번 받아서
# infra/.bin/ 에 둔다 (uv 가 .python-version 을 보고 파이썬을 받아오는 것과 같다).
# 그래서 어느 PC 에서 clone 해도 같은 버전으로 돈다.
#
# 실행이 막히면(스크립트 실행 정책):
#   powershell -ExecutionPolicy Bypass -File infra/tf.ps1 plan
#
# macOS·Linux·Git Bash 는 tf.sh 가 같은 일을 한다.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

# ── terraform 바이너리 ─────────────────────────────────────────────
$ver = (Get-Content (Join-Path $root '.terraform-version') -Raw).Trim()
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }
$binDir = Join-Path $root ".bin\$ver"
$terraform = Join-Path $binDir 'terraform.exe'

if (-not (Test-Path $terraform)) {
    Write-Host "terraform $ver 받는 중 (이 PC 에서 최초 1회)..."
    $ProgressPreference = 'SilentlyContinue' # 5.1 은 진행 표시줄 때문에 다운로드가 수십 배 느려진다
    $name = "terraform_${ver}_windows_$arch.zip"
    $base = "https://releases.hashicorp.com/terraform/$ver"
    $zip = Join-Path $env:TEMP $name
    $sums = "$zip.SHA256SUMS"
    Invoke-WebRequest "$base/$name" -OutFile $zip -UseBasicParsing
    Invoke-WebRequest "$base/terraform_${ver}_SHA256SUMS" -OutFile $sums -UseBasicParsing

    $expected = ((Get-Content $sums) | Where-Object { $_.EndsWith(" $name") } | ForEach-Object { ($_ -split '\s+')[0] })
    $actual = (Get-FileHash $zip -Algorithm SHA256).Hash
    if (-not $expected -or $expected -ne $actual) {
        Remove-Item $zip, $sums
        throw "terraform 체크섬이 맞지 않습니다 ($name). 다운로드가 깨졌거나 변조됐습니다."
    }
    Expand-Archive $zip -DestinationPath $binDir -Force
    Remove-Item $zip, $sums
}

# ── infra/.env → 환경변수 ─────────────────────────────────────────
$envFile = Join-Path $root '.env'
$tfvars = Join-Path $root 'terraform.tfvars'

if (-not (Test-Path $envFile)) { throw "infra/.env 가 없습니다. infra/.env.example 을 복사해서 채우세요." }
if (-not (Test-Path $tfvars)) { throw "infra/terraform.tfvars 가 없습니다. infra/terraform.tfvars.example 을 복사해서 채우세요." }

# 셸에 남아 있던 다른 계정의 프로필·세션이 infra/.env 보다 먼저 잡히지 않게 비운다
foreach ($k in 'AWS_PROFILE', 'AWS_SESSION_TOKEN', 'AWS_DEFAULT_REGION') { Remove-Item "Env:$k" -ErrorAction SilentlyContinue }

foreach ($line in Get-Content $envFile -Encoding UTF8) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#') -or -not $t.Contains('=')) { continue }
    $k, $v = $t -split '=', 2
    if ($v.Trim()) { Set-Item "Env:$($k.Trim())" $v.Trim() }
}

$cmd = if ($args.Count) { $args[0] } else { '' }

# bootstrap(state 버킷)은 AWS 만 쓴다. 본체는 Cloudflare 도 쓴다
$required = @('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION')
if ($cmd -ne 'bootstrap') { $required += 'CLOUDFLARE_API_TOKEN' }
foreach ($k in $required) {
    if (-not (Test-Path "Env:$k")) { throw "infra/.env 에 $k 가 비어 있습니다." }
}

# ── 실행 ──────────────────────────────────────────────────────────
$rest = @($args | Select-Object -Skip 1)

if ($cmd -eq 'bootstrap') {
    $dir = Join-Path $root 'bootstrap'
    & $terraform "-chdir=$dir" init
    if ($LASTEXITCODE) { exit $LASTEXITCODE }
    & $terraform "-chdir=$dir" apply "-var-file=$tfvars" @rest
    exit $LASTEXITCODE
}

if ($cmd -eq 'init') {
    if (-not (Test-Path (Join-Path $root 'backend.hcl'))) { throw "infra/backend.hcl 이 없습니다. ./infra/tf.ps1 bootstrap 을 먼저 실행하세요." }
    $rest = @('-backend-config=backend.hcl') + $rest
}

& $terraform "-chdir=$root" $cmd @rest
exit $LASTEXITCODE
