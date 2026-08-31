<template>
  <router-view
    @open-form="openForm"
    @open-upload="showUpload = true"
  />

  <!-- Item Form Modal -->
  <ItemForm v-if="showForm" :editId="editId" :editData="editData" @close="showForm = false" @done="onFormDone" />

  <!-- File Upload Modal -->
  <FileUpload v-if="showUpload" @done="onUploadDone" @close="showUpload = false" />

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
import WeeklyReview from './components/WeeklyReview.vue'
import Toast from './components/Toast.vue'

const store = useAppStore()
const showForm = ref(false)
const showUpload = ref(false)
const showReview = ref(false)
const editId = ref<number>()
const editData = ref<any>()

function openForm() {
  editId.value = undefined
  editData.value = undefined
  showForm.value = true
}

function onFormDone() {
  store.fetchDashboard()
}

function onUploadDone() {
  showUpload.value = false
  store.fetchDashboard()
  window.dispatchEvent(new CustomEvent('items-imported'))
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
