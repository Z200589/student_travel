package app.voyager;
import com.fasterxml.jackson.databind.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
@Service public class TripService {
 final JdbcTemplate db; final ObjectMapper json;
 TripService(JdbcTemplate db,ObjectMapper json){this.db=db;this.json=json;}
 String role(String id,String user){return db.query("SELECT role FROM members WHERE trip_id=? AND user_id=?",(rs,n)->rs.getString(1),id,user).stream().findFirst().orElseThrow(()->new ApiError(404,"旅行不存在或无权访问"));}
 void owner(String id,String user){if(!role(id,user).equals("owner"))throw new ApiError(403,"仅创建者可以管理成员与邀请");}
 JsonNode parse(String raw){try{return json.readTree(raw);}catch(Exception e){throw new IllegalStateException(e);}}
 public Map<String,Object> get(String id,String user){String role=role(id,user);return db.query("SELECT payload,version FROM trips WHERE id=?",(rs,n)->Map.<String,Object>of("id",id,"role",role,"version",rs.getLong(2),"payload",parse(rs.getString(1)),"ledger",Ledger.calculate(parse(rs.getString(1)))),id).stream().findFirst().orElseThrow(()->new ApiError(404,"旅行不存在"));}
 public List<Map<String,Object>> list(String user){return db.query("SELECT t.id,t.payload,t.version,m.role FROM trips t JOIN members m ON t.id=m.trip_id WHERE m.user_id=?",(rs,n)->Map.<String,Object>of("id",rs.getString(1),"version",rs.getLong(3),"role",rs.getString(4),"destination",parse(rs.getString(2)).path("trip").path("destination").asText()),user);}
 @Transactional public Map<String,Object> create(String user,String operation,JsonNode payload){
  if(operation==null||!operation.matches("[A-Za-z0-9_-]{8,100}"))throw new ApiError(400,"缺少有效提交标识");SnapshotValidator.validate(payload);
  var found=db.query("SELECT id,request_hash FROM trips WHERE owner_id=? AND operation_id=?",(rs,n)->Map.of("id",rs.getString(1),"hash",rs.getString(2)),user,operation);
  String hash=AuthService.hash(payload.toString());if(!found.isEmpty()){if(!found.get(0).get("hash").equals(hash))throw new ApiError(409,"提交标识已用于其他内容");return get(found.get(0).get("id"),user);}
  String id=UUID.randomUUID().toString();db.update("INSERT INTO trips VALUES (?,?,?,?,?,?)",id,user,payload.toString(),1,operation,hash);db.update("INSERT INTO members VALUES (?,?,?)",id,user,"owner");return get(id,user);
 }
 @Transactional public Map<String,Object> update(String id,String user,long version,JsonNode payload){
  if(role(id,user).equals("viewer"))throw new ApiError(403,"只读成员不能修改旅行");SnapshotValidator.validate(payload);
  var previous=parse(db.queryForObject("SELECT payload FROM trips WHERE id=?",String.class,id));
  if(!previous.path("expenses").equals(payload.path("expenses"))||!previous.path("trip").path("aaMembers").equals(payload.path("trip").path("aaMembers"))||!previous.path("trip").path("aaSettlements").equals(payload.path("trip").path("aaSettlements")))throw new ApiError(400,"账本与成员变更请使用专用操作接口");
  if(!parse(db.queryForObject("SELECT payload FROM trips WHERE id=?",String.class,id)).path("trip").path("id").equals(payload.path("trip").path("id")))throw new ApiError(400,"不能改变旅行原始标识");
  if(db.update("UPDATE trips SET payload=?,version=version+1 WHERE id=? AND version=?",payload.toString(),id,version)!=1)throw new ApiError(409,"旅行已被其他成员修改，请刷新后再编辑");return get(id,user);
 }
 @Transactional public Map<String,Object> invite(String id,String user,String role){owner(id,user);if(!Set.of("editor","viewer").contains(role==null?"":role))throw new ApiError(400,"邀请角色无效");String token=AuthService.random();long expires=System.currentTimeMillis()+24*60*60*1000L;db.update("INSERT INTO invites VALUES (?,?,?,?,FALSE)",AuthService.hash(token),id,role,expires);return Map.of("token",token,"expiresAt",expires,"role",role);}
 @Transactional public Map<String,Object> join(String user,String token){
  if(token==null||token.length()>100)throw new ApiError(400,"邀请无效");
  var invites=db.query("SELECT trip_id,role,expires_at,revoked FROM invites WHERE token_hash=? FOR UPDATE",(rs,n)->Map.<String,Object>of("id",rs.getString(1),"role",rs.getString(2),"expires",rs.getLong(3),"revoked",rs.getBoolean(4)),AuthService.hash(token));
  if(invites.isEmpty()||(boolean)invites.get(0).get("revoked")||(long)invites.get(0).get("expires")<=System.currentTimeMillis())throw new ApiError(410,"邀请已过期或撤销");var i=invites.get(0);String id=(String)i.get("id");
  if(db.queryForObject("SELECT COUNT(*) FROM members WHERE trip_id=? AND user_id=?",Integer.class,id,user)==0)db.update("INSERT INTO members VALUES (?,?,?)",id,user,i.get("role"));return get(id,user);
 }
 @Transactional public void revoke(String id,String user,String token){owner(id,user);if(token==null||token.length()>100)throw new ApiError(400,"邀请无效");db.update("UPDATE invites SET revoked=TRUE WHERE trip_id=? AND token_hash=?",id,AuthService.hash(token));}
 public List<Map<String,Object>> members(String id,String user){role(id,user);return db.query("SELECT user_id,role FROM members WHERE trip_id=?",(rs,n)->Map.<String,Object>of("userId",rs.getString(1),"role",rs.getString(2)),id);}
 @Transactional public void setRole(String id,String user,String member,String role){owner(id,user);if(!Set.of("editor","viewer").contains(role==null?"":role))throw new ApiError(400,"角色无效");if(db.update("UPDATE members SET role=? WHERE trip_id=? AND user_id=? AND role<>'owner'",role,id,member)!=1)throw new ApiError(400,"成员不存在或不能修改创建者");}
}
