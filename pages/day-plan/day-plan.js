/**
 * pages/day-plan/day-plan.js
 * 每日行程详情页，接收 tripId 和 dayIndex 参数
 * 展示上午/下午/晚上行程，支持编辑和新增活动
 */
const themeBehavior = require('../../utils/theme-behavior')
const dateUtils = require('../../utils/date-utils')
const tripService = require('../../services/trip-service')

Page({
  behaviors: [themeBehavior],

  data: {
    tripId: '',
    dayIndex: 0,
    totalDays: 0,
    trip: null,
    dayData: null,

    // 分时间段活动列表
    morningActivities: [],
    afternoonActivities: [],
    eveningActivities: [],

    // 星期
    weekday: '',

    // 注意事项
    dayTips: [],

    // 上一天/下一天按钮状态
    hasPrevDay: false,
    hasNextDay: false
  },

  onLoad(options) {
    const tripId = options.tripId || ''
    const dayIndex = parseInt(options.dayIndex, 10) || 0
    this.setData({ tripId, dayIndex })
    this.loadDayPlan(tripId, dayIndex)
  },

  onShow() {
    // 返回页面时刷新
    if (this.data.tripId) {
      this.loadDayPlan(this.data.tripId, this.data.dayIndex)
    }
  },

  /**
   * 加载指定天的行程数据
   */
  loadDayPlan(tripId, dayIndex) {
    try {
      const trip = tripService.getTripById(tripId)

      if (!trip || !trip.itinerary || trip.itinerary.length === 0) {
        this.setData({ dayData: null, trip: null })
        wx.showToast({ title: '未找到行程数据', icon: 'none' })
        return
      }

      const totalDays = trip.itinerary.length
      const safeIndex = Math.max(0, Math.min(dayIndex, totalDays - 1))
      const dayData = trip.itinerary[safeIndex]

      if (!dayData) {
        this.setData({ dayData: null })
        return
      }

      // 星期几
      let weekday = ''
      if (dayData.date) {
        weekday = dateUtils.getWeekday(dayData.date)
      }

      // 按时间段分组活动
      const allActivities = dayData.activities || dayData.items || []
      const morningActivities = []
      const afternoonActivities = []
      const eveningActivities = []

      allActivities.forEach(act => {
        const hour = this._parseHour(act.time)
        if (hour >= 6 && hour < 12) {
          morningActivities.push(act)
        } else if (hour >= 12 && hour < 18) {
          afternoonActivities.push(act)
        } else {
          eveningActivities.push(act)
        }
      })

      // 注意事项
      const dayTips = dayData.tips || dayData.notes || []

      this.setData({
        trip,
        dayData,
        totalDays,
        dayIndex: safeIndex,
        weekday,
        morningActivities,
        afternoonActivities,
        eveningActivities,
        dayTips,
        hasPrevDay: safeIndex > 0,
        hasNextDay: safeIndex < totalDays - 1
      })

      // 更新导航栏标题
      wx.setNavigationBarTitle({
        title: `第${safeIndex + 1}天 · ${dayData.title || ''}`
      })
    } catch (e) {
      console.error('[每日行程] 加载失败:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // ==================== 导航方法 ====================

  /** 返回上一页 */
  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  /** 返回行程总览 */
  goBackToTrip() {
    wx.navigateBack({ delta: 1 })
  },

  /** 跳转到上一天 */
  goToPrevDay() {
    if (this.data.dayIndex > 0) {
      const newIndex = this.data.dayIndex - 1
      this.setData({ dayIndex: newIndex })
      this.loadDayPlan(this.data.tripId, newIndex)
    }
  },

  /** 跳转到下一天 */
  goToNextDay() {
    if (this.data.dayIndex < this.data.totalDays - 1) {
      const newIndex = this.data.dayIndex + 1
      this.setData({ dayIndex: newIndex })
      this.loadDayPlan(this.data.tripId, newIndex)
    }
  },

  // ==================== 编辑操作 ====================

  /**
   * 添加新活动
   */
  addActivity(e) {
    const period = e.currentTarget.dataset.period || 'morning'
    wx.showModal({
      title: '添加活动',
      editable: true,
      placeholderText: `请输入${this._getPeriodLabel(period)}活动内容`,
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          this._addNewActivity(period, res.content.trim())
        }
      }
    })
  },

  /**
   * 长按活动进入编辑
   */
  onEditActivity(e) {
    const { index, period } = e.currentTarget.dataset
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this._editActivity(index, period)
        } else if (res.tapIndex === 1) {
          this._deleteActivity(index, period)
        }
      }
    })
  },

  /**
   * 新增活动到指定时间段
   */
  _addNewActivity(period, name) {
    const trip = tripService.getTripById(this.data.tripId)
    if (!trip) return
    const dayIdx = this.data.dayIndex
    if (!trip.itinerary || !trip.itinerary[dayIdx]) return

    if (!trip.itinerary[dayIdx].activities) {
      trip.itinerary[dayIdx].activities = []
    }

    // 根据时间段设置默认时间
    const defaultTime = period === 'morning' ? '09:00' : period === 'afternoon' ? '14:00' : '19:00'

    trip.itinerary[dayIdx].activities.push({
      id: `activity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      time: defaultTime,
      name: name,
      activity: name,
      type: 'activity'
    })

    // 按时间排序
    trip.itinerary[dayIdx].activities.sort((a, b) => {
      return (a.time || '').localeCompare(b.time || '')
    })

    this._saveActivities(trip, '活动已添加')
  },

  /**
   * 编辑活动
   */
  _editActivity(index, period) {
    const list = period === 'morning' ? this.data.morningActivities : period === 'afternoon' ? this.data.afternoonActivities : this.data.eveningActivities
    const activity = list[index]
    if (!activity) return

    wx.showModal({
      title: '编辑活动',
      editable: true,
      placeholderText: '修改活动内容',
      content: activity.name || activity.activity || '',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          this._updateActivity(index, period, res.content.trim())
        }
      }
    })
  },

  /**
   * 更新活动
   */
  _updateActivity(index, period, newName) {
    const trip = tripService.getTripById(this.data.tripId)
    if (!trip) return
    const day = trip.itinerary && trip.itinerary[this.data.dayIndex]
    if (!day || !day.activities) return

    // 找到对应时间段的活动在总列表中的位置
    const allActs = day.activities
    const periodList = period === 'morning' ? this.data.morningActivities : period === 'afternoon' ? this.data.afternoonActivities : this.data.eveningActivities
    const target = periodList[index]
    if (!target) return

    const globalIdx = this._getActivityIndex(allActs, index, period)
    if (globalIdx !== -1) {
      allActs[globalIdx].name = newName
      allActs[globalIdx].activity = newName
    }

    this._saveActivities(trip, '已更新')
  },

  /**
   * 删除活动
   */
  _deleteActivity(index, period) {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该活动吗？',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          this._removeActivity(index, period)
        }
      }
    })
  },

  /**
   * 执行删除
   */
  _removeActivity(index, period) {
    const trip = tripService.getTripById(this.data.tripId)
    if (!trip) return
    const day = trip.itinerary && trip.itinerary[this.data.dayIndex]
    if (!day || !day.activities) return

    const periodList = period === 'morning' ? this.data.morningActivities : period === 'afternoon' ? this.data.afternoonActivities : this.data.eveningActivities
    const target = periodList[index]
    if (!target) return

    const globalIdx = this._getActivityIndex(day.activities, index, period)
    if (globalIdx !== -1) {
      day.activities.splice(globalIdx, 1)
    }

    this._saveActivities(trip, '已删除')
  },

  _saveActivities(trip, title) {
    try {
      tripService.updateTrip(trip.id, { itinerary: trip.itinerary })
      this.loadDayPlan(this.data.tripId, this.data.dayIndex)
      wx.showToast({ title, icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  // ==================== 辅助方法 ====================

  // Storage reads return new objects. Resolve the selected position within
  // its time period instead of comparing object identities across reads.
  _getActivityIndex(activities, index, period) {
    let position = 0
    return activities.findIndex(activity => {
      const hour = this._parseHour(activity.time)
      const activityPeriod = hour >= 6 && hour < 12 ? 'morning'
        : hour >= 12 && hour < 18 ? 'afternoon' : 'evening'
      if (activityPeriod !== period) return false
      return position++ === Number(index)
    })
  },

  /**
   * 解析时间字符串的小时数
   */
  _parseHour(timeStr) {
    if (!timeStr) return 12
    const parts = timeStr.split(':')
    const hour = parseInt(parts[0], 10)
    return Number.isFinite(hour) ? hour : 12
  },

  /**
   * 获取时间段中文标签
   */
  _getPeriodLabel(period) {
    const map = {
      morning: '上午',
      afternoon: '下午',
      evening: '晚上'
    }
    return map[period] || '上午'
  }
})
