const { test } = require('node:test')
const assert = require('node:assert/strict')
const service = require('../services/expense-chart-service')
const cats = [{key:'food',label:'餐饮'},{key:'tickets',label:'门票'},{key:'other',label:'其他'}]
test('cent-exact chart totals agree across categories and dates including old unknown fields',()=>{
  const result=service.summarize([
    {amount:0.1,category:'food',date:'2026-10-10'}, {amount:0.2,category:'food',date:'2026-10-09'},
    {amount:4.01,category:'old',date:''}, {amount:3,category:'other',date:'bad'}],cats)
  assert.equal(result.total,'7.31')
  assert.equal(result.categories.reduce((n,c)=>n+c.cents,0),731)
  assert.equal(result.daily.reduce((n,d)=>n+d.cents,0),731)
  assert.deepEqual(result.daily.map(d=>d.date),['2026-10-09','2026-10-10','日期未记录'])
  assert.equal(result.categories[0].name,'其他')
})
test('empty data, bad amounts, theme and long date series handled',()=>{
  assert.equal(service.summarize([],cats).totalCents,0)
  assert.throws(()=>service.summarize([{amount:'bad'}],cats),/异常/)
  const summary=service.summarize(Array.from({length:10},(_,i)=>({amount:1,date:`2026-10-${String(i+1).padStart(2,'0')}`})),cats)
  assert.ok(service.options(summary,true).daily.dataZoom.length)
  assert.equal(service.options(summary,true).daily.textStyle.color,'#E2E8F0')
})
test('persisted shared expense counts once and settlement never enters charts',async()=>{
  const storage=new Map()
  global.wx={getStorageSync:k=>storage.get(k)||'',setStorageSync:(k,v)=>storage.set(k,structuredClone(v))}
  const trips=require('../services/trip-service'),aa=require('../services/aa-service'),budget=require('../services/budget-service')
  trips.createTrip({id:'chart',destination:'杭州',totalBudget:600})
  const a=aa.addMember('chart','甲'),b=aa.addMember('chart','乙')
  await budget.addExpense({tripId:'chart',amount:100,category:'food',date:'2026-10-09',split:aa.makeSplit('chart',100,a.id,[a.id,b.id])})
  aa.recordSettlement('chart',aa.getLedger('chart').suggestions[0],'settled')
  assert.equal(service.summarize(await budget.getExpenses('chart'),budget.getCategories()).total,'100.00')
})
test('actual lightweight ECharts renders both options through Canvas API',()=>{
  global.wx={getSystemInfoSync:()=>({})}
  const echarts=require('../components/ec-canvas/echarts')
  assert.equal(echarts.version,'5.3.3')
  const calls=[]
  const ctx=new Proxy({measureText:s=>({width:String(s).length*12})},{get(t,k){return k in t?t[k]:(...args)=>calls.push([k,...args])},set(t,k,v){t[k]=v;return true}})
  const canvas={nodeName:'CANVAS',style:{},width:360,height:240,getContext:()=>ctx,setAttribute(){}}
  echarts.setPlatformAPI({createCanvas:()=>canvas})
  const summary=service.summarize([{amount:12.34,date:'2026-10-09',category:'food'}],cats)
  for(const option of Object.values(service.options(summary))){
    const chart=echarts.init(canvas,null,{renderer:'canvas',ssr:true,width:360,height:240})
    try { chart.setOption(option); chart.getZr().refreshImmediately() } finally { chart.dispose() }
  }
  assert.ok(calls.some(c=>c[0]==='arc'))
  assert.ok(calls.some(c=>c[0]==='fill'))
})
test('component releases charts and cancels in-flight initialization on detach',()=>{
  let definition;global.Component=d=>{definition=d}
  require('../components/expense-charts/expense-charts')
  let callback,disposed=0
  const component={...definition.methods,_ready:true,data:{hasData:true},_options:{category:{}},selectComponent(){return{init(cb){callback=cb}}},setData(p){Object.assign(this.data,p)}}
  component.drawChart('category')
  component._daily={dispose(){disposed++}}
  definition.lifetimes.detached.call(component)
  assert.equal(callback({},320,240,2),null)
  assert.equal(disposed,1)
  assert.equal(component._daily,null)
})
