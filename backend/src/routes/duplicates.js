const express = require('express');
const router = express.Router();
const axios = require('axios');
const { all } = require('../models/database');
const { success, error } = require('../utils/response');
const { validateArray } = require('../utils/validation');

/**
 * AI驱动的重复检测
 * 接收任务列表，返回重复组
 */
router.post('/detect', async (req, res) => {
  try {
    const { items } = req.body;
    
    const validation = validateArray(items, 2);
    if (!validation.valid) {
      return success(res, { groups: [] });
    }
    
    const apiKey = process.env.TENCENT_SECRET_ID;
    
    // 如果AI未配置，回退到规则检测
    if (!apiKey || !apiKey.startsWith('sk-tp-')) {
      const groups = detectDuplicatesByRule(items);
      return success(res, { groups, method: 'rule' });
    }
    
    // 使用AI检测
    const groups = await detectDuplicatesByAI(items, apiKey);
    success(res, { groups, method: 'ai' });
    
  } catch (err) {
    console.error('重复检测失败:', err);
    error(res, 500, '检测失败: ' + err.message);
  }
});

/**
 * AI重复检测
 * 批量比较任务，找出语义相似的重复项
 */
async function detectDuplicatesByAI(items, apiKey) {
  // 为每个任务生成简化表示，减少token消耗
  const itemTexts = items.map((item, index) => {
    const dept = item.department_name || item.department || '';
    return `[${index}] ${item.title}${dept ? ` (${dept})` : ''}`;
  }).join('\n');
  
  const prompt = `分析以下工作任务列表，找出语义相同或高度相似的任务（同一工作用不同表述）。

任务列表：
${itemTexts}

判断标准：
1. 完全相同："现烤品损耗管控" vs "现烤品损耗管控" → 重复
2. 表述差异但同一件事："现烤品损耗管控" vs "现烤面包损耗管理" → 重复
3. 不同任务："完成项目A报告" vs "完成项目B报告" → 不重复
4. 不同任务："采购面粉" vs "采购包装" → 不重复

返回格式：JSON数组，每组重复项包含重复的索引号
示例：[[0, 2], [3, 5, 7]] 表示第0和2项重复，第3、5、7项重复

只返回JSON数组，不要其他文字。`;

  try {
    const response = await axios.post(
      'https://api.lkeap.cloud.tencent.com/plan/v3/chat/completions',
      {
        model: 'hunyuan-turbos',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // 低温度确保结果稳定
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const content = response.data.choices[0].message.content;
    
    // 提取JSON数组
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return detectDuplicatesByRule(items);
    }
    
    const duplicateIndices = JSON.parse(jsonMatch[0]);
    
    // 转换为前端需要的格式
    const groups = [];
    duplicateIndices.forEach((indices, groupId) => {
      if (indices.length >= 2) {
        const groupItems = indices.map(idx => ({
          index: idx,
          tempId: items[idx].tempId,
          item: items[idx]
        }));
        
        groups.push({
          id: groupId,
          items: groupItems,
          keepTempId: groupItems[0].tempId
        });
      }
    });
    
    return groups;
    
  } catch (error) {
    console.error('AI 检测失败，回退到规则检测:', error.message);
    return detectDuplicatesByRule(items);
  }
}

/**
 * 规则检测（回退方案）
 */
function detectDuplicatesByRule(items) {
  const groups = [];
  const processed = new Set();
  
  for (let i = 0; i < items.length; i++) {
    if (processed.has(i)) continue;
    
    const similar = [{ index: i, tempId: items[i].tempId, item: items[i] }];
    
    for (let j = i + 1; j < items.length; j++) {
      if (processed.has(j)) continue;
      
      if (isSimilarByRule(items[i], items[j])) {
        similar.push({ index: j, tempId: items[j].tempId, item: items[j] });
      }
    }
    
    if (similar.length > 1) {
      groups.push({
        id: groups.length,
        items: similar,
        keepTempId: similar[0].tempId
      });
      similar.forEach(s => processed.add(s.index));
    }
  }
  
  return groups;
}

/**
 * 规则相似度判断
 */
function isSimilarByRule(a, b) {
  const t1 = normalizeTitle(a.title);
  const t2 = normalizeTitle(b.title);
  
  if (t1 === t2) return true;
  
  // 包含关系检查
  const minRatio = 0.6;
  if (t1.includes(t2) && t2.length / t1.length >= minRatio) return true;
  if (t2.includes(t1) && t1.length / t2.length >= minRatio) return true;
  
  // 关键词Jaccard相似度
  const k1 = extractKeywords(t1);
  const k2 = extractKeywords(t2);
  const sim = calculateJaccard(k1, k2);
  
  return sim >= 0.75; // 稍低于前端阈值以捕获更多潜在重复
}

function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[，。！？、；：""''（）【】《》]/g, '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '');
}

const STOP_WORDS = new Set([
  '的', '了', '和', '是', '在', '有', '我', '他', '她', '它', '们',
  '与', '及', '等', '对', '为', '以', '这', '那', '个', '之', '于',
  '完成', '进行', '开展', '做好', '落实', '推进', '推动', '加强',
  '继续', '进一步', '全面', '认真', '切实', '确保', '实现', '达到'
]);

