/**
 * AI 旅行计划助手 - 测试用例
 * 可在微信开发者工具控制台直接运行
 *
 * 运行方式：
 *   1. 在微信开发者工具中打开项目
 *   2. 打开调试器 -> Console 面板
 *   3. 复制本文件内容粘贴到控制台执行
 *   4. 或者在 AppData 面板的项目目录中通过 require 调用
 */

// ====== 简单测试框架 ======
let passCount = 0
let failCount = 0
const results = []
const pendingPromises = []

const assert = {
  equal(actual, expected, msg) {
    if (actual === expected) {
      passCount++
      console.log(`✅ PASS: ${msg}`)
      results.push({ status: 'pass', msg })
    } else {
      failCount++
      console.error(`❌ FAIL: ${msg} — Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`)
      results.push({ status: 'fail', msg, expected, actual })
    }
  },
  ok(value, msg) {
    this.equal(!!value, true, msg)
  },
  notNull(value, msg) {
    this.equal(value !== null && value !== undefined, true, msg)
  },
  notEqual(actual, expected, msg) {
    if (actual !== expected) {
      passCount++
      console.log(`✅ PASS: ${msg}`)
      results.push({ status: 'pass', msg })
    } else {
      failCount++
      console.error(`❌ FAIL: ${msg} — Got unexpected equality: ${JSON.stringify(actual)}`)
      results.push({ status: 'fail', msg, expected: `not ${JSON.stringify(expected)}`, actual })
    }
  },
  deepEqual(actual, expected, msg) {
    this.equal(JSON.stringify(actual), JSON.stringify(expected), msg)
  },
  throws(fn, msg) {
    try {
      fn()
      failCount++
      console.error(`❌ FAIL: ${msg} — Expected function to throw`)
      results.push({ status: 'fail', msg, expected: 'function to throw', actual: 'no throw' })
    } catch (e) {
      passCount++
      console.log(`✅ PASS: ${msg}`)
      results.push({ status: 'pass', msg })
    }
  },
  closeTo(actual, expected, tolerance, msg) {
    const diff = Math.abs(actual - expected)
    if (diff <= tolerance) {
      passCount++
      console.log(`✅ PASS: ${msg}`)
      results.push({ status: 'pass', msg })
    } else {
      failCount++
      console.error(`❌ FAIL: ${msg} — Expected ~${expected} (±${tolerance}), Got: ${actual}`)
      results.push({ status: 'fail', msg, expected: `~${expected}`, actual })
    }
  }
}

function describe(name, fn) {
  console.log(`\n📋 ${name}`)
  console.log('-'.repeat(40))
  try {
    fn()
  } catch (e) {
    failCount++
    console.error(`❌ FAIL: ${name} 组执行出错:`, e.message)
    results.push({ status: 'fail', msg: `${name} 组执行出错: ${e.message}` })
  }
}

// ====== 测试用例 ======

// -------------------------------------------------------
// 1. 日期工具函数
// -------------------------------------------------------
describe('日期工具函数 - formatDate', () => {
  const { formatDate } = require('../utils/date-utils')

  const d = new Date(2026, 6, 15) // July 15
  assert.equal(formatDate(d), '2026-07-15', 'formatDate 格式化 Date 对象')

  assert.equal(formatDate('2026-01-05'), '2026-01-05', 'formatDate 接收字符串参数')

  // 月份和日期补零
  assert.equal(formatDate(new Date(2026, 0, 1)), '2026-01-01', 'formatDate 月份补零')
  assert.equal(formatDate(new Date(2026, 11, 31)), '2026-12-31', 'formatDate 12月31日')
})

describe('日期工具函数 - formatDateRange', () => {
  const { formatDateRange } = require('../utils/date-utils')

  const range1 = formatDateRange('2026-07-15', '2026-07-20')
  assert.ok(range1.includes('7月15日'), 'formatDateRange 包含开始月日')
  assert.ok(range1.includes('7月20日'), 'formatDateRange 包含结束月日')
  assert.ok(range1.includes(' - '), 'formatDateRange 包含分隔符')

  const range2 = formatDateRange('2026-01-01', '2026-01-01')
  assert.ok(range2.includes('1月1日'), 'formatDateRange 同一天也正常工作')
})

describe('日期工具函数 - getDayCount', () => {
  const { getDayCount } = require('../utils/date-utils')

  assert.equal(getDayCount('2026-07-15', '2026-07-20'), 6, 'getDayCount 6天行程')
  assert.equal(getDayCount('2026-07-15', '2026-07-15'), 1, 'getDayCount 同一天返回1')
  assert.equal(getDayCount('2026-07-15', '2026-07-16'), 2, 'getDayCount 两天行程')
})

describe('日期工具函数 - getCountdownText', () => {
  const { getCountdownText, addDays, formatDate } = require('../utils/date-utils')

  // 今天
  const todayStr = formatDate(new Date())
  assert.equal(getCountdownText(todayStr), '今天出发', 'getCountdownText 今天出发')

  // 未来
  const futureDate = formatDate(addDays(new Date(), 10))
  const futureText = getCountdownText(futureDate)
  assert.ok(futureText.includes('还有'), 'getCountdownText 未来日期包含"还有"')
  assert.ok(futureText.includes('10'), 'getCountdownText 正确显示10天')

  // 过去
  const pastDate = formatDate(addDays(new Date(), -5))
  const pastText = getCountdownText(pastDate)
  assert.ok(pastText.includes('已出发'), 'getCountdownText 过去日期包含"已出发"')
})

describe('日期工具函数 - isToday', () => {
  const { isToday } = require('../utils/date-utils')

  assert.equal(isToday(new Date()), true, 'isToday 今天返回true')

  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 1)
  assert.equal(isToday(futureDate), false, 'isToday 明天返回false')

  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - 1)
  assert.equal(isToday(pastDate), false, 'isToday 昨天返回false')
})

