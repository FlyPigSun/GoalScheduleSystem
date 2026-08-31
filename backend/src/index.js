require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { initDatabase } = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3200;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/items', require('./routes/items'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/upload', require('./routes/upload'));

// 错误处理中间件
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: '文件大小超过限制（最大 5MB）' });
  }
  if (err.message?.includes('仅支持正式周报')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error('未处理的错误:', err);
  res.status(500).json({ success: false, message: '服务器内部错误' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendPath));

app.use((req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`服务已启动: http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('启动失败:', err);
    process.exit(1);
  });
}

module.exports = app;
