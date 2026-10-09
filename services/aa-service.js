// Local AA ledger. Amounts are integer cents; settlements never count as spending.
const trips = require('./trip-service')
const { loadExpenses } = require('./expense-store')
const { generateId } = require('../utils/mock-utils')

function cents(amount) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(amount))) throw new Error('金额最多保留两位小数')
  const value = Math.round(Number(amount) * 100)
  if (!Number.isSafeInteger(value) || value <= 0 || value > 100000000) throw new Error('金额须在 0.01 至 1000000 元之间')
  return value
}
function getTrip(id) {
  const trip = trips.getTripById(id)
  if (!trip) throw new Error('旅行不存在，请返回旅行列表')
  if (trip.aaMembers !== undefined && !Array.isArray(trip.aaMembers)) throw new Error('成员数据异常')
  if (trip.aaSettlements !== undefined && !Array.isArray(trip.aaSettlements)) throw new Error('结算数据异常')
  const members = trip.aaMembers || []
  if (members.some(m => !m || typeof m.id !== 'string' || !m.id || typeof m.name !== 'string' || !m.name.trim()) || new Set(members.map(m => m.id)).size !== members.length) throw new Error('成员数据异常')
  return trip
}
function addMember(tripId, name) {
  const trip = getTrip(tripId)
  const normalized = String(name || '').trim()
  if (!normalized || normalized.length > 20) throw new Error('名字须为 1 至 20 个字符')
  const members = trip.aaMembers || []
  if (members.length >= 30) throw new Error('每个旅行最多 30 位成员')
  if (members.some(m => m.name.toLowerCase() === normalized.toLowerCase())) throw new Error('成员名字不能重复')
  const member = { id: generateId('member'), name: normalized }
  trips.updateTrip(tripId, { aaMembers: [...members, member] })
  return member
}
function renameMember(tripId, memberId, name) {
  const trip = getTrip(tripId), normalized = String(name || '').trim()
  if (!normalized || normalized.length > 20) throw new Error('名字须为 1 至 20 个字符')
  const members = trip.aaMembers || []
  if (!members.some(m => m.id === memberId)) throw new Error('成员不存在')
  if (members.some(m => m.id !== memberId && m.name.toLowerCase() === normalized.toLowerCase())) throw new Error('成员名字不能重复')
  trips.updateTrip(tripId, { aaMembers: members.map(m => m.id === memberId ? {...m,name:normalized} : m) })
}
function makeSplit(tripId, amount, payerId, participantIds) {
  const members = getTrip(tripId).aaMembers || []
  const ids = new Set(members.map(m => m.id))
  if (!ids.has(payerId)) throw new Error('请选择本次旅行的付款人')
  if (!Array.isArray(participantIds) || !participantIds.length || new Set(participantIds).size !== participantIds.length || participantIds.some(id => !ids.has(id))) throw new Error('请选择不重复的分摊成员')
  const total = cents(amount)
  // Stable member creation order allocates any remainder, independent of click order.
  const selected = members.filter(m => participantIds.includes(m.id))
  const base = Math.floor(total / selected.length), remainder = total % selected.length
  return { version: 1, payerId, shares: selected.map((m, i) => ({ memberId: m.id, cents: base + (i < remainder ? 1 : 0) })) }
}
function validateSplit(tripId, amount, split) {
  if (!split || split.version !== 1 || !Array.isArray(split.shares)) throw new Error('分摊数据异常')
  const expected = makeSplit(tripId, amount, split.payerId, split.shares.map(s => s && s.memberId))
  if (JSON.stringify(expected) !== JSON.stringify(split)) throw new Error('分摊金额不一致，请重新计算')
  return expected
}
function getLedger(tripId) {
  const trip = getTrip(tripId)
  const members = (trip.aaMembers || []).map(m => ({ ...m, paidCents: 0, shareCents: 0, balanceCents: 0 }))
  const byId = new Map(members.map(m => [m.id, m]))
  const expenses = loadExpenses().filter(e => e.tripId === tripId)
  let sharedCents = 0
  for (const expense of expenses.filter(e => e.split !== undefined)) {
    const split = validateSplit(tripId, expense.amount, expense.split)
    const paid = cents(expense.amount)
    sharedCents += paid
    byId.get(split.payerId).paidCents += paid
    for (const share of split.shares) byId.get(share.memberId).shareCents += share.cents
  }
  for (const member of members) member.balanceCents = member.paidCents - member.shareCents
  const settlements = trip.aaSettlements || []
  const settlementIds = new Set()
  for (const record of settlements) {
    if (!record || !record.id || settlementIds.has(record.id) || !byId.has(record.fromId) || !byId.has(record.toId) || record.fromId === record.toId || !Number.isSafeInteger(record.cents) || record.cents <= 0) throw new Error('结算记录异常')
    settlementIds.add(record.id)
    byId.get(record.fromId).balanceCents += record.cents
    byId.get(record.toId).balanceCents -= record.cents
  }
  if (!Number.isSafeInteger(sharedCents) || members.some(m => !Number.isSafeInteger(m.balanceCents))) throw new Error('账本金额超出计算范围')
  const debtors = members.filter(m => m.balanceCents < 0).map(m => ({ id: m.id, remaining: -m.balanceCents }))
  const creditors = members.filter(m => m.balanceCents > 0).map(m => ({ id: m.id, remaining: m.balanceCents }))
  const suggestions = []
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].remaining, creditors[j].remaining)
    suggestions.push({ fromId: debtors[i].id, toId: creditors[j].id, cents: amount })
    debtors[i].remaining -= amount; creditors[j].remaining -= amount
    if (!debtors[i].remaining) i++
    if (!creditors[j].remaining) j++
  }
  return { members, sharedCents, suggestions, settlements, excludedCount: expenses.filter(e => e.split === undefined).length }
}
function recordSettlement(tripId, suggestion, operationId) {
  const trip = getTrip(tripId)
  if (typeof operationId !== 'string' || !operationId.trim()) throw new Error('缺少结算标识')
  const existing = (trip.aaSettlements || []).find(s => s.id === operationId)
  if (existing) {
    if (existing.fromId !== suggestion.fromId || existing.toId !== suggestion.toId || existing.cents !== suggestion.cents) throw new Error('结算标识冲突')
    return existing
  }
  const ledger = getLedger(tripId)
  if (!ledger.suggestions.some(s => s.fromId === suggestion.fromId && s.toId === suggestion.toId && s.cents === suggestion.cents)) throw new Error('账本已变化，请刷新后重新确认')
  const record = { id: operationId, fromId: suggestion.fromId, toId: suggestion.toId, cents: suggestion.cents, createdAt: new Date().toISOString() }
  trips.updateTrip(tripId, { aaSettlements: [...ledger.settlements, record] })
  return record
}
function undoSettlement(tripId, id) {
  const trip = getTrip(tripId)
  trips.updateTrip(tripId, { aaSettlements: (trip.aaSettlements || []).filter(s => s.id !== id) })
}
module.exports = { renameMember, cents, addMember, makeSplit, validateSplit, getLedger, recordSettlement, undoSettlement }
