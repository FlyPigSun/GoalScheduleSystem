const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseBoardSync } = require('../utils/boardSyncParser');
const { syncWeeklyItems } = require('../models/weeklySync');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(ext === '.md' ? null : new Error('仅支持正式周报 Markdown 文件'), ext === '.md');
  }
});

router.post('/', upload.single('file'), async (req, res) => {
  let filePath;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: '请选择正式周报 Markdown 文件' });
    filePath = req.file.path;
    const markdown = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseBoardSync(markdown, req.file.originalname);
    const summary = await syncWeeklyItems(parsed, req.file.originalname);
    res.json({
      success: true,
      message: `${summary.reportWeek} 同步完成`,
      data: { summary, parsed: parsed.items.length }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || '周报同步失败' });
  } finally {
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});

router.post('/confirm', (_req, res) => {
  res.status(410).json({ success: false, message: '预览确认流程已停用，请直接上传正式周报' });
});

router.use((error, _req, res, _next) => {
  res.status(400).json({ success: false, message: error.message || '上传失败' });
});

module.exports = router;
