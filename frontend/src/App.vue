<template>
  <router-view
    @open-form="openForm"
    @open-upload="showUpload = true"
  />

  <!-- Item Form Modal -->
  <ItemForm v-if="showForm" :editId="editId" :editData="editData" @close="showForm = false" @done="onFormDone" />

  <!-- File Upload Modal -->
  <FileUpload v-if="showUpload" @preview="onUploadPreview" @close="showUpload = false" />

  <!-- Upload Preview Modal (Step 1) -->
  <UploadPreview v-if="showPreview" :items="previewItems" @close="closePreview" @next="onPreviewNext" />

  <!-- Duplicate Check Modal (Step 2) -->
  <DuplicateCheckModal v-if="showDuplicateCheck" :items="duplicateCheckItems" @close="closeDuplicateCheck" @done="onDuplicateCheckDone" @back="onDuplicateCheckBack" />

  <!-- Weekly Review Modal -->
  <WeeklyReview v-if="showReview" @close="showReview = false" @done="onReviewDone" />

  <!-- Toast Notifications -->
  <Toast />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from './stores/app'
import ItemForm from './components/ItemForm.vue'
import FileUpload from './components/FileUpload.vue'
import UploadPreview from './components/UploadPreview.vue'
import DuplicateCheckModal from './components/DuplicateCheckModal.vue'
import WeeklyReview from './components/WeeklyReview.vue'
import Toast from './components/Toast.vue'

const store = useAppStore()
const showForm = ref(false)
const showUpload = ref(false)
const showPreview = ref(false)
const showDuplicateCheck = ref(false)
const showReview = ref(false)
const editId = ref<number>()
const editData = ref<any>()
const previewItems = ref<any[]>([])
const duplicateCheckItems = ref<any[]>([])

function openForm() {
  editId.value = undefined
  editData.value = undefined
  showForm.value = true
}

function onFormDone() {
  store.fetchDashboard()
}

function onUploadPreview(items: any[]) {
  previewItems.value = items
  showUpload.value = false
  showPreview.value = true
}

function closePreview() {
  showPreview.value = false
  previewItems.value = []
}

// Step 1: UploadPreview 点击下一步，进入重复检测
function onPreviewNext(items: any[]) {
  showPreview.value = false
  duplicateCheckItems.value = items
  showDuplicateCheck.value = true
}

function closeDuplicateCheck() {
  showDuplicateCheck.value = false
  duplicateCheckItems.value = []
}

// Step 2: DuplicateCheckModal 导入完成
function onDuplicateCheckDone() {
  store.fetchDashboard()
  // 触发全局事件，通知日历等组件刷新数据
  window.dispatchEvent(new CustomEvent('items-imported'))
  closeDuplicateCheck()
}

// Step 2: DuplicateCheckModal 返回上一步
function onDuplicateCheckBack(items: any[]) {
  showDuplicateCheck.value = false
  duplicateCheckItems.value = []
  // 返回第一步，恢复数据
  previewItems.value = items
  showPreview.value = true
}

function onReviewDone() {
  store.fetchDashboard()
}

onMounted(async () => {
  await store.fetchDepartments()
  await store.fetchDashboard()
  // 每次都显示弹窗，由 WeeklyReview 组件根据后端状态决定是否关闭
  showReview.value = true
})
</script>
