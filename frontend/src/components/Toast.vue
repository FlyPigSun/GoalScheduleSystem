<template>
  <div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'pointer-events-auto px-4 py-3 rounded-lg shadow-lg max-w-sm flex items-center gap-2 text-sm font-medium',
          typeStyles[toast.type]
        ]"
      >
        <span v-if="toast.type === 'success'" class="text-lg">✓</span>
        <span v-else-if="toast.type === 'error'" class="text-lg">✕</span>
        <span v-else-if="toast.type === 'warning'" class="text-lg">⚠</span>
        <span v-else class="text-lg">ℹ</span>
        <span>{{ toast.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useToastStore } from '../stores/toast'

const toastStore = useToastStore()
const toasts = computed(() => toastStore.toasts)

const typeStyles = {
  success: 'bg-green-50 text-green-800 border border-green-200',
  error: 'bg-red-50 text-red-800 border border-red-200',
  warning: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
  info: 'bg-blue-50 text-blue-800 border border-blue-200'
}
</script>

<style scoped>
.toast-enter-active {
  animation: slide-in 0.3s ease-out;
}

.toast-leave-active {
  animation: slide-out 0.3s ease-in;
}

@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slide-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
</style>
