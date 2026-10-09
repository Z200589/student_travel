const themeBehavior = require('../../utils/theme-behavior')
const aa = require('../../services/aa-service')
const budget = require('../../services/budget-service')
const { generateId } = require('../../utils/mock-utils')
const money = value => (value / 100).toFixed(2)
Page({
  behaviors: [themeBehavior],
  data: { tripId: '', members: [], suggestions: [], settlements: [], expenses: [], memberName: '',
    editingId: '', payerIndex: 0, selectedIds: [], amount: '', description: '', date: '', categoryIndex: 0,
    categories: budget.getCategories(), sharedTotal: '0.00', excludedCount: 0, preview: [], error: '', saving: false },
  onLoad(options) {
    const now = new Date()
    this.setData({ tripId: options.tripId || '', date: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}` })
  },
  onShow() { this.refresh() },
  async refresh() {
    try {
      const ledger = aa.getLedger(this.data.tripId)
      const names = new Map(ledger.members.map(m => [m.id, m.name]))
      const label = record => ({ ...record, fromName: names.get(record.fromId), toName: names.get(record.toId), amount: money(record.cents) })
      const expenses = (await budget.getExpenses(this.data.tripId)).filter(e => e.split).map(e => ({ ...e,
        payerName: names.get(e.split.payerId), amountText: Number(e.amount).toFixed(2),
        shareText: e.split.shares.map(s => `${names.get(s.memberId)} ¥${money(s.cents)}`).join(' · ') }))
      this.setData({ members: ledger.members.map(m => ({ ...m, selected: this.data.selectedIds.includes(m.id), paid: money(m.paidCents), share: money(m.shareCents),
        balanceLabel: m.balanceCents > 0 ? `应收 ¥${money(m.balanceCents)}` : m.balanceCents < 0 ? `应付 ¥${money(-m.balanceCents)}` : '已平衡' })),
        suggestions: ledger.suggestions.map(label), settlements: ledger.settlements.map(label), expenses,
        sharedTotal: money(ledger.sharedCents), excludedCount: ledger.excludedCount, error: '' })
      this.updatePreview()
    } catch (error) { this.setData({ error: error.message, preview: [] }) }
  },
  onInput(e) {
    const field = e.currentTarget.dataset.field
    if (!['memberName','amount','description'].includes(field)) return
    this.setData({ [field]: e.detail.value }); this.updatePreview()
  },
  onAddMember() {
    try {
      aa.addMember(this.data.tripId, this.data.memberName)
      this.setData({ memberName: '' }); this.refresh()
    } catch (error) { this.showError(error) }
  },
  onRename(e) {
    const member=this.data.members.find(m=>m.id===e.currentTarget.dataset.id)
    if (!member) return
    wx.showModal({title:'修改成员称呼',editable:true,placeholderText:member.name,success:res=>{
      if(!res.confirm) return
      try{aa.renameMember(this.data.tripId,member.id,res.content);this.refresh()}catch(error){this.showError(error)}
    }})
  },
  onEdit(e) {
    if(this.data.saving) return
    const row=this.data.expenses.find(x=>x.id===e.currentTarget.dataset.id)
    if(!row) return
    // Strip display fields: compare against the exact stored expense at save time.
    const {payerName,amountText,shareText,...expense}=row
    this._editingExpense=expense
    const selectedIds=expense.split.shares.map(s=>s.memberId)
    this.setData({editingId:expense.id,amount:String(expense.amount),description:expense.description,date:expense.date,
      payerIndex:this.data.members.findIndex(m=>m.id===expense.split.payerId),selectedIds,
      members:this.data.members.map(m=>({...m,selected:selectedIds.includes(m.id)})),
      categoryIndex:Math.max(0,this.data.categories.findIndex(c=>c.key===expense.category))})
    this.updatePreview()
    wx.pageScrollTo({selector:'#expense-form',duration:250})
  },
  onCancelEdit(){
    if(this.data.saving) return
    this._editingExpense=null
    this.setData({editingId:'',amount:'',description:'',preview:[]})
  },
  onPayer(e) { this.setData({ payerIndex: Number(e.detail.value) }); this.updatePreview() },
  onParticipants(e) {
    this.setData({ selectedIds: e.detail.value, members: this.data.members.map(m => ({ ...m, selected: e.detail.value.includes(m.id) })) })
    this.updatePreview()
  },
  onCategory(e) { this.setData({ categoryIndex: Number(e.detail.value) }) },
  onDate(e) { this.setData({ date: e.detail.value }) },
  updatePreview() {
    try {
      const { tripId, amount, members, payerIndex, selectedIds } = this.data
      const split = aa.makeSplit(tripId, amount, members[payerIndex] && members[payerIndex].id, selectedIds)
      this.setData({ preview: split.shares.map(s => ({ name: members.find(m => m.id === s.memberId).name, amount: money(s.cents) })) })
    } catch (_) { this.setData({ preview: [] }) }
  },
  showError(error) { wx.showModal({ title: '未完成操作', content: error.message || '请重试', showCancel: false }) },
  async onSave() {
    if (this.data.saving || this.data.error) return
    this.setData({ saving: true })
    try {
      const d = this.data
      if (!d.description.trim()) throw new Error('请填写消费说明')
      const split = aa.makeSplit(d.tripId, d.amount, d.members[d.payerIndex] && d.members[d.payerIndex].id, d.selectedIds)
      const values={ tripId: d.tripId, amount: Number(d.amount), description: d.description.trim(), date: d.date,
        category: d.categories[d.categoryIndex].key, split }
      if(d.editingId) await budget.updateExpense(d.editingId,d.tripId,values,this._editingExpense)
      else await budget.addExpense(values)
      this._editingExpense=null
      this.setData({ editingId:'', amount: '', description: '', preview: [] })
      await this.refresh()
      wx.showToast({ title: 'AA 消费已保存', icon: 'success' })
    } catch (error) { this.showError(error) }
    finally { this.setData({ saving: false }) }
  },
  onSettle(e) {
    const suggestion = this.data.suggestions[e.currentTarget.dataset.index]
    if (!suggestion || this.data.error || this._confirming) return
    this._confirming = true
    const operationId = generateId('settlement')
    wx.showModal({ title: '确认已线下转账', content: `${suggestion.fromName} 已向 ${suggestion.toName} 支付 ¥${suggestion.amount}？这里只记录结算，不会发起扣款。`,
      success: res => {
        if (!res.confirm) return
        try { aa.recordSettlement(this.data.tripId, suggestion, operationId); this.refresh() } catch (error) { this.showError(error) }
      }, complete: () => { this._confirming = false } })
  },
  onUndo(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({ title: '撤销结算记录', content: '只撤销本机记账标记，不会退回实际转账。', success: res => {
      if (!res.confirm) return
      try { aa.undoSettlement(this.data.tripId, id); this.refresh() } catch (error) { this.showError(error) }
    } })
  },
  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({ title: '删除这笔 AA 消费？', content: '旅行总支出与分摊余额将重新计算，已经记录的线下转账仍保留。', success: async res => {
      if (!res.confirm) return
      try { await budget.deleteExpense(id); await this.refresh() } catch (error) { this.showError(error) }
    } })
  }
})
