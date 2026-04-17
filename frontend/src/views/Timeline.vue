<template>
  <div class="min-h-screen bg-[var(--color-bg)]">
    <header class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div class="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <div class="flex items-center gap-3">
          <button @click="prevWeek" class="w-8 h-8 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors">‹</button>
          <span class="text-sm font-semibold">{{ weekLabel }}</span>
          <button @click="nextWeek" class="w-8 h-8 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors">›</button>
        </div>
        <div class="flex items-center gap-2">
          <button @click="goToday" class="text-xs px-2.5 py-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100">今天</button>
          <router-link to="/" class="btn btn-ghost text-sm">返回</router-link>
        </div>
      </div>

      <!-- Weekday headers -->
      <div class="max-w-5xl mx-auto px-4 grid grid-cols-7 text-center border-t border-gray-100">
        <span v-for="d in weekdays" :key="d" class="py-1.5 sm:py-2 text-xs sm:text-sm text-gray-400">{{ d }}</span>
      </div>
    </header>

    <main class="max-w-5xl mx-auto px-4 pb-24 pt-2 sm:pt-4">
      <div v-if="loading" class="text-center py-20 text-gray-400">加载中...</div>

      <!-- Week Calendar Grid -->
      <template v-else>
        <!-- Single row: 7 days -->
        <div class="grid grid-cols-7 gap-1 sm:gap-2 lg:gap-3 xl:gap-4">
          <div v-for="(cell, idx) in weekDays" :key="idx"
               :class="[
                 'week-cell rounded-xl p-2 sm:p-3 lg:p-4 xl:p-5 min-h-[120px] sm:min-h-[160px] lg:min-h-[220px] xl:min-h-[280px] flex flex-col cursor-pointer transition-all',
                 cell.isToday ? 'ring-2 ring-inset ring-blue-400' : '',
                 cell.items.length === 0 ? 'bg-white/60' : ''
               ]"
               :style="{ borderTop: `3px solid ${cell.deptColor}` }"
               @click="selectDay(cell)">
            <!-- Date header -->
            <div class="flex items-center justify-between mb-2 lg:mb-3 xl:mb-4">
              <div :class="[
                'w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-full flex items-center justify-center text-xs sm:text-sm lg:text-base xl:text-lg font-semibold',
                cell.isToday ? 'bg-blue-500 text-white' : (isCurrentWeek(cell.date) ? 'text-gray-700' : 'text-gray-300')
              ]">
                {{ cell.day }}
              </div>
              <span v-if="cell.monthLabel" class="text-[10px] sm:text-xs lg:text-sm text-gray-400">{{ cell.monthLabel }}</span>
            </div>

            <!-- Items list -->
            <div v-if="cell.items.length > 0" class="flex-1 space-y-1 lg:space-y-1.5 xl:space-y-2 overflow-hidden">
              <div v-for="item in cell.items" :key="item.id"
                   :class="[
                     'item-dot px-1.5 sm:px-2 lg:px-2.5 xl:px-3 py-1 lg:py-1.5 rounded text-xs sm:text-sm lg:text-base font-medium truncate',
                     item.status === 3 ? 'opacity-40 line-through' :
                     isOverdue(item.due_date) ? 'bg-red-50/90 text-red-700' :
                     'hover:brightness-95'
                   ]"
                   :style="{ backgroundColor: item.status !== 3 ? (isOverdue(item.due_date) ? '' : getDeptBg(item.department_id)) : '', color: item.status !== 3 && !isOverdue(item.due_date) ? getDeptColor(item.department_id) : '' }"
                   @click.stop="openItemDetail(item)">
                {{ item.title }}
              </div>
              <div v-if="cell.extraCount > 0" class="text-[10px] sm:text-xs lg:text-sm text-gray-400 pl-1.5 font-medium">
                +{{ cell.extraCount }} 项
              </div>
            </div>

            <div v-else class="flex-1"></div>
          </div>
        </div>

        <!-- Selected day detail -->
        <transition name="slide-up">
          <div v-if="selectedDay" class="mt-4 sm:mt-6 card">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-sm sm:text-base">{{ selectedDayLabel }}</h3>
              <button @click="selectedDay = null" class="text-xs sm:text-sm text-gray-400 hover:text-gray-600">关闭</button>
            </div>
            <div v-if="allSelectedItems.length === 0" class="text-sm text-gray-400 text-center py-4">暂无事项</div>
            <ItemList :items="allSelectedItems" empty-text="" />
          </div>
        </transition>

        <!-- Stats by department -->
        <div class="mt-4 sm:mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div v-for="dept in deptStats" :key="dept.id"
               :style="{ borderTop: `2px solid ${dept.color}`, background: `${dept.bg}20` }"
               class="rounded-lg p-2.5 sm:p-3">
            <div class="text-xs sm:text-sm font-medium mb-1">{{ dept.icon }} {{ dept.name }}</div>
            <div class="flex gap-2 sm:gap-3 text-[11px] sm:text-xs">
              <span class="font-semibold">{{ dept.active }}项</span>
              <span class="text-green-600">✓{{ dept.done }}</span>
              <span v-if="dept.overdue > 0" class="text-red-500">⚠{{ dept.overdue }}</span>
            </div>
          </div>
        </div>
      </template>
    </main>

    <!-- 添加日程浮动按钮 -->
    <button 
      @click="openAddForm"
      class="fixed right-5 bottom-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl z-40"
      title="添加日程"
    >
      +
    </button>

    <!-- Item Detail Modal - 使用封装组件 -->
    <ItemDetailModal 
      :item="detailItem" 
      @close="detailItem = null" 
      @updated="fetchItems" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import ItemList from '../components/ItemList.vue'
