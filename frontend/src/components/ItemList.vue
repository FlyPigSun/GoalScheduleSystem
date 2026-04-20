<template>
  <div class="item-list">
    <div v-for="it in items" :key="'row-' + it.id"
         class="item-row"
         :class="{ 'compact': compact }"
         @click="openDetail(it)">
      <div
        class="item-indicator"
        :class="store.getUrgencyClass(store.getDaysUntil(it.due_date))"
      />
      <div class="flex-1 min-w-0">
        <div class="text-truncate" :class="compact ? 'font-medium text-sm' : 'font-medium text-base'">{{ it.title }}</div>
        <div v-if="it.postpone_count > 0 && !compact" class="text-sm text-red-500 mt-0.5">
          延期 {{ it.postpone_count }} 次
        </div>
      </div>

      <!-- Compact mode: inline meta -->
      <template v-if="compact">
        <span v-if="it.postpone_count > 0" class="text-sm text-red-500 font-medium mr-1.5">↻{{ it.postpone_count }}</span>
        <span class="text-sm text-gray-500 whitespace-nowrap">{{ store.formatDate(it.due_date) }}</span>
      </template>
    </div>

    <div v-if="items.length === 0" class="text-center text-gray-400 py-6 text-base">
      {{ emptyText }}
    </div>

    <!-- Detail Modal - 与日历视图一致 -->
    <div v-if="detailItem" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30" @click.self="detailItem = null">
      <div class="bg-white w-full sm:w-[420px] rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-xl animate-slide-up">
        <!-- 标题 - 可编辑 -->
        <div class="mb-1">
          <div v-if="!editingTitle" 
               @click="startEditTitle"
               class="font-semibold text-base sm:text-lg cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 transition-colors">
            {{ detailItem.title }}
            <span class="text-gray-300 text-xs font-normal ml-1">✎</span>
          </div>
          <input v-else
                 ref="titleInput"
                 v-model="editTitle"
                 @blur="saveTitle"
                 @keyup.enter="saveTitle"
                 @keyup.esc="cancelEditTitle"
                 class="w-full font-semibold text-base sm:text-lg border-b-2 border-blue-500 outline-none px-1 -mx-1"
                 placeholder="输入标题..." />
        </div>

        <!-- 描述 - 可编辑 -->
        <div class="mb-3 lg:mb-4">
          <div v-if="!editingDesc" 
               @click="startEditDesc"
               class="text-xs sm:text-sm text-gray-500 cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 transition-colors min-h-[1.5em]">
            {{ detailItem.description || '点击添加描述...' }}
            <span v-if="detailItem.description" class="text-gray-300 text-xs ml-1">✎</span>
          </div>
          <textarea v-else
                    ref="descInput"
                    v-model="editDesc"
                    @blur="saveDesc"
                    @keyup.ctrl.enter="saveDesc"
                    @keyup.esc="cancelEditDesc"
                    rows="3"
                    class="w-full text-xs sm:text-sm border-b-2 border-blue-500 outline-none px-1 -mx-1 resize-none"
                    placeholder="输入描述...Ctrl+Enter 保存"></textarea>
        </div>

        <!-- 信息展示 -->
        <div class="space-y-1.5 sm:space-y-2 text-xs sm:text-sm mb-4 lg:mb-5">
          <div class="flex justify-between py-1 sm:py-1.5 border-b border-gray-50"><span class="text-gray-400">截止日期</span><span class="font-medium">{{ formatDate(detailItem.due_date) }}</span></div>
          <div class="flex justify-between py-1 sm:py-1.5 border-b border-gray-50">
            <span class="text-gray-400">所属板块</span>
            <select v-model="detailItem.department_id" @change="updateDepartment"
                    class="font-medium bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-200 cursor-pointer">
              <option :value="null">综合</option>
              <option v-for="d in store.departments" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </div>
          <div v-if="detailItem.postpone_count > 0" class="flex justify-between py-1 sm:py-1.5 border-b border-gray-50"><span class="text-gray-400">延期次数</span><span class="font-medium text-red-500">{{ detailItem.postpone_count }}次</span></div>
        </div>
        
        <!-- 操作按钮 - 与看板视图统一风格 -->
        <div class="space-y-3">
          <!-- 完成按钮 -->
          <button v-if="detailItem.status !== 'completed'" @click="handleComplete"
                  class="w-full py-3 text-base font-semibold rounded-xl bg-green-500 text-white hover:bg-green-600 active:bg-green-700 transition-all shadow-sm">
            ✓ 完成
          </button>
          
          <!-- 删除和顺延 - 三列布局 -->
          <div class="grid grid-cols-3 gap-3">
            <button @click="handleDelete"
                    class="py-2.5 text-sm font-medium rounded-xl bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200 transition-all">
              ✕ 删除
            </button>
            <div class="col-span-2 flex gap-2">
              <input type="date" v-model="postponeDate"
                     class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                     :min="todayStr" />
              <button @click="handlePostpone"
                      :disabled="!postponeDate"
                      class="px-4 py-2 text-sm font-medium rounded-xl bg-amber-100 text-amber-700 hover:bg-amber-200 active:bg-amber-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                顺延
              </button>
            </div>
          </div>
        </div>
        
        <div v-if="statusMsg" class="text-sm mt-3 text-center font-medium" :class="statusOk ? 'text-green-600' : 'text-red-500'">
          {{ statusMsg }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useAppStore } from '../stores/app'

