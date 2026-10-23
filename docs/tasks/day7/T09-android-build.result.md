# T09 Android 原生构建回报

- 状态：完成 Android 编译与 APK 静态验收，源码 / 回报已冻结，待独立审查；设备 / 定位验收未完成。
- 日期：2026-10-22 首轮，2026-10-23 续接；分支：`codex/chore-android-build`；快照：`a1d3573`（T05 Auth 候选）加本卡配置修复。
- worktree：`D:/yk-native`；未修改主目录 / Auth / npm 依赖版本，未 commit / push。

## 已验证

- `npm ci --registry https://registry.npmjs.org`：785包，退出0，约5分钟；缓存 `D:/yanke-tools/npm-cache`。
- 官方 npm audit bulk 请求在安装尾部网络超时，日志 FETCH_ERROR / request-timeout / audit report null；因此本次 npm ci 不代表漏洞审计通过。两个 postinstall 均退出0，未阻塞。
- 仅白名单复制 `EXPO_PUBLIC_SUPABASE_URL`、anon / publishable Key 到本 worktree 忽略的 `.env.local`；没有服务端密钥、数据库密码或 UI 密码。
- `npx --no-install expo prebuild --platform android --no-install`：退出0，package.json 无变化，原生生成物均在忽略的 android/。
- JDK17.0.20.1、Android SDK / adb 可执行；无连接设备。工具链路径来自 `D:/yanke-tools/toolchain.json`。
- 2026-10-23 续接先核查进程：旧正确参数构建日志停于 2026-10-22 16:06:37，未完成且无 APK / Gradle 存活进程；唯一 Java 进程为用户的 Xilinx 安装器，未干预。
- 当前生成测试 keystore 及最终 APK 签名的 SHA1 均为 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`，与用户创建高德 Android Key 的指纹一致。

## 构建命令与排错

从 `android/` 执行 `gradlew.bat :app:assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a --console=plain`。进程显式设置 JAVA_HOME / ANDROID_HOME / GRADLE_USER_HOME 为工具链记录值，ANDROID_USER_HOME / TEMP / TMP 均使用D盘，NODE_ENV=production、CI=1。

- 首次 wrapper Java 直连官方下载超时（10秒）。发现 Windows 已启用本机代理，而 Java 默认不沿用；仅向本构建进程通过 JAVA_TOOL_OPTIONS 注入本机 HTTP / HTTPS 代理后解决。
- 生成的 wrapper 配置增加官方 Gradle9.4.1 SHA256 `2ab2958f2a1e51120c326cad6f385153bb11ee93b3c216c5fccebfdfbb7ec6cb`，下载超时调至120秒。没有改依赖或源代码。
- 官方 Gradle9.4.1 分发包已100%下载并校验 / 解压到D盘；首轮实际Gradle执行103任务后在16分27秒失败：SDK CMake3.22.1捆绑 Ninja1.10.2 对 gesture-handler codegen 对象路径 `Stat` 报超过260字符。Windows LongPathsEnabled 已为1；不是C++或高德API类型错误。
- 最小环境修复：从 ninja-build/ninja 官方 v1.13.2 下载 ninja-win.zip，SHA256 `07fc8261b42b20e71d1720b39068c2e14ffcee6396b76fb7a795fb460b78dc65` 与官方 release digest 一致；替换D盘 CMake3.22.1工具目录的 Ninja，旧1.10.2另存同目录 `ninja-1.10.2.original.exe`。没有修改node_modules / App依赖 / 新架构设置。
- 新Ninja确实越过路径错误，Expo / RN / 高德原生Kotlin、Java、CMake编译通过；469任务在17分42秒后因R8缩减缺类失败：`com.amap.ams.gnss.GnssSoftLocator`、`net.jafama.FastMath`。官方高德组合SDK POM 没有声明依赖，自动生成的missing_rules仅建议dontwarn；未凭此盲加规则或依赖，正式R8问题保留。
- 主控授权仅为内部Auth兼容APK在上述命令增加 `'-Pandroid.enableMinifyInReleaseBuilds=false'`；PowerShell须给该完整参数加引号，否则实际拆成-Pandroid与.enable...，令project.android被字符串遮蔽，导致Expo libraryVariants错误。已用Node打印无敏感argv复现并修正；不是新SDK类型问题。此产物不是正式发布候选，未改默认release配置、不关闭新架构、不手补node_modules。
- merged release manifest曾含默认SYSTEM_ALERT_WINDOW。按扩展授权仅在源码 `app.config.ts` blockedPermissions 增加该项，重新实际prebuild，生成manifest已出现 tools:node="remove"；最终权限需待APK核验。prebuild本次自动清理重建android/，不是手改Manifest。
- 首轮网络日志：`D:/yanke-tools/logs/t09-android-arm64-release.log`；旧Ninja失败：`D:/yanke-tools/logs/t09-android-arm64-release-proxy.log`；R8失败：`D:/yanke-tools/logs/t09-android-arm64-release-ninja1132.log`；参数解析失败：`D:/yanke-tools/logs/t09-android-arm64-internal-no-minify.log`；当前正确参数构建：`D:/yanke-tools/logs/t09-android-arm64-internal-no-minify-quoted.log`。

## R8 修复与边界证据

实际缓存 POM / JAR 均为 `com.amap.api:3dmap-location-search:11.2.000_loc11.2.000_sea9.8.0`。POM 无 dependencies；扫描 JAR 仅两个类引用本次缺类：

- `com.autonavi.aps.protocol.aps.request.model.fields.context.b` 在字节码偏移 437 / 450 / 489 直接调用 `FastMath.min/max(int,int)`。不能只忽略缺类；本地 Expo 插件精确补 `net.jafama:jafama:2.3.2`。官方 Maven POM 声明 Apache 2.0，下载 JAR SHA256 为 `F5550BBA9C6E14731C4542024180B4C430B26F8F2FB70CADF709A4DE6F076991`。
- Gradle 实际解析缓存的 Jafama JAR 与该 SHA256 相同；JDK17 用这份 JAR 编译并运行 `FastMath.min/max(int,int)` 的实际调用断言，退出 0，方法签名可解析。
- `com.amap.location.fusion.original.a.a`（GnssLocator）在偏移 315–320 检查 `HeaderConfig.getProductId()==12` 后跳至 493，绕过偏移 360 创建的 `GnssSoftLocator` 非 mini 软 RTK 分支。此构造函数没有局部 catch，不能声称缺类会被异常处理吞掉。
- 公开定位适配器 `com.amap.api.col.3sl.h.e()` 固定 `AutoNaviLocationParam.mini=true`（偏移 192–193）；`com.amap.location.sdk.a` 初始化据此设置 productId=12（80–85）。因此当前公开入口会跳过该分支。插件只添加 `-dontwarn com.amap.ams.gnss.GnssSoftLocator`，没有通配规则。此证据只适用于当前组合 SDK，换 SDK 或入口需重新核查；不能替代真机定位。

本次源码：

- `app.config.ts`：阻断默认悬浮窗权限，接线本地插件。
- `plugins/with-amap-android-dependencies.js`：可复现依赖 / 单类规则；不修改 node_modules。
- `licenses/jafama-2.3.2.txt`：从官方 sources JAR 提取 Apache 2.0 正文及 FastMath / fdlibm 版权声明；插件复制到 APK `assets/third-party/jafama-2.3.2.txt`。
- `docs/third-party-notices.md`：用途、版本、来源、许可记录。

核对证据日志：`D:/yanke-tools/logs/t09-{gnss,gnss-caller,fusion,sdk-init,public-sdk-param,fastmath}-javap.txt`。

本次四次实际 prebuild 均退出 0；最终版本连续两次重生成后，Node assert 检查精确依赖 / 单类规则各出现一次，许可资产与源文件逐字节相同，全部通过。日志 `t09-prebuild-final-{first,second}.log`。只白名单读取用户忽略文件中的 `AMAP_ANDROID_KEY` 注入进程；未读取 Web 服务 Key，未输出 / 提交 Key 值。

源配置 `npm run lint` / `npm run typecheck` 退出 0；最终许可资产拷贝联动后 lint 再次退出 0。真实构建在上述命令使用 `'-Pandroid.enableMinifyInReleaseBuilds=true'`，日志 `D:/yanke-tools/logs/t09-android-arm64-release-amap-fix.log`。Gradle 退出 0：`BUILD SUCCESSFUL in 13m 24s`，612 个任务（598 执行 / 14 up-to-date），实际执行 `:app:minifyReleaseWithR8` 并生成 `mapping.txt`，不是关闭 R8 的替代包。

## 最终 APK 与静态验收

- 构建输出：`D:/yk-native/android/app/build/outputs/apk/release/app-release.apk`。
- 保留副本：`D:/yanke-tools/artifacts/yanke-auth-compat-a1d3573-arm64-minified.apk`；旁边保留 `.apk.sha256`。后续 prebuild 会重建 android/，因此副本独立于生成目录。
- 文件大小：65,536,295 bytes（约 62.5 MiB）。
- SHA256：`3d073938717185380ac95d038e382bc2ab872ea975b5724e746601846f001324`。
- Android 包名 `com.yanke.app`，版本 `0.1.0` / code 1；compile SDK 37、target SDK 36、min SDK 24。
- `apksigner verify --verbose --print-certs` 退出 0，APK Signature Scheme v2 验证通过；单个 Android Debug 测试证书，RSA 2048。证书 SHA1 如上，SHA256 `FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C`。没有正式发布签名或生产发布承诺；日志 `D:/yanke-tools/logs/t09-apk-signature-final.log`。
- `aapt dump badging` 及 ZIP 检查均仅 `arm64-v8a`；release 没有 `application-debuggable` 标记。
- APK 实际包含 `assets/index.android.bundle`，4,077,416 bytes，Hermes bytecode 魔数正确；含 classes DEX，ZIP CRC 全部有效。内嵌 JS 不依赖 Metro，尚未设备启动。
- APK 实际 `assets/third-party/jafama-2.3.2.txt` 与源许可文件逐字节一致。
- `aapt dump permissions` 的最终权限仅：`ACCESS_COARSE_LOCATION`、`ACCESS_FINE_LOCATION`、`ACCESS_NETWORK_STATE`、`ACCESS_WIFI_STATE`、`INTERNET`、`VIBRATE`，以及自有 `com.yanke.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`。断言确认没有悬浮窗、后台位置、前台位置服务或外部存储权限，与生成 packaged Manifest 一致。
- `adb devices -l` 当前为空；没有伪造安装、启动或围栏结果。

`git diff --check` 通过。未提交 APK、生成原生目录、真实 Key、测试 keystore 或本机日志；未操作 Git index / commit / push。

### 许可原文的单文件空白例外

主控提交 `a668ee9` 后，完整提交差异检查发现许可文件第 27 行上游 fdlibm 版权原文带一个尾空格；此前工作区检查尚未包含当时 untracked 的许可文件，因此没有覆盖这一行。为保持已打包的上游声明逐字节一致，只在根 `.gitattributes` 对 `licenses/jafama-2.3.2.txt` 设置 `-whitespace` 并注明原因，同一路径使用 `-text` 防止后续 checkout 的换行转换；其他文件的检查和换行策略保持不变。

验证：`git check-attr whitespace -- licenses/jafama-2.3.2.txt` 为 `unset`；明确启用 trailing-space / space-before-tab 后，完整 `a668ee9^..a668ee9` 差异检查通过。许可文件 SHA256 仍为 `4B5C97A02B1A2FE64A456A49F8AECA8EB5A9020E459728A828DDFD41F6A7F8CA`，仍与 APK 中的许可资产逐字节一致。没有修改许可原文、APK、构建配置或重编；本次仅新增属性例外与补充回报，已再次冻结，待独立审查。

## 待完成 / 未测

本轮是 ARM64 Auth 兼容快照，后续计划 / 打卡页面不在候选中。已注入用户提供的原生高德 Key，但没有连接设备，安装 / 启动 / AppState / 定位 / 冷启动耗时未测；可编译也不能替代这些证据。Windows 没有本机 iOS 构建证据。

按主控指示暂停中间包重编；独立审查后由主控集成配置。所有业务 / 高德 UI 合并后再同步最终源码，编一次 MVP 候选，不把此 Auth 包当作完整 MVP。

建议 commit：`fix(android): resolve AMap release dependencies and trim permissions`。
