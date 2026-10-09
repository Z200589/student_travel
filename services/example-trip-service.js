const tripService = require('./trip-service')
const { formatDate, addDays } = require('../utils/date-utils')
const planner = require('./route-planner')

function generateExample(trip) {
  const recommendations = planner.recommend(trip.destination, trip.style)
  if (!recommendations.length) {
    throw new Error('此城市尚未收录真实地点。当前支持杭州、北京、成都；请手动创建，或选择已支持城市。')
  }
  const result = planner.plan({ ...trip, desiredPlaces: recommendations.map(place => place.name).join('、') })
  return {
    itinerary: result.itinerary,
    unplannedPlaces: result.pending,
    planSource: 'example',
    planningNote: '示例活动只选用已收录的真实地点。' + result.note
  }
}

// Explicit opt-in sample, never installed automatically or mixed into old IDs.
function addExampleTrip() {
  const existing = tripService.getAllTrips().find(trip => trip.exampleKey === 'hangzhou-real-places-v2')
  if (existing) return existing
  const startDate = formatDate(addDays(new Date(), 1))
  const trip = {
    id: `example_${Date.now()}`, destination: '杭州',
    startDate, endDate: formatDate(addDays(startDate, 2)),
    totalBudget: 600, peopleCount: 2, style: 'relaxation', pace: 'moderate',
    isExample: true, exampleKey: 'hangzhou-real-places-v2', planSource: 'example',
    notes: '示例行程，可自由修改。请自行确认开放时间、交通和价格。', status: 'planning'
  }
  Object.assign(trip, generateExample(trip))
  return tripService.createTrip(trip)
}

module.exports = { addExampleTrip, generateExample }
