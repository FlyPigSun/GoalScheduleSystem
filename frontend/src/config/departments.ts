/**
 * 部门配置
 */
export interface DepartmentConfig {
  id: number
  name: string
  slug: string
  icon: string
  color: string
  bg: string
  dot: string
}

export const DEPARTMENTS: DepartmentConfig[] = [
  { id: 1, name: '采购供应链', slug: 'supply', icon: '📦', color: '#2563eb', bg: '#eff6ff', dot: '#3b82f6' },
  { id: 2, name: '招商', slug: 'invest', icon: '🤝', color: '#7c3aed', bg: '#f5f3ff', dot: '#8b5cf6' },
  { id: 3, name: '质量', slug: 'quality', icon: '✅', color: '#059669', bg: '#ecfdf5', dot: '#10b981' },
  { id: 4, name: '工程', slug: 'engineering', icon: '🏗️', color: '#d97706', bg: '#fffbeb', dot: '#f59e0b' },
  { id: 5, name: '综合管理', slug: 'general', icon: '📊', color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' },
]

export function getDeptConfig(id: number): DepartmentConfig {
  return DEPARTMENTS.find(d => d.id === id) || DEPARTMENTS[4]
}

export function getDeptColor(id: number): string {
  return getDeptConfig(id).color
}

export function getDeptBg(id: number): string {
  return getDeptConfig(id).bg
}

export function getDeptDot(id: number): string {
  return getDeptConfig(id).dot
}

import goalsConfig from './goals.json'

/**
 * 季度目标定义
 */
export interface QuarterTarget {
  q1: string
  q2: string
  q3: string
  q4: string
}

/**
 * 业务目标配置
 */
export interface GoalDef {
  label: string
  value: string
  bgClass: string
  textClass: string
  valueClass: string
  quarters?: QuarterTarget
  showYearlyOnly?: boolean
}

/**
 * 从JSON配置文件加载部门目标
 */
function loadDepartmentGoals(): Record<number, GoalDef[]> {
  const goals: Record<number, GoalDef[]> = {}
  
  for (const [deptId, goalList] of Object.entries(goalsConfig.goals)) {
    goals[Number(deptId)] = (goalList as any[]).map((g: any) => ({
      label: g.label,
      value: g.value,
      bgClass: g.bgClass,
      textClass: g.textClass,
      valueClass: g.valueClass,
      quarters: g.quarters,
      showYearlyOnly: !g.quarters
    }))
  }
  
  return goals
}

// 动态加载目标配置
export const DEPARTMENT_GOALS: Record<number, GoalDef[]> = loadDepartmentGoals()

/**
 * 获取部门目标
 * @param id 部门ID
 * @param currentQuarter 当前季度（1-4），用于判断显示全年目标还是季度目标
 */
export function getDeptGoals(id: number, _currentQuarter?: number): GoalDef[] {
  const goals = DEPARTMENT_GOALS[id] || []
  
  return goals.map(goal => {
    // 如果没有季度目标，或者标记为只显示全年目标
    if (goal.showYearlyOnly || !goal.quarters) {
      // 返回不带quarters属性的目标
      const { quarters, ...rest } = goal
      return rest
    }
    
    return goal
  })
}
