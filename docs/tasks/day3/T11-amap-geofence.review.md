# T11 首段独立审查

- 日期：2026-10-23。
- 结论：**通过，仅覆盖首段冻结模块；未发现阻塞代码问题。** 完整T11仍部分完成，不代表选点 / 围栏打卡UI、Edge部署或设备定位已交付。
- 审查上下文与实现独立；工作目录`D:/yanke-service-readiness`，分支`codex/feat-amap-geofence`，基准`45ff7f21d0f649b826399cf5c3762ae48efe11b3`。
- 范围：本轮全部已跟踪diff，新增`src/geofence/`、`scripts/geofence/`、`supabase/functions/amap-poi-search/`、`scripts/integration/verify-amap.mjs`与任务result；另核对现有计划字段、构建Key配置和实际安装的`expo-gaode-map@2.3.1`源码。
- 未改实现、Git分支 / index、HANDOFF或云端；本文件为本次唯一写入。

## 主要核查

1. **身份与秘密边界**：POST先将用户Bearer token提交同项目GoTrue `/auth/v1/user`，检查HTTP成功、真实用户id并拒绝匿名用户；没有以decode JWT冒充认证。Auth失败不访问高德。Web服务Key仅在Deno入口从服务端环境读取，未写入客户端 / EXPO_PUBLIC配置；错误响应不回传Key、token或完整上游内容。
2. **POI输入与上游**：只接受JSON的query / page，按实际字节限制2048字节，限制去空白后1–50字、整数页码1–3；固定高德HTTPS端点、URLSearchParams编码、不跟随重定向、最多20条最小字段。Auth与高德分别5秒 / 8秒AbortSignal；无Key503，身份无效401，输入400，配额429，网络 / 非法上游502，超时504，均明确失败而非伪造地点。响应no-store，预检无需JWT。
3. **围栏规则**：坐标系显式GCJ-02，坐标 / 数值有限性、名称、整数半径50–1000校验完整；关闭时全部围栏列清空。Haversine距离原值≤半径，未把精度加到边界或先四舍五入。精度≤min(100米,半径)、30秒新鲜度 / 未来最多5秒按本段约定执行，失败不能产生有效判定；没有实际位置持久化。
4. **前台与隐私**：仅暴露待UI主动调用的单次入口；Web / ExpoGo / 非active / 并发调用有明确失败。读取真实SDK隐私状态，不静默写同意；仅调用前台权限方法，不请求后台权限、连续位置监听或地址逆地理信息。后台切换及超时返回失败，迟到结果不向调用者变成成功。
5. **实际SDK调用链**：核对已安装依赖的JS辅助层 / 归一化和原生源码。Android `modules/LocationManager.kt::getCurrentLocation`使用独立tempClient、`isOnceLocation=true`，继承本次设置的模式 / 地址开关 / HTTP超时，回调后stop并destroy；返回的coordType保留到JS，业务只接收明确GCJ02。iOS `modules/LocationManager.swift::requestSingleLocation`创建独立AMapLocationManager并调用requestLocation，继承精度 / timeout / 后台配置，完成后回收。iOS坐标依赖高德国内GCJ-02合同，尚无设备来源对照证据，不能将源码核对写成实测。
6. **取消与缓存限制**：SDK的stop仅针对连续定位客户端，不能取消上述独立单次请求；当前没有调用它伪称底层cancel。JS每阶段15秒只约束等待并忽略晚结果，原生请求仍依赖SDK回调 / 原生超时回收。Android单次路径未继承所有缓存选项，当前以时间戳拒旧值，result未宣称已关闭缓存。
7. **联动与验收脚本**：无新增依赖；package / CI加入本段检查，客户端与可复用handler仍参与strict类型检查，Deno入口明确排除。真实Auth定向脚本有测试项目显式确认、临时身份及finally清理 / 404确认，不输出凭据；本次仅审源码，未重复创建云身份。后续集成main时需保留其他分支新增的测试与CI步骤。

## 独立执行证据

- `npm run test:geofence`：15组全部通过，覆盖距离内外 / 精确端点、非法坐标 / 半径、精度 / 新鲜度、隐私 / 缺Key / 拒权 / SDK失败、后台 / 超时晚结果，以及代理认证 / 输入 / 固定上游 / 配额 / 错误。
- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。
- `npx tsc --showConfig`定向核对：当前18个根文件，未将node_modules展开为根文件；Deno入口未纳入本次tsc验证。
- Node报告已有工程同类`MODULE_TYPELESS_PACKAGE_JSON`提示，测试退出0；没有为消除提示修改项目模块体系。

以上15组涉及SDK与高德响应的部分均为替身测试，不代表实际高德服务或设备验证。作者result中的真实GoTrue三项及临时身份清理属于作者证据，本次未重跑或冒称独立云验证。

## 后续交付门槛与未测项

- 等待T10冻结 / 同步后接入POI搜索提交、加载 / 空 / 错误 / 重试、旧查询回包失效、取消保留原值、完整围栏保存 / 编辑 / 移除，以及仅有围栏实时打卡调用定位后才提交RPC的流程。
- UI需真实展示高德隐私说明并同步用户决定；不得为跑通功能静默同意。设备验收需覆盖首次系统权限弹窗引发的AppState变化、拒权后重试 / 设置、前后台切换及精度不足提示。
- Deno运行与Edge部署未验证；主控后续只部署本函数、保留已有Auth配置，验证已部署401 / 无Key503。真实Web服务Key就绪后再验证实际POI搜索与限额错误。
- Android / iOS原生包、实际前台定位、GCJ-02来源与精度、超时后的原生回收均未在本次设备实测；不以JS / Web或替身测试替代。缺Key / 设备仅阻塞相应真实验收。
- 原生一次请求在JS失效后可能仍短时待SDK完成；当前已如实记录且不会生成成功判定。后续若设备表现需要真正主动取消，应先核查可用SDK能力，不能把连续stop当成单次cancel。

本首段保持冻结，可由主控按审查结果集成；完整T11需继续实现和验证上述流程。
