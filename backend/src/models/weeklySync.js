const { run, all, get } = require('./database');
const { canonicalTitle, itemKey } = require('../utils/boardSyncParser');

// Retain prior keys when a confirmed item moves areas, so older reports still
// resolve to that item and cannot recreate it under the previous area.
async function ensureKeyAliases() {
  await run(`CREATE TABLE IF NOT EXISTS weekly_sync_item_keys (
    item_key TEXT PRIMARY KEY,
    item_id INTEGER NOT NULL,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  )`);
}

async function findItemByKey(key) {
  const matches = await all(`SELECT * FROM items WHERE item_key = ? OR id IN
    (SELECT item_id FROM weekly_sync_item_keys WHERE item_key = ?)`, [key, key]);
  if (matches.length > 1) throw new Error(`事项标识冲突：${key}`);
  return matches[0];
}

async function resolveExisting(item, key) {
  const keyed = await findItemByKey(key);
  if (item.existingBoardId == null) return keyed;
  if (!Number.isSafeInteger(item.existingBoardId) || item.existingBoardId <= 0) {
    throw new Error('existingBoardId 必须是正整数');
  }

  const existing = await get('SELECT * FROM items WHERE id = ?', [item.existingBoardId]);
  if (!existing) throw new Error(`确认的看板事项不存在：${item.existingBoardId}`);
  // Legacy display titles can contain owner prefixes; the persisted key is the
  // item's identity. An explicit ID may change its area, never its identity.
  const identity = existing.item_key
    ? existing.item_key.slice(existing.item_key.indexOf('|') + 1)
    : canonicalTitle(existing.title);
  if (!identity || identity !== canonicalTitle(item.title)) {
    throw new Error(`确认的看板事项身份不符：${item.existingBoardId} / ${item.title}`);
  }
  if (keyed && keyed.id !== existing.id) throw new Error(`事项标识冲突：${key}`);
  return existing;
}

async function retainPreviousKey(existing, key) {
  if (!existing.item_key || existing.item_key === key) return;
  const owner = await findItemByKey(existing.item_key);
  if (owner && owner.id !== existing.id) throw new Error(`事项标识冲突：${existing.item_key}`);
  await run('INSERT OR IGNORE INTO weekly_sync_item_keys (item_key, item_id) VALUES (?, ?)',
    [existing.item_key, existing.id]);
}

async function backfillItemKeys(items) {
  const targetKeys = new Set(items.map(item => itemKey(item.area, item.title)));
  const targetIds = new Set(items.map(item => item.existingBoardId).filter(id => id != null));
  const rows = await all(`SELECT i.id, i.title, d.name AS area
    FROM items i LEFT JOIN departments d ON i.department_id = d.id
    WHERE i.item_key IS NULL`);
  for (const row of rows) {
    const key = itemKey(row.area || '综合管理', row.title);
    if (!targetKeys.has(key) && !targetIds.has(row.id)) continue;
    const duplicate = await findItemByKey(key);
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
    await ensureKeyAliases();
    await backfillItemKeys(parsed.items);
    const departments = await all('SELECT id, name FROM departments');
    const deptMap = new Map(departments.map(dept => [dept.name, dept.id]));
    const summary = { added: 0, updated: 0, closed: 0, skipped: 0, conflicts: 0 };
    const seenKeys = new Set();
    const seenIds = new Set();

    for (const item of parsed.items) {
      const key = itemKey(item.area, item.title);
      if (seenKeys.has(key)) throw new Error(`周报包含重复事项：${key}`);
      seenKeys.add(key);
      const existing = await resolveExisting(item, key);
      if (existing) {
        if (seenIds.has(existing.id)) throw new Error(`周报重复指向看板事项：${existing.id}`);
        seenIds.add(existing.id);
      }
      const departmentId = deptMap.get(item.area) || deptMap.get('综合管理') || 5;

      if (!existing) {
        if (['completed', 'deferred', 'progress_only'].includes(item.status)) {
          summary.skipped += 1;
          continue;
        }
        const inserted = await run(
          `INSERT INTO items
            (title, description, due_date, original_due_date, priority, department_id, status, source, item_key, owner, last_report_week, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?)`,
          [item.title, item.description || '来自正式周报', item.due_date, item.due_date, item.priority, departmentId,
            item.status, key, item.owner, parsed.reportWeek, null]
        );
        seenIds.add(inserted.id);
        summary.added += 1;
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
        item_key: key,
        status: targetStatus,
        owner: item.owner,
        last_report_week: parsed.reportWeek
      };
      const changed = Object.entries(changes).some(([field, value]) => String(existing[field] ?? '') !== String(value ?? ''));
      if (!changed) {
        summary.skipped += 1;
        continue;
      }

      await retainPreviousKey(existing, key);
      await logChanges(existing.id, existing, changes);
      await run(
        `UPDATE items SET title = ?, description = ?, due_date = ?, priority = ?, department_id = ?, item_key = ?, status = ?,
         owner = ?, last_report_week = ?, completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, datetime('now','localtime')) ELSE NULL END,
         updated_at = datetime('now','localtime') WHERE id = ?`,
        [item.title, changes.description, item.due_date, item.priority, departmentId, key, targetStatus,
          item.owner, parsed.reportWeek, targetStatus, existing.id]
      );
      summary.updated += 1;
      if (targetStatus === 'completed' && ['pending', 'in_progress'].includes(existing.status)) summary.closed += 1;
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
