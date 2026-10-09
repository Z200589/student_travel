/**
 * 预算服务模块
 * 提供预算和消费记录的 CRUD 操作
 *
 * v1.10.0 增强：新增预算预测、消费告警、多币种支持、
 * 消费趋势分析和预算智能分配建议
 *
 * v1.13.0 增强：新增预算预测引擎、消费趋势可视化数据、
 * 分类消费占比分析优化
 *
 * v1.14.0 增强：引入预算健康度评分模型、多维度消费报告、
 * 智能省钱建议引擎升级
 *
 * @module services/budget-service
 * @version 1.15.0
 * @license MIT
 * @author WuSuBuDuoMing
 */

const { generateId } = require('../utils/mock-utils')
const tripService = require('./trip-service')

/**
 * 模拟消费记录
 */
const { loadExpenses, saveExpenses, spentForTrip } = require('./expense-store')

/**
 * 预算分类配置
 */
const BUDGET_CATEGORIES = [
  { key: 'transport', icon: '🚗', label: '交通' },
  { key: 'accommodation', icon: '🏨', label: '住宿' },
  { key: 'food', icon: '🤠', label: '餐饮' },
  { key: 'tickets', icon: '🎫', label: '门票' },
  { key: 'shopping', icon: '🛍', label: '购物' },
  { key: 'communication', icon: '📱', label: '通讯' },
  { key: 'insurance', icon: '🛡', label: '保险' },
  { key: 'other', icon: '📦', label: '其他' }
]

/**
 * 获取行程预算概览
 * @param {string} tripId - 行程 ID
 * @returns {Promise<Object>} 预算概览
 */
async function getBudgetOverview(tripId) {
  const trip = tripService.getTripById(tripId)
  const expenses = await getExpenses(tripId)
  const totalSpent = spentForTrip(tripId, expenses)
  const totalBudget = trip ? trip.totalBudget : 0

  const categoryBreakdown = BUDGET_CATEGORIES.map(cat => {
    const catExpenses = expenses.filter(e => e.category === cat.key)
    const catAmount = spentForTrip(tripId, catExpenses)
    return {
      ...cat,
      amount: catAmount,
      percentage: totalSpent > 0 ? Math.round((catAmount / totalSpent) * 100) : 0
    }
  }).filter(c => c.amount > 0)

  return {
    totalBudget,
    totalSpent,
    remaining: Math.round((totalBudget - totalSpent) * 100) / 100,
    percentage: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
    categoryBreakdown,
    dailyAverage: expenses.length > 0 ? Math.round(totalSpent / Math.max(1, new Set(expenses.map(e => e.date)).size)) : 0
  }
}

/**
 * 获取消费记录列表
 * @param {string} tripId - 行程 ID
 * @returns {Promise<Array>} 消费记录列表（按日期降序）
 */
async function getExpenses(tripId) {
  const allExpenses = loadExpenses()
  return allExpenses
    .filter(e => e.tripId === tripId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
}

/**
 * 添加消费记录
 * @param {Object} expense - 消费数据
 * @returns {Promise<Object>} 添加后的消费记录
 */
async function addExpense(expense) {
  if (expense.split !== undefined) {
    expense = { ...expense, split: require('./aa-service').validateSplit(expense.tripId, expense.amount, expense.split) }
  }
  if (typeof expense.amount !== 'number' || !Number.isFinite(expense.amount) || expense.amount <= 0 ||
      !/^\d+(\.\d{1,2})?$/.test(String(expense.amount))) {
    throw new Error('金额须为大于零、最多两位小数的数字')
  }
  const allExpenses = loadExpenses()
  const newExpense = { ...expense, id: generateId('expense') }
  allExpenses.push(newExpense)
  saveExpenses(allExpenses)
  return newExpense
}

/**
 * 删除消费记录
 * @param {string} id - 消费记录 ID
 * @returns {Promise<boolean>} 是否删除成功
 */
async function updateExpense(id, tripId, updates, expected) {
  const all = loadExpenses(), index = all.findIndex(e => e.id === id && e.tripId === tripId)
  if (index < 0) throw new Error('账单不存在，请刷新')
  const previous = all[index]
  if (!expected || JSON.stringify(previous) !== JSON.stringify(expected)) throw new Error('账单已变化，请重新打开编辑')
  const next = {...previous}
  for (const key of ['amount','description','date','category','split']) if (Object.prototype.hasOwnProperty.call(updates,key)) next[key]=updates[key]
  if (typeof next.amount !== 'number' || !Number.isFinite(next.amount) || next.amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(next.amount)) || !Number.isSafeInteger(Math.round(next.amount*100)) || next.amount>1000000) throw new Error('金额须为 0.01 至 1000000 元，最多两位小数')
  if (typeof next.description !== 'string' || !next.description.trim() || next.description.length>100) throw new Error('消费说明须为 1 至 100 个字符')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next.date) || !require('../utils/date-utils').parseDate(next.date)) throw new Error('请选择有效日期')
  if (!BUDGET_CATEGORIES.some(c=>c.key===next.category)) throw new Error('请选择有效分类')
  if ((previous.split !== undefined) !== (next.split !== undefined)) throw new Error('编辑不能改变账单的 AA 类型')
  if (next.split !== undefined) next.split=require('./aa-service').validateSplit(tripId,next.amount,next.split)
  next.description=next.description.trim()
  all[index]=next
  saveExpenses(all)
  return next
}
async function deleteExpense(id) {
  const allExpenses = loadExpenses()
  const filtered = allExpenses.filter(e => e.id !== id)
  saveExpenses(filtered)
  return true
}