describe('日期工具函数 - getTripStatus', () => {
  const { getTripStatus } = require('../utils/date-utils')

  assert.equal(typeof getTripStatus('2026-01-01', '2026-01-10'), 'string', 'getTripStatus 返回字符串')
  assert.equal(getTripStatus(null, null), 'planning', 'getTripStatus 无日期返回planning')
  assert.equal(getTripStatus('', ''), 'planning', 'getTripStatus 空字符串返回planning')
})

describe('日期工具函数 - getTripStatusText', () => {
  const { getTripStatusText } = require('../utils/date-utils')

  assert.equal(getTripStatusText('planning'), '规划中', 'getTripStatusText planning')
  assert.equal(getTripStatusText('upcoming'), '即将出发', 'getTripStatusText upcoming')
  assert.equal(getTripStatusText('ongoing'), '行程中', 'getTripStatusText ongoing')
  assert.equal(getTripStatusText('ended'), '已结束', 'getTripStatusText ended')
  assert.equal(getTripStatusText('unknown'), '未知', 'getTripStatusText 未知状态')
})

describe('日期工具函数 - getWeekday', () => {
  const { getWeekday } = require('../utils/date-utils')

  assert.ok(['周一','周二','周三','周四','周五','周六','周日'].includes(getWeekday(new Date(2026, 6, 15))), 'getWeekday 返回有效星期')
})

describe('日期工具函数 - parseDate', () => {
  const { parseDate, formatDate } = require('../utils/date-utils')

  const d = parseDate('2026-07-15')
  assert.notNull(d, 'parseDate 正常解析')
  assert.equal(formatDate(d), '2026-07-15', 'parseDate 解析后再格式化结果一致')

  assert.equal(parseDate(null), null, 'parseDate null 返回 null')
  assert.equal(parseDate(''), null, 'parseDate 空字符串返回 null')
  assert.equal(parseDate('not-a-date'), null, 'parseDate 无效格式返回 null')
  assert.equal(parseDate('2026-13-01'), null, 'parseDate 无效月份返回 null')
  assert.equal(parseDate('2026-02-30'), null, 'parseDate 无效日期(2月30日)返回 null')
  assert.equal(parseDate(12345), null, 'parseDate 数字类型返回 null')
})

describe('日期工具函数 - addDays / getMonthDay', () => {
  const { formatDate, addDays, getMonthDay } = require('../utils/date-utils')

  const d = new Date(2026, 6, 15)
  assert.equal(formatDate(addDays(d, 5)), '2026-07-20', 'addDays 加5天')
  assert.equal(formatDate(addDays(d, -5)), '2026-07-10', 'addDays 减5天')
  assert.equal(formatDate(addDays(d, 0)), '2026-07-15', 'addDays 加0天不变')

  assert.ok(getMonthDay(d).includes('7月'), 'getMonthDay 包含月')
  assert.ok(getMonthDay(d).includes('15'), 'getMonthDay 包含日')
})

// -------------------------------------------------------
// 2. 金额工具函数
// -------------------------------------------------------
describe('金额工具函数 - formatMoney', () => {
  const { formatMoney } = require('../utils/money-utils')

  assert.equal(formatMoney(12500), '¥12,500.00', 'formatMoney 格式化千分位')
  assert.equal(formatMoney(0), '¥0.00', 'formatMoney 零值')
  assert.equal(formatMoney(100), '¥100.00', 'formatMoney 三位数')
  assert.equal(formatMoney(1000000), '¥1,000,000.00', 'formatMoney 百万')
  assert.equal(formatMoney(null), '¥0', 'formatMoney null 返回 ¥0')
  assert.equal(formatMoney(undefined), '¥0', 'formatMoney undefined 返回 ¥0')
  assert.equal(formatMoney(NaN), '¥0', 'formatMoney NaN 返回 ¥0')
  assert.equal(formatMoney(5000, '$'), '$5,000.00', 'formatMoney 自定义货币符号')
})

describe('金额工具函数 - formatMoneyShort', () => {
  const { formatMoneyShort } = require('../utils/money-utils')

  assert.equal(formatMoneyShort(15000), '1.5万', 'formatMoneyShort 万级')
  assert.equal(formatMoneyShort(100000000), '1.0亿', 'formatMoneyShort 亿级')
  assert.equal(formatMoneyShort(500), '500', 'formatMoneyShort 小额')
  assert.equal(formatMoneyShort(null), '0', 'formatMoneyShort null')
  assert.equal(formatMoneyShort(-15000), '-1.5万', 'formatMoneyShort 负数万级')
  assert.equal(formatMoneyShort(0), '0', 'formatMoneyShort 零值')
})

describe('金额工具函数 - getBudgetUsagePercent', () => {
  const { getBudgetUsagePercent } = require('../utils/money-utils')

  assert.equal(getBudgetUsagePercent(5000, 10000), 50, 'getBudgetUsagePercent 50%')
  assert.equal(getBudgetUsagePercent(0, 10000), 0, 'getBudgetUsagePercent 0%')
  assert.equal(getBudgetUsagePercent(10000, 10000), 100, 'getBudgetUsagePercent 100%')
  assert.equal(getBudgetUsagePercent(0, 0), 0, 'getBudgetUsagePercent 除以零返回0')
  assert.equal(getBudgetUsagePercent(5000, 0), 0, 'getBudgetUsagePercent 总额为0返回0')
  assert.equal(getBudgetUsagePercent(15000, 10000), 150, 'getBudgetUsagePercent 超过100%')
})

