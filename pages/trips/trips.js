/**
 * pages/trips/trips 我的旅行页
 * Tab 页面，展示所有旅行列表，支持搜索和状态筛选
 */
const themeBehavior = require('../../utils/theme-behavior')
const dateUtils = require('../../utils/date-utils')
const storageUtils = require('../../utils/storage-utils')
const tripService = require('../../services/trip-service')

Page({
  behaviors: [themeBehavior],

  data: {
    // 搜索相关
    showSearch: false,
    keyword: '',
    // 筛选标签
    activeFilter: 'all',
    filterTabs: [
      { label: '全部', value: 'all' },
      { label: '计划中', value: 'planning' },
      { label: '即将出发', value: 'upcoming' },
      { label: '旅行中', value: 'ongoing' },
      { label: '已结束', value: 'ended' }
    ],
    // 旅行列表
    allTrips: [],
    filteredTrips: [],
    // 加载状态
    loading: false
  },

  onLoad() {},

  onShow() {
    this.loadTrips()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadTrips().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 搜索图标点击，切换搜索栏显示
   */
  toggleSearch() {
    this.setData({
      showSearch: !this.data.showSearch,
      keyword: '',
      filteredTrips: this.data.allTrips
    })
  },

  /**
   * 搜索输入
   */
  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
    this._filterTrips()
  },

  /**
   * 确认搜索
   */
  doSearch() {
    this._filterTrips()
  },

  /**
   * 清除搜索关键词
   */
  clearSearch() {
    this.setData({ keyword: '' })
    this._filterTrips()
  },

  /**
   * 筛选标签切换
   */
  onFilterTab(e) {
    const value = e.currentTarget.dataset.value
    this.setData({ activeFilter: value })
    this._filterTrips()
  },

  /**
   * 跳转到旅行详情
   */
  goToTripDetail(e) {
    const tripId = (e.detail && e.detail.tripId) || (e.currentTarget && e.currentTarget.dataset.id)
    if (tripId) {
      wx.navigateTo({ url: `/pages/trip-detail/trip-detail?tripId=${tripId}` })
    }
  },

  /**
   * 跳转到创建旅行
   */
  goToCreate() {
    wx.navigateTo({ url: '/pages/create-trip/create-trip' })
  },

  // ==================== 数据加载 ====================

  /**
   * 从本地存储加载旅行列表
   */
  async loadTrips() {
    this.setData({ loading: true })
    try {
      const trips = tripService.getAllTrips().map(t => ({
        ...t,
        status: dateUtils.getTripStatus(t.startDate, t.endDate)
      }))
      this.setData({ allTrips: trips })
      this._filterTrips()
    } catch (e) {
      console.error('[旅行列表] 加载失败:', e)
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // ==================== 内部方法 ====================

  /**
   * 根据搜索关键词和筛选条件过滤旅行列表
   */
  _filterTrips() {
    let result = [...this.data.allTrips]

    // 按关键词过滤
    if (this.data.keyword) {
      const kw = this.data.keyword.toLowerCase()
      result = result.filter(t =>
        (t.destination || '').toLowerCase().includes(kw)
      )
    }

    // 按状态过滤
    if (this.data.activeFilter !== 'all') {
      result = result.filter(t => t.status === this.data.activeFilter)
    }

    this.setData({ filteredTrips: result })
  }
})
