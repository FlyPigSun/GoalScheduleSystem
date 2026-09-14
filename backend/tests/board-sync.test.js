process.env.GOALS_DB_PATH = ':memory:';

const request = require('supertest');
const { initDatabase, run, all, get, getDb } = require('../src/models/database');
const { parseBoardSync, itemKey } = require('../src/utils/boardSyncParser');
const { syncWeeklyItems } = require('../src/models/weeklySync');
const app = require('../src/index');

function report(week, items) {
  return `# 企业微信工作周报\n\n<!-- BOARD_SYNC\n${JSON.stringify(items, null, 2)}\nBOARD_SYNC -->\n`;
}

async function uploadMarkdown(filename, content) {
  return request(app).post('/api/upload').attach('file', Buffer.from(content), filename);
}

beforeAll(async () => {
  await initDatabase();
});

beforeEach(async () => {
  await run('DELETE FROM items');
  await run('DELETE FROM weekly_sync_imports');
});

afterAll(() => new Promise((resolve, reject) => getDb().close(error => error ? reject(error) : resolve())));

test('正式周报同步、关闭和重复过滤', async () => {
  const markdown = report('2026-W35', [
    { title: '奥雪设备问题投诉', area: '采购供应链', owner: '杨斌', priority: 'P0', deadline: '2026-08-28', status: '继续跟进' },
    { title: '深圳冻品仓搬迁', area: '采购供应链', owner: '张志洋', priority: 'P0', deadline: '2026-08-28', status: '已闭环' },
    { title: '普通日常会面', area: '综合管理', owner: '待明确', priority: 'P2', deadline: null, status: '无需跟进' },
    { title: '未来项目进展', area: '综合管理', status: '仅作周报进展' }
  ]);

  const first = await uploadMarkdown('2026-W35.md', markdown);
  expect(first.status).toBe(200);
  expect(first.body.data.summary).toMatchObject({ added: 1, closed: 0, skipped: 3, conflicts: 0 });
  expect(await all('SELECT status FROM items')).toEqual([{ status: 'in_progress' }]);

  const second = await uploadMarkdown('2026-W35.md', markdown);
  expect(second.status).toBe(200);
  expect(second.body.data.summary).toMatchObject({ added: 0, updated: 0, skipped: 4, conflicts: 0 });
});

test('旧周报不能覆盖新周报状态', async () => {
  await uploadMarkdown('2026-W35.md', report('2026-W35', [
    { title: '奥雪设备问题投诉', area: '采购供应链', owner: '杨斌', priority: 'P0', deadline: '2026-08-28', status: '继续跟进' }
  ]));
  const oldReport = report('2026-W34', [
    { title: '奥雪设备投诉处理', area: '采购供应链', owner: '杨斌', priority: 'P1', deadline: '2026-08-20', status: '已闭环' }
  ]);
  const response = await uploadMarkdown('2026-W34.md', oldReport);
  expect(response.status).toBe(200);
  expect(response.body.data.summary.skipped).toBe(1);

  const item = await get("SELECT status, priority, due_date, last_report_week FROM items WHERE title LIKE '奥雪%'");
  expect(item).toMatchObject({ status: 'in_progress', priority: 'P0', due_date: '2026-08-28', last_report_week: '2026-W35' });
});

test('旧系统开发事项迁移到独立板块且新周报不重复创建', async () => {
  await run(
    `INSERT INTO items (title, description, status, priority, department_id, source, item_key, last_report_week)
     VALUES ('报损数据', '旧板块事项', 'in_progress', 'P0', 5, 'manual', '综合管理|报损数据', '2026-W35')`
  );
  await initDatabase();

  const migrated = await get(`SELECT i.id, i.item_key, d.name AS department_name
    FROM items i LEFT JOIN departments d ON i.department_id = d.id WHERE i.title = '报损数据'`);
  expect(migrated.department_name).toBe('AI 及 系统开发');
  expect(migrated.item_key).toBe('AI 及 系统开发|报损数据');

  const markdown = report('2026-W36', [
    { title: '报损数据', area: '系统开发', owner: '高伟杰', priority: 'P0', deadline: null, status: '继续跟进' }
  ]);
  const response = await uploadMarkdown('2026-W36.md', markdown);
  expect(response.status).toBe(200);
  expect(response.body.data.summary).toMatchObject({ added: 0, updated: 1, conflicts: 0 });
});

