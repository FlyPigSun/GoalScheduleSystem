<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="p-5 border-b border-gray-100">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-semibold">{{ editId ? '编辑事项' : '新增事项' }}</h3>
          <button @click="close" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
      </div>
      <div class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">事项名称</label>
          <input v-model="form.title" maxlength="20" placeholder="20字以内"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          <div class="text-xs text-gray-400 text-right">{{ form.title.length }}/20</div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">描述（可选）</label>
          <textarea v-model="form.description" maxlength="50" rows="2" placeholder="50字以内"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
          <div class="text-xs text-gray-400 text-right">{{ form.description.length }}/50</div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">截止日期</label>
            <input v-model="form.due_date" type="date"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">优先级</label>
            <select v-model="form.priority"
              class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
              <option value="P0">P0 紧急</option>
              <option value="P1">P1 重要</option>
              <option value="P2">P2 一般</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">所属板块</label>
          <select v-model="form.department_id"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
            <option :value="null">综合</option>
            <option v-for="d in store.departments" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>
      </div>
      <div class="p-5 border-t border-gray-100 flex gap-3">
        <button @click="close" class="btn btn-ghost flex-1">取消</button>
        <button @click="submit" class="btn btn-primary flex-1" :disabled="!form.title.trim()">
          {{ editId ? '保存' : '添加' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { itemsApi } from '../api'
import { useAppStore } from '../stores/app'

const props = defineProps<{ editId?: number; editData?: any }>()
const emit = defineEmits(['close', 'done'])
const store = useAppStore()

const form = reactive({
  title: '',
  description: '',
  due_date: '',
  priority: 'P1',
  department_id: null as number | null
})

onMounted(() => {
  if (props.editData) {
    Object.assign(form, {
      title: props.editData.title,
      description: props.editData.description || '',
      due_date: props.editData.due_date,
      priority: props.editData.priority,
      department_id: props.editData.department_id
    })
  }
})

async function submit() {
  if (!form.title.trim()) return
  if (props.editId) {
    await itemsApi.update(props.editId, form)
  } else {
    await itemsApi.create(form)
  }
  emit('done')
  close()
}

function close() {
  emit('close')
}
</script>
