<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div class="bg-white w-full max-w-4xl mx-4 rounded-2xl shadow-xl animate-slide-up max-h-[90vh] flex flex-col">
      <!-- 头部 -->
      <div class="flex items-center justify-between p-5 border-b border-gray-100">
        <h3 class="font-semibold text-lg text-gray-800">📋 确认导入事项</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">✕</button>
      </div>

      <!-- 统计信息 -->
      <div class="px-5 py-3 bg-blue-50/70 border-b border-gray-100 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-600">共识别 <strong class="text-blue-600">{{ localItems.length }}</strong> 个事项</span>
          <span class="text-sm text-gray-600">已选择 <strong class="text-green-600">{{ selectedItems.length }}</strong> 个</span>
          <span v-if="itemsWithoutDeadline.length > 0" class="text-sm text-orange-600">
            ⚠️ <strong>{{ itemsWithoutDeadline.length }}</strong> 个待办无完成时间
          </span>
        </div>
        <div class="flex gap-2">
          <button 
            @click="selectAll" 
            class="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
          >
            全选
          </button>
          <button 
            @click="deselectAll" 
            class="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
          >
            清空
          </button>
        </div>
      </div>

      <!-- 事项列表 -->
      <div class="flex-1 overflow-y-auto p-5">
        <div class="space-y-3">
          <div
            v-for="item in localItems"
            :key="item.tempId"
            class="rounded-xl p-4 transition-all hover:shadow-md"
            :class="[
              selectedItems.includes(item.tempId) ? 'bg-blue-50/70 ring-1 ring-blue-200' : 'bg-white ring-1 ring-gray-100',
              !item.due_date && selectedItems.includes(item.tempId) ? 'bg-orange-50/50 ring-1 ring-orange-200' : ''
            ]"
          >
            <div class="flex items-start gap-3">
              <div class="mt-0.5" @click.stop="toggleItem(item.tempId)">
                <div 
                  class="w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer"
                  :class="selectedItems.includes(item.tempId) ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-gray-400'"
                >
                  <span v-if="selectedItems.includes(item.tempId)" class="text-white text-xs">✓</span>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <!-- 标题行 -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1">
                    <!-- 标题编辑 -->
                    <div v-if="editingTitleId === item.tempId" class="flex items-center gap-2">
                      <input
                        v-model="item.title"
                        type="text"
                        class="flex-1 px-2 py-1 text-sm border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="输入待办主题"
                        @blur="finishEditingTitle"
                        @keydown.enter="finishEditingTitle"
                        @keydown.esc="cancelEditingTitle(item)"
                        :ref="(el: any) => { if (el) titleInputRef = el }"
                      />
                    </div>
                    <div
                      v-else
                      class="font-medium text-sm text-gray-900 cursor-pointer hover:bg-blue-50 px-2 -mx-2 py-1 rounded-lg transition-colors"
                      @click="startEditingTitle(item.tempId)"
                      title="点击编辑主题"
                    >
                      {{ item.title || '（无主题）' }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <!-- 优先级编辑 -->
                    <div v-if="editingPriorityId === item.tempId" class="relative">
                      <select
                        v-model="item.priority"
                        class="text-xs px-2 py-1 border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white cursor-pointer"
                        @change="finishEditingPriority"
                        @blur="finishEditingPriority"
                        :ref="(el: any) => { if (el) prioritySelectRef = el }"
                      >
                        <option v-for="opt in PRIORITY_OPTIONS" :key="opt.value" :value="opt.value">
                          {{ opt.label }}
                        </option>
                      </select>
                    </div>
                    <span 
                      v-else
                      class="text-xs px-2.5 py-1 rounded-lg font-medium cursor-pointer hover:opacity-80 transition-opacity"
                      :class="getPriorityClass(item.priority)"
                      @click="startEditingPriority(item.tempId)"
                      title="点击修改优先级"
                    >
                      {{ item.priority }}
                    </span>
                    
                    <!-- 部门编辑 -->
                    <div v-if="editingDeptId === item.tempId" class="relative">
                      <select
                        v-model="item.department_id"
                        class="text-xs px-2 py-1 border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white cursor-pointer"
                        @change="finishEditingDept"
                        @blur="finishEditingDept"
                        :ref="(el: any) => { if (el) deptSelectRef = el }"
                      >
                        <option :value="null">综合</option>
                        <option v-for="dept in DEPARTMENTS" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
                      </select>
                    </div>
                    <span 
                      v-else
                      class="text-xs px-2.5 py-1 bg-gray-100 rounded-lg font-medium text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors"
                      @click="startEditingDept(item.tempId)"
                      title="点击修改部门"
                    >
                      {{ item.department_name }}
                    </span>
                  </div>
                </div>
                  <!-- 描述编辑 -->
                <div class="mt-1.5">
                  <div v-if="editingDescId === item.tempId">
                    <textarea
                      v-model="item.description"
                      rows="3"
                      class="w-full px-2 py-1.5 text-xs border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                      placeholder="输入待办描述"
                      @blur="finishEditingDesc"
                      @keydown.esc="cancelEditingDesc(item)"
                      :ref="(el: any) => { if (el) descInputRef = el }"
                    ></textarea>
                  </div>
                  <div
                    v-else
                    class="text-xs text-gray-500 cursor-pointer hover:bg-gray-50 px-2 -mx-2 py-1.5 rounded-lg transition-colors line-clamp-2"
                    :class="item.description ? '' : 'text-gray-400 italic'"
                    @click="startEditingDesc(item.tempId)"
                    title="点击编辑描述"
                  >
                    {{ item.description || '（无描述，点击添加）' }}
                  </div>
                </div>
                <!-- 完成节点（截止日期）- 突出显示 -->
                <div class="mt-3 flex items-center gap-2 flex-wrap">
                  <!-- 有完成时间 -->
                  <span 
                    v-if="item.due_date"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                    :class="getDueDateClass(item.due_date)"
                  >
                    <span>📅</span>
                    <span>完成节点: {{ formatDueDate(item.due_date) }}</span>
                  </span>
                  <!-- 无完成时间 - 警告状态 -->
                  <span 
                    v-else
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 ring-1 ring-red-200"
                  >
                    <span>⚠️</span>
                    <span>无明确完成时间</span>
                  </span>
                  <!-- 操作按钮 - 所有任务都显示 -->
                  <button 
                    @click.stop="openDatePicker(item.tempId)"
                    class="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-sm font-medium"
                  >
                    {{ item.due_date ? '修改时间' : '设置时间' }}
                  </button>
                  <button 
                    @click.stop="removeItem(item.tempId)"
                    class="text-xs px-3 py-1.5 bg-red-50 text-red-600 ring-1 ring-red-200 rounded-lg hover:bg-red-100 active:bg-red-200 transition-colors font-medium"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作 -->
      <div class="border-t border-gray-100 p-5 flex items-center justify-between bg-gray-50/50 rounded-b-2xl">
        <div class="text-sm" :class="selectedWithoutDeadline.length > 0 ? 'text-orange-600' : 'text-gray-500'">
          <span v-if="selectedWithoutDeadline.length > 0">
            ⚠️ 还有 {{ selectedWithoutDeadline.length }} 个待办未设置完成时间
          </span>
          <span v-else>提示：无完成时间的待办需设置时间或删除</span>
        </div>
        <div class="flex gap-3">
          <button 
            @click="$emit('close')"
            class="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
          >
            取消
          </button>
          <button 
            @click="goToNextStep"
            :disabled="selectedItems.length === 0 || selectedWithoutDeadline.length > 0"
            class="px-6 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
          >
            下一步 →
          </button>
        </div>
      </div>
    </div>

    <!-- 日历选择器弹窗 -->
    <DatePicker 
      v-if="showDatePicker" 
      title="设置完成时间"
      @close="showDatePicker = false"
      @confirm="onDateConfirm"
    />

    <!-- 批量设置日期弹窗 -->
    <DatePicker 
      v-if="showBatchDatePicker" 
      title="批量设置完成时间"
      :subtitle="`将为 ${selectedWithoutDeadline.length} 个待办设置相同的时间`"
      :showQuickOptions="false"
      @close="showBatchDatePicker = false"
      @confirm="onBatchDateConfirm"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { findByTempId } from '../utils/helpers'
import { DEPARTMENTS } from '../config/departments'
import DatePicker from './DatePicker.vue'

// 优先级选项
const PRIORITY_OPTIONS = [
  { value: 'P0', label: 'P0 紧急', class: 'bg-red-100 text-red-700' },
  { value: 'P1', label: 'P1 重要', class: 'bg-yellow-100 text-yellow-700' },
  { value: 'P2', label: 'P2 一般', class: 'bg-gray-100 text-gray-700' }
]

const props = defineProps<{
  items: any[]
}>()

const emit = defineEmits<{
  close: []
  next: [items: any[]]
}>()

// 使用本地副本，允许修改
// 使用全局计数器确保 tempId 唯一，避免与传入数据的 tempId 冲突
let tempIdCounter = Date.now()
const localItems = ref(props.items.map((item) => ({
  ...item,
  tempId: tempIdCounter++
})))
const selectedItems = ref<number[]>(localItems.value.map(i => i.tempId))





// 日期选择器状态
const showDatePicker = ref(false)
const showBatchDatePicker = ref(false)
const editingItemId = ref<number | null>(null)

// 编辑状态
const editingTitleId = ref<number | null>(null)
const editingDescId = ref<number | null>(null)
const editingPriorityId = ref<number | null>(null)
const editingDeptId = ref<number | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)
const descInputRef = ref<HTMLTextAreaElement | null>(null)
const prioritySelectRef = ref<HTMLSelectElement | null>(null)
const deptSelectRef = ref<HTMLSelectElement | null>(null)
const originalTitle = ref('')
const originalDesc = ref('')

