import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UploadPreview from './UploadPreview.vue'

describe('UploadPreview', () => {
  const mockItems = [
    {
      tempId: 0,
      title: '测试事项1',
      description: '描述1',
      due_date: '2026-05-01',
      department_id: 1,
      priority: 'P1',
      department_name: '采购供应链'
    },
    {
      tempId: 1,
      title: '测试事项2',
      description: '描述2',
      due_date: null,
      department_id: 2,
      priority: 'P0',
      department_name: '招商'
    }
  ]

  it('渲染组件并显示事项列表', () => {
    const wrapper = mount(UploadPreview, {
      props: { items: mockItems }
    })
    
    expect(wrapper.text()).toContain('测试事项1')
    expect(wrapper.text()).toContain('测试事项2')
    expect(wrapper.text()).toContain('共识别 2 个事项')
  })

  it('默认全选所有事项', () => {
    const wrapper = mount(UploadPreview, {
      props: { items: mockItems }
    })
    
    expect(wrapper.text()).toContain('已选择 2 个')
  })

  it('点击取消按钮触发 close 事件', async () => {
    const wrapper = mount(UploadPreview, {
      props: { items: mockItems }
    })
    
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('无完成时间的待办显示警告', () => {
    const wrapper = mount(UploadPreview, {
      props: { items: mockItems }
    })
    
    expect(wrapper.text()).toContain('无明确完成时间')
  })

  it('下一步按钮在无选中项时禁用', async () => {
    const wrapper = mount(UploadPreview, {
      props: { items: mockItems }
    })
    
    // 先清空选择
    const clearBtn = wrapper.findAll('button').find(b => b.text() === '清空')
    if (clearBtn) await clearBtn.trigger('click')
    
    const nextBtn = wrapper.findAll('button').find(b => b.text().includes('下一步'))
    expect(nextBtn?.attributes('disabled')).toBeDefined()
  })

  it('选中无截止日期的项时下一步禁用', () => {
    const wrapper = mount(UploadPreview, {
      props: { items: [mockItems[1]] } // 只有无截止日期的项
    })
    
    const nextBtn = wrapper.findAll('button').find(b => b.text().includes('下一步'))
    expect(nextBtn?.attributes('disabled')).toBeDefined()
  })

  it('点击下一步触发 next 事件并传递选中项', async () => {
    const wrapper = mount(UploadPreview, {
      props: { items: [mockItems[0]] }
    })
    
    const nextBtn = wrapper.findAll('button').find(b => b.text().includes('下一步'))
    await nextBtn?.trigger('click')
    
    expect(wrapper.emitted('next')).toBeTruthy()
    expect(wrapper.emitted('next')![0][0]).toHaveLength(1)
    const emittedItems = wrapper.emitted('next')![0][0] as any[]
    expect(emittedItems[0].title).toBe('测试事项1')
  })
})
