<template>
  <div v-if="item" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" @click.self="close">
    <div class="bg-white w-full sm:w-[480px] lg:w-[520px] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 lg:p-8 shadow-xl animate-slide-up max-h-[90vh] overflow-y-auto">
      <!-- 编辑模式 -->
      <template v-if="isEditing">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-600 mb-1.5">事项名称</label>
          <input 
            v-model="editForm.title" 
            maxlength="50" 
            placeholder="请输入事项名称"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-200" 
          />
          <div class="text-xs text-gray-400 text-right mt-1">{{ editForm.title.length }}/50</div>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-600 mb-1.5">描述</label>
          <textarea 
            v-model="editForm.description" 
            maxlength="200" 
            rows="3" 
            placeholder="请输入描述（可选）"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
          />
          <div class="text-xs text-gray-400 text-right mt-1">{{ editForm.description.length }}/200</div>
        </div>
        
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1.5">截止日期</label>
            <input 
              v-model="editForm.due_date" 
              type="date"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" 
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1.5">优先级</label>
            <select 
              v-model="editForm.priority"
              class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            >
              <option value="P0">P0 紧急</option>
              <option value="P1">P1 重要</option>
              <option value="P2">P2 一般</option>
            </select>
          </div>
        </div>
        
        <div class="mb-5">
          <label class="block text-sm font-medium text-gray-600 mb-1.5">所属板块</label>
          <select 
            v-model="editForm.department_id"
            class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
          >
            <option :value="null">综合</option>
            <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </div>
        
        <div class="flex gap-3">
          <button 
            @click="cancelEdit"
            class="flex-1 py-3 text-sm font-medium rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
          >
            取消
          </button>
          <button 
            @click="saveEdit"
            :disabled="!editForm.title.trim() || saving"
            class="flex-1 py-3 text-sm font-medium rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-all"
          >
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </template>
      
      <!-- 查看模式 -->
      <template v-else>
        <!-- 标题和编辑按钮 -->
        <div class="flex items-start justify-between mb-2">
          <h3 class="font-semibold text-base sm:text-lg lg:text-xl flex-1 pr-2">{{ item.title }}</h3>
          <button 
            @click="startEdit"
            class="text-gray-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 transition-all"
            title="编辑"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
        
        <!-- 描述 -->
        <p v-if="item.description" class="text-xs sm:text-sm text-gray-500 mb-4 lg:mb-5 line-clamp-3">{{ item.description }}</p>
        
        <!-- 详情信息 -->
        <div class="space-y-2 sm:space-y-2.5 text-xs sm:text-sm mb-5 lg:mb-6 bg-gray-50 rounded-xl p-3 sm:p-4">
          <div class="flex justify-between py-1">
            <span class="text-gray-400">截止日期</span>
            <span class="font-medium">{{ formatDate(item.due_date) }}</span>
          </div>
          <div class="flex justify-between py-1 items-center">
            <span class="text-gray-400">所属板块</span>
            <select 
              v-model="item.department_id"
              @change="handleDepartmentChange"
              class="font-medium bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
            >
              <option :value="null">综合</option>
              <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
          <div v-if="item.priority" class="flex justify-between py-1">
            <span class="text-gray-400">优先级</span>
            <span class="font-medium" :class="getPriorityClass(item.priority)">{{ item.priority }}</span>
          </div>
          <div v-if="item.postpone_count > 0" class="flex justify-between py-1">
            <span class="text-gray-400">延期次数</span>
            <span class="font-medium text-red-500">{{ item.postpone_count }}次</span>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="space-y-3">
          <!-- 完成按钮 -->
          <button 
            v-if="item.status !== 3 && item.status !== 'completed'" 
            @click="handleComplete"
            :disabled="processing"
            class="w-full py-3.5 text-base font-semibold rounded-xl bg-green-500 text-white hover:bg-green-600 active:bg-green-700 transition-all shadow-sm"
          >
            ✓ 标记完成
          </button>
          
          <!-- 删除和顺延 -->
          <div class="grid grid-cols-3 gap-3">
            <button 
              @click="handleDelete"
              :disabled="processing"
              class="py-3 text-sm font-medium rounded-xl bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 transition-all"
            >
              ✕ 删除
            </button>
            <div class="col-span-2 flex gap-2">
              <input 
                type="date" 
                v-model="postponeDate"
                class="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                :min="todayStr" 
              />
              <button 
                @click="handlePostpone"
                :disabled="!postponeDate || processing"
                class="px-4 py-2.5 text-sm font-medium rounded-xl bg-amber-100 text-amber-700 hover:bg-amber-200 active:bg-amber-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                顺延
              </button>
            </div>
          </div>
          
          <!-- 关闭按钮 -->
          <button 
            @click="close"
            class="w-full py-3 text-sm font-medium rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
          >
            关闭
          </button>
        </div>
        
        <!-- 状态消息 -->
        <div v-if="statusMsg" class="text-sm mt-4 text-center font-medium py-2 rounded-lg" :class="statusOk ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'">
          {{ statusMsg }}
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { itemsApi } from '../api'
import { useAppStore } from '../stores/app'