import ItemDetailModal from '../components/ItemDetailModal.vue'
import { getDeptColor, getDeptBg, getDeptDot } from '../config/departments'
import { formatDateStr, isSameDay, isOverdue, getWeekStart, formatDateCN } from '../utils/date'

const loading = ref(false)
const currentWeekStart = ref(getWeekStart(new Date()))
const selectedDay = ref<any>(null)
const detailItem = ref<any>(null)
const allItems = ref<any[]>([])

// Current week label
const weekLabel = computed(() => {
  const start = currentWeekStart.value
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`
})

// Generate 7 days for current week
const weekDays = computed(() => {
  const days: any[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart.value)
    d.setDate(d.getDate() + i)
    const dateStr = formatDateStr(d)
    const dayItems = allItems.value.filter((item: any) => item.due_date === dateStr)
    
    // Show max 3 items, rest in "+N"
    const maxShow = 3
    const visible = dayItems.slice(0, maxShow)
    
    // Determine dominant department for top bar color
    let dominantDept = 5
    if (visible.length > 0) {
      const counts: Record<number, number> = {}
      visible.forEach((item: any) => {
        counts[item.department_id] = (counts[item.department_id] || 0) + 1
      })
      let maxCount = 0
      Object.entries(counts).forEach(([id, count]) => {
        if (count > maxCount) {
          maxCount = count
          dominantDept = Number(id)
        }
      })
    }

    days.push({
      day: d.getDate(),
      monthLabel: d.getDate() <= 7 ? `${d.getMonth() + 1}月` : '',
      date: dateStr,
      isToday: isSameDay(d, new Date()),
      isCurrentMonth: true,
      items: visible,
      extraCount: Math.max(0, dayItems.length - maxShow),
      deptColor: getDeptDot(dominantDept),
      allItems: dayItems,
    })
  }
  return days
})

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function prevWeek() {
  const d = new Date(currentWeekStart.value)
  d.setDate(d.getDate() - 7)
  currentWeekStart.value = d
}

function nextWeek() {
  const d = new Date(currentWeekStart.value)
  d.setDate(d.getDate() + 7)
  currentWeekStart.value = d
}

function goToday() {
  currentWeekStart.value = getWeekStart(new Date())
}

function selectDay(cell: any) {
  selectedDay.value = cell
}

const allSelectedItems = computed(() => {
  if (!selectedDay.value) return []
  return selectedDay.value.allItems || selectedDay.value.items || []
})

const selectedDayLabel = computed(() => {
  if (!selectedDay.value) return ''
  return formatDateCN(selectedDay.value.date)
})

// Stats by department
const deptStats = computed(() => {
  const stats: Record<number, { id: number; name: string; icon: string; active: number; done: number; overdue: number; color: string; bg: string }> = {
    1: { id: 1, name: '采购供应链', icon: '📦', active: 0, done: 0, overdue: 0, color: getDeptColor(1), bg: getDeptBg(1) },
    2: { id: 2, name: '招商', icon: '🤝', active: 0, done: 0, overdue: 0, color: getDeptColor(2), bg: getDeptBg(2) },
    3: { id: 3, name: '质量', icon: '✅', active: 0, done: 0, overdue: 0, color: getDeptColor(3), bg: getDeptBg(3) },
    4: { id: 4, name: '工程', icon: '🏗️', active: 0, done: 0, overdue: 0, color: getDeptColor(4), bg: getDeptBg(4) },
  }

  allItems.value.forEach((item: any) => {
    const dept = stats[item.department_id]
    if (!dept) return
    if (item.status === 3) dept.done++
    else if (isOverdue(item.due_date)) dept.overdue++
    else dept.active++
  })

  return Object.values(stats)
})

function isCurrentWeek(_dateStr: string): boolean {
  return true // All shown are current week
}

function openItemDetail(item: any) {
  detailItem.value = item
}

const emit = defineEmits(['openForm'])

function openAddForm() {
  emit('openForm')
}

async function fetchItems() {
  loading.value = true
  try {
    const api = await import('../api')
    const res: any = await api.itemsApi.getAll({ status: 'all' })
    allItems.value = Array.isArray(res.data) ? res.data : (res.data?.items || [])
  } catch (e: any) {
    console.error('Timeline fetch error:', e)
    allItems.value = []
  } finally {
    loading.value = false
  }
}

watch(currentWeekStart, () => {
  selectedDay.value = null
})

onMounted(fetchItems)
</script>

<style scoped>
.week-cell {
  position: relative;
  transition: transform 0.15s ease;
}
.week-cell:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.week-cell:active {
  transform: scale(0.98);
}
.item-dot {
  display: block;
  line-height: 1.4;
  transition: opacity 0.15s;
}
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
