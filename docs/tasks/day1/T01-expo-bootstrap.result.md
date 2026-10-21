# T01 Expo 初始化与依赖验证回报

- 完成程度：本任务范围已完成、自测通过，待独立审查；不是完整 MVP 或原生设备验收。
- 日期 / 平台：2026-10-21，Windows 11 / PowerShell；Node 24.21.0、npm 11.19.0。
- 分支：`codex/chore-expo-bootstrap`；实现期间主控集成 T02 提交 `ba9fb70`，未修改本任务应用文件。
- 实现 Agent 未切分支、commit、push，也未修改主控文档或数据库文件。

## 交付文件和行为

- `package.json`、`package-lock.json`：真实 Expo Router 入口、匹配依赖、严格 TS / lint 脚本和可复现锁文件；删除引用未安装 Prettier 的占位 format 脚本。
- `app.config.ts`、`tsconfig.json`、`eslint.config.js`：Expo 配置、strict、共享源码别名和 Expo flat lint 配置。
- `app/_layout.tsx`、`app/index.tsx`：最小 Router 布局、前台状态栏、安全区域和默认本周页面，无自定义启动页 / 启动动画。
- `src/theme.ts`、`src/components/week-timetable.tsx`：设计 token；实际导入 TimeGrid，显示本周周一至周日、08:00–23:00、30 分钟网格、中文日期和当前时间线。仅空网格，不显示虚构计划、登录或定位结果。
- `.env.example`、`.gitignore`：原生高德 Key 占位和构建产物 / 秘密忽略；不包含任何真实值。
- `.github/workflows/ci.yml`：强制 lockfile / npm ci / lint / typecheck / Expo 依赖匹配，增加 Web 静态渲染回归检查；独立 db-check job 在 runner 临时目录安装固定 PGlite 0.5.10，不进入应用依赖。
- 本回报文件。

使用官方 `create-expo-app@5.0.0` 在仓库外临时目录真实生成 `expo-template-default@58.0.25`（`--no-install --no-agents-md`），再择取其 Router 入口、版本组合和 TS 基础配置。没有用脚手架覆盖当前仓库。未迁入模板演示页、动画、图片、重置脚本或额外 UI 包。

最终 scripts：

| 命令 | 实际脚本 |
|---|---|
| `npm start` | `expo start` |
| `npm run android` | `expo run:android` |
| `npm run ios` | `expo run:ios` |
| `npm run web` | `expo start --web` |
| `npm run lint` | `expo lint` |
| `npm run typecheck` | `tsc --noEmit` |

## 最终版本与兼容性

| 包 | 最终 lockfile 版本 | 用途 / 证据 |
|---|---|---|
| Expo / Expo Router | 58.0.16 / 58.0.24 | 官方模板同系列；SDK 58.0.0 配置；匹配检查通过 |
| React / React DOM | 19.3.0 | 模板固定组合 |
| React Native / RN Web | 0.88.0 / 0.21.4 | Android Hermes 与 Web 实际导出通过 |
| timegrid | **0.2.2，精确固定** | 真正导入、SSR 和浏览器渲染通过；见下文 pin 原因 |
| Reanimated / Worklets | 4.7.1 / 0.13.0 | Expo 推荐组合；模板默认 Babel 能力，无额外插件补丁 |
| Gesture Handler | 3.3.0 | Expo 推荐版本；最小网格浏览器可渲染 |
| safe-area-context / screens | 5.10.1 / 4.30.0 | Router / 安全区域 |
| date-fns | 4.4.0 | 中文格式、本周起止和 timegrid peer |
| expo-gaode-map | 2.3.1，精确固定 | 原生候选、插件 introspection 通过；没有原生编译 / 设备证据 |
| TypeScript | 6.0.3 | strict 类型检查通过 |
| ESLint / eslint-config-expo | 9.39.5 / 58.0.4 | lint 通过；ESLint 9 有维护期弃用提示，见限制 |

Expo 官方 registry 的 Node engines 为 `^22.13.0 || ^24.3.0 || ^26.0.0 || >=27.0.0`，当前版本满足。timegrid、date-fns、Expo、Router、React、RN、Reanimated、Gesture Handler 和高德包均为 MIT；数据库检查临时使用的 PGlite 为 Apache-2.0，细节属 T02。

### timegrid 0.2.3 / 0.2.4 的发布缺陷

