/**
 * pages/index/index 首页
 * 旅行助手主页面，展示概览数据、倒计时、今日行程、快捷操作等
 */
const themeBehavior = require('../../utils/theme-behavior')
const dateUtils = require('../../utils/date-utils')
const moneyUtils = require('../../utils/money-utils')
const storageUtils = require('../../utils/storage-utils')
const tripService = require('../../services/trip-service')

Page({
  behaviors: [themeBehavior],

  data: {
    // 当前日期文本
    currentDate: '',
    // 统计卡片数据
    statsCards: [],
    // 即将出发的旅行
    upcomingTrip: null,
    // 今日行程
    todayPlan: null,
    // 最近旅行列表
    recentTrips: [],
    // 预算概览
    budgetOverview: { hasTrip: false },
    // 打包进度
    packingProgress: 0,
    // 快捷操作
    quickActions: [
      { icon: 'edit', label: '创建旅行', action: 'onCreateTrip' },
      { icon: 'calendar', label: '行程管理', action: 'onManageItinerary' },
      { icon: 'wallet', label: '预算管理', action: 'onManageBudget' },
      { icon: 'bag', label: '行李清单', action: 'onManagePacking' },
      { icon: 'food', label: '美食清单', action: 'onManageFood' },
      { icon: 'diary', label: '旅行日记', action: 'onManageDiary' }
    ],
    // 加载状态
    loading: true
  },

  onLoad() {
    this.setData({
      currentDate: this._formatCurrentDate()
    })
  },

  onShow() {
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  // ==================== 数据加载 ====================

  /**
   * 加载首页所有数据
   */
  async loadData() {
    this.setData({ loading: true })
    try {
      // 加载本地存储的旅行数据
      const trips = tripService.getAllTrips()

      // 统计数据
      const totalTrips = trips.length
      const totalDays = trips.reduce((sum, t) => {
        if (t.startDate && t.endDate) {
          return sum + dateUtils.getDayCount(t.startDate, t.endDate)
        }
        return sum
      }, 0)
      const totalBudget = trips.reduce((sum, t) => sum + (t.totalBudget || 0), 0)
      const visitedPlaces = trips.reduce((sum, t) => sum + ((t.places && t.places.length) || 0), 0)

      this.setData({
        statsCards: [
          { icon: '✈️', value: totalTrips, label: '旅行次数' },
          { icon: '📅', value: totalDays, label: '旅行天数' },
          { icon: '💰', value: '¥' + moneyUtils.formatMoneyShort(totalBudget), label: '总预算' },
          { icon: '📍', value: visitedPlaces, label: '去过的地方' }
        ]
      })

      // 查找即将出发的旅行
      const upcoming = trips.find(t => {
        const status = dateUtils.getTripStatus(t.startDate, t.endDate)
        return status === 'upcoming' || status === 'ongoing'
      })
      if (upcoming) {
        this.setData({
          upcomingTrip: {
            ...upcoming,
            daysLeft: Math.max(dateUtils.getCountdown(upcoming.startDate), 0)
          }
        })
      } else {
        this.setData({ upcomingTrip: null })
      }

      // 查找今日行程（正在进行中的旅行）
      const ongoing = trips.find(t => dateUtils.getTripStatus(t.startDate, t.endDate) === 'ongoing')
      if (ongoing && ongoing.itinerary) {
        const todayIndex = this._getTodayIndex(ongoing)
        const todayData = ongoing.itinerary[todayIndex]
        if (todayData) {
          this.setData({
            todayPlan: {
              tripId: ongoing.id,
              destination: ongoing.destination,
              status: '进行中',
              activities: (todayData.activities || todayData.items || []).slice(0, 4).map(a => ({
                time: a.time || '',
                name: a.name || a.title || ''
              }))
            }
          })
        } else {
          this.setData({ todayPlan: null })
        }
      } else {
        this.setData({ todayPlan: null })
      }

      // 最近3条旅行
      const recent = trips.slice(0, 3).map(t => ({
        ...t,
        status: dateUtils.getTripStatus(t.startDate, t.endDate)
      }))
      this.setData({ recentTrips: recent })

      // 预算概览（取最近的旅行）
      if (trips.length > 0) {
        const latest = trips[0]
        if (latest.totalBudget && latest.totalBudget > 0) {
          const spent = latest.spentBudget || 0
          const remaining = latest.totalBudget - spent
          this.setData({
            budgetOverview: {
              hasTrip: true,
              destination: latest.destination || '当前旅行',
              spent: moneyUtils.formatMoneyShort(spent),
              total: moneyUtils.formatMoneyShort(latest.totalBudget),
              percent: moneyUtils.getBudgetUsagePercent(spent, latest.totalBudget),
              remaining: remaining,
              remainingAbs: moneyUtils.formatMoneyShort(Math.abs(remaining))
            }
          })
        } else {
          this.setData({ budgetOverview: { hasTrip: false } })
        }
      } else {
        this.setData({ budgetOverview: { hasTrip: false } })
      }

      // 打包进度
      const packingList = storageUtils.getStorage('packingList') || []
      if (packingList.length > 0) {
        const checked = packingList.filter(item => item.checked).length
        const progress = Math.round((checked / packingList.length) * 100)
        this.setData({ packingProgress: progress })
      } else {
        this.setData({ packingProgress: 0 })
      }

    } catch (e) {
      console.error('[首页] 数据加载失败:', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  // ==================== 导航方法 ====================

  /** 跳转到创建旅行 */
  onCreateTrip() {
    wx.navigateTo({ url: '/pages/create-trip/create-trip' })
  },

  /** 跳转到行程管理 */
  onManageItinerary() {
    wx.switchTab({ url: '/pages/trips/trips' })
  },

  /** 跳转到预算管理 */
  onManageBudget() {
    // 如果有当前旅行则跳转预算页
    const trips = storageUtils.getStorage('trips') || []
    if (trips.length > 0) {
      wx.navigateTo({ url: `/pages/budget/budget?tripId=${trips[0].id}` })
    } else {
      wx.showToast({ title: '请先创建旅行', icon: 'none' })
    }
  },

  /** 跳转到行李清单 */
  onManagePacking() {
    const trips = storageUtils.getStorage('trips') || []
    if (trips.length > 0) {
      wx.navigateTo({ url: `/pages/packing/packing?tripId=${trips[0].id}` })
    } else {
      wx.showToast({ title: '请先创建旅行', icon: 'none' })
    }
  },

  /** 跳转到美食清单 */
  onManageFood() {
    const trips = storageUtils.getStorage('trips') || []
    if (trips.length > 0) {
      wx.navigateTo({ url: `/pages/food/food?tripId=${trips[0].id}` })
    } else {
      wx.showToast({ title: '请先创建旅行', icon: 'none' })
    }
  },

  /** 跳转到旅行日记 */
  onManageDiary() {
    wx.switchTab({ url: '/pages/diary/diary' })
  },

  /** 跳转到旅行详情 */
  goToTripDetail(e) {
    const id = (e.currentTarget && e.currentTarget.dataset.id) || (e.detail && e.detail.tripId)
    if (id) {
      wx.navigateTo({ url: `/pages/trip-detail/trip-detail?tripId=${id}` })
    }
  },

  /** 跳转到全部旅行列表 */
  goToTrips() {
    wx.switchTab({ url: '/pages/trips/trips' })
  },

  /** 跳转到行李清单 */
  goToPacking() {
    const trips = storageUtils.getStorage('trips') || []
    if (trips.length > 0) {
      wx.navigateTo({ url: `/pages/packing/packing?tripId=${trips[0].id}` })
    }
  },

  // ==================== 辅助方法 ====================

  /**
   * 格式化当前日期为中文显示
   */
  _formatCurrentDate() {
    const now = new Date()
    const weekDay = dateUtils.getWeekday(now)
    const month = now.getMonth() + 1
    const day = now.getDate()
    return `${month}月${day}日 ${weekDay}`
  },

  /**
   * 计算今天是行程的第几天（0-based index）
   */
  _getTodayIndex(trip) {
    if (!trip.startDate) return 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(trip.startDate.replace(/-/g, '/'))
    start.setHours(0, 0, 0, 0)
    const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }
})
