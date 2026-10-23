# T11 首段交付：POI代理、围栏规则与单次前台定位模块

- 状态：首段 `self_tested`，冻结供独立审查。完整T11 **部分完成**；尚未接入计划选点 / 半径 / 详情打卡UI。
- 日期：2026-10-22。
- 工作目录 / 分支：隔离worktree `D:/yanke-service-readiness`，`codex/feat-amap-geofence`；主控提供基准main `45ff7f2`。
- 未操作Git / 远程分支 / 主目录源码或index；未修改HANDOFF、旧迁移、PRD、现有app与plans界面。

## 产物与接口

- `supabase/functions/amap-poi-search/handler.ts`：可在Node执行的Web标准handler，无新依赖。
- `supabase/functions/amap-poi-search/index.ts`：Deno运行入口，读取平台Supabase URL / anon Key与服务端 `AMAP_WEB_SERVICE_KEY`。
- 同目录README：接口、错误、边界检查与单函数部署说明。**尚未部署，无部署版本 / URL验收证据。**
- `src/geofence/domain.ts`：`Poi` / `Geofence` / `LocationFix`均明确 `coordinateSystem: 'gcj02'`。
  `validateGeofence(Geofence|null)`返回全部 `geofence_*`写入列；null关闭时名称 / 中心 / 半径全null。
  半径50–1000整数，默认常量200；地点名去空白后1–120字，坐标须有限数值且在合法范围。
  `distanceMeters`用平均地球半径6371008.8米的Haversine。
  `checkGeofence(Geofence,LocationFix,now?)`返回 `{ok:true,inside,distanceMeters}` 或 `{ok:false,error}`。
  距离原值≤半径为内，不四舍五入，不把定位精度加到距离上。
- 定位精度上限 `min(100米,围栏半径)`、位置最长30秒、最多未来5秒为本阶段经主控采用的实现约定。
  精度须有限且>0；精度 / 过期 / 坐标系错误不产生有效判定。实际设备校准仍待验证。
- `src/geofence/location-request.ts`：可独立测试的真实SDK单次调用流程；消费真实隐私同意状态，
  不自动同意、不传Web Key；只请求前台权限，关闭后台定位和逆地理信息，成功仅保留坐标 / 精度 / 时间戳。
- `src/geofence/location.ts`：`getForegroundLocation(): Promise<LocationResult>`；Web / ExpoGo / 非前台 / 并发请求明确失败。
  AppState离开active即令本次结果失效；返回隐私未同意、Key未配、拒权、超时、坐标错误等可解释失败。
  尚无UI调用；后续仅有围栏的实时打卡调用。无围栏 / 补卡 / 完成无需位置。
- `scripts/geofence/verify.test.mjs`：15组边界检查；package增加 `test:geofence`，CI加入执行。
  Expo tsconfig仅排除Deno入口，handler与客户端模块继续参与strict检查。
- `scripts/integration/verify-amap.mjs`：真实Auth与本地handler的定向检查，独立测试项目确认保护、临时身份及清理。

## POI服务合同与秘密边界

- POST `amap-poi-search` JSON `{query,page?}`：词长1–50，page1–3默认1，固定20条；请求体最多2048字节。
- 每次先GoTrue `/auth/v1/user`验证签名 / 时效 / 用户，拒绝匿名身份；不decode冒充认证。
- 仅请求固定 `https://restapi.amap.com/v3/place/text`，拒绝额外透传参数，不跟随重定向。
- 返回 `{pois:[{id,name,address,latitude,longitude,coordinateSystem:'gcj02'}],page}`；无完整上游响应、电话号码或Key。
- 401身份无效，400输入错误，429高德频控 / 配额，502上游失败，503配置 / Auth不可用，504高德超时。
  Auth超时5秒、高德8秒；无Web服务Key返回503 `AMAP_UNCONFIGURED`，不伪造地点；响应no-store。
- 无凭据、搜索词、位置或完整请求日志；仅读取已忽略的服务端环境到进程内存用于定向验收。
  不把任何服务端秘密复制到客户端配置或EXPO_PUBLIC变量；未读取 / 输出真实高德Key，也未上传secrets。

## 实际SDK来源与限制

- 核对已安装的 `expo-gaode-map@2.3.1` declarations与原生源码，复用已有MIT依赖，未新增依赖。
- Android `modules/LocationManager.kt::getCurrentLocation`创建单独AMapLocationClient，
  `isOnceLocation=true`，回调后stop / destroy；返回 `coordType`。本模块只接受明确 `GCJ02`，WGS84 / 未标记失败。
  设置高精度模式、HTTP原生超时10秒。该单次实现不会继承库其他缓存 / onceLatest设置，因此不宣称已禁用原生缓存；用时间戳拒绝旧值。
- iOS `modules/LocationManager.swift::requestSingleLocation`用AMapLocationManager单次requestLocation，
  完成后独立manager停止；采用高德国内AMap坐标GCJ-02合同，SDK此路径未返回coordType，不再次做WGS转换。
  设置best精度、原生locationTimeout10秒。**未获设备坐标对照证据，iOS / Android实际坐标来源与精度仍待验。**
- JS每个异步阶段15秒超时；后台切换 / 超时丢弃结果。库的stop只停止连续客户端，不能取消独立单次请求，
  因此没有调用stop冒充底层cancel；单次SDK按其原生超时 / 回调清理，不采集持续更新或轨迹。
- SDK隐私同意不能静默写true。后续UI应在用户主动围栏打卡时清楚说明高德定位并确认后同步真实状态；拒绝只阻塞该次定位。

## 实际验证

- `npm ci --no-audit --registry=https://registry.npmjs.org --cache D:/yanke-tools/npm-cache`：787包安装成功；未新增依赖。
- `npm run test:geofence`：15组全部通过，包含围栏内外 / 恰好200米端点、参数 / 坐标 / 精度 / 新鲜度、
  SDK拒权 / 隐私 / 无Key / WGS84 / 超时 / 后台晚响应，POI真实认证调用边界 / 伪JWT / 输入 / 空结果 / 配额 / 上游错误替身。
- `npm run lint`、`npm run typecheck`：通过。
- 指定已授权测试项目并设置 `YANKE_SUPABASE_INTEGRATION_CONFIRM` 后，
  `node --env-file=<主目录忽略的服务端配置> scripts/integration/verify-amap.mjs`：
  真实GoTrue用户JWT + 本地handler无Key503、真实GoTrue拒绝伪JWT401、真实JWT空词400共3项通过；
  本次临时身份删除并GET确认404通过。未向高德发请求，未重复旧Auth / DB全套。
- 首次未设置项目确认变量的执行按设计失败，无远程写入；随后显式确认测试ref后通过。
- Node原生TS加载有已有工程同类 `MODULE_TYPELESS_PACKAGE_JSON`提示，退出0，不为消除此提示更改整个项目模块体系。

## 未测与下一步

- 高德Web服务Key / 原生Key缺口仍阻塞真实POI / 定位，不阻塞本段逻辑；不将替身结果写成真实地点体验验收。
- 未部署Edge Function、未执行Deno运行部署、未调用真实高德搜索；未构建本段原生安装包、无设备或GCJ-02实测。
- 未接入POI提交 / 空 / 错误 / 重试 / 旧词响应失效、围栏编辑与完整实时打卡路径。等待T10冻结、主控同步main后继续串行接入。
- 本段冻结后独立审查；主控按单函数部署，不覆盖云Auth配置；仅上传Web服务Key，原生Key继续由构建显式注入。
- 建议提交：`feat(geofence): add authenticated POI proxy and foreground location modules`。
