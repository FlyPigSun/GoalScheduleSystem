const request = require('supertest');
const { initDatabase, run, all } = require('../src/models/database');
const app = require('../src/index');

let server;

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

describe('健康检查', () => {
  test('GET /api/health 返回 ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('部门接口', () => {
  test('GET /api/departments 返回部门列表', async () => {
    const res = await request(app).get('/api/departments');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    const names = res.body.data.map(d => d.name);
    expect(names).toContain('采购供应链');
    expect(names).toContain('招商');
    expect(names).toContain('质量');
    expect(names).toContain('工程');
  });
});

describe('事项 CRUD', () => {
  let itemId;

  test('POST /api/items 创建事项', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({
        title: '测试事项',
        description: '自动化测试',
        due_date: '2026-05-01',
        priority: 'P0',
        department_id: 1
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.title).toBe('测试事项');
    itemId = res.body.data.id;
  });

  test('GET /api/items/:id 获取单个事项', async () => {
    const res = await request(app).get(`/api/items/${itemId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('测试事项');
    expect(res.body.data.due_date).toBe('2026-05-01');
  });

  test('PUT /api/items/:id 更新事项', async () => {
    const res = await request(app)
      .put(`/api/items/${itemId}`)
      .send({ title: '更新后的测试事项', priority: 'P1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('更新后的测试事项');
  });

  test('DELETE /api/items/:id 删除事项', async () => {
    const res = await request(app).delete(`/api/items/${itemId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const getRes = await request(app).get(`/api/items/${itemId}`);
    expect(getRes.status).toBe(404);
  });
});

describe('事项顺延', () => {
  let itemId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/items')
      .send({
        title: '顺延测试事项',
        due_date: '2026-04-20',
        original_due_date: '2026-04-20',
        priority: 'P1',
        department_id: 2
      });
    itemId = res.body.data.id;
  });

  test('POST /api/items/:id/postpone 顺延事项', async () => {
    const res = await request(app)
      .post(`/api/items/${itemId}/postpone`)
      .send({ due_date: '2026-04-27' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.due_date).toBe('2026-04-27');
    expect(res.body.data.postpone_count).toBe(1);
    expect(res.body.data.original_due_date).toBe('2026-04-20');
  });

  test('再次顺延增加计数', async () => {
    const res = await request(app)
      .post(`/api/items/${itemId}/postpone`)
      .send({ due_date: '2026-05-04' });
    expect(res.status).toBe(200);
    expect(res.body.data.due_date).toBe('2026-05-04');
    expect(res.body.data.postpone_count).toBe(2);
    expect(res.body.data.original_due_date).toBe('2026-04-20');
  });
});

describe('看板数据', () => {
  test('GET /api/items/dashboard 返回看板数据', async () => {
    const res = await request(app).get('/api/items/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('upcoming');
    expect(res.body.data).toHaveProperty('currentWeek');
    expect(res.body.data).toHaveProperty('nextWeek');
    expect(res.body.data).toHaveProperty('thisMonth');
    expect(res.body.data).toHaveProperty('weekStart');
    expect(res.body.data).toHaveProperty('weekEnd');
  });

  test('GET /api/items/dashboard?week=1 返回下周看板', async () => {
    const res = await request(app).get('/api/items/dashboard?week=1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('时间线数据', () => {
  test('GET /api/items/timeline 返回时间线', async () => {
    const res = await request(app).get('/api/items/timeline');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('active');
    expect(res.body.data).toHaveProperty('completed');
    expect(res.body.data).toHaveProperty('weekStart');
    expect(res.body.data).toHaveProperty('weekEnd');
  });
});

describe('事项列表查询', () => {
  test('GET /api/items 返回事项列表', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/items?status=in_progress 筛选进行中', async () => {
    const res = await request(app).get('/api/items?status=in_progress');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    res.body.data.forEach(item => {
      expect(item.status).toBe('in_progress');
    });
  });
});
