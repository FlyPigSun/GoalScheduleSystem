# 孙北北面包 - 工作空间

联合创始人的业务系统管理中心，涵盖招商、筹建、供应链等模块。

## 已上线系统

### GoalScheduleSystem（目标日程管理系统）

**访问地址**：http://47.116.200.214/GoalScheduleSystem/

**管理部门**：采购供应链、招商、质量、工程

**核心功能**：
- 📤 **周报导入**：上传 zip/txt/xlsx → AI 智能解析 → 预览确认 → 导入日程
- 📅 **多视图管理**：日历视图 / 看板视图 / 时间轴视图，支持手势滑动切换
- ⚠️ **重复检测**：上传后实时检测与已有任务重复，红色高亮提示
- ✅ **每周回顾**：每周首次访问弹窗确认上周事项（完成/顺延/删除），顺延记录次数
- ✏️ **快捷编辑**：弹窗内直接修改标题、描述、截止日期、优先级、所属板块

**技术栈**：Node.js + Express + SQLite + Vue3 + TailwindCSS

**业务目标**：
- 后端毛利 ≥ 18%（Q1≥15% / Q2≥16.5% / Q3≥18% / Q4≥19%）
- 物流费用率 ≤ 5%
- 产品反馈率 ≤ 0.03%
- 外源性异物率 ≤ 0.0015%
- 新增加盟店 275 家

---

## 开发规范

### 项目结构
```
/Users/sunji/Desktop/Project/
├── GoalScheduleSystem/     # 目标日程管理系统
│   ├── backend/            # Node.js + Express 后端
│   ├── frontend/           # Vue3 + Vite 前端
│   └── deploy.sh           # 一键部署脚本
```

### 部署流程（铁律）
```
本地修改 → git commit → git push → ./deploy.sh → 自动同步到云端
```
- ✅ 允许：通过 deploy.sh 自动化部署
- ❌ 禁止：ssh 到服务器直接改代码、scp/rsync 手动同步
- ⚠️ 例外：.env、数据库、日志等 .gitignore 排除的文件可在服务器直接调整

### 开发原则
- 响应式布局，PC/手机双端适配
- 做好封装，避免单文件过大
- 实用导向，修改后用真实数据验证
- 功能更新后同步更新文档

---

## 关键配置

| 配置项 | 本地 | 云端 |
|--------|------|------|
| 访问地址 | `http://localhost:8080/GoalScheduleSystem/` | `http://47.116.200.214/GoalScheduleSystem/` |
| 后端端口 | 3200 | 3200 |
| Nginx 反代 | 8080 → 3200 | 80 → 3200 |
| 进程管理 | launchd | PM2 |
| 数据库 | `backend/database/goals.db` | `/var/www/GoalScheduleSystem/backend/database/goals.db` |

---

*创建时间：2026-04-13 | 最后更新：2026-04-24*
