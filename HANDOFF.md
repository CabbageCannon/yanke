# HANDOFF — 研刻 YanKe

状态入口，实际代码、命令结果和 Git / 云平台状态是完成证据。
每阶段主控直接更新；详情看 docs/tasks/，方向决策看 docs/decisions.md。

**更新**：2026-10-22，主控 Agent
**阶段**：T05 / T07已合并PR #4；T08 RPC独立审查通过，待云验收；T06计划CRUD自测中，完整 MVP 尚未交付
**本阶段分支**：codex/feat-checkin-rpcs，基于main 5f6e465，RPC提交238da0f；主目录codex/feat-plan-crud仍有在途实现，T09在隔离worktree
**账号阶段PR**：[PR #4](https://github.com/CabbageCannon/yanke/pull/4)两项CI通过，已合并5f6e465；T06推送前同步此main
**规则交付**：[PR #3](https://github.com/CabbageCannon/yanke/pull/3)已合并ad00493，无迟到宽限、总结可选
**基础交付**：[PR #2](https://github.com/CabbageCannon/yanke/pull/2)已合并为991b1bb，PR与main两项CI均通过
**前置规范提交**：PR #1 已通过 CI，合并为 b1bb007
**仓库**：https://github.com/CabbageCannon/yanke （公开）
**测试Supabase**：yanke-dev，Tokyo（ap-northeast-1），ref jhaxdxokcszbbkbvagtl，基础迁移已部署；真实云11组检查通过
**安装包 / 原生验收**：无

## 1. 当前产物

规范已先提交 GitHub，再通过子任务完成 Expo Router 空周网格与 Supabase 数据库基础。
Expo58 / RN0.88 / React19.3；timegrid 精确固定0.2.2，高德模块2.3.1。
T05 Auth UI / 会话、真实浏览器验收与独立审查已完成并合并PR #4；T06计划CRUD首版进入自测。T08打卡RPC已完成独立审查并同步main，准备云部署 / 验收；T09已完成Android prebuild及Gradle下载代理修复，原生编译中。POI、总结 / 完整统计页面未交付，不能当作已完成MVP。

## 2. 任务快照

| 阶段 | 状态 |
|---|---|
| Day 0 规范 / 授权 / SOP | 已完成，PR #1 |
| Day 1 PRD / 架构 / 数据库基础 | 已完成，T03文档与T02数据库独立审查通过 |
| Day 1 Expo本地骨架 | 已合并PR #2，本地验收、独立审查与远程CI完成 |
| 产品规则补充 | T04已合并PR #3，无迟到宽限、总结可选 |
| Day 1 邮箱Auth | T05干净安装、15单测 / 真实浏览器 / 独立审查均通过，已合并PR #4 |
| Day 1 原生定位 | 尚未交付，不得用JS打包替代 |
| Day 2 计划CRUD | T06实现中，基于已独立审查的Auth候选 |
| 云环境 / 会话 | T07真实云11组与独立审查通过，e03e92e已集成 |
| Day 3 高德选点 / 围栏 | 未开始 |
| Day 4 打卡 / 补卡 | T08服务端本地42组与独立重放 / 审查均通过；未部署新RPC，UI未开始 |
| Day 5 总结 / 统计 | 未开始 |
| Day 6 体验 / 异常 | 未开始 |
| Day 7 构建 / 设备验收 | T09在D:/yk-native验证Auth快照a1d3573的Android编译；不自动包含T06 |

## 3. 验证证据

- Day 0：规范提交25ade3f先推送，PR #1检查通过，合并b1bb007；用户已有修改 / 删除意图已保留。
- T03：PRD / architecture独立审查通过；文档链接、空白检查通过。
- T02：ba9fb70已集成。PGlite0.5.10 / PostgreSQL18.6，24组约束、双用户RLS、FK、view、快照、软删 / 账号级联检查通过，独立审查重放通过。
- T01：最终0.2.2干净npm ci、lint、typecheck、expo install --check、doctor20/20、Web静态SSR和Android JS/Hermes导出通过；Chromium390/320窄屏无应用异常与横向溢出。独立审查有条件通过，无阻塞，保留上游审计风险；无Key渲染、配置与定向检查重放通过。
- SQL唯一来源 supabase/migrations；docs/schema.sql是受一致性检查的阅读副本。重放步骤见 docs/database.md。
- T07：真实PG17.11 / GoTrue密码登录 / refresh / JWT / PostgREST双用户RLS等11组通过，临时两个账号清理并验证级联；独立审查通过。可重放脚本在scripts/integration，e03e92e。
- T05：最终785包npm ci、lint / typecheck / 15Auth单测 / Expo匹配 / 无配置Web导出通过；真实UI登录 / 恢复 / 退出 / 失败重试通过，390 / 320可见网格无溢出及运行时异常。独立审查通过并重跑15单测 / typecheck，详见result / review。
- T08：新增4个RPC，本地42组（旧24+新18）及独立重放全部通过；权限 / 行锁 / 锁后服务器时钟 / 总结语义与测试时钟隔离审查通过。真实JWT / PostgREST和跨连接并发另验，不能用PGlite单连接替代。
- 真实注册 / 重置邮件送达、高德原生定位、GCJ-02实际来源、APK / iOS / 真机和启动耗时均未验证；T07管理员确认沙箱不代表邮件注册送达。

## 4. 本轮交付与保留项

- T01–T05 / T07已合并；2026-10-22恢复在途工作，保留既有实现与测试项目。T08在codex/feat-checkin-rpcs已提交、独立审查并同步main，云端仅对yanke-dev追加新迁移；T06 / T09继续隔离推进。
- CI已强制npm ci / lint / typecheck / 版本检查 / Web静态导出，另有临时PGlite数据库检查job；当前提交对应结果见本轮PR的Checks。
- T00审查遗留的public高德Web Key输出和无lockfile跳过CI已清理。
- 数据库子任务来自隔离分支，已集成；临时worktree已确认干净后用git worktree remove清理，ba9fb70与本地任务分支保留。
- 服务端配置已安全保存在主目录忽略的.env.integration.local；UI沙箱凭据在.env.ui-sandbox.local，不提交 / 输出值，暂保留供T05 / T06验收。

## 5. 已确认规则 / 缺少信息

- 用户已确认：开始前15分钟至开始时刻（含）为normal、取完整计划分钟；开始后至结束前为late、按实际打卡至结束计时，无宽限。
- 用户已确认：总结可选，可以直接完成；补卡亦不强制总结。规则见PRD v0.4 / ADR-014，T08 RPC本地实现及审查通过，待部署。
- Supabase现有CLI会话有效，已创建独立免费测试项目；T07准备忽略的客户端配置与沙箱凭据，不披露值。Expo CLI未登录，高德Key仍未取得。
- 先自主检查可用登录 / CLI并完成独立工作；确需秘密 / 邮箱确认 / MFA时才报告最小动作，不披露值。

## 6. 已知限制

- timegrid0.2.3/0.2.4发布包Context分裂，不能盲升；0.2.2保持精确固定，详见ADR-012。
- T05当前npm audit为19 high、0 moderate、0 critical（braces / node-forge两条工具链根公告），不force降级Expo；旧T01的26项是当时结果，发布前复核当前锁文件。
- 高德配置 / JS打包不等于原生可用；JDK17 / Android CLI / adb已验证，SDK37.0 / build-tools37 / NDK27.1 / CMake3.22.1已安装；T09原生编译中，无已连接设备。Windows无本机iOS编译，EAS / Apple未验证。
- 打卡直接客户端写被禁止，T08业务RPC和连续天数本地实现及审查通过，云验证及UI仍待完成。
- 高德Web服务Key只放服务端，原生Key独立注入；仅一次前台定位，不存实际位置 / 轨迹。

## 7. 授权与接力

依赖、CLI、环境、账号注册登录、云配置部署、规范 / Schema和Git集成均持续授权。
主控规划集成，代码经新分支 / 子任务实现并独立审查，每阶段更新本文。
不重复问常规权限；只升级缺秘密 / 交互验证、产品冲突、重大架构或超出授权的破坏性操作。
第一周无社交、防作弊、轨迹、手机号验证码，未绑地点只校验时间。
根入口AGENTS.md；真实值只进忽略文件 / 平台秘密存储。

## 8. 下一步

1. 先读AGENTS、本文、DEVELOPMENT、agent-workflow，核对git status / log / PR，避免重复初始化或清理未知改动。
2. T06自测完成后冻结并独立审查，提交后由主控同步5f6e465再推送PR。主目录有在途实现，禁止切分支或清理未知修改。
3. T08独立审查 / 提交后，在已有测试项目部署新增迁移，分层验证真实JWT / PostgREST与独立连接并发；不重复初始化T07。
4. 接入打卡 / 完成 / 统计UI；高德Web代理和原生定位按七天计划接入，秘密缺口只阻塞依赖任务。
5. 后续Agent自行处理CLI / 工具链安装，不把常规下载与排错退回用户。
