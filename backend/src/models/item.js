const { run, all, get } = require('./database');

function formatDate(date) {
  if (!date) return null;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date(date).toISOString().split('T')[0];
}

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return formatDate(d);
}

function getWeekEnd(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 7);
  return formatDate(d);
}

async function createItem(data) {
  const { title, description, due_date, priority, category, department_id, source } = data;
  const dueDate = formatDate(due_date);
  const result = await run(
    `INSERT INTO items (title, description, due_date, original_due_date, priority, category, department_id, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description || '', dueDate, dueDate, priority || 'P1', category || '', department_id || null, source || 'manual']
  );
  return getItem(result.id);
}

async function getItem(id) {
  return get(
    `SELECT i.*, d.name as department_name FROM items i
     LEFT JOIN departments d ON i.department_id = d.id
     WHERE i.id = ? AND i.status != 'deleted'`, [id]
  );
}

async function getItems(filters = {}) {
  const { status, department_id, priority, due_before, due_after, week_start, search } = filters;
  let sql = `SELECT i.*, d.name as department_name FROM items i
             LEFT JOIN departments d ON i.department_id = d.id
             WHERE i.status != 'deleted'`;
  const params = [];

  if (status && status !== 'all') {
    if (Array.isArray(status)) {
      const placeholders = status.map(() => '?').join(',');
      sql += ` AND i.status IN (${placeholders})`;
      params.push(...status);
    } else {
      sql += ` AND i.status = ?`;
      params.push(status);
    }
  }
  if (department_id) {
    sql += ` AND i.department_id = ?`;
    params.push(department_id);
  }
  if (priority) {
    sql += ` AND i.priority = ?`;
    params.push(priority);
  }
  if (due_before) {
    sql += ` AND i.due_date <= ?`;
    params.push(formatDate(due_before));
  }
  if (due_after) {
    sql += ` AND i.due_date >= ?`;
    params.push(formatDate(due_after));
  }
  if (search) {
    sql += ` AND (i.title LIKE ? OR i.description LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ` ORDER BY i.priority ASC, i.due_date ASC, i.created_at DESC`;
  return all(sql, params);
}

async function updateItem(id, data) {
  const item = await get('SELECT * FROM items WHERE id = ?', [id]);
  if (!item) throw new Error('事项不存在');

  const fields = ['title', 'description', 'due_date', 'priority', 'category', 'department_id', 'status'];
  const updates = [];
  const params = [];

  for (const field of fields) {
    if (data[field] !== undefined && data[field] !== item[field]) {
      const oldVal = item[field];
      let newVal = data[field];
      if (field === 'due_date') newVal = formatDate(newVal);
      updates.push({ field, oldVal, newVal });
      params.push(newVal);
    }
  }

  if (updates.length === 0) return getItem(id);

  let setClauses = updates.map(u => `${u.field} = ?`).join(', ');
  if (data.status === 'completed') {
    setClauses += ', completed_at = datetime("now","localtime")';
  }
  setClauses += ', updated_at = datetime("now","localtime")';
  params.push(id);

  await run(`UPDATE items SET ${setClauses} WHERE id = ?`, params);

  for (const u of updates) {
    await run(
      `INSERT INTO item_history (item_id, field, old_value, new_value) VALUES (?, ?, ?, ?)`,
      [id, u.field, String(u.oldVal), String(u.newVal)]
    );
  }

  return getItem(id);
}

async function deleteItem(id) {
  await run(`UPDATE items SET status = 'deleted', updated_at = datetime('now','localtime') WHERE id = ?`, [id]);
}

async function postponeItem(id, newDueDate) {
  const item = await get('SELECT * FROM items WHERE id = ?', [id]);
  if (!item) throw new Error('事项不存在');

  const newDate = formatDate(newDueDate);
  await run(
    `UPDATE items SET due_date = ?, postpone_count = postpone_count + 1, updated_at = datetime('now','localtime') WHERE id = ?`,
    [newDate, id]
  );
  await run(
    `INSERT INTO item_history (item_id, field, old_value, new_value) VALUES (?, ?, ?, ?)`,
    [id, 'due_date', item.due_date, newDate]
  );
  return getItem(id);
}

async function getDashboard(weekOffset = 0) {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + weekOffset * 7);
  const weekStart = getWeekStart(targetDate);
  const weekEnd = getWeekEnd(targetDate);
  const nextWeekStart = formatDate(new Date(weekEnd));
  const nextWeekEnd = formatDate(new Date(new Date(weekEnd).getTime() + 7 * 86400000));
  const monthEnd = formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [upcoming, currentWeek, nextWeek, thisMonth, overdue] = await Promise.all([
    all(`SELECT i.*, d.name as department_name FROM items i
        LEFT JOIN departments d ON i.department_id = d.id
        WHERE i.status IN ('pending','in_progress')
        AND i.due_date BETWEEN ? AND ?
        ORDER BY i.priority ASC, i.due_date ASC`,
      [formatDate(now), weekEnd]),

    all(`SELECT i.*, d.name as department_name FROM items i
        LEFT JOIN departments d ON i.department_id = d.id
        WHERE i.status IN ('pending','in_progress')
        AND i.due_date BETWEEN ? AND ?
        ORDER BY i.priority ASC, i.due_date ASC`,
      [weekStart, weekEnd]),

    all(`SELECT i.*, d.name as department_name FROM items i
        LEFT JOIN departments d ON i.department_id = d.id
        WHERE i.status IN ('pending','in_progress')
        AND i.due_date BETWEEN ? AND ?
        ORDER BY i.priority ASC, i.due_date ASC`,
      [nextWeekStart, nextWeekEnd]),

    all(`SELECT i.*, d.name as department_name FROM items i
        LEFT JOIN departments d ON i.department_id = d.id
        WHERE i.status IN ('pending','in_progress')
        AND i.due_date BETWEEN ? AND ?
        ORDER BY i.priority ASC, i.due_date ASC`,
      [formatDate(now), monthEnd]),

    all(`SELECT i.*, d.name as department_name FROM items i
        LEFT JOIN departments d ON i.department_id = d.id
        WHERE i.status IN ('pending','in_progress')
        AND i.due_date < ?
        ORDER BY i.priority ASC, i.due_date ASC`,
      [formatDate(now)])
  ]);

  return { upcoming, currentWeek, nextWeek, thisMonth, overdue, weekStart, weekEnd };
}

async function getTimeline(weekOffset = 0) {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + weekOffset * 7);
  const weekStart = getWeekStart(targetDate);
  const weekEnd = getWeekEnd(targetDate);

  const [active, completed] = await Promise.all([
    all(`SELECT i.*, d.name as department_name FROM items i
        LEFT JOIN departments d ON i.department_id = d.id
        WHERE i.status IN ('pending','in_progress')
        AND (i.due_date <= ? OR i.due_date BETWEEN ? AND ?)
        ORDER BY i.priority ASC, i.due_date ASC`,
      [weekEnd, weekStart, weekEnd]),

    all(`SELECT i.*, d.name as department_name FROM items i
        LEFT JOIN departments d ON i.department_id = d.id
        WHERE i.status = 'completed'
        AND i.completed_at BETWEEN ? AND ?
        ORDER BY i.completed_at DESC`,
      [weekStart, weekEnd + ' 23:59:59'])
  ]);

  return { active, completed, weekStart, weekEnd };
}

