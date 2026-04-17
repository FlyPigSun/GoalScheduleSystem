const request = require('supertest');
const path = require('path');
const fs = require('fs');
const { initDatabase, run, all, get } = require('../src/models/database');
const app = require('../src/index');

beforeAll(async () => {
  await initDatabase();
  await run('DELETE FROM items');
  await run('DELETE FROM weekly_reviews');
  await run('DELETE FROM weekly_review_status');
  await run('DELETE FROM item_history');
});

afterAll(async () => {
  const { getDb } = require('../src/models/database');
  getDb().close();
});

beforeEach(async () => {
  await run('DELETE FROM items');
});

describe('文件上传 - 两步导入流程', () => {
  // 设置更长的超时时间，因为 AI 解析需要时间
  jest.setTimeout(30000)
  describe('第一步：上传并预览（POST /api/upload）', () => {
    test('上传 txt 文件返回预览数据，不插入数据库', async () => {
      const testFile = path.join(__dirname, 'fixtures', 'test.txt');
      const fixtureDir = path.join(__dirname, 'fixtures');
      if (!fs.existsSync(fixtureDir)) fs.mkdirSync(fixtureDir, { recursive: true });
      
      fs.writeFileSync(testFile, `本周工作总结：
1. 完成供应商合同签订 [采购供应链] [P1] [2026-04-20]
2. 新店选址考察 [招商] [P2] [2026-04-22]`);

      const res = await request(app).post('/api/upload').attach('file', testFile);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.items.length).toBeGreaterThan(0);
      
      res.body.data.items.forEach(item => {
        expect(item.tempId).toBeDefined();
        expect(item.department_name).toBeDefined();
      });

      const dbItems = await all('SELECT * FROM items');
      expect(dbItems.length).toBe(0);

      fs.unlinkSync(testFile);
    });

    test('上传不支持的文件类型应失败', async () => {
      const testFile = path.join(__dirname, 'fixtures', 'test.pdf');
      fs.writeFileSync(testFile, 'test');

      const res = await request(app).post('/api/upload').attach('file', testFile);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      fs.unlinkSync(testFile);
    });

    test('上传超大文件应失败', async () => {
      const testFile = path.join(__dirname, 'fixtures', 'large.txt');
      const fd = fs.openSync(testFile, 'w');
      fs.writeSync(fd, Buffer.alloc(51 * 1024 * 1024, 'a'));
      fs.closeSync(fd);

      const res = await request(app).post('/api/upload').attach('file', testFile);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      fs.unlinkSync(testFile);
    });

    test('上传 zip 文件返回预览数据，不插入数据库', async () => {
      const archiver = require('archiver');
      const testZip = path.join(__dirname, 'fixtures', 'test.zip');
      
      const output = fs.createWriteStream(testZip);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      archive.pipe(output);
      archive.append(`本周工作：1. 完成质量检测报告 [质量] [P1] [2026-04-21]`, { name: 'week1.txt' });
      await archive.finalize();
      await new Promise(resolve => setTimeout(resolve, 100));

      const res = await request(app).post('/api/upload').attach('file', testZip);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toBeDefined();

      const dbItems = await all('SELECT * FROM items');
      expect(dbItems.length).toBe(0);

      fs.unlinkSync(testZip);
    });
  });

  describe('第二步：确认导入（POST /api/upload/confirm）', () => {
    test('确认导入单条事项', async () => {
      const items = [{
        tempId: 0,
        title: '测试导入事项',
        description: '测试描述',
        due_date: '2026-05-01',
        department_id: 1,
        priority: 'P1'
      }];

      const res = await request(app).post('/api/upload/confirm').send({ items });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inserted).toBe(1);

      const dbItems = await all('SELECT * FROM items');
      expect(dbItems.length).toBe(1);
      expect(dbItems[0].title).toBe('测试导入事项');
      expect(dbItems[0].status).toBe('in_progress');
    });

    test('确认导入多条事项', async () => {
      const items = [
        { tempId: 0, title: '事项1', due_date: '2026-05-01', department_id: 1, priority: 'P0' },
        { tempId: 1, title: '事项2', due_date: '2026-05-02', department_id: 2, priority: 'P1' }
      ];

      const res = await request(app).post('/api/upload/confirm').send({ items });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inserted).toBe(2);

      const dbItems = await all('SELECT * FROM items');
      expect(dbItems.length).toBe(2);
    });

    test('空 items 数组应返回错误', async () => {
      const res = await request(app).post('/api/upload/confirm').send({ items: [] });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('未提供 items 应返回错误', async () => {
      const res = await request(app).post('/api/upload/confirm').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('导入事项包含 correct 初始值', async () => {
      const items = [{
        tempId: 0,
        title: '测试初始值',
        due_date: '2026-05-01',
        department_id: 1,
        priority: 'P1'
      }];

      await request(app).post('/api/upload/confirm').send({ items });

      const dbItem = await get('SELECT * FROM items WHERE title = ?', ['测试初始值']);
      expect(dbItem.postpone_count).toBe(0);
      expect(dbItem.original_due_date).toBe('2026-05-01');
    });
  });
});
