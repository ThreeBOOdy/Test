# 教室内网 HTTPS 部署

本部署只允许通过一台服务器的固定教室内网 IPv4 提供服务。Caddy 使用内部 CA 为该 IP 签发证书；数据库没有宿主机端口，代理容器也无法加入数据库内部网络。

## 1. 规划地址

部署前由网络管理员确认：

- 服务器固定 IPv4，例如 `192.168.50.10`。
- 批准的教室终端 CIDR，例如 `192.168.50.0/24`。
- 服务器不存在公网端口映射、UPnP 映射或云安全组公网放行。
- 路由器、三层交换机或主机防火墙阻止其他 VLAN 访问 TCP 80、443 和 3306。

不要将 `APP_BIND_IP` 设置为 `0.0.0.0`、公网 IP、动态 DHCP 地址或域名。

## 2. 配置生产环境

复制环境模板并填写真实秘密：

```powershell
Copy-Item .env.example .env
```

生产数据库 URL 在容器内必须使用 `db:3306`。网络边界变量示例：

```dotenv
APP_BIND_IP="192.168.50.10"
APP_ALLOWED_CIDRS="192.168.50.0/24"
DATABASE_URL="mysql://practice:URL编码后的密码@db:3306/practice"
```

多个批准网段使用空格分隔：

```dotenv
APP_ALLOWED_CIDRS="192.168.50.0/24 192.168.51.0/24"
```

先验证 Compose 展开结果，确认只发布指定 IP 的 TCP 80/443，`db` 和 `app` 均没有 `ports`：

```powershell
docker compose --env-file .env -f docker-compose.prod.yml config
```

## 3. 配置主机防火墙

Windows Server 或 Windows 教室服务器必须启用所有防火墙配置文件，并将默认入站动作设为阻止。确认没有需要保留的远程管理连接后，由管理员执行：

```powershell
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled True -DefaultInboundAction Block
.\scripts\configure-lan-firewall.ps1 -ServerIp 192.168.50.10 -AllowedRemoteAddress 192.168.50.0/24
```

脚本仅增加应用规则，不会自动删除其他软件创建的宽泛放行规则。部署人员必须运行以下命令审计 TCP 80、443、3306 的所有入站规则，并停用与批准范围冲突的规则：

```powershell
$allInboundAllowRules = Get-NetFirewallRule -Enabled True -Direction Inbound -Action Allow
$allInboundAllowRules | Select-Object DisplayName, Group, Profile
$allInboundAllowRules | Get-NetFirewallPortFilter | Select-Object Protocol, LocalPort, RemotePort
$allInboundAllowRules | Get-NetFirewallAddressFilter | Select-Object LocalAddress, RemoteAddress
```

审计时必须逐项检查 `LocalPort=Any`、包含 `80`/`443`/`3306` 的范围以及宽泛 `RemoteAddress`；不能只查看本脚本创建的规则。脚本同时在 `test-results\lan-acceptance\firewall-audit.json` 写入已回读验证的应用规则和防火墙配置文件状态。将全局审计输出另存归档，并把结构化 JSON 复制到未授权测试设备，作为连接被主机防火墙丢弃时的配套证据。

边界路由器或交换机 ACL 也应只允许批准 CIDR 到服务器 TCP 80/443，并拒绝任何来源到 TCP 3306。

## 4. 启动并导出根证书

```powershell
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
docker compose --env-file .env -f docker-compose.prod.yml ps
.\scripts\export-internal-ca.ps1
```

导出的 `certificates\caddy-internal-root.crt` 不是私钥，可以通过受控的软件分发系统发送给教室设备。不要复制 Caddy `/data` 卷中的私钥或中间 CA 私钥。

## 5. 安装或更新受管设备根证书

通过管理控制台、电话或其他独立可信渠道发布导出脚本显示的 SHA-256 指纹。受管设备先人工对照指纹，再以管理员身份执行：