describe('金额工具函数 - getBudgetStatus', () => {
  const { getBudgetStatus } = require('../utils/money-utils')

  assert.equal(getBudgetStatus(5000, 10000), 'safe', 'getBudgetStatus 50% -> safe')
  assert.equal(getBudgetStatus(0, 10000), 'safe', 'getBudgetStatus 0% -> safe')
  assert.equal(getBudgetStatus(6949, 10000), 'safe', 'getBudgetStatus 69.49% -> safe')
  assert.equal(getBudgetStatus(7000, 10000), 'warning', 'getBudgetStatus 70% -> warning')
  assert.equal(getBudgetStatus(7000, 10000), 'warning', 'getBudgetStatus 70% -> warning')
  assert.equal(getBudgetStatus(7500, 10000), 'warning', 'getBudgetStatus 75% -> warning')
  assert.equal(getBudgetStatus(8949, 10000), 'warning', 'getBudgetStatus 89.49% -> warning')
  assert.equal(getBudgetStatus(9000, 10000), 'danger', 'getBudgetStatus 90% -> danger')
  assert.equal(getBudgetStatus(9000, 10000), 'danger', 'getBudgetStatus 90% -> danger')
  assert.equal(getBudgetStatus(9500, 10000), 'danger', 'getBudgetStatus 95% -> danger')
  assert.equal(getBudgetStatus(10000, 10000), 'danger', 'getBudgetStatus 100% -> danger')
})

describe('金额工具函数 - getBudgetStatusColor', () => {
  const { getBudgetStatusColor } = require('../utils/money-utils')

  assert.equal(getBudgetStatusColor('safe'), '#52c41a', 'getBudgetStatusColor safe -> 绿色')
  assert.equal(getBudgetStatusColor('warning'), '#faad14', 'getBudgetStatusColor warning -> 黄色')
  assert.equal(getBudgetStatusColor('danger'), '#ff4d4f', 'getBudgetStatusColor danger -> 红色')
  assert.equal(getBudgetStatusColor('unknown'), '#52c41a', 'getBudgetStatusColor 未知状态 -> 默认绿色')
})

describe('金额工具函数 - getRemainMoney / isOverBudget / getOverBudgetAmount', () => {
  const { getRemainMoney, isOverBudget, getOverBudgetAmount } = require('../utils/money-utils')

  assert.equal(getRemainMoney(10000, 3000), 7000, 'getRemainMoney 剩余7000')
  assert.equal(getRemainMoney(10000, 10000), 0, 'getRemainMoney 刚好用完')
  assert.equal(getRemainMoney(10000, 12000), -2000, 'getRemainMoney 超支返回负数')
  assert.equal(getRemainMoney(0, 0), 0, 'getRemainMoney 双零')

  assert.equal(isOverBudget(11000, 10000), true, 'isOverBudget 超支')
  assert.equal(isOverBudget(5000, 10000), false, 'isOverBudget 未超支')
  assert.equal(isOverBudget(10000, 10000), false, 'isOverBudget 刚好不超支')
  assert.equal(isOverBudget(0, 0), false, 'isOverBudget 双零不超支')

  assert.equal(getOverBudgetAmount(11000, 10000), 1000, 'getOverBudgetAmount 超支1000')
  assert.equal(getOverBudgetAmount(5000, 10000), 0, 'getOverBudgetAmount 未超支返回0')
  assert.equal(getOverBudgetAmount(10000, 10000), 0, 'getOverBudgetAmount 刚好返回0')
})

describe('金额工具函数 - getDailyBudget', () => {
  const { getDailyBudget } = require('../utils/money-utils')

  assert.equal(getDailyBudget(10000, 5), 2000, 'getDailyBudget 10000/5天=2000')
  assert.equal(getDailyBudget(10000, 0), 10000, 'getDailyBudget 天数为0返回总额')
  assert.equal(getDailyBudget(10000, -1), 10000, 'getDailyBudget 天数为负返回总额')
  assert.equal(getDailyBudget(0, 5), 0, 'getDailyBudget 总额为0')
  assert.equal(getDailyBudget(null, 5), 0, 'getDailyBudget 总额null')
})

// -------------------------------------------------------
// 3. 行程工具函数
// -------------------------------------------------------
describe('行程工具函数 - 旅行风格映射', () => {
  const { getTravelStyleLabel, getTravelStyleIcon, getPaceLabel } = require('../utils/trip-utils')

  assert.equal(getTravelStyleLabel('food'), '美食之旅', 'getTravelStyleLabel food')
  assert.equal(getTravelStyleLabel('adventure'), '探险之旅', 'getTravelStyleLabel adventure')
  assert.equal(getTravelStyleLabel('relaxation'), '休闲度假', 'getTravelStyleLabel relaxation')
  assert.equal(getTravelStyleLabel('unknown_style'), 'unknown_style', 'getTravelStyleLabel 未知返回原文')
  assert.equal(getTravelStyleLabel(''), '未设置', 'getTravelStyleLabel 空字符串')

  assert.equal(typeof getTravelStyleIcon('food'), 'string', 'getTravelStyleIcon 返回字符串')
  assert.ok(getTravelStyleIcon('food').length > 0, 'getTravelStyleIcon 返回非空')
  assert.equal(getTravelStyleIcon('unknown'), '✈️', 'getTravelStyleIcon 未知返回默认')

  assert.equal(getPaceLabel('relaxed'), '休闲慢游', 'getPaceLabel relaxed')
  assert.equal(getPaceLabel('moderate'), '适中节奏', 'getPaceLabel moderate')
  assert.equal(getPaceLabel('packed'), '紧凑充实', 'getPaceLabel packed')
  assert.equal(getPaceLabel('whirlwind'), '暴走打卡', 'getPaceLabel whirlwind')
})

