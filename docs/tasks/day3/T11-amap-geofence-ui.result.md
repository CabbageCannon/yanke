# T11 客户端交付：选点、围栏编辑与前台打卡入口

- 日期：2026-10-23。
- 状态：客户端实现 / 自测完成，源码冻结供独立审查；**真实设备定位仍待验**，不将浏览器或替身测试视作设备通过。
- 目录 / 分支：`D:/yanke-service-readiness`，`codex/feat-geofence-ui`；基准为已独审T10候选`2655844`，主控已报告对应PR #9合并为`f8958e1`。
- 应用ponytail最小完整实现与Playwright CLI技能；复用现有主题 / sheet、Supabase与expo-gaode-map2.3.1，无新依赖 / 迁移 / 云身份。
- 未操作Git / 分支 / index，未改主目录源码、HANDOFF、PRD或旧迁移；首段result / review / deployment保留原有事实。

## 产物与行为

| 文件 | 行为 |
| --- | --- |
| src/geofence/poi-data.ts | 只调用已部署鉴权`amap-poi-search`，提交query / page，带取消与15秒边界；校验最小POI合同，不透传原始错误 |
| src/geofence/geofence-picker.tsx | 显式提交搜索、加载 / 空 / 失败 / 重试、地点名称与地址、独立选择和半径草稿；选中后收起候选，半径 / 确认可见；取消不写原计划，旧词 / 关闭 / 旧会话回包失效 |
| src/geofence/domain.ts | 从完整数据库围栏列还原并验证Geofence；沿用50–1000整数半径、GCJ-02、200米默认值 |
| src/geofence/checkin-location.ts | 无围栏跳过位置；完整围栏才请求一次位置，当前scope / 详情仍有效且通过精度 / 新鲜度 / 距离后才返回verified=true；实际位置不进入写入载荷 |
| src/geofence/location.ts、location-request.ts | 仅原生有围栏实时打卡消费明确的同意 / 拒绝决定，先同步SDK隐私状态再请求前台权限 / 单次位置；Web / ExpoGo明确失败，不调用浏览器位置 |
| src/plans/plan-domain.ts、plan-data.ts、plan-editor.tsx | 完整围栏列读取、创建 / 编辑 / 移除；选择和取消仅更新本地草稿，保存失败保留输入；关闭全null；编辑不回写status / summary / timezone |
| src/study/plan-detail.tsx、study-data.ts | 显示地点与半径，有围栏实时按钮串联说明 / 高德隐私链接 / 明确决定 / 一次位置 / 围栏判断；只在成功后传RPC true，无围栏默认false；补卡 / 完成不定位 |
| scripts/geofence/verify.test.mjs、plan-detail.test.mjs、package.json | 首段15组 + 6组客户端合同 + 3组实际TSX不确定读回 / 拒绝回归；test:geofence与现有CI覆盖全部24组 |

详情互斥提交流程沿用T10的pending ref、挂载 / scope / 请求序号与不确定写入先读回机制。定位晚结果不能在关闭详情、退出账号或切入后台后变为有效打卡。未更改RPC的可信服务器时间 / 唯一打卡规则；没有客户端持久化实际坐标、后台定位或轨迹。

说明和决定只在用户主动原生围栏实时打卡时出现；拒绝同步false且不得请求权限或位置。无围栏、补卡、完成不弹位置说明。Web / ExpoGo点击围栏实时入口显示原生安装包限制，不伪造true，也不使用浏览器坐标。

## 实际检查

| 命令 | 结果 |
| --- | --- |
| npm run test:geofence | 最终24 / 24通过，含首段15 + 合同6 + 独审修复后实际TSX回归3；SDK / 高德失败路径为替身测试 |
| npm run test:plans | 8 / 8通过 |
| npm run test:study | 8 / 8通过 |
| npm run typecheck | 通过 |
| npm run lint | 最终通过，无警告；初次发现effect清理ref警告，冻结前已消除 |
| npx expo export --platform web --output-dir output/t11-web-final --max-workers 2 | 通过，6个Web bundle、3条静态路由 |
| git diff --check | 通过 |

