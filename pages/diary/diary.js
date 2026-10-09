/**
 * pages/diary/diary.js
 * Travel diary tab page. Displays all diary entries with trip filtering,
 * mood and weather tags, and supports creating new diary entries.
 * @module pages/diary
 */
const themeBehavior = require('../../utils/theme-behavior')
const diaryService = require('../../services/diary-service')
const tripService = require('../../services/trip-service')
const { formatDate } = require('../../utils/date-utils')

Page({
  behaviors: [themeBehavior],

  data: {
    loading: true,
    diaries: [],
    trips: [],
    tripMap: {},
    selectedTripId: '',
    showCreateModal: false,
    newDiary: {
      title: '',
      content: '',
      mood: 'happy',
      weather: 'sunny',
      cost: '',
      steps: '',
      tripId: '',
      date: ''
    },
    moodOptions: [],
    weatherOptions: []
  },

  onLoad() {
    const trips = tripService.getAllTrips()
    const tripMap = {}
    trips.forEach(t => { tripMap[t.id] = t })
    const moodOptions = diaryService.getMoodOptions()
    const weatherOptions = diaryService.getWeatherOptions()
    const today = formatDate(new Date())

    this.setData({
      trips,
      tripMap,
      moodOptions,
      weatherOptions,
      'newDiary.date': today,
      'newDiary.tripId': trips.length > 0 ? trips[0].id : ''
    })
    this.loadDiaries()
  },

  onPullDownRefresh() {
    this.loadDiaries().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadDiaries() {
    this.setData({ loading: true })
    try {
      const trips = tripService.getAllTrips()
      const tripMap = {}
      trips.forEach(trip => { tripMap[trip.id] = trip })
      const entries = this.data.selectedTripId
        ? diaryService.getDiariesByTripId(this.data.selectedTripId)
        : diaryService.getAllDiaries()
      const diaries = entries.filter(entry => tripMap[entry.tripId])
      this.setData({ diaries, trips, tripMap, loading: false })
    } catch (e) {
      console.error('加载日记失败', e)
      this.setData({ loading: false })
    }
  },

  onTripSelect(e) {
    const tripId = e.currentTarget.dataset.id
    this.setData({ selectedTripId: tripId })
    this.loadDiaries()
  },

  onShow() {
    return this.loadDiaries()
  },

  onShowCreate() {
    const today = formatDate(new Date())
    this.setData({
      showCreateModal: true,
      newDiary: {
        title: '',
        content: '',
        mood: 'happy',
        weather: 'sunny',
        cost: '',
        steps: String(Math.floor(Math.random() * 10000) + 5000),
        tripId: this.data.selectedTripId || (this.data.trips.length > 0 ? this.data.trips[0].id : ''),
        date: today
      }
    })
  },

  onCloseCreate() {
    this.setData({ showCreateModal: false })
  },

  onTitleInput(e) {
    this.setData({ 'newDiary.title': e.detail.value })
  },

  onContentInput(e) {
    this.setData({ 'newDiary.content': e.detail.value })
  },

  onMoodSelect(e) {
    const mood = e.currentTarget.dataset.mood
    this.setData({ 'newDiary.mood': mood })
  },

  onWeatherSelect(e) {
    const weather = e.currentTarget.dataset.weather
    this.setData({ 'newDiary.weather': weather })
  },

  onCostInput(e) {
    this.setData({ 'newDiary.cost': e.detail.value })
  },

  onStepsInput(e) {
    this.setData({ 'newDiary.steps': e.detail.value })
  },

  onTripChange(e) {
    const index = e.detail.value
    this.setData({ 'newDiary.tripId': this.data.trips[index].id })
  },

  onDateChange(e) {
    this.setData({ 'newDiary.date': e.detail.value })
  },

  async onSaveDiary() {
    const { newDiary } = this.data
    if (!newDiary.title.trim() || !newDiary.content.trim()) {
      wx.showToast({ title: '请填写标题和内容', icon: 'none' })
      return
    }
    const moodEmoji = this.data.moodOptions.find(m => m.key === newDiary.mood)
    const weatherEmoji = this.data.weatherOptions.find(w => w.key === newDiary.weather)

    diaryService.createDiary({
      tripId: newDiary.tripId,
      title: newDiary.title.trim(),
      content: newDiary.content.trim(),
      date: newDiary.date,
      mood: newDiary.mood,
      moodEmoji: moodEmoji ? moodEmoji.emoji : '😊',
      weather: weatherEmoji ? weatherEmoji.emoji : '',
      cost: newDiary.cost ? Number(newDiary.cost) : 0,
      steps: newDiary.steps ? Number(newDiary.steps) : 0,
      photos: []
    })
    this.setData({ showCreateModal: false })
    wx.showToast({ title: '保存成功', icon: 'success' })
    this.loadDiaries()
  },

  onDiaryTap(e) {
    const { diary } = e.detail
    wx.showModal({
      title: diary.title,
      content: diary.content,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  getMoodEmoji(moodKey) {
    const found = this.data.moodOptions.find(m => m.key === moodKey)
    return found ? found.emoji : '😊'
  }
})
