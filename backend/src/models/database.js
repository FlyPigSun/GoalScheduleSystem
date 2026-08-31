const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { itemKey } = require('../utils/boardSyncParser');

const DB_PATH = process.env.GOALS_DB_PATH || path.join(__dirname, '..', '..', 'database', 'goals.db');

let db;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) console.error('数据库连接失败:', err.message);
      else console.log('数据库连接成功');
    });
    db.serialize(() => {
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA foreign_keys = ON');
      // 每 1000 页（约 4MB）自动 checkpoint
      db.run('PRAGMA wal_autocheckpoint = 1000');
    });
  }
  return db;
}

function initDatabase() {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        due_date TEXT,
        original_due_date TEXT,
        postpone_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','deferred','deleted')),
        priority TEXT DEFAULT 'P1' CHECK(priority IN ('P0','P1','P2')),
        category TEXT DEFAULT '',
        department_id INTEGER,
        source TEXT DEFAULT 'manual' CHECK(source IN ('manual','ai_parsed')),
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime')),
        completed_at TEXT,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS item_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        field TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS weekly_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        week_start TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('completed','postponed','deleted')),
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS weekly_review_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start TEXT NOT NULL UNIQUE,
        reviewed INTEGER DEFAULT 0,
        reviewed_at TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )`);

      const defaultDepts = [
        { id: 1, name: '采购供应链', sort_order: 1 },
        { id: 2, name: '招商', sort_order: 2 },
        { id: 3, name: '质量', sort_order: 3 },
        { id: 4, name: '工程', sort_order: 4 },
        { id: 5, name: '综合管理', sort_order: 6 },
        { id: 6, name: 'AI 及 系统开发', sort_order: 5 }
      ];
      // 使用异步方式插入默认部门
      const insertPromises = defaultDepts.map(d => {
        return new Promise((resolve, reject) => {
          db.run('INSERT OR IGNORE INTO departments (id, name, sort_order) VALUES (?, ?, ?)', [d.id, d.name, d.sort_order], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
      Promise.all(insertPromises)
        .then(ensureSyncSchema)
        .then(() => resolve())
        .catch(reject);
    });
  });
}

async function ensureSyncSchema() {
  const columns = await all('PRAGMA table_info(items)');
  const names = new Set(columns.map(column => column.name));
  if (!names.has('item_key')) await run('ALTER TABLE items ADD COLUMN item_key TEXT');
  if (!names.has('owner')) await run("ALTER TABLE items ADD COLUMN owner TEXT DEFAULT ''");
  if (!names.has('last_report_week')) await run('ALTER TABLE items ADD COLUMN last_report_week TEXT');

  // 旧版 AI 导入记录保留为普通事项；新版不再调用模型或区分 AI 来源。
  await run("UPDATE items SET source = 'manual' WHERE source = 'ai_parsed'");
  await run("UPDATE departments SET sort_order = 5 WHERE name = 'AI 及 系统开发'");
  await run("UPDATE departments SET sort_order = 6 WHERE name = '综合管理'");
  await migrateLegacySystemItems();

  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_items_item_key ON items(item_key) WHERE item_key IS NOT NULL');
  await run(`CREATE TABLE IF NOT EXISTS weekly_sync_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_week TEXT NOT NULL,
    filename TEXT NOT NULL,
    added INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    conflicts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
}

async function migrateLegacySystemItems() {
  const aiDept = await get("SELECT id FROM departments WHERE name = 'AI 及 系统开发'");
  const generalDept = await get("SELECT id FROM departments WHERE name = '综合管理'");
  if (!aiDept || !generalDept) return;

  const legacyTitles = [
    '报损数据',
    '外卖商品自动化上下架',
    '开发管理系统只读查询接口',
    '供应链其他场景自动化',
    '数仓Windows环境迁移Mac环境'
  ];
  const placeholders = legacyTitles.map(() => '?').join(',');
  const rows = await all(
    `SELECT id, title FROM items
     WHERE department_id = ? AND last_report_week IS NOT NULL AND title IN (${placeholders})`,
    [generalDept.id, ...legacyTitles]
  );

  for (const row of rows) {
    const newKey = itemKey('AI 及 系统开发', row.title);
    const duplicate = await get('SELECT id FROM items WHERE item_key = ? AND id != ?', [newKey, row.id]);
    if (!duplicate) {
      await run('UPDATE items SET department_id = ?, item_key = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?',
        [aiDept.id, newKey, row.id]);
    }
  }
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// 执行 WAL checkpoint，将数据写入主数据库
function checkpoint() {
  return new Promise((resolve, reject) => {
    getDb().run('PRAGMA wal_checkpoint(TRUNCATE)', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = { getDb, initDatabase, run, all, get, checkpoint, DB_PATH };
