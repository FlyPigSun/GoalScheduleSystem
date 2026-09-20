// 必须在加载数据库模块前指定内存库，禁止测试修改本地正式数据。
process.env.GOALS_DB_PATH = ':memory:';

const express = require('express');
const request = require('supertest');
const { DB_PATH, initDatabase, run, all, getDb } = require('../src/models/database');
const app = express();
app.use(express.json());
app.use('/api/items', require('../src/routes/items'));

beforeAll(async () => {
  expect(DB_PATH).toBe(':memory:');
  await initDatabase();
});

beforeEach(async () => {
  await run('DELETE FROM items');
});

afterAll(() => new Promise((resolve, reject) => getDb().close(error => error ? reject(error) : resolve())));

async function createItem(fields = {}) {
  const response = await request(app).post('/api/items').send({
    title: '尝试图纸工作台',
    description: '实现自动化平面图和施工图，人来做审核',
    due_date: '2026-09-25',
    department_id: 2,
    ...fields
  });
  expect(response.status).toBe(200);
  return response.body.data;
}

function history(id) {
  return all('SELECT field, old_value, new_value FROM item_history WHERE item_id = ? ORDER BY id', [id]);
}

test('创建时保存独立负责人，单项及列表查询保留该字段', async () => {
  const item = await createItem({ owner: ' 冯磊 ' });
  expect(item).toMatchObject({ owner: '冯磊', department_id: 2, due_date: '2026-09-25' });
  const fetched = await request(app).get(`/api/items/${item.id}`);
  expect(fetched.body.data.owner).toBe('冯磊');
  const listed = await request(app).get('/api/items').query({ department_id: 2 });
  expect(listed.body.data.find(row => row.id === item.id).owner).toBe('冯磊');
});

test.each([{}, { owner: null }, { owner: '' }])('创建时可省略或清空负责人：%j', async fields => {
  expect((await createItem(fields)).owner).toBe('');
});

test('修改负责人记录历史，不同输入产生相同值时不重复记录', async () => {
  const item = await createItem({ owner: '冯磊' });
  const updated = await request(app).put(`/api/items/${item.id}`).send({ owner: ' 杨斌 ' });
  expect(updated.status).toBe(200);
  expect(updated.body.data).toMatchObject({ owner: '杨斌', title: item.title, description: item.description });
  const expected = [{ field: 'owner', old_value: '冯磊', new_value: '杨斌' }];
  expect(await history(item.id)).toEqual(expected);
  const unchanged = await request(app).put(`/api/items/${item.id}`).send({ owner: ' 杨斌 ' });
  expect(unchanged.status).toBe(200);
  expect(await history(item.id)).toEqual(expected);
});

test.each([null, '', '   '])('可显式清空负责人且保留历史：%j', async owner => {
  const item = await createItem({ owner: '冯磊' });
  const cleared = await request(app).put(`/api/items/${item.id}`).send({ owner });
  expect(cleared.status).toBe(200);
  expect(cleared.body.data.owner).toBe('');
  expect(await history(item.id)).toEqual([{ field: 'owner', old_value: '冯磊', new_value: '' }]);
});

test('普通部分更新省略 owner 时保留已有负责人且不新增负责人历史', async () => {
  const item = await createItem({ owner: '冯磊' });
  const updated = await request(app).put(`/api/items/${item.id}`).send({ due_date: '2026-09-26' });
  expect(updated.status).toBe(200);
  expect(updated.body.data).toMatchObject({ owner: '冯磊', due_date: '2026-09-26' });
  expect(await history(item.id)).toEqual([{ field: 'due_date', old_value: '2026-09-25', new_value: '2026-09-26' }]);
});

test.each([0, true, [], {}, '冯'.repeat(101)])('创建及更新拒绝无效负责人且不修改数据：%j', async owner => {
  const rejected = await request(app).post('/api/items').send({ title: '无效事项', owner });
  expect(rejected.status).toBe(400);
  expect(rejected.body.error).toContain('负责人');
  expect(await all('SELECT id FROM items')).toEqual([]);

  const item = await createItem({ owner: '冯磊' });
  const update = await request(app).put(`/api/items/${item.id}`).send({ owner, title: '不得写入的标题' });
  expect(update.status).toBe(400);
  expect(update.body.error).toContain('负责人');
  const fetched = await request(app).get(`/api/items/${item.id}`);
  expect(fetched.body.data).toMatchObject({ title: item.title, owner: '冯磊' });
  expect(await history(item.id)).toEqual([]);
});

test('负责人长度上限100字可创建和修改', async () => {
  const owner = '冯'.repeat(100);
  const item = await createItem({ owner });
  expect(item.owner).toBe(owner);
  const newOwner = '磊'.repeat(100);
  const updated = await request(app).put(`/api/items/${item.id}`).send({ owner: newOwner });
  expect(updated.status).toBe(200);
  expect(updated.body.data.owner).toBe(newOwner);
});
