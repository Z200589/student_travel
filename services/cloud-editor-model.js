const {cents}=require('./aa-service')
const money=n=>(n/100).toFixed(2)
function view(current,selectedIds=[]){
 const ledger=current.ledger||{members:[],suggestions:[],settlements:[],totalCents:0,sharedCents:0}
 const names=new Map(ledger.members.map(m=>[m.id,m.name]))
 return {days:current.payload.trip.itinerary.map(day=>({...day,activities:day.activities.map((a,i)=>({...a,canUp:i>0,canDown:i<day.activities.length-1}))})),
 aaMembers:ledger.members.map(m=>({...m,selected:selectedIds.includes(m.id),paid:money(m.paidCents),share:money(m.shareCents),balance:m.balanceCents>0?'应收 ¥'+money(m.balanceCents):m.balanceCents<0?'应付 ¥'+money(-m.balanceCents):'已平衡'})),
 suggestions:ledger.suggestions.map(s=>({...s,amount:money(s.cents)})),settlements:ledger.settlements.map(s=>({...s,amount:money(s.cents)})),
 expenses:current.payload.expenses.map(e=>({...e,amountText:Number(e.amount).toFixed(2),shareText:e.split?e.split.shares.map(s=>(names.get(s.memberId)||'未知成员')+' ¥'+money(s.cents)).join(' · '):'普通消费，未分摊'})),
 total:money(ledger.totalCents),shared:money(ledger.sharedCents)}
}
function preview(members,amount,ids){const total=cents(amount);const selected=members.filter(m=>ids.includes(m.id));if(!selected.length||new Set(ids).size!==ids.length||selected.length!==ids.length)return [];return selected.map((m,i)=>({name:m.name,amount:money(Math.floor(total/selected.length)+(i<total%selected.length?1:0))}))}
module.exports={view,preview}
