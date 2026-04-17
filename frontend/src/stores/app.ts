import { defineStore } from 'pinia'
import { ref } from 'vue'
import { itemsApi, departmentsApi } from '../api'

export interface Item {
  id: number
  title: string
  description: string
  due_date: string
  original_due_date: string
  postpone_count: number
  status: string
  priority: string
  category: string
  department_id: number | null
  department_name: string
  source: string
}

export const useAppStore = defineStore('app', () => {
  const dashboard = ref<any>(null)
  const departments = ref<any[]>([])
  const loading = ref(false)
  const weekOffset = ref(0)

  async function fetchDepartments() {
    const res: any = await departmentsApi.getAll()
    departments.value = res.data
  }

  async function fetchDashboard(week?: number) {
    loading.value = true
    try {
      const res: any = await itemsApi.getDashboard(week ?? weekOffset.value)
      dashboard.value = res.data
    } finally {
      loading.value = false
    }
  }

  function getDaysUntil(dateStr: string): number {
    if (!dateStr) return Infinity
    const target = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    target.setHours(0, 0, 0, 0)
    return Math.ceil((target.getTime() - today.getTime()) / 86400000)
  }

  function getUrgencyClass(days: number): string {
    if (days <= 1) return 'indicator-urgent'
    if (days <= 3) return 'indicator-warning'
    return 'indicator-normal'
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  function getWeekLabel(offset: number): string {
    const now = new Date()
    const target = new Date(now)
    target.setDate(target.getDate() + offset * 7)
    const month = target.getMonth() + 1
    const start = new Date(target)
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return `${month}/${start.getDate()}-${month}/${end.getDate()}`
  }

  return {
    dashboard, departments, loading, weekOffset,
    fetchDepartments, fetchDashboard,
    getDaysUntil, getUrgencyClass, formatDate, getWeekLabel,
    async updateItem(id: number, data: any) {
      await itemsApi.update(id, data)
    },
    async deleteItem(id: number) {
      await itemsApi.delete(id)
    },
    async postponeItem(id: number, dueDate: string) {
      await itemsApi.postpone(id, dueDate)
    }
  }
})
