import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DuplicateCheckModal from './DuplicateCheckModal.vue'
import axios from 'axios'

// Mock axios
vi.mock('axios')
const mockedAxios = vi.mocked(axios)
mockedAxios.create = vi.fn(() => ({
  get: vi.fn(() => Promise.resolve({ data: { success: true } })),
  post: vi.fn(() => Promise.resolve({ data: { success: true, duplicates: [] } })),
  put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  delete: vi.fn(() => Promise.resolve({ data: { success: true } })),
  interceptors: { response: { use: vi.fn() } }
})) as any

// Mock api 模块
vi.mock('../api', () => ({
  confirmUpload: vi.fn(() => Promise.resolve({ success: true }))
}))

describe('DuplicateCheckModal', () => {
  const mockItems = [
    {
      tempId: 0,
      title: '新任务1',
      description: '描述1',
      due_date: '2026-05-01',
      department_id: 1,
      priority: 'P1',
      department_name: '采购供应链'
    },
    {
      tempId: 1,
      title: '新任务2',
      description: '描述2',
      due_date: '2026-05-02',
      department_id: 2,
      priority: 'P0',
      department_name: '招商'
    }
  ]

  it('渲染组件并显示事项列表', async () => {
    const wrapper = mount(DuplicateCheckModal, {
      props: { items: mockItems }
    })
    
    await flushPromises()
    
    expect(wrapper.text()).toContain('新任务1')
    expect(wrapper.text()).toContain('新任务2')
  })

  it('显示正确的步骤指示', async () => {
    const wrapper = mount(DuplicateCheckModal, {
      props: { items: mockItems }
    })
    
    await flushPromises()
    
    expect(wrapper.text()).toContain('第 2/2 步')
  })

  it('默认所有项标记为导入', async () => {
    const wrapper = mount(DuplicateCheckModal, {
      props: { items: mockItems }
    })
    
    await flushPromises()
    
    expect(wrapper.text()).toContain('将导入 2 个，跳过 0 个')
  })

  it('点击返回上一步触发 back 事件', async () => {
    const wrapper = mount(DuplicateCheckModal, {
      props: { items: mockItems }
    })
    
    await flushPromises()
    
    const backBtn = wrapper.findAll('button').find(b => b.text().includes('返回上一步'))
    await backBtn?.trigger('click')
    
    expect(wrapper.emitted('back')).toBeTruthy()
    expect(wrapper.emitted('back')![0][0]).toHaveLength(2)
  })

  it('点击取消触发 close 事件', async () => {
    const wrapper = mount(DuplicateCheckModal, {
      props: { items: mockItems }
    })
    
    await flushPromises()
    
    const cancelBtn = wrapper.findAll('button').find(b => b.text() === '取消')
    await cancelBtn?.trigger('click')
    
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
