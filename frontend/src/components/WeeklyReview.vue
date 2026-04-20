<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <div class="p-5 border-b border-gray-100">
        <h3 class="text-lg font-semibold">📅 上周事项确认</h3>
        <p class="text-sm text-gray-500 mt-1">请确认以下事项的完成情况（必须全部处理）</p>
      </div>
      <div class="p-5">
        <div v-for="item in reviewItems" :key="item.id" class="mb-4 p-3 bg-gray-50 rounded-lg">
          <div class="font-medium text-sm mb-2">{{ item.title }}</div>
          <div class="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <span>截止: {{ item.due_date }}</span>
            <select
              v-model="item.department_id"
              @change="updateDepartment(item)"
              class="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-200 cursor-pointer"
            >
              <option :value="null">综合</option>
              <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="action in actions"
              :key="action.value"
              class="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
              :class="getActionClass(item.id, action.value)"
              @click="setAction(item.id, action.value)"
            >
              {{ action.label }}
            </button>
          </div>
          <div v-if="item._statusMsg" class="mt-2 text-xs" :class="item._statusOk ? 'text-green-600' : 'text-red-500'">
            {{ item._statusMsg }}
          </div>
        </div>
        <div v-if="reviewItems.length === 0" class="text-center text-gray-400 py-8">
          上周没有待跟进事项
        </div>
      </div>
      <div v-if="reviewItems.length > 0" class="p-5 border-t border-gray-100">
        <button
          class="btn btn-primary w-full"
          :class="{ 'opacity-50': !canSubmit }"
          :disabled="!canSubmit"
          @click="submit"
        >
          确认提交
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { itemsApi } from '../api'
import { useAppStore } from '../stores/app'

const emit = defineEmits(['close', 'done'])
const store = useAppStore()
const departments = store.departments

const reviewItems = ref<any[]>([])
const selectedActions = ref<Record<number, string>>({})

const actions = [
  { label: '✅ 已完成', value: 'completed', class: 'bg-green-50 text-green-600 border border-green-200' },
  { label: '⏳ 顺延', value: 'postponed', class: 'bg-yellow-50 text-yellow-600 border border-yellow-200' },
  { label: '🗑️ 删除', value: 'deleted', class: 'bg-gray-100 text-gray-500 border border-gray-200' }
]

const canSubmit = computed(() => {
  return reviewItems.value.length > 0 && reviewItems.value.every(i => selectedActions.value[i.id])
})

function setAction(id: number, action: string) {
  selectedActions.value[id] = action
}

async function updateDepartment(item: any) {
  try {
    await itemsApi.update(item.id, { department_id: item.department_id })
    const dept = departments.find(d => d.id === item.department_id)
    item.department_name = dept?.name || ''
    item._statusMsg = '✓ 板块已更新'
    item._statusOk = true
    setTimeout(() => { item._statusMsg = '' }, 1500)
  } catch (e: any) {
    item._statusMsg = e.message || '更新失败'
    item._statusOk = false
  }
}

function getActionClass(id: number, value: string) {
  const base = actions.find(a => a.value === value)?.class || ''
  if (selectedActions.value[id] === value) {
    return base.replace('50', '100').replace('200', '500') + ' ring-2 ring-offset-1'
  }
  return base
}

async function submit() {
  const reviews = reviewItems.value.map(item => ({
    id: item.id,
    action: selectedActions.value[item.id],
    due_date: item.due_date
  }))
  await itemsApi.submitWeeklyReview(reviews)
  emit('done')
  close()
}

function close() {
  emit('close')
}

onMounted(async () => {
  try {
    const res: any = await itemsApi.getWeeklyReview()
    if (res.data.reviewed) {
      close()
      return
    }
    reviewItems.value = res.data.items
    // 如果没有待处理事项，自动关闭弹窗
    if (reviewItems.value.length === 0) {
      close()
      return
    }
  } catch {
    close()
  }
})
</script>
