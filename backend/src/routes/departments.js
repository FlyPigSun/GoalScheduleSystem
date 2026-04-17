const express = require('express');
const router = express.Router();
const { all } = require('../models/database');

router.get('/', async (req, res) => {
  try {
    const departments = await all('SELECT * FROM departments ORDER BY sort_order ASC');
    res.json({ success: true, data: departments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