```powershell
.\scripts\install-internal-ca.ps1 `
  -CertificatePath .\caddy-internal-root.crt `
  -ExpectedSha256Fingerprint "可信渠道发布的64位十六进制指纹"
```

更新根证书时先安装新证书并完成访问验证，再传入旧证书指纹移除旧根：

```powershell
.\scripts\install-internal-ca.ps1 `
  -CertificatePath .\caddy-internal-root.crt `
  -ExpectedSha256Fingerprint "新根证书SHA-256指纹" `
  -PreviousCertificatePath .\previous-caddy-internal-root.crt `
  -ExpectedPreviousSha256Fingerprint "旧根证书SHA-256指纹"
```

脚本会拒绝非自签名 CA、包含私钥或不在有效期内的证书，并安装到 `LocalMachine\Root`，因此需要管理员权限。安装或更新后关闭并重新打开浏览器。

## 6. 验证健康和网络边界

受管设备必须直接使用实际 IP，不使用 `localhost`、容器地址或公网域名：

```powershell
Invoke-WebRequest https://192.168.50.10/api/health/live
Invoke-WebRequest https://192.168.50.10/api/health/ready
.\scripts\test-lan-deployment.ps1 -ServerIp 192.168.50.10 -ExpectedAccess Authorized
```

另从未授权 VLAN 或网段执行。若边界或主机防火墙直接丢弃连接，必须提供前一步保存的防火墙/ACL 审计文件；否则脚本要求 Caddy 明确返回 `403`：

```powershell
.\scripts\test-lan-deployment.ps1 `
  -ServerIp 192.168.50.10 `
  -ExpectedAccess Unauthorized `
  -FirewallEvidencePath .\firewall-audit.json `
  -ExpectedFirewallEvidenceSha256 "可信渠道发布的SHA-256"
```

授权测试会使用 Windows 系统信任库验证证书；不得使用跳过证书验证的参数。未授权测试要求 Caddy 返回 `403`，或在连接被丢弃时同时提供 24 小时内生成、规则边界完整且 SHA-256 已通过可信渠道钉扎的防火墙证据；仅当连接到达 Caddy 时临时跳过证书信任。两个测试都会验证 TCP 3306 不可连接，并在 `test-results\lan-acceptance` 生成 JSON 记录。

网络管理员先登记实际公网边界 IPv4，并通过独立可信渠道发布记录文件 SHA-256：

```powershell
.\scripts\new-public-boundary-record.ps1 `
  -PublicTarget <公网边界IPv4> `
  -Owner "网络管理员" `
  -ChangeReference "网络变更单号"
```

从真实外部网络（例如手机热点上的设备或外部监测点）执行公网探测：

```powershell
.\scripts\test-lan-deployment.ps1 `
  -PublicTarget <公网边界IPv4> `
  -PublicBoundaryRecordPath .\public-boundary.json `
  -ExpectedPublicBoundaryRecordSha256 "可信渠道发布的SHA-256"
```

公网模式先确认外部测试设备能连接互联网控制端点，再验证已钉扎的实际公网边界地址 TCP 80、443 和 3306 全部无法建立连接，并生成独立 JSON 记录。脚本拒绝私网、共享地址、链路本地、文档示例、基准测试和组播等非全球可路由地址。

## 7. 轮换和故障处理

- Caddy 数据卷必须持久化；删除 `caddy-data` 会创建新的内部根 CA，需要重新分发根证书。
- 备份不得包含未加密的 Caddy CA 私钥。若 CA 私钥疑似泄露，停止服务、删除受影响的 Caddy 数据卷、重新启动生成新 CA，并按更新流程分发根证书。
- 若浏览器仍警告证书不受信任，检查根证书是否位于本地计算机的“受信任的根证书颁发机构”，并确认访问 IP 与 `APP_BIND_IP` 完全一致。
- 若批准设备收到 `403`，检查设备实际源地址是否属于 `APP_ALLOWED_CIDRS`，以及前置 NAT 是否改变了 Caddy 所见的源 IP。