describe('行程工具函数 - 预算分类/心情映射', () => {
  const { getBudgetCategoryLabel, getMoodLabel, getMoodIcon } = require('../utils/trip-utils')

  assert.equal(getBudgetCategoryLabel('transport'), '交通', 'getBudgetCategoryLabel transport')
  assert.equal(getBudgetCategoryLabel('accommodation'), '住宿', 'getBudgetCategoryLabel accommodation')
  assert.equal(getBudgetCategoryLabel('food'), '餐饮', 'getBudgetCategoryLabel food')
  assert.equal(getBudgetCategoryLabel(''), '未分类', 'getBudgetCategoryLabel 空字符串')

  assert.equal(getMoodLabel('happy'), '开心愉悦', 'getMoodLabel happy')
  assert.equal(getMoodLabel('excited'), '兴奋期待', 'getMoodLabel excited')
  assert.equal(getMoodLabel(''), '未记录', 'getMoodLabel 空字符串')
  assert.ok(getMoodIcon('happy').length > 0, 'getMoodIcon 返回非空')
})

describe('行程工具函数 - getPackingProgress', () => {
  const { getPackingProgress } = require('../utils/trip-utils')

  assert.equal(getPackingProgress([]), 0, 'getPackingProgress 空数组返回0')
  assert.equal(getPackingProgress(null), 0, 'getPackingProgress null返回0')
  assert.equal(getPackingProgress(undefined), 0, 'getPackingProgress undefined返回0')

  const allChecked = [
    { checked: true },
    { checked: true },
    { checked: true }
  ]
  assert.equal(getPackingProgress(allChecked), 100, 'getPackingProgress 全部勾选=100%')

  const halfChecked = [
    { checked: true },
    { checked: false },
    { checked: true },
    { checked: false }
  ]
  assert.equal(getPackingProgress(halfChecked), 50, 'getPackingProgress 一半勾选=50%')

  const noneChecked = [
    { checked: false },
    { checked: false }
  ]
  assert.equal(getPackingProgress(noneChecked), 0, 'getPackingProgress 无勾选=0%')
})

describe('行程工具函数 - getPlaceTypeLabel', () => {
  const { getPlaceTypeLabel } = require('../utils/trip-utils')

  assert.equal(getPlaceTypeLabel('attraction'), '景点', 'getPlaceTypeLabel attraction')
  assert.equal(getPlaceTypeLabel('restaurant'), '餐厅', 'getPlaceTypeLabel restaurant')
  assert.equal(getPlaceTypeLabel('hotel'), '酒店', 'getPlaceTypeLabel hotel')
  assert.equal(getPlaceTypeLabel('airport'), '机场', 'getPlaceTypeLabel airport')
  assert.equal(getPlaceTypeLabel(''), '未知', 'getPlaceTypeLabel 空字符串')
  assert.equal(getPlaceTypeLabel(null), '未知', 'getPlaceTypeLabel null')
})

describe('行程工具函数 - generateTripSummary', () => {
  const { generateTripSummary } = require('../utils/trip-utils')

  assert.equal(generateTripSummary(null), '', 'generateTripSummary null 返回空字符串')
  assert.equal(generateTripSummary({}), '', 'generateTripSummary 空对象返回空字符串')

  const trip1 = { destination: '东京', startDate: '2026-07-15', endDate: '2026-07-20', totalBudget: 25000 }
  const summary = generateTripSummary(trip1)
  assert.ok(summary.includes('东京'), 'generateTripSummary 包含目的地')
  assert.ok(summary.includes('6天'), 'generateTripSummary 包含天数')
  assert.ok(summary.includes('¥'), 'generateTripSummary 包含预算符号')

  const trip2 = { destination: '巴黎' }
  const summary2 = generateTripSummary(trip2)
  assert.ok(summary2.includes('巴黎'), 'generateTripSummary 只有目的地也能生成')
})

describe('行程工具函数 - getTripProgress', () => {
  const { getTripProgress } = require('../utils/trip-utils')

  assert.equal(getTripProgress(null), 0, 'getTripProgress null 返回0')

  const emptyTrip = {}
  assert.equal(getTripProgress(emptyTrip), 0, 'getTripProgress 空对象返回0')

  const fullTrip = {
    startDate: '2026-07-15',
    endDate: '2026-07-20',
    itinerary: [{}, {}, {}],
    flights: { outbound: {}, inbound: {} },
    hotel: { name: '酒店' },
    budgetItems: [{}, {}, {}],
    packingList: [{}, {}]
  }
  const progress = getTripProgress(fullTrip)
  assert.ok(progress > 0, 'getTripProgress 完整行程进度 > 0')
  assert.ok(progress <= 100, 'getTripProgress 进度不超过100')
})

// -------------------------------------------------------
// 4. 存储工具函数
// -------------------------------------------------------
describe('存储工具函数', () => {
  const { getStorage, setStorage, removeStorage } = require('../utils/storage-utils')

  setStorage('_test_key', 'test_value')
  assert.equal(getStorage('_test_key'), 'test_value', 'setStorage/getStorage 正常读写')

  removeStorage('_test_key')
  assert.equal(getStorage('_test_key'), null, 'removeStorage 删除成功')

  assert.equal(getStorage('nonexistent_key_xyz'), null, 'getStorage 不存在的key返回null')

  // 测试存储对象
  setStorage('_test_obj', { a: 1, b: 'hello' })
  const stored = getStorage('_test_obj')
  assert.equal(stored.a, 1, 'setStorage 存储对象可读取')
  assert.equal(stored.b, 'hello', 'setStorage 对象字段完整')
  removeStorage('_test_obj')

  // 测试存储数组
  setStorage('_test_arr', [1, 2, 3])
  const arr = getStorage('_test_arr')
  assert.equal(arr.length, 3, 'setStorage 存储数组长度正确')
  assert.equal(arr[2], 3, 'setStorage 数组元素正确')
  removeStorage('_test_arr')
})

