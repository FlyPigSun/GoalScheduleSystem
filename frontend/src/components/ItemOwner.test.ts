import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ItemForm from './ItemForm.vue'
import ItemList from './ItemList.vue'
import type { Item } from '../stores/app'

const { store, itemsApi } = vi.hoisted(() => ({
  store: {
    departments: [{ id: 2, name: '招商' }],
    getDaysUntil: vi.fn(() => 5),
    getUrgencyClass: vi.fn(() => ''),
    formatDate: vi.fn((date: string) => date),
    updateItem: vi.fn(),
  },
  itemsApi: { create: vi.fn(), update: vi.fn() },
}))
vi.mock('../stores/app', () => ({ useAppStore: () => store }))
vi.mock('../api', () => ({ itemsApi }))

const wrappers: VueWrapper[] = []
const tracked = <T extends VueWrapper>(wrapper: T): T => {
  wrappers.push(wrapper)
  return wrapper
}
const item = (owner = '冯磊'): Item => ({
  id: 101,
  title: '尝试图纸工作台',
  description: '实现自动化平面图和施工图，人来做审核',
  owner,
  due_date: '2026-09-25',
  original_due_date: '2026-09-25',
  category: '',
  department_name: '招商',
  source: '',
  priority: 'P1',
  department_id: 2,
  status: 'pending',
  postpone_count: 0,
})
const renderList = (items: Item[]) => tracked(mount(ItemList, {
  props: { items },
  global: { stubs: { teleport: true } },
}))

beforeEach(() => {
  vi.clearAllMocks()
  store.updateItem.mockReset().mockResolvedValue({})
  itemsApi.create.mockReset().mockResolvedValue({})
  itemsApi.update.mockReset().mockResolvedValue({})
})

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

describe('事项负责人表单', () => {
  it('新建事项将独立负责人字段与原描述一同保存', async () => {
    const wrapper = tracked(mount(ItemForm))
    await wrapper.get('input[placeholder="20字以内"]').setValue('尝试图纸工作台')
    await wrapper.get('textarea').setValue('实现自动化平面图和施工图，人来做审核')
    const owner = wrapper.get('input[aria-label="负责人"]')
    expect(owner.attributes('maxlength')).toBe('100')
    await owner.setValue('冯磊')
    await wrapper.get('button.btn-primary').trigger('click')
    await flushPromises()

    expect(itemsApi.create).toHaveBeenCalledOnce()
    expect(itemsApi.create).toHaveBeenCalledWith(expect.objectContaining({
      title: '尝试图纸工作台',
      description: '实现自动化平面图和施工图，人来做审核',
      owner: '冯磊',
    }))
    expect(wrapper.emitted('done')).toHaveLength(1)
  })

  it('编辑回填已有负责人，并允许清空后保存', async () => {
    const existing = item()
    const wrapper = tracked(mount(ItemForm, {
      props: { editId: existing.id, editData: existing },
    }))
    await flushPromises()
    const owner = wrapper.get<HTMLInputElement>('input[aria-label="负责人"]')
    expect(owner.element.value).toBe('冯磊')
    await owner.setValue('')
    await wrapper.get('button.btn-primary').trigger('click')
    await flushPromises()

    expect(itemsApi.update).toHaveBeenCalledWith(101, expect.objectContaining({
      owner: '',
      title: existing.title,
      description: existing.description,
    }))
    expect(itemsApi.create).not.toHaveBeenCalled()
  })
})

describe('事项列表负责人', () => {
  it('列表展示负责人，旧事项缺失负责人时展示待明确', () => {
    const existing = item()
    const legacy = { ...item(), id: 102, owner: undefined }
    const wrapper = renderList([existing, legacy])
    const rows = wrapper.findAll('.item-row')
    expect(rows[0]!.text()).toContain('负责人：冯磊')
    expect(rows[1]!.text()).toContain('负责人：待明确')
  })

  it('详情单独保存修剪后的负责人，保留标题和描述', async () => {
    const existing = item()
    const wrapper = renderList([existing])
    await wrapper.get('.item-row').trigger('click')
    const owner = wrapper.get<HTMLInputElement>('input[aria-label="负责人"]')
    expect(owner.element.value).toBe('冯磊')
    await owner.setValue('  王明  ')
    await flushPromises()

    expect(store.updateItem).toHaveBeenCalledOnce()
    expect(store.updateItem).toHaveBeenCalledWith(101, { owner: '王明' })
    expect(existing.title).toBe('尝试图纸工作台')
    expect(existing.description).toBe('实现自动化平面图和施工图，人来做审核')
    expect(wrapper.get('.item-row').text()).toContain('负责人：王明')
  })

  it('详情允许清空负责人，并显示待明确', async () => {
    const wrapper = renderList([item()])
    await wrapper.get('.item-row').trigger('click')
    await wrapper.get('input[aria-label="负责人"]').setValue('')
    await flushPromises()

    expect(store.updateItem).toHaveBeenCalledWith(101, { owner: '' })
    expect(wrapper.get('.item-row').text()).toContain('负责人：待明确')
  })

  it('保存失败时提示错误，不将未保存的负责人显示为成功', async () => {
    store.updateItem.mockRejectedValueOnce(new Error('负责人保存失败'))
    const wrapper = renderList([item()])
    await wrapper.get('.item-row').trigger('click')
    await wrapper.get('input[aria-label="负责人"]').setValue('王明')
    await flushPromises()

    expect(wrapper.text()).toContain('负责人保存失败')
    expect(wrapper.get('.item-row').text()).toContain('负责人：冯磊')
    expect(wrapper.get('.item-row').text()).not.toContain('负责人：王明')
  })

  it('普通标题和描述编辑不会覆盖已有负责人', async () => {
    const existing = item()
    const wrapper = renderList([existing])
    await wrapper.get('.item-row').trigger('click')
    await wrapper.get('.mb-1 > div').trigger('click')
    await wrapper.get('input[placeholder="输入标题..."]').setValue('图纸工作台自动化')
    await wrapper.get('input[placeholder="输入标题..."]').trigger('blur')
    await flushPromises()
    expect(store.updateItem).toHaveBeenLastCalledWith(101, { title: '图纸工作台自动化' })

    const description = wrapper.findAll('div.cursor-pointer')
      .find(node => node.text().includes(existing.description))!
    await description.trigger('click')
    await wrapper.get('textarea').setValue('平面图与施工图完成后人工审核')
    await wrapper.get('textarea').trigger('blur')
    await flushPromises()

    expect(store.updateItem).toHaveBeenLastCalledWith(101, {
      description: '平面图与施工图完成后人工审核',
    })
    expect(existing.owner).toBe('冯磊')
    expect(wrapper.get('.item-row').text()).toContain('负责人：冯磊')
  })
})