test('缺少BOARD_SYNC的Markdown拒绝导入', async () => {
  const response = await uploadMarkdown('2026-W36.md', '# 普通文档');
  expect(response.status).toBe(400);
  expect(response.body.message).toContain('BOARD_SYNC');
});

function sync(items, week = '2026-W37') {
  const filename = `${week}.md`;
  return syncWeeklyItems(parseBoardSync(report(week, items), filename), filename);
}

async function seed(title, options = {}) {
  const { area = '采购供应链', status = 'in_progress', key = itemKey(area, title), week = '2026-W36' } = options;
  const dept = await get('SELECT id FROM departments WHERE name = ?', [area]);
  return (await run(`INSERT INTO items (title, status, priority, department_id, item_key, last_report_week)
    VALUES (?, ?, 'P0', ?, ?, ?)`, [title, status, dept.id, key, week])).id;
}

test('关闭只计已有活动事项转为完成，停止跟进不计关闭', async () => {
  const states = ['pending', 'in_progress', 'completed', 'deferred', 'deleted'];
  const items = [];
  for (const state of states) {
    await seed(`盘点${state}`, { status: state });
    items.push({ title: `盘点${state}`, area: '采购供应链', status: '已闭环' });
  }
  await seed('不再追踪');
  items.push({ title: '不再追踪', area: '采购供应链', status: '无需跟进' });
  expect(await sync(items)).toMatchObject({ added: 0, updated: 6, closed: 2, conflicts: 0 });
  expect((await get("SELECT status FROM items WHERE title = '不再追踪'")).status).toBe('deferred');
});

test('仅作进展保留已有完成状态；明确继续跟进可以重开并报告冲突', async () => {
  await seed('产品资料', { status: 'completed' });
  expect(await sync([{ title: '产品资料', area: '采购供应链', status: '仅作周报进展', progress: '补充本周交付范围' }]))
    .toMatchObject({ updated: 1, closed: 0, conflicts: 0 });
  expect((await get("SELECT status FROM items WHERE title = '产品资料'")).status).toBe('completed');
  expect(await sync([{ title: '产品资料', area: '采购供应链', status: '继续跟进' }]))
    .toMatchObject({ updated: 1, closed: 0, conflicts: 1 });
});

test('明确ID按已存身份跨板块更新原记录，重复导入及旧key重导不创建副本', async () => {
  const oldKey = itemKey('质量', '慧运营消息及时同步工厂');
  const id = await seed('杨斌｜慧运营消息及时同步工厂', { area: '质量', key: oldKey, status: 'pending' });
  const item = { title: '慧运营消息及时同步工厂', area: 'AI 及 系统开发', status: '已闭环', existingBoardId: id };
  expect(await sync([item])).toMatchObject({ added: 0, updated: 1, closed: 1, skipped: 0 });
  const migrated = await get('SELECT * FROM items WHERE id = ?', [id]);
  expect(migrated).toMatchObject({ department_id: 6, item_key: itemKey(item.area, item.title), status: 'completed', last_report_week: '2026-W37' });
  expect(await get('SELECT item_id FROM weekly_sync_item_keys WHERE item_key = ?', [oldKey])).toEqual({ item_id: id });
  const history = await all('SELECT * FROM item_history');
  expect(await sync([item])).toMatchObject({ added: 0, updated: 0, closed: 0, skipped: 1 });
  expect(await all('SELECT * FROM item_history')).toEqual(history);
  expect(await sync([{ ...item, area: '质量', existingBoardId: undefined, status: '继续跟进' }], '2026-W36'))
    .toMatchObject({ added: 0, updated: 0, closed: 0, skipped: 1 });
  expect(await all('SELECT * FROM items')).toEqual([migrated]);
});