const props = defineProps<{
  item: any
}>()

const emit = defineEmits<{
  close: []
  updated: []
}>()

const store = useAppStore()
const departments = store.departments

// 编辑状态
const isEditing = ref(false)
const saving = ref(false)
const editForm = ref({
  title: '',
  description: '',
  due_date: '',
  priority: 'P1',
  department_id: null as number | null
})

// 操作状态
const postponeDate = ref('')
const statusMsg = ref('')
const statusOk = ref(false)
const processing = ref(false)
const todayStr = new Date().toISOString().slice(0, 10)

// 监听item变化，初始化数据
watch(() => props.item, (newItem) => {
  if (newItem) {
    isEditing.value = false
    statusMsg.value = ''
    // 默认顺延日期为一周后
    const d = new Date(newItem.due_date || new Date())
    d.setDate(d.getDate() + 7)
    postponeDate.value = d.toISOString().slice(0, 10)
  }
}, { immediate: true })

function close() {
  emit('close')
}

function startEdit() {
  editForm.value = {
    title: props.item.title || '',
    description: props.item.description || '',
    due_date: props.item.due_date || '',
    priority: props.item.priority || 'P1',
    department_id: props.item.department_id || null
  }
  isEditing.value = true
  statusMsg.value = ''
}

function cancelEdit() {
  isEditing.value = false
  statusMsg.value = ''
}

async function saveEdit() {
  if (!editForm.value.title.trim()) return
  
  saving.value = true
  try {
    await itemsApi.update(props.item.id, {
      title: editForm.value.title.trim(),
      description: editForm.value.description.trim(),
      due_date: editForm.value.due_date,
      priority: editForm.value.priority,
      department_id: editForm.value.department_id
    })
    
    // 更新本地数据
    props.item.title = editForm.value.title.trim()
    props.item.description = editForm.value.description.trim()
    props.item.due_date = editForm.value.due_date
    props.item.priority = editForm.value.priority
    props.item.department_id = editForm.value.department_id
    
    // 更新部门名称显示
    const dept = departments.find(d => d.id === editForm.value.department_id)
    props.item.department_name = dept?.name || ''
    
    isEditing.value = false
    showStatus('✓ 已保存', true)
    emit('updated')
  } catch (e: any) {
    showStatus(e.message || '保存失败', false)
  } finally {
    saving.value = false
  }
}

async function handleComplete() {
  processing.value = true
  try {
    await itemsApi.update(props.item.id, { status: 3 })
    props.item.status = 3
    showStatus('✓ 已标记完成', true)
    setTimeout(() => {
      close()
      emit('updated')
    }, 800)
  } catch (e: any) {
    showStatus(e.message || '操作失败', false)
  } finally {
    processing.value = false
  }
}

async function handleDelete() {
  if (!confirm('确定要删除「' + props.item.title + '」吗？')) return
  
  processing.value = true
  try {
    await itemsApi.delete(props.item.id)
    showStatus('✓ 已删除', true)
    setTimeout(() => {
      close()
      emit('updated')
    }, 600)
  } catch (e: any) {
    showStatus(e.message || '操作失败', false)
  } finally {
    processing.value = false
  }
}

async function handlePostpone() {
  if (!postponeDate.value) return
  
  processing.value = true
  try {
    await itemsApi.postpone(props.item.id, postponeDate.value)
    showStatus(`✓ 已顺延至 ${postponeDate.value}`, true)
    setTimeout(() => {
      close()
      emit('updated')
    }, 1000)
  } catch (e: any) {
    showStatus(e.message || '操作失败', false)
  } finally {
    processing.value = false
  }
}

async function handleDepartmentChange() {
  const newDeptId = props.item.department_id
  try {
    await itemsApi.update(props.item.id, {
      department_id: newDeptId
    })
    // 更新本地部门名称显示
    const dept = departments.find(d => d.id === newDeptId)
    props.item.department_name = dept?.name || ''
    showStatus('✓ 板块已更新', true)
    emit('updated')
  } catch (e: any) {
    showStatus(e.message || '更新失败', false)
  }
}

function showStatus(msg: string, ok: boolean) {
  statusMsg.value = msg
  statusOk.value = ok
  if (!ok) {
    setTimeout(() => {
      statusMsg.value = ''
    }, 3000)
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '未设置'
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${Number(parts[1])}月${Number(parts[2])}日`
}

function getPriorityClass(priority: string): string {
  switch (priority) {
    case 'P0': return 'text-red-600'
    case 'P1': return 'text-yellow-600'
    default: return 'text-gray-600'
  }
}
</script>

<style scoped>
@keyframes slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.animate-slide-up {
  animation: slide-up 0.2s ease-out;
}
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
