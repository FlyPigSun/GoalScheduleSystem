# GoalScheduleSystem

## 项目概述
个人目标与日程管理系统，用于管理多部门（采购供应链、招商、质量、工程、综合管理）的重点事项追踪。

## 核心使用场景
- 每周日/周一发送周报资料 → AI解析 → 自动更新系统数据
- 系统展示：上周完成回顾、本周/下周重点、当月事项、逾期事项
- 手动补充：快速录入遗漏事项
- 每周首次访问弹窗确认上周事项完成情况

## 技术栈
- **后端**: Node.js + Express + SQLite
- **前端**: Vue3 + TailwindCSS + TypeScript
- **部署**: Nginx 反向代理（端口 8080），后端端口 3200
- **自启动**: launchd 服务 `com.goalschedule.server`

## 访问地址
- **本地**: http://localhost:8080/GoalScheduleSystem/
- **日历视图**: http://localhost:8080/GoalScheduleSystem/timeline

## 项目结构
```
GoalScheduleSystem/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── index.js        # Express 入口
│   │   ├── routes/         # API 路由
│   │   │   ├── items.js    # 事项 CRUD
│   │   │   ├── upload.js   # 文件上传解析
│   │   │   └── departments.js
│   │   └── models/         # 数据模型
│   │       ├── database.js # SQLite 连接
│   │       └── item.js     # 事项模型
│   ├── database/           # SQLite 数据库文件
│   └── package.json
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   │   ├── Dashboard.vue    # 看板视图
│   │   │   ├── Timeline.vue     # 日历视图
│   │   │   └── CalendarView.vue # 日历组件
│   │   ├── components/    # 公共组件
│   │   │   ├── ItemList.vue     # 事项列表
│   │   │   ├── ItemForm.vue     # 新增表单
│   │   │   ├── FileUpload.vue   # 文件上传
│   │   │   └── WeeklyReview.vue # 周报确认
│   │   ├── config/        # 配置文件
│   │   │   └── departments.ts    # 部门配置
│   │   ├── utils/         # 工具函数
│   │   │   └── date.ts            # 日期处理
│   │   ├── stores/        # Pinia 状态管理
│   │   ├── api/           # API 封装
│   │   └── router/        # 路由配置
│   └── package.json
└── README.md
```

## 数据库设计

### departments（部门表）
- id: 部门ID
- name: 部门名称
- sort_order: 排序

### items（事项表）
- id: 事项ID
- title: 事项名称（50字内）
- description: 描述（200字内）
- due_date: 截止日期
- original_due_date: 原始截止日期
- postpone_count: 顺延次数
- status: 状态（pending/in_progress/completed/deleted）
- priority: 优先级（P0/P1/P2）
- department_id: 所属部门
- source: 来源（manual/ai_parsed）
- created_at, updated_at, completed_at: 时间戳

### weekly_reviews（周报确认表）
- 记录每周事项确认情况

### item_history（事项变更历史）
- 记录事项字段变更历史

## 业务目标配置

### 采购供应链
- 后端毛利：全年18% Q1≤15% Q2≤16.5% Q3≤18% Q4≥19%
- 物流费用率：Q1≤6.5% Q2/Q3≤5.5% Q4≤5%

### 招商
- 新增加盟店：全年 275 家

### 质量
- 产品反馈率：≤0.03%
- 外源性异物率：≤0.0015%

### 工程
- 横向支持部门，不设置明确业务目标

## 功能特性

### 看板视图
- 按部门模块化展示
- 业务目标置顶显示
- 分类展示：逾期 → 本周 → 下周
- 支持快速操作：完成、删除、顺延

### 日历视图
- 按周展示，支持前后周切换
- PC 端适配，格子最大高度 280px
- 点击日期查看详情
- 部门统计卡片

### 文件上传
- 支持格式：.txt .md .xlsx .xls .csv .zip
- 自动解析事项、日期、部门
- zip 包批量导入

### 周报确认
- 每周首次访问弹窗
- 确认上周事项完成情况
- 支持完成、顺延、删除操作

## 开发规范
- 响应式布局，移动端和 PC 端友好
- 组件化开发，代码健壮性
- 版本管理，支持随时回滚
- 功能更新后及时修改 README

