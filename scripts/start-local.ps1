# 无线电学习系统 · 一键启动脚本
# 功能：检查依赖与数据库 -> 应用迁移 -> 写入演示数据 -> 启动开发服务器并打开浏览器
# 用法：双击同目录下的 start-local.cmd，或在 PowerShell 中执行本脚本

$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $PSScriptRoot
$DbHost = "127.0.0.1"
$DbPort = 3306
$ProbePorts = 3000..3010

function Write-Step([int]$Number, [string]$Message) {
  Write-Host ""
  Write-Host "=== 步骤 $Number/$StepCount：$Message ===" -ForegroundColor Cyan
}

$StepCount = 6

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "       无线电学习系统 · 一键启动" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path (Join-Path $ProjectDir "package.json"))) {
  Write-Host "[错误] 未找到项目目录：$ProjectDir" -ForegroundColor Red
  Write-Host "       请修改脚本顶部的 ProjectDir 变量后重试。" -ForegroundColor Yellow
  Read-Host "按回车键退出"
  exit 1
}
Set-Location $ProjectDir

# 1. 检查 Node.js
Write-Step 1 "检查 Node.js"
$nodeVersion = & node -v 2>$null
if ($LASTEXITCODE -ne 0 -or -not $nodeVersion) {
  Write-Host "[错误] 未检测到 Node.js，请先安装 Node.js 20 以上版本。" -ForegroundColor Red
  Read-Host "按回车键退出"
  exit 1
}
Write-Host "Node.js 已就绪：$nodeVersion"

# 2. 检查系统是否已经在运行
Write-Step 2 "检查系统是否已在运行"

function Get-HealthState([int]$Port) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health/live" -UseBasicParsing -TimeoutSec 1
    if ($response.StatusCode -ne 200) { return $null }
    $body = $response.Content | ConvertFrom-Json
    return @{ Responding = $true; Env = $body.env }
  } catch {
    return $null
  }
}

$currentDev = @()  # 最新代码的开发服务器（健康检查带 env=development 标记）
$stalePorts = @()  # 旧实例端口（Docker 容器或旧版本代码）
foreach ($port in $ProbePorts) {
  $state = Get-HealthState $port
  if ($null -eq $state) { continue }
  if ($state.Env -eq "development") {
    $currentDev += "http://localhost:$port"
  } else {
    $stalePorts += $port
  }
}

# 旧实例一律清理：本脚本只保留并展示“最新代码”的开发服务器
if ($stalePorts.Count -gt 0) {
  Write-Host "检测到端口 $($stalePorts -join '、') 上有旧实例（Docker 容器或旧版本代码）。" -ForegroundColor Yellow
  Write-Host "正在停止旧实例，以便启动最新代码……" -ForegroundColor Yellow

  foreach ($port in $stalePorts) {
    $stopped = $false

    # 优先停止发布该端口的 Docker 容器（通常是旧的 docker compose app）
    try {
      $containerIds = docker ps -q --filter "publish=$port" 2>$null
      if ($LASTEXITCODE -eq 0 -and $containerIds) {
        foreach ($id in $containerIds) {
          if (-not $id) { continue }
          docker stop $id | Out-Null
          if ($LASTEXITCODE -eq 0) { $stopped = $true }
        }
      }
    } catch { }

    # 非 Docker 场景：停止占用该端口的 node 进程（旧开发服务器）
    if (-not $stopped) {
      try {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($conn) {
          $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
          if ($proc -and $proc.ProcessName -eq "node") {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            $stopped = $true
          }
        }
      } catch { }
    }

    if ($stopped) {
      Write-Host "  端口 $port 的旧实例已停止。" -ForegroundColor Green
    } else {
      Write-Host "[警告] 无法自动停止端口 $port 上的旧实例。" -ForegroundColor Red
      Write-Host "       请手动停止占用该端口的程序或容器后，重新运行本脚本。" -ForegroundColor Yellow
      Read-Host "按回车键退出"
      exit 1
    }
  }
  Start-Sleep -Seconds 1
  Write-Host "旧实例已清理，将继续启动最新代码。" -ForegroundColor Green
  Write-Host ""
}

