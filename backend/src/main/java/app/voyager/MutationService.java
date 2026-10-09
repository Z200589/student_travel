package app.voyager;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;
@Service public class MutationService {
 final TripService trips; final org.springframework.jdbc.core.JdbcTemplate db; MutationService(TripService trips,org.springframework.jdbc.core.JdbcTemplate db){this.trips=trips;this.db=db;}
 static String text(JsonNode data,String key,int max){var value=data.path(key);SnapshotValidator.check(value.isTextual()&&!value.asText().trim().isEmpty()&&value.asText().trim().length()<=max,"请填写有效的 "+switch(key){case "name" -> "名称";case "description" -> "消费说明";case "category" -> "分类";case "date","dayId" -> "日期";case "time" -> "时间";case "payerId" -> "付款人";default -> "记录标识";});return value.asText().trim();}
 static ArrayNode array(ObjectNode obj,String key){if(!obj.has(key))obj.set(key,obj.arrayNode());SnapshotValidator.check(obj.path(key).isArray(),"列表数据异常");return (ArrayNode)obj.path(key);}
 static int index(ArrayNode rows,String id){for(int i=0;i<rows.size();i++)if(rows.get(i).path("id").asText().equals(id))return i;throw new ApiError(404,"记录不存在，请刷新");}
 static ObjectNode find(ArrayNode rows,String id){return (ObjectNode)rows.get(index(rows,id));}
 @Transactional public Map<String,Object> apply(String tripId,String user,long version,String operation,String action,JsonNode data){
  if(trips.role(tripId,user).equals("viewer"))throw new ApiError(403,"只读成员不能修改旅行");
  SnapshotValidator.check(operation!=null&&operation.matches("[A-Za-z0-9_-]{8,100}")&&action!=null&&data!=null&&data.isObject(),"操作格式无效");
  var locked=db.query("SELECT payload,version FROM trips WHERE id=? FOR UPDATE",(rs,n)->Map.<String,Object>of("payload",trips.parse(rs.getString(1)),"version",rs.getLong(2)),tripId).get(0);
  String hash=AuthService.hash(version+":"+action+":"+data.toString());var old=db.query("SELECT request_hash FROM operations WHERE trip_id=? AND user_id=? AND operation_id=?",(rs,n)->rs.getString(1),tripId,user,operation);
  if(!old.isEmpty()){if(!old.get(0).equals(hash))throw new ApiError(409,"操作标识已用于其他内容");return trips.get(tripId,user);}
  if((long)locked.get("version")!=version)throw new ApiError(409,"旅行已被其他成员修改，请刷新后再编辑");
  ObjectNode payload=((JsonNode)locked.get("payload")).deepCopy(),trip=(ObjectNode)payload.path("trip");ArrayNode expenses=array(payload,"expenses"),members=array(trip,"aaMembers"),settlements=array(trip,"aaSettlements");
  switch(action){
   case "addMember" -> {ObjectNode member=members.addObject();member.put("id",UUID.randomUUID().toString());member.put("name",text(data,"name",20));}
   case "renameMember" -> find(members,text(data,"id",100)).put("name",text(data,"name",20));
   case "removeMember" -> {String id=text(data,"id",100);for(var e:expenses)if(e.has("split")){SnapshotValidator.check(!e.path("split").path("payerId").asText().equals(id),"成员已有付款记录，不能删除");for(var s:e.path("split").path("shares"))SnapshotValidator.check(!s.path("memberId").asText().equals(id),"成员已有分摊记录，不能删除");}for(var s:settlements)SnapshotValidator.check(!s.path("fromId").asText().equals(id)&&!s.path("toId").asText().equals(id),"成员已有结算记录，不能删除");members.remove(index(members,id));}
   case "addExpense", "updateExpense" -> {
    boolean update=action.equals("updateExpense");ObjectNode expense=update?find(expenses,text(data,"id",100)) : expenses.addObject();boolean shared=data.path("shared").asBoolean(false);if(update)SnapshotValidator.check(expense.has("split")==shared,"编辑不能改变 AA 类型");
    if(!update){expense.put("id",UUID.randomUUID().toString());expense.put("createdBy",user);expense.put("createdAt",Instant.now().toString());}
    long cents=SnapshotValidator.cents(data.path("amount"));expense.set("amount",data.path("amount"));expense.put("tripId",trip.path("id").asText());expense.put("description",text(data,"description",100));expense.put("category",text(data,"category",30));expense.put("date",text(data,"date",10));expense.put("updatedBy",user);
    if(shared){String payer=text(data,"payerId",100);SnapshotValidator.check(data.path("participantIds").isArray()&&!data.path("participantIds").isEmpty(),"请选择参与平摊成员");Set<String> selected=new HashSet<>();for(var id:data.path("participantIds"))SnapshotValidator.check(id.isTextual()&&selected.add(id.asText()),"参与成员无效或重复");List<JsonNode> ordered=new ArrayList<>();boolean payerFound=false;for(var m:members){if(m.path("id").asText().equals(payer))payerFound=true;if(selected.contains(m.path("id").asText()))ordered.add(m);}SnapshotValidator.check(payerFound&&ordered.size()==selected.size(),"成员不属于此旅行");ObjectNode split=expense.putObject("split");split.put("version",1);split.put("payerId",payer);ArrayNode shares=split.putArray("shares");for(int i=0;i<ordered.size();i++)shares.addObject().put("memberId",ordered.get(i).path("id").asText()).put("cents",cents/ordered.size()+(i<cents%ordered.size()?1:0));}
   }
   case "deleteExpense" -> expenses.remove(index(expenses,text(data,"id",100)));
   case "settle" -> {String from=text(data,"fromId",100),to=text(data,"toId",100);SnapshotValidator.check(data.path("cents").isIntegralNumber(),"结算金额无效");long amount=data.path("cents").asLong();var ledger=Ledger.calculate(payload);var suggestions=(List<?>)ledger.get("suggestions");boolean found=suggestions.stream().anyMatch(s->{var m=(Map<?,?>)s;return m.get("fromId").equals(from)&&m.get("toId").equals(to)&&m.get("cents").equals(amount);});SnapshotValidator.check(found,"结算建议已变化，请刷新核对");settlements.addObject().put("id",UUID.randomUUID().toString()).put("fromId",from).put("toId",to).put("cents",amount).put("createdBy",user).put("createdAt",Instant.now().toString());}
   case "undoSettlement" -> settlements.remove(index(settlements,text(data,"id",100)));
   case "addActivity", "updateActivity", "deleteActivity", "moveActivity" -> {
    ObjectNode day=find(array(trip,"itinerary"),text(data,"dayId",100));ArrayNode activities=array(day,"activities");
    if(action.equals("deleteActivity"))activities.remove(index(activities,text(data,"id",100)));
    else if(action.equals("moveActivity")){int from=index(activities,text(data,"id",100));SnapshotValidator.check(data.path("targetIndex").isIntegralNumber(),"排序位置无效");int to=data.path("targetIndex").asInt();SnapshotValidator.check(to>=0&&to<activities.size(),"排序位置无效");JsonNode item=activities.remove(from);activities.insert(to,item);}
    else {ObjectNode item=action.equals("updateActivity")?find(activities,text(data,"id",100)):activities.addObject();if(!item.has("id"))item.put("id",UUID.randomUUID().toString());item.put("name",text(data,"name",200));String time=text(data,"time",5);try{java.time.LocalTime.parse(time);}catch(Exception e){throw new ApiError(400,"活动时间无效");}item.put("time",time);String notes=data.path("notes").asText("");SnapshotValidator.check(notes.length()<=1000,"备注过长");item.put("notes",notes);}
   }
   default -> throw new ApiError(400,"不支持的操作");
  }
  SnapshotValidator.validate(payload);Ledger.calculate(payload);
  db.update("UPDATE trips SET payload=?,version=version+1 WHERE id=?",payload.toString(),tripId);
  db.update("INSERT INTO operations VALUES (?,?,?,?)",tripId,user,operation,hash);return trips.get(tripId,user);
 }
}
