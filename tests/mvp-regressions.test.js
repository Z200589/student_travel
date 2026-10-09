const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const storage = new Map()
global.wx = {
  getStorageSync: key => storage.has(key) ? structuredClone(storage.get(key)) : '',
  setStorageSync: (key, value) => storage.set(key, structuredClone(value)),
  showToast() {}, setNavigationBarTitle() {}, redirectTo() {}, navigateTo() {}
}
global.getApp = () => ({ globalData: { isDarkMode: false } })
global.Behavior = value => value
global.Component = () => {}
let definition
global.Page = value => { definition = value }
const trips = require('../services/trip-service')
const budget = require('../services/budget-service')
require('../pages/day-plan/day-plan')
const dayDefinition = definition
function pageFrom(file) {
  delete require.cache[require.resolve(file)]
  require(file)
  const page = { ...definition, data: structuredClone(definition.data),
    setData(patch) {
      for (const [key, value] of Object.entries(patch)) {
        const parts = key.split('.')
        let target = this.data
        for (const part of parts.slice(0, -1)) target = target[part]
        target[parts[parts.length - 1]] = structuredClone(value)
      }
    } }
  definition = dayDefinition
  return page
}

beforeEach(() => {
  storage.clear()
  storage.set('trips', [])
  storage.set('expenses', [])
})

function createTrip() {
  return trips.createTrip({ id: 'mvp', destination: '杭州', totalBudget: 600,
    itinerary: [{ date: '2026-10-10', activities: [
      { time: '09:00', name: '重复活动' },
      { time: '14:00', name: '下午活动' },
      { time: '10:00', name: '重复活动' }
    ] }] })
}

function loadPage() {
  const page = { ...definition, data: structuredClone(definition.data),
    setData(patch) { Object.assign(this.data, structuredClone(patch)) } }
  page.data.tripId = 'mvp'
  page.loadDayPlan('mvp', 0)
  return page
}

test('budget follows persisted trip and subsequent budget edits', async () => {
  createTrip()
  await budget.addExpense({ tripId: 'mvp', amount: 100, date: '2026-10-10', category: 'food' })
  let overview = await budget.getBudgetOverview('mvp')
  assert.equal(overview.totalBudget, 600)
  assert.equal(overview.remaining, 500)
  trips.updateTrip('mvp', { totalBudget: 800 })
  overview = await budget.getBudgetOverview('mvp')
  assert.equal(overview.totalBudget, 800)
  assert.equal(overview.remaining, 700)
})

test('missing trip does not invent a 25000 budget', async () => {
  assert.equal((await budget.getBudgetOverview('missing')).totalBudget, 0)
})

test('edit persists across serialization and selects correct duplicate', () => {
  createTrip()
  loadPage()._updateActivity(1, 'morning', '西湖散步')
  const activities = trips.getTripById('mvp').itinerary[0].activities
  assert.equal(activities[0].name, '重复活动')
  assert.equal(activities[1].name, '下午活动')
  assert.equal(activities[2].name, '西湖散步')
  assert.equal(loadPage().data.morningActivities[1].name, '西湖散步')
})

test('delete persists across serialization and preserves other periods', () => {
  createTrip()
  loadPage()._removeActivity(1, 'morning')
  assert.deepEqual(trips.getTripById('mvp').itinerary[0].activities.map(a => a.time), ['09:00', '14:00'])
  assert.equal(loadPage().data.morningActivities.length, 1)
})

function creationPage() {
  const page = pageFrom('../pages/create-trip/create-trip')
  Object.assign(page.data.form, { destination: '杭州', startDate: '2026-10-10',
    endDate: '2026-10-12', totalBudget: '600' })
  return page
}

test('manual creation produces three dated editable days, surviving reload', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const page = creationPage()
  page.onSubmitManual()
  const trip = trips.getAllTrips()[0]
  assert.deepEqual(trip.itinerary.map(d => d.date), ['2026-10-10', '2026-10-11', '2026-10-12'])
  assert.ok(trip.itinerary.every(d => d.activities.length === 0))
  const day = loadPage()
  day.data.tripId = trip.id
  day.loadDayPlan(trip.id, 1)
  day._addNewActivity('morning', '西湖散步')
  day._updateActivity(0, 'morning', '西湖骑行')
  assert.equal(trips.getTripById(trip.id).itinerary[1].activities[0].name, '西湖骑行')
  assert.equal(trips.getTripById(trip.id).itinerary[0].activities.length, 0)
  day._removeActivity(0, 'morning')
  assert.equal(trips.getTripById(trip.id).itinerary[1].activities.length, 0)
})