# 最新代码的开发服务器已在运行时，直接打开即可
if ($currentDev.Count -gt 0) {
  Write-Host "检测到最新代码的开发服务器已在运行，无需重复启动：" -ForegroundColor Green
  foreach ($url in $currentDev) { Write-Host "  $url" -ForegroundColor Green }
  Start-Process $currentDev[0]
  Read-Host "按回车键退出"
  exit 0
}

Write-Host "未检测到运行中的实例，开始启动服务。"

# 3. 检查 MySQL 数据库
Write-Step 3 "检查 MySQL 数据库（$DbHost`:$DbPort）"
$dbUp = $false
try {
  $client = New-Object System.Net.Sockets.TcpClient
  $task = $client.ConnectAsync($DbHost, $DbPort)
  if ($task.Wait(2000) -and $client.Connected) { $dbUp = $true }
  $client.Close()
} catch { }
if (-not $dbUp) {
  Write-Host "MySQL 未连接，尝试用 Docker 启动数据库..." -ForegroundColor Yellow
  docker compose up -d db
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] 无法启动数据库。请先手动启动本机 MySQL 或 Docker Desktop。" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
  }
  Write-Host "Docker 数据库已启动（端口 3307）。" -ForegroundColor Yellow
  Write-Host "注意：如果 .env 中 DATABASE_URL 指向 127.0.0.1:3306，请同步改成 3307。" -ForegroundColor Yellow
  $DbPort = 3307
  Start-Sleep -Seconds 8
} else {
  Write-Host "MySQL 数据库已就绪。"
}

# 4. 检查依赖与 Prisma 客户端
Write-Step 4 "检查依赖与 Prisma 客户端"
if (-not (Test-Path (Join-Path $ProjectDir "node_modules"))) {
  Write-Host "首次运行，正在安装依赖（可能需要几分钟）..."
  npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] npm install 失败，请检查网络后重试。" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
  }
} else {
  Write-Host "依赖已安装，跳过 npm install。"
}
if (-not (Test-Path (Join-Path $ProjectDir "generated\prisma\client.ts"))) {
  npm run db:generate
} else {
  Write-Host "Prisma 客户端已生成。"
}

# 5. 应用数据库迁移并写入演示数据
Write-Step 5 "应用数据库迁移并写入演示数据"
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
  Write-Host "[错误] 数据库迁移失败，请检查 .env 中的 DATABASE_URL。" -ForegroundColor Red
  Read-Host "按回车键退出"
  exit 1
}
npm run db:seed
if ($LASTEXITCODE -ne 0) {
  Write-Host "[错误] 演示数据写入失败。" -ForegroundColor Red
  Read-Host "按回车键退出"
  exit 1
}

# 6. 启动开发服务器并自动打开浏览器
Write-Step 6 "启动开发服务器（就绪后自动打开浏览器）"
Write-Host "服务启动后可随时按 Ctrl+C 停止。"
Write-Host ""

$polling = Start-Job -ScriptBlock {
  param($ports)
  for ($i = 0; $i -lt 90; $i++) {
    foreach ($port in $ports) {
      try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health/live" -UseBasicParsing -TimeoutSec 1
        if ($r.StatusCode -eq 200) {
          Start-Process "http://localhost:$port"
          return
        }
      } catch { }
    }
    Start-Sleep -Seconds 1
  }
} -ArgumentList $ProbePorts

npm run dev
$devCode = $LASTEXITCODE

Stop-Job $polling -ErrorAction SilentlyContinue
Remove-Job $polling -Force -ErrorAction SilentlyContinue

if ($devCode -ne 0) {
  Write-Host "开发服务器已退出（退出码 $devCode）。" -ForegroundColor Yellow
  Write-Host "如果提示“Another next dev server is already running”，说明已有实例在运行，关闭本窗口、打开既有地址即可。" -ForegroundColor Yellow
}
Read-Host "按回车键退出"
