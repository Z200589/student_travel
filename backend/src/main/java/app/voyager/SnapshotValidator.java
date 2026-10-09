package app.voyager;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.*;
public class SnapshotValidator {
 static void check(boolean valid,String message){if(!valid)throw new ApiError(400,message);}
 static Set<String> ids(JsonNode rows,String label){check(rows!=null&&rows.isArray(),label+"须为列表");Set<String> ids=new HashSet<>();for(var row:rows){check(row.isObject()&&row.path("id").isTextual()&&!row.path("id").asText().isBlank()&&ids.add(row.path("id").asText()),label+"标识无效或重复");}return ids;}
 static long cents(JsonNode amount){try{var decimal=new java.math.BigDecimal(amount.asText());long value=decimal.movePointRight(2).longValueExact();check(value>0&&value<=100000000,"金额须为 0.01 至 1000000 元，最多两位小数");return value;}catch(ApiError e){throw e;}catch(Exception e){throw new ApiError(400,"金额无效");}}
 static void date(JsonNode value){try{check(value.isTextual()&&value.asText().matches("\\d{4}-\\d{2}-\\d{2}"),"日期无效");LocalDate.parse(value.asText());}catch(Exception e){throw new ApiError(400,"日期无效");}}
 public static void validate(JsonNode payload){
  check(payload!=null&&payload.isObject()&&payload.toString().length()<=500000,"旅行数据过大或格式无效");
  var trip=payload.path("trip");check(trip.isObject()&&trip.path("id").isTextual()&&!trip.path("id").asText().isBlank(),"旅行标识无效");
  check(trip.path("destination").isTextual()&&!trip.path("destination").asText().isBlank()&&trip.path("destination").asText().length()<=100,"目的地无效");
  date(trip.path("startDate"));date(trip.path("endDate"));check(trip.path("endDate").asText().compareTo(trip.path("startDate").asText())>=0,"结束日期早于开始日期");
  check(trip.path("itinerary").isArray()&&trip.path("itinerary").size()<=366,"日程格式无效");
  for(var day:trip.path("itinerary")){date(day.path("date"));check(day.path("activities").isArray(),"活动须为列表");for(var activity:day.path("activities"))check(activity.isObject()&&activity.path("name").isTextual()&&activity.path("name").asText().length()<=200,"活动名称无效");}
  JsonNode members=trip.has("aaMembers")?trip.path("aaMembers"):com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.arrayNode();Set<String> memberIds=ids(members,"AA 成员");check(members.size()<=30,"AA 成员过多");Set<String> names=new HashSet<>();for(var m:members)check(m.path("name").isTextual()&&!m.path("name").asText().isBlank()&&m.path("name").asText().length()<=20&&names.add(m.path("name").asText().trim().toLowerCase(Locale.ROOT)),"AA 名称无效或重复");
  for(String key:List.of("places","packing","food","diaries","itinerary"))if(payload.has(key)){check(payload.path(key).isArray(),key+"须为列表");for(var row:payload.path(key))check(row.isObject()&&row.path("tripId").asText().equals(trip.path("id").asText()),"附属数据不属于此旅行");}
  check(trip.path("totalBudget").isNumber()&&trip.path("totalBudget").asDouble()>=0&&trip.path("totalBudget").asDouble()<=1000000,"旅行预算无效");
  ids(payload.path("expenses"),"账单");
  for(var expense:payload.path("expenses")){
   check(expense.path("tripId").asText().equals(trip.path("id").asText()),"账单不属于此旅行");long total=cents(expense.path("amount"));date(expense.path("date"));
   check(expense.path("description").isTextual()&&!expense.path("description").asText().isBlank()&&expense.path("description").asText().length()<=100,"账单说明无效");
   check(Set.of("transport","accommodation","food","tickets","shopping","communication","insurance","other").contains(expense.path("category").asText()),"账单分类无效");
   if(expense.has("split")){
    var split=expense.path("split");check(split.path("version").asInt()==1&&memberIds.contains(split.path("payerId").asText())&&split.path("shares").isArray()&&!split.path("shares").isEmpty(),"AA 分摊无效");
    Set<String> selected=new HashSet<>();for(var share:split.path("shares"))check(memberIds.contains(share.path("memberId").asText())&&selected.add(share.path("memberId").asText()),"AA 参与人无效");
    int i=0;for(var m:members)if(selected.contains(m.path("id").asText())){var share=split.path("shares").get(i);check(share.path("memberId").asText().equals(m.path("id").asText())&&share.path("cents").isIntegralNumber()&&share.path("cents").asLong()==total/selected.size()+(i<total%selected.size()?1:0),"AA 金额不一致");i++;}
   }
  }
  if(trip.has("aaSettlements")){ids(trip.path("aaSettlements"),"结算");for(var s:trip.path("aaSettlements"))check(memberIds.contains(s.path("fromId").asText())&&memberIds.contains(s.path("toId").asText())&&!s.path("fromId").asText().equals(s.path("toId").asText())&&s.path("cents").isIntegralNumber()&&s.path("cents").asLong()>0&&s.path("cents").asLong()<=9007199254740991L,"结算无效");}
 }
}
