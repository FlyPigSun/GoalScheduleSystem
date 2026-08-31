const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'fixtures', 'board-sync.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.GOALS_DB_PATH = dbPath;

const request = require('supertest');
const { initDatabase, run, get, getDb } = require('../src/models/database');
const app = require('../src/index');

function report(week, items) {
  return `# 企业微信工作周报\n\n<!-- BOARD_SYNC\n${JSON.stringify(items, null, 2)}\nBOARD_SYNC -->\n`;
}

async function uploadMarkdown(filename, content) {
  const file = path.join(__dirname, 'fixtures', filename);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  const response = await request(app).post('/api/upload').attach('file', file);
  fs.unlinkSync(file);
  return response;
}

beforeAll(async () => {
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(dbPath + suffix); } catch {}
  }
  await initDatabase();
  await run('DELETE FROM items');
  await run('DELETE FROM weekly_sync_imports');
});

afterAll(() => {
  getDb().close();
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(dbPath + suffix); } catch {}
  }
});

test('正式周报同步、关闭和重复过滤', async () => {
  const markdown = report('2026-W35', [
    { title: '奥雪设备问题投诉', area: '采购供应链', owner: '杨斌', priority: 'P0', deadline: '2026-08-28', status: '继续跟进' },
    { title: '深圳冻品仓搬迁', area: '采购供应链', owner: '张志洋', priority: 'P0', deadline: '2026-08-28', status: '已闭环' },
    { title: '普通日常会面', area: '综合管理', owner: '待明确', priority: 'P2', deadline: null, status: '无需跟进' }
  ]);

  const first = await uploadMarkdown('2026-W35.md', markdown);
  expect(first.status).toBe(200);
  expect(first.body.data.summary).toMatchObject({ added: 2, closed: 1, skipped: 1, conflicts: 0 });

  const second = await uploadMarkdown('2026-W35.md', markdown);
  expect(second.status).toBe(200);
  expect(second.body.data.summary).toMatchObject({ added: 0, updated: 0, skipped: 3, conflicts: 0 });
});

test('旧周报不能覆盖新周报状态', async () => {
  const oldReport = report('2026-W34', [
    { title: '奥雪设备投诉处理', area: '采购供应链', owner: '杨斌', priority: 'P1', deadline: '2026-08-20', status: '已闭环' }
  ]);
  const response = await uploadMarkdown('2026-W34.md', oldReport);
  expect(response.status).toBe(200);
  expect(response.body.data.summary.skipped).toBe(1);

  const item = await get("SELECT status, priority, due_date, last_report_week FROM items WHERE title LIKE '奥雪%'");
  expect(item).toMatchObject({ status: 'in_progress', priority: 'P0', due_date: '2026-08-28', last_report_week: '2026-W35' });
});

test('缺少BOARD_SYNC的Markdown拒绝导入', async () => {
  const response = await uploadMarkdown('2026-W36.md', '# 普通文档');
  expect(response.status).toBe(400);
  expect(response.body.message).toContain('BOARD_SYNC');
});
