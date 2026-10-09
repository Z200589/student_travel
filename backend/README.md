# 协作后台 MVP

独立 Spring Boot 3.5.16 + H2 文件库，Java 21 编译目标，本机 Java 25.0.2/Maven 3.9.12 验证。微信登录依赖 WxJava `weixin-java-miniapp:4.8.0`，未复制完整上游工程。

本地：`mvn spring-boot:run -Dspring-boot.run.profiles=dev`；测试：`mvn test`；打包：`mvn package`。

默认绑定 127.0.0.1:8087，dev profile 开启仅来自 loopback 的三账号调试登录；默认 profile 不开放调试登录。H2 持久文件在 `data`，不要提交数据库、密钥或会话令牌。

真实微信登录：设置环境变量 WECHAT_APP_ID、WECHAT_APP_SECRET，默认 profile 启动。前端提交 wx.login code，WxJava 调用微信 code2Session；OpenID/sessionKey 不返回前端，服务签发 7 天随机令牌，数据库仅保存 SHA256 哈希。登录密钥不写到小程序或仓库。

REST `/api`：
- GET /health
- POST /auth/wechat {code}；POST /auth/dev {account}；POST /auth/logout
- GET /trips；POST /trips {operationId,payload}
- GET /trips/{id}；PUT /trips/{id} {version,payload}
- GET /trips/{id}/members；PUT /trips/{id}/members/{userId} {role}
- POST /trips/{id}/invites {role}；POST /invites/join {token}
- POST /trips/{id}/invites/revoke {token}

除 health/login 外要求 Authorization: Bearer token。owner 管理邀请权限，editor 可修改旅行，viewer 只读，未加入用户读旅行返回 404。邀请仅保存令牌哈希，24 小时过期，撤销不会移除已经加入的成员。重复加入不会提升原有角色。

payload 为当前旅行完整快照，含 trip、expenses 和可选 places/packing/food/diaries/itinerary 数组。后端校验日期、预算、附属 tripId、AA 成员与整数分分摊/结算；快照最多 50 万字符。当前采用数据库 CLOB 快照以快速兼容原工程，尚未细拆活动、账单表和审计日志。客户端提供活动名称/时间/备注增删排序、成员管理、普通/AA账单增删改、结算及撤销。更新 CAS version，冲突 409；创建 operationId + user 唯一约束并校验原请求哈希。

16 个真实 Spring Boot/MockMvc/H2 集成测试通过，含并发版本更新；小程序客户端通过实际运行 JAR 的 HTTP 三用户联调。真实微信 code2Session 未调用，未部署公网，未做生产压测/限流/审计或 MySQL 验证，不能直接视为已上线服务。

依赖来源：Spring 官方 https://docs.spring.io/spring-boot/3.5/system-requirements.html；WxJava 固定 tag https://github.com/binarywang/WxJava/tree/v4.8.0；官方 Maven Central 固定 artifact 已下载编译。WxJava Apache-2.0 许可保存在 LICENSE-WxJava，取自 v4.8.0/LICENSE。没有执行上游仓库脚本。其他 Maven 依赖保留其发行包许可；后续发布须补齐依赖清单。

## 协作日程与账本更新（2026-10-09）

已增加 POST /api/trips/{id}/actions {version,operationId,action,data}，MutationService 事务锁住旅行后检查权限/版本。operations 表持久保存 trip/user/op 唯一键及请求哈希，重放返回当前副本；字段变更不匹配拒绝。新增 Ledger 后台整数分预算与 AA 余额/结算建议，GET 旅行附带 ledger。

操作：add/update/deleteExpense；add/rename/removeMember（有历史引用不能删除）；settle（须当前建议确切金额）/undoSettlement；add/update/delete/moveActivity。expense split 后台重算，不信任客户端分摊。已有 PUT 全快照禁止更改 expenses/aaMembers/aaSettlements，避免绕过操作检查。未细拆数据库表；仍为快照模型。

pages/cloud-editor 增加手机表单、稳定 ID 选择、活动时间备注及排序、AA 成员、消费与结算；网络失败同内容保留原标识重试，409 刷新并保留表单。全页只有明确保存才写，viewer 无写按钮且后台拒绝。新增日程与 AA 账本入口，返回协作主页面刷新副本。
