const { readCollection } = require('../utils/collection-storage')
const KEYS = ['trips', 'expenses', 'itinerary', 'places', 'packing', 'food', 'diaries']
const LIMIT = 500000
function validate(raw) {
  if (typeof raw !== 'string' || raw.length > LIMIT) throw new Error('备份须为不超过 50 万字符的 JSON')
  let backup
  try { backup = JSON.parse(raw) } catch (_) { throw new Error('备份不是有效 JSON') }
  if (!backup || backup.format !== 'voyager-local-backup' || backup.version !== 1 || !backup.collections) throw new Error('不支持的备份格式或版本')
  for (const key of KEYS) {
    const rows = backup.collections[key]
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error(`${key} 数据异常`)
    const ids = rows.filter(row => row.id !== undefined).map(row => row.id)
    if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) throw new Error(`${key} 标识异常`)
  }
  const trips = backup.collections.trips
  if (trips.some(t => typeof t.id !== 'string' || !t.id || typeof t.destination !== 'string' || (t.itinerary !== undefined && !Array.isArray(t.itinerary)))) throw new Error('旅行数据异常')
  for (const trip of trips) {
    const members = trip.aaMembers || [], settlements = trip.aaSettlements || []
    if (!Array.isArray(members) || !Array.isArray(settlements) || members.some(m => !m || typeof m.id !== 'string' || !m.id || typeof m.name !== 'string' || !m.name.trim())) throw new Error('AA 成员数据异常')
    const ids = new Set(members.map(m => m.id))
    if (ids.size !== members.length) throw new Error('AA 成员重复')
    if (settlements.some(s => !s || !s.id || !ids.has(s.fromId) || !ids.has(s.toId) || s.fromId === s.toId || !Number.isSafeInteger(s.cents) || s.cents <= 0) || new Set(settlements.map(s => s.id)).size !== settlements.length) throw new Error('AA 结算异常')
  }
  for (const expense of backup.collections.expenses) {
    if (!Number.isFinite(Number(expense.amount)) || Number(expense.amount) < 0) throw new Error('账单金额异常')
    if (expense.split !== undefined) {
      const trip = trips.find(t => t.id === expense.tripId), split = expense.split
      const members = trip && trip.aaMembers || []
      if (!trip || !split || split.version !== 1 || !members.some(m => m.id === split.payerId) || !Array.isArray(split.shares) || !split.shares.length) throw new Error('AA 分摊异常')
      const selected = members.filter(m => split.shares.some(s => s && s.memberId === m.id))
      const total = Math.round(Number(expense.amount) * 100)
      if (!Number.isSafeInteger(total) || total <= 0 || selected.length !== split.shares.length) throw new Error('AA 分摊异常')
      const expected = selected.map((m,i) => ({memberId:m.id,cents:Math.floor(total/selected.length)+(i<total%selected.length?1:0)}))
      if (JSON.stringify(expected) !== JSON.stringify(split.shares)) throw new Error('AA 分摊金额不一致')
    }
  }
  return backup
}
function create() {
  const collections = {}
  for (const key of KEYS) collections[key] = readCollection(key)
  const raw = JSON.stringify({format:'voyager-local-backup',version:1,createdAt:new Date().toISOString(),collections},null,2)
  validate(raw)
  return raw
}
function preview(raw) {
  const backup = validate(raw)
  return {trips:backup.collections.trips.length,expenses:backup.collections.expenses.length,diaries:backup.collections.diaries.length}
}
function restore(raw) {
  const backup = validate(raw)
  // Never overwrite business records; retain exact prior values for failed writes.
  const previous = KEYS.map(key => ({key,value:wx.getStorageSync(key)}))
  for (const key of KEYS) if (readCollection(key).length) throw new Error('本机已有旅行数据，请先导出；恢复仅支持空数据环境')
  const written = []
  try {
    for (const entry of previous) {
      written.push(entry)
      wx.setStorageSync(entry.key,backup.collections[entry.key])
    }
  } catch (_) {
    let failed = false
    for (const entry of written.reverse()) {
      try {
        if (entry.value === '' || entry.value === undefined || entry.value === null) wx.removeStorageSync(entry.key)
        else wx.setStorageSync(entry.key,entry.value)
      } catch (_) { failed = true }
    }
    throw new Error(failed ? '恢复失败且回滚未完成，请保留备份，勿继续记账' : '恢复失败，原数据已保留')
  }
}
module.exports = {create,preview,restore,validate,KEYS}
