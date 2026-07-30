# 教室内网 HTTPS 验收记录

此文件是现场验收模板。每次首次部署、服务器 IP 变化、批准网段变化、Caddy 根 CA 轮换或防火墙变更后都必须重新执行，并将脚本生成的 JSON 与本记录一并归档。

## 部署信息

| 项目 | 记录 |
| --- | --- |
| 验收日期 | `YYYY-MM-DD` |
| 应用版本 / Git 提交 |  |
| 服务器资产编号 |  |
| `APP_BIND_IP` |  |
| `APP_ALLOWED_CIDRS` |  |
| Caddy 根证书 SHA-256 指纹 |  |
| 验收人员 |  |

## 必须通过的检查

### 受管设备

- [ ] 设备位于批准网段并已安装当前内部 CA 根证书。
- [ ] 浏览器访问 `https://<APP_BIND_IP>`，受管设备无证书警告。
- [ ] 浏览器显示的证书目标 IP 与 `APP_BIND_IP` 一致，颁发链终止于已批准的 Caddy 内部根 CA。
- [ ] `https://<APP_BIND_IP>/api/health/live` 返回 `200`。
- [ ] `https://<APP_BIND_IP>/api/health/ready` 返回 `200`。
- [ ] `scripts/test-lan-deployment.ps1 -ExpectedAccess Authorized` 全部通过，JSON 记录已归档。

### 未授权网段与接口

- [ ] 从未授权网段访问 HTTP/HTTPS 失败或返回 `403`，无法看到登录页或 API 数据。
- [ ] `scripts/test-lan-deployment.ps1 -ExpectedAccess Unauthorized` 全部通过，JSON 记录已归档。
- [ ] 从教室终端、未授权网段和公网探测服务器 TCP `3306` 均失败。
- [ ] 网络管理员登记公网边界 IPv4 并通过可信渠道发布记录 SHA-256；从真实外部网络运行公网模式，互联网控制端点可达，而已钉扎目标的 TCP `80`、`443` 和 `3306` 均不可达，JSON 记录已归档，边界设备不存在端口映射。
- [ ] `docker compose -f docker-compose.prod.yml ps` 未显示数据库或应用容器的宿主机发布端口。

### 防火墙与配置证据

- [ ] 保存 `docker compose --env-file .env -f docker-compose.prod.yml config` 输出，秘密值已脱敏。
- [ ] 保存主机防火墙 TCP 80、443、3306 入站规则清单。
- [ ] 保存边界路由器、交换机 ACL 或安全组规则截图/导出。
- [ ] 确认所有活动主机防火墙配置文件默认入站动作均为 `Block`。

## 结果

| 设备 / 来源 | 源 IP | 预期 | 实际结果 | JSON 或证据路径 | 通过 |
| --- | --- | --- | --- | --- | --- |
| 受管教室设备 |  | HTTPS 200、无证书警告、3306 失败 |  |  |  |
| 未授权 VLAN 设备 |  | HTTP/HTTPS 403 或不可达、3306 失败 |  |  |  |
| 公网测试点 |  | 80/443/3306 均不可达 |  |  |  |

只有全部检查有现场证据且结果为通过，才可签署本票据验收。代码仓库不会预填或伪造受管设备、未授权网段或公网测试结果。