首先验证最新 0.2.4。安装、类型、Doctor 和 Android JS 打包均通过，但 Web 静态渲染退出 1：`Cannot destructure property 'scrollXTo' ... as it is undefined`。

发布包 `index.esm.js` 为单行；0.2.4 的 0-based 字符偏移证据：

- 16183：`Context$3$1=createContext(void 0)`；16233：`useContext(Context$3$1)`。
- 114820：另建 `Context$3=createContext(void 0)`；115803：`jsx(Context$3.Provider,...)`。
- `ContainerProvider` 消费前者，`ScrollXYProvider` 提供后者，Context 身份不同。该缺陷也会影响原生真实渲染，并非只是不支持 SSR。
- 0.2.3 有相同分裂；包只导出 TimeGrid，src 只有声明文件，不能靠外包 Provider 或改源码入口解决。主控安排的只读 Agent 也独立核实了该原因。
- 0.2.2 的 `ScrollProvider` 与 `useScroll` 均使用 `Context$8`。固定它后，同一页面 Web 静态渲染、Chromium 和最终 Android 导出全部通过。

没有改 node_modules、维护 fork、更换网格库或用 single 模式跳过 SSR。CI 新增 Web 静态导出，捕捉类型检查无法发现的实际渲染故障。完整计划交互、重叠、性能、读屏与原生手势仍需后续任务验证。

### 高德的实际证据和边界

- npm 2.3.1 已真实安装，peer 为 Expo / React / RN `*`；宽泛 peer 不作为原生兼容结论。
- 包使用 Expo Modules API，README 声明 SDK 54+ 和新 / 旧架构；其自身开发依赖为 Expo 57 / RN 0.86，因此不声称已有 SDK 58 原生编译证据。
- Android 原生依赖为 `com.amap.api:3dmap-location-search:11.2.000_loc11.2.000_sea9.8.0`；iOS 地图 11.2.000、AMapLocation 未固定、AMapSearch `~> 9.7.5`，podspec 最低 iOS 15.1。
- 类型声明存在 `setPrivacyConfig`、`initSDK`、`checkLocationPermission`、`requestLocationPermission`、`getCurrentLocation(): Promise<Coordinates | ReGeocode>`；原生搜索已内置。后续需在真实隐私同意后使用单次定位 API，不能调用连续 / 后台接口替代。
- 配置从构建环境读取 `AMAP_ANDROID_KEY` / `AMAP_IOS_KEY`，不进入 extra，不读取或输出 Web 服务 Key。包虽提供 webKey API，本项目没有调用；POI 仍走后续鉴权服务端代理。
- `enableBackgroundLocation: false`；introspection 确认 iOS 无后台模式，Android 后台位置、前台位置服务及离线地图存储权限为显式移除。无 Key 也能解析配置、导出和打开基础界面。
- 当前页面没有导入或调用高德运行时模块，因此基础网格渲染不依赖它；Web 导出不验证高德，Expo Go 也不能验证该原生模块。

## 已执行的最终验收

除单列的初始失败与审计告警外，下表均基于最终 timegrid 0.2.2 安装。命令退出 0 才标通过。

| 实际命令 / 验证 | 结果 |
|---|---|
| `npm ci --registry https://registry.npmjs.org` | **0**；最终锁文件干净重装 773 包，约 3 分钟；此前 0.2.4 也做过一次，不以旧结果替代最终结果 |
| `npm run lint` | **0**；覆盖集成后的 DB 脚本 |
| `npx eslint scripts/db/verify.mjs` | **0**；显式确认新增 mjs 无 lint 错误 |
| `npm run typecheck` | **0** |
| `npx expo install --check` | **0**；Dependencies are up to date |
| `npx --yes expo-doctor` | **0**；20/20，无问题 |
| `npx expo config --type public --json` | **0**；SDK 58、Android / iOS / Web、没有客户端 Web Key 字段；只输出筛选后的非敏感摘要 |
| `npx expo config --type introspect --json` | **0**；高德插件在 SDK 58 可执行；已核对前台权限 / 后台移除，输出经过筛选 |
| `npx expo export --platform android --output-dir .expo/export-android --max-workers 2` | **0**；1948 模块，Hermes `.hbc` 约 4.3 MB；不是 APK |
| `npx expo export --platform web --output-dir .expo/export-web --max-workers 2` | **0**；Web 1602 / SSR 1657 模块，3 个静态路由，首页约 21 KB |
| PGlite：`node scripts/db/verify.mjs <临时 PGlite dist/index.js>` | **0**；CI 对应调用本地重放 24/24；没有修改 DB 脚本 |
| Playwright Chromium 访问 Python 本地静态预览 | 390×844 截图实见七列、日期、半小时网格和当天时间线；320×844 重载断言 HTTP 200、08:30 / 22:30 存在、无横向溢出、`pageerror=[]` |
| `git diff --check` | **0**；仅 Git 的 LF / CRLF 提示，无空白错误 |

