const Fuse = require('../vendor/fuse/fuse')
const catalog = require('../data/place-catalog')
const planner = require('./route-planner')
const normalize = value => String(value || '').trim().replace(/\s+/g, '')
const indexes = new Map()
function search(city, query, input = '') {
  const localCity = planner.cityName(city)
  const term = normalize(query)
  if (!localCity || !term || term.length > 50) return []
  const places = catalog.places.filter(p => p.city === localCity)
  if (!indexes.has(localCity)) indexes.set(localCity, new Fuse(places, {
    keys: [{ name: 'name', weight: 2 }, { name: 'aliases', weight: 1 }],
    includeScore: true, threshold: 0.35, ignoreLocation: true, minMatchCharLength: 1
  }))
  const exact = places.filter(p => [p.name, ...p.aliases].some(name => normalize(name) === term))
  const partial = places.filter(p => [p.name, ...p.aliases].some(name => normalize(name).includes(term)))
  // Exact aliases win. Fuzzy results are suggestions only; the planner stays exact.
  const fuzzy = term.length >= 2 ? indexes.get(localCity).search(term).map(result => result.item) : []
  const selected = new Set(planner.resolvePlaces(city, planner.parseNames(input)).selected.map(p => p.id))
  const seen = new Set()
  return [...exact, ...partial, ...fuzzy].filter(p => {
    if (seen.has(p.id)) return false
    seen.add(p.id); return true
  }).slice(0, 6).map(p => ({ ...p, selected: selected.has(p.id),
    matchLabel: exact.some(e => e.id === p.id) ? '名称或别名匹配' : partial.some(e => e.id === p.id) ? '名称包含关键词' : '相近名称，请确认' }))
}
function addById(city, input, id) {
  const place = catalog.places.find(p => p.id === id && p.city === planner.cityName(city))
  if (!place) throw new Error('该地点不属于当前城市，请重新搜索')
  const names = planner.parseNames(input)
  const resolved = planner.resolvePlaces(city, names)
  if (!resolved.selected.some(p => p.id === id)) names.push(place.name)
  const value = names.join('、')
  if (value.length > 500) throw new Error('地点输入已达上限，请先删除一些内容')
  return value
}
function removeById(city, input, id) {
  return planner.parseNames(input).filter(name => !planner.resolvePlaces(city, [name]).selected.some(p => p.id === id)).join('、')
}
module.exports = { search, addById, removeById }