/**
 * 获取预算分类配置
 * @returns {Array<Object>} 分类配置列表，每项包含 key, icon, label
 */
function getCategories() {
  return BUDGET_CATEGORIES
}

/**
 * 消费告警阈值配置
 * @private
 * @type {Object}
 */
const ALERT_THRESHOLDS = {
  safe: 70,      // 低于 70% 为安全
  warning: 90,   // 70%-90% 为警告
  danger: 100    // 90% 以上为危险
}

/**
 * 汇率配置（相对于人民币）
 * @private
 * @type {Object}
 */
const CURRENCY_RATES = {
  CNY: { symbol: '¥', rate: 1, label: '人民币' },
  USD: { symbol: '$', rate: 0.14, label: '美元' },
  EUR: { symbol: '€', rate: 0.13, label: '欧元' },
  JPY: { symbol: '¥', rate: 21.5, label: '日元' },
  GBP: { symbol: '£', rate: 0.11, label: '英镑' },
  THB: { symbol: '฿', rate: 5.0, label: '泰铢' },
  SGD: { symbol: 'S$', rate: 0.19, label: '新加坡元' },
  KRW: { symbol: '₩', rate: 195, label: '韩元' }
}

/**
 * 获取预算消费告警信息
 * 根据当前消费占比返回告警级别和提示信息
 *
 * @param {string} tripId - 行程 ID
 * @returns {Promise<Object>} 告警信息对象
 * @returns {string} .level - 告警级别（'safe'|'warning'|'danger'|'overspent'）
 * @returns {string} .message - 告警提示文本
 * @returns {number} .percentage - 预算使用百分比
 * @returns {number} .remaining - 剩余预算
 */
async function getBudgetAlert(tripId) {
  const overview = await getBudgetOverview(tripId)
  const { totalBudget, totalSpent, percentage, remaining } = overview

  if (totalSpent > totalBudget) {
    return {
      level: 'overspent',
      message: `已超支${Math.abs(remaining)}元，请控制后续消费`,
      percentage,
      remaining
    }
  }

  if (percentage >= ALERT_THRESHOLDS.danger) {
    return {
      level: 'danger',
      message: `预算已使用${percentage}%，剩余${remaining}元，请谨慎消费`,
      percentage,
      remaining
    }
  }

  if (percentage >= ALERT_THRESHOLDS.warning) {
    return {
      level: 'warning',
      message: `预算已使用${percentage}%，剩余${remaining}元，注意控制`,
      percentage,
      remaining
    }
  }

  return {
    level: 'safe',
    message: `预算充足，已使用${percentage}%，剩余${remaining}元`,
    percentage,
    remaining
  }
}

/**
 * 获取消费趋势分析
 * 按日期统计每日消费总额和消费频次，识别消费高峰
 *
 * @param {string} tripId - 行程 ID
 * @returns {Promise<Object>} 消费趋势数据
 * @returns {Array<Object>} .dailySpend - 每日消费记录（按日期升序）
 * @returns {number} .dailySpend[].amount - 当日消费总额
 * @returns {number} .dailySpend[].count - 当日消费笔数
 * @returns {string} .dailySpend[].date - 日期
 * @returns {string} .peakDay - 消费最高的日期
 * @returns {number} .peakAmount - 消费最高日的金额
 * @returns {string} .topCategory - 消费最多的分类
 */
async function getSpendTrend(tripId) {
  const expenses = await getExpenses(tripId)

  // 按日期分组统计
  const dailyMap = {}
  expenses.forEach(e => {
    if (!dailyMap[e.date]) {
      dailyMap[e.date] = { date: e.date, amount: 0, count: 0 }
    }
    dailyMap[e.date].amount += e.amount
    dailyMap[e.date].count += 1
  })

  const dailySpend = Object.values(dailyMap).sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  )

  // 识别消费高峰日
  let peakDay = ''
  let peakAmount = 0
  dailySpend.forEach(d => {
    if (d.amount > peakAmount) {
      peakAmount = d.amount
      peakDay = d.date
    }
  })

  // 统计消费最多的分类
  const categoryMap = {}
  expenses.forEach(e => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount
  })
  let topCategory = ''
  let topCategoryAmount = 0
  Object.entries(categoryMap).forEach(([cat, amount]) => {
    if (amount > topCategoryAmount) {
      topCategoryAmount = amount
      topCategory = cat
    }
  })

  return {
    dailySpend,
    peakDay,
    peakAmount,
    topCategory
  }
}

