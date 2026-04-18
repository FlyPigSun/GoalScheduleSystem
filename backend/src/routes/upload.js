require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const AdmZip = require('adm-zip');
const { get, all, run } = require('../models/database');
const { parseWithAI } = require('../utils/aiParser');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.md', '.xlsx', '.xls', '.csv', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  const patterns = [
    /(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})/,
    /(\d{1,2})[月/-](\d{1,2})/,
    /(\d{1,2})\/(\d{1,2})/
  ];
  
  for (const pattern of patterns) {
    const match = dateStr.match(pattern);
    if (match) {
      const year = match[1].length === 4 ? match[1] : new Date().getFullYear();
      const month = String(match[2]).padStart(2, '0');
      const day = String(match[3] || match[2]).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  const excelDate = xlsx.SSF.parse_date_code(dateStr);
  if (excelDate) {
    return `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
  }
  
  return null;
}

// 规则解析已弃用，直接使用 AI 解析

async function extractItemsFromExcel(filePath) {
  const items = [];
  const workbook = xlsx.readFile(filePath);
  
  // 缓存部门查询结果
  const deptCache = {};
  const deptMap = {
    '采购': '采购供应链', '供应链': '采购供应链', '仓配': '采购供应链',
    '招商': '招商', '加盟': '招商',
    '质量': '质量', '品控': '质量',
    '工程': '工程', '装修': '工程'
  };
  
  for (const [key, dept] of Object.entries(deptMap)) {
    if (!deptCache[dept]) {
      const deptRow = await get('SELECT id FROM departments WHERE name = ?', dept);
      if (deptRow) deptCache[dept] = deptRow.id;
    }
  }
  
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (data.length < 2) continue;
    
    const headers = data[0].map(h => String(h || '').toLowerCase());
    const titleIndex = headers.findIndex(h => h && h.includes('事项') || h && h.includes('目标') || h && h.includes('任务'));
    const dateIndex = headers.findIndex(h => h && h.includes('时间') || h && h.includes('日期') || h && h.includes('截止'));
    const deptIndex = headers.findIndex(h => h && h.includes('部门') || h && h.includes('板块') || h && h.includes('分类'));
    const priorityIndex = headers.findIndex(h => h && h.includes('优先级') || h && h.includes('重要'));
    const statusIndex = headers.findIndex(h => h && h.includes('状态') || h && h.includes('进度'));
    
    if (titleIndex === -1) continue;
    
    for (const row of data.slice(1)) {
      if (!row[titleIndex]) continue;
      
      const item = {
        title: String(row[titleIndex]).trim().slice(0, 50),
        description: String(row[titleIndex] || '').trim().slice(0, 200),
        due_date: dateIndex >= 0 ? parseDate(String(row[dateIndex] || '')) : null,
        department_id: 5,
        priority: 'P1'
      };
      
      if (priorityIndex >= 0) {
        const p = String(row[priorityIndex] || '');
        item.priority = p.includes('P0') ? 'P0' : p.includes('P1') ? 'P1' : 'P2';
      }
      
      if (deptIndex >= 0) {
        const deptName = String(row[deptIndex] || '');
        for (const [key, dept] of Object.entries(deptMap)) {
          if (deptName.includes(key)) {
            if (deptCache[dept]) item.department_id = deptCache[dept];
            break;
          }
        }
      }
      
      items.push(item);
    }
  }
  
  return items;
}

// 上传并解析文件（不插入数据库，仅返回预览数据）
router.post('/', upload.single('file'), async (req, res) => {
  // 设置请求超时保护（90秒）
  req.setTimeout(90000);
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的文件' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let items = [];
    let processedFiles = [];

    // 查询所有部门数据
    const departments = await all('SELECT * FROM departments');

    if (ext === '.zip') {
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();
      const tempDir = path.join(__dirname, '..', '..', 'uploads', 'temp_' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;
        const entryName = entry.entryName.toLowerCase();
        if (!['.txt', '.md', '.xlsx', '.xls', '.csv'].includes(path.extname(entryName))) continue;

        const content = entry.getData();
        const tempPath = path.join(tempDir, path.basename(entry.entryName));
        fs.writeFileSync(tempPath, content);
        processedFiles.push(tempPath);

        const fileExt = path.extname(entryName);
        if (['.txt', '.md'].includes(fileExt)) {
          const text = fs.readFileSync(tempPath, 'utf-8');
          const aiItems = await parseWithAI(text, departments);
          if (aiItems && aiItems.length > 0) {
            items = items.concat(aiItems);
          }
        } else if (['.xlsx', '.xls', '.csv'].includes(fileExt)) {
          const excelItems = await extractItemsFromExcel(tempPath);
          const excelText = excelItems.map(item => 
            `标题: ${item.title}, 描述: ${item.description || '无'}, 部门: ${item.department_id || '未知'}, 截止日期: ${item.due_date || '未知'}`
          ).join('\n');
          const aiItems = await parseWithAI(excelText, departments);
          if (aiItems && aiItems.length > 0) {
            items = items.concat(aiItems);
          }
        }
      }

      for (const f of processedFiles) {
        try { fs.unlinkSync(f); } catch (e) { console.error('清理临时文件失败:', f); }
      }
      try { fs.rmdirSync(tempDir); } catch (e) {}
    } else {
      if (['.txt', '.md'].includes(ext)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const aiItems = await parseWithAI(content, departments);
        if (aiItems && aiItems.length > 0) {
          items = aiItems;
        }
      } else if (['.xlsx', '.xls', '.csv'].includes(ext)) {
        const excelItems = await extractItemsFromExcel(filePath);
        const excelText = excelItems.map(item => 
          `标题: ${item.title}, 描述: ${item.description || '无'}, 部门: ${item.department_id || '未知'}, 截止日期: ${item.due_date || '未知'}`
        ).join('\n');
        const aiItems = await parseWithAI(excelText, departments);
        if (aiItems && aiItems.length > 0) {
          items = aiItems;
        }
      }
    }

    // 清理上传的文件
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('删除上传文件失败:', err.message);
    }

    // 获取部门名称映射
    const deptMap = {};
    departments.forEach(d => { deptMap[d.id] = d.name; });

    // AI 解析失败检测
    const hasAIParsingError = items.length === 0 && (ext === '.txt' || ext === '.md' || ext === '.zip');
    if (hasAIParsingError) {
      return res.status(500).json({
        success: false,
        message: 'AI 解析失败：服务繁忙或超时，请稍后重试',
        data: { total: 0, items: [] }
      });
    }

    // 为每个事项添加部门名称
    const itemsWithDept = items.map((item, index) => ({
      ...item,
      tempId: index,
      department_name: deptMap[item.department_id] || '综合管理'
    }));

    res.json({
      success: true,
      message: `成功解析 ${items.length} 个事项`,
      data: {
        total: items.length,
        items: itemsWithDept
      }
    });

  } catch (error) {
    console.error('上传解析错误:', error.message);

    // 处理 multer 错误
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件大小超过限制（最大 50MB）' });
    }

    res.status(500).json({ success: false, message: '文件解析失败: ' + error.message });
  }
});

// 确认导入事项
router.post('/confirm', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '请提供要导入的事项' });
    }

    const insertedItems = [];
    for (const item of items) {
      try {
        const result = await run(
          `INSERT INTO items (title, description, due_date, department_id, priority, status, original_due_date, postpone_count)
           VALUES (?, ?, ?, ?, ?, 'in_progress', ?, 0)`,
          [item.title, item.description, item.due_date, item.department_id, item.priority, item.due_date]
        );
        insertedItems.push({ ...item, id: result.id });
      } catch (err) {
        console.error('插入失败:', err.message);
      }
    }

    res.json({
      success: true,
      message: `成功导入 ${insertedItems.length} 个事项`,
      data: {
        total: items.length,
        inserted: insertedItems.length
      }
    });

  } catch (error) {
    console.error('确认导入错误:', error.message);
    res.status(500).json({ success: false, message: '导入失败: ' + error.message });
  }
});

module.exports = router;
