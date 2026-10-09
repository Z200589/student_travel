package app.voyager;
import cn.binarywang.wx.miniapp.api.impl.WxMaServiceImpl;
import cn.binarywang.wx.miniapp.config.impl.WxMaDefaultConfigImpl;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
@Service public class AuthService {
 private final JdbcTemplate db;
 @Value("${voyager.wechat.appid:}") String appid;
 @Value("${voyager.wechat.secret:}") String secret;
 @Value("${voyager.dev-login:false}") boolean dev;
 AuthService(JdbcTemplate db){this.db=db;}
 static String random(){byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
 static String hash(String text){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
 @Transactional public Map<String,Object> wechat(String code){
  if(code==null || code.isBlank() || code.length()>256)throw new ApiError(400,"缺少有效登录 code");
  if(appid.isBlank() || secret.isBlank())throw new ApiError(503,"后台尚未配置微信 AppID 和 AppSecret");
  try{var sdk=new WxMaServiceImpl();var config=new WxMaDefaultConfigImpl();config.setAppid(appid);config.setSecret(secret);sdk.setWxMaConfig(config);
   var result=sdk.getUserService().getSessionInfo(code);
   if(result.getOpenid()==null || result.getOpenid().isBlank())throw new ApiError(401,"微信登录失败，请重新登录");
   return issue(result.getOpenid());
  }catch(ApiError e){throw e;}catch(Exception e){throw new ApiError(401,"微信登录失败，请重新登录");}
 }
 @Transactional public Map<String,Object> devLogin(String account,String address){
  if(!dev || !("127.0.0.1".equals(address)||"0:0:0:0:0:0:0:1".equals(address)||"::1".equals(address)))throw new ApiError(403,"本地调试登录未开放");
  if(!Set.of("student-a","student-b","student-c").contains(account==null?"":account))throw new ApiError(400,"无效调试账号");
  return issue("dev:"+account);
 }
 private Map<String,Object> issue(String openid){
  String userId=db.query("SELECT id FROM app_users WHERE openid=?",(rs,n)->rs.getString(1),openid).stream().findFirst().orElse(null);
  if(userId==null){userId=UUID.randomUUID().toString();db.update("INSERT INTO app_users(id,openid) VALUES (?,?)",userId,openid);}
  String token=random();long expires=System.currentTimeMillis()+7L*24*60*60*1000;
  db.update("DELETE FROM sessions WHERE expires_at<?",System.currentTimeMillis());
  db.update("INSERT INTO sessions VALUES (?,?,?)",hash(token),userId,expires);
  return Map.of("token",token,"userId",userId,"expiresAt",expires);
 }
 public String user(String authorization){
  if(authorization==null || !authorization.startsWith("Bearer "))throw new ApiError(401,"请先登录");
  return db.query("SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?",(rs,n)->rs.getString(1),hash(authorization.substring(7)),System.currentTimeMillis()).stream().findFirst().orElseThrow(()->new ApiError(401,"登录已过期，请重新登录"));
 }
 public boolean isDevEnabled(){return dev;}
 public void logout(String authorization){user(authorization);db.update("DELETE FROM sessions WHERE token_hash=?",hash(authorization.substring(7)));}
}
