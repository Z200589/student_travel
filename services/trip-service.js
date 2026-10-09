/**
 * 旅行计划服务模块
 * 提供旅行计划的 CRUD 操作，基于本地存储实现
 * 新用户使用空列表；示例需显式添加，旧记录保持可读
 *
 * @module services/trip-service
 * @version 1.15.0
 * @license MIT
 * @author WuSuBuDuoMing
 */

const { setStorage } = require('../utils/storage-utils')
const { readCollection } = require('../utils/collection-storage')
const { generateId } = require('../utils/mock-utils')
const { spentForTrip, loadExpenses } = require('./expense-store')
const { normalizeItinerary } = require('../utils/itinerary-model')
const { parseDate, getDayCount } = require('../utils/date-utils')

/** 本地存储键名 */
const STORAGE_KEY = 'trips'

/**
 * 从存储中加载旅行列表，并只读兼容旧版独立日程
 * @returns {Array<Object>} 旅行计划数组
 * @private
 */
function _loadTrips() {
  const expenses = loadExpenses()
  const trips = readCollection(STORAGE_KEY)
  const legacyDays = readCollection('itinerary')
  return trips.map(trip => ({
    ...trip,
    itinerary: parseDate(trip.startDate) && parseDate(trip.endDate) && trip.endDate >= trip.startDate
      ? normalizeItinerary(trip, trip.itinerary && trip.itinerary.length ? trip.itinerary
        : Array.from({ length: getDayCount(trip.startDate, trip.endDate) }, (_, index) =>
          legacyDays.find(day => day.tripId === trip.id && day.dayIndex === index + 1) || {}))
      : (trip.itinerary || []),
    spentBudget: spentForTrip(trip.id, expenses)
  }))
}

/**
 * 将旅行列表保存到本地存储
 * @param {Array<Object>} trips - 要保存的旅行数组
 * @private
 */
function _saveTrips(trips) {
  if (!setStorage(STORAGE_KEY, trips)) throw new Error('旅行保存失败，请重试')
}

/**
 * 获取所有旅行计划
 * @returns {Array<Object>} 旅行计划列表
 */
function getAllTrips() {
  return _loadTrips()
}

/**
 * 根据 ID 获取单个旅行计划
 * @param {string} id - 旅行计划 ID
 * @returns {Object|null} 旅行计划对象，未找到返回 null
 */
function getTripById(id) {
  return _loadTrips().find(t => t.id === id) || null
}

/**
 * 创建新的旅行计划
 * 自动生成 ID、初始预算、时间戳等字段
 * @param {Object} tripData - 旅行数据（destination, startDate, endDate, totalBudget 等）
 * @returns {Object} 新创建的旅行计划
 */
function createTrip(tripData) {
  const trips = _loadTrips()
  const newTrip = {
    id: generateId('trip'),
    ...tripData,
    spentBudget: 0,
    packingProgress: 0,
    diaryCount: 0,
    placeCount: 0,
    foodCount: 0,
    createdAt: new Date().toISOString()
  }
  trips.unshift(newTrip)
  _saveTrips(trips)
  return newTrip
}

/**
 * 更新旅行计划
 * 合并传入的字段到已有旅行中，保留未传入的字段
 * @param {string} id - 旅行计划 ID
 * @param {Object} updates - 要更新的字段
 * @returns {Object|null} 更新后的旅行计划，未找到返回 null
 */
function updateTrip(id, updates) {
  const trips = _loadTrips()
  const idx = trips.findIndex(t => t.id === id)
  if (idx === -1) return null
  trips[idx] = { ...trips[idx], ...updates }
  _saveTrips(trips)
  return trips[idx]
}

/**
 * 删除旅行计划
 * 根据 ID 过滤并保存剩余旅行
 * @param {string} id - 旅行计划 ID
 * @returns {boolean} 始终返回 true
 */
function deleteTrip(id) {
  const trips = _loadTrips().filter(t => t.id !== id)
  _saveTrips(trips)
  return true
}

/**
 * 按关键词搜索旅行计划
 * 支持按目的地和备注内容进行模糊搜索（不区分大小写）
 * @param {string} keyword - 搜索关键词
 * @returns {Array<Object>} 匹配的旅行计划列表
 */
function searchTrips(keyword) {
  if (!keyword) return _loadTrips()
  const kw = keyword.toLowerCase()
  return _loadTrips().filter(t =>
    t.destination.toLowerCase().includes(kw) ||
    (t.notes && t.notes.toLowerCase().includes(kw))
  )
}

/**
 * 按状态筛选旅行计划
 * @param {string} status - 状态值（planning/upcoming/ongoing/ended），传 'all' 或空则返回全部
 * @returns {Array<Object>} 符合状态的旅行计划列表
 */
function filterTripsByStatus(status) {
  if (!status || status === 'all') return _loadTrips()
  return _loadTrips().filter(t => t.status === status)
}

/**
 * 更新旅行计划的已花费预算
 * @param {string} id - 旅行计划 ID
 * @param {number} spent - 已花费金额
 * @returns {Object|null} 更新后的旅行计划
 */
function updateTripBudget(id, spent) {
  return updateTrip(id, { spentBudget: spent })
}

module.exports = {
  getAllTrips,
  getTripById,
  createTrip,
  updateTrip,
  deleteTrip,
  searchTrips,
  filterTripsByStatus,
  updateTripBudget
}
