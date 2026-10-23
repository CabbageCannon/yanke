# T09 Android 构建独立审查

- 日期：2026-10-23。
- 审查目录 / 分支：`D:/yk-native` / `codex/chore-android-build`，基准 `a1d3573`。
- 结论：**T09 Android 编译与 APK 静态验收通过，未发现阻塞问题。** 已独立复核最终产物；这不是完整 MVP、设备启动或真机定位通过的结论。
- 独立上下文只读实现、任务及原始依赖，唯一写入本文；未切分支、未 Git 提交、未触发 prebuild / Gradle，避免干扰作者正在进行的真实构建。

## 源码与边界

1. `app.config.ts` 仅追加悬浮窗阻断权限与本地插件接线；原有后台位置 / 位置前台服务 / 外部存储阻断保留。高德 `enableBackgroundLocation=false`，原生 Key 仅通过 `AMAP_ANDROID_KEY` / `AMAP_IOS_KEY` 进入原生配置，没有 Web 服务 Key 或 public 高德变量。
2. 插件通过 Expo `withAppBuildGradle` 补精确版本 `net.jafama:jafama:2.3.2`，不改 node_modules；生成模板非 Groovy 时明确失败。只追加精确单类 `-dontwarn com.amap.ams.gnss.GnssSoftLocator`，没有高德 / Jafama 通配忽略。
3. 独立查看当前组合 SDK POM：`11.2.000_loc11.2.000_sea9.8.0` 无 dependencies。实际 JAR 的 APS 请求字段字节码直接调用 `FastMath.min/max(int,int)`，显式补库有必要，不能用 dontwarn 代替。
4. 对**实际 Gradle 缓存 JAR** 独立执行 JDK17 `javap -c -p`：公开适配器 `com.amap.api.col.3sl.h.e()` 在 192–193 固定 `mini=true`；`com.amap.location.sdk.a` 在 77–85 据此设 productId=12；`GnssLocator` 构造函数在 315–320 判断 productId=12 后跳至493，避开360处 `new GnssSoftLocator`。该构造函数没有局部 catch，作者未将其描述成异常吞掉。窄规则依据是当前入口不可达分支，不能推广到其他入口 / SDK，也不能代替设备执行证据。
5. `expo-gaode-map` 固定2.3.1，其 Gradle 当前选择上述固定组合 SDK，未发现自定义 SDK 配置。SDK / 入口升级需要重新核验边界。
6. 许可文件保留 FastMath 上游版权与 fdlibm 声明及完整 Apache 2.0 正文，文档记录用途、版本和来源；插件复制到原生 assets，随 APK 可分发，未新增产品页面。

## 独立验证

- `node --check plugins/with-amap-android-dependencies.js`：通过。
- Node assert 检查 Expo 两个 mod 已注册，当前生成 Gradle 的精确依赖 / ProGuard 单类规则各仅出现一次、没有相关通配忽略、许可资产与仓库源文件逐字节相同、后台开关与原生 Key 边界：通过。未为审查重复执行会清除 android 的 prebuild；作者两次最终重生成退出0的日志与现有生成物一致。
- 对官方 `jafama-2.3.2-sources.jar` 用 Python zipfile 只读提取并比较：FastMath 头部两份版权声明完整保留，Apache 正文逐字一致（归一换行）：通过。实际 Gradle 缓存 Jafama JAR SHA256 为 `F5550BBA9C6E14731C4542024180B4C430B26F8F2FB70CADF709A4DE6F076991`，与作者记录一致。
- 只读解析当前 packaged release Manifest：包名 `com.yanke.app`；权限仅前台粗略 / 精确位置、网络状态、Wi-Fi状态、Internet、震动与应用自身的动态接收器权限。悬浮窗、后台位置、位置前台服务和外部存储均不存在。最终 APK 权限亦已复核，见下文。
- `git diff --check`：通过。
- 作者已运行 lint / typecheck 并记录退出0；审查未扩大重跑 Auth / 业务测试。

## 最终 APK 独立复核

- 产物：`D:/yanke-tools/artifacts/yanke-auth-compat-a1d3573-arm64-minified.apk`，大小 **65,536,295 bytes**；独立 SHA256 为 `3d073938717185380ac95d038e382bc2ab872ea975b5724e746601846f001324`，与作者记录精确一致。
- 只读核对实际构建日志：确实执行 `:app:minifyReleaseWithR8`，最终 `BUILD SUCCESSFUL in 13m 24s`，612任务；生成 `mapping.txt` 存在。本次未重新执行 Gradle。
- 独立运行 SDK37 `apksigner verify --verbose --print-certs`：退出0，v2签名验证通过，单个2048位RSA Android Debug测试证书；证书SHA1为 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`，与此前高德配置要求一致。证书SHA256为 `FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C`。测试签名不是正式发布签名。
- 独立运行 `aapt dump badging` / `dump permissions` 并断言：包名 `com.yanke.app`，版本0.1.0/code1，无 `application-debuggable`，ABI仅 `arm64-v8a`；最终 uses-permission 精确等于上文7项允许集合，没有悬浮窗、后台位置、位置前台服务或外部存储。
- Python zipfile + assert 检查：整个ZIP的CRC有效；原生so仅ARM64；存在classes DEX；`assets/index.android.bundle` 大小 **4,077,416 bytes** 且Hermes bytecode魔数正确；`assets/third-party/jafama-2.3.2.txt` 与仓库许可文件逐字节相同。以上均通过。静态内嵌JS证明无需Metro提供bundle，未声称设备已启动。

## 交付限制

- 本候选为 `a1d3573` Auth 快照加配置修复，不含后续计划 / 打卡 / 围栏 UI；主分支集成后需要另外构建业务候选。
- 无连接设备；安装、启动、AppState、GCJ-02定位来源、真实围栏和启动耗时未验证。Windows 未做本机 iOS。
