const express = require('express');
const router = express.Router();
const itemModel = require('../models/item');

// 获取看板数据
router.get('/dashboard', async (req, res) => {
  try {
    const weekOffset = parseInt(req.query.week) || 0;
    const data = await itemModel.getDashboard(weekOffset);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取时间线数据
router.get('/timeline', async (req, res) => {
  try {
    const weekOffset = parseInt(req.query.week) || 0;
    const data = await itemModel.getTimeline(weekOffset);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 获取周报确认列表
router.get('/weekly-review', async (req, res) => {
  try {
    const data = await itemModel.getWeeklyReviewItems();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 提交周报确认
router.post('/weekly-review', async (req, res) => {
  try {
    const { reviews } = req.body;
    await itemModel.submitWeeklyReview(reviews);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 输入验证工具函数
function validateItem(data, isCreate = true) {
  const errors = [];
  
  if (isCreate && !data.title?.trim()) {
    errors.push('标题不能为空');
  }
  
  if (data.title && data.title.length > 50) {
    errors.push('标题不能超过50字');
  }
  
  if (data.description && data.description.length > 200) {
    errors.push('描述不能超过200字');
  }
  
  if (data.priority && !['P0', 'P1', 'P2'].includes(data.priority)) {
    errors.push('优先级必须是 P0、P1 或 P2');
  }
  
  if (data.status && !['pending', 'in_progress', 'completed'].includes(data.status)) {
    errors.push('状态必须是 pending、in_progress 或 completed');
  }
  
  if (data.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.due_date)) {
    errors.push('日期格式必须为 YYYY-MM-DD');
  }
  
  return errors;
}

function validateId(id) {
  const num = parseInt(id, 10);
  return !isNaN(num) && num > 0;
}

// CRUD
router.get('/', async (req, res) => {
  try {
    const items = await itemModel.getItems(req.query);
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!validateId(req.params.id)) {
      return res.status(400).json({ success: false, error: '无效的ID参数' });
    }
    const item = await itemModel.getItem(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: '事项不存在' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const errors = validateItem(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: errors.join('；') });
    }
    const item = await itemModel.createItem(req.body);
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!validateId(req.params.id)) {
      return res.status(400).json({ success: false, error: '无效的ID参数' });
    }
    const errors = validateItem(req.body, false);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, error: errors.join('；') });
    }
    const item = await itemModel.updateItem(req.params.id, req.body);
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!validateId(req.params.id)) {
      return res.status(400).json({ success: false, error: '无效的ID参数' });
    }
    await itemModel.deleteItem(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/postpone', async (req, res) => {
  try {
    if (!validateId(req.params.id)) {
      return res.status(400).json({ success: false, error: '无效的ID参数' });
    }
    const { due_date } = req.body;
    if (!due_date || !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      return res.status(400).json({ success: false, error: '日期格式必须为 YYYY-MM-DD' });
    }
    const item = await itemModel.postponeItem(req.params.id, due_date);
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
