const { test } = require('node:test')
const assert = require('node:assert/strict')
const search = require('../services/place-search')
const planner = require('../services/route-planner')
test('exact aliases and substrings return actual local catalog IDs', () => {
  assert.equal(search.search('杭州市','灵隐')[0].id,'hz-lingyin')
  assert.equal(search.search('北京','宫')[0].id,'bj-palace')
  assert.equal(search.search('杭州','西湖')[0].id,'hz-lake')
  assert.ok(search.search('杭州','灵隐寺','灵隐').every(p => p.city === '杭州'))
  assert.equal(search.search('杭州','灵隐寺','灵隐')[0].selected,true)
})
test('fuzzy match remains a suggestion until explicit selection', () => {
  const results = search.search('杭州','灵隐诗')
  assert.ok(results.some(p => p.id === 'hz-lingyin' && p.matchLabel.includes('确认')))
  assert.deepEqual(planner.resolvePlaces('杭州',['灵隐诗']).unresolved,['灵隐诗'])
  const input=search.addById('杭州','未知地点','hz-lingyin')
  assert.equal(input,'未知地点、灵隐景区')
  assert.deepEqual(planner.resolvePlaces('杭州',planner.parseNames(input)).unresolved,['未知地点'])
})
test('empty, unsupported, unrelated and oversized search is empty', () => {
  for(const [city,q] of [['杭州',''],['广州','西湖'],['杭州','故宫'],['杭州','火星基地'],['杭州','灵'.repeat(51)]]) assert.deepEqual(search.search(city,q),[])
})
test('selection deduplicates aliases, rejects foreign IDs and removes all aliases without losing unknown names', () => {
  assert.equal(search.addById('杭州','灵隐寺、河坊街','hz-lingyin'),'灵隐寺、河坊街')
  assert.throws(()=>search.addById('杭州','','bj-palace'),/城市/)
  assert.throws(()=>search.addById('杭州','','fake'),/城市/)
  assert.equal(search.removeById('杭州','灵隐寺、灵隐、河坊街、未知','hz-lingyin'),'河坊街、未知')
  assert.throws(()=>search.addById('杭州','未'.repeat(500),'hz-lake'),/上限/)
})
test('creation page selection invalidates preview, changes city results and persists real place IDs', () => {
  const storage=new Map()
  global.wx={getStorageSync:k=>storage.get(k)||'',setStorageSync:(k,v)=>storage.set(k,structuredClone(v)),showToast(){},redirectTo(){}}
  global.getApp=()=>({globalData:{isDarkMode:false}});global.Behavior=x=>x
  let definition;global.Page=x=>{definition=x};require('../pages/create-trip/create-trip')
  const page={...definition,data:structuredClone(definition.data),setData(patch){for(const [k,v] of Object.entries(patch)){const parts=k.split('.');if(parts.length===2)this.data[parts[0]][parts[1]]=v;else this.data[k]=v}}}
  Object.assign(page.data.form,{destination:'杭州',startDate:'2026-10-10',endDate:'2026-10-12',totalBudget:'600'})
  page.onSearchPlace({detail:{value:'灵隐诗'}})
  assert.equal(page.data.searchResults[0].id,'hz-lingyin')
  page.data.routePreview={stale:true}
  page.onSelectSearchPlace({currentTarget:{dataset:{id:'hz-lingyin'}}})
  assert.equal(page.data.routePreview,null)
  assert.equal(page.data.selectedPlaces[0].id,'hz-lingyin')
  page.onPreviewRoute();page.onSaveRoute()
  assert.equal(storage.get('trips')[0].itinerary[0].activities[0].placeId,'hz-lingyin')
  page.onRemovePlace({currentTarget:{dataset:{id:'hz-lingyin'}}})
  assert.equal(page.data.form.desiredPlaces,'')
  page.onInput({currentTarget:{dataset:{field:'destination'}},detail:{value:'北京'}})
  assert.equal(page.data.searchResults.length,0)
})
