#!/usr/bin/env bash
# 无线电学习系统 · 生产一键部署（Linux 服务器）
# 功能：检查 Docker -> 生成/校验 .env 与随机密钥 -> 构建并启动全部服务
#       （MySQL + Prisma 迁移 + 基础数据 seed + Next.js 应用 + 定时结算 Worker + Caddy HTTPS）
#       -> 等待健康检查通过。
#
# 用法：
#   ./scripts/deploy-prod.sh 192.168.50.10 "192.168.50.0/24"   # 一步完成
#   ./scripts/deploy-prod.sh                                    # 仅生成 .env，手动填写后再次运行
#
# 首次运行自动生成 .env 与随机密钥；之后每次运行都会用最新代码重建并完整启动。
set -euo pipefail
cd "$(dirname "$0")/.."

SERVER_IP="${1:-}"
ALLOWED_CIDRS="${2:-}"
COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)

echo "=== 检查 Docker 环境 ==="
command -v docker >/dev/null || { echo "[错误] 未检测到 docker，请先安装 Docker Engine 与 Docker Compose v2。" >&2; exit 1; }
docker version >/dev/null 2>&1 || { echo "[错误] Docker 守护进程不可用，请先启动 Docker。" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "[错误] 需要 Docker Compose v2。" >&2; exit 1; }

echo "=== 准备生产配置 .env ==="
if [ ! -f .env ]; then
  echo "未找到 .env，正在生成生产配置与随机密钥……"
  cp .env.example .env

  gen_hex() { head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
  gen_key() { head -c 32 /dev/urandom | base64 | tr -d '\n'; }
  gen_pass() { tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "${1:-32}" || true; }

  MYSQL_PASSWORD="$(gen_pass 32)"
  SEED_PASSWORD="$(gen_pass 16)"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"mysql://practice:${MYSQL_PASSWORD}@db:3306/practice\"|" .env
  sed -i "s|^APP_SEED_PASSWORD=.*|APP_SEED_PASSWORD=\"${SEED_PASSWORD}\"|" .env
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=\"$(gen_hex)\"|" .env
  sed -i "s|^COOKIE_SECURE=.*|COOKIE_SECURE=\"true\"|" .env
  sed -i "s|^STUDENT_DATA_ENCRYPTION_KEY=.*|STUDENT_DATA_ENCRYPTION_KEY=\"$(gen_key)\"|" .env
  sed -i "s|^STUDENT_DATA_DECRYPTION_KEYS=.*|STUDENT_DATA_DECRYPTION_KEYS='{}'|" .env
  sed -i "s|^STUDENT_DATA_HASH_KEY=.*|STUDENT_DATA_HASH_KEY=\"$(gen_key)\"|" .env
  sed -i "s|^MYSQL_PASSWORD=.*|MYSQL_PASSWORD=\"${MYSQL_PASSWORD}\"|" .env
  sed -i "s|^MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=\"$(gen_pass 40)\"|" .env
  [ -n "$SERVER_IP" ] && sed -i "s|^APP_BIND_IP=.*|APP_BIND_IP=\"$SERVER_IP\"|" .env
  [ -n "$ALLOWED_CIDRS" ] && sed -i "s|^APP_ALLOWED_CIDRS=.*|APP_ALLOWED_CIDRS=\"$ALLOWED_CIDRS\"|" .env

  echo "已生成 .env（含随机密钥）。"
  echo "管理员初始账号：admin，密码：${SEED_PASSWORD}（登录后请立即修改）"

  if [ -z "$SERVER_IP" ] || [ -z "$ALLOWED_CIDRS" ]; then
    echo "[提示] 请编辑 .env 中的 APP_BIND_IP 与 APP_ALLOWED_CIDRS 为实际教室内网地址，然后重新运行本脚本。" >&2
    exit 1
  fi
else
  echo "已找到 .env，继续使用现有配置。"
fi

echo "=== 校验 Compose 配置 ==="
"${COMPOSE[@]}" config >/dev/null

echo "=== 构建并启动全部服务（首次需数分钟）==="
"${COMPOSE[@]}" up -d --build

echo "=== 等待应用就绪（最多 5 分钟）==="
HEALTH=""
for _ in $(seq 1 60); do
  sleep 5
  HEALTH="$("${COMPOSE[@]}" ps app --format '{{.Health}}' 2>/dev/null || true)"
  [ "$HEALTH" = "healthy" ] && break
done
"${COMPOSE[@]}" ps
if [ "$HEALTH" != "healthy" ]; then
  echo "[警告] 应用尚未通过健康检查，请查看日志：${COMPOSE[*]} logs -f app" >&2
  exit 1
fi

BIND_IP="$(sed -n 's/^APP_BIND_IP="\?\([^"]*\)"\?$/\1/p' .env | head -1)"
SEED_PASSWORD="$(sed -n 's/^APP_SEED_PASSWORD="\?\([^"]*\)"\?$/\1/p' .env | head -1)"

echo ""
echo "部署完成！"
echo "  访问地址：https://${BIND_IP}"
echo "  管理员账号：admin / 密码：${SEED_PASSWORD}（登录后请立即修改）"
echo "  客户端需安装根证书：./scripts/export-internal-ca.ps1 后分发 certificates/caddy-internal-root.crt"
echo "  验收测试：./scripts/test-lan-deployment.ps1 -ServerIp ${BIND_IP} -ExpectedAccess Authorized"
