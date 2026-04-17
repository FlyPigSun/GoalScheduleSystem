const axios = require('axios');

/**
 * 使用腾讯云 Token Plan API 解析文本内容，提取事项
 * @param {string} text - 文本内容
 * @param {Array} departments - 部门列表
 * @returns {Array} 事项列表
 */
async function parseWithAI(text, departments) {
  const apiKey = process.env.TENCENT_SECRET_ID;
  
  if (!apiKey || !apiKey.startsWith('sk-tp-')) {
    console.warn('腾讯云 Token Plan API 未配置，将使用规则解析');
    return null;
  }

  const deptNames = departments.map(d => d.name).join('、');
  
  const prompt = `分析以下文本，提取所有工作任务。返回JSON数组格式。

部门选项：${deptNames}
年份：2026

每个事项字段：
- title: 任务标题(50字内)
- description: 描述(200字内)
- department: 部门名称(从部门选项选)
- priority: P0/P1/P2(P0=紧急,P1=重要,P2=常规)
- due_date: 截止日期(YYYY-MM-DD格式,无时为null)

部门推断：
- 供应商/采购/包材/物流/毛利→采购供应链
- 加盟/门店拓展→招商
- 质量/异物/品控→质量
- 装修/工程/设备→工程
- 其他→综合管理

日期推断：
- "4月15日"→"2026-04-15"
- "下周"→推断具体日期

文本：
${text}

返回格式示例：[{"title":"xxx","description":"xxx","department":"采购供应链","priority":"P1","due_date":"2026-04-15"}]`;

  try {
    const response = await axios.post(
      'https://api.lkeap.cloud.tencent.com/plan/v3/chat/completions',
      {
        model: 'hunyuan-turbos',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const content = response.data.choices[0].message.content;
    
    // 提取 JSON 数组
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('AI 返回格式错误，未找到 JSON 数组');
      return null;
    }

    const items = JSON.parse(jsonMatch[0]);
    
    // 映射部门名称到 ID
    return items.map(item => {
      const dept = departments.find(d => d.name === item.department);
      return {
        title: item.title.slice(0, 50),
        description: item.description.slice(0, 200),
        department_id: dept ? dept.id : 5, // 默认综合管理
        priority: item.priority || 'P1',
        due_date: item.due_date || null
      };
    });
  } catch (error) {
    console.error('AI 解析失败:', error.message);
    if (error.response) {
      console.error('AI 错误状态码:', error.response.status);
      console.error('AI 错误详情:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('AI 请求失败，无响应');
    } else {
      console.error('AI 请求配置错误:', error.config);
    }
    return null;
  }
}

module.exports = {
  parseWithAI
};