# 周报导入模块

## 职责
支持上传 zip/txt/xlsx 等文件，通过 AI 智能解析提取任务事项，提供预览编辑和确认导入功能。

## 核心文件
| 文件 | 说明 |
|------|------|
| `backend/src/routes/upload.js` | 文件上传、解析、预览 API |
| `backend/src/utils/aiParser.js` | 腾讯云 hunyuan-turbos AI 解析封装 |
| `frontend/src/components/FileUpload.vue` | 文件上传触发组件 |
| `frontend/src/components/UploadPreview.vue` | 预览编辑弹窗（核心交互） |

## 关键逻辑

### 1. 文件上传（upload.js）
- **multer 配置**：磁盘存储到 `backend/uploads/`，50MB 限制
- **白名单**：`.txt`, `.md`, `.xlsx`, `.xls`, `.csv`, `.zip`
- **超时保护**：`req.setTimeout(90000)`，配合 Nginx 120s 超时

### 2. 文件处理流程
```
上传文件 → 判断类型
    ├── zip → 解压 → 遍历内部文件 → 并行解析（Promise.all）
    ├── txt/md → 直接读取文本 → AI 解析
    └── xlsx/xls/csv → Excel 解析 → 转文本 → AI 解析
```

**Excel 解析（extractItemsFromExcel）**
- 读取所有 sheet，识别标题行（包含"事项"/"目标"/"任务"/"时间"/"日期"/"截止"/"部门"/"优先级"等关键词）
- 按行提取：标题、描述、截止日期、部门、优先级
- 部门映射：采购/供应链/仓配 → 采购供应链；加盟 → 招商；质量/品控 → 质量；装修/工程 → 工程

### 3. AI 解析（aiParser.js）
- **API**：腾讯云 `lkeap.cloud.tencent.com`，模型 `hunyuan-turbos`
- **Prompt 设计**：
  - 传入部门列表供 AI 选择
  - 明确字段定义：title(50字)、description(200字)、department、priority(P0/P1/P2)、due_date(YYYY-MM-DD)
  - 部门推断规则：供应商/采购/包材/物流/毛利 → 采购供应链；加盟/门店拓展 → 招商；质量/异物/品控 → 质量；装修/工程/设备 → 工程；其他 → 综合管理
  - 日期推断："4月15日" → "2026-04-15"；"下周" → 推断具体日期
- **返回处理**：正则提取 JSON 数组，映射部门名称为 ID，失败返回 null
- **超时**：90s（小于 Nginx 120s）

### 4. 预览编辑（UploadPreview.vue）
- **列表展示**：每个解析出的任务一行，可勾选/取消勾选
- **快捷编辑**：点击标题/描述/优先级/部门直接 inline 编辑
- **日期设置**：无截止日期的任务标红警告，可单条或批量设置日期
- **全选/清空**：顶部操作按钮
- **下一步**：选中且全部有截止日期后，进入重复检测

### 5. 确认导入
- `POST /upload/confirm` 接收选中事项数组
- 逐条插入数据库：`status = 'in_progress'`, `source = 'ai_parsed'`
- 返回导入成功数量

## 数据流
```
用户选择文件 → FileUpload.vue
    ↓
POST /upload → multer 存盘 → 按类型解析
    ↓
txt/md: 直接读文本 → aiParser.parseWithAI()
xlsx: extractItemsFromExcel() → 转文本 → aiParser.parseWithAI()
zip: 解压 → 并行处理内部文件 → 合并结果
    ↓
返回 items 数组 → UploadPreview.vue 展示
    ↓
用户编辑/筛选/设置日期 → 点击"下一步"
    ↓
重复检测 → 确认导入 → POST /upload/confirm → 写入数据库
```

## 注意事项
- zip 内多文件并行解析（Promise.all）是性能优化关键，避免串行等待
- AI 解析失败有降级处理：返回空数组时前端显示"AI 解析失败"
- Excel 解析有独立逻辑，不依赖 AI，可作为 AI 失败时的兜底
- 上传文件解析后会立即删除临时文件，避免磁盘堆积