async function getWeeklyReviewItems() {
  const weekStart = getWeekStart();
  const reviewed = await get(
    `SELECT * FROM weekly_review_status WHERE week_start = ?`, [weekStart]
  );
  if (reviewed && reviewed.reviewed) return { reviewed: true, items: [] };

  const prevWeekStart = getWeekStart(new Date(Date.now() - 7 * 86400000));
  const prevWeekEnd = getWeekEnd(new Date(Date.now() - 7 * 86400000));

  const items = await all(
    `SELECT i.*, d.name as department_name FROM items i
     LEFT JOIN departments d ON i.department_id = d.id
     WHERE i.status IN ('pending','in_progress')
     AND i.due_date <= ?
     ORDER BY i.priority ASC, i.due_date ASC`,
    [prevWeekEnd]
  );

  return { reviewed: false, items, weekStart, prevWeekStart };
}

async function submitWeeklyReview(reviews) {
  const weekStart = getWeekStart();
  const prevWeekStart = getWeekStart(new Date(Date.now() - 7 * 86400000));

  for (const r of reviews) {
    const action = r.action;
    await run(
      `INSERT INTO weekly_reviews (item_id, week_start, action, note) VALUES (?, ?, ?, ?)`,
      [r.id, prevWeekStart, action, r.note || '']
    );

    if (action === 'completed') {
      await run(
        `UPDATE items SET status = 'completed', completed_at = datetime('now','localtime'),
         updated_at = datetime('now','localtime') WHERE id = ?`, [r.id]
      );
    } else if (action === 'postponed') {
      const newDue = formatDate(new Date(Date.now() + 7 * 86400000));
      await run(
        `UPDATE items SET due_date = ?, postpone_count = postpone_count + 1,
         updated_at = datetime('now','localtime') WHERE id = ?`, [newDue, r.id]
      );
      await run(
        `INSERT INTO item_history (item_id, field, old_value, new_value) VALUES (?, ?, ?, ?)`,
        [r.id, 'due_date_weekly', r.due_date, newDue]
      );
    } else if (action === 'deleted') {
      await deleteItem(r.id);
    }
  }

  await run(
    `INSERT OR REPLACE INTO weekly_review_status (week_start, reviewed, reviewed_at)
     VALUES (?, 1, datetime('now','localtime'))`, [weekStart]
  );

  return { success: true };
}

module.exports = {
  createItem, getItem, getItems, updateItem, deleteItem, postponeItem,
  getDashboard, getTimeline, getWeeklyReviewItems, submitWeeklyReview,
  getWeekStart, getWeekEnd
};
