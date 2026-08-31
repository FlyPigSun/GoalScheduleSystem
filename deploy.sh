#!/bin/bash
# GoalScheduleSystem 一键部署脚本

set -euo pipefail

SERVER="47.116.200.214"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/var/www/GoalScheduleSystem"
LOCAL_DIR="/Users/sunji/Desktop/Project/GoalScheduleSystem"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/var/backups/GoalScheduleSystem/$TIMESTAMP"

echo "========================================"
echo "  GoalScheduleSystem 部署脚本"
echo "========================================"

# 1. 备份数据库和当前代码
echo "[1/5] 备份数据库和当前代码..."
ssh -i "$SSH_KEY" root@$SERVER "mkdir -p '$BACKUP_DIR' && sqlite3 '$REMOTE_DIR/backend/database/goals.db' \".backup '$BACKUP_DIR/goals.db'\" && tar --exclude='node_modules' --exclude='database' --exclude='dist' -czf '$BACKUP_DIR/source.tar.gz' -C '$REMOTE_DIR' ."

# 2. 同步代码
echo "[2/5] 同步代码到服务器..."
rsync -avz --delete --progress -e "ssh -i $SSH_KEY" \
  --exclude 'node_modules' \
  --exclude '.logs' \
  --exclude '.pids' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  --exclude 'dist' \
  --exclude '.env' \
  --exclude '.git' \
  --exclude 'tests' \
  --exclude 'backend/database/*.db' \
  --exclude 'backend/database/*.db-shm' \
  --exclude 'backend/database/*.db-wal' \
  --exclude 'backend/database/backups/' \
  $LOCAL_DIR/ \
  root@$SERVER:$REMOTE_DIR/

# 3. 安装依赖并构建前端
echo "[3/5] 安装依赖并构建前端..."
ssh -i "$SSH_KEY" root@$SERVER "cd '$REMOTE_DIR/backend' && npm ci --omit=dev && cd '$REMOTE_DIR/frontend' && npm ci && npm run build"

# 4. 重启并验证后端
echo "[4/5] 重启并验证后端..."
ssh -i "$SSH_KEY" root@$SERVER "pm2 restart goalschedule --update-env && sleep 2 && curl -fsS http://127.0.0.1:3200/api/health >/dev/null"

# 5. 检查并重载 Nginx
echo "[5/5] 检查并重载 Nginx..."
ssh -i "$SSH_KEY" root@$SERVER "nginx -t && nginx -s reload"

echo ""
echo "========================================"
echo "  部署完成！"
echo "  访问地址: http://$SERVER/GoalScheduleSystem/"
echo "  回滚备份: $BACKUP_DIR"
echo "========================================"
