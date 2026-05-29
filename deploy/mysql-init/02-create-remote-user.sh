#!/usr/bin/env bash
# =====================================================
# GPT Image API · MySQL 远程运维用户初始化
#
# 创建一个可从任意主机远程连接的运维用户，权限：
#   SELECT / INSERT / UPDATE / DELETE（DML 只读写）
#   无 DDL（无法 DROP / ALTER / CREATE 表），保护表结构
#
# 依赖环境变量（由 docker-compose 注入）：
#   GIA_DB_OPS_USER     远程用户名（默认 giaops）
#   GIA_DB_OPS_PASSWORD 远程用户密码（必须设置，否则跳过）
#   MYSQL_ROOT_PASSWORD MySQL root 密码
#   MYSQL_DATABASE      数据库名
# =====================================================

set -euo pipefail

OPS_USER="${GIA_DB_OPS_USER:-giaops}"
OPS_PASS="${GIA_DB_OPS_PASSWORD:-}"

if [[ -z "$OPS_PASS" ]]; then
  echo "[gia-init] GIA_DB_OPS_PASSWORD not set, skipping remote ops user creation."
  exit 0
fi

MYSQL_PWOPT=()
if [[ -n "${MYSQL_ROOT_PASSWORD:-}" ]]; then
  MYSQL_PWOPT=(-p"${MYSQL_ROOT_PASSWORD}")
fi

echo "[gia-init] creating remote ops user: ${OPS_USER}@'%' ..."

mysql -uroot "${MYSQL_PWOPT[@]}" <<EOF
-- 创建用户（幂等：已存在则跳过密码修改）
CREATE USER IF NOT EXISTS '${OPS_USER}'@'%'
  IDENTIFIED WITH caching_sha2_password
  BY '${OPS_PASS}'
  PASSWORD EXPIRE NEVER
  COMMENT 'Remote DML-only ops account for gpt-image-api';

-- 刷新密码（确保密码为最新值）
ALTER USER '${OPS_USER}'@'%' IDENTIFIED BY '${OPS_PASS}';

-- 授予 DML 读写权限（无 DDL）
GRANT SELECT, INSERT, UPDATE, DELETE
  ON \`${MYSQL_DATABASE}\`.*
  TO '${OPS_USER}'@'%';

-- 不授予 DROP / ALTER / CREATE / TRUNCATE / INDEX 等 DDL 权限，保护表结构

FLUSH PRIVILEGES;
EOF

echo "[gia-init] remote ops user '${OPS_USER}'@'%' ready."
echo "[gia-init]   permissions: SELECT, INSERT, UPDATE, DELETE on ${MYSQL_DATABASE}.*"
echo "[gia-init]   connect: mysql -h <server-ip> -P 13306 -u${OPS_USER} -p ${MYSQL_DATABASE}"
