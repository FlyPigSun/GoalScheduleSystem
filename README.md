# GoalScheduleSystem

孙北北面包 - 目标日程管理系统。

**访问地址**：http://47.116.200.214/GoalScheduleSystem/

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express + SQLite3 |
| 前端 | Vue3 + Vite + TailwindCSS + Pinia |
| AI | 腾讯云 hunyuan-turbos |
| 部署 | Nginx + PM2 |

---

## 项目结构

```
GoalScheduleSystem/
├── backend/              # 后端服务
│   ├── src/
│   │   ├── routes/       # API 路由
│   │   ├── models/       # 数据模型
│   │   ├── utils/        # 工具函数
│   │   └── index.js      # 服务入口
│   ├── uploads/          # 文件上传临时目录
│   └── database/         # SQLite 数据库
├── frontend/             # 前端应用
│   ├── src/
│   │   ├── views/        # 页面视图
│   │   ├── components/   # 组件
│   │   ├── config/       # 配置（部门、目标）
│   │   ├── stores/       # Pinia 状态管理
│   │   └── api/          # API 封装
│   └── dist/             # 构建产物
├── docs/
│   └── modules/          # 模块说明文档 ← 各模块核心逻辑详见此处
├── deploy.sh             # 一键部署脚本
└── README.md             # 本文件
```

---

## 功能模块

| 模块 | 简介 | 详细说明 |
|------|------|----------|
| **数据层** | SQLite 数据库连接、表结构定义、WAL 模式管理 | [docs/modules/DataLayer.md](docs/modules/DataLayer.md) |
| **任务管理** | 任务的 CRUD、顺延、软删除、变更历史记录 | [docs/modules/ItemManagement.md](docs/modules/ItemManagement.md) |
| **多视图展示** | 看板/日历/时间轴三视图，手势滑动切换 | [docs/modules/MultiViewDisplay.md](docs/modules/MultiViewDisplay.md) |
| **周报导入** | 上传 zip/txt/xlsx → AI 解析 → 预览编辑 → 导入 | [docs/modules/WeeklyReportImport.md](docs/modules/WeeklyReportImport.md) |
| **重复检测** | AI + 规则双模式检测任务重复，支持内部重复和与已有任务比对 | [docs/modules/DuplicateDetection.md](docs/modules/DuplicateDetection.md) |
| **每周回顾** | 每周首次访问弹窗，对上周事项完成/顺延/删除确认 | [docs/modules/WeeklyReview.md](docs/modules/WeeklyReview.md) |
| **部门与目标** | 部门配置管理、各部门年度/季度目标展示 | [docs/modules/DepartmentGoals.md](docs/modules/DepartmentGoals.md) |

---

## 快速启动

### 环境要求
- Node.js ≥ 18
- SQLite3

### 安装依赖
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 本地开发
```bash
# 启动后端（端口 3200）
cd backend && npm run dev

# 启动前端（端口 3201）
cd frontend && npm run dev
```

### 部署
```bash
./deploy.sh
```

部署流程：`git commit` → `git push` → `./deploy.sh` → 自动同步到云端。

> 详细部署说明见 [DEPLOY.md](DEPLOY.md)。
