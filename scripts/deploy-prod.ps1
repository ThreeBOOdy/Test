# 无线电学习系统 · 生产一键部署（Windows 服务器）
# 功能：检查 Docker -> 生成/校验 .env 与随机密钥 -> 构建并启动全部服务
#       （MySQL + Prisma 迁移 + 基础数据 seed + Next.js 应用 + 定时结算 Worker + Caddy HTTPS）
#       -> 等待健康检查通过。
#
# 用法：
#   .\scripts\deploy-prod.ps1 -ServerIp 192.168.50.10 -AllowedCidrs "192.168.50.0/24"   # 一步完成
#   .\scripts\deploy-prod.ps1                # 仅生成 .env，手动填写网络地址后再次运行
#
# 首次运行自动生成 .env 与随机密钥；之后每次运行都会用最新代码重建并完整启动。

[CmdletBinding()]
param(
  [string]$ServerIp,
  [string]$AllowedCidrs
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "=== $Message ===" -ForegroundColor Cyan
}

# 运行原生 docker 命令：抑制 stderr，只返回退出码（兼容 Windows PowerShell 5.1 的 NativeCommandError）
function Invoke-Docker {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [switch]$ShowOutput
  )
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    if ($ShowOutput) {
      & docker @Arguments
    } else {
      & docker @Arguments 2>$null | Out-Null
    }
  } catch {
    # stderr 输出在 ErrorActionPreference=Stop 下会被包装成错误，这里忽略，由退出码决定成败
  }
  $code = $LASTEXITCODE
  $ErrorActionPreference = $previous
  return $code
}

# 0. 检查 Docker 环境
Write-Step "检查 Docker 环境"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "[错误] 未检测到 docker，请先安装 Docker Engine 与 Docker Compose v2。" -ForegroundColor Red
  exit 1
}
$code = Invoke-Docker @("version")
if ($code -ne 0) {
  Write-Host "[错误] Docker 守护进程不可用，请先启动 Docker。" -ForegroundColor Red
  exit 1
}
$code = Invoke-Docker @("compose", "version")
if ($code -ne 0) {
  Write-Host "[错误] 需要 Docker Compose v2。" -ForegroundColor Red
  exit 1
}

# 1. 生成或校验 .env
Write-Step "准备生产配置 .env"
$envFile = Join-Path $ProjectDir ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "未找到 .env，正在生成生产配置与随机密钥……" -ForegroundColor Yellow
  Copy-Item (Join-Path $ProjectDir ".env.example") $envFile

  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  function New-RandomHex([int]$Length) {
    $bytes = New-Object byte[] $Length
    $rng.GetBytes($bytes)
    ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
  }
  function New-KeyBase64 {
    $bytes = New-Object byte[] 32
    $rng.GetBytes($bytes)
    [Convert]::ToBase64String($bytes)
  }
  function New-Password([int]$Length = 32) {
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    $bytes = New-Object byte[] $Length
    $rng.GetBytes($bytes)
    $result = New-Object System.Text.StringBuilder
    foreach ($b in $bytes) { [void]$result.Append($chars[$b % $chars.Length]) }
    $result.ToString()
  }

  $mysqlPassword = New-Password
  $seedPassword = New-Password 16
  $lines = Get-Content $envFile
  $lines = $lines -replace '^DATABASE_URL=.*$', "DATABASE_URL=`"mysql://practice:$mysqlPassword@db:3306/practice`""
  $lines = $lines -replace '^APP_SEED_PASSWORD=.*$', "APP_SEED_PASSWORD=`"$seedPassword`""
  $lines = $lines -replace '^AUTH_SECRET=.*$', "AUTH_SECRET=`"$(New-RandomHex 48)`""
  $lines = $lines -replace '^COOKIE_SECURE=.*$', 'COOKIE_SECURE="true"'
  $lines = $lines -replace '^STUDENT_DATA_ENCRYPTION_KEY=.*$', "STUDENT_DATA_ENCRYPTION_KEY=`"$(New-KeyBase64)`""
  $lines = $lines -replace '^STUDENT_DATA_DECRYPTION_KEYS=.*$', "STUDENT_DATA_DECRYPTION_KEYS='{}'"
  $lines = $lines -replace '^STUDENT_DATA_HASH_KEY=.*$', "STUDENT_DATA_HASH_KEY=`"$(New-KeyBase64)`""
  $lines = $lines -replace '^MYSQL_PASSWORD=.*$', "MYSQL_PASSWORD=`"$mysqlPassword`""
  $lines = $lines -replace '^MYSQL_ROOT_PASSWORD=.*$', "MYSQL_ROOT_PASSWORD=`"$(New-Password 40)`""
  if ($ServerIp) {
    $lines = $lines -replace '^APP_BIND_IP=.*$', "APP_BIND_IP=`"$ServerIp`""
  }
  if ($AllowedCidrs) {
    $lines = $lines -replace '^APP_ALLOWED_CIDRS=.*$', "APP_ALLOWED_CIDRS=`"$AllowedCidrs`""
  }
  [System.IO.File]::WriteAllLines($envFile, $lines, (New-Object System.Text.UTF8Encoding $false))

  Write-Host "已生成 .env（含随机密钥）。" -ForegroundColor Green
  Write-Host "管理员初始账号：admin，密码：$seedPassword（登录后请立即修改）" -ForegroundColor Green

  if (-not $ServerIp -or -not $AllowedCidrs) {
    Write-Host ""
    Write-Host "[提示] 请编辑 .env 中的 APP_BIND_IP 与 APP_ALLOWED_CIDRS 为实际教室内网地址，" -ForegroundColor Yellow
    Write-Host "       然后重新运行本脚本完成部署。" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
  }
} else {
  Write-Host "已找到 .env，继续使用现有配置。"
}

