<template>
  <div>
    <!-- Month Navigation -->
    <div class="flex items-center justify-between mb-4">
      <button @click="prevMonth" class="w-8 h-8 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors flex items-center justify-center">‹</button>
      <span class="text-sm font-semibold">{{ monthLabel }}</span>
      <div class="flex items-center gap-2">
        <button @click="goToday" class="text-xs px-2.5 py-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100">今天</button>
        <button @click="nextMonth" class="w-8 h-8 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors flex items-center justify-center">›</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-16 text-gray-400">加载中...</div>

    <template v-else>
      <!-- Weekday headers -->
      <div class="grid grid-cols-7 mb-1">
        <span v-for="d in weekdays" :key="d" class="text-center text-xs text-gray-400 py-1.5 font-medium">{{ d }}</span>
      </div>

      <!-- Month Grid -->
      <div class="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden">
        <div v-for="(cell, idx) in monthDays" :key="idx"
             :class="[
               'bg-white p-1 sm:p-2 min-h-[80px] sm:min-h-[90px] flex flex-col cursor-pointer transition-colors',
               cell.isCurrentMonth ? '' : 'bg-gray-50/60',
               cell.isToday ? 'ring-2 ring-inset ring-blue-400' : '',
               selectedDate === cell.date ? 'bg-blue-50/50' : ''
             ]"
             @click="selectDate(cell)">
          <!-- Day number -->
          <div class="flex items-center justify-between mb-0.5">
            <span :class="[
              'text-[10px] sm:text-xs font-medium',
              cell.isToday ? 'w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px]' :
              cell.isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
            ]">
              {{ cell.day }}
            </span>
          </div>

          <!-- Items -->
          <div v-if="cell.items.length > 0" class="flex-1 space-y-0.5 overflow-hidden">
            <div v-for="item in cell.visibleItems" :key="item.id"
                 :class="[
                   'px-1 py-0.5 rounded text-[10px] sm:text-xs font-medium line-clamp-2 leading-tight',
                   item.status === 'completed' ? 'opacity-40 line-through bg-gray-100 text-gray-400' : ''
                 ]"
                 :style="getItemStyle(item)"
                 @click.stop="openItemDetail(item)">
              {{ item.title }}
            </div>
            <div v-if="cell.extraCount > 0" class="text-[10px] text-gray-400 pl-0.5 font-medium">
              +{{ cell.extraCount }}
            </div>
          </div>
        </div>
      </div>

      <!-- Selected date detail -->
      <transition name="slide-up">
        <div v-if="selectedDate && selectedItems.length > 0" class="mt-4 card">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold text-sm">{{ selectedDateLabel }}</h3>
            <button @click="selectedDate = null" class="text-xs text-gray-400 hover:text-gray-600">关闭</button>
          </div>
          <ItemList :items="selectedItems" @updated="onItemUpdated" />
        </div>
      </transition>

      <!-- Department Legend -->
      <div class="mt-4 flex flex-wrap gap-2">
        <div v-for="dept in deptLegend" :key="dept.id" class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white text-xs">
          <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: dept.color }"></span>
          <span class="text-gray-600">{{ dept.name }}</span>
          <span class="font-semibold" :style="{ color: dept.color }">{{ dept.count }}</span>
        </div>
      </div>
    </template>


  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { itemsApi } from '../api'
import ItemList from '../components/ItemList.vue'
import { formatDateStr, formatDateCN } from '../utils/date'
import { getDeptColor, getDeptBg, DEPARTMENTS } from '../config/departments'

const loading = ref(false)
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth()) // 0-based
const selectedDate = ref<string | null>(null)
const allItems = ref<any[]>([])

const weekdays = ['一', '二', '三', '四', '五', '六', '日']

const monthLabel = computed(() => `${currentYear.value}年${currentMonth.value + 1}月`)

function getItemStyle(item: any) {
  if (item.status === 'completed') return {}
  const isOverdue = item.due_date < formatDateStr(new Date()) && item.status !== 'completed'
  if (isOverdue) return { backgroundColor: '#fef2f2', color: '#dc2626' }
  return { backgroundColor: getDeptBg(item.department_id), color: getDeptColor(item.department_id) }
}

// Month grid
const monthDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Monday=0, Sunday=6
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const days: any[] = []
  const today = new Date()
  const todayStr = formatDateStr(today)

  // Previous month padding
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    const dateStr = formatDateStr(d)
    const dayItems = getItemsForDate(dateStr)
    days.push({
      day: d.getDate(),
      date: dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      items: dayItems,
      visibleItems: dayItems.slice(0, 2),
      extraCount: Math.max(0, dayItems.length - 2),
    })
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    const dateStr = formatDateStr(date)
    const dayItems = getItemsForDate(dateStr)
    days.push({
      day: d,
      date: dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      items: dayItems,
      visibleItems: dayItems.slice(0, 2),
      extraCount: Math.max(0, dayItems.length - 2),
    })
  }

  // Next month padding to fill grid (complete the last week)
  const remaining = 7 - (days.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d)
      const dateStr = formatDateStr(date)
      const dayItems = getItemsForDate(dateStr)
      days.push({
        day: d,
        date: dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        items: dayItems,
        visibleItems: dayItems.slice(0, 2),
        extraCount: Math.max(0, dayItems.length - 2),
      })
    }
  }

  return days
})

function getItemsForDate(dateStr: string) {
  return allItems.value.filter(item => item.due_date === dateStr)
}

// Selected date items
const selectedItems = computed(() => {
  if (!selectedDate.value) return []
  return allItems.value.filter(item => item.due_date === selectedDate.value)
})

const selectedDateLabel = computed(() => {
  if (!selectedDate.value) return ''
  return formatDateCN(selectedDate.value)
})

// Department legend with counts for current month
const deptLegend = computed(() => {
  const counts: Record<number, number> = {}
  const monthStart = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-01`
  const monthEnd = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${new Date(currentYear.value, currentMonth.value + 1, 0).getDate()}`

  allItems.value.forEach(item => {
    if (item.due_date >= monthStart && item.due_date <= monthEnd && item.status !== 'completed') {
      counts[item.department_id] = (counts[item.department_id] || 0) + 1
    }
  })

  return [1, 2, 3, 4, 5].map(id => ({
    id,
    name: DEPARTMENTS.find(d => d.id === id)?.name || '其他',
    color: getDeptColor(id),
    count: counts[id] || 0,
  }))
})

function selectDate(cell: any) {
  if (cell.items.length > 0) {
    selectedDate.value = selectedDate.value === cell.date ? null : cell.date
  } else {
    selectedDate.value = null
  }
}

function openItemDetail(item: any) {
  // 点击待办时展开该日期的详情面板，使用 ItemList 的内嵌弹窗
  selectedDate.value = item.due_date
}

function onItemUpdated() {
  fetchItems()
}

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function goToday() {
  currentYear.value = new Date().getFullYear()
  currentMonth.value = new Date().getMonth()
}

async function fetchItems() {
  loading.value = true
  try {
    const res: any = await itemsApi.getAll({ status: 'all', limit: 500 })
    allItems.value = Array.isArray(res.data) ? res.data : (res.data?.items || [])
  } catch (e) {
    // 数据获取失败，静默处理
    allItems.value = []
  } finally {
    loading.value = false
  }
}

watch([currentYear, currentMonth], () => {
  selectedDate.value = null
})

// Fetch on first render
onMounted(() => {
  fetchItems()
  // 监听数据导入事件
  window.addEventListener('items-imported', fetchItems)
})

onUnmounted(() => {
  window.removeEventListener('items-imported', fetchItems)
})
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(10px);
  opacity: 0;
}
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