test('one-day trips work; invalid dates and invalid money are rejected', () => {
  const page = creationPage()
  page.data.form.endDate = page.data.form.startDate
  assert.equal(page._validate(), true)
  assert.equal(page._saveTrip(page._buildTripData()).itinerary.length, 1)
  page.data.form.startDate = '2026-02-30'
  assert.equal(page._validate(), false)
  page.data.form.startDate = '2026-10-10'
  for (const value of ['Infinity', '600abc', '0', '1.001']) {
    page.data.form.totalBudget = value
    assert.equal(page._validate(), false)
  }
})

test('real example generator yields named dated activities for requested duration', async () => {
  const page = creationPage()
  await page.onGenerateAI()
  const trip = trips.getAllTrips()[0]
  assert.equal(trip.planSource, 'example')
  assert.equal(trip.itinerary.length, 3)
  assert.equal(trip.itinerary[2].date, '2026-10-12')
  assert.ok(trip.itinerary[0].activities.every(a => a.id && a.name && a.time))
  const day = loadPage()
  day.data.tripId = trip.id
  day.loadDayPlan(trip.id, 0)
  assert.ok(day.data.morningActivities.length > 0)
})

test('100 expense leaves 500 consistently on home, list, detail and budget; deletion restores 600', async () => {
  const trip = creationPage()._saveTrip(creationPage()._buildTripData())
  const page = pageFrom('../pages/budget/budget')
  page.data.tripId = trip.id
  page.data.newExpense = { amount: '100', category: 'food', date: '2026-10-10', description: '聚餐' }
  await page.onSaveExpense()
  assert.equal(page.data.overview.remaining, 500)
  assert.equal(trips.getTripById(trip.id).spentBudget, 100)
  const list = pageFrom('../pages/trips/trips')
  await list.loadTrips()
  assert.equal(list.data.allTrips[0].spentBudget, 100)
  const detail = pageFrom('../pages/trip-detail/trip-detail')
  detail.loadTripDetail(trip.id)
  assert.equal(detail.data.budgetSpent, '100')
  const home = pageFrom('../pages/index/index')
  await home.loadData()
  assert.equal(home.data.budgetOverview.remaining, 500)
  await budget.deleteExpense(page.data.expenses[0].id)
  await page.onShow()
  assert.equal(page.data.overview.remaining, 600)
  assert.equal(trips.getAllTrips()[0].spentBudget, 0)
})

test('decimal amounts sum in cents and invalid amounts are rejected', async () => {
  createTrip()
  await budget.addExpense({ tripId: 'mvp', amount: 0.1 })
  await budget.addExpense({ tripId: 'mvp', amount: 0.2 })
  assert.equal((await budget.getBudgetOverview('mvp')).totalSpent, 0.3)
  assert.equal(trips.getTripById('mvp').spentBudget, 0.3)
  for (const amount of [Infinity, NaN, -1, 0, 1.001]) {
    await assert.rejects(budget.addExpense({ tripId: 'mvp', amount }))
  }
})

test('failed persistence does not report success or change saved activity and expense', async t => {
  createTrip()
  const messages = []
  t.mock.method(wx, 'showToast', value => messages.push(value))
  t.mock.method(wx, 'setStorageSync', () => { throw new Error('quota exceeded') })
  t.mock.method(console, 'error', () => {})
  loadPage()._updateActivity(0, 'morning', '不能保存')
  assert.equal(trips.getTripById('mvp').itinerary[0].activities[0].name, '重复活动')
  const page = pageFrom('../pages/budget/budget')
  page.data.tripId = 'mvp'
  page.data.newExpense = { amount: '100', description: '聚餐' }
  await page.onSaveExpense()
  assert.equal((await budget.getExpenses('mvp')).length, 0)
  assert.ok(messages.every(message => message.icon !== 'success'))
})

test('legacy string activities and empty itinerary are adapted without overwriting storage', () => {
  storage.set('trips', [{ id: 'legacy', startDate: '2026-10-10', endDate: '2026-10-12',
    itinerary: [{ activities: ['老行程'] }] }])
  const trip = trips.getTripById('legacy')
  assert.equal(trip.itinerary.length, 3)
  assert.equal(trip.itinerary[0].activities[0].name, '老行程')
  assert.equal(storage.get('trips')[0].itinerary[0].activities[0], '老行程')
})