// -------------------------------------------------------
// 5. Mock 工具函数
// -------------------------------------------------------
describe('Mock工具函数 - generateId', () => {
  const { generateId } = require('../utils/mock-utils')

  const id1 = generateId('trip')
  const id2 = generateId('trip')
  assert.ok(id1.startsWith('trip_'), 'generateId 前缀正确')
  assert.notEqual(id1, id2, 'generateId 生成唯一ID')

  const id3 = generateId('expense')
  assert.ok(id3.startsWith('expense_'), 'generateId 自定义前缀')
})

describe('Mock工具函数 - randomFromArray / randomInt', () => {
  const { randomFromArray, randomInt } = require('../utils/mock-utils')

  const arr = [1, 2, 3, 4, 5]
  assert.ok(arr.includes(randomFromArray(arr)), 'randomFromArray 返回数组中的值')
  assert.equal(randomFromArray([]), undefined, 'randomFromArray 空数组返回undefined')
  assert.equal(randomFromArray(null), undefined, 'randomFromArray null返回undefined')

  for (let i = 0; i < 20; i++) {
    const n = randomInt(1, 10)
    assert.ok(n >= 1 && n <= 10, `randomInt 范围正确 (${n})`)
  }
})

describe('Mock工具函数 - shuffleArray', () => {
  const { shuffleArray } = require('../utils/mock-utils')

  const arr = [1, 2, 3, 4, 5]
  const shuffled = shuffleArray(arr)
  assert.equal(shuffled.length, arr.length, 'shuffleArray 长度不变')
  assert.deepEqual(arr, [1, 2, 3, 4, 5], 'shuffleArray 不修改原数组')
  assert.equal(shuffled.sort().join(','), '1,2,3,4,5', 'shuffleArray 元素相同')

  assert.equal(shuffleArray([]).length, 0, 'shuffleArray 空数组')
  assert.equal(shuffleArray(null).length, 0, 'shuffleArray null')
})

describe('Mock工具函数 - deepClone', () => {
  const { deepClone } = require('../utils/mock-utils')

  const obj = { a: 1, b: { c: 2 } }
  const cloned = deepClone(obj)
  cloned.b.c = 99
  assert.equal(obj.b.c, 2, 'deepClone 深拷贝独立')

  const arr = [{ x: 1 }, { x: 2 }]
  const clonedArr = deepClone(arr)
  clonedArr[0].x = 100
  assert.equal(arr[0].x, 1, 'deepClone 数组深拷贝独立')

  assert.equal(deepClone(null), null, 'deepClone null')
  assert.equal(deepClone(42), 42, 'deepClone 基本类型')
})

// -------------------------------------------------------
// 6. Trip Service 服务
// -------------------------------------------------------
describe('旅行服务 - tripService', () => {
  const tripService = require('../services/trip-service')

  // Legacy suite explicitly opts into fixtures; production starts empty.
  wx.setStorageSync('trips', JSON.parse(JSON.stringify(require('../data/mock-trips').MOCK_TRIPS)))
  wx.setStorageSync('expenses', JSON.parse(JSON.stringify(require('../data/mock-expenses').MOCK_EXPENSES)))
  const trips = tripService.getAllTrips()
  assert.ok(Array.isArray(trips), 'getAllTrips 返回数组')
  assert.ok(trips.length > 0, 'getAllTrips 有数据')

  const first = tripService.getTripById(trips[0].id)
  assert.equal(first.id, trips[0].id, 'getTripById 正确查找')

  assert.equal(tripService.getTripById('nonexistent_xyz'), null, 'getTripById 不存在返回null')

  const searched = tripService.searchTrips(trips[0].destination.substring(0, 2))
  assert.ok(searched.length > 0, 'searchTrips 能搜索到')

  // 搜索空关键词返回全部
  const allTrips = tripService.searchTrips('')
  assert.equal(allTrips.length, trips.length, 'searchTrips 空关键词返回全部')

  // 按状态筛选
  const planning = tripService.filterTripsByStatus('planning')
  assert.ok(Array.isArray(planning), 'filterTripsByStatus 返回数组')
  planning.forEach(t => {
    assert.equal(t.status, 'planning', 'filterTripsByStatus 筛选结果状态正确')
  })

  // 筛选全部
  const allFiltered = tripService.filterTripsByStatus('all')
  assert.equal(allFiltered.length, trips.length, 'filterTripsByStatus all 返回全部')
})

// -------------------------------------------------------
// 7. Mock 数据完整性检查
// -------------------------------------------------------
describe('Mock数据完整性 - MOCK_TRIPS', () => {
  const { MOCK_TRIPS } = require('../data/mock-trips')

  assert.equal(MOCK_TRIPS.length, 15, 'MOCK_TRIPS 包含15条数据')

  const requiredFields = ['id', 'destination', 'startDate', 'endDate', 'totalBudget', 'spentBudget', 'style', 'status', 'createdAt']

  MOCK_TRIPS.forEach((trip, index) => {
    requiredFields.forEach(field => {
      assert.notNull(trip[field], `MOCK_TRIPS[${index}](${trip.destination}) 包含字段: ${field}`)
    })
    assert.ok(typeof trip.destination === 'string' && trip.destination.length > 0, `MOCK_TRIPS[${index}] 目的地非空`)
    assert.ok(typeof trip.totalBudget === 'number' && trip.totalBudget >= 0, `MOCK_TRIPS[${index}] 预算为非负数`)
    assert.ok(['planning', 'upcoming', 'ongoing', 'ended'].includes(trip.status), `MOCK_TRIPS[${index}] 状态有效`)
    assert.ok(trip.id.startsWith('trip_'), `MOCK_TRIPS[${index}] ID前缀正确`)
  })
})