Node既有MODULE_TYPELESS_PACKAGE_JSON提示与Expo颜色环境提示不影响退出码，未为消除提示修改模块体系。
浏览器使用最终生产Web静态包，Python本机HTTP预览8093，Playwright CLI / Chromium。只将主目录客户端Supabase URL / anon / publishable白名单配置复制到本worktree忽略文件；**没有读取或复制高德Web服务Key、Android Key或Supabase服务端Key到Expo**。测试凭据仅从既有忽略文件读到进程内存，不写脚本 / 输出 / 提交；未注册新身份。

## 首次生产Web浏览器证据

1. **真实搜索与持久化**：已有沙箱身份经已部署代理查询“国家图书馆”，HTTP200、20条真实POI；选中“中国国家图书馆”，200米保存。检查实际POST返回，数据库中心与本次真实POI的GCJ-02中心完全一致；重载后详情正确显示地点与半径。
2. **选择校验与取消**：无选择不能确认；半径49拒绝，200可用。将半径草稿改700后取消，原200保持。之后修改为400保存 / 重载正确；先移除再取消整个编辑，数据库仍400。
3. **失败保草稿 / 重试**：仅中断临时计划PATCH请求，UI明确失败且标题 / 400米围栏草稿保留；恢复请求后同一编辑成功。
4. **完成隔离**：有围栏计划在Web直接填写可选总结并完成成功，不走定位。后续保存围栏编辑时实际返回仍为completed且保留该总结，未覆盖完成状态或总结。
5. **移除持久化**：保存关闭围栏，实际返回`geofence_enabled=false`，name / lat / lng / radius全null；重载显示未绑定地点。
6. **Web保护**：点击有围栏实时打卡显示原生安装包限制；本次全流程实时RPC请求计数为0，没有用浏览器位置或替身坐标打卡。
7. **旧词隔离**：拦住第一条真实“国家图书馆”响应，改词并真实搜索“复旦大学”返回20条；释放旧响应后，当前词与新候选保持，旧地点没有回填。
8. **空 / 配额 / 重试**：浏览器替身空响应和429均显示对应状态；移除替身后再次真实“国家图书馆”搜索200并恢复20条。空 / 配额只是UI替身证据，不冒称触发真实高德配额。
9. **取消 / 旧会话**：已选复旦地点后再搜索国家图书馆，取消选点保留原选择；另拦住一条真实搜索响应，取消选点 / 取消编辑 / 退出账号后释放，未重现个人选点UI，重载保持登录页。
10. **尺寸 / 异常**：390详情与320选点截图实际查看，长地址正常换行、页面可滚动，320px文档宽度320无横向溢出；两段pageerror均为空。console包含预览favicon404、被主动中断的PATCH、模拟429与既有密码表单提示，未把这些混作应用运行时异常。

本地忽略产物：

- `output/playwright/t11/crud-check.js`、`async-check.js`：上述两段可重放Playwright脚本，不含凭据。
- `output/playwright/t11/real-fence-detail-390.png`：真实绑定地点 / 半径详情。
- `output/playwright/t11/real-poi-picker-320.png`：真实复旦POI名称 / 地址与320px布局。
- `output/playwright/t11/old-poi-signedout-320.png`：晚响应释放后的退出状态。

只新建1条明确标记“T11 临时围栏验收”的业务计划，验收后已通过UI软删并检查返回status=deleted；该临时计划无打卡记录，未产生历史分钟。原6条非删除T10计划及历史记录保留。本轮最后已退出当前浏览器会话，预览与浏览器结束后停止。

## 独审修复与最终定向回归

