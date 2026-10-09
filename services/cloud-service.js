const KEY='voyager_cloud_session'
let state=null
function load(){if(!state){const saved=wx.getStorageSync(KEY);state=saved&&typeof saved==='object'?saved:{baseUrl:'http://127.0.0.1:8087',token:'',userId:''}}return {...state}}
function configure(baseUrl){
  baseUrl=String(baseUrl||'').trim().replace(/\/$/,'')
  if(!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(baseUrl)&&!/^http:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/.test(baseUrl))throw Error('请输入 HTTPS 后台地址；本机调试可用 http://127.0.0.1:8087')
  const current=load();if(current.baseUrl!==baseUrl){state={baseUrl,token:'',userId:''};wx.setStorageSync(KEY,state)}
  return load()
}
function request(path,method='GET',data,authenticated=true){
 const session=load()
 if(authenticated&&!session.token)return Promise.reject(Error('请先登录协作后台'))
 return new Promise((resolve,reject)=>wx.request({url:session.baseUrl+'/api'+path,method,data,timeout:15000,header:{'content-type':'application/json',...(authenticated?{Authorization:'Bearer '+session.token}:{})},success:res=>{
  if(res.statusCode>=200&&res.statusCode<300){resolve(res.data);return}
  if(res.statusCode===401&&state&&state.token===session.token){state={baseUrl:session.baseUrl,token:'',userId:''};wx.setStorageSync(KEY,state)}
  const error=Error(res.data&&res.data.message||'后台请求失败');error.status=res.statusCode;reject(error)
 },fail:()=>reject(Error('无法连接后台，请检查服务是否启动以及微信请求域名设置'))}))
}
async function login(account){
 const baseUrl=load().baseUrl
 const result=account?await request('/auth/dev','POST',{account},false):await new Promise((resolve,reject)=>wx.login({success:r=>r.code?resolve(r.code):reject(Error('未获取到微信登录凭证')),fail:()=>reject(Error('微信登录未完成'))})).then(code=>request('/auth/wechat','POST',{code},false))
 if(load().baseUrl!==baseUrl)throw Error('后台地址已变化，请重新登录')
 state={baseUrl,token:result.token,userId:result.userId};wx.setStorageSync(KEY,state);return load()
}
async function logout(){try{await request('/auth/logout','POST',{})}finally{state={baseUrl:load().baseUrl,token:'',userId:''};wx.setStorageSync(KEY,state)}}
function snapshot(tripId){
 const trip=require('./trip-service').getTripById(tripId);if(!trip)throw Error('本地旅行不存在')
 const collections={trip};const {readCollection}=require('../utils/collection-storage')
 for(const key of ['expenses','places','packing','food','diaries','itinerary'])collections[key]=readCollection(key).filter(row=>row.tripId===tripId)
 return collections
}
module.exports={load,configure,request,login,logout,snapshot}
