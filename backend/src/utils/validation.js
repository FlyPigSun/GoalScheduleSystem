/**
 * 输入验证工具
 */

/**
 * 验证数组参数
 */
function validateArray(items, minLength = 0, message = '参数必须为数组') {
  if (!Array.isArray(items)) {
    return { valid: false, error: message }
  }
  if (items.length < minLength) {
    return { valid: false, error: `数组长度至少为 ${minLength}` }
  }
  return { valid: true }
}

/**
 * 验证 ID 参数
 */
function validateId(id) {
  const num = parseInt(id, 10)
  if (isNaN(num) || num <= 0) {
    return { valid: false, error: '无效的ID参数' }
  }
  return { valid: true, value: num }
}

/**
 * 验证日期格式（YYYY-MM-DD）
 */
function validateDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, error: '日期格式必须为 YYYY-MM-DD' }
  }
  return { valid: true }
}

module.exports = {
  validateArray,
  validateId,
  validateDate
}