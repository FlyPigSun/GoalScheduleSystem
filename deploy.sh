#!/bin/bash
# GoalScheduleSystem 一键部署脚本

set -e

SERVER="47.116.200.214"
SSH_KEY="~/.ssh/id_ed25519"
REMOTE_DIR="/var/www/GoalScheduleSystem"
LOCAL_DIR="/Users/sunji/Desktop/Project/GoalScheduleSystem"

echo "========================================"
echo "  GoalScheduleSystem 部署脚本"
echo "========================================"

# 1. 同步代码
echo "[1/4] 同步代码到服务器..."
rsync -avz --progress -e "ssh -i $SSH_KEY" \
  --exclude 'node_modules' \
  --exclude '.logs' \
  --exclude '.pids' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  --exclude 'dist' \
  --exclude '.env' \
  --exclude '.git' \
  --exclude 'tests' \
  $LOCAL_DIR/ \
  root@$SERVER:$REMOTE_DIR/

# 2. 构建前端
echo "[2/4] 构建前端..."
ssh -i $SSH_KEY root@$SERVER "cd $REMOTE_DIR/frontend && npm run build"

# 3. 重启后端
echo "[3/4] 重启后端服务..."
ssh -i $SSH_KEY root@$SERVER "pm2 restart goalschedule"

# 4. 重载 Nginx
echo "[4/4] 重载 Nginx..."
ssh -i $SSH_KEY root@$SERVER "nginx -s reload"

echo ""
echo "========================================"
echo "  部署完成！"
echo "  访问地址: http://$SERVER/GoalScheduleSystem/"
echo "========================================"