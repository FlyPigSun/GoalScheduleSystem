# 每周回顾模块

## 职责
每周首次访问系统时弹出确认窗口，让用户对上周及之前的未完成任务进行完成/顺延/删除处理。

## 核心文件
| 文件 | 说明 |
|------|------|
| `backend/src/routes/items.js` | `GET/POST /items/weekly-review` 路由 |
| `backend/src/models/item.js` | `getWeeklyReviewItems()`、`submitWeeklyReview()` |
| `frontend/src/components/WeeklyReview.vue` | 回顾确认弹窗 |

## 关键逻辑

### 1. 触发时机
- 系统启动时（App.vue 或 Dashboard.vue onMounted）检查
- 调用 `GET /items/weekly-review`
- 后端查询 `weekly_review_status` 表：若当周已标记 reviewed，直接返回空
- 否则返回上周日及之前的未完成任务列表

### 2. 后端逻辑

**getWeeklyReviewItems()**
- 获取本周一日期（weekStart）
- 查 `weekly_review_status`：若 `reviewed = 1` 则返回 `{reviewed: true}`
- 否则查询 `items`：status IN (pending, in_progress) AND due_date ≤ 上周日
- 返回 `{reviewed: false, items, weekStart, prevWeekStart}`

**submitWeeklyReview(reviews)**
- 遍历每条 review：
  - **completed**：更新 items.status = 'completed', completed_at = now
  - **postponed**：due_date = 下周一，postpone_count + 1，写入 item_history
  - **deleted**：调用 deleteItem（软删除）
- 写入 `weekly_reviews` 记录每条操作
- 更新 `weekly_review_status` 标记当周已回顾

### 3. 前端交互（WeeklyReview.vue）
- **弹窗样式**：模态框，必须全部处理后才能关闭
- **任务列表**：每条任务显示标题、截止日期、部门选择下拉框
- **操作按钮**：
  - ✅ 已完成（绿色）
  - ⏳ 顺延（黄色）→ 自动顺延到下周
  - 🗑️ 删除（灰色）→ 软删除
- **部门修改**：可在弹窗中直接修改任务所属部门（实时保存到后端）
- **提交条件**：所有任务都必须选择一个操作（canSubmit = every item has action）

### 4. 自动关闭逻辑
- 若当周已 review → 自动关闭弹窗
- 若没有待处理事项 → 自动关闭弹窗

## 数据流
```
页面加载 → GET /items/weekly-review
    ↓
已 review / 无事项 → 静默关闭
有事项 → WeeklyReview.vue 弹窗展示
    ↓
用户选择操作（完成/顺延/删除）+ 可选修改部门
    ↓
POST /items/weekly-review → 后端批量处理
    ↓
标记当周已回顾 → 弹窗关闭 → 刷新 Dashboard
```

## 注意事项
- 回顾是按"自然周"（周一到周日）判断，不是按用户上次访问时间
- 顺延操作固定顺延 7 天（到下周），不可自定义天数
- 部门修改是实时 API 调用（非批量），成功/失败有短暂提示
- 软删除的任务保留在数据库中，可通过历史记录追溯