// 计算属性：没有截止日期的待办
const itemsWithoutDeadline = computed(() => {
  return localItems.value.filter(item => !item.due_date)
})

// 计算属性：选中的待办中，没有截止日期的
const selectedWithoutDeadline = computed(() => {
  return localItems.value.filter(item => 
    selectedItems.value.includes(item.tempId) && !item.due_date
  )
})



function toggleItem(tempId: number) {
  const index = selectedItems.value.indexOf(tempId)
  if (index > -1) {
    selectedItems.value.splice(index, 1)
  } else {
    selectedItems.value.push(tempId)
  }
}

function selectAll() {
  selectedItems.value = localItems.value.map(i => i.tempId)
}

function deselectAll() {
  selectedItems.value = []
}

// 删除事项
function removeItem(tempId: number) {
  const index = localItems.value.findIndex(i => i.tempId === tempId)
  if (index > -1) {
    localItems.value.splice(index, 1)
    // 同时从选中列表移除
    const selectedIndex = selectedItems.value.indexOf(tempId)
    if (selectedIndex > -1) {
      selectedItems.value.splice(selectedIndex, 1)
    }
  }
}

// 打开日期选择器
function openDatePicker(tempId: number) {
  editingItemId.value = tempId
  showDatePicker.value = true
}

// 确认设置日期
function onDateConfirm(date: string) {
  if (!editingItemId.value) return
  
  const item = findByTempId(localItems.value, editingItemId.value)
  if (item) {
    item.due_date = date
  }
  
  showDatePicker.value = false
  editingItemId.value = null
}

