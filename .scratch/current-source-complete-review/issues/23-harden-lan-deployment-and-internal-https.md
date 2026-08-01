# 23 — 收紧内网部署和内部 CA HTTPS

**What to build:** 生产系统只通过指定教室内网 IP 和内部 CA HTTPS 提供服务，教室设备安装根证书后无浏览器警告，公网和非授权网段无法访问应用或数据库。

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] 生产配置要求显式提供指定内网 IP，不再默认绑定所有网卡或依赖公网域名。
- [x] Caddy 使用内部 CA 为该内网地址提供 HTTPS，HTTP 访问按明确策略跳转或关闭。
- [x] 数据库端口不向教室终端网段或公网暴露，应用入口仅允许批准的内网来源。
- [x] 提供教室设备安装和更新内部 CA 根证书的可执行说明或脚本。
- [x] 健康检查和部署文档使用实际内网 HTTPS 地址，并说明防火墙验证步骤。
- [x] 验收记录证明受管设备无证书警告访问成功，未授权接口或网段访问失败。

**验收证据（2026-08-01）：**
- 文档：docs/operations/lan-https-acceptance.md、docs/operations/lan-https-deployment.md；脚本 scripts/configure-lan-firewall.ps1、scripts/install-internal-ca.ps1；提交 a2515b3。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
