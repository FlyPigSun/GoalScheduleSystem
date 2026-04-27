# 部署说明

## 环境要求

- Node.js ≥ 18
- SQLite3
- Nginx
- PM2（云端）
- 腾讯云 API Key（AI 解析功能）

## 一键部署

```bash
cd /Users/sunji/Desktop/Project/GoalScheduleSystem
./deploy.sh
```

## 部署脚本流程

1. **同步代码**：rsync 本地代码到服务器（排除 node_modules、.git、数据库文件）
2. **构建前端**：服务器端执行 `npm run build`
3. **重启后端**：PM2 重启 goalschedule 进程
4. **重载 Nginx**：nginx -s reload

## 手动部署步骤

```bash
# 1. 本地提交并推送
git add .
git commit -m "xxx"
git push

# 2. 同步到服务器
rsync -avz --exclude='node_modules' --exclude='.git' \
  --exclude='*.db' --exclude='*.db-shm' --exclude='*.db-wal' \
  --exclude='backups/' \
  ./ root@47.116.200.214:/var/www/GoalScheduleSystem/

# 3. 服务器端构建
ssh root@47.116.200.214 "cd /var/www/GoalScheduleSystem/frontend && npm run build"

# 4. 重启服务
ssh root@47.116.200.214 "pm2 restart goalschedule"

# 5. 重载 Nginx
ssh root@47.116.200.214 "nginx -s reload"
```

## 关键配置

### Nginx（云端）
```nginx
location /GoalScheduleSystem/ {
    alias /var/www/GoalScheduleSystem/frontend/dist/;
    try_files $uri $uri/ /GoalScheduleSystem/index.html;
}

location /GoalScheduleSystem/api/ {
    proxy_pass http://127.0.0.1:3200/;
    proxy_read_timeout 120s;
    proxy_connect_timeout 120s;
    proxy_send_timeout 120s;
}
```

### PM2 配置
```json
{
  "name": "goalschedule",
  "script": "backend/src/index.js",
  "cwd": "/var/www/GoalScheduleSystem",
  "env": {
    "NODE_ENV": "production",
    "PORT": 3200
  }
}
```

### 环境变量（.env）
```
TENCENT_SECRET_ID=sk-tp-xxx
```

## 数据库备份

```bash
# 手动备份
sqlite3 goals.db ".backup '/var/www/GoalScheduleSystem/backend/database/backups/goals.db.$(date +%Y%m%d_%H%M%S)'"
```

## 回滚

```bash
# 查看历史提交
git log --oneline

# 回滚到指定版本
git reset --hard <commit-hash>
git push -f
./deploy.sh
```

---

*生成时间：2026-04-24*
