const cloud=require('../../services/cloud-service')
const model=require('../../services/cloud-editor-model')
const budget=require('../../services/budget-service')
const themeBehavior=require('../../utils/theme-behavior')
Page({
 behaviors:[themeBehavior],
 data:{tripId:'',current:null,busy:false,error:'',days:[],aaMembers:[],suggestions:[],settlements:[],expenses:[],total:'0.00',shared:'0.00',memberName:'',expenseId:'',amount:'',description:'',date:'',typeIndex:0,types:['普通消费','AA 平摊'],payerId:'',payerIndex:0,selectedIds:[],preview:[],categories:budget.getCategories(),categoryIndex:0,showActivity:false,activityId:'',activityDayId:'',dayIndex:0,activityName:'',activityTime:'09:00',activityNotes:''},
 onLoad(options){this.setData({tripId:options.tripId||''});return this.onRefresh()},
 applySnapshot(current){const view=model.view(current,this.data.selectedIds);const payerIndex=view.aaMembers.findIndex(m=>m.id===this.data.payerId);const dayIndex=view.days.findIndex(d=>d.id===this.data.activityDayId);this.setData({current,...view,payerId:payerIndex>=0?this.data.payerId:'',payerIndex:Math.max(0,payerIndex),dayIndex:dayIndex>=0?dayIndex:this.data.dayIndex});this.updatePreview()},
 async load(){const current=await cloud.request('/trips/'+encodeURIComponent(this.data.tripId));this.applySnapshot(current)},
 async run(fn){if(this.data.busy)return;this.setData({busy:true,error:''});try{await fn()}catch(e){let message=e.message;if(e.status===409){this._pending=null;try{await this.load();message+='；已刷新后台数据，表单保留，请核对后再次保存'}catch(_){} }this.setData({error:message})}finally{this.setData({busy:false})}},
 onRefresh(){return this.run(()=>this.load())},
 async command(action,data){
  const current=this.data.current;if(!current||current.role==='viewer')throw Error('只读成员不能修改旅行')
  const signature=JSON.stringify({id:current.id,action,data})
  if(!this._pending||this._pending.signature!==signature)this._pending={signature,request:{version:current.version,operationId:'action-'+Date.now()+'-'+Math.random().toString(36).slice(2),action,data}}
  const updated=await cloud.request('/trips/'+encodeURIComponent(current.id)+'/actions','POST',this._pending.request)
  this._pending=null;this.applySnapshot(updated)
 },
 onInput(e){const field=e.currentTarget.dataset.field;if(!['memberName','amount','description','activityName','activityNotes'].includes(field))return;this.setData({[field]:e.detail.value});this.updatePreview()},
 onType(e){if(!this.data.expenseId)this.setData({typeIndex:Number(e.detail.value)});this.updatePreview()},
 onPayer(e){const index=Number(e.detail.value);this.setData({payerIndex:index,payerId:this.data.aaMembers[index]&&this.data.aaMembers[index].id||''})},
 onCategory(e){this.setData({categoryIndex:Number(e.detail.value)})},
 onDate(e){this.setData({date:e.detail.value})},
 onParticipants(e){this.setData({selectedIds:e.detail.value,aaMembers:this.data.aaMembers.map(m=>({...m,selected:e.detail.value.includes(m.id)}))});this.updatePreview()},
 updatePreview(){try{this.setData({preview:this.data.typeIndex===1?model.preview(this.data.aaMembers,this.data.amount,this.data.selectedIds):[]})}catch(_){this.setData({preview:[]})}},
 onAddMember(){return this.run(async()=>{await this.command('addMember',{name:this.data.memberName.trim()});this.setData({memberName:''})})},
 onRename(e){if(this.data.busy)return;const id=e.currentTarget.dataset.id,member=this.data.aaMembers.find(m=>m.id===id);if(!member)return;wx.showModal({title:'修改 AA 成员称呼',editable:true,placeholderText:member.name,success:res=>{if(res.confirm)this.run(()=>this.command('renameMember',{id,name:String(res.content||'').trim()}))}})},
 confirm(title,content,action,data){if(this.data.busy)return;wx.showModal({title,content,success:res=>{if(res.confirm)this.run(()=>this.command(action,data))}})},
 onRemoveMember(e){this.confirm('删除 AA 成员？','已有付款、分摊或结算记录的成员不能删除。','removeMember',{id:e.currentTarget.dataset.id})},
 onEditExpense(e){if(this.data.busy)return;const expense=this.data.expenses.find(x=>x.id===e.currentTarget.dataset.id);if(!expense)return;const selectedIds=expense.split?expense.split.shares.map(s=>s.memberId):[];this.setData({expenseId:expense.id,amount:String(expense.amount),description:expense.description,date:expense.date,typeIndex:expense.split?1:0,payerId:expense.split?expense.split.payerId:'',payerIndex:expense.split?Math.max(0,this.data.aaMembers.findIndex(m=>m.id===expense.split.payerId)):0,selectedIds,aaMembers:this.data.aaMembers.map(m=>({...m,selected:selectedIds.includes(m.id)})),categoryIndex:Math.max(0,this.data.categories.findIndex(c=>c.key===expense.category))});this.updatePreview();wx.pageScrollTo({selector:'#expense-form',duration:250})},
 onCancelExpense(){if(this.data.busy)return;this.setData({expenseId:'',amount:'',description:'',preview:[]})},
 onSaveExpense(){return this.run(async()=>{const d=this.data;const data={amount:Number(d.amount),description:d.description.trim(),category:d.categories[d.categoryIndex].key,date:d.date||d.current.payload.trip.startDate,shared:d.typeIndex===1};if(d.expenseId)data.id=d.expenseId;if(data.shared){data.payerId=d.payerId;data.participantIds=d.selectedIds}await this.command(d.expenseId?'updateExpense':'addExpense',data);this.setData({expenseId:'',amount:'',description:'',preview:[]});wx.showToast({title:'账单已同步',icon:'success'})})},
 onDeleteExpense(e){this.confirm('删除这笔消费？','后台总支出与 AA 余额将重算；已记录的实际转账仍保留。','deleteExpense',{id:e.currentTarget.dataset.id})},
 onSettle(e){const suggestion=this.data.suggestions[e.currentTarget.dataset.index];if(suggestion)this.confirm('确认已线下支付',suggestion.fromName+' 已向 '+suggestion.toName+' 支付 ¥'+suggestion.amount+'？这里只记录结算，不发起扣款。','settle',{fromId:suggestion.fromId,toId:suggestion.toId,cents:suggestion.cents})},
 onUndo(e){this.confirm('撤销结算记录？','仅撤销后台记账标记，不会退回真实转账。','undoSettlement',{id:e.currentTarget.dataset.id})},
 onActivityAdd(e){if(this.data.busy)return;this.setData({showActivity:true,activityId:'',activityDayId:this.data.days[Number(e.currentTarget.dataset.day)].id,dayIndex:Number(e.currentTarget.dataset.day),activityName:'',activityTime:'09:00',activityNotes:''});wx.pageScrollTo({selector:'#activity-form',duration:250})},
 onActivityEdit(e){if(this.data.busy)return;const dayIndex=Number(e.currentTarget.dataset.day),a=this.data.days[dayIndex].activities.find(a=>a.id===e.currentTarget.dataset.id);if(!a)return;this.setData({showActivity:true,activityId:a.id,activityDayId:this.data.days[dayIndex].id,dayIndex,activityName:a.name,activityTime:a.time||'09:00',activityNotes:a.notes||''});wx.pageScrollTo({selector:'#activity-form',duration:250})},
 onActivityTime(e){this.setData({activityTime:e.detail.value})},
 onCancelActivity(){if(!this.data.busy)this.setData({showActivity:false,activityId:''})},
 onSaveActivity(){return this.run(async()=>{const d=this.data,data={dayId:d.activityDayId,name:d.activityName.trim(),time:d.activityTime,notes:d.activityNotes};if(d.activityId)data.id=d.activityId;await this.command(d.activityId?'updateActivity':'addActivity',data);this.setData({showActivity:false,activityId:''})})},
 onActivityDelete(e){const day=this.data.days[Number(e.currentTarget.dataset.day)];this.confirm('删除这个活动？','保留当天日期，可以继续添加新活动。','deleteActivity',{dayId:day.id,id:e.currentTarget.dataset.id})},
 onMove(e){return this.run(async()=>{const day=this.data.days[Number(e.currentTarget.dataset.day)],id=e.currentTarget.dataset.id,from=day.activities.findIndex(a=>a.id===id),targetIndex=from+Number(e.currentTarget.dataset.delta);await this.command('moveActivity',{dayId:day.id,id,targetIndex})})}
})
