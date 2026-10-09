/**
 * pages/profile/profile.js
 * User profile and settings tab page. Displays travel statistics,
 * theme toggle, currency selection, cache management, and app info.
 * @module pages/profile
 */
const themeBehavior = require('../../utils/theme-behavior')
const { clearStorage, getStorageSize } = require('../../utils/storage-utils')
const dateUtils = require('../../utils/date-utils')
const tripService = require('../../services/trip-service')

Page({
  behaviors: [themeBehavior],

  data: {
    username: '旅行者',
    avatarEmoji: '🧳',
    tripCount: 0,
    destinationCount: 0,
    totalDays: 0,
    darkMode: false,
    defaultCurrency: 'CNY',
    cacheSize: '0',
    version: '1.9.0'
  },

  onLoad() {
    this.calcStats()
    this.setData({
      darkMode: getApp().globalData.isDarkMode || false,
      cacheSize: String(getStorageSize())
    })
  },

  onShow() {
    this.calcStats()
    this.setData({
      darkMode: getApp().globalData.isDarkMode || false
    })
  },

  calcStats() {
    const trips = tripService.getAllTrips()
    const destinations = new Set(trips.map(t => t.destination))
    let totalDays = 0
    trips.forEach(t => {
      if (t.startDate && t.endDate) {
        totalDays += dateUtils.getDayCount(t.startDate, t.endDate)
      }
    })
    this.setData({
      tripCount: trips.length,
      destinationCount: destinations.size,
      totalDays
    })
  },

  onUsernameTap() {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入新昵称',
      success: (res) => {
        if (res.confirm && res.content) {
          this.setData({ username: res.content.trim() || '旅行者' })
        }
      }
    })
  },

  onDarkModeToggle(e) {
    const app = getApp()
    const isDark = e.detail.value
    this.setData({ darkMode: isDark })
    if (app.toggleDarkMode) {
      app.toggleDarkMode()
    }
  },

  onCurrencyTap() {
    const currencies = ['CNY - 人民币', 'USD - 美元', 'EUR - 欧元', 'JPY - 日元', 'THB - 泰铢']
    wx.showActionSheet({
      itemList: currencies,
      success: (res) => {
        const codes = ['CNY', 'USD', 'EUR', 'JPY', 'THB']
        this.setData({ defaultCurrency: codes[res.tapIndex] })
        wx.showToast({ title: '已切换', icon: 'success' })
      }
    })
  },

  onClearCache() {
    wx.showModal({
      title: '删除全部本地数据',
      content: '这会删除本机的旅行、活动、账单和设置，无法恢复。确定删除吗？',
      success: (res) => {
        if (res.confirm) {
          if (!clearStorage()) {
            wx.showToast({ title: '删除失败，请重试', icon: 'none' })
            return
          }
          this.calcStats()
          this.setData({ cacheSize: '0' })
          wx.showToast({ title: '本地数据已删除', icon: 'success' })
        }
      }
    })
  },

  onCloud() { wx.navigateTo({url:'/pages/cloud/cloud'}) },
  onExportData() {
    wx.navigateTo({ url: '/pages/backup/backup' })
  },

  onAddExampleTrip() {
    try {
      const trip = require('../../services/example-trip-service').addExampleTrip()
      wx.navigateTo({ url: `/pages/trip-detail/trip-detail?tripId=${trip.id}` })
    } catch (error) {
      wx.showToast({ title: '示例保存失败，请重试', icon: 'none' })
    }
  },

  onVersionTap() {
    wx.showModal({
      title: '版本信息',
      content: 'AI 旅行计划助手 v1.9.0\n\n智能规划，轻松出行\n让每一次旅行都充满期待',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  onHelpTap() {
    wx.showModal({
      title: '使用帮助',
      content: '1. 创建行程后可以规划每日安排\n2. 使用景点清单收藏想去的地方\n3. 预算管理帮你控制花费\n4. 行李清单确保不遗漏物品\n5. 美食清单记录想吃的美食\n6. 用日记记录旅途中的美好瞬间',
      showCancel: false,
      confirmText: '了解了'
    })
  },

  onFeedbackTap() {
    wx.showModal({
      title: '意见反馈',
      content: '感谢您的使用！如有建议或问题，欢迎发送邮件至：feedback@ai-travel.app',
      showCancel: false,
      confirmText: '好的'
    })
  }
})
