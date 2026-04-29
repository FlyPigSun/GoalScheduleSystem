# 多视图展示模块

## 职责
提供三种任务查看视角：看板视图（Dashboard）、日历视图（Calendar）、时间轴视图（Timeline），支持手势滑动切换和周/月导航。

## 核心文件
| 文件 | 说明 |
|------|------|
| `frontend/src/views/Dashboard.vue` | 看板视图（部门卡片 + 目标 + 任务列表） |
| `frontend/src/views/CalendarView.vue` | 日历视图（月历网格） |
| `frontend/src/views/Timeline.vue` | 时间轴视图（周历横向展示） |
| `frontend/src/stores/app.ts` | Pinia Store，全局状态管理 |
| `frontend/src/router/index.ts` | 路由配置 |

## 关键逻辑

### 1. 看板视图（Dashboard.vue）
- **Tab 切换**：看板 / 日历 两个 Tab，支持手势左右滑动切换
- **部门卡片**：每个部门一个卡片，顶部有色条区分（dept-supply / dept-invest 等 CSS 类）
- **目标区域**：从 `goals.json` 加载部门目标，展示年度值 + Q1-Q4 季度分解
- **任务分区**：每个部门卡片内分三段展示：已逾期（红色）、本周、下周
- **手势滑动**：`onTouchStart` / `onTouchEnd` 计算滑动距离，>50px 触发 Tab 切换
- **过渡动画**：slide-in-from-left / slide-in-from-right / slide-out-to-left / slide-out-to-right

### 2. 日历视图（CalendarView.vue）
- **月历网格**：7列（周一到周日），42格（6行），前后月补齐
- **日期单元格**：显示日期数字 + 当日任务（最多显示2条，超出显示 +N）
- **任务样式**：按部门配色（backgroundColor = getDeptBg）；逾期任务红色背景
- **点击交互**：点击有任务的日期展开详情面板（ItemList 展示当日全部任务）
- **月份导航**：prevMonth / nextMonth / goToday
- **部门图例**：底部展示当前月各部门任务数量统计

### 3. 时间轴视图（Timeline.vue）
- **周历展示**：横向 7 天，每列展示当日任务
- **部门色条**：每列顶部色条颜色由当日主导部门决定（出现次数最多的部门）
- **任务展示**：每列最多显示 3 条任务，超出显示 +N 项
- **周导航**：prevWeek / nextWeek / goToday
- **部门统计**：底部展示各部门活跃/已完成/逾期数量
- **详情弹窗**：点击任务打开 ItemDetailModal

### 4. Pinia Store（app.ts）
- **state**：dashboard 数据、departments 列表、loading 状态、weekOffset
- **actions**：
  - `fetchDashboard()` - 获取看板数据
  - `fetchDepartments()` - 获取部门列表
  - `fetchTimeline(week)` - 获取时间线数据
  - `updateItem` / `deleteItem` / `postponeItem` - 本地乐观更新 + API 调用

### 5. 路由配置
```
/               → Dashboard（默认看板 Tab）
/               → Dashboard（日历 Tab，通过 Tab 切换，非路由级）
/timeline       → Timeline 视图
```

## 数据流
```
用户打开页面 → onMounted 调用 store.fetchDepartments() + fetchDashboard()
    ↓
后端 /api/items/dashboard 返回 { upcoming, currentWeek, nextWeek, thisMonth, overdue }
    ↓
Dashboard.vue 按 department_id 分组渲染部门卡片
    ↓
用户切换 Tab / 滑动 / 导航周次 → 重新获取对应视图数据
```

## 注意事项
- Dashboard 的三段式展示（overdue / currentWeek / nextWeek）后端已经按时间范围查询好，前端只做部门分组过滤
- CalendarView 一次性拉取全部任务（limit: 500），在前端按日期过滤，减少多次请求
- Timeline 也是一次性拉取，前端按周日期范围过滤
- 手势滑动和 Tab 切换有 300ms 过渡动画，期间 `isTransitioning` 锁防止重复触发
