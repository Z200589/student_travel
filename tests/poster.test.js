const { test } = require('node:test')
const assert = require('node:assert/strict')
const poster = require('../services/poster-service')
const base = { id:'trip',destination:'杭州',startDate:'2026-10-10',endDate:'2026-10-12',totalBudget:600,notes:'私密备注',aaMembers:[{name:'私密成员'}],itinerary:[] }
test('all dated days including empty days appear without fabricated activities',()=>{
  const pages=poster.buildPages(base)
  assert.deepEqual(pages.map(p=>p.date),['2026-10-10','2026-10-11','2026-10-12'])
  assert.ok(pages.every(p=>p.activities.length===0))
  assert.throws(()=>poster.buildPages(null),/不存在/)
})
test('large day paginates without dropping or duplicating activities',()=>{
  const activities=Array.from({length:15},(_,i)=>({id:String(i),name:`活动${i}`}))
  const pages=poster.buildPages({...base,itinerary:[{activities}]})
  assert.deepEqual(pages.filter(p=>p.day===1).map(p=>p.activities.length),[6,6,3])
  assert.deepEqual(pages.flatMap(p=>p.activities.map(a=>a.id)),activities.map(a=>a.id))
})
test('budget opt-in and privacy, no remote images or QR, bounded canvas',()=>{
  const page=poster.buildPages({...base,itinerary:[{activities:[{name:'西湖湖滨',time:'09:00'}]}]})[0]
  const palette=poster.paletteFor(base,page)
  assert.ok(palette.views.every(v=>['rect','text'].includes(v.type)))
  assert.ok(!JSON.stringify(palette).includes('私密'))
  assert.ok(!JSON.stringify(palette).includes('600'))
  assert.ok(JSON.stringify(poster.paletteFor(base,page,true)).includes('600.00'))
  assert.ok(parseInt(palette.height)<=1368)
})
test('actual Painter pen executes palette against canvas API without changing native string functions',()=>{
  const substr=String.prototype.substr,substring=String.prototype.substring
  const {Pen}=require('../components/painter/lib/pen')
  assert.equal(String.prototype.substr,substr);assert.equal(String.prototype.substring,substring)
  const original=String.prototype.toPx
  String.prototype.toPx=function(){return parseFloat(this)*0.5}
  global.getApp=()=>({systemInfo:{pixelRatio:2,platform:'devtools',version:'8.0.0'}})
  const calls=[]
  const ctx=new Proxy({measureText:s=>({width:Array.from(s).length*13}),draw:(reserve,cb)=>cb()}, {
    get(target,key){return key in target?target[key]:(...args)=>calls.push([key,...args])},set(target,key,value){target[key]=value;return true}
  })
  try {
    const trip={...base,itinerary:[{activities:[{name:'灵隐景区',time:'09:00'}]}]}
    let done=false;new Pen(ctx,poster.paletteFor(trip,poster.buildPages(trip)[0])).paint(()=>done=true)
    assert.equal(done,true)
    assert.ok(calls.some(c=>c[0]==='fillText'&&String(c[1]).includes('灵隐')))
    assert.ok(calls.some(c=>c[0]==='fillRect'))
  } finally { if(original)String.prototype.toPx=original;else delete String.prototype.toPx }
})
test('page ignores stale image callbacks, clears old image and prevents duplicate album save',()=>{
  global.Behavior=x=>x;let definition;global.Page=x=>{definition=x}
  const storage=new Map([['trips',[base]],['expenses',[]]])
  let saves=0,options
  global.wx={getStorageSync:k=>storage.get(k)||'',saveImageToPhotosAlbum:o=>{saves++;options=o},showToast(){},showModal(){}}
  require('../pages/poster/poster')
  const page={...definition,data:structuredClone(definition.data),setData(patch,cb){Object.assign(this.data,patch);if(cb)cb()}}
  page.onLoad({tripId:'trip'});const first=page.data.token
  page.onChoosePage({detail:{value:1}})
  page.onImageOK({currentTarget:{dataset:{token:first}},detail:{path:'stale.png'}})
  assert.equal(page.data.imagePath,'')
  page.onImageOK({currentTarget:{dataset:{token:page.data.token}},detail:{path:'current.png'}})
  page.onSave();page.onSave();assert.equal(saves,1)
  options.complete();assert.equal(page.data.saving,false)
  page.onBudget({detail:{value:true}});assert.equal(page.data.imagePath,'')
  page.onImageError({currentTarget:{dataset:{token:page.data.token}}});assert.ok(page.data.error)
  page.onUnload()
})
