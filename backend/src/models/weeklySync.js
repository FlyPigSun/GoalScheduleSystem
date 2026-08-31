const { run, all, get } = require('./database');
const { itemKey } = require('../utils/boardSyncParser');

async function backfillItemKeys() {
  const rows = await all(`SELECT i.id, i.title, d.name AS area
    FROM items i LEFT JOIN departments d ON i.department_id = d.id
    WHERE i.item_key IS NULL`);
  for (const row of rows) {
    const key = itemKey(row.area || '综合管理', row.title);
    const duplicate = await get('SELECT id FROM items WHERE item_key = ? AND id != ?', [key, row.id]);
    if (!duplicate) await run('UPDATE items SET item_key = ? WHERE id = ?', [key, row.id]);
  }
}

async function logChanges(itemId, existing, changes) {
  for (const [field, newValue] of Object.entries(changes)) {
    const oldValue = existing[field];
    if (String(oldValue ?? '') === String(newValue ?? '')) continue;
    await run(
      'INSERT INTO item_history (item_id, field, old_value, new_value) VALUES (?, ?, ?, ?)',
      [itemId, field, String(oldValue ?? ''), String(newValue ?? '')]
    );
  }
}

async function syncWeeklyItemsInternal(parsed, filename) {
  await run('BEGIN IMMEDIATE');
  try {
    await backfillItemKeys();
    const departments = await all('SELECT id, name FROM departments');
    const deptMap = new Map(departments.map(dept => [dept.name, dept.id]));
    const summary = { added: 0, updated: 0, closed: 0, skipped: 0, conflicts: 0 };

    for (const item of parsed.items) {
      const key = itemKey(item.area, item.title);
      const existing = await get('SELECT * FROM items WHERE item_key = ?', [key]);
      const departmentId = deptMap.get(item.area) || deptMap.get('综合管理') || 5;

      if (!existing) {
        if (item.status === 'deferred' || item.status === 'progress_only') {
          summary.skipped += 1;
          continue;
        }
        const completedAt = item.status === 'completed' ? new Date().toISOString() : null;
        await run(
          `INSERT INTO items
            (title, description, due_date, original_due_date, priority, department_id, status, source, item_key, owner, last_report_week, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?)`,
          [item.title, item.description || '来自正式周报', item.due_date, item.due_date, item.priority, departmentId,
            item.status, key, item.owner, parsed.reportWeek, completedAt]
        );
        summary.added += 1;
        if (item.status === 'completed') summary.closed += 1;
        continue;
      }

      if (existing.last_report_week && existing.last_report_week > parsed.reportWeek) {
        summary.skipped += 1;
        continue;
      }

      let targetStatus = item.status;
      if (item.status === 'progress_only') targetStatus = existing.status;
      if (existing.status === 'completed' && item.status === 'in_progress') {
        targetStatus = 'in_progress';
        summary.conflicts += 1;
      }

      const changes = {
        title: item.title,
        description: item.description ?? existing.description,
        due_date: item.due_date,
        priority: item.priority,
        department_id: departmentId,
        status: targetStatus,
        owner: item.owner,
        last_report_week: parsed.reportWeek
      };
      const changed = Object.entries(changes).some(([field, value]) => String(existing[field] ?? '') !== String(value ?? ''));
      if (!changed) {
        summary.skipped += 1;
        continue;
      }

      await logChanges(existing.id, existing, changes);
      await run(
        `UPDATE items SET title = ?, description = ?, due_date = ?, priority = ?, department_id = ?, status = ?,
         owner = ?, last_report_week = ?, completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, datetime('now','localtime')) ELSE NULL END,
         updated_at = datetime('now','localtime') WHERE id = ?`,
        [item.title, changes.description, item.due_date, item.priority, departmentId, targetStatus,
          item.owner, parsed.reportWeek, targetStatus, existing.id]
      );
      summary.updated += 1;
      if (['completed', 'deferred'].includes(targetStatus) && targetStatus !== existing.status) summary.closed += 1;
    }

    await run(
      `INSERT INTO weekly_sync_imports (report_week, filename, added, updated, completed, skipped, conflicts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [parsed.reportWeek, filename, summary.added, summary.updated, summary.closed, summary.skipped, summary.conflicts]
    );
    await run('COMMIT');
    return { reportWeek: parsed.reportWeek, ...summary };
  } catch (error) {
    try { await run('ROLLBACK'); } catch {}
    throw error;
  }
}

let syncQueue = Promise.resolve();
function syncWeeklyItems(parsed, filename) {
  const queued = syncQueue.then(() => syncWeeklyItemsInternal(parsed, filename));
  syncQueue = queued.catch(() => {});
  return queued;
}

module.exports = { syncWeeklyItems };
