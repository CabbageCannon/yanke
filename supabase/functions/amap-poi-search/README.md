# 高德 POI 鉴权代理

`POST /functions/v1/amap-poi-search`，使用当前用户的 `Authorization: Bearer <access_token>`。
请求 JSON：`{ "query": "图书馆", "page": 1 }`。搜索词去首尾空白后1–50字，页码1–3，省略为1；每页最多20条。
响应：`{ "pois": [{ "id": "...", "name": "...", "address": "...", "latitude": 31.2, "longitude": 121.4, "coordinateSystem": "gcj02" }], "page": 1 }`。

只访问高德 `https://restapi.amap.com/v3/place/text`；不接受 URL、Key 或其他透传参数。
每次请求先访问同项目 GoTrue `/auth/v1/user` 验证真实用户 JWT，不能用本地 decode 代替。
Auth 超时5秒，高德8秒；请求体最多2048字节。全部响应禁用缓存，不记录词、token、Key或完整上游响应。

错误返回 `{ "error": { "code": "...", "message": "..." } }`：401账号失效，400参数错误，
429高德配额 / 频控，502上游失败，503认证服务 / 配置不可用，504高德超时。缺服务Key明确返回
`503 AMAP_UNCONFIGURED`，不会生成占位地点。CORS预检不需要用户JWT。

仅在独立审查、集成后由主控部署此函数；不能推送整个项目配置改变已有Auth：

```powershell
npx --yes supabase@2.121.0 functions deploy amap-poi-search --project-ref <test-project-ref>
```

平台自动提供 `SUPABASE_URL`、`SUPABASE_ANON_KEY`。仅将 `AMAP_WEB_SERVICE_KEY` 写入该测试项目
Edge secrets，使用安全内存 / 临时忽略文件方式传递；命令行、日志和 Git 不含真实值。
不要把包含 Android / iOS Key 的整份 `.env.amap.local` 上传成 Edge secrets，也不要复制到 Expo public 配置。
默认保留网关 JWT 校验，函数内部仍调用 Auth 兜底验证。客户端 publishable / anon Key 不是用户JWT。

本地边界检查：`npm run test:geofence`。定向真实 Auth / 无Key检查：

```powershell
node --env-file=<ignored-server-env-file> scripts/integration/verify-amap.mjs
```

服务端环境格式与测试项目显式确认同 `scripts/integration/README.md`。脚本只创建本次临时身份、
测试真实 JWT / 伪 JWT / 无Key503 / 无效输入并清理，不部署函数，也不代表高德服务或设备定位已验收。