test('trip card selection reaches detail from home and trip list', t => {
  let component
  t.mock.method(global, 'Component', value => { component = value })
  require('../components/trip-card/trip-card')
  let emitted
  component.methods.handleTap.call({ data: { trip: { id: 'mvp' } },
    triggerEvent: (name, detail) => { emitted = { name, detail } } })
  assert.equal(emitted.name, 'select')
  const routes = []
  t.mock.method(wx, 'navigateTo', value => routes.push(value.url))
  for (const file of ['../pages/index/index', '../pages/trips/trips']) {
    pageFrom(file).goToTripDetail({ detail: emitted.detail })
  }
  assert.deepEqual(routes, ['/pages/trip-detail/trip-detail?tripId=mvp', '/pages/trip-detail/trip-detail?tripId=mvp'])
  const fs = require('node:fs')
  const path = require('node:path')
  for (const file of ['pages/index/index.wxml', 'pages/trips/trips.wxml']) {
    assert.match(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), /bind:select="goToTripDetail"/)
  }
  const template = fs.readFileSync(path.join(__dirname, '../pages/day-plan/day-plan.wxml'), 'utf8')
  assert.equal((template.match(/bindlongpress="onEditActivity"/g) || []).length, 3)
})

test('fresh install has no automatic trips or ledger; example import is explicit and idempotent', async () => {
  storage.clear()
  assert.deepEqual(trips.getAllTrips(), [])
  assert.deepEqual(await budget.getExpenses('trip_001'), [])
  const examples = require('../services/example-trip-service')
  const trip = examples.addExampleTrip()
  assert.equal(trip.isExample, true)
  assert.equal(trip.itinerary.length, 3)
  assert.equal(examples.addExampleTrip().id, trip.id)
  assert.equal(trips.getAllTrips().length, 1)
  assert.equal((await budget.getBudgetOverview(trip.id)).totalSpent, 0)
})

test('explicit example does not replace existing trips or expenses', async () => {
  createTrip()
  await budget.addExpense({ tripId: 'mvp', amount: 100 })
  require('../services/example-trip-service').addExampleTrip()
  assert.equal(trips.getAllTrips().length, 2)
  assert.equal(trips.getTripById('mvp').spentBudget, 100)
  assert.equal((await budget.getExpenses('mvp')).length, 1)
})

test('itinerary API and page edit the same day; deletion leaves its date slot', () => {
  const trip = creationPage()._saveTrip(creationPage()._buildTripData())
  const itinerary = require('../services/itinerary-service')
  const created = itinerary.createDayPlan({ tripId: trip.id, dayIndex: 2,
    morning: ['西湖散步'], afternoon: ['午餐'] })
  assert.equal(created.dayIndex, 2)
  assert.equal(trips.getTripById(trip.id).itinerary[1].activities[0].name, '西湖散步')
  const page = loadPage()
  page.data.tripId = trip.id
  page.data.dayIndex = 1
  page.loadDayPlan(trip.id, 1)
  page._updateActivity(0, 'morning', '西湖骑行')
  assert.deepEqual(itinerary.getDayPlan(trip.id, 2).morning, ['西湖骑行'])
  itinerary.updateDayPlan(created.id, { morning: ['杭州早餐'] })
  assert.deepEqual(itinerary.getDayPlan(trip.id, 2).afternoon, ['午餐'])
  assert.equal(itinerary.deleteDayPlan(created.id), true)
  assert.equal(trips.getTripById(trip.id).itinerary.length, 3)
  assert.equal(itinerary.getDayPlan(trip.id, 2).date, '2026-10-11')
  assert.equal(itinerary.getDayPlan(trip.id, 2).activities.length, 0)
  assert.equal(storage.has('itinerary'), false)
  assert.throws(() => itinerary.createDayPlan({ tripId: trip.id, dayIndex: 4 }))
})

test('legacy separate itinerary is read without overwriting and edits persist in trip only', () => {
  storage.set('trips', [{ id: 'old', startDate: '2026-10-10', endDate: '2026-10-12', itinerary: [] }])
  const legacy = [{ id: 'old-day', tripId: 'old', dayIndex: 2, morning: ['旧活动'] }]
  storage.set('itinerary', legacy)
  const itinerary = require('../services/itinerary-service')
  assert.equal(itinerary.getDayPlan('old', 2).activities[0].name, '旧活动')
  itinerary.updateDayPlan('old-day', { morning: ['新活动'] })
  assert.equal(trips.getTripById('old').itinerary[1].activities[0].name, '新活动')
  assert.deepEqual(storage.get('itinerary'), legacy)
  assert.equal(itinerary.getDayPlan('old', 1).activities.length, 0)
})

test('read errors or corrupt collections cannot silently erase existing business data', async t => {
  createTrip()
  const saved = structuredClone(storage.get('trips'))
  const read = wx.getStorageSync
  t.mock.method(wx, 'getStorageSync', key => {
    if (key === 'trips') throw new Error('read failed')
    return read(key)
  })
  assert.throws(() => trips.createTrip({ destination: '不能保存' }), /read failed/)
  assert.deepEqual(storage.get('trips'), saved)
  storage.set('expenses', { broken: true })
  await assert.rejects(budget.addExpense({ tripId: 'mvp', amount: 100 }), /格式异常/)
  assert.deepEqual(storage.get('expenses'), { broken: true })
})