/**
 * 按币种格式化金额
 * 根据指定币种转换并格式化金额
 *
 * @param {number} amount - 人民币金额
 * @param {string} [currency='CNY'] - 目标币种代码（CNY/USD/EUR/JPY/GBP/THB/SGD/KRW）
 * @returns {Object} 格式化结果
 * @returns {string} .formatted - 格式化后的金额字符串（如 '$140.00'）
 * @returns {number} .converted - 转换后的数值
 * @returns {string} .currency - 币种代码
 * @returns {string} .symbol - 货币符号
 */
function formatCurrency(amount, currency = 'CNY') {
  const config = CURRENCY_RATES[currency] || CURRENCY_RATES.CNY
  const converted = Math.round(amount * config.rate * 100) / 100
  const formatted = `${config.symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return { formatted, converted, currency, symbol: config.symbol }
}

/**
 * 获取预算健康度评分
 * 综合多个维度（超支率、消费均匀度、分类集中度）计算健康分数
 *
 * @param {string} tripId - 行程 ID
 * @returns {Promise<Object>} 健康度评分报告
 * @returns {number} .score - 综合健康度得分 (0-100)
 * @returns {string} .grade - 健康等级 ('A'|'B'|'C'|'D')
 * @returns {string} .summary - 健康状况摘要
 * @returns {Object} .dimensions - 各维度分项得分
 * @returns {Array<string>} .suggestions - 个性化改进建议
 */
async function getBudgetHealthScore(tripId) {
  const overview = await getBudgetOverview(tripId)
  const trend = await getSpendTrend(tripId)

  // 维度1：预算控制得分 (40% 权重)
  let budgetControlScore = 100
  if (overview.percentage > 100) {
    budgetControlScore = Math.max(0, 100 - (overview.percentage - 100) * 5)
  } else if (overview.percentage > 90) {
    budgetControlScore = 60 + (100 - overview.percentage) * 4
  } else if (overview.percentage > 70) {
    budgetControlScore = 80 + (90 - overview.percentage)
  }

  // 维度2：消费均匀度得分 (30% 权重)
  // 消费越均匀得分越高，波动大的得分低
  let uniformityScore = 80
  if (trend.dailySpend.length > 1) {
    const amounts = trend.dailySpend.map(d => d.amount)
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const variance = amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amounts.length
    const cv = avg > 0 ? Math.sqrt(variance) / avg : 1 // 变异系数
    uniformityScore = Math.max(0, Math.min(100, Math.round((1 - cv) * 100)))
  }

  // 维度3：分类分散度得分 (30% 权重)
  // 消费分布越分散越好（避免单一分类占比过高）
  let diversityScore = 80
  const categoryMap = {}
  overview.categoryBreakdown.forEach(cat => {
    categoryMap[cat.key] = cat.percentage
  })
  const topCatPercentage = Math.max(...Object.values(categoryMap), 0)
  if (topCatPercentage > 60) {
    diversityScore = 40
  } else if (topCatPercentage > 40) {
    diversityScore = 60
  } else if (topCatPercentage > 25) {
    diversityScore = 80
  } else {
    diversityScore = 100
  }

  // 加权计算综合得分
  const score = Math.round(
    budgetControlScore * 0.4 +
    uniformityScore * 0.3 +
    diversityScore * 0.3
  )

  // 评级映射
  let grade, summary
  if (score >= 85) {
    grade = 'A'
    summary = '预算管理优秀，消费习惯健康'
  } else if (score >= 70) {
    grade = 'B'
    summary = '预算管理良好，有小幅优化空间'
  } else if (score >= 50) {
    grade = 'C'
    summary = '预算管理一般，建议关注消费结构'
  } else {
    grade = 'D'
    summary = '预算管理需要改进，建议严格控制开支'
  }

  // 生成个性化建议
  const suggestions = []
  if (budgetControlScore < 80) {
    suggestions.push('建议设置每日消费上限，避免超支')
  }
  if (uniformityScore < 60) {
    suggestions.push('消费波动较大，建议均衡每日开支')
  }
  if (diversityScore < 60) {
    const topCat = overview.categoryBreakdown.reduce((max, cat) =>
      cat.percentage > max.percentage ? cat : max, { percentage: 0 })
    if (topCat.percentage > 0) {
      suggestions.push(`${topCat.label || topCat.key}消费占比过高(${topCat.percentage}%)，建议适度控制`)
    }
  }
  if (suggestions.length === 0) {
    suggestions.push('继续保持当前的消费节奏')
  }

  return {
    score,
    grade,
    summary,
    dimensions: {
      budgetControl: budgetControlScore,
      uniformity: uniformityScore,
      diversity: diversityScore
    },
    suggestions
  }
}

/**
 * 生成综合消费报告
 * 整合预算概览、消费趋势、健康度评分等多维度数据
 *
 * @param {string} tripId - 行程 ID
 * @returns {Promise<Object>} 综合消费报告
 * @returns {Object} .overview - 预算概览
 * @returns {Object} .trend - 消费趋势
 * @returns {Object} .health - 健康度评分
 * @returns {Object} .prediction - 消费预测
 */
async function getExpenseReport(tripId) {
  const [overview, trend, health] = await Promise.all([
    getBudgetOverview(tripId),
    getSpendTrend(tripId),
    getBudgetHealthScore(tripId)
  ])

  // 简单消费预测：按已消费天数的日均消费推算总消费
  const daysWithExpense = trend.dailySpend.length
  const avgDailySpend = daysWithExpense > 0
    ? Math.round(trend.dailySpend.reduce((s, d) => s + d.amount, 0) / daysWithExpense)
    : 0

  const remainingBudget = overview.totalBudget - overview.totalSpent
  const estimatedRemainingDays = avgDailySpend > 0
    ? Math.floor(remainingBudget / avgDailySpend)
    : Infinity

  const prediction = {
    avgDailySpend,
    estimatedTotalSpending: overview.totalSpent + (avgDailySpend * 3), // 预估再3天后的总消费
    estimatedRemainingDays,
    isOnTrack: overview.percentage <= 90
  }

  return {
    overview,
    trend,
    health,
    prediction,
    generatedAt: new Date().toISOString()
  }
}

/**
 * 获取预算智能分配建议
 * 根据目的地、天数和总预算，生成合理的分类预算建议
 *
 * @param {number} totalBudget - 总预算
 * @param {number} days - 旅行天数
 * @param {string} [destination=''] - 目的地（影响分配比例）
 * @returns {Object} 预算分配建议
 * @returns {Object} .breakdown - 各分类建议金额
 * @returns {number} .dailyBudget - 日均预算
 * @returns {Array<string>} .savingsTips - 省钱建议
 */
function getBudgetSuggestion(totalBudget, days, destination = '') {
  // 根据目的地调整分配比例（不同目的地住宿/餐饮比例差异大）
  let ratios = {
    accommodation: 0.30,
    food: 0.25,
    transport: 0.15,
    tickets: 0.10,
    shopping: 0.10,
    other: 0.10
  }

  // 高消费城市（住宿占比更高）
  const expensiveCities = ['东京', '巴黎', '伦敦', '悉尼', '新加坡', '马尔代夫']
  if (expensiveCities.includes(destination)) {
    ratios.accommodation = 0.35
    ratios.food = 0.20
    ratios.shopping = 0.12
  }

  // 美食城市（餐饮占比更高）
  const foodCities = ['成都', '曼谷', '西安', '首尔']
  if (foodCities.includes(destination)) {
    ratios.food = 0.30
    ratios.accommodation = 0.25
    ratios.tickets = 0.08
  }

  const breakdown = {}
  Object.entries(ratios).forEach(([key, ratio]) => {
    breakdown[key] = Math.round(totalBudget * ratio)
  })

  const dailyBudget = days > 0 ? Math.round(totalBudget / days) : totalBudget

  // 生成省钱建议
  const savingsTips = []
  if (dailyBudget < 500) {
    savingsTips.push('选择青旅或民宿代替酒店，可节省大量住宿费')
    savingsTips.push('以公共交通和步行为主，减少出租车开支')
    savingsTips.push('在当地市场和小店用餐，性价比远高于景区餐厅')
  } else if (dailyBudget < 1500) {
    savingsTips.push('提前在平台预订酒店可享受早鸟价')
    savingsTips.push('购买交通通票/日票比单次购票更划算')
    savingsTips.push('部分景点提前在线购票可享受折扣')
  } else {
    savingsTips.push('提前预约热门餐厅避免排队浪费时间')
    savingsTips.push('购买城市旅游卡可免费进入多个景点')
    savingsTips.push('利用信用卡积分兑换部分消费')
  }

  return { breakdown, dailyBudget, savingsTips }
}

module.exports = {
  getBudgetOverview,
  getExpenses,
  addExpense,
  deleteExpense,
  updateExpense,
  getCategories,
  getBudgetAlert,
  getSpendTrend,
  formatCurrency,
  getBudgetSuggestion,
  getBudgetHealthScore,
  getExpenseReport
}
