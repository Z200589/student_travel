const dates = require('./date-utils')

// Normalize generated and previously saved days to the shape used by pages.
function normalizeItinerary(trip, source = []) {
  const start = dates.parseDate(trip.startDate)
  const end = dates.parseDate(trip.endDate)
  if (!start || !end || end < start) throw new Error('旅行日期无效')
  const count = dates.getDayCount(trip.startDate, trip.endDate)
  return Array.from({ length: count }, (_, index) => {
    const day = source[index] || {}
    const activities = day.activities || day.items || ['morning', 'afternoon', 'evening'].flatMap((period, periodIndex) =>
      (day[period] || []).map(item => ({
        ...(typeof item === 'string' ? { name: item } : item),
        time: (typeof item === 'object' && item.time) || ['09:00', '14:00', '19:00'][periodIndex]
      })))
    return {
      ...day,
      id: day.id || `${trip.id}_day_${index + 1}`,
      day: index + 1,
      date: dates.formatDate(dates.addDays(start, index)),
      title: day.title || `第${index + 1}天`,
      activities: activities.map((activity, activityIndex) => {
        const item = typeof activity === 'string' ? { name: activity } : activity
        return {
          ...item,
          id: item.id || `${trip.id}_day_${index + 1}_activity_${activityIndex + 1}`,
          name: item.name || item.activity || item.title || '',
          time: item.time || ['09:00', '11:00', '14:00', '16:00', '19:00', '20:00'][Math.min(activityIndex, 5)],
          type: item.type || 'activity'
        }
      }),
      tips: Array.isArray(day.tips) ? day.tips : []
    }
  })
}

module.exports = { normalizeItinerary }
