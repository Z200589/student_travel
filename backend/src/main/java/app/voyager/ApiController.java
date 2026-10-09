package app.voyager;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequestMapping("/api") public class ApiController {
 final AuthService auth;final TripService trips; final MutationService mutations;
 ApiController(AuthService auth,TripService trips,MutationService mutations){this.auth=auth;this.trips=trips;this.mutations=mutations;}
 public record Login(String code,String account){}
 public record Create(String operationId,JsonNode payload){}
 public record Update(long version,JsonNode payload){}
 public record Invite(String role,String token){}
 public record Role(String role){}
 public record Action(long version,String operationId,String action,JsonNode data){}
 @PostMapping("/trips/{id}/actions") public Object action(@RequestHeader(value="Authorization",required=false)String token,@PathVariable String id,@RequestBody Action request){return mutations.apply(id,auth.user(token),request.version(),request.operationId(),request.action(),request.data());}
 @GetMapping("/health") public Map<String,Object> health(){return Map.of("status","ok","devLogin",auth.isDevEnabled());}
 @PostMapping("/auth/wechat") public Map<String,Object> wechat(@RequestBody Login request){return auth.wechat(request.code());}
 @PostMapping("/auth/dev") public Map<String,Object> dev(@RequestBody Login request,HttpServletRequest http){return auth.devLogin(request.account(),http.getRemoteAddr());}
 @PostMapping("/auth/logout") public void logout(@RequestHeader(value="Authorization",required=false)String token){auth.logout(token);}
 @GetMapping("/trips") public Object list(@RequestHeader(value="Authorization",required=false)String token){return trips.list(auth.user(token));}
 @PostMapping("/trips") public Object create(@RequestHeader(value="Authorization",required=false)String token,@RequestBody Create request){return trips.create(auth.user(token),request.operationId(),request.payload());}
 @GetMapping("/trips/{id}") public Object get(@RequestHeader(value="Authorization",required=false)String token,@PathVariable String id){return trips.get(id,auth.user(token));}
 @PutMapping("/trips/{id}") public Object update(@RequestHeader(value="Authorization",required=false)String token,@PathVariable String id,@RequestBody Update request){return trips.update(id,auth.user(token),request.version(),request.payload());}
 @PostMapping("/trips/{id}/invites") public Object invite(@RequestHeader(value="Authorization",required=false)String token,@PathVariable String id,@RequestBody Invite request){return trips.invite(id,auth.user(token),request.role());}
 @PostMapping("/invites/join") public Object join(@RequestHeader(value="Authorization",required=false)String token,@RequestBody Invite request){return trips.join(auth.user(token),request.token());}
 @PostMapping("/trips/{id}/invites/revoke") public void revoke(@RequestHeader(value="Authorization",required=false)String token,@PathVariable String id,@RequestBody Invite request){trips.revoke(id,auth.user(token),request.token());}
 @GetMapping("/trips/{id}/members") public Object members(@RequestHeader(value="Authorization",required=false)String token,@PathVariable String id){return trips.members(id,auth.user(token));}
 @PutMapping("/trips/{id}/members/{member}") public void role(@RequestHeader(value="Authorization",required=false)String token,@PathVariable String id,@PathVariable String member,@RequestBody Role request){trips.setRole(id,auth.user(token),member,request.role());}
}