describe('Mock数据完整性 - MOCK_ITINERARY', () => {
  const { MOCK_ITINERARY } = require('../data/mock-itinerary')

  assert.ok(MOCK_ITINERARY.length > 0, 'MOCK_ITINERARY 有数据')

  const requiredFields = ['id', 'tripId', 'dayIndex', 'date', 'title', 'morning', 'afternoon', 'evening']

  MOCK_ITINERARY.forEach((day, index) => {
    requiredFields.forEach(field => {
      assert.notNull(day[field], `MOCK_ITINERARY[${index}](${day.id}) 包含字段: ${field}`)
    })
    assert.ok(Array.isArray(day.morning), `MOCK_ITINERARY[${index}] morning 为数组`)
    assert.ok(Array.isArray(day.afternoon), `MOCK_ITINERARY[${index}] afternoon 为数组`)
    assert.ok(Array.isArray(day.evening), `MOCK_ITINERARY[${index}] evening 为数组`)
    assert.ok(day.morning.length > 0, `MOCK_ITINERARY[${index}] morning 有内容`)
  })
})

describe('Mock数据完整性 - MOCK_PLACES', () => {
  const { MOCK_PLACES } = require('../services/place-service')

  assert.ok(MOCK_PLACES.length > 0, 'MOCK_PLACES 有数据')

  MOCK_PLACES.forEach((place, index) => {
    assert.notNull(place.id, `MOCK_PLACES[${index}] 有id`)
    assert.notNull(place.tripId, `MOCK_PLACES[${index}] 有tripId`)
    assert.notNull(place.name, `MOCK_PLACES[${index}] 有name`)
    assert.equal(typeof place.favorite, 'boolean', `MOCK_PLACES[${index}] favorite为布尔值`)
    assert.equal(typeof place.visited, 'boolean', `MOCK_PLACES[${index}] visited为布尔值`)
  })
})

// -------------------------------------------------------
// 8. 边界情况测试
// -------------------------------------------------------
describe('边界情况 - 日期工具', () => {
  const { formatDate, getDayCount, getCountdown, parseDate } = require('../utils/date-utils')

  // formatDate 边界
  assert.equal(formatDate(new Date(2000, 0, 1)), '2000-01-01', 'formatDate 千禧年')
  assert.equal(formatDate(new Date(2099, 11, 31)), '2099-12-31', 'formatDate 远未来')

  // getDayCount 边界
  assert.equal(getDayCount('2026-12-31', '2027-01-01'), 2, 'getDayCount 跨年')
  assert.equal(getDayCount('2026-02-28', '2026-03-01'), 2, 'getDayCount 闰年后')

  // parseDate 边界
  assert.equal(parseDate('2026-00-01'), null, 'parseDate 月份0')
  assert.equal(parseDate('2026-13-01'), null, 'parseDate 月份13')
  assert.equal(parseDate('2026-01-32'), null, 'parseDate 日期32')
})

describe('边界情况 - 金额工具', () => {
  const { formatMoney, getBudgetUsagePercent, getOverBudgetAmount } = require('../utils/money-utils')

  assert.equal(formatMoney(-5000), '¥-5,000.00', 'formatMoney 负数')
  assert.equal(formatMoney(99999999), '¥99,999,999.00', 'formatMoney 大额')
  assert.equal(formatMoney(0.1), '¥0.10', 'formatMoney 小数')

  assert.equal(getBudgetUsagePercent(0, 0), 0, 'getBudgetUsagePercent 双零')
  assert.equal(getBudgetUsagePercent(1, 1000000), 0, 'getBudgetUsagePercent 极小比例')

  assert.equal(getOverBudgetAmount(0, 10000), 0, 'getOverBudgetAmount 花费为0')
  assert.equal(getOverBudgetAmount(10000, 0), 10000, 'getOverBudgetAmount 预算为0')
})

describe('边界情况 - Mock工具', () => {
  const { randomInt, shuffleArray, deepClone } = require('../utils/mock-utils')

  // randomInt 边界
  assert.equal(randomInt(1, 1), 1, 'randomInt min=max 返回该值')
  assert.ok(randomInt(0, 0) === 0, 'randomInt 0到0 返回0')

  // shuffleArray 边界
  assert.equal(shuffleArray([]).length, 0, 'shuffleArray 空数组')
  assert.equal(shuffleArray([42]).length, 1, 'shuffleArray 单元素数组')
  assert.equal(shuffleArray([42])[0], 42, 'shuffleArray 单元素数组值不变')

  // deepClone 边界
  const date = new Date('2026-07-15')
  const clonedDate = deepClone(date)
  assert.ok(clonedDate instanceof Date, 'deepClone Date类型')
  assert.equal(clonedDate.getTime(), date.getTime(), 'deepClone Date值相同')
  assert.notEqual(clonedDate, date, 'deepClone Date引用不同')
})

// -------------------------------------------------------
// 9. 预算服务
// -------------------------------------------------------
describe('预算服务 - budgetService', () => {
  const budgetService = require('../services/budget-service')

  const categories = budgetService.getCategories()
  assert.ok(Array.isArray(categories), 'getCategories 返回数组')
  assert.ok(categories.length > 0, 'getCategories 有数据')
  assert.ok(categories.every(c => c.key && c.label), 'getCategories 每项有key和label')
})

// -------------------------------------------------------
// 10. 行李服务
// -------------------------------------------------------
describe('行李服务 - packingService', () => {
  const packingService = require('../services/packing-service')

  const categories = packingService.getCategories()
  assert.ok(Array.isArray(categories), 'getCategories 返回数组')
  assert.ok(categories.length > 0, 'getCategories 有数据')
  assert.ok(categories.some(c => c.key === '全部'), 'getCategories 包含"全部"分类')
})

