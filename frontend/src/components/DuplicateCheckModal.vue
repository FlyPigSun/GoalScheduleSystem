<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div class="bg-white w-full max-w-4xl mx-4 rounded-2xl shadow-xl animate-slide-up max-h-[90vh] flex flex-col">
      <!-- 头部 -->
      <div class="flex items-center justify-between p-5 border-b border-gray-100">
        <h3 class="font-semibold text-lg text-gray-800">🔍 重复检测确认</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">✕</button>
      </div>

      <!-- 统计信息 -->
      <div class="px-5 py-3 bg-blue-50/70 border-b border-gray-100 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-600">共 <strong class="text-blue-600">{{ localItems.length }}</strong> 个待办</span>
          <span v-if="checking" class="text-sm text-blue-600">
            <span class="inline-block animate-spin mr-1">⟳</span> 正在检测重复...
          </span>
          <span v-else-if="duplicateCount > 0" class="text-sm text-red-600">
            ⚠️ 发现 <strong>{{ duplicateCount }}</strong> 个重复项待确认
          </span>
          <span v-else class="text-sm text-green-600">
            ✅ 未发现重复任务
          </span>
        </div>
        <div class="text-xs text-gray-500">
          第 2/2 步
        </div>
      </div>

      <!-- 待办列表 -->
      <div class="flex-1 overflow-y-auto p-5">
        <div v-if="checking" class="flex flex-col items-center justify-center h-64 text-gray-400">
          <div class="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <p>正在检测与已有任务的重复情况...</p>
        </div>
        
        <div v-else-if="localItems.length === 0" class="flex flex-col items-center justify-center h-64 text-gray-400">
          <p>没有待导入的任务</p>
        </div>
        
        <div v-else class="space-y-3">
          <div
            v-for="item in localItems"
            :key="item.tempId"
            class="rounded-xl p-4 transition-all"
            :class="getItemClass(item)"
          >
            <div class="flex items-start gap-3">
              <div class="mt-0.5">
                <div 
                  class="w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all"
                  :class="item.status === 'skip' ? 'bg-orange-500 border-orange-500' : 'bg-green-500 border-green-500'"
                >
                  <span v-if="item.status === 'skip'" class="text-white text-xs">−</span>
                  <span v-else class="text-white text-xs">✓</span>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <!-- 标题行 -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1">
                    <div class="font-medium text-sm text-gray-900">
                      {{ item.title || '（无主题）' }}
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <span class="text-xs px-2.5 py-1 rounded-lg font-medium" :class="getPriorityClass(item.priority)">
                      {{ item.priority }}
                    </span>
                    <span class="text-xs px-2.5 py-1 bg-gray-100 rounded-lg font-medium text-gray-600">{{ item.department_name }}</span>
                  </div>
                </div>
                <!-- 描述 -->
                <div class="mt-1.5 text-xs text-gray-500 line-clamp-2">
                  {{ item.description || '（无描述）' }}
                </div>
                <!-- 完成时间 -->
                <div class="mt-2 flex items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600">
                    <span>📅</span>
                    <span>完成节点: {{ item.due_date || '未设置' }}</span>
                  </span>
                </div>
                <!-- 重复提示 -->
                <div v-if="item.duplicateInfo" class="mt-3 bg-orange-50 rounded-lg p-3 border border-orange-100">
                  <div class="text-xs text-orange-600 font-medium mb-1">⚠️ 与已有任务重复</div>
                  <div class="text-sm text-gray-800">{{ item.duplicateInfo.existingTitle }}</div>
                  <div class="text-xs text-gray-500 mt-0.5">
                    {{ item.duplicateInfo.existingDept }} · 
                    <span :class="getExistingStatusClass(item.duplicateInfo.existingStatus)">
                      {{ getExistingStatusText(item.duplicateInfo.existingStatus) }}
                    </span>
                  </div>
                  <div v-if="item.duplicateInfo.existingDueDate" class="text-xs text-gray-400 mt-1">截止: {{ item.duplicateInfo.existingDueDate }}</div>
                  <!-- 操作按钮 -->
                  <div class="flex gap-2 mt-3">
                    <button 
                      @click="item.status = 'skip'"
                      class="flex-1 text-xs px-3 py-2 rounded-lg font-medium transition-colors"
                      :class="item.status === 'skip' ? 'bg-orange-500 text-white' : 'bg-white text-orange-600 ring-1 ring-orange-200 hover:bg-orange-50'"
                    >跳过此任务</button>
                    <button 
                      @click="item.status = 'import'"
                      class="flex-1 text-xs px-3 py-2 rounded-lg font-medium transition-colors"
                      :class="item.status === 'import' ? 'bg-blue-500 text-white' : 'bg-white text-blue-600 ring-1 ring-blue-200 hover:bg-blue-50'"
                    >确认为新任务</button>
                  </div>
                </div>
                <!-- 非重复项状态 -->
                <div v-else class="mt-2 flex items-center gap-2">
                  <span class="text-xs text-green-600 font-medium">✓ 无重复，将导入</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作 -->
      <div class="border-t border-gray-100 p-5 flex items-center justify-between bg-gray-50/50 rounded-b-2xl">
        <div class="text-sm text-gray-500">
          <span v-if="!checking">将导入 <strong class="text-green-600">{{ itemsToImport.length }}</strong> 个，跳过 <strong class="text-orange-600">{{ itemsToSkip.length }}</strong> 个</span>
        </div>
        <div class="flex gap-3">
          <button @click="$emit('close')" class="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium">取消</button>
          <button @click="goBack" :disabled="importing" class="px-5 py-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors font-medium">返回上一步</button>
          <button 
            @click="confirmImport"
            :disabled="importing || itemsToImport.length === 0"
            class="px-6 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
          >
            {{ importing ? '导入中...' : '下一步' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import api, { confirmUpload } from '../api'
import { useToastStore } from '../stores/toast'
import { findByTempId } from '../utils/helpers'

const toast = useToastStore()

const props = defineProps<{
  items: any[]
}>()

const emit = defineEmits<{
  close: []
  done: []
  back: [items: any[]]
}>()

const localItems = ref<any[]>([])
const checking = ref(true)
const importing = ref(false)

const itemsToImport = computed(() => localItems.value.filter(i => i.status === 'import'))
const itemsToSkip = computed(() => localItems.value.filter(i => i.status === 'skip'))
const duplicateCount = computed(() => localItems.value.filter(i => i.duplicateInfo).length)

onMounted(() => {
  // 初始化本地数据，默认所有都导入
  localItems.value = props.items.map(item => ({
    ...item,
    status: 'import' // import 或 skip
  }))
  // 开始检测重复
  checkDuplicates()
})

async function checkDuplicates() {
  checking.value = true
  
  try {
    const response: any = await api.post('/duplicates/check-existing', {
      items: localItems.value
    })

    if (response.success) {
      const duplicates = response.duplicates
      
      // 将重复信息绑定到对应项
      duplicates.forEach((dup: any) => {
        const item = findByTempId(localItems.value, dup.newItem?.tempId)
        if (item) {
          item.duplicateInfo = {
            existingId: dup.existingItem?.id,
            existingTitle: dup.existingItem?.title,
            existingDept: dup.existingItem?.department_name,
            existingStatus: dup.existingItem?.status,
            existingDueDate: dup.existingItem?.due_date
          }
        }
      })
    }
  } catch (error) {
    console.error('重复检测失败:', error)
  } finally {
    checking.value = false
  }
}

function getItemClass(item: any) {
  if (item.status === 'skip') {
    return 'bg-orange-50/50 ring-1 ring-orange-200 opacity-70'
  }
  if (item.duplicateInfo) {
    return 'bg-white ring-1 ring-orange-200'
  }
  return 'bg-white ring-1 ring-gray-100'
}

function getPriorityClass(priority: string) {
  switch (priority) {
    case 'P0': return 'bg-red-100 text-red-700'
    case 'P1': return 'bg-yellow-100 text-yellow-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function getExistingStatusClass(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-600'
    case 'in_progress': return 'text-blue-600'
    case 'pending': return 'text-gray-500'
    case 'deferred': return 'text-orange-600'
    default: return 'text-gray-500'
  }
}

function getExistingStatusText(status: string): string {
  switch (status) {
    case 'completed': return '已完成'
    case 'in_progress': return '进行中'
    case 'pending': return '待处理'
    case 'deferred': return '已顺延'
    default: return status
  }
}

function goBack() {
  // 返回上一步，把当前数据传回去
  const itemsWithoutStatus = localItems.value.map(({ status, duplicateInfo, ...item }) => item)
  emit('back', itemsWithoutStatus)
}

async function confirmImport() {
  if (itemsToImport.value.length === 0) return
  
  importing.value = true
  try {
    await confirmUpload(itemsToImport.value)
    emit('done')
  } catch (err: any) {
    toast.error('导入失败: ' + (err?.message || '未知错误'))
  } finally {
    importing.value = false
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
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
