const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const storage = new Map()
let failWrite = false
global.wx = {
  getStorageSync: key => storage.has(key) ? structuredClone(storage.get(key)) : '',
  setStorageSync: (key, value) => { if (failWrite) throw new Error('disk full'); storage.set(key, structuredClone(value)) },
  showToast() {}, showModal() {}
}
const trips = require('../services/trip-service')
const budget = require('../services/budget-service')
const aa = require('../services/aa-service')
let members
beforeEach(() => {
  storage.clear(); failWrite = false
  trips.createTrip({ id: 'a', destination: '杭州', totalBudget: 600 })
  trips.createTrip({ id: 'b', destination: '北京', totalBudget: 500 })
  members = ['甲','乙','丙'].map(name => aa.addMember('a',name))
})
async function spend(amount = 100, payerId = members[0].id, ids = members.map(m => m.id)) {
  return budget.addExpense({ tripId: 'a', amount, category: 'food', date: '2026-10-09', description: '午餐', split: aa.makeSplit('a', amount, payerId, ids) })
}
test('100 yuan splits exactly and settles without changing trip spending', async () => {
  await spend()
  const ledger = aa.getLedger('a')
  assert.deepEqual(ledger.members.map(m => m.shareCents), [3334,3333,3333])
  assert.equal(ledger.members.reduce((n,m)=>n+m.balanceCents,0),0)
  for (const [i,suggestion] of ledger.suggestions.entries()) aa.recordSettlement('a',suggestion,`settle-${i}`)
  assert.ok(aa.getLedger('a').members.every(m=>m.balanceCents===0))
  assert.equal((await budget.getBudgetOverview('a')).totalSpent,100)
  assert.equal(trips.getTripById('a').spentBudget,100)
})
test('one cent among three has deterministic remainder independent of selection order',async()=>{
  await spend(0.01,members[2].id,members.map(m=>m.id).reverse())
  assert.deepEqual(aa.getLedger('a').members.map(m=>m.shareCents),[1,0,0])
  assert.deepEqual(aa.getLedger('a').suggestions,[{fromId:members[0].id,toId:members[2].id,cents:1}])
})
test('payer may be excluded and a later member does not change old shares',async()=>{
  await spend(12,members[0].id,[members[1].id])
  aa.addMember('a','丁')
  assert.deepEqual(aa.getLedger('a').members.map(m=>m.balanceCents),[1200,-1200,0,0])
})
test('reject duplicate names, empty or duplicate participants and foreign members',()=>{
  assert.throws(()=>aa.addMember('a',' 甲 '),/重复/)
  assert.throws(()=>aa.addMember('a',' '),/名字/)
  const other=aa.addMember('b','他人')
  for (const ids of [[],[members[0].id,members[0].id],[other.id]]) assert.throws(()=>aa.makeSplit('a',10,members[0].id,ids),/成员/)
  assert.throws(()=>aa.makeSplit('a',10,other.id,[members[0].id]),/付款人/)
})
test('reject invalid and oversized amounts',()=>{
  for(const amount of [0,-1,NaN,Infinity,1.001,'1e3',1000001]) assert.throws(()=>aa.cents(amount))
})
test('ordinary historic expenses remain excluded, not silently assigned',async()=>{
  await budget.addExpense({tripId:'a',amount:20,category:'food'})
  await spend(10)
  assert.equal(aa.getLedger('a').excludedCount,1)
  assert.equal(aa.getLedger('a').sharedCents,1000)
  assert.equal((await budget.getBudgetOverview('a')).totalSpent,30)
  assert.equal(aa.getLedger('b').sharedCents,0)
})
test('tampered shares are rejected before any write',async()=>{
  const split=aa.makeSplit('a',10,members[0].id,members.map(m=>m.id))
  split.shares[0].cents++
  await assert.rejects(budget.addExpense({tripId:'a',amount:10,split}),/不一致/)
  assert.equal((await budget.getExpenses('a')).length,0)
})
test('settlement replay is idempotent, stale suggestion and ID conflict rejected',async()=>{
  await spend()
  const suggestion=aa.getLedger('a').suggestions[0]
  const first=aa.recordSettlement('a',suggestion,'op')
  assert.deepEqual(aa.recordSettlement('a',suggestion,'op'),first)
  assert.equal(aa.getLedger('a').settlements.length,1)
  assert.throws(()=>aa.recordSettlement('a',suggestion,'other'),/变化/)
  assert.throws(()=>aa.recordSettlement('a',{...suggestion,cents:1},'op'),/冲突/)
})
test('undo restores debt; deleting expense retains actual transfer with reverse debt',async()=>{
  const expense=await spend(12,members[0].id,[members[1].id])
  const suggestion=aa.getLedger('a').suggestions[0]
  aa.recordSettlement('a',suggestion,'first')
  aa.undoSettlement('a','first')
  assert.deepEqual(aa.getLedger('a').suggestions,[suggestion])
  aa.recordSettlement('a',suggestion,'second')
  await budget.deleteExpense(expense.id)
  assert.equal((await budget.getBudgetOverview('a')).totalSpent,0)
  assert.deepEqual(aa.getLedger('a').suggestions,[{fromId:members[0].id,toId:members[1].id,cents:1200}])
})
test('write failure preserves members, expenses and settlement state',async()=>{
  await spend()
  const suggestion=aa.getLedger('a').suggestions[0]
  const snapshot=structuredClone([...storage])
  failWrite=true
  assert.throws(()=>aa.addMember('a','丁'),/保存失败/)
  assert.throws(()=>aa.recordSettlement('a',suggestion,'failed'),/保存失败/)
  await assert.rejects(spend(20),/保存失败/)
  assert.deepEqual([...storage],snapshot)
})
test('corrupt collections and missing trip fail explicitly',()=>{
  assert.throws(()=>aa.getLedger('missing'),/不存在/)
  storage.set('expenses',{})
  assert.throws(()=>aa.getLedger('a'),/格式异常/)
})
test('page save, refresh, selection preview and duplicate tap guard',async()=>{
  global.Behavior=x=>x
  global.getApp=()=>({globalData:{isDarkMode:false}})
  let definition;global.Page=x=>{definition=x}
  require('../pages/aa/aa')
  const page={...definition,data:structuredClone(definition.data),setData(values){Object.assign(this.data,structuredClone(values))}}
  page.onLoad({tripId:'a'});await page.refresh()
  page.onParticipants({detail:{value:members.map(m=>m.id)}})
  page.onInput({currentTarget:{dataset:{field:'amount'}},detail:{value:'100'}})
  page.onInput({currentTarget:{dataset:{field:'description'}},detail:{value:'午餐'}})
  assert.deepEqual(page.data.preview.map(p=>p.amount),['33.34','33.33','33.33'])
  await Promise.all([page.onSave(),page.onSave()])
  assert.equal(page.data.expenses.length,1)
  assert.equal(page.data.sharedTotal,'100.00')
  assert.equal(page.data.saving,false)
  assert.equal(page.data.amount,'')
})