test.each([0, -1, 1.5, '713', true, 9007199254740992])('拒绝无效existingBoardId：%s', value => {
  expect(() => parseBoardSync(report('2026-W37', [{ title: '分账系统', existingBoardId: value }]), '2026-W37.md'))
    .toThrow('existingBoardId');
});

test.each(['missing', 'identity', 'key', 'alias', 'duplicate'])('身份或标识冲突时整批原子回滚：%s', async kind => {
  const id = await seed('分账系统');
  let invalid = { title: '分账系统', area: 'AI 及 系统开发', status: '已闭环', existingBoardId: id };
  if (kind === 'missing') invalid.existingBoardId = id + 10000;
  if (kind === 'identity') invalid.title = '无关的验收事项';
  if (kind === 'key') await seed('分账系统', { area: 'AI 及 系统开发' });
  if (kind === 'alias') {
    const otherId = await seed('分账系统', { area: '质量' });
    await sync([{ title: '分账系统', area: 'AI 及 系统开发', status: '继续跟进', existingBoardId: otherId }]);
    invalid.area = '质量';
  }
  const rowsBefore = await all('SELECT * FROM items ORDER BY id');
  const importsBefore = await all('SELECT * FROM weekly_sync_imports');
  const historyBefore = await all('SELECT * FROM item_history');
  const input = [{ title: '本批新工作', area: '工程', status: '继续跟进' }];
  if (kind === 'duplicate') input.push({ ...invalid, area: '采购供应链' });
  input.push(invalid);
  await expect(sync(input)).rejects.toThrow();
  expect(await all('SELECT * FROM items ORDER BY id')).toEqual(rowsBefore);
  expect(await all('SELECT * FROM weekly_sync_imports')).toEqual(importsBefore);
  expect(await all('SELECT * FROM item_history')).toEqual(historyBefore);
});

test('迁移之后再发生冲突，别名和已执行的更新一并回滚', async () => {
  const id = await seed('分账系统');
  const before = await get('SELECT * FROM items WHERE id = ?', [id]);
  await expect(sync([
    { title: '分账系统', area: 'AI 及 系统开发', status: '已闭环', existingBoardId: id },
    { title: '不同的事项', area: '工程', status: '继续跟进', existingBoardId: id }
  ])).rejects.toThrow();
  expect(await get('SELECT * FROM items WHERE id = ?', [id])).toEqual(before);
  expect(await all('SELECT * FROM weekly_sync_item_keys')).toEqual([]);
  expect(await all('SELECT * FROM item_history')).toEqual([]);
});

test('只补全本周报目标的空key，无关手工项逐字段保持不变', async () => {
  const unrelatedId = await seed('泡芙供应商销售支持', { key: null, week: null });
  const matchingId = await seed('上海冷库盘点', { key: null, week: null });
  const migratedId = await seed('分账系统', { key: null, week: null });
  const unrelatedBefore = await get('SELECT * FROM items WHERE id = ?', [unrelatedId]);
  expect(await sync([
    { title: '上海冷库盘点', area: '采购供应链', status: '已闭环' },
    { title: '分账系统', area: 'AI 及 系统开发', status: '继续跟进', existingBoardId: migratedId }
  ])).toMatchObject({ added: 0, updated: 2, closed: 1 });
  expect(await get('SELECT * FROM items WHERE id = ?', [unrelatedId])).toEqual(unrelatedBefore);
  expect(await get('SELECT item_key, status FROM items WHERE id = ?', [matchingId]))
    .toEqual({ item_key: itemKey('采购供应链', '上海冷库盘点'), status: 'completed' });
  expect(await get('SELECT item_key, department_id FROM items WHERE id = ?', [migratedId]))
    .toEqual({ item_key: itemKey('AI 及 系统开发', '分账系统'), department_id: 6 });
  expect(await get('SELECT item_id FROM weekly_sync_item_keys WHERE item_key = ?', [itemKey('采购供应链', '分账系统')]))
    .toEqual({ item_id: migratedId });
  expect(await get('SELECT COUNT(*) AS count FROM items')).toEqual({ count: 3 });
});
