<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" @click.self="emit('close')">
    <div class="bg-white rounded-2xl shadow-2xl p-6 w-[360px] animate-slide-up">
      <div class="flex items-center justify-between mb-5">
        <h4 class="font-semibold text-lg text-gray-800">{{ title }}</h4>
        <button @click="emit('close')" class="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">✕</button>
      </div>
      
      <p v-if="subtitle" class="text-sm text-gray-500 mb-4">{{ subtitle }}</p>
      
      <!-- 月份导航 -->
      <div class="flex items-center justify-between mb-4">
        <button @click="changeMonth(-1)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-600">‹</button>
        <span class="font-medium text-gray-800">{{ currentYear }}年{{ currentMonth + 1 }}月</span>
        <button @click="changeMonth(1)" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-600">›</button>
      </div>
      
      <!-- 星期标题 -->
      <div class="grid grid-cols-7 gap-1 mb-2">
        <span v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day" class="text-center text-xs text-gray-400 py-2">{{ day }}</span>
      </div>
      
      <!-- 日历网格 -->
      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="date in calendarDays"
          :key="date.key"
          @click="selectDate(date.fullDate)"
          class="aspect-square flex items-center justify-center text-sm rounded-lg transition-all"
          :class="[
            date.isCurrentMonth ? 'text-gray-700 hover:bg-blue-50' : 'text-gray-300',
            date.isToday ? 'bg-blue-500 text-white hover:bg-blue-600' : '',
            selectedDate === date.fullDate && !date.isToday ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-400' : ''
          ]"
        >
          {{ date.day }}
        </button>
      </div>
      
      <!-- 快捷选项 -->
      <div v-if="showQuickOptions" class="flex gap-2 mt-5">
        <button @click="selectQuickDate(0)" class="flex-1 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">今天</button>
        <button @click="selectQuickDate(7)" class="flex-1 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">一周后</button>
        <button @click="selectQuickDate(30)" class="flex-1 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">一月后</button>
      </div>
      
      <div class="flex gap-3 mt-5">
        <button @click="emit('close')" class="flex-1 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium">取消</button>
        <button @click="confirm" :disabled="!selectedDate" class="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm">确认</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  subtitle?: string
  showQuickOptions?: boolean
}>(), {
  title: '选择日期',
  showQuickOptions: true
})

const emit = defineEmits<{
  close: []
  confirm: [date: string]
}>()

const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth())
const selectedDate = ref('')

// 日历天数计算
const calendarDays = computed(() => {
  const days: { key: string; day: number; fullDate: string; isCurrentMonth: boolean; isToday: boolean }[] = []
  const firstDay = new Date(currentYear.value, currentMonth.value, 1)
  const lastDay = new Date(currentYear.value, currentMonth.value + 1, 0)
  const startDow = firstDay.getDay()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  
  // 上个月的日期
  for (let i = 0; i < startDow; i++) {
    const d = new Date(currentYear.value, currentMonth.value, -i)
    days.unshift({
      key: `prev-${d.getDate()}`,
      day: d.getDate(),
      fullDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      isCurrentMonth: false,
      isToday: false
    })
  }
  
  // 当月日期
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const fullDate = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({
      key: `curr-${d}`,
      day: d,
      fullDate,
      isCurrentMonth: true,
      isToday: fullDate === todayStr
    })
  }
  
  // 下个月的日期（补齐网格）
  const remaining = (7 - (days.length % 7)) % 7
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(currentYear.value, currentMonth.value + 1, d)
    days.push({
      key: `next-${d}`,
      day: d,
      fullDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false,
      isToday: false
    })
  }
  
  return days
})

function changeMonth(delta: number) {
  const newMonth = currentMonth.value + delta
  if (newMonth < 0) {
    currentMonth.value = 11
    currentYear.value--
  } else if (newMonth > 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value = newMonth
  }
}

function selectDate(date: string) {
  selectedDate.value = date
}

function selectQuickDate(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  selectedDate.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function confirm() {
  if (selectedDate.value) {
    emit('confirm', selectedDate.value)
  }
}
</script>
