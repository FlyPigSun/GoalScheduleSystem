import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Dashboard from './Dashboard.vue'

const store = vi.hoisted(() => ({
  loading: false,
  dashboard: {} as any,
  departments: [{ id: 1, name: '采购供应链' }],
  fetchDashboard: vi.fn(),
  fetchDepartments: vi.fn(),
}))
vi.mock('../stores/app', () => ({ useAppStore: () => store }))
vi.mock('../config/departments', () => ({
  DEPARTMENTS: [{ id: 1, name: '采购供应链', slug: 'supply', icon: '' }],
  getDeptGoals: () => [],
}))

const item = (id: number, title: string) => ({ id, title, department_id: 1 })
const render = () => mount(Dashboard, {
  global: {
    stubs: {
      CalendarView: true,
      ItemList: {
        props: ['items'],
        template: '<div><div v-for="item in items" :key="item.id" class="test-item">{{ item.title }}</div></div>',
      },
    },
  },
})

beforeEach(() => {
  store.dashboard = { overdue: [], currentWeek: [], nextWeek: [], thisMonth: [], unscheduled: [] }
})

describe('Dashboard 分组展示', () => {
  it('交叉时间范围只展示一次，月底任务不展示且不计入总数', async () => {
    const overdue = item(1, '已逾期任务')
    const today = item(2, '今天到期')
    const nextWeek = item(3, '下周任务')
    const later = item(4, '月底任务')
    const unscheduled = item(5, '未排期')
    store.dashboard = {
      overdue: [overdue], currentWeek: [overdue, today], nextWeek: [nextWeek],
      thisMonth: [overdue, today, nextWeek, later], unscheduled: [unscheduled],
    }
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findAll('.test-item').map(row => row.text())).toEqual([
      '已逾期任务', '今天到期', '下周任务', '未排期',
    ])
    expect(wrapper.text()).toContain('4 项')
    expect(wrapper.text()).toContain('本周待办 (1)')
    expect(wrapper.text()).not.toContain('本月稍后')
    expect(wrapper.text()).not.toContain('月底任务')
    wrapper.unmount()
  })

  it('本周任务全部逾期时隐藏本周分组；同名不同 ID 的任务仍保留', async () => {
    const first = item(1, '相同标题')
    const second = item(2, '相同标题')
    store.dashboard.overdue = [first, first, second]
    store.dashboard.currentWeek = [first, second]
    store.dashboard.thisMonth = [first, second]
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findAll('.test-item')).toHaveLength(2)
    expect(wrapper.text()).toContain('已逾期 (2)')
    expect(wrapper.text()).toContain('2 项')
    expect(wrapper.text()).not.toContain('本周待办')
    expect(wrapper.text()).not.toContain('本月稍后')
    wrapper.unmount()
  })
})
