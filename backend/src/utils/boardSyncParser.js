const removableWords = [
  '推进', '完成', '跟进', '处理', '问题', '事项', '确认', '落实', '结果',
  '消耗', '工作', '方案', '最终', '持续', '相关', '进行', '重点'
];

function canonicalTitle(title = '') {
  let normalized = String(title).toLowerCase();
  for (const word of removableWords) normalized = normalized.replaceAll(word, '');
  const compact = normalized.replace(/[\s·，,。；;：:（）()、\-—_/“”"'<>]/g, '');
  if (compact.includes('招商线索')) return '招商线索';
  if (compact.includes('上品') && (compact.includes('自动') || compact.includes('sop'))) return '上品自动化';
  return compact;
}

function itemKey(area, title) {
  return `${normalizeArea(area)}|${canonicalTitle(title)}`;
}

function normalizeArea(area) {
  const value = String(area || '').trim();
  if (value === '供应链') return '采购供应链';
  if (value === '系统开发' || value === '数据与系统') return '综合管理';
  return value || '综合管理';
}

function extractDate(value) {
  const match = String(value || '').match(/(20\d{2})[-/]?(\d{1,2})[-/]?(\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function normalizePriority(value) {
  const text = String(value || 'P1');
  if (/P0|高/.test(text)) return 'P0';
  if (/P1|中/.test(text)) return 'P1';
  return 'P2';
}

function normalizeStatus(value) {
  const text = String(value || '继续跟进');
  if (text === '已闭环') return 'completed';
  if (text === '无需跟进') return 'deferred';
  if (text === '仅作周报进展') return 'progress_only';
  return 'in_progress';
}

function parseBoardSync(markdown, filename = '') {
  const match = String(markdown).match(/<!--\s*BOARD_SYNC\s*([\s\S]*?)\s*BOARD_SYNC\s*-->/);
  if (!match) throw new Error('周报缺少 BOARD_SYNC 状态块，请使用正式周报文件');

  let values;
  try {
    values = JSON.parse(match[1]);
  } catch {
    throw new Error('BOARD_SYNC 状态块格式错误');
  }
  if (!Array.isArray(values)) throw new Error('BOARD_SYNC 必须是事项数组');

  const reportWeek = filename.match(/20\d{2}-W(?:0[1-9]|[1-4]\d|5[0-3])/i)?.[0]?.toUpperCase();
  if (!reportWeek) throw new Error('周报文件名须为 YYYY-Www.md');
  const items = values.map(value => ({
    title: String(value.title || '').trim(),
    area: normalizeArea(value.area),
    owner: String(value.owner || '待明确').trim(),
    priority: normalizePriority(value.priority),
    due_date: extractDate(value.deadline),
    status: normalizeStatus(value.status),
    description: value.progress ? String(value.progress).trim() : null,
    source: String(value.source || '企业微信工作周报').trim(),
    report_week: reportWeek
  })).filter(item => item.title);

  return { reportWeek, items };
}

module.exports = { canonicalTitle, itemKey, normalizeArea, parseBoardSync };
