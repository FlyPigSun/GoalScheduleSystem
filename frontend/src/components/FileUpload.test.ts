import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FileUpload from './FileUpload.vue'

vi.mock('../api', () => ({ uploadFile: vi.fn() }))
vi.mock('../stores/toast', () => ({
  useToastStore: () => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() })
}))

describe('FileUpload', () => {
  it('只接受正式周报Markdown', () => {
    const wrapper = mount(FileUpload)
    expect(wrapper.text()).toContain('仅支持带 BOARD_SYNC 的正式周报 .md')
    expect(wrapper.find('input[type="file"]').attributes('accept')).toContain('.md')
    expect(wrapper.find('input[type="file"]').attributes('accept')).not.toContain('.xlsx')
  })

  it('关闭按钮触发close事件', async () => {
    const wrapper = mount(FileUpload)
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
