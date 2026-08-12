# 无线电学习系统 · 教室内网 HTTPS 一键部署（Windows Server）
#
# 串接的完整流程：
#   0. 检查 Docker / Compose v2
#   1. （可选 -ConfigureFirewall）配置主机防火墙，只放行批准 CIDR 到 TCP 80/443
#   2. 生成或校验生产 .env（随机密钥由 deploy-prod.ps1 生成）
#   3. 校验 Compose 配置（必需变量齐全、只发布指定 IP 的 80/443）
#   4. 构建并启动 db -> lan-config -> migrate -> seed -> app -> worker -> Caddy
#   5. 等待 app 健康检查通过（最多 5 分钟）
#   6. 导出 Caddy 内部根证书并打印 SHA-256 指纹
#   7. 运行授权端 LAN 验收测试（test-results\lan-acceptance 生成 JSON 证据）
#   8. 交互式确认部署后人工事项（逐项提问并填写，生成 checklist 证据文件）
#
# 用法：
#   .\scripts\deploy-lan-all.ps1 -ServerIp 192.168.50.10 -AllowedCidrs "192.168.50.0/24" -ConfigureFirewall
#   .\scripts\deploy-lan-all.ps1 -ServerIp 192.168.50.10 -AllowedCidrs "192.168.50.0/24","192.168.51.0/24"
#   .\scripts\deploy-lan-all.ps1 -ServerIp 192.168.50.10 -AllowedCidrs "192.168.50.0/24" -SkipCertExport -SkipAcceptance
#   .\scripts\deploy-lan-all.ps1 -ServerIp 192.168.50.10 -AllowedCidrs "192.168.50.0/24" -SkipChecklist
#
# 仍需人工完成、但脚本会逐项提问确认的步骤（直接回车表示未完成）：
#   - 主机防火墙人工审计
#   - 受管设备安装根证书（每台设备管理员权限 + 独立渠道指纹核对）
#   - 修改 admin 初始密码
#   - 从未授权网段 / 公网执行 Unauthorized / Public 验收
#   - 配置备份与数据保留计划任务
# 确认结果写入 test-results\lan-acceptance\deployment-checklist.json / .md

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [System.Net.IPAddress]$ServerIp,

  [Parameter(Mandatory = $true)]
  [string[]]$AllowedCidrs,

  [switch]$ConfigureFirewall,
  [switch]$SkipCertExport,
  [switch]$SkipAcceptance,
  [switch]$SkipChecklist
)

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectDir

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "=== $Message ===" -ForegroundColor Cyan
}

