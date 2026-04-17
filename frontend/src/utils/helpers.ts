/**
 * 通用工具函数
 */

/**
 * 在数组中按 tempId 查找项
 */
export function findByTempId<T extends { tempId: number | string }>(items: T[], tempId: number | string): T | undefined {
  return items.find(i => i.tempId === tempId)
}

/**
 * 按日期过滤任务
 */
export function filterByDate<T extends { due_date: string }>(items: T[], dateStr: string): T[] {
  return items.filter(item => item.due_date === dateStr)
}

/**
 * 按状态过滤任务
 */
export function filterByStatus<T extends { status: string }>(items: T[], status: string): T[] {
  return items.filter(item => item.status === status)
}