原生包的 npm postinstall 已阅读；按当前 npm 版本固定允许 `expo-gaode-map@2.3.1`（检查 Expo Modules 基础设施）与 `unrs-resolver@1.12.2`（本机解析器准备）脚本，记录在 package.json。最终 npm ci 没有未处理安装脚本警告。

浏览器唯一控制台资源错误是未配置的 `/favicon.ico` 404，属 Web 预览小项，未增加图标资产。截图未提交 Git，绝对路径为：

`C:/Users/zjl13/AppData/Local/Temp/yanke-t01-package-inspection/.playwright-cli/page-2026-10-21T07-41-05-361Z.png`

静态预览服务器和本任务 Chromium 已关闭；没有遗留运行中的验收命令。原始最终审计 JSON 留在忽略目录 `.expo/npm-audit.json`，不提交。

## 审计告警与维护限制

本机默认 npmmirror 的安全审计接口返回 404，已改用官方 registry 核查。最终 `npm audit --registry https://registry.npmjs.org --json` **退出 1**：19 high、7 moderate、0 critical，共 26 项；不能报告“零漏洞”。传递影响归结为三条根公告：

| 根公告 | 实际路径 / 处理依据 |
|---|---|
| [braces 嵌套模式栈耗尽](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)，`<=3.0.3` | Expo → @expo/metro → metro-file-map → micromatch 4.0.8 → braces 3.0.3；属于文件匹配 / 构建工具链。官方 latest 仍为 3.0.3，无已发布修复版可 override。 |
| [node-forge RSA 签名验证](https://github.com/advisories/GHSA-86w9-cpqp-85rv)，`<=1.4.0` | Expo → @expo/cli（含 code-signing-certificates）→ node-forge 1.4.0；开发 / 构建签名工具链。官方 latest 仍为 1.4.0，无已发布修复版。 |
| [uuid 缓冲区边界](https://github.com/advisories/GHSA-w5hq-g745-h8pq)，`<11.1.1` | Expo → @expo/config-plugins → xcode 3.0.1 → uuid 7.0.3；iOS 工程生成工具。当前 xcode 只见无参数 `uuid.v4()`，未调用公告中的 v3/v5/v6 缓冲区路径。修复 uuid 需跨主版本；xcode 4 已移除它，但同样超出 Expo 的 xcode 3 范围，未强行 override。 |

审计自动建议降至 Expo 44 / RN 0.72 / 旧 Reanimated，会破坏 SDK 58 版本匹配，未执行 `--force`。应持续跟踪上游补丁并在发布前复核工具链风险；当前结果不是安全认证。ESLint 9 也有维护期提示，但 Expo 配置当前使用的 eslint-plugin-react 7.37.5 / eslint-plugin-import 2.32.0 的 peer 上限仍为 9，未强装 10 或绕过 peer 检查。

## 未测项、偏离与下一步

- 无 Android JDK / SDK / adb 环境或连接设备；未进行 Android 原生编译、APK 安装、Expo Go 真机、冷启动测量或原生手势测试。Windows 未做 iOS 编译。
- 未配置 / 验证 EAS、签名、高德实际 Key、定位权限拒绝 / 精度 / GCJ-02、围栏内外；SDK 58 与高德的原生二进制兼容仍需 development build 和真机。
- 未实现或声称 Supabase Auth、计划 CRUD、POI、打卡、总结、统计业务闭环；无账号 / Key 不阻塞本骨架。
- 唯一依赖选型偏离是同库由最新 0.2.4 精确固定 0.2.2，有发布源码、失败和最终渲染证据。CI 扩展的独立 DB 检查由主控追加授权。
- 建议提交：`chore(config): initialize Expo Router application`；主控安排独立审查、核对范围，再执行 Git / PR。后续在这个基础上实施业务，不以本回报替代设备 / 云端验收。
