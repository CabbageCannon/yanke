# T09 Android原生构建验收

- 阶段 / 分支 / 基准：原生兼容提前验证，2026-10-22；codex/chore-android-build；隔离worktree D:/yk-native，基准a1d3573（已独立审查的T05 Auth候选）。
- 依赖 / 并行：与主目录后续T06客户端开发并行，禁止改主目录源码 / 分支 / index；只验证此明确快照，后续计划功能不能自动算进本次APK。
- 目标：验证Expo58 / RN0.88 / 高德2.3.1在真实Android工具链能编译，尽可能产出可安装且内嵌JS的内部测试APK，不以Hermes导出替代。
- 环境：D:/yanke-tools/toolchain.json记录JDK17 / ANDROID_HOME / GRADLE_USER_HOME；已装platform37.0、build-tools37.0.0、NDK27.1.12297006、CMake3.22.1、platform-tools37.0.1。用户级JAVA_HOME / ANDROID_HOME已填，现有进程需显式读取；C盘仅约13GB空闲，安装 / Gradle / npm缓存优先D盘。adb运行已验证，当前无已连接设备。
- 写入范围：本worktree生成且忽略的android/、必要可复现构建配置或脚本（有必要才新增）、docs/tasks/day7/T09-android-build.result.md。不改Auth / 业务代码、依赖版本、旧迁移、HANDOFF或真实签名材料；出现实质兼容错误先报告可复现信息和最小修复建议，不靠未保存node_modules补丁宣称成功。
- 权限：依赖 / SDK / Gradle下载与必要配置已授权，自主排错，无需用户安装；不收费构建、不自动重启Windows、不上架或分发到未知渠道。原生高德Key缺失不阻塞Auth构建，不伪造定位成功。
- 配置：只可从主目录.env.local安全复制客户端URL / anon或publishable Key到本worktree忽略文件，使内部APK可连测试项目；绝不复制.env.integration.local、service_role、数据库密码、UI测试密码进客户端。缺原生Key说明未验证地图，不填虚假Key。
- 验收：官方registry npm ci；Expo prebuild android；实际Gradle原生构建。优先内部release变体（默认测试签名可记录，不能称正式发布签名），内嵌JS不依赖Metro；可先做ARM64单ABI降低冷编译成本并明确架构。记录最终命令、APK绝对路径 / SHA256 / 大小、签名类型、merged manifest权限与是否内嵌JS。工具后台启动用隐藏窗口。
- 设备：若已有可用设备 / 模拟器则启动验收，否则如实保留安装 / 真机 / AppState / 定位未测；不把可编译等同启动或定位。没有设备不要求用户先承担环境安装。
- 非目标：实现计划CRUD或地图、生产发布、iOS本机构建、防作弊；本候选不代表完整MVP。
- 回报：同目录T09-android-build.result.md，完成后冻结，由主控审查 / 集成；不commit / push / 自行切分支。

## 权限核验扩展（2026-10-22）

- merged release Manifest发现RN / Expo默认SYSTEM_ALERT_WINDOW，Auth候选不使用悬浮窗。主控授权本分支仅在app.config.ts的android.blockedPermissions增加android.permission.SYSTEM_ALERT_WINDOW。
- 通过实际prebuild使配置可复现地进入生成Manifest，增量release重编后检查最终APK权限；不只手改忽略目录、不因编译中间态宣称已移除。
- 此配置修复冻结后与构建证据交独立审查；不扩大其他App / Auth / 依赖修改。APK代码仍为a1d3573 Auth快照加此配置修复，不含T06 / T10。

## R8组合SDK缺类修复扩展（2026-10-22）

- 原生代码编译通过，R8报告net.jafama.FastMath及com.amap.ams.gnss.GnssSoftLocator缺类。允许先以显式CLI minify=false核验内部Auth包，不能因此声称正式R8已通过。
- 补核公开同故障PR：https://github.com/rgywd/zhixing/pull/191（组合SDK11.2.000_loc11.2.000_sea9.8.0）；这属于第三方实例，不能代替本项目POM / 字节码与构建证据。
- 授权必要可复现Expo config plugin、app.config.ts插件接线及最小第三方许可记录，精确添加net.jafama:jafama:2.3.2原生依赖。仅在确认软RTK可选边界 / 异常处理后为GnssSoftLocator添加单类dontwarn，不允许全局忽略高德 / net.jafama警告。
- 禁止手补node_modules或仅改忽略的Gradle生成物。prebuild重复执行应保持依赖 / 规则幂等，随后真实minify=true release编译、签名 / 权限 / ABI / JS核验；插件与证据冻结后独立审查。
- 若GNSS可选边界仍无证据，报告具体阻塞，不把窄规则当作运行验证。所有包仍是Auth兼容快照，地图定位与完整MVP候选另验。
- 许可原文保留上游字节；若完整提交范围检查命中其原始空格，允许根.gitattributes仅对此许可路径设置whitespace例外并说明原因，不放宽其他文件、不修改已验证APK来处理排版。