# 运行原生 docker 命令：抑制 stderr，只返回退出码（兼容 Windows PowerShell 5.1）
function Invoke-Native {
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

function Assert-Administrator {
  $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-DeploymentChecklist {
  param(
    [System.Net.IPAddress]$ServerIp,
    [switch]$Skip
  )
  $evidenceDir = Join-Path $ProjectDir "test-results\lan-acceptance"
  New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
  $questions = @(
    @{ Key = "firewallAudit"; Title = "主机防火墙人工审计"; Prompt = "是否已完成全部入站规则审计并确认无宽泛放行 80/443/3306？请填写审计证据文件路径"; Default = "test-results\lan-acceptance\firewall-audit.json" },
    @{ Key = "certificateInstall"; Title = "受管设备根证书安装"; Prompt = "是否已在受管设备安装根证书并核对指纹？请填写已安装设备数量"; Default = $null },
    @{ Key = "adminPasswordChange"; Title = "admin 初始密码修改"; Prompt = "是否已登录并修改 admin 初始密码？(y/n，回车=否)"; Default = $null },
    @{ Key = "unauthorizedPublicAcceptance"; Title = "未授权/公网验收"; Prompt = "是否已从未授权网段/公网执行验收？请填写结果摘要或证据路径"; Default = $null },
    @{ Key = "backupSchedule"; Title = "备份与数据保留计划任务"; Prompt = "是否已配置每日备份与数据保留？请填写备份目录路径"; Default = $null }
  )
  $answers = @()
  Write-Host ""
  Write-Host "=== 部署后人工事项确认（逐项填写，直接回车表示未完成）===" -ForegroundColor Cyan
  foreach ($question in $questions) {
    $value = ""
    if (-not $Skip) {
      $defaultText = ""
      if ($question.Default) { $defaultText = "（默认 $($question.Default)，回车采用）" }
      $value = Read-Host "$($question.Title)：$($question.Prompt)$defaultText"
      if (-not $value -and $question.Default) { $value = $question.Default }
    }
    $normalized = if ($value) { $value.Trim() } else { "" }
    $status = "pending"
    if ($normalized) {
      if ($normalized -match "^(n|N|否|0)$") { $status = "pending" }
      else { $status = "completed" }
    }
    $answers += [ordered]@{ key = $question.Key; title = $question.Title; answer = $normalized; status = $status }
  }
  $report = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    serverIp = $ServerIp.ToString()
    checklist = $answers
  }
  $jsonPath = Join-Path $evidenceDir "deployment-checklist.json"
  $report | ConvertTo-Json -Depth 6 | Set-Content -Path $jsonPath -Encoding UTF8
  $mdLines = @()
  $mdLines += "# 部署后人工事项确认"
  $mdLines += ""
  $mdLines += "- 生成时间：$($report.generatedAt)"
  $mdLines += "- 服务器：$($ServerIp)"
  $mdLines += ""
  $mdLines += "| 事项 | 状态 | 填写内容 |"
  $mdLines += "| --- | --- | --- |"
  foreach ($item in $answers) {
    $statusText = if ($item.status -eq "completed") { "完成" } else { "未完成" }
    $mdLines += "| $($item.title) | $statusText | $($item.answer) |"
  }
  $mdPath = Join-Path $evidenceDir "deployment-checklist.md"
  $mdLines | Set-Content -Path $mdPath -Encoding UTF8
  Write-Host ""
  Write-Host "人工事项确认清单：" -ForegroundColor Cyan
  foreach ($item in $answers) {
    $statusText = if ($item.status -eq "completed") { "[完成]" } else { "[未完成]" }
    Write-Host "  $statusText $($item.title)：$($item.answer)"
  }
  Write-Host ""
  Write-Host "清单已写入：$jsonPath" -ForegroundColor Green
  return $answers
}

# 规范化 CIDR 参数：允许空格分隔或数组，统一为单个 CIDR 列表
$cidrList = @($AllowedCidrs | ForEach-Object { $_ -split "\s+" } | Where-Object { $_ })
if ($cidrList.Count -eq 0) {
  throw "AllowedCidrs 不能为空。"
}
$allowedCidrString = $cidrList -join " "

# 0. 检查 Docker 环境
Write-Step "检查 Docker 环境"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "未检测到 docker，请先安装 Docker Engine 与 Docker Compose v2。"
}
if ((Invoke-Native @("version")) -ne 0) {
  throw "Docker 守护进程不可用，请先启动 Docker。"
}
if ((Invoke-Native @("compose", "version")) -ne 0) {
  throw "需要 Docker Compose v2。"
}

# 1. 可选：配置主机防火墙（必须先于服务启动）
if ($ConfigureFirewall) {
  Write-Step "配置主机防火墙（仅放行批准 CIDR 到 TCP 80/443）"
  if (-not (Assert-Administrator)) {
    throw "配置防火墙需要管理员权限，请以管理员身份重新运行本脚本。"
  }
  & .\scripts\configure-lan-firewall.ps1 -ServerIp $ServerIp -AllowedRemoteAddress $cidrList
  if ($LASTEXITCODE -ne 0) {
    throw "防火墙配置失败，请检查 configure-lan-firewall.ps1 输出。"
  }
  Write-Host "防火墙规则已配置，证据文件：test-results\lan-acceptance\firewall-audit.json" -ForegroundColor Green
  Write-Host "请人工审计全部入站放行规则，确认没有宽泛放行 80/443/3306 的规则。" -ForegroundColor Yellow
  if (-not $SkipChecklist) {
    Read-Host "审计完成后按回车继续部署（尚未审计也可直接回车，稍后清单中会再次确认）"
  }
}

