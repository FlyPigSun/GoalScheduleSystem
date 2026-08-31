import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CalendarView from './CalendarView.vue'

vi.mock('../api', () => ({
  itemsApi: {
    getAll: vi.fn(() => Promise.resolve({
      data: [{ id: 1, title: '测试节点', due_date: '2026-08-31', priority: 'P0', department_id: 1, department_name: '采购供应链', status: 'in_progress' }]
    }))
  }
}))

describe('CalendarView', () => {
  it('同时提供桌面月历和手机节点清单', async () => {
    const wrapper = mount(CalendarView)
    await flushPromises()
    expect(wrapper.find('.calendar-desktop').exists()).toBe(true)
    expect(wrapper.find('.calendar-mobile').exists()).toBe(true)
    expect(wrapper.text()).toContain('测试节点')
    expect(wrapper.text()).toContain('AI 及 系统开发')
  })
})
