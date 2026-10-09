const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const store=new Map();let failKey
const copy=v=>structuredClone(v)
global.wx={getStorageSync:k=>store.has(k)?copy(store.get(k)):'',setStorageSync:(k,v)=>{if(k===failKey){failKey=null;throw Error('full')}store.set(k,copy(v))},removeStorageSync:k=>store.delete(k)}
const backup=require('../services/backup-service')
const trip={id:'t',destination:'杭州',itinerary:[],aaMembers:[{id:'a',name:'甲'},{id:'b',name:'乙'}],aaSettlements:[{id:'s',fromId:'b',toId:'a',cents:500}]}
const expense={id:'e',tripId:'t',amount:10,split:{version:1,payerId:'a',shares:[{memberId:'a',cents:500},{memberId:'b',cents:500}]}}
beforeEach(()=>{store.clear();failKey=null})
function fixture(){store.set('trips',[copy(trip)]);store.set('expenses',[copy(expense)]);store.set('diaries',[{id:'d',tripId:'t',content:'西湖游记'}]);store.set('theme_mode','dark')}
test('backup round trip preserves itinerary, AA splits, settlements and diary',()=>{fixture();const raw=backup.create();assert.deepEqual(backup.preview(raw),{trips:1,expenses:1,diaries:1});store.clear();backup.restore(raw);assert.deepEqual(store.get('trips'),[trip]);assert.deepEqual(store.get('expenses'),[expense]);assert.equal(store.get('diaries')[0].content,'西湖游记');assert.equal(store.has('theme_mode'),false)})
test('existing data prevents every write',()=>{fixture();const raw=backup.create(),before=copy(store);assert.throws(()=>backup.restore(raw),/已有/);assert.deepEqual(store,before)})
test('partial failure rolls back missing and explicit empty keys',()=>{fixture();const raw=backup.create();store.clear();store.set('trips',[]);store.set('theme_mode','light');const before=copy(store);failKey='packing';assert.throws(()=>backup.restore(raw),/原数据已保留/);assert.deepEqual(store,before)})
test('reject malformed, large, future, duplicate and mismatched AA without mutation',()=>{fixture();const raw=backup.create();for(const bad of ['{','x'.repeat(500001),JSON.stringify({...JSON.parse(raw),version:2})])assert.throws(()=>backup.validate(bad));const b=JSON.parse(raw);b.collections.expenses[0].split.shares[0].cents=501;assert.throws(()=>backup.validate(JSON.stringify(b)),/分摊/);b.collections.expenses=[expense];b.collections.trips.push(trip);assert.throws(()=>backup.validate(JSON.stringify(b)),/标识/);assert.deepEqual(store.get('expenses'),[expense])})
test('corrupted local collection and read failures never produce empty backup',()=>{store.set('trips',{});assert.throws(()=>backup.create(),/格式异常/);const old=wx.getStorageSync;wx.getStorageSync=()=>{throw Error('read failed')};assert.throws(()=>backup.create(),/read failed/);wx.getStorageSync=old})
