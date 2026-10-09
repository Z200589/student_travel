package app.voyager;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
public class Ledger {
 public static Map<String,Object> calculate(JsonNode payload){
  var trip=payload.path("trip");Map<String,Long> paid=new LinkedHashMap<>(),shares=new LinkedHashMap<>(),balance=new LinkedHashMap<>();Map<String,String> names=new HashMap<>();
  for(var m:trip.path("aaMembers")){String id=m.path("id").asText();paid.put(id,0L);shares.put(id,0L);names.put(id,m.path("name").asText());}
  long total=0,shared=0;int excluded=0;
  for(var e:payload.path("expenses")){long amount=SnapshotValidator.cents(e.path("amount"));total+=amount;if(!e.has("split")){excluded++;continue;}shared+=amount;String payer=e.path("split").path("payerId").asText();paid.put(payer,paid.get(payer)+amount);for(var s:e.path("split").path("shares")){String id=s.path("memberId").asText();shares.put(id,shares.get(id)+s.path("cents").asLong());}}
  for(String id:paid.keySet())balance.put(id,paid.get(id)-shares.get(id));
  List<Map<String,Object>> settlements=new ArrayList<>();for(var s:trip.path("aaSettlements")){String from=s.path("fromId").asText(),to=s.path("toId").asText();long amount=s.path("cents").asLong();balance.put(from,balance.get(from)+amount);balance.put(to,balance.get(to)-amount);settlements.add(Map.of("id",s.path("id").asText(),"fromId",from,"toId",to,"fromName",names.get(from),"toName",names.get(to),"cents",amount));}
  List<Map<String,Object>> members=new ArrayList<>(),suggestions=new ArrayList<>();for(String id:paid.keySet()){SnapshotValidator.check(Math.abs(balance.get(id))<=9007199254740991L,"余额超出计算范围");members.add(Map.of("id",id,"name",names.get(id),"paidCents",paid.get(id),"shareCents",shares.get(id),"balanceCents",balance.get(id)));}
  var debtors=balance.keySet().stream().filter(id->balance.get(id)<0).toList();var creditors=balance.keySet().stream().filter(id->balance.get(id)>0).toList();Map<String,Long> remaining=new HashMap<>(balance);int i=0,j=0;
  while(i<debtors.size()&&j<creditors.size()){String from=debtors.get(i),to=creditors.get(j);long amount=Math.min(-remaining.get(from),remaining.get(to));suggestions.add(Map.of("fromId",from,"toId",to,"fromName",names.get(from),"toName",names.get(to),"cents",amount));remaining.put(from,remaining.get(from)+amount);remaining.put(to,remaining.get(to)-amount);if(remaining.get(from)==0)i++;if(remaining.get(to)==0)j++;}
  return Map.of("members",members,"suggestions",suggestions,"settlements",settlements,"totalCents",total,"sharedCents",shared,"excludedCount",excluded);
 }
}
