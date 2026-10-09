const { test } = require('node:test')
const assert = require('node:assert/strict')
const planner = require('../services/route-planner')
const catalog = require('../data/place-catalog')
const base = { destination: '杭州', startDate: '2026-10-10', endDate: '2026-10-12', pace: 'moderate' }

test('examples only contain catalog places in the selected city, never generic placeholders', () => {
  const examples = require('../services/example-trip-service')
  for (const destination of ['杭州', '北京', '成都']) {
    const result = examples.generateExample({ ...base, destination })
    const activities = result.itinerary.flatMap(day => day.activities)
    assert.ok(activities.length > 0)
    for (const activity of activities) {
      assert.ok(catalog.places.some(place => place.city === destination && place.id === activity.placeId && place.name === activity.name))
    }
  }
  assert.throws(() => examples.generateExample({ ...base, destination: '未知城市' }), /尚未收录真实地点/)
})

test('catalog is unique and coordinates/durations are bounded', () => {
  assert.equal(new Set(catalog.places.map(p => p.id)).size, catalog.places.length)
  for (const p of catalog.places) {
    assert.ok(Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90)
    assert.ok(Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180)
    assert.ok(p.visitMinutes > 0 && p.visitMinutes <= 300)
    assert.equal(p.coordinateQuality, 'approximate')
  }
})

test('parsing handles Chinese punctuation/newlines, aliases and duplicate POIs', () => {
  const names = planner.parseNames('西湖，西湖湖滨、灵隐寺\n河坊街;故宫')
  const resolved = planner.resolvePlaces('杭州市', names)
  assert.equal(resolved.selected.length, 3)
  assert.deepEqual(resolved.unresolved, ['故宫'])
})

test('haversine is symmetric and does not confuse degrees with kilometres', () => {
  const a = { latitude: 0, longitude: 0 }
  const b = { latitude: 0, longitude: 1 }
  assert.equal(planner.distanceKm(a, a), 0)
  assert.ok(Math.abs(planner.distanceKm(a, b) - 111.195) < 0.01)
  assert.equal(planner.distanceKm(a, b), planner.distanceKm(b, a))
})

test('ordering avoids a known zigzag and preserves each stop exactly once', () => {
  const stops = [0, 3, 1, 2].map(n => ({ id: String(n), latitude: 30, longitude: 120 + n / 100 }))
  const result = planner.orderPlaces(stops)
  const length = route => route.slice(1).reduce((sum, p, i) => sum + planner.distanceKm(route[i], p), 0)
  assert.ok(length(result) < length(stops))
  assert.deepEqual(result.map(p => p.id).sort(), ['0', '1', '2', '3'])
  assert.deepEqual(stops.map(p => p.id), ['0', '3', '1', '2'])
})

test('recommendation excludes chosen places and prioritizes matching interests', () => {
  const results = planner.recommend('杭州', 'food', '西湖')
  assert.equal(results[0].name, '河坊街')
  assert.ok(results.every(p => p.id !== 'hz-lake' && p.recommendation && p.nearbyText))
  assert.deepEqual(planner.recommend('未知城市', 'food'), [])
})

test('three selected locations form three dated days without losing unknown input', () => {
  const result = planner.plan({ ...base, desiredPlaces: '西湖、灵隐寺、河坊街、不认识的公园' })
  assert.equal(result.scheduledCount, 3)
  assert.deepEqual(result.itinerary.map(d => d.date), ['2026-10-10', '2026-10-11', '2026-10-12'])
  assert.ok(result.itinerary.every(day => day.activities.length === 1))
  assert.equal(result.pending[0].name, '不认识的公园')
})

test('busy one-day request keeps overflow visible and respects relaxed capacity', () => {
  const result = planner.plan({ ...base, endDate: base.startDate, pace: 'relaxed',
    desiredPlaces: catalog.places.filter(p => p.city === '杭州').map(p => p.name).join('、') })
  assert.ok(result.scheduledCount > 0 && result.scheduledCount <= 2)
  assert.equal(result.scheduledCount + result.pending.length, 6)
  assert.ok(result.pending.every(p => p.reason.includes('容量')))
})

test('long first visit starts at nine, and spare days remain editable empty days', () => {
  const result = planner.plan({ ...base, destination: '北京', desiredPlaces: '故宫' })
  assert.equal(result.itinerary[0].activities[0].time, '09:00')
  assert.equal(result.itinerary[1].activities.length, 0)
  assert.equal(result.pending.length, 0)
})

test('invalid dates, empty selection and unsupported city fail explicitly', () => {
  for (const patch of [{ startDate: '2026-02-30' }, { endDate: '2026-10-09' },
    { endDate: '2026-12-01' }, { desiredPlaces: '' }, { desiredPlaces: '未知地点' }, { destination: '上海' }]) {
    assert.throws(() => planner.plan({ ...base, desiredPlaces: '西湖', ...patch }))
  }
})

test('page previews before saving and preserves pending list after storage serialization', async () => {
  const data = new Map()
  let page
  let redirect
  global.wx = { getStorageSync: key => data.has(key) ? structuredClone(data.get(key)) : '',
    setStorageSync: (key, value) => data.set(key, structuredClone(value)),
    showToast() {}, showModal() {}, redirectTo: value => { redirect = value.url } }
  global.getApp = () => ({ globalData: {} })
  global.Behavior = value => value
  global.Page = value => { page = value }
  require('../pages/create-trip/create-trip')
  page.data = structuredClone(page.data)
  page.setData = patch => {
    for (const [key, value] of Object.entries(patch)) {
      if (key.startsWith('form.')) page.data.form[key.slice(5)] = structuredClone(value)
      else page.data[key] = structuredClone(value)
    }
  }
  Object.assign(page.data.form, base, { totalBudget: '600', desiredPlaces: '西湖、河坊街、未知公园' })
  page.onPreviewRoute()
  assert.equal(data.has('trips'), false)
  assert.equal(page.data.routePreview.scheduledCount, 2)
  page.onSaveRoute()
  const trip = require('../services/trip-service').getAllTrips()[0]
  assert.equal(trip.planSource, 'distance-draft')
  assert.equal(trip.unplannedPlaces[0].name, '未知公园')
  assert.equal(trip.itinerary.length, 3)
  assert.ok(redirect.includes(trip.id))
  page.onSaveRoute()
  assert.equal(data.get('trips').length, 1)
  page.onPreviewRoute()
  page.data.form.pace = 'packed'
  page.onSaveRoute()
  assert.equal(data.get('trips').length, 1, 'stale preview must not save')
  await page.onGenerateAI()
  assert.equal(page.data.routePreview.scheduledCount, 2, 'primary button must honor selected places')
  assert.equal(data.get('trips').length, 1, 'primary button should preview rather than save')
})
