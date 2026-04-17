const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'database', 'goals.db');

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
        { name: '采购供应链', sort_order: 1 },
        { name: '招商', sort_order: 2 },
        { name: '质量', sort_order: 3 },
        { name: '工程', sort_order: 4 },
        { name: '综合管理', sort_order: 5 }
      ];
      // 使用异步方式插入默认部门
      const insertPromises = defaultDepts.map(d => {
        return new Promise((resolve, reject) => {
          db.run('INSERT OR IGNORE INTO departments (name, sort_order) VALUES (?, ?)', [d.name, d.sort_order], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });
      Promise.all(insertPromises).then(() => resolve()).catch(reject);
    });
  });
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

module.exports = { getDb, initDatabase, run, all, get, DB_PATH };
