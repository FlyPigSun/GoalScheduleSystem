const request = require('supertest');
const { initDatabase, run, all, get } = require('../src/models/database');
const app = require('../src/index');

beforeAll(async () => {
  await initDatabase();
  // 清空测试数据
  await run('DELETE FROM items');
  await run('DELETE FROM weekly_reviews');
  await run('DELETE FROM weekly_review_status');
  await run('DELETE FROM item_history');
});

afterAll(async () => {
  const { getDb } = require('../src/models/database');
  getDb().close();
});

describe('每周确认功能', () => {
  let itemId1, itemId2, itemId3;

  beforeEach(async () => {
    // 清空数据
    await run('DELETE FROM items');
    await run('DELETE FROM weekly_reviews');
    await run('DELETE FROM weekly_review_status');

    // 创建上周的待办事项
    const lastWeek = new Date(Date.now() - 7 * 86400000);
    const lastWeekDate = lastWeek.toISOString().split('T')[0];

    // 事项1：上周待办
    const res1 = await request(app)
      .post('/api/items')
      .send({
        title: '上周待办事项1',
        due_date: lastWeekDate,
        priority: 'P1',
        department_id: 1
      });
    itemId1 = res1.body.data.id;

    // 事项2：上周进行中
    const res2 = await request(app)
      .post('/api/items')
      .send({
        title: '上周进行中事项',
        due_date: lastWeekDate,
        priority: 'P2',
        department_id: 2,
        status: 'in_progress'
      });
    itemId2 = res2.body.data.id;

    // 事项3：本周待办（不应出现在确认列表中）
    const nextWeek = new Date(Date.now() + 7 * 86400000);
    const nextWeekDate = nextWeek.toISOString().split('T')[0];
    const res3 = await request(app)
      .post('/api/items')
      .send({
        title: '下周待办事项',
        due_date: nextWeekDate,
        priority: 'P1',
        department_id: 3
      });
    itemId3 = res3.body.data.id;
  });

  test('GET /api/items/weekly-review 返回上周待确认事项', async () => {
    const res = await request(app).get('/api/items/weekly-review');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reviewed).toBe(false);
    expect(res.body.items.length).toBe(2); // 只有上周的 2 个事项
    expect(res.body.items.map(i => i.id)).toContain(itemId1);
    expect(res.body.items.map(i => i.id)).toContain(itemId2);
    expect(res.body.items.map(i => i.id)).not.toContain(itemId3); // 本周事项不应出现
  });

  test('POST /api/items/weekly-review 提交确认', async () => {
    const res = await request(app)
      .post('/api/items/weekly-review')
      .send({
        reviews: [
          { id: itemId1, action: 'completed', note: '已完成' },
          { id: itemId2, action: 'postponed', note: '需要延期' }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 验证事项1状态更新为 completed
    const item1 = await get('SELECT * FROM items WHERE id = ?', [itemId1]);
    expect(item1.status).toBe('completed');
    expect(item1.completed_at).toBeDefined();

    // 验证事项2顺延
    const item2 = await get('SELECT * FROM items WHERE id = ?', [itemId2]);
    expect(item2.postpone_count).toBe(1);
    expect(item2.due_date).not.toBe(item2.original_due_date);

    // 验证本周已确认
    const res2 = await request(app).get('/api/items/weekly-review');
    expect(res2.body.reviewed).toBe(true);
    expect(res2.body.items.length).toBe(0);
  });

  test('POST /api/items/weekly-review 删除事项', async () => {
    const res = await request(app)
      .post('/api/items/weekly-review')
      .send({
        reviews: [
          { id: itemId1, action: 'deleted', note: '不再需要' }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 验证事项已删除
    const item = await get('SELECT * FROM items WHERE id = ?', [itemId1]);
    expect(item.status).toBe('deleted');
  });

  test('没有待确认事项时不返回列表', async () => {
    // 清空所有事项
    await run('DELETE FROM items');
    
    const res = await request(app).get('/api/items/weekly-review');
    expect(res.status).toBe(200);
    expect(res.body.reviewed).toBe(false);
    expect(res.body.items.length).toBe(0);
  });
});