function extractKeywords(text) {
  const keywords = [];
  const chinese = text.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
  keywords.push(...chinese.filter(w => !STOP_WORDS.has(w)));
  
  const english = text.match(/[a-zA-Z]+/g) || [];
  keywords.push(...english.map(w => w.toLowerCase()));
  
  const numbers = text.match(/\d+/g) || [];
  keywords.push(...numbers);
  
  return [...new Set(keywords)];
}

function calculateJaccard(a, b) {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  
  return intersection.size / union.size;
}

/**
 * 检测与数据库已有任务的重复
 * 接收待导入任务列表，返回与数据库中相似的任务
 */
router.post('/check-existing', async (req, res) => {
  try {
    const { items } = req.body;
    
    const validation = validateArray(items, 1);
    if (!validation.valid) {
      return success(res, { duplicates: [] });
    }
    
    // 获取数据库中未完成的待办任务（只和未完成做重复检测）
    const existingItems = await all(`
      SELECT i.*, d.name as department_name 
      FROM items i 
      LEFT JOIN departments d ON i.department_id = d.id 
      WHERE i.status IN ('pending', 'in_progress')
    `);
    
    if (existingItems.length === 0) {
      return success(res, { duplicates: [] });
    }
    
    // 使用AI检测重复
    const apiKey = process.env.TENCENT_SECRET_ID;
    let duplicates = [];
    
    if (apiKey && apiKey.startsWith('sk-tp-')) {
      duplicates = await detectDuplicatesWithExistingByAI(items, existingItems, apiKey);
    } else {
      duplicates = detectDuplicatesWithExistingByRule(items, existingItems);
    }
    
    success(res, { duplicates });
    
  } catch (err) {
    console.error('检测已有任务重复失败:', err);
    error(res, 500, '检测失败: ' + err.message);
  }
});

/**
 * AI检测与已有任务的重复
 */
async function detectDuplicatesWithExistingByAI(newItems, existingItems, apiKey) {
  const duplicates = [];
  const processedTempIds = new Set(); // 避免一个newItem匹配多个existingItem
  
  // 分批处理，避免prompt过长
  const batchSize = 10;
  
  for (let i = 0; i < newItems.length; i += batchSize) {
    const batch = newItems.slice(i, i + batchSize);
    
    const newItemTexts = batch.map((item, idx) => {
      const dept = item.department_name || item.department || '';
      return `[N${idx}] ${item.title}${dept ? ` (${dept})` : ''}`;
    }).join('\n');
    
    const existingItemTexts = existingItems.map((item, idx) => {
      const dept = item.department_name || '';
      return `[E${item.id}] ${item.title}${dept ? ` (${dept})` : ''}`;
    }).join('\n');
    
    const prompt = `比较以下新任务与已有任务，找出语义相同或高度相似的任务。

新任务列表：
${newItemTexts}

已有任务列表：
${existingItemTexts}

判断标准：
1. 完全相同或表述差异但同一件事 → 重复
2. 不同任务（如项目A vs 项目B） → 不重复

返回格式：JSON数组，每个元素包含 newIndex（新任务序号）和 existingId（已有任务ID）
示例：[{"newIndex":0,"existingId":5},{"newIndex":2,"existingId":8}]

只返回JSON数组，不要其他文字。`;

    try {
      const response = await axios.post(
        'https://api.lkeap.cloud.tencent.com/plan/v3/chat/completions',
        {
          model: 'hunyuan-turbos',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const content = response.data.choices[0].message.content;
      
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);
        
        for (const result of results) {
          if (result.newIndex !== undefined && result.existingId !== undefined) {
            const newItem = batch[result.newIndex];
            
            // 如果这个newItem已经处理过了，跳过
            if (processedTempIds.has(newItem.tempId)) {
              continue;
            }
            
            // AI 返回的 existingId 可能是 "E123" 格式，需要提取数字部分
            const existingIdStr = String(result.existingId);
            const existingIdNum = parseInt(existingIdStr.replace(/^E/i, ''), 10);
            
            const existingItem = existingItems.find(e => e.id === existingIdNum);
            
            if (newItem && existingItem) {
              processedTempIds.add(newItem.tempId);
              duplicates.push({
                newItem: {
                  tempId: newItem.tempId,
                  title: newItem.title,
                  department_name: newItem.department_name
                },
                existingItem: {
                  id: existingItem.id,
                  title: existingItem.title,
                  department_name: existingItem.department_name,
                  status: existingItem.status,
                  due_date: existingItem.due_date
                }
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('AI检测批次失败:', error.message);
      // 继续处理下一批
    }
  }
  
  return duplicates;
}

/**
 * 规则检测与已有任务的重复（回退方案）
 */
function detectDuplicatesWithExistingByRule(newItems, existingItems) {
  const duplicates = [];
  const processedTempIds = new Set(); // 避免一个newItem匹配多个existingItem
  
  for (const newItem of newItems) {
    if (processedTempIds.has(newItem.tempId)) continue;
    
    for (const existingItem of existingItems) {
      if (isSimilarByRule(newItem, existingItem)) {
        processedTempIds.add(newItem.tempId);
        duplicates.push({
          newItem: {
            tempId: newItem.tempId,
            title: newItem.title,
            department_name: newItem.department_name
          },
          existingItem: {
            id: existingItem.id,
            title: existingItem.title,
            department_name: existingItem.department_name,
            status: existingItem.status,
            due_date: existingItem.due_date
          }
        });
        break; // 找到一个重复就停止，避免一个newItem匹配多个existingItem
      }
    }
  }
  
  return duplicates;
}

module.exports = router;
