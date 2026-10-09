// Business data must not be replaced with an empty collection after a read error.
function readCollection(key) {
  const value = wx.getStorageSync(key)
  if (value === '' || value === null || value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`本地数据格式异常: ${key}`)
  return value
}
module.exports = { readCollection }
