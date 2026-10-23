# T11 首段云部署与真实 POI 验证

- 日期：2026-10-23，主控实际执行；这是部署记录，未替代首段实现 result / 独立 review。
- 源码：[PR #8](https://github.com/CabbageCannon/yanke/pull/8)，两项 CI 通过，已 squash 合并为 `622b02560951ec8633fcb74e397a6accde72152a`。部署目录的函数源码与该 main 提交无差异。
- 测试项目：`yanke-dev` / `jhaxdxokcszbbkbvagtl`，仅部署 `amap-poi-search`，未推送 Auth 配置或迁移。
- 地址：`https://jhaxdxokcszbbkbvagtl.supabase.co/functions/v1/amap-poi-search`。

## 配置与部署

1. 用户将 Web服务 / Android 两类 Key 写入忽略文件，主控仅输出已配置与格式有效的布尔状态。
2. 使用 Web服务 Key 直接请求高德固定 POI 端点一次，公共查询“国家图书馆”，HTTP 200、status `1`、infocode `10000`、返回1个地点。
3. `npx --yes supabase@2.121.0 functions deploy amap-poi-search --project-ref jhaxdxokcszbbkbvagtl --use-api` 成功，通过平台 API 打包，无需 Docker。
4. 仅将 `AMAP_WEB_SERVICE_KEY` 写入临时忽略文件，再用 `secrets set --env-file` 上传本测试项目；finally 删除临时文件。没有上传 Android Key，也没有把 Web Key 注入 Expo。
5. CLI 查询函数 `ACTIVE`、version `2`、`verify_jwt: true`；bundle SHA256 为 `d578d7c1b04feb9c61aeace3b1ae816619f0d4512e9ee240a5b1e1ebca2ca965`。

## 已部署端点检查

使用已有测试沙箱账号获取当前用户 JWT，签名算法实际为 ES256。验证后仅退出本次临时登录会话，没有新建账号、改业务数据或退出其他会话。请求与回报未记录凭据。

| 请求 | 实际结果 |
|---|---|
| 无用户 Authorization，POST 公共查询 | 401，网关拒绝缺失用户凭证 |
| 伪造 Bearer，POST 公共查询 | 401，网关拒绝非法 JWT |
| 真实 JWT，空 query | 400，`INVALID_INPUT` |
| 真实 JWT，query 为“国家图书馆” | 200，20条 POI，首条“中国国家图书馆” |

成功返回的全部 POI 均有 `coordinateSystem: gcj02`、有限经纬度；没有使用占位结果。上述4项检查全部达到预期，当前平台默认网关校验支持该真实 ES256 JWT，无需关闭网关验证；函数内仍执行 GoTrue 验证。

## 边界与下一步

本记录证明当前测试项目的已部署代理可鉴权并访问真实高德服务，不代表选点界面或手机定位已通过。限额 / 超时等路径仍以首段替身检查为证据；Android Key 仅已配置，设备前台定位、实际坐标与精度、原生安装 / 启动待验。

下一步基于 T10 页面接入搜索、选择 / 修改 / 移除围栏及有围栏实时打卡，再独立审查、构建与设备验收。需要回滚代理时重部署已审查版本，客户端与既有数据库无需迁移。
