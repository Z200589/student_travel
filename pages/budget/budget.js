/**
 * pages/budget/budget.js
 * Budget tracking page for a specific trip. Displays spending overview,
 * category breakdowns, and expense list. Supports adding and deleting expenses.
 * @module pages/budget
 */
const themeBehavior = require('../../utils/theme-behavior')
const budgetService = require('../../services/budget-service')
const tripService = require('../../services/trip-service')
const { formatMoney } = require('../../utils/money-utils')

Page({
  behaviors: [themeBehavior],

  data: {
    editingId: '',
    tripId: '',
    loading: true,
    overview: null,
    expenses: [],
    categories: [],
    categoryMap: {},
    showAddModal: false,
    newExpense: {
      category: 'food',
      amount: '',
      description: '',
      date: ''
    }
  },

  onLoad(options) {
    const tripId = options.tripId || 'trip_001'
    const today = new Date()
    const dateStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0')

    const categories = budgetService.getCategories()
    const categoryMap = {}
    categories.forEach(c => { categoryMap[c.key] = c })

    this.setData({
      tripId,
      categories,
      categoryMap,
      'newExpense.date': dateStr
    })
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onShow() {
    if (this.data.tripId) return this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const overview = await budgetService.getBudgetOverview(this.data.tripId)
      const expenses = await budgetService.getExpenses(this.data.tripId)
      this.setData({ overview, expenses, loading: false })
    } catch (e) {
      console.error('加载预算失败', e)
      this.setData({ loading: false })
    }
  },

  onShowAdd() {
    if(this.data.saving) return
    const today = new Date()
    const dateStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0')
    this.setData({
      editingId: '',
      showAddModal: true,
      newExpense: { category: 'food', amount: '', description: '', date: dateStr }
    })
  },

  onEditExpense(id) {
    const expense=this.data.expenses.find(e=>e.id===id)
    if(!expense) return
    if(expense.split){this.onOpenAA();return}
    this._editingExpense=JSON.parse(JSON.stringify(expense))
    this.setData({editingId:id,showAddModal:true,newExpense:{category:expense.category,amount:String(expense.amount),description:expense.description,date:expense.date}})
  },
  onOpenAA() {
    wx.navigateTo({ url: '/pages/aa/aa?tripId=' + encodeURIComponent(this.data.tripId) })
  },

  onCloseAdd() {
    if(this.data.saving) return
    this.setData({ showAddModal: false })
  },

  onCategorySelect(e) {
    const cat = e.currentTarget.dataset.cat
    this.setData({ 'newExpense.category': cat })
  },

  onAmountInput(e) {
    this.setData({ 'newExpense.amount': e.detail.value })
  },

  onDescInput(e) {
    this.setData({ 'newExpense.description': e.detail.value })
  },

  onDateChange(e) {
    this.setData({ 'newExpense.date': e.detail.value })
  },

  async onSaveExpense() {
    if (this.data.saving) return
    const { newExpense, tripId } = this.data
    if (!newExpense.amount || !newExpense.description) {
      wx.showToast({ title: '请填写金额和描述', icon: 'none' })
      return
    }
    const amount = Number(newExpense.amount)
    if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(newExpense.amount))) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      const values = {
        tripId,
        category: newExpense.category,
        amount,
        description: newExpense.description,
        date: newExpense.date
      }
      if(this.data.editingId) await budgetService.updateExpense(this.data.editingId,tripId,values,this._editingExpense)
      else await budgetService.addExpense(values)
      this.setData({ showAddModal: false })
      wx.showToast({ title: '保存成功', icon: 'success' })
      await this.loadData()
    } catch (error) {
      wx.showToast({ title: error.message || '保存失败，请重试', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  async onDeleteExpense(e) {
    const { id } = e.detail
    wx.showActionSheet({
      itemList: ['编辑', '删除'],
      success: async (res) => {
        if (res.tapIndex === 0) { this.onEditExpense(id); return }
        if (res.tapIndex === 1) {
          wx.showModal({
            title: '确认删除',
            content: '确定要删除这条消费记录吗？',
            success: async (modalRes) => {
              if (modalRes.confirm) {
                try {
                  await budgetService.deleteExpense(id)
                  wx.showToast({ title: '已删除', icon: 'success' })
                  await this.loadData()
                } catch (error) {
                  wx.showToast({ title: '删除失败，请重试', icon: 'none' })
                }
              }
            }
          })
        }
      }
    })
  }
})
