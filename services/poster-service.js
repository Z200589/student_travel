const { normalizeItinerary } = require('../utils/itinerary-model')
function shorten(value, limit) {
  const text = Array.from(String(value || '').replace(/[\r\n]+/g, ' '))
  return text.length > limit ? text.slice(0, limit - 1).join('') + '…' : text.join('')
}
function buildPages(trip) {
  if (!trip || !trip.destination) throw new Error('旅行不存在，请返回旅行列表')
  return normalizeItinerary(trip, trip.itinerary || []).flatMap(day => {
    const count = Math.max(1, Math.ceil(day.activities.length / 6))
    return Array.from({ length: count }, (_, index) => ({ day: day.day, date: day.date, title: day.title, part: index + 1, parts: count,
      activities: day.activities.slice(index * 6, (index + 1) * 6),
      label: `第${day.day}天 · ${day.date}${count > 1 ? ` · ${index+1}/${count}` : ''}` }))
  })
}
function paletteFor(trip, page, showBudget = false) {
  const height = 480 + (page.activities.length || 1) * 148
  const text = (value, top, size, color = '#1A1A2E', maxLines = 1, width = 610) => ({ type: 'text', text: String(value), css: {
    left: '44rpx', top: `${top}rpx`, width: `${width}rpx`, fontSize: `${size}rpx`, lineHeight: `${size+12}rpx`, color, maxLines } })
  const views = [
    { type: 'rect', css: { left: '0rpx', top: '0rpx', width: '700rpx', height: '240rpx', color: '#087C69' } },
    text('结伴旅行 · 每日行程', 30, 26, '#D5F4E5'), text(shorten(trip.destination, 35), 78, 42, '#FFFFFF', 2),
    text(page.label, 188, 24, '#FFFFFF'), text(shorten(page.title, 38), 268, 30, '#1A1A2E', 2)
  ]
  if (!page.activities.length) views.push(text('这一天还没有安排，留点时间自由探索。', 364, 26, '#6B7280', 2))
  page.activities.forEach((activity, index) => {
    const top = 360 + index * 148
    views.push({ type: 'rect', css: { left: '44rpx', top: `${top}rpx`, width: '612rpx', height: '128rpx', color: '#ECF7F1', borderRadius: '16rpx' } })
    const time = text(activity.time || '时间待定', top+12, 24, '#087C69'); time.css.left='64rpx'; views.push(time)
    const name = text(shorten(activity.name || '未命名活动', 65), top+50, 26, '#1A1A2E', 2, 572); name.css.left='64rpx'; views.push(name)
  })
  views.push(text(showBudget ? `旅行总预算 ¥${Number(trip.totalBudget || 0).toFixed(2)}` : '带上好心情，一起出发', height-88, 24, '#087C69'))
  views.push(text('时间与地点以实际安排为准 · 部分长文字已缩略', height-48, 20, '#6B7280'))
  return { width: '700rpx', height: `${height}rpx`, background: '#FFFFFF', views }
}
module.exports = { buildPages, paletteFor }
