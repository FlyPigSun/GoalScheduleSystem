# 数据层模块

## 职责
SQLite 数据库连接管理、表结构定义与初始化、基础 CRUD 封装。

## 核心文件
| 文件 | 说明 |
|------|------|
| `backend/src/models/database.js` | 数据库连接、表初始化、Promise 封装 |
| `backend/database/goals.db` | SQLite 数据文件（部署时排除同步） |

## 关键逻辑

### 1. 连接管理
- 使用 `sqlite3.Database` 单例模式，通过 `getDb()` 获取连接
- WAL 模式：`PRAGMA journal_mode = WAL`，提升并发写入性能
- 自动 checkpoint：每 1000 页（约 4MB）触发一次
- 外键约束：`PRAGMA foreign_keys = ON`

### 2. 表结构

**departments**（部门）
- `id`, `name`, `sort_order`
- 初始化时插入 5 个默认部门：采购供应链、招商、质量、工程、综合管理

**items**（任务事项）
- `id`, `title`, `description`, `due_date`, `original_due_date`
- `postpone_count`：顺延次数，每次顺延 +1
- `status`：pending / in_progress / completed / deferred / deleted（软删除用 deleted）
- `priority`：P0 / P1 / P2
- `category`, `department_id`, `source`（manual / ai_parsed）
- `created_at`, `updated_at`, `completed_at`

**item_history**（变更历史）
- 记录字段级变更：`field`, `old_value`, `new_value`
- 由 `item.js` 的 `updateItem` 和 `postponeItem` 自动写入

**weekly_reviews**（周回顾记录）
- `item_id`, `week_start`, `action`（completed / postponed / deleted）, `note`

**weekly_review_status**（周回顾状态）
- `week_start`, `reviewed`, `reviewed_at`
- 用于判断当周是否已完成回顾，避免重复弹窗

### 3. Promise 封装
`run` / `all` / `get` 三个方法将 sqlite3 的回调风格封装为 Promise，供上层 `async/await` 使用。

### 4. checkpoint 函数
手动触发 `PRAGMA wal_checkpoint(TRUNCATE)`，将 WAL 文件数据刷入主数据库。备份脚本会调用此函数确保数据完整性。

## 交互关系
- 被 `item.js`、`upload.js`、`duplicates.js`、`departments.js` 等所有模型/路由依赖
- 启动时由 `index.js` 调用 `initDatabase()` 初始化表结构

## 注意事项
- WAL 模式下数据分散在 `.db`、`.db-shm`、`.db-wal` 三个文件中，部署时必须全部排除同步
- 数据库文件不在 git 中，备份需独立处理