独立审查额外复现了既有21项合同测试未覆盖的组合：首次围栏实时写入实际成功但响应 / 读回均失败，重试时先弹隐私，用户拒绝后读回已有卡仍重放RPC。服务端唯一约束虽不新增第二张卡，客户端行为违反拒绝边界。该问题已按审查最小复现修复，首次测试通过不能代替本段回归。

- 将不确定结果读回移到隐私决定之前。实时 / 补卡若读回已有卡，直接显示“已读取到…未再次提交打卡”，不重放写RPC，也不再请求本次隐私决定或定位。
- 当前没有卡才决定是否需要展示原生围栏隐私说明。新操作明确拒绝仍同步SDK false，不请求权限 / 位置，不提交RPC。
- `scripts/geofence/plan-detail.test.mjs`用已有TypeScript在内存转译**实际PlanDetail TSX**，以hook / 平台 / 数据适配驱动实际按钮处理器，不复制submit实现、不检查源码字符串，也不连云端。
- 实际TSX三项结果：不确定成功已卡`reads=3 / rpc=1 / decisions=[true]`且不再有隐私按钮；新拒绝`rpc=0 / permissions=0 / positions=0 / decisions=[false]`；不确定失败无卡先读回后拒绝`reads=3 / rpc=1 / decisions=[true,false]`，权限和位置均只在首次同意时各一次。
- 选中POI后仅清空候选列表，保留已选中心 / 半径草稿，避免20条长列表把确认藏在底部。

修复后重新执行24项围栏测试、8项学习测试、lint / typecheck / git diff检查与最终Web生产导出，全部通过。计划规则源码未变，8项计划测试沿用本段首次结果，不重复整套云 / Auth验收。

重新导出同一`output/t11-web-final`后启动新的Playwright会话，使用既有沙箱身份做定向浏览器回归：

1. 真实“国家图书馆”搜索HTTP200 / 20条；320×720下点选后候选按钮数0，已选名称立即显示。半径输入框`y=480,height=48`、确认按钮`y=600,height=48`，均在视口内；实际查看新截图`output/playwright/t11/selected-fence-confirm-320.png`确认反馈和半径 / 确认清楚可见。
2. 确认仅回填未保存草稿，然后取消整个编辑，没有创建计划。为避免污染已有数据，仅在当前浏览器GET响应中给既有计划套用围栏字段 / 无卡替身，点击实时仍显示Web原生限制；`output/playwright/t11/web-limit-after-reconcile-320.png`实际查看。此处只是平台限制编排回归，不冒称真实围栏设备验收。
3. 定向脚本`output/playwright/t11/fix-check.js`记录业务写入0、实时RPC0、pageerror空；未新建身份或业务数据，既有6条计划不变，完成后退出账号并关闭浏览器 / 本机预览。

源码现再次冻结，交独立审查复核本次最小改动；原生设备未测项继续保留。

## 未测与边界

- 未有连接设备；Android / iOS原生定位、真实GCJ-02来源与精度、隐私链接 / 原生系统权限弹窗、拒权后设置 / 重试、前后台与底层一次请求回收均待设备验收。本段不声称已完成真实定位打卡。
- 原生系统权限弹窗可能改变AppState；现有流程会拒绝后台 / inactive的结果并允许重试，首次权限体验仍需设备检查。JS超时仅忽略晚结果，不声称取消独立原生请求。
- 没有重新部署函数、Auth或迁移；真实搜索复用首段已部署version2与默认JWT网关校验，已有服务端鉴权仍保留。
- 未重复注册邮件 / 完整Auth / DB测试，未验证冷 / 热启动耗时或正式发布合规文本；本段高德用途说明并非完整上线隐私政策。
- 无复杂地图、离线写入、后台位置、轨迹或新依赖。原生构建与最终APK由T09工作流独立验证，不能用本段Web导出代替。

建议提交：`feat(geofence): connect POI selection and foreground check-in`。独立审查通过后由主控同步main、更新HANDOFF、提交PR / CI并合并；需要回退时revert本段客户端改动，不触碰已有数据库或高德服务端函数。