// 确认批量设置日期
function onBatchDateConfirm(date: string) {
  selectedWithoutDeadline.value.forEach(item => {
    item.due_date = date
  })
  
  showBatchDatePicker.value = false
}

function getPriorityClass(priority: string) {
  switch (priority) {
    case 'P0': return 'bg-red-100 text-red-700'
    case 'P1': return 'bg-yellow-100 text-yellow-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function getDueDateClass(dueDate: string) {
  if (!dueDate) return 'bg-gray-100 text-gray-500'
  const today = new Date()
  const due = new Date(dueDate)
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return 'bg-red-100 text-red-700 border border-red-200' // 已逾期
  if (diffDays <= 3) return 'bg-orange-100 text-orange-700 border border-orange-200' // 3天内到期
  if (diffDays <= 7) return 'bg-yellow-100 text-yellow-700 border border-yellow-200' // 一周内到期
  return 'bg-green-100 text-green-700 border border-green-200' // 时间充裕
}

function formatDueDate(dueDate: string) {
  if (!dueDate) return ''
  const date = new Date(dueDate)
  const today = new Date()
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  let diffText = ''
  if (diffDays === 0) diffText = '（今天）'
  else if (diffDays === 1) diffText = '（明天）'
  else if (diffDays === -1) diffText = '（昨天）'
  else if (diffDays > 0) diffText = `（还有${diffDays}天）`
  else diffText = `（已逾期${Math.abs(diffDays)}天）`
  
  return `${dueDate}${diffText}`
}



// 编辑主题
function startEditingTitle(tempId: number) {
  editingTitleId.value = tempId
  const item = findByTempId(localItems.value, tempId)
  if (item) {
    originalTitle.value = item.title
  }
  // 聚焦输入框
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

function finishEditingTitle() {
  editingTitleId.value = null
  originalTitle.value = ''
}

function cancelEditingTitle(item: any) {
  item.title = originalTitle.value
  editingTitleId.value = null
  originalTitle.value = ''
}

// 编辑描述
function startEditingDesc(tempId: number) {
  editingDescId.value = tempId
  const item = localItems.value.find(i => i.tempId === tempId)
  if (item) {
    originalDesc.value = item.description
  }
  // 聚焦输入框
  nextTick(() => {
    descInputRef.value?.focus()
    descInputRef.value?.select()
  })
}

function finishEditingDesc() {
  editingDescId.value = null
  originalDesc.value = ''
}

function cancelEditingDesc(item: any) {
  item.description = originalDesc.value
  editingDescId.value = null
  originalDesc.value = ''
}

// 编辑优先级
function startEditingPriority(tempId: number) {
  editingPriorityId.value = tempId
  nextTick(() => {
    prioritySelectRef.value?.focus()
  })
}

function finishEditingPriority() {
  editingPriorityId.value = null
}

// 编辑部门
function startEditingDept(tempId: number) {
  editingDeptId.value = tempId
  nextTick(() => {
    deptSelectRef.value?.focus()
  })
}

function finishEditingDept() {
  // 更新部门名称
  const item = localItems.value.find(i => i.tempId === editingDeptId.value)
  if (item) {
    const dept = DEPARTMENTS.find(d => d.id === item.department_id)
    item.department_name = dept?.name || '综合'
  }
  editingDeptId.value = null
}

// 进入下一步：重复检测
function goToNextStep() {
  if (selectedItems.value.length === 0) return
  
  // 只传递选中的事项到下一步
  const itemsToPass = localItems.value.filter(i => selectedItems.value.includes(i.tempId))
  emit('next', itemsToPass)
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
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
