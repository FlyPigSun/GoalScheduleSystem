import axios from 'axios'

// 创建实例，拦截器返回 res.data 而非完整响应
const api = axios.create({
  baseURL: import.meta.env.DEV ? '/api' : '/GoalScheduleSystem/api'
})

api.interceptors.response.use(
  res => res.data,
  err => {
    // 保留完整错误信息，包括后端返回的错误消息
    const errorData = err.response?.data
    if (errorData && !errorData.success) {
      // 后端返回的业务错误（如 500 但带有 message）
      return Promise.reject({
        message: errorData.message || '请求失败',
        data: errorData.data,
        success: false
      })
    }
    // 网络/HTTP 错误
    return Promise.reject({
      message: err.message || '网络错误',
      code: err.code
    })
  }
)

export const itemsApi = {
  getDashboard: (week?: number) => api.get('/items/dashboard', { params: { week } }),
  getTimeline: (week?: number) => api.get('/items/timeline', { params: { week } }),
  getWeeklyReview: () => api.get('/items/weekly-review'),
  submitWeeklyReview: (reviews: any[]) => api.post('/items/weekly-review', { reviews }),
  getAll: (params?: any) => api.get('/items', { params }),
  getById: (id: number) => api.get(`/items/${id}`),
  create: (data: any) => api.post('/items', data),
  update: (id: number, data: any) => api.put(`/items/${id}`, data),
  delete: (id: number) => api.delete(`/items/${id}`),
  postpone: (id: number, due_date: string) => api.post(`/items/${id}/postpone`, { due_date })
}

export const departmentsApi = {
  getAll: () => api.get('/departments')
}

export async function uploadFile(file: File): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return res
}

export async function confirmUpload(items: any[]): Promise<any> {
  return api.post('/upload/confirm', { items })
}

// 导出类型重写的 api，因为拦截器解包了 response.data
export default api as typeof api & {
  get<T = any>(url: string, config?: any): Promise<T>
  post<T = any>(url: string, data?: any, config?: any): Promise<T>
  put<T = any>(url: string, data?: any, config?: any): Promise<T>
  delete<T = any>(url: string, config?: any): Promise<T>
}