/**
 * pages/create-trip/create-trip 创建旅行页
 * 填写旅行信息，支持 AI 智能生成行程或手动创建
 */
const themeBehavior = require('../../utils/theme-behavior')
const dateUtils = require('../../utils/date-utils')
const storageUtils = require('../../utils/storage-utils')
const exampleService = require('../../services/example-trip-service')
const tripService = require('../../services/trip-service')
const { normalizeItinerary } = require('../../utils/itinerary-model')
const routePlanner = require('../../services/route-planner')
const placeSearch = require('../../services/place-search')

Page({
  behaviors: [themeBehavior],

  data: {
    // 表单数据
    form: {
      destination: '',
      startDate: '',
      endDate: '',
      peopleCount: 2,
      totalBudget: '',
      style: '',
      pace: 'moderate',
      accommodationArea: '',
      notes: '',
      desiredPlaces: ''
    },
    recommendations: [],
    placeQuery: '',
    searchResults: [],
    selectedPlaces: [],
    unknownPlaces: [],
    recommendationHint: '输入杭州、北京或成都，可查看离线地点推荐。',
    routePreview: null,
    // 最小可选日期（今天）
    minDate: '',
    // AI 生成中状态
    generating: false,

    // 旅行风格选项
    styleOptions: [
      { value: 'relaxation', emoji: '🏖', label: '休闲' },
      { value: 'adventure', emoji: '🔍', label: '深度游' },
      { value: 'food', emoji: '🍜', label: '美食' },
      { value: 'nature', emoji: '🌿', label: '自然' },
      { value: 'shopping', emoji: '🏙', label: '城市' },
      { value: 'photography', emoji: '📸', label: '拍照' },
      { value: 'family', emoji: '👶', label: '亲子' },
      { value: 'couple', emoji: '💑', label: '情侣' }
    ],

    // 每日节奏选项
    paceOptions: [
      { value: 'relaxed', emoji: '😌', label: '轻松' },
      { value: 'moderate', emoji: '⚡', label: '正常' },
      { value: 'packed', emoji: '🔥', label: '紧凑' }
    ]
  },

  onLoad() {
    // 设置最小日期为今天
    this.setData({
      minDate: dateUtils.formatDate(new Date())
    })
  },

  // ==================== 表单输入处理 ====================

  /**
   * 通用文本/数字输入
   */
  onInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`form.${field}`]: value,
      routePreview: null
    })
    this._refreshRecommendations()
  },

  /**
   * 日期选择变更
   */
  onDateChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`form.${field}`]: value,
      routePreview: null
    })
  },

  /**
   * 人数 -1
   */
  onStepDown() {
    if (this.data.form.peopleCount > 1) {
      this.setData({
        'form.peopleCount': this.data.form.peopleCount - 1
      })
    }
  },

  /**
   * 人数 +1
   */
  onStepUp() {
    if (this.data.form.peopleCount < 20) {
      this.setData({
        'form.peopleCount': this.data.form.peopleCount + 1
      })
    }
  },

  /**
   * 选择旅行风格
   */
  onSelectStyle(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      'form.style': this.data.form.style === value ? '' : value
    })
    this.setData({ routePreview: null })
    this._refreshRecommendations()
  },

  /**
   * 选择节奏
   */
  onSelectPace(e) {
    const value = e.currentTarget.dataset.value
    this.setData({
      'form.pace': value,
      routePreview: null
    })
  },

  // ==================== 提交处理 ====================

  _refreshRecommendations() {
    const { destination, style, desiredPlaces } = this.data.form
    const supported = routePlanner.cityName(destination)
    const resolved = routePlanner.resolvePlaces(destination, routePlanner.parseNames(desiredPlaces))
    this.setData({
      selectedPlaces: resolved.selected,
      unknownPlaces: resolved.unresolved,
      searchResults: placeSearch.search(destination, this.data.placeQuery, desiredPlaces),
      recommendations: routePlanner.recommend(destination, style, desiredPlaces),
      recommendationHint: supported ? '按偏好与已选地点的距离推荐，点击添加；游玩时长为建议值。'
        : '离线地点库暂支持杭州、北京、成都；其他城市可手动创建，不会编造地点坐标。'
    })
  },

  onSearchPlace(e) {
    this.setData({ placeQuery: e.detail.value })
    this._refreshRecommendations()
  },

  onSelectSearchPlace(e) {
    try {
      const value = placeSearch.addById(this.data.form.destination, this.data.form.desiredPlaces, e.currentTarget.dataset.id)
      this.setData({ 'form.desiredPlaces': value, routePreview: null })
      this._refreshRecommendations()
    } catch (error) { wx.showToast({ title: error.message, icon: 'none' }) }
  },

  onRemovePlace(e) {
    const value = placeSearch.removeById(this.data.form.destination, this.data.form.desiredPlaces, e.currentTarget.dataset.id)
    this.setData({ 'form.desiredPlaces': value, routePreview: null })
    this._refreshRecommendations()
  },

  onAddRecommended(e) {
    const name = e.currentTarget.dataset.name
    const names = routePlanner.parseNames(this.data.form.desiredPlaces)
    if (!names.includes(name)) names.push(name)
    this.setData({ 'form.desiredPlaces': names.join('、'), routePreview: null })
    this._refreshRecommendations()
  },

  onPreviewRoute() {
    if (!this._validate()) return
    try {
      const result = routePlanner.plan(this.data.form)
      this._routeSignature = JSON.stringify(this.data.form)
      this.setData({ routePreview: result })
      if (wx.pageScrollTo) wx.pageScrollTo({ selector: '.route-preview', duration: 250 })
    } catch (error) {
      this.setData({ routePreview: null })
      wx.showModal({ title: '暂时无法规划', content: error.message, showCancel: false })
    }
  },

  onSaveRoute() {
    if (this.data.generating || !this.data.routePreview) return
    if (this._routeSignature !== JSON.stringify(this.data.form)) {
      this.setData({ routePreview: null })
      wx.showToast({ title: '信息已变化，请重新预览', icon: 'none' })
      return
    }
    try {
      const trip = this._buildTripData()
      trip.itinerary = this.data.routePreview.itinerary
      trip.planSource = 'distance-draft'
      trip.planningNote = this.data.routePreview.note
      trip.unplannedPlaces = this.data.routePreview.pending
      trip.desiredPlaces = this.data.form.desiredPlaces
      this._saveTrip(trip)
      this.setData({ routePreview: null })
      wx.redirectTo({ url: `/pages/trip-detail/trip-detail?tripId=${trip.id}` })
    } catch (error) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  },

  /**
   * 表单验证
   * @returns {boolean} 是否通过验证
   */
  _validate() {
    const { destination, startDate, endDate, totalBudget } = this.data.form

    if (!destination || !destination.trim()) {
      wx.showToast({ title: '请输入目的地', icon: 'none' })
      return false
    }

    if (!startDate) {
      wx.showToast({ title: '请选择出发日期', icon: 'none' })
      return false
    }

    if (!endDate) {
      wx.showToast({ title: '请选择返回日期', icon: 'none' })
      return false
    }

    const start = dateUtils.parseDate(startDate)
    const end = dateUtils.parseDate(endDate)
    if (!start || !end || end < start) {
      wx.showToast({ title: '返回日期不能早于出发日期', icon: 'none' })
      return false
    }

    const budget = Number(totalBudget)
    if (!totalBudget || !Number.isFinite(budget) || budget <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(totalBudget))) {
      wx.showToast({ title: '请输入有效的预算金额', icon: 'none' })
      return false
    }

    return true
  },

  /**
   * 构建旅行数据对象
   */
  _buildTripData() {
    const form = this.data.form
    const days = dateUtils.getDayCount(form.startDate, form.endDate)
    return {
      id: 'trip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      destination: form.destination.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      days: days,
      peopleCount: form.peopleCount,
      totalBudget: parseFloat(form.totalBudget) || 0,
      spentBudget: 0,
      style: form.style,
      pace: form.pace,
      accommodationArea: form.accommodationArea.trim(),
      notes: form.notes.trim(),
      coverImage: '',
      itinerary: [],
      budgetItems: [],
      packingList: [],
      foods: [],
      places: [],
      diary: [],
      status: 'planning',
      createdAt: new Date().toISOString()
    }
  },

  /**
   * 保存旅行到本地存储
   */
  _saveTrip(tripData) {
    tripData.itinerary = normalizeItinerary(tripData, tripData.itinerary)
    return tripService.createTrip(tripData)
  },

  /**
   * AI 智能生成行程
   */
  async onGenerateAI() {
    if (routePlanner.parseNames(this.data.form.desiredPlaces).length) {
      this.onPreviewRoute()
      return
    }
    if (!this._validate()) return
    if (this.data.generating) return

    this.setData({ generating: true })

    try {
      const tripData = this._buildTripData()

      Object.assign(tripData, exampleService.generateExample(tripData))

      this._saveTrip(tripData)

      wx.showToast({ title: '行程生成成功！', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/trip-detail/trip-detail?tripId=${tripData.id}`
        })
      }, 1200)

    } catch (e) {
      console.error('[创建旅行] 示例生成失败:', e)
      wx.showModal({ title: '无法生成示例', content: e.message || '生成失败，请重试', showCancel: false })
    } finally {
      this.setData({ generating: false })
    }
  },

  /**
   * 手动创建旅行
   */
  onSubmitManual() {
    if (this.data.generating) return
    if (!this._validate()) return

    try {
      const tripData = this._buildTripData()
      this._saveTrip(tripData)

      wx.showToast({ title: '旅行创建成功！', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/trip-detail/trip-detail?tripId=${tripData.id}`
        })
      }, 1200)
    } catch (e) {
      console.error('[创建旅行] 手动创建失败:', e)
      wx.showToast({ title: '创建失败，请重试', icon: 'none' })
    }
  }
})
