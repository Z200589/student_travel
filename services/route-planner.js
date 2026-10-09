const catalog = require('../data/place-catalog')
const dates = require('../utils/date-utils')

function clean(value) { return String(value || '').trim().replace(/\s+/g, '') }
function cityName(value) {
  const name = clean(value).replace(/市$/, '')
  return catalog.cities.includes(name) ? name : ''
}
function parseNames(value) {
  return [...new Set(String(value || '').split(/[、,，;；\n]/).map(clean).filter(Boolean))]
}
function resolvePlaces(city, names) {
  const local = catalog.places.filter(place => place.city === cityName(city))
  const selected = []
  const unresolved = []
  for (const name of names) {
    const place = local.find(p => [p.name, ...p.aliases].some(alias => clean(alias) === clean(name)))
    if (!place) unresolved.push(name)
    else if (!selected.some(p => p.id === place.id)) selected.push(place)
  }
  return { selected, unresolved }
}
function distanceKm(a, b) {
  const rad = value => value * Math.PI / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
}
function routeDistance(route) {
  return route.slice(1).reduce((total, point, index) => total + distanceKm(route[index], point), 0)
}
// Try nearest-neighbour paths from every possible first stop. This heuristic
// reduces obvious backtracking; it does not guarantee the shortest route.
function orderPlaces(places) {
  if (places.length < 2) return places.slice()
  let best = places.slice()
  for (const first of places) {
    const route = [first]
    const remaining = places.filter(p => p.id !== first.id)
    while (remaining.length) {
      remaining.sort((a, b) => distanceKm(route[route.length - 1], a) - distanceKm(route[route.length - 1], b) || a.id.localeCompare(b.id))
      route.push(remaining.shift())
    }
    if (routeDistance(route) < routeDistance(best)) best = route
  }
  return best
}
function recommend(city, style, input = '') {
  const { selected } = resolvePlaces(city, parseNames(input))
  const tags = { adventure: 'culture', couple: 'photography', family: 'nature' }
  const interest = tags[style] || style
  return catalog.places.filter(place => place.city === cityName(city) && !selected.some(p => p.id === place.id))
    .map(place => {
      const nearby = selected.length ? Math.min(...selected.map(p => distanceKm(p, place))) : null
      const matches = place.tags.includes(interest)
      return { ...place, score: (matches ? 20 : 0) - (nearby || 0),
        recommendation: `${matches ? '符合你的旅行偏好。' : ''}${place.reason}`,
        nearbyText: nearby === null ? '' : `距已选地点最近约 ${nearby.toFixed(1)} 公里（直线估算）` }
    }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}
function timeText(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
function plan({ destination, startDate, endDate, pace = 'moderate', desiredPlaces = '' }) {
  const start = dates.parseDate(startDate)
  const end = dates.parseDate(endDate)
  if (!start || !end || end < start) throw new Error('请先填写有效的出发和返回日期')
  const days = dates.getDayCount(startDate, endDate)
  if (days > 30) throw new Error('当前支持规划 1–30 天行程')
  if (!cityName(destination)) throw new Error('当前离线推荐支持杭州、北京、成都；其他城市仍可手动创建')
  const names = parseNames(desiredPlaces)
  if (!names.length) throw new Error('请先输入想去的地点，或从推荐中添加')
  const { selected, unresolved } = resolvePlaces(destination, names)
  if (!selected.length) throw new Error('暂未识别这些地点，请使用推荐列表中的名称；暂不支持任意地点搜索')
  const settings = { relaxed: { limit: 2, minutes: 360 }, moderate: { limit: 3, minutes: 480 }, packed: { limit: 4, minutes: 600 } }
  const capacity = settings[pace] || settings.moderate
  const ordered = orderPlaces(selected)
  const itinerary = []
  let position = 0
  for (let index = 0; index < days; index++) {
    const target = Math.min(capacity.limit, Math.ceil((ordered.length - position) / (days - index)))
    const stops = []
    const activities = []
    let clock = 9 * 60
    let lunchAdded = false
    let distance = 0
    while (position < ordered.length && stops.length < target) {
      const place = ordered[position]
      const leg = stops.length ? distanceKm(stops[stops.length - 1], place) : 0
      // A conservative draft buffer only; never presented as road ETA.
      const buffer = stops.length ? Math.ceil(leg / 15 * 60) + 20 : 0
      const lunch = !lunchAdded && clock + buffer + place.visitMinutes > 12 * 60 ? 60 : 0
      if (clock + buffer + lunch + place.visitMinutes > 9 * 60 + capacity.minutes) break
      clock += buffer
      // Break before a stop only when it is already lunchtime; otherwise
      // account for a midday break within a long visit, keeping its 09:00 start.
      const breakBefore = lunch > 0 && clock >= 12 * 60 ? lunch : 0
      clock += breakBefore
      lunchAdded = lunchAdded || lunch > 0
      activities.push({ id: `route_${place.id}`, placeId: place.id, name: place.name, time: timeText(clock),
        durationMinutes: place.visitMinutes, latitude: place.latitude, longitude: place.longitude,
        type: 'activity', note: `建议游玩 ${place.visitMinutes} 分钟；${lunch > 0 && !breakBefore ? '时段内另预留午休 60 分钟。' : ''}${stops.length ? `与上一站直线约 ${leg.toFixed(1)} 公里。` : ''}开放及预约信息需自行确认。` })
      clock += place.visitMinutes + lunch - breakBefore
      distance += leg
      stops.push(place)
      position++
    }
    itinerary.push({ day: index + 1, date: dates.formatDate(dates.addDays(start, index)),
      title: stops.length ? stops.map(place => place.name).join(' → ') : '自由安排', activities,
      routeDistanceKm: Number(distance.toFixed(1)),
      transport: '仅按近似坐标估算直线距离，请用地图核实实际交通',
      tips: ['时间为规划草稿，已预留午餐和转场缓冲；不含住宿往返、入城和离城交通。'] })
  }
  const pending = [...unresolved.map(name => ({ name, reason: '未识别或不属于当前城市，未参与距离规划' })),
    ...ordered.slice(position).map(place => ({ name: place.name, reason: '超出当前天数或节奏的容量，建议增加天数或减少地点' }))]
  return { itinerary, pending, matchedCount: selected.length, scheduledCount: position,
    note: '基于内置地点的近似坐标与直线距离安排，不是实时导航或最优路线；未核验开放时间、门票和预约。手动修改活动后不会自动重算路线。' }
}
module.exports = { cityName, parseNames, resolvePlaces, distanceKm, orderPlaces, recommend, plan }
