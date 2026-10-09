/**
 * pages/food/food.js
 * Food guide page for browsing, filtering, and reviewing local cuisine.
 * Supports favorites, eaten tracking, and detailed food view modal.
 * @module pages/food
 */
const themeBehavior = require('../../utils/theme-behavior')
const foodService = require('../../services/food-service')
const tripService = require('../../services/trip-service')

const FILTER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'favorite', label: '⭐收藏' },
  { key: 'eaten', label: '🤤已吃' },
  { key: 'not_eaten', label: '📌未吃' }
]

Page({
  behaviors: [themeBehavior],

  data: {
    tripId: '',
    destination: '',
    loading: true,
    foods: [],
    filteredFoods: [],
    filterTabs: FILTER_TABS,
    activeFilter: 'all',
    showDetail: false,
    selectedFood: null
  },

  onLoad(options) {
    const tripId = options.tripId || 'trip_001'
    const trip = tripService.getTripById(tripId)
    this.setData({
      tripId,
      destination: trip ? trip.destination : ''
    })
    this.loadFoods()
  },

  onPullDownRefresh() {
    this.loadFoods().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadFoods() {
    this.setData({ loading: true })
    try {
      const foods = foodService.getFoodByTripId(this.data.tripId)
      this.setData({ foods, loading: false })
      this.filterFoods()
    } catch (e) {
      console.error('加载美食数据失败', e)
      this.setData({ loading: false })
    }
  },

  onFilterTap(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ activeFilter: key })
    this.filterFoods()
  },

  filterFoods() {
    const { foods, activeFilter } = this.data
    let filtered
    switch (activeFilter) {
      case 'favorite':
        filtered = foods.filter(f => f.favorite)
        break
      case 'eaten':
        filtered = foods.filter(f => f.eaten)
        break
      case 'not_eaten':
        filtered = foods.filter(f => !f.eaten)
        break
      default:
        filtered = foods
    }
    this.setData({ filteredFoods: filtered })
  },

  async onFoodFavorite(e) {
    const { id } = e.detail
    await foodService.toggleFavorite(id)
    this.loadFoods()
  },

  async onFoodEaten(e) {
    const { id } = e.detail
    await foodService.toggleEaten(id)
    this.loadFoods()
  },

  onFoodTap(e) {
    const { food } = e.detail
    this.setData({
      showDetail: true,
      selectedFood: food
    })
  },

  onCloseDetail() {
    this.setData({ showDetail: false, selectedFood: null })
  },

  onDetailFavorite() {
    if (!this.data.selectedFood) return
    const food = { ...this.data.selectedFood, favorite: !this.data.selectedFood.favorite }
    this.setData({ selectedFood: food })
    foodService.toggleFavorite(food.id).then(() => this.loadFoods())
  },

  onDetailEaten() {
    if (!this.data.selectedFood) return
    const food = { ...this.data.selectedFood, eaten: !this.data.selectedFood.eaten }
    this.setData({ selectedFood: food })
    foodService.toggleEaten(food.id).then(() => this.loadFoods())
  }
})
