/**
 * pages/places/places.js
 * Place management page for browsing attractions with type-based filtering.
 * Supports toggling favorites and visited status.
 * @module pages/places
 */
const themeBehavior = require('../../utils/theme-behavior')
const placeService = require('../../services/place-service')
const tripService = require('../../services/trip-service')

const FILTER_TABS = ['全部', '自然', '历史', '购物', '拍照', '美食', '亲子', '夜景']

Page({
  behaviors: [themeBehavior],

  data: {
    tripId: '',
    destination: '',
    loading: true,
    places: [],
    filteredPlaces: [],
    filterTabs: FILTER_TABS,
    activeFilter: '全部',
    stats: { total: 0, favorited: 0, visited: 0 }
  },

  onLoad(options) {
    const tripId = options.tripId || 'trip_001'
    const trip = tripService.getTripById(tripId)
    this.setData({
      tripId,
      destination: trip ? trip.destination : ''
    })
    this.loadPlaces()
  },

  onPullDownRefresh() {
    this.loadPlaces().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadPlaces() {
    this.setData({ loading: true })
    try {
      const places = await placeService.getPlaces(this.data.tripId)
      const stats = this.calcStats(places)
      this.setData({ places, stats, loading: false })
      this.filterPlaces()
    } catch (e) {
      console.error('加载景点失败', e)
      this.setData({ loading: false })
    }
  },

  calcStats(places) {
    return {
      total: places.length,
      favorited: places.filter(p => p.favorite).length,
      visited: places.filter(p => p.visited).length
    }
  },

  onFilterTap(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeFilter: tab })
    this.filterPlaces()
  },

  filterPlaces() {
    const { places, activeFilter } = this.data
    const filtered = activeFilter === '全部'
      ? places
      : places.filter(p => p.type === activeFilter)
    this.setData({ filteredPlaces: filtered })
  },

  async onFavorite(e) {
    const { id } = e.detail
    await placeService.toggleFavorite(id)
    this.loadPlaces()
  },

  async onVisited(e) {
    const { id } = e.detail
    await placeService.toggleVisited(id)
    this.loadPlaces()
  },

  onPlaceTap(e) {
    const { place } = e.detail
    wx.showModal({
      title: place.name,
      content: place.description || '暂无详细描述',
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