// -------------------------------------------------------
// 11. 行程生成服务
// -------------------------------------------------------
describe('行程生成服务 - itineraryService', () => {
  const { generateMockItinerary, getItineraryByTripId, getDayPlan, createDayPlan, updateDayPlan, deleteDayPlan } = require('../services/itinerary-service')

  // generateMockItinerary 测试
  const itinerary = generateMockItinerary('trip_test', {
    destination: '东京',
    startDate: '2026-07-15',
    endDate: '2026-07-20',
    style: 'normal'
  })
  assert.ok(Array.isArray(itinerary), 'generateMockItinerary 返回数组')
  assert.equal(itinerary.length, 6, 'generateMockItinerary 6天行程生成6条')
  assert.equal(itinerary[0].tripId, 'trip_test', 'generateMockItinerary tripId正确')
  assert.equal(itinerary[0].dayIndex, 1, 'generateMockItinerary 第一天dayIndex=1')
  assert.equal(itinerary[5].dayIndex, 6, 'generateMockItinerary 最后一天dayIndex=6')
  assert.ok(Array.isArray(itinerary[0].morning), 'generateMockItinerary morning为数组')
  assert.ok(Array.isArray(itinerary[0].afternoon), 'generateMockItinerary afternoon为数组')
  assert.ok(Array.isArray(itinerary[0].evening), 'generateMockItinerary evening为数组')
  assert.ok(itinerary[0].morning.length > 0, 'generateMockItinerary morning有内容')
  assert.ok(typeof itinerary[0].estimatedCost === 'number', 'generateMockItinerary estimatedCost为数字')
  assert.ok(itinerary[0].estimatedCost > 0, 'generateMockItinerary estimatedCost大于0')

  // 不同风格的费用差异
  const budgetItinerary = generateMockItinerary('trip_b', {
    destination: '巴黎', startDate: '2026-08-01', endDate: '2026-08-03', style: 'budget'
  })
  const luxuryItinerary = generateMockItinerary('trip_c', {
    destination: '巴黎', startDate: '2026-08-01', endDate: '2026-08-03', style: 'luxury'
  })
  assert.ok(luxuryItinerary[0].estimatedCost > budgetItinerary[0].estimatedCost,
    'generateMockItinerary 奢华风格费用高于经济风格')

  // 未知目的地应使用通用模板
  const genericItinerary = generateMockItinerary('trip_d', {
    destination: '未知城市', startDate: '2026-09-01', endDate: '2026-09-02', style: 'normal'
  })
  assert.ok(genericItinerary.length === 2, 'generateMockItinerary 未知目的地也能生成行程')

  // 首日和末日特殊处理
  assert.ok(itinerary[0].morning.some(a => a.includes('抵达')), 'generateMockItinerary 首日包含抵达')
  assert.ok(itinerary[5].evening.some(a => a.includes('返程') || a.includes('结束')), 'generateMockItinerary 末日包含返程')

  // getItineraryByTripId 测试
  const tokyoItinerary = getItineraryByTripId('trip_001')
  assert.ok(Array.isArray(tokyoItinerary), 'getItineraryByTripId 返回数组')
  if (tokyoItinerary.length > 1) {
    assert.ok(tokyoItinerary[0].dayIndex <= tokyoItinerary[1].dayIndex,
      'getItineraryByTripId 按dayIndex升序排列')
  }

  // getDayPlan 测试
  const day1 = getDayPlan('trip_001', 1)
  if (day1) {
    assert.equal(day1.dayIndex, 1, 'getDayPlan 返回正确的dayIndex')
    assert.equal(day1.tripId, 'trip_001', 'getDayPlan 返回正确的tripId')
  }
  assert.equal(getDayPlan('trip_001', 999), null, 'getDayPlan 不存在返回null')
})

// -------------------------------------------------------
// 12. 预算跟踪服务
// -------------------------------------------------------
describe('预算跟踪服务 - budgetService', () => {
  const budgetService = require('../services/budget-service')

  // getBudgetOverview 测试
  pendingPromises.push(budgetService.getBudgetOverview('trip_001').then(overview => {
    assert.ok(typeof overview.totalBudget === 'number', 'getBudgetOverview totalBudget为数字')
    assert.ok(typeof overview.totalSpent === 'number', 'getBudgetOverview totalSpent为数字')
    assert.ok(typeof overview.remaining === 'number', 'getBudgetOverview remaining为数字')
    assert.ok(typeof overview.percentage === 'number', 'getBudgetOverview percentage为数字')
    assert.ok(overview.totalBudget > 0, 'getBudgetOverview 总预算大于0')
    assert.ok(overview.totalSpent >= 0, 'getBudgetOverview 已花费非负')
    assert.equal(overview.remaining, overview.totalBudget - overview.totalSpent, 'getBudgetOverview remaining=total-totalSpent')
    assert.ok(Array.isArray(overview.categoryBreakdown), 'getBudgetOverview categoryBreakdown为数组')
    assert.ok(overview.categoryBreakdown.length > 0, 'getBudgetOverview 有分类明细')
    assert.ok(typeof overview.dailyAverage === 'number', 'getBudgetOverview dailyAverage为数字')

    // 分类明细验证
    overview.categoryBreakdown.forEach(cat => {
      assert.ok(cat.key, 'getBudgetOverview 分类有key')
      assert.ok(cat.label, 'getBudgetOverview 分类有label')
      assert.ok(typeof cat.amount === 'number', 'getBudgetOverview 分类金额为数字')
      assert.ok(typeof cat.percentage === 'number', 'getBudgetOverview 分类百分比为数字')
    })
  }))

  // getExpenses 测试
  pendingPromises.push(budgetService.getExpenses('trip_001').then(expenses => {
    assert.ok(Array.isArray(expenses), 'getExpenses 返回数组')
    assert.ok(expenses.length > 0, 'getExpenses trip_001有数据')
    expenses.forEach(e => {
      assert.ok(e.id, 'getExpenses 每条有id')
      assert.equal(e.tripId, 'trip_001', 'getExpenses tripId正确')
      assert.ok(typeof e.amount === 'number', 'getExpenses amount为数字')
      assert.ok(e.amount > 0, 'getExpenses amount大于0')
      assert.ok(e.category, 'getExpenses 有category')
      assert.ok(e.date, 'getExpenses 有date')
    })

    // 按日期降序
    if (expenses.length > 1) {
      assert.ok(new Date(expenses[0].date) >= new Date(expenses[1].date),
        'getExpenses 按日期降序排列')
    }
  }))

  // getExpenses 不存在的行程
  pendingPromises.push(budgetService.getExpenses('nonexistent_trip').then(expenses => {
    assert.ok(Array.isArray(expenses), 'getExpenses 不存在的行程返回空数组')
    assert.equal(expenses.length, 0, 'getExpenses 不存在的行程数据为空')
  }))

  // addExpense / deleteExpense 测试
  pendingPromises.push(budgetService.addExpense({
    tripId: 'trip_test', category: 'food', description: '测试消费', amount: 100, date: '2026-06-11'
  }).then(newExpense => {
    assert.ok(newExpense.id, 'addExpense 返回的记录有id')
    assert.equal(newExpense.tripId, 'trip_test', 'addExpense tripId正确')
    assert.equal(newExpense.amount, 100, 'addExpense amount正确')

    return budgetService.deleteExpense(newExpense.id)
  }).then(result => {
    assert.equal(result, true, 'deleteExpense 返回true')
  }))
})