# 2. 校验 Compose 配置（缺必需变量时这里会报错）
Write-Step "校验 Compose 配置"
$code = Invoke-Docker @("compose", "--env-file", ".env", "-f", "docker-compose.prod.yml", "config")
if ($code -ne 0) {
  Write-Host "[错误] .env 缺少必需变量（DATABASE_URL / AUTH_SECRET / APP_BIND_IP / APP_ALLOWED_CIDRS / MYSQL_PASSWORD / MYSQL_ROOT_PASSWORD），请补全后重试。" -ForegroundColor Red
  exit 1
}

# 3. 构建并启动全部服务（数据库 + 迁移 + seed + 应用 + Worker + Caddy）
Write-Step "构建并启动全部服务（首次需数分钟）"
$code = Invoke-Docker @("compose", "--env-file", ".env", "-f", "docker-compose.prod.yml", "up", "-d", "--build") -ShowOutput
if ($code -ne 0) {
  Write-Host "[错误] 部署失败，请查看上方日志。" -ForegroundColor Red
  exit 1
}

# 4. 等待应用健康检查
Write-Step "等待应用就绪（最多 5 分钟）"
$deadline = (Get-Date).AddMinutes(5)
$healthy = $false
do {
  Start-Sleep -Seconds 5
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $state = (& docker compose --env-file .env -f docker-compose.prod.yml ps app --format json 2>$null) | ConvertFrom-Json
  } catch {
    $state = $null
  }
  $ErrorActionPreference = $previous
  if ($state.Health -eq "healthy") { $healthy = $true; break }
} while ((Get-Date) -lt $deadline)

$code = Invoke-Docker @("compose", "--env-file", ".env", "-f", "docker-compose.prod.yml", "ps") -ShowOutput

if (-not $healthy) {
  Write-Host "[警告] 应用尚未通过健康检查，请查看日志：" -ForegroundColor Yellow
  Write-Host "  docker compose --env-file .env -f docker-compose.prod.yml logs -f app" -ForegroundColor Yellow
  exit 1
}

# 5. 完成
$bindIpLine = Get-Content $envFile | Where-Object { $_ -match '^APP_BIND_IP=' } | Select-Object -First 1
$bindIp = ($bindIpLine -split '=', 2)[1].Trim('"')
$seedLine = Get-Content $envFile | Where-Object { $_ -match '^APP_SEED_PASSWORD=' } | Select-Object -First 1
$seedPassword = ($seedLine -split '=', 2)[1].Trim('"')

Write-Host ""
Write-Host "部署完成！" -ForegroundColor Green
Write-Host "  访问地址：https://$bindIp" -ForegroundColor Green
Write-Host "  管理员账号：admin / 密码：$seedPassword（登录后请立即修改）" -ForegroundColor Green
Write-Host "  客户端需安装根证书：.\scripts\export-internal-ca.ps1 后分发 certificates\caddy-internal-root.crt" -ForegroundColor Green
Write-Host "  验收测试：.\scripts\test-lan-deployment.ps1 -ServerIp $bindIp -ExpectedAccess Authorized" -ForegroundColor Green
