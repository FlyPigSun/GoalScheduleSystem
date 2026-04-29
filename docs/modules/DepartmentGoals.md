# 部门与目标管理模块

## 职责
管理部门配置（名称、图标、颜色）和各部门的业务目标展示（年度目标 + 季度分解）。

## 核心文件
| 文件 | 说明 |
|------|------|
| `backend/src/routes/departments.js` | 部门列表查询 API |
| `frontend/src/config/departments.ts` | 部门配置常量 + 目标加载逻辑 |
| `frontend/src/config/goals.json` | 各部门目标数据（可手动编辑） |

## 关键逻辑

### 1. 部门配置（departments.ts）

**DEPARTMENTS 常量**
| ID | 名称 | slug | 图标 | 颜色 |
|----|------|------|------|------|
| 1 | 采购供应链 | supply | 📦 | #2563eb |
| 2 | 招商 | invest | 🤝 | #7c3aed |
| 3 | 质量 | quality | ✅ | #059669 |
| 4 | 工程 | engineering | 🏗️ | #d97706 |
| 5 | 综合管理 | general | 📊 | #6b7280 |

- 提供 `getDeptConfig(id)`、`getDeptColor(id)`、`getDeptBg(id)`、`getDeptDot(id)` 工具函数
- Dashboard.vue 中使用这些颜色渲染部门卡片色条和任务标签

### 2. 目标配置（goals.json）

**结构**：
```json
{
  "goals": {
    "1": [ /* 采购供应链的目标数组 */ ],
    "2": [ /* 招商的目标数组 */ ],
    ...
  }
}
```

**目标字段**：
- `label`：目标名称（如"后端毛利"）
- `value`：年度目标值（如"≥18%"）
- `bgClass` / `textClass` / `valueClass`：Tailwind 样式类
- `quarters`：Q1-Q4 季度分解值
- `showYearlyOnly`：无 quarters 时只显示年度值

**当前配置**：
- 采购供应链（id:1）：后端毛利、物流费用率
- 招商（id:2）：新增加盟店
- 质量（id:3）：产品反馈率、外源性异物率
- 工程（id:4）：空数组（暂无目标）
- 综合管理（id:5）：空数组（暂无目标）

### 3. 目标加载逻辑（departments.ts）
- `loadDepartmentGoals()` 读取 goals.json，构建 `Record<number, GoalDef[]>`
- `getDeptGoals(id)` 获取指定部门的目标列表
- 若目标无 quarters 属性，返回时剔除 quarters 字段（前端只展示年度值）

### 4. 后端 API（departments.js）
- `GET /departments`：返回部门列表（按 sort_order 排序）
- 数据库 departments 表与前端 DEPARTMENTS 常量需保持一致

### 5. 前端展示（Dashboard.vue）
- 每个部门卡片顶部展示目标区域
- 目标卡片：左侧 label，右侧年度值，下方 Q1-Q4 四格
- 样式通过 goals.json 中配置的 Tailwind 类动态应用

## 数据流
```
goals.json（静态配置）
    ↓
departments.ts 加载 → DEPARTMENT_GOALS
    ↓
Dashboard.vue 渲染时调用 getDeptGoals(dept.id)
    ↓
按部门展示目标卡片（年度值 + 季度分解）
```

## 注意事项
- goals.json 是纯静态配置，修改后需重新构建前端并部署
- 部门 ID 是硬编码的（1-5），前后端需保持一致
- 新增部门需要同时修改：数据库初始化、DEPARTMENTS 常量、goals.json
- 目标样式类（bgClass/textClass/valueClass）使用 Tailwind 预定义类，需确保类名在构建时可用