## CodeReview 清单
- **代码瘦身**: 检查冗余代码、未使用变量、重复逻辑
- **文件瘦身**: 检查过大的单文件、无用文件、临时文件残留
- **风险排查**: 检查安全隐患、错误处理、性能瓶颈、依赖版本

## 最近更新（2026-04-13）

### 功能优化
- ✅ PC 端日历视图适配优化（格子最大高度 280px）
- ✅ 提取公共配置和工具函数（departments.ts, date.ts）
- ✅ 清理未使用的示例文件
- ✅ 优化数据库插入性能（使用 WAL 模式）

### Bug 修复
- ✅ 修复文件上传错误提示"未知错误"问题
  - 问题：API 拦截器返回字符串，前端读取 `err.message` 导致取不到值
  - 修复：改为 `err || '未知错误'`
- ✅ 修复数据库调用方式不一致问题
  - 问题：upload.js 直接使用 `db.prepare()`，但 database.js 导出的是封装方法
  - 修复：统一使用 `get()`, `all()`, `run()` 方法
- ✅ 修复 Excel 表头空值导致的崩溃
  - 问题：`h.includes()` 在空值时报错
  - 修复：添加 `h && h.includes()` 检查
- ✅ 修复 Nginx 文件大小限制问题
  - 问题：上传 3.2MB 文件返回 413 错误
  - 修复：添加 `client_max_body_size 50m`

### 数据导入
- ✅ 成功导入真实数据（test.zip，包含 1.xlsx, 2.xlsx, 3.xlsx, 4.txt）
- ✅ 共导入 133 个事项，覆盖采购供应链、招商、质量、工程、综合管理五个部门

### CodeReview 问题修复（2026-04-13 23:59）
- ✅ 清理 uploads 目录临时文件（40MB）
- ✅ 移除 upload.js 调试日志
- ✅ 移除堆栈信息暴露（安全风险）
- ✅ 统一文件大小限制为 50MB（Nginx + upload.js）
- ✅ 优化部门查询性能（使用缓存避免重复查询）
- ✅ 移除未处理的 .docx 文件类型
- ✅ 改进临时文件清理错误处理

### 上传预览确认功能（2026-04-14 12:50）
- ✅ 新增上传预览流程：解析文件 → 显示预览 → 用户确认 → 导入数据库
- ✅ 新增 UploadPreview.vue 组件：显示解析结果，支持勾选确认
- ✅ 新增后端 `/api/upload/confirm` 接口：确认导入事项
- ✅ 修改 `/api/upload` 接口：仅解析文件，返回预览数据，不直接导入
- ✅ 支持全选/清空操作，避免误导入

### 功能优化与Bug修复（2026-04-14 22:53）
- ✅ **PC端页面宽度优化**：容器最大宽度扩展至1600px，支持2-4列响应式布局（xl:3列, 2xl:4列）
- ✅ **季度目标字体放大**：PC端目标标题使用lg/xl字体，季度格子使用sm字体，提升可读性
- ✅ **重复待办合并检测**：优化了相似度算法，支持中文分词、关键词匹配，导入前弹窗确认合并
- ✅ **部门目标配置文件化**：新增 `goals.json` 配置文件，支持动态读取目标设置
- ✅ **无季度目标显示全年目标**：当目标未配置季度值时，自动展示全年目标值
- ✅ **恢复添加日程按钮**：在看板和日历视图右下角添加蓝色浮动按钮，支持快速添加待办
- ✅ **待办弹窗组件化封装**：创建 `ItemDetailModal.vue` 统一组件，日历和看板视图共用，支持编辑标题和描述

### AI 智能解析功能（2026-04-14 20:50）
- ✅ 集成腾讯云 Token Plan API（OpenAI 兼容接口）
- ✅ 智能识别自然语言描述的工作事项
- ✅ 自动推断部门、优先级、截止日期
- ✅ 混合解析策略：规则解析优先，AI 智能补充（规则解析结果 < 3 个时触发 AI）
- ✅ 使用 `hunyuan-turbos` 模型（性价比高）
- ✅ 配置文件：`backend/.env`（TENCENT_SECRET_ID=sk-tp-xxx）