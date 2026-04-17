/**
 * 日期工具函数
 */

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 获取某周的开始日期（周一）
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * 获取某周的结束日期（周日）
 */
export function getWeekEnd(date: Date): Date {
  const d = getWeekStart(date)
  d.setDate(d.getDate() + 6)
  return d
}

/**
 * 判断是否同一天
 */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && 
         a.getMonth() === b.getMonth() && 
         a.getDate() === b.getDate()
}

/**
 * 判断日期是否已过期
 */
export function isOverdue(dateStr: string): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return dateStr < formatDateStr(today) && !isNaN(new Date(dateStr).getTime())
}

/**
 * 格式化日期为 M/D 格式
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * 格式化日期为中文格式（2026年4月17日）
 */
export function formatDateCN(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return dateStr
  return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`
}

/**
 * 计算距离目标日期的天数
 */
export function getDaysUntil(dateStr: string): number {
  if (!dateStr) return Infinity
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

/**
 * 获取周标签（如 4/14-4/20）
 */
export function getWeekLabel(offset: number): string {
  const now = new Date()
  const target = new Date(now)
  target.setDate(target.getDate() + offset * 7)
  const month = target.getMonth() + 1
  const start = getWeekStart(target)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return `${month}/${start.getDate()}-${month}/${end.getDate()}`
}