// -------------------------------------------------------
// 13. 行李清单服务
// -------------------------------------------------------
describe('行李清单服务 - packingService 详细', () => {
  const packingService = require('../services/packing-service')

  // getPackingList 测试
  pendingPromises.push(packingService.getPackingList('trip_001').then(list => {
    assert.ok(Array.isArray(list), 'getPackingList 返回数组')
    assert.ok(list.length > 0, 'getPackingList trip_001有数据')
    list.forEach(item => {
      assert.ok(item.id, 'getPackingList 每项有id')
      assert.equal(item.tripId, 'trip_001', 'getPackingList tripId正确')
      assert.ok(item.name, 'getPackingList 每项有name')
      assert.ok(item.category, 'getPackingList 每项有category')
      assert.ok(typeof item.checked === 'boolean', 'getPackingList checked为布尔值')
      assert.ok(typeof item.quantity === 'number', 'getPackingList quantity为数字')
    })

    // 验证分类
    const categories = [...new Set(list.map(i => i.category))]
    assert.ok(categories.length > 1, 'getPackingList 包含多个分类')
    assert.ok(categories.includes('证件'), 'getPackingList 包含证件分类')
  }))

  // getPackingList 不存在的行程
  pendingPromises.push(packingService.getPackingList('nonexistent_trip').then(list => {
    assert.ok(Array.isArray(list), 'getPackingList 不存在的行程返回空数组')
    assert.equal(list.length, 0, 'getPackingList 不存在的行程数据为空')
  }))

  // addItem / toggleItem / deleteItem 测试
  pendingPromises.push(packingService.addItem({
    tripId: 'trip_test', name: '测试物品', category: '其他', quantity: 1
  }).then(newItem => {
    assert.ok(newItem.id, 'addItem 返回的物品有id')
    assert.equal(newItem.name, '测试物品', 'addItem name正确')
    assert.equal(newItem.checked, false, 'addItem 默认未勾选')

    return packingService.toggleItem(newItem.id)
  }).then(toggled => {
    assert.ok(toggled, 'toggleItem 返回物品')
    if (!toggled) return
    assert.equal(toggled.checked, true, 'toggleItem 切换为已勾选')

    return packingService.toggleItem(toggled.id)
  }).then(toggledBack => {
    if (!toggledBack) return
    assert.equal(toggledBack.checked, false, 'toggleItem 再次切换为未勾选')

    return packingService.deleteItem(toggledBack.id)
  }).then(result => {
    if (result !== undefined) {
      assert.equal(result, true, 'deleteItem 返回true')
    }
  }).catch(err => {
    failCount++
    console.error(`❌ FAIL: 行李清单 addItem/toggleItem/deleteItem 链出错:`, err.message)
    results.push({ status: 'fail', msg: `addItem/toggleItem/deleteItem 链出错: ${err.message}` })
  }))

  // toggleItem 不存在的物品
  pendingPromises.push(packingService.toggleItem('nonexistent_id').then(result => {
    assert.equal(result, null, 'toggleItem 不存在返回null')
  }))
})

// ====== 测试结果汇总（等待所有异步测试完成后输出） ======
Promise.allSettled(pendingPromises).then(() => {
  console.log('\n' + '='.repeat(50))
  console.log(`📊 测试结果: ${passCount} 通过 / ${failCount} 失败 / ${passCount + failCount} 总计`)
  console.log('='.repeat(50))
  if (failCount === 0) {
    console.log('🎉 全部通过！')
  } else {
    console.log(`⚠️ 存在 ${failCount} 个失败用例，请检查上方输出：`)
    console.log('')
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  ❌ ${r.msg}`)
      if (r.expected !== undefined) {
        console.log(`     期望: ${JSON.stringify(r.expected)}`)
        console.log(`     实际: ${JSON.stringify(r.actual)}`)
      }
    })
  }
  console.log('')
  console.log(`通过率: ${passCount > 0 ? Math.round((passCount / (passCount + failCount)) * 100) : 0}%`)

  if (failCount > 0) {
    process.exit(1)
  }
}).catch(err => {
  console.error('测试执行异常:', err)
  process.exit(1)
})
