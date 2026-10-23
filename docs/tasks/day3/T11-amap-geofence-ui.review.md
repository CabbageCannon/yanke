# T11 客户端独立审查

- 日期：2026-10-23。
- 最终结论：**通过，初审1处P2已修复并独立定向复查。** 当前无阻塞代码问题；设备定位仍待实际验收，不能据此称完整原生围栏打卡已通过。
- 目录 / 分支 / 基准：`D:/yanke-service-readiness`，`codex/feat-geofence-ui`，`2655844ac1ae4acfee0a80fc692beb09a2eca35d`。
- 实现与审查上下文独立；未改实现、Git分支 / index、HANDOFF或云端，本文件为审查唯一写入。
- 范围：全部本段`src/`、`scripts/` diff和新增geofence文件，任务卡、最终result、实际安装SDK与Supabase Functions调用链；未假设首段文件不变。

## 已修复的初审发现

### P2（已修复）：不确定打卡读回已有记录后，明确拒绝仍会重放RPC

初审位置：`src/study/plan-detail.tsx:63`–`84`，当时`needsReconcile`分支只为makeup提前返回；checkin读回已有卡后跳过验证，却继续调用`checkInPlan`。

复现顺序：

1. 本人有围栏计划没有打卡，主动同意本次定位，位置验证通过。
2. 首次实时RPC实际在服务端提交成功，但客户端丢失响应，随后状态读回也失败，保留`needsReconcile=true`。
3. 用户再次点击实时打卡，选择“不同意，本次不定位”。
4. 本次重新读回拿到已存在的打卡；由于`observed.checkin`非空，跳过`verifyCheckinLocation`及本次false隐私同步，随后仍重放`check_in_plan`，并显示“正常打卡已保存”。

审查独立执行了实际`PlanDetail` TSX的内存转译，以React hook / 数据 / 定位替身驱动上述按钮与失败顺序，没有复制重写submit逻辑，也未写测试文件或连接云端。结果为`rpcCalls=2`、`locationDecisions=[true]`、`reads=4`，最终notice为正常打卡已保存。

后端幂等保证此分支不产生第二条卡，但当时仍违反任务“拒绝不得RPC”和显式决定同步要求。作者已将不确定结果读回 / 已有卡返回放到隐私决定之前，并补实际组件回归；最终复查见下节。

## 其他源码核查

- 围栏名称 / GCJ-02中心 / 半径完整读取并写入；关闭时enabled=false、其余四列全null。选择器维护独立地点 / 半径草稿，取消不修改父编辑；编辑仍只写可编辑字段，未回写旧status / summary / timezone，软删不复活。
- POI只调用已部署`amap-poi-search`，不接收任意URL或服务Key；真实Supabase客户端通过当前用户JWT鉴权。输入限制、最小响应校验、401 / 429 / 503等友好错误、15秒timeout、AbortController与请求世代 / active / scope保护均已核对。旧词、卸载或旧会话返回不能写入新状态；空 / 加载 / 错误 / 重试可用。
- 修复后的新增打卡仅在明确同意后消费原生单次位置；拒绝通过SDK setPrivacyConfig(false)使ready失败，不请求权限或位置，也不提交RPC。无围栏、补卡、完成不依赖定位；Web / ExpoGo主动点击显示安装包限制，不使用浏览器坐标。
- 位置成功仍须GCJ-02合法有限坐标、精度≤min(100米,半径)、30秒新鲜度 / 最多未来5秒、原值距离≤半径，并在当前scope / 详情世代与active状态才可传true。范围外、拒权、超时、后台、无Key、不支持均不能作为新增有效判定；pending ref互斥同一详情操作。实际坐标不进数据库 / 日志载荷。
- 已重新核对`expo-gaode-map@2.3.1`：setPrivacyConfig确实写原生隐私状态；Android getCurrentLocation为独立once tempClient，回调后stop / destroy，并明确保留coordType；iOS独立AMapLocationManager.requestLocation继承设置并回收。JS超时仅停止等待、忽略晚结果，SDK stop不能取消这些独立单次；没有伪称底层cancel。
- 无新依赖、旧迁移或后台定位范围变更；Supabase Functions实际版本支持invoke的signal / timeout与response错误状态。未发现Web服务Key进入客户端、浏览器定位或轨迹代码。

## 初审独立检查（修复前）

- `npm run test:geofence`：21 / 21通过。
- `npm run test:plans`：8 / 8通过。
- `npm run test:study`：8 / 8通过。
- `npm run typecheck`、`npm run lint`、`git diff --check`：均通过。
- 当时拒绝 / 不确定读回组合不在21组测试中，审查额外内存组件复现确认失败；不能因原有检查全部通过忽略此问题。