# 2. 生成或校验 .env，并核对网络边界参数
Write-Step "准备生产配置 .env"
$envFile = Join-Path $ProjectDir ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "未找到 .env，将调用 deploy-prod.ps1 生成随机密钥……" -ForegroundColor Yellow
} else {
  $bindLine = Get-Content $envFile | Where-Object { $_ -match '^APP_BIND_IP=' } | Select-Object -First 1
  $cidrLine = Get-Content $envFile | Where-Object { $_ -match '^APP_ALLOWED_CIDRS=' } | Select-Object -First 1
  $existingBind = ""
  $existingCidrs = ""
  if ($bindLine) { $existingBind = (($bindLine -split '=', 2)[1]).Trim('"') }
  if ($cidrLine) { $existingCidrs = (($cidrLine -split '=', 2)[1]).Trim('"') }
  if ($existingBind -and $existingBind -ne $ServerIp.ToString()) {
    Write-Host "[警告] .env 中 APP_BIND_IP=$existingBind 与本次参数 $($ServerIp) 不一致，将沿用 .env 现有值。" -ForegroundColor Yellow
  }
  if ($existingCidrs -and $existingCidrs -ne $allowedCidrString) {
    Write-Host "[警告] .env 中 APP_ALLOWED_CIDRS=$existingCidrs 与本次参数不一致，将沿用 .env 现有值。" -ForegroundColor Yellow
  }
}

# 3 + 4 + 5. 复用一键脚本：校验配置 -> 构建启动 -> 等待健康
Write-Step "构建并启动全部服务（首次需数分钟）"
& .\scripts\deploy-prod.ps1 -ServerIp $ServerIp -AllowedCidrs $allowedCidrString
if ($LASTEXITCODE -ne 0) {
  throw "deploy-prod.ps1 执行失败，请查看上方日志。"
}

# 6. 导出内部根证书
if (-not $SkipCertExport) {
  Write-Step "导出 Caddy 内部根证书"
  $exportOutput = & .\scripts\export-internal-ca.ps1
  if ($LASTEXITCODE -ne 0) {
    throw "导出内部根证书失败，请确认 proxy 容器健康。"
  }
  $exportOutput | ForEach-Object { Write-Host $_ }
  Write-Host ""
  Write-Host "请通过独立可信渠道（电话/管理控制台）发布 SHA-256 指纹，再分发 certificates\caddy-internal-root.crt。" -ForegroundColor Yellow
}

# 7. 授权端 LAN 验收
if (-not $SkipAcceptance) {
  if ($PSVersionTable.PSVersion.Major -lt 7) {
    Write-Host "[警告] 授权端验收需要 PowerShell 7，当前版本 $($PSVersionTable.PSVersion)，跳过该步骤。" -ForegroundColor Yellow
    Write-Host "        请用 pwsh 运行：.\scripts\test-lan-deployment.ps1 -ServerIp $($ServerIp) -ExpectedAccess Authorized" -ForegroundColor Yellow
  } else {
    Write-Step "运行授权端 LAN 验收"
    & .\scripts\test-lan-deployment.ps1 -ServerIp $ServerIp -ExpectedAccess Authorized
    if ($LASTEXITCODE -ne 0) {
      throw "授权端验收未通过，请查看 test-results\lan-acceptance 下的 JSON 记录。"
    }
    Write-Host "授权端验收通过，证据：test-results\lan-acceptance" -ForegroundColor Green
  }
}

# 8. 部署后人工事项确认（交互填写）
$checklist = Invoke-DeploymentChecklist -ServerIp $ServerIp -Skip:$SkipChecklist

Write-Step "部署完成"
Write-Host "  访问地址：https://$($ServerIp)"
Write-Host "  管理员账号：admin（初始密码见 deploy-prod.ps1 首次运行输出或 .env 的 APP_SEED_PASSWORD，登录后请立即修改）"
Write-Host "  部署后事项确认清单：test-results\lan-acceptance\deployment-checklist.json / .md"
Write-Host ""
$pending = @($checklist | Where-Object { $_.status -ne "completed" })
if ($pending.Count -gt 0) {
  Write-Host "以下事项尚未完成，请尽快处理：" -ForegroundColor Yellow
  foreach ($item in $pending) {
    Write-Host "  - $($item.title)"
  }
  Write-Host ""
  Write-Host "对应操作见 docs\operations\lan-https-deployment.md 与 docs\operations\lan-https-acceptance.md。" -ForegroundColor Yellow
}
