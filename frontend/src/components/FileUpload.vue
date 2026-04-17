<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="$emit('close')">
    <div class="bg-white w-full max-w-md mx-4 rounded-2xl p-5 shadow-xl animate-slide-up">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-base">📤 上传周报</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 text-lg">✕</button>
      </div>

      <div
        class="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer transition-colors hover:bg-gray-50"
        :class="{ 'bg-blue-50 border-blue-300': isDragging }"
        @dragenter.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @dragover.prevent
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".txt,.md,.xlsx,.xls,.csv,.zip"
          class="hidden"
          @change="handleFileSelect"
        />

        <div v-if="uploading" class="py-4">
          <div class="animate-spin text-2xl mb-2">⏳</div>
          <p class="text-sm text-gray-500">正在解析...</p>
        </div>

        <div v-else class="py-2">
          <div class="text-3xl mb-2">📄</div>
          <p class="text-sm font-medium text-gray-700">点击或拖拽上传周报</p>
          <p class="text-xs text-gray-400 mt-1">支持 .txt .md .xlsx .xls .csv .zip</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { uploadFile } from '../api'
import { useToastStore } from '../stores/toast'

const emit = defineEmits<{
  preview: [items: any[]]
  close: []
}>()

const toast = useToastStore()
const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)
const uploading = ref(false)

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) await uploadFileInternal(file)
}

async function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) await uploadFileInternal(file)
}

async function uploadFileInternal(file: File) {
  if (!file.name.match(/\.(txt|md|xlsx|xls|csv|zip)$/i)) {
    toast.warning('仅支持 .txt .md .xlsx .xls .csv .zip 格式')
    return
  }

  uploading.value = true

  try {
    const result = await uploadFile(file) as any
    if (result.success && result.data?.items && result.data.items.length > 0) {
      emit('preview', result.data.items)
    } else if (!result.success) {
      // 后端明确返回失败（如 AI 解析超时）
      toast.error('解析失败: ' + (result.message || '未知错误'))
    } else if (result.data?.items?.length === 0) {
      // 成功但无事项（Excel 可能返回空）
      toast.warning('未识别到事项，请检查文件格式')
    } else {
      toast.error('解析失败: 返回数据格式异常')
    }
  } catch (err: any) {
    // 处理拦截器返回的错误对象
    if (err && typeof err === 'object') {
      if (err.message) {
        toast.error('上传失败: ' + err.message)
        return
      }
    }
    // 字符串错误或网络错误
    const errorMsg = String(err || '')
    if (errorMsg.includes('timeout') || errorMsg.includes('ETIME')) {
      toast.warning('上传超时：AI 解析服务繁忙，请稍后重试')
    } else if (errorMsg.includes('Network') || errorMsg.includes('ECONNREFUSED')) {
      toast.error('网络错误：无法连接到服务器，请检查服务是否运行')
    } else {
      toast.error('上传失败: ' + (errorMsg || '未知错误'))
    }
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
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
</style>