Node已有模块类型推断提示不影响退出0。未重建云身份、未重跑旧Auth / DB全套。

## 最终回报与浏览器证据核对

已读取最终`T11-amap-geofence-ui.result.md`及本地忽略的`crud-check.js`、`async-check.js`，并实际查看390围栏详情 / 320真实POI选择截图。回报明确区分真实搜索和空 / 429替身，没有把Web或替身写成原生定位通过。

- `output/t11-web-final`产物实际存在；初审未重复导出，Web导出通过属于作者证据；修复后作者已重新生成该目录，最终包补核见下节。
- CRUD脚本真实代理搜索20条并检查保存中心与POI一致，重载、半径校验 / 取消 / 编辑400米、失败保草稿、完成后围栏编辑保留状态 / 总结、移除全null / 重载均有明确断言；Web有围栏实时操作RPC计数0。
- async脚本保持两条真实不同搜索的顺序隔离，替身空 / 429后恢复真实搜索，取消保留原选择，释放退出后晚响应并重载登录页。截图中长名称 / 地址正常换行且320px无横向截断。
- 两段pageerror为空是作者实际浏览器结果；console中的favicon404、主动中断PATCH、替身429与密码表单提示已如实区分。审查未另开浏览器 / 登录，不冒称独立重跑真实服务。
- 作者只新建并软删1条标记T11临时计划、未产生打卡或分钟，原T10样例保留；此清理属于作者证据。

## 保留限制

设备未连接，Android / iOS真实前台位置、坐标来源 / 精度、首次系统权限弹窗引起的inactive、隐私链接、拒权设置 / 重试、后台与原生单次回收均待设备验收。现有流程对inactive也判失效，首次权限体验须实测；不把源码 / Web检查当设备通过。

真实搜索复用已部署version2，不重复部署Auth / 迁移；本次无云端写入。正式上线隐私政策、启动耗时和原生系统字体 / 键盘不由本段Web证据覆盖。

## 修复后的最终定向复查

作者修复后再次冻结源码与result，审查仅复核当前最小改动、实际组件回归及最终产物，没有新增云身份、云写入或重复旧Auth / DB验收。

1. **P2关闭**：submit先在当前scope / 详情世代下读取不确定状态；实时 / 补卡一旦拿到已有卡，显示“已读取到…未再次提交打卡”并返回，均不重放RPC或再弹隐私。确无卡才判断是否展示原生围栏说明；新拒绝仍沿真实SDK隐私同步false路径返回失败，权限 / 位置 / RPC为0。无围栏、补卡、完成的合同未改变。
2. **回归确实执行组件**：完整读取新增`scripts/geofence/plan-detail.test.mjs`，其用现有TypeScript转译实际TSX，以hook / 平台 / 数据适配驱动实际按钮，不复制submit逻辑。测试串联真实`verifyCheckinLocation`和`requestSingleForegroundLocation`，并断言RPC / 权限 / 位置 / 决定计数；已由test:geofence脚本及现有CI覆盖，无新增依赖。
3. **独立重跑全部适用本地检查**：`npm run test:geofence`24 / 24、`npm run test:plans`8 / 8、`npm run test:study`8 / 8通过；`npm run typecheck`、`npm run lint`、`git diff --check`均通过。新增三项分别确认：不确定成功读已有卡只1次RPC；新拒绝false且0权限 / 位置 / RPC；不确定失败无卡先读回，再拒绝仅保留首次1次RPC。
4. **选点确认可见**：点中POI仅`setResults(null)`收起候选，保留selected与半径草稿；取消仍不写父编辑。独立实际查看最终`selected-fence-confirm-320.png`：320×720中已选名称、200米输入和确认按钮立即可见，无20条候选挤压；原选择 / 半径校验仍在。
5. **最终包与回报**：已核对result新增“独审修复与最终定向回归”。最终Web HTML生成时间晚于本次两个业务文件修改，截图晚于导出。读取`fix-check.js`确认真实200 / 20条搜索、收起后候选数0和半径 / 确认boundingBox均在视口有实际断言；Web限制部分仅GET响应替身，未冒称真实设备。脚本断言业务写入0并退出，作者报告无pageerror。审查未另开浏览器或重新请求云端。

原P2已关闭，无新增阻塞。剩余实质风险仍是尚无设备的权限弹窗 / inactive体验、真实GCJ-02来源 / 精度与原生单次请求回收，见上节；源码、Web及替身通过不替代这些验收。本文与实现保持冻结，可交主控同步main / PR并等待适用CI通过后集成。
