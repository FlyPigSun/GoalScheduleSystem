<template>
  <div class="min-h-screen bg-[var(--color-bg)]">
    <!-- Header -->
    <header class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div class="container flex items-center justify-between h-14">
        <div class="flex items-center gap-3">
          <span class="font-semibold text-base">📋 日程管理</span>
        </div>
        <div class="flex items-center gap-1">
          <button class="btn btn-ghost text-sm" @click="$emit('openUpload')">📤 上传</button>
        </div>
      </div>
    </header>

    <!-- Tabs -->
    <div class="sticky top-14 z-40 bg-white border-b border-gray-100">
      <div class="container flex">
        <button
          v-for="tab in tabs" :key="tab.key"
          @click="activeTab = tab.key"
          :class="[
            'px-5 py-2.5 text-sm font-medium transition-colors relative',
            activeTab === tab.key ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
          ]"
        >
          {{ tab.label }}
          <span v-if="activeTab === tab.key" class="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full"></span>
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <main class="container pb-24 max-w-[1600px] mx-auto px-4 lg:px-6 xl:px-8">
      <!-- Dashboard Tab -->
      <div v-show="activeTab === 'dashboard'" class="pt-5">
        <div v-if="store.loading" class="text-center py-20 text-gray-400">
          <div class="animate-spin text-2xl mb-2">⏳</div>
          加载中...
        </div>

        <template v-else-if="store.dashboard">
          <!-- 手机端：瀑布流 / PC端：平铺网格 -->
          <div class="space-y-5 md:grid md:grid-cols-2 md:gap-5 md:space-y-0">
            <template v-for="dept in deptModules" :key="dept.id">
              <section class="card" :class="`dept-${dept.slug}`">
                <!-- 部门头部 -->
                <div class="flex items-start justify-between mb-4">
                  <h2 class="text-lg font-bold text-gray-800">{{ dept.icon }} {{ dept.name }}</h2>
                  <span class="text-xs text-gray-400 whitespace-nowrap">{{ dept.itemCount }} 项</span>
                </div>

                <!-- 目标区域 - 矩形卡片，包含季度目标 -->
                <div v-if="dept.goals.length > 0" class="mb-4">
                  <div class="grid gap-2">
                    <div v-for="(goal, idx) in dept.goals" :key="idx"
                         class="goal-card rounded-xl p-3 lg:p-4"
                         :class="goal.bgClass">
                      <!-- 主目标和年度值 -->
                      <div class="flex items-center justify-between mb-2 lg:mb-3">
                        <span :class="`font-medium text-sm lg:text-base ${goal.textClass}`">{{ goal.label }}</span>
                        <span :class="`font-bold text-lg lg:text-xl ${goal.valueClass}`">{{ goal.value }}</span>
                      </div>
                      <!-- 季度目标 -->
                      <div v-if="goal.quarters" class="grid grid-cols-4 gap-1 lg:gap-2 text-[10px] lg:text-sm">
                        <div class="text-center py-1 lg:py-2 rounded bg-white/60">
                          <div class="text-gray-400 lg:text-xs">Q1</div>
                          <div :class="`font-medium ${goal.valueClass}`">{{ goal.quarters.q1 }}</div>
                        </div>
                        <div class="text-center py-1 lg:py-2 rounded bg-white/60">
                          <div class="text-gray-400 lg:text-xs">Q2</div>
                          <div :class="`font-medium ${goal.valueClass}`">{{ goal.quarters.q2 }}</div>
                        </div>
                        <div class="text-center py-1 lg:py-2 rounded bg-white/60">
                          <div class="text-gray-400 lg:text-xs">Q3</div>
                          <div :class="`font-medium ${goal.valueClass}`">{{ goal.quarters.q3 }}</div>
                        </div>
                        <div class="text-center py-1 lg:py-2 rounded bg-white/60">
                          <div class="text-gray-400 lg:text-xs">Q4</div>
                          <div :class="`font-medium ${goal.valueClass}`">{{ goal.quarters.q4 }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 待办列表 -->
                <template v-if="dept.overdue.length > 0">
                  <div class="mb-2">
                    <span class="text-xs font-semibold text-red-500">⚠️ 已逾期 ({{ dept.overdue.length }})</span>
                  </div>
                  <ItemList :items="dept.overdue" compact @updated="onDataChange" />
                </template>

                <template v-if="dept.currentWeek.length > 0">
                  <div class="mb-2 mt-3">
                    <span class="text-xs font-semibold text-gray-600">📌 本周 ({{ dept.currentWeek.length }})</span>
                  </div>
                  <ItemList :items="dept.currentWeek" compact @updated="onDataChange" />
                </template>

                <template v-if="dept.nextWeek.length > 0">
                  <div class="mb-2 mt-3">
                    <span class="text-xs font-semibold text-gray-500">🔜 下周 ({{ dept.nextWeek.length }})</span>
                  </div>
                  <ItemList :items="dept.nextWeek" compact @updated="onDataChange" />
                </template>

                <div v-if="!dept.hasItems && dept.goals.length === 0" class="text-center py-3 text-gray-300 text-sm">
                  暂无事项
                </div>
              </section>
            </template>
          </div>

          <div v-if="!hasData" class="text-center py-16 text-gray-400">
            <div class="text-4xl mb-3">📭</div>
            <p>暂无事项</p>
          </div>
        </template>
      </div>

      <!-- Calendar Tab -->
      <div v-show="activeTab === 'calendar'" class="pt-4">
        <CalendarView />
      </div>
    </main>

    <!-- 添加日程浮动按钮 -->
    <button 
      @click="$emit('openForm')"
      class="fixed right-5 bottom-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center text-2xl z-40"
      title="添加日程"
    >
      +
    </button>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '../stores/app'
import ItemList from '../components/ItemList.vue'
import CalendarView from './CalendarView.vue'
import { DEPARTMENTS, getDeptGoals } from '../config/departments'

defineEmits(['openForm', 'openUpload'])

const store = useAppStore()
const activeTab = ref<'dashboard' | 'calendar'>('dashboard')

const tabs = [
  { key: 'dashboard' as const, label: '看板' },
  { key: 'calendar' as const, label: '日历' },
]

interface DeptModule {
  id: number
  name: string
  slug: string
  icon: string
  goals: any[]
  overdue: any[]
  currentWeek: any[]
  nextWeek: any[]
  itemCount: number
  hasItems: boolean
}

const deptModules = computed<DeptModule[]>(() => {
  const d = store.dashboard
  if (!d) return []

  const allItems = [
    ...d.overdue,
    ...d.currentWeek,
    ...d.nextWeek,
    ...d.thisMonth.filter((i: any) => {
      const weekIds = new Set([...d.overdue.map((x: any) => x.id), ...d.currentWeek.map((x: any) => x.id), ...d.nextWeek.map((x: any) => x.id)])
      return !weekIds.has(i.id)
    })
  ]

  if (allItems.length === 0) return []

  const depts = store.departments || []
  return depts.map((dept: any) => {
    const config = DEPARTMENTS.find(d => d.id === dept.id) || DEPARTMENTS[4]
    const deptItems = allItems.filter((i: any) => i.department_id === dept.id)

    return {
      id: dept.id,
      name: config.name,
      slug: config.slug,
      icon: config.icon,
      goals: getDeptGoals(dept.id),
      overdue: d.overdue.filter((i: any) => i.department_id === dept.id),
      currentWeek: d.currentWeek.filter((i: any) => i.department_id === dept.id),
      nextWeek: d.nextWeek.filter((i: any) => i.department_id === dept.id),
      itemCount: deptItems.length,
      hasItems: deptItems.length > 0
    }
  }).filter((m: DeptModule) => m.hasItems || m.goals.length > 0).sort((a: DeptModule, b: DeptModule) => a.id - b.id)
})

const hasData = computed(() => {
  const d = store.dashboard
  if (!d) return false
  return d.overdue.length + d.currentWeek.length + d.nextWeek.length + d.thisMonth.length > 0
})

function onDataChange() {
  store.fetchDashboard()
}

onMounted(async () => {
  await store.fetchDepartments()
  await store.fetchDashboard()
})
</script>

<style scoped>
/* 部门卡片顶部色条 */
.dept-supply { border-top: 3px solid #3b82f6; }
.dept-invest { border-top: 3px solid #8b5cf6; }
.dept-quality { border-top: 3px solid #10b981; }
.dept-engineering { border-top: 3px solid #f59e0b; }
.dept-general { border-top: 3px solid #6b7280; }
.dept-other { border-top: 3px solid #9ca3af; }

/* 目标卡片样式 */
.goal-card {
  transition: all 0.2s ease;
}
.goal-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
</style>
