# 任务管理模块

## 职责
任务的全生命周期管理：创建、查询、更新、删除、顺延，以及变更历史记录。

## 核心文件
| 文件 | 说明 |
|------|------|
| `backend/src/routes/items.js` | REST API 路由（校验 + 转发） |
| `backend/src/models/item.js` | 业务逻辑与数据操作 |
| `frontend/src/components/ItemForm.vue` | 新建/编辑任务弹窗 |
| `frontend/src/components/ItemList.vue` | 任务列表展示（含内嵌编辑弹窗） |
| `frontend/src/components/ItemDetailModal.vue` | 任务详情弹窗（Timeline 视图用） |

## 关键逻辑

### 1. 后端路由层（items.js）
- **校验规则**：标题非空、50字以内；描述 200字以内；优先级限定 P0/P1/P2；状态限定 pending/in_progress/completed；日期格式 YYYY-MM-DD
- **接口列表**：
  - `GET /items/dashboard` - 看板数据（按周偏移量）
  - `GET /items/timeline` - 时间线数据
  - `GET /items/weekly-review` - 周回顾待处理列表
  - `POST /items/weekly-review` - 提交周回顾结果
  - `GET /items` / `GET /items/:id` - 查询
  - `POST /items` - 创建
  - `PUT /items/:id` - 更新
  - `DELETE /items/:id` - 软删除（status → deleted）
  - `POST /items/:id/postpone` - 顺延截止日期

### 2. 模型层（item.js）

**getDashboard(weekOffset)**
- 基于目标日期计算本周起止（周一~周日）
- 并行 5 个查询：upcoming（今天到周末）、currentWeek、nextWeek、thisMonth、overdue
- 返回结构供 Dashboard.vue 按部门分组展示

**getTimeline(weekOffset)**
- 查询当前周内的 active 任务（pending/in_progress）和 completed 任务
- completed 按 `completed_at` 时间范围筛选

**updateItem(id, data)**
- 字段级 diff：只更新有变化的字段
- 自动写入 `item_history` 变更历史
- 状态变为 completed 时自动设置 `completed_at`
- 自动更新 `updated_at`

**postponeItem(id, newDueDate)**
- 更新 `due_date` 并 `postpone_count + 1`
- 写入 `item_history` 记录顺延

**deleteItem(id)**
- 软删除：更新 status 为 deleted（非物理删除，保留数据）

**getWeeklyReviewItems()**
- 检查 `weekly_review_status` 表，若当周已 review 则返回空
- 否则查询上周及之前未完成的任务（due_date ≤ 上周日）

**submitWeeklyReview(reviews)**
- 遍历每条 review，根据 action 执行：
  - completed → 更新 status + completed_at
  - postponed → due_date 顺延一周，postpone_count +1
  - deleted → 调用 deleteItem
- 写入 `weekly_reviews` 记录
- 标记 `weekly_review_status` 为已回顾

### 3. 前端交互

**ItemForm.vue**
- 新建/编辑双模式：通过 `editId` prop 区分
- 表单字段：标题、描述、截止日期、优先级（P0/P1/P2）、部门、状态

**ItemList.vue**
- 支持 compact 模式（看板中紧凑展示）
- 内嵌编辑弹窗：点击任务展开，可直接修改所有字段
- 支持顺延、完成、删除操作

**ItemDetailModal.vue**
- Timeline 视图中点击任务触发的详情弹窗
- 支持编辑、完成、删除、顺延

## 数据流
```
用户操作 → ItemForm/ItemList/ItemDetailModal
    ↓
前端 API 调用 (itemsApi)
    ↓
后端 items.js 路由（校验）
    ↓
item.js 模型（SQL 执行 + 历史记录）
    ↓
database.js（SQLite）
```

## 注意事项
- 删除是软删除，数据保留在表中，查询时统一排除 status='deleted'
- 顺延会累加 postpone_count，可用于分析任务拖延情况
- updateItem 的字段级 diff 逻辑避免了无意义的历史记录写入