const props = defineProps<{
  items: any[]
  emptyText?: string
  compact?: boolean
}>()

const emit = defineEmits<{
  (e: 'updated'): void
}>()

const store = useAppStore()
const detailItem = ref<any>(null)
const statusMsg = ref('')
const statusOk = ref(false)
const postponeDate = ref('')

// 编辑状态
const editingTitle = ref(false)
const editingDesc = ref(false)
const editTitle = ref('')
const editDesc = ref('')
const titleInput = ref<HTMLInputElement | null>(null)
const descInput = ref<HTMLTextAreaElement | null>(null)

const todayStr = computed(() => new Date().toISOString().slice(0, 10))

function openDetail(item: any) {
  detailItem.value = item
  statusMsg.value = ''
  editingTitle.value = false
  editingDesc.value = false
  // 默认顺延日期为一周后
  const d = new Date(item.due_date)
  d.setDate(d.getDate() + 7)
  postponeDate.value = d.toISOString().slice(0, 10)
}

// 标题编辑
function startEditTitle() {
  editTitle.value = detailItem.value?.title || ''
  editingTitle.value = true
  nextTick(() => titleInput.value?.focus())
}

async function saveTitle() {
  if (!detailItem.value) return
  const newTitle = editTitle.value.trim()
  if (newTitle && newTitle !== detailItem.value.title) {
    try {
      await store.updateItem(detailItem.value.id, { title: newTitle })
      detailItem.value.title = newTitle
      statusMsg.value = '✓ 标题已更新'
      statusOk.value = true
      setTimeout(() => { statusMsg.value = '' }, 1500)
    } catch (e: any) {
      statusMsg.value = e.message || '更新失败'
      statusOk.value = false
    }
  }
  editingTitle.value = false
}

function cancelEditTitle() {
  editingTitle.value = false
}

// 描述编辑
function startEditDesc() {
  editDesc.value = detailItem.value?.description || ''
  editingDesc.value = true
  nextTick(() => descInput.value?.focus())
}

async function saveDesc() {
  if (!detailItem.value) return
  const newDesc = editDesc.value.trim()
  if (newDesc !== (detailItem.value.description || '')) {
    try {
      await store.updateItem(detailItem.value.id, { description: newDesc })
      detailItem.value.description = newDesc
      statusMsg.value = '✓ 描述已更新'
      statusOk.value = true
      setTimeout(() => { statusMsg.value = '' }, 1500)
    } catch (e: any) {
      statusMsg.value = e.message || '更新失败'
      statusOk.value = false
    }
  }
  editingDesc.value = false
}

function cancelEditDesc() {
  editingDesc.value = false
}

async function handleComplete() {
  if (!detailItem.value) return
  try {
    await store.updateItem(detailItem.value.id, { status: 'completed' })
    detailItem.value.status = 'completed'
    statusMsg.value = '✓ 已标记完成'
    statusOk.value = true
    setTimeout(() => { 
      detailItem.value = null
      emit('updated') 
    }, 800)
  } catch (e: any) {
    statusMsg.value = e.message || '操作失败'
    statusOk.value = false
  }
}

async function handleDelete() {
  if (!detailItem.value) return
  if (!confirm('确定要删除「' + detailItem.value.title + '」吗？')) return
  try {
    await store.deleteItem(detailItem.value.id)
    statusMsg.value = '✓ 已删除'
    statusOk.value = true
    setTimeout(() => { 
      detailItem.value = null
      emit('updated') 
    }, 600)
  } catch (e: any) {
    statusMsg.value = e.message || '操作失败'
    statusOk.value = false
  }
}

async function handlePostpone() {
  if (!detailItem.value || !postponeDate.value) return
  try {
    await store.postponeItem(detailItem.value.id, postponeDate.value)
    statusMsg.value = `✓ 已顺延至 ${postponeDate.value}`
    statusOk.value = true
    setTimeout(() => { 
      detailItem.value = null
      emit('updated') 
    }, 1000)
  } catch (e: any) {
    statusMsg.value = e.message || '操作失败'
    statusOk.value = false
  }
}

async function updateDepartment() {
  if (!detailItem.value) return
  try {
    await store.updateItem(detailItem.value.id, { department_id: detailItem.value.department_id })
    const dept = store.departments.find(d => d.id === detailItem.value.department_id)
    detailItem.value.department_name = dept?.name || ''
    statusMsg.value = '✓ 板块已更新'
    statusOk.value = true
    setTimeout(() => { statusMsg.value = '' }, 1500)
  } catch (e: any) {
    statusMsg.value = e.message || '更新失败'
    statusOk.value = false
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${Number(parts[1])}月${Number(parts[2])}日`
}
</script>

<style scoped>
.item-row {
  cursor: pointer;
  user-select: none;
}

@keyframes slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.animate-slide-up {
  animation: slide-up 0.2s ease-out;
}
</style>
