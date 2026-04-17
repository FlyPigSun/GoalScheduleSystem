# GoalScheduleSystem CodeReview 报告

**审查时间**: 2026-04-14  
**审查人**: AI Assistant  

---

## 一、代码瘦身

### 1.1 未使用的文件/组件

| 文件路径 | 状态 | 建议 |
|---------|------|------|
| `frontend/src/components/ItemDetailModal.vue` | ⚠️ 冗余 | Timeline.vue 中声明了 `detailItem` 但未正确使用该组件，实际使用 ItemList 的内嵌弹窗。建议删除或保留作为未来扩展 |
| `backend/tests/*.test.js` | ✅ 保留 | 测试文件，需要保留但建议定期运行 |

### 1.2 未使用的变量/函数

**前端:**

| 文件 | 未使用项 | 建议 |
|-----|---------|------|
| `CalendarView.vue` | 第69行：`onUnmounted` 已导入但未使用 | 移除导入 |
| `Timeline.vue` | 第127行：`detailItem` ref 声明但未正确传递给 ItemDetailModal | 删除未使用代码 |
| `stores/app.ts` | `getWeekLabel` 函数 | 当前未使用，可保留作为工具函数 |

**后端:**

| 文件 | 未使用项 | 建议 |
|-----|---------|------|
| `upload.js` | 第9行：`{ run }` 已解构但未使用 | 移除 `run` |
| `item.js` | `getWeekEnd` 导出但未在其他地方使用 | 可保留作为工具函数 |

### 1.3 重复代码

| 位置 | 描述 | 建议 |
|-----|------|------|
| `date.ts` vs `stores/app.ts` | 都有 `getDaysUntil`, `formatDate` 等函数 | 已正确分离，store 调用 utils，无需修改 |
| `CalendarView.vue` vs `Timeline.vue` | 都有 `formatDateStr`, `isOverdue` 等日期逻辑 | 已复用 utils/date.ts，无需修改 |

---

## 二、文件瘦身

### 2.1 文件大小检查

| 文件 | 行数 | 状态 |
|-----|------|------|
| `backend/src/routes/upload.js` | 311行 | ✅ 正常 |
| `backend/src/models/item.js` | 285行 | ✅ 正常 |
| `frontend/src/components/UploadPreview.vue` | 500+行 | ⚠️ 较大，但逻辑复杂，可接受 |

### 2.2 临时文件检查

| 路径 | 状态 | 建议 |
|-----|------|------|
| `backend/uploads/` | ✅ 正常使用 | 程序会自动清理，无需处理 |
| `backend/database/` | ✅ 正常 | 数据库存储目录 |

### 2.3 依赖清理建议

**后端 package.json:**

```json
{
  "dependencies": {
    "axios": "^1.15.0"    // ⚠️ 检查是否被使用，可能只在测试中使用
  }
}
```

**检查命令:**
```bash
cd /Users/sunji/Desktop/Project/GoalScheduleSystem/backend
grep -r "require('axios')" --include="*.js" src/
```

---

## 三、风险排查

### 3.1 安全隐患

| 位置 | 风险 | 等级 | 建议 |
|-----|------|-----|------|
| `upload.js:31-39` | 文件类型白名单检查 | ✅ 已处理 | 使用了白名单验证，安全 |
| `upload.js:30` | 文件大小限制 50MB | ✅ 已处理 | 合理限制 |
| `database.js:100-124` | SQL 注入风险 | ✅ 已处理 | 使用参数化查询，安全 |
| `index.html` | 缓存控制 | ✅ 已处理 | 已添加 no-cache meta 标签 |

### 3.2 错误处理

| 位置 | 状态 | 建议 |
|-----|------|------|
| `items.js` | ✅ 统一错误处理 | 所有路由都有 try-catch |
| `upload.js` | ✅ 详细错误信息 | 返回用户友好的错误消息 |
| `item.js` | ✅ 数据验证 | updateItem 检查字段变更 |

### 3.3 性能问题

| 位置 | 问题 | 建议 |
|-----|------|------|
| `item.js:143-191` | `getDashboard` 5个并行查询 | ✅ 已使用 Promise.all，性能良好 |
| `upload.js:71-137` | Excel 解析逐行处理 | ✅ 数据量小，当前实现可接受 |
| `frontend` | 组件重新渲染 | ✅ 无明显的性能问题 |

### 3.4 依赖版本

**后端依赖检查:**

| 依赖 | 当前版本 | 最新版本 | 建议 |
|-----|---------|---------|------|
| `express` | ^5.2.1 | 5.x | ✅ 最新 |
| `sqlite3` | ^6.0.1 | 5.x | ⚠️ 注意：6.x 是预发布版本，建议降级到 5.x |
| `dotenv` | ^17.4.2 | 16.x | ⚠️ 版本号错误，应为 16.x |
| `axios` | ^1.15.0 | 1.x | ✅ 检查是否使用 |

**前端依赖检查:**

| 依赖 | 当前版本 | 状态 |
|-----|---------|------|
| `vue` | ^3.5.32 | ✅ 最新 |
| `tailwindcss` | ^4.2.2 | ✅ 最新 |
| `pinia` | ^3.0.4 | ⚠️ 建议移到 dependencies |
| `vue-router` | ^4.6.4 | ⚠️ 建议移到 dependencies |

---

## 四、清理建议汇总

### 立即执行（低风险）

1. **修复 package.json 版本号**
   ```json
   "dotenv": "^16.4.2"  // 从 17.4.2 改为 16.4.2
   ```

2. **移动运行时依赖**
   ```json
   // 从 devDependencies 移到 dependencies
   "pinia": "^3.0.4"
   "vue-router": "^4.6.4"
   ```

3. **移除未使用的导入**
   - `upload.js` 第9行：移除未使用的 `run`
   - `CalendarView.vue` 第295行：移除未使用的 `onUnmounted`

### 可选执行

4. **删除冗余组件**
   - `ItemDetailModal.vue` 当前未被使用，但设计良好，建议保留或删除

5. **检查 axios 使用**
   - 如果只在测试中使用，移到 devDependencies

6. **降级 sqlite3**
   - 从 6.x 降级到 5.x（稳定版本）

---

## 五、快速修复命令

```bash
# 1. 修复后端依赖
cd /Users/sunji/Desktop/Project/GoalScheduleSystem/backend
npm uninstall dotenv sqlite3
npm install dotenv@^16.4.2 sqlite3@^5.1.7

# 2. 修复前端依赖
cd /Users/sunji/Desktop/Project/GoalScheduleSystem/frontend
npm uninstall pinia vue-router
npm install pinia@^3.0.4 vue-router@^4.6.4

# 3. 重新构建
cd /Users/sunji/Desktop/Project/GoalScheduleSystem/frontend
npm run build
```

---

## 六、总结

| 检查项 | 状态 |
|-------|------|
| 代码瘦身 | ✅ 良好，少量未使用代码 |
| 文件瘦身 | ✅ 良好，无大文件问题 |
| 安全隐患 | ✅ 良好，已做好防护 |
| 错误处理 | ✅ 良好，统一处理 |
| 依赖版本 | ⚠️ 需要修复版本号 |

**整体评价**: 代码结构清晰，安全防护措施到位，主要问题是依赖版本号有误，建议尽快修复。
