# 重复检测模块

## 职责
在周报导入流程中检测任务重复：包括上传文件内部的重复项，以及与数据库已有任务的重复。

## 核心文件
| 文件 | 说明 |
|------|------|
| `backend/src/routes/duplicates.js` | 重复检测 API（AI + 规则双模式） |
| `frontend/src/components/DuplicateCheckModal.vue` | 重复检测结果展示弹窗 |

## 关键逻辑

### 1. 两种检测场景

**场景 A：上传文件内部重复检测**
- 路由：`POST /duplicates/detect`
- 目的：同一文件内解析出的任务，可能存在表述不同但实质相同的项

**场景 B：与数据库已有任务重复检测**
- 路由：`POST /duplicates/check-existing`
- 目的：防止重复导入已存在的任务

### 2. AI 检测模式（优先）

**detectDuplicatesByAI(items)**
- 将任务列表简化表示：`[0] 任务标题 (部门)`
- 调用腾讯云 hunyuan-turbos，temperature=0.1（低温度确保稳定）
- Prompt 明确判断标准：
  - 完全相同 → 重复
  - 表述差异但同一件事（如"现烤品损耗管控"vs"现烤面包损耗管理"）→ 重复
  - 不同项目（A vs B）→ 不重复
- 返回格式要求：JSON 数组 `[[0, 2], [3, 5, 7]]`
- 提取 JSON 并解析，失败时回退到规则检测

**detectDuplicatesWithExistingByAI(newItems, existingItems)**
- 新任务分批处理（batchSize=10），避免 prompt 过长
- 新任务标记 `N0, N1...`，已有任务标记 `E{id}`
- 返回格式：`[{newIndex, existingId}]`
- 去重：一个 newItem 只匹配一个 existingItem（processedTempIds 集合）

### 3. 规则检测模式（回退）

**detectDuplicatesByRule(items)**
- O(n²) 两两比较
- 归一化标题：小写、去空格、去中文标点
- 相似度判断：
  - 完全相等 → 重复
  - 包含关系（短标题长度/长标题长度 ≥ 0.6）→ 重复
  - Jaccard 关键词相似度 ≥ 0.75 → 重复
- 关键词提取：中文 2-6 字词、英文单词、数字，过滤停用词

**detectDuplicatesWithExistingByRule(newItems, existingItems)**
- 遍历新任务，与所有已有任务逐一比较
- 使用同样的 `isSimilarByRule` 函数
- 一个 newItem 找到第一个匹配即停止

### 4. 前端展示（DuplicateCheckModal.vue）
- 红色高亮显示重复组
- 每组保留一个，其余可一键跳过
- 无弹窗打断，列表内直接操作

## 数据流
```
UploadPreview.vue 点击"下一步"
    ↓
先调 POST /duplicates/detect（内部重复）
    ↓
有重复 → DuplicateCheckModal 展示，用户选择去重
    ↓
再调 POST /duplicates/check-existing（与数据库重复）
    ↓
有重复 → 红色高亮，用户可跳过
    ↓
最终确认导入
```

## 注意事项
- AI 模式优先，失败自动回退到规则模式，保证可用性
- 规则模式的 Jaccard 阈值 0.75 略低于前端阈值，目的是捕获更多潜在重复
- 与已有任务检测只比对 status IN ('pending', 'in_progress') 的未完成项
- 分批处理（batchSize=10）是为了控制 prompt 长度和 API 稳定性
