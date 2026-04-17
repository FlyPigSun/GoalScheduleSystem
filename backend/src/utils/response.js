/**
 * 统一响应格式工具
 */

/**
 * 成功响应
 */
function success(res, data = null, message = null) {
  const response = { success: true }
  if (data !== null) response.data = data
  if (message) response.message = message
  return res.json(response)
}

/**
 * 错误响应
 */
function error(res, statusCode = 500, message) {
  return res.status(statusCode).json({ success: false, error: message })
}

/**
 * 参数错误响应（400）
 */
function badRequest(res, message) {
  return error(res, 400, message)
}

/**
 * 未找到响应（404）
 */
function notFound(res, message = '资源不存在') {
  return error(res, 404, message)
}

module.exports = {
  success,
  error,
  badRequest,
  notFound
}