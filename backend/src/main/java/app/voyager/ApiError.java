package app.voyager;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
public class ApiError extends RuntimeException {
 final int status;
 ApiError(int status,String message){super(message);this.status=status;}
 @RestControllerAdvice public static class Handler {
  @ExceptionHandler(ApiError.class) public ResponseEntity<?> known(ApiError e){return ResponseEntity.status(e.status).body(Map.of("message",e.getMessage()));}
  @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class) public ResponseEntity<?> malformed(Exception e){return ResponseEntity.badRequest().body(Map.of("message","请求格式无效"));}
  @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class) public ResponseEntity<?> duplicate(Exception e){return ResponseEntity.status(409).body(Map.of("message","提交发生冲突，请刷新或重试"));}
  @ExceptionHandler(Exception.class) public ResponseEntity<?> unknown(Exception e){return ResponseEntity.internalServerError().body(Map.of("message","服务暂时不可用，请重试"));}
 }
}
