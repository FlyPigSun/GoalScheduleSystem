jest.mock('../src/models/database', () => ({
  all: jest.fn(async () => []), run: jest.fn(), get: jest.fn()
}));
const { all } = require('../src/models/database');
const { getDashboard } = require('../src/models/item');

afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });

test.each([
  ['2026-09-05T13:00:00+08:00', '2026-09-05', '2026-09-30'],
  ['2026-09-01T00:30:00+08:00', '2026-09-01', '2026-09-30'],
  ['2028-02-05T13:00:00+08:00', '2028-02-05', '2028-02-29'],
])('本月查询包含本地月末，且午夜后正确划分今天：%s', async (now, today, monthEnd) => {
  jest.useFakeTimers().setSystemTime(new Date(now));
  await getDashboard();
  const calls = all.mock.calls;
  // thisMonth 查询及 overdue 边界均使用本地日期；测试不连接真实数据库。
  expect(calls[3][1]).toEqual([today, monthEnd]);
  expect(calls[4][1]).toEqual([today]);
});
