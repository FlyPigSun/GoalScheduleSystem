type DashboardBuckets<T> = Partial<Record<'overdue' | 'currentWeek' | 'nextWeek' | 'thisMonth' | 'unscheduled', T[]>>

// API 时间范围会交叉；展示按紧迫程度分配，每个记录 ID 只占一个分组。
export function groupDashboardItems<T extends { id: number }>(data: DashboardBuckets<T>) {
  const seen = new Set<number>()
  const take = (items: T[] = []) => items.filter(item => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })

  return {
    overdue: take(data.overdue),
    currentWeek: take(data.currentWeek),
    nextWeek: take(data.nextWeek),
    unscheduled: take(data.unscheduled),
  }
}
