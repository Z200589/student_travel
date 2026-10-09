const { parseDate } = require('../utils/date-utils')
function summarize(expenses, categories) {
  const categoryMap = new Map(categories.map(c => [c.key, c.label]))
  const byCategory = new Map(), byDate = new Map()
  let totalCents = 0
  for (const expense of expenses) {
    const amount = Number(expense.amount)
    const cents = Math.round(amount * 100)
    if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents)) throw new Error('账单金额异常，请检查消费记录')
    totalCents += cents
    const label = categoryMap.get(expense.category) || '其他'
    const date = typeof expense.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expense.date) && parseDate(expense.date) ? expense.date : '日期未记录'
    byCategory.set(label, (byCategory.get(label) || 0) + cents)
    byDate.set(date, (byDate.get(date) || 0) + cents)
  }
  if (!Number.isSafeInteger(totalCents)) throw new Error('账单总额超出计算范围')
  const categoriesData = [...byCategory].filter(([,c]) => c > 0).sort((a,b) => b[1]-a[1]).map(([name,cents]) => ({ name, cents, value: cents/100, amount: (cents/100).toFixed(2) }))
  const dailyData = [...byDate].sort((a,b) => a[0] === '日期未记录' ? 1 : b[0] === '日期未记录' ? -1 : a[0].localeCompare(b[0])).map(([date,cents]) => ({ date, cents, value: cents/100, amount: (cents/100).toFixed(2) }))
  return { categories: categoriesData, daily: dailyData, totalCents, total: (totalCents/100).toFixed(2) }
}
function options(summary, dark = false) {
  const color = dark ? '#E2E8F0' : '#374151', gridColor = dark ? '#334155' : '#E5E7EB'
  return {
    category: { animation: false, color: ['#079D69','#3B82F6','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#64748B','#F97316'],
      textStyle: { color }, tooltip: { show: false },
      series: [{ type: 'pie', radius: ['38%','68%'], center: ['50%','50%'], label: { show: false },
        data: summary.categories.map(c => ({ name: c.name, value: c.value })) }] },
    daily: { animation: false, textStyle: { color }, tooltip: { show: false },
      grid: { left: 12, right: 16, top: 24, bottom: 28, containLabel: true },
      xAxis: { type: 'category', data: summary.daily.map(d => d.date === '日期未记录' ? d.date : d.date.slice(5)), axisLabel: { color, rotate: 30 }, axisLine: { lineStyle: { color: gridColor } } },
      yAxis: { type: 'value', name: '元', axisLabel: { color }, splitLine: { lineStyle: { color: gridColor } } },
      dataZoom: summary.daily.length > 7 ? [{ type: 'inside', start: 0, end: Math.min(100, 700 / summary.daily.length) }] : [],
      series: [{ type: 'bar', barMaxWidth: 28, itemStyle: { color: '#079D69' }, data: summary.daily.map(d => d.value) }] }
  }
}
module.exports = { summarize, options }
