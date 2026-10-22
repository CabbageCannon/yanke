# T05 邮箱账号与会话：实现回报

- 日期：2026-10-22。
- 状态：实现与自测完成，冻结等待独立审查；未操作 Git index / 提交 / 远程。
- 工作目录 / 分支：主目录，codex/feat-auth-plans。接续上一轮保留的未提交代码；期间主控集成 T07 的 e03e92e，未改本任务实现。
- 范围：邮箱密码注册 / 登录 / 退出、持久会话、身份边界与无配置预览。不含计划 CRUD、定位、打卡、统计、找回密码或账号注销。

## 1. 交付文件与行为

| 文件 | 行为 |
| --- | --- |
| src/lib/supabase-config.ts | 校验 URL 与 publishable / anon Key；拒绝识别出的服务端 Key、远程明文 HTTP、带凭据或查询参数的 URL |
| src/lib/supabase.ts | 挂载后创建唯一官方客户端，AsyncStorage 持久化，URL polyfill；关闭 URL 自动提取会话，不导入服务端秘密 |
| src/lib/auth-session.ts | 恢复 / 登录 / 注册 / 退出状态；请求互斥、过期结果失效、错误转为用户可读文本；提供身份 scope |
| src/auth/auth-provider.tsx | 上下文、挂载后连接、AppState 刷新管理与清理；只在已登录时向业务层提供 client / scope |
| src/auth/auth-gate.tsx | 登录 / 注册表单、确认邮箱提示、恢复与退出失败重试、账号退出入口；未配置时保留只读周网格预览 |
| app/_layout.tsx、app/index.tsx | 接入页面访问边界与账号工具栏 |
| src/components/week-timetable.tsx | 接收工具栏 / 预览提示；按容器实际宽度挂载网格，修复无配置生产 Web 初始网格被 0 宽度裁剪 |
| app.config.ts、.env.example | 兼容 publishable / anon 两个客户端 Key 名称；构建时分别检查两个变量，不能用有效 publishable Key 掩盖另一个变量误放的服务端 Key |
| package.json / package-lock.json、tsconfig.json | 依赖与 Node 原生 TypeScript 测试配置；新增包的 lock 下载地址统一为官方 registry |
| scripts/auth/verify.test.mjs、.github/workflows/ci.yml | 15 项无需云凭据的逻辑 / 配置测试；CI 应用检查执行 npm run test:auth |

注册拿不到 session 时保持未登录，提示确认邮件后再登录；不伪造注册成功后的账号会话。密码输入遮蔽，表单可切换模式，有校验、处理中禁用和错误重试。

恢复中 / 恢复失败 / 退出中 / 退出失败均不能访问个人页面。退出先撤销当前 scope 并移除个人子树，之后才等待 SDK 退出；退出失败保持阻断且可重试，不自动展示旧账号。

身份版本仅随用户 ID 边界变化。相同用户的 TOKEN_REFRESHED / 重复 SIGNED_IN 保留 scope 和页面状态；旧认证响应不能覆盖较新账号事件；旧用户刷新事件不能恢复已退出或已切换的账号。

## 2. 依赖与兼容性

- @supabase/supabase-js 2.118.0：官方 Auth / 后续 PostgREST 客户端，MIT。
- @react-native-async-storage/async-storage 2.2.0：Expo 匹配的跨平台会话持久化，MIT。
- react-native-url-polyfill 4.0.0：原生 URL 支持，MIT。
- 没有全局状态框架或额外测试框架。Node 下直接运行纯逻辑 TypeScript 文件；Node 22 分支最低版本调整为 22.18，CI 继续 Node 24。
- 兼容补丁实际锁定 Expo 58.0.17、expo-constants 58.0.13、expo-linking 58.0.14、expo-router 58.0.25、expo-status-bar 58.0.4。React / RN、timegrid 0.2.2、高德 2.3.1 保持既定版本。
- 官方 Auth 2.118 已默认内置无锁刷新协调；按随包 migrations/lockless-coordination.md 移除旧 processLock 配置，避免使用 deprecated 选项。
- 初次 expo install --fix 被本机默认 npm 镜像的同步延迟阻断（缺 @expo/metro-runtime 新补丁）；本次安装改用官方 registry 后修复，未修改用户全局 registry。

## 3. 实际验证

| 命令 / 流程 | 结果与边界 |
| --- | --- |
| npm ci --registry https://registry.npmjs.org | 通过，干净安装 785 包，退出 0；此前官方 npm install 已修复镜像缺包 |
| npm run lint | 最终通过，含主控已集成的 T07 脚本，无 lint 错误 / 警告 |
| npm run typecheck | 最终通过 |
| npm run test:auth | 最终 15 / 15，通过；无 skipped，测试 SDK 接口替身仅用于边界逻辑，不能等同云端 Auth |
| npx expo install --check | 最终通过，Dependencies are up to date |
| EXPO_NO_DOTENV=1，清除三个 Supabase public 环境变量后执行 npx expo export --platform web --output-dir <临时目录> --max-workers 2 | 最终通过；生成 3 个静态路由、首页约 20KB。服务端输出框架，客户端 onLayout 确认非零容器宽度后挂载网格 |
| 无配置生产导出的 Chromium 预览 | 最终 390px 可见日头 / 时间网格 / 预览提示；08:30 标签实际屏幕命中测试通过，390 / 320px 无横向溢出，pageerror=0 |
| 真实 Supabase 沙箱的 Chromium 登录 UI | 已确认的独立测试账号：错误密码提示 → 离线失败 → 联网重试 → 密码登录 → 周网格 → 页面重载恢复 → 退出 → 本地会话删除 → 重载仍未登录，全部通过 |
| 表单交互 / 视觉 | 登录 / 注册双向切换、无效邮箱、短密码、切模式清密码、密码遮蔽通过；390×844 与 320×568 主控件完整可见、无横向溢出；查看了截图；真实流程 pageerror=0 |
| git diff --check | 通过；仅本机 CRLF 转换提示，不是空白错误 |

真实 UI 测试使用 T07 安全准备的客户端配置与管理员确认沙箱，值只从忽略文件读入内存，没有写入代码 / 回报 / 会话输出。没有创建真实身份或发送注册邮件。T07 的真实服务 11 组检查见其独立回报；不重复计入本任务的 15 项逻辑测试。

测试过程与截图位于本机临时目录 `%TEMP%/yanke-t05-auth-qa/`，不入 Git。重点截图为 login-390.png、login-320.png、register-validation-390.png、week-authenticated-390.png（邮箱已遮蔽）、no-config-week-fixed-390.png。之前无配置截图是排错产物，以 fixed 版本为准。浏览器、开发服务器和临时静态服务器均已关闭。

## 4. 给 T06 的复用入口

`useAuth()` 来自 src/auth/auth-provider.tsx：已登录时提供 `client`、`session`、`scope`；其他状态 client / scope 均为空。不要从无会话页面发个人计划请求。

`scope.userId` 是当前用户；`scope.key` 在身份边界变化时更新，相同用户刷新 token 不变。异步读写返回后，先检查 `scope.isCurrent()` 以及调用组件是否仍挂载，再更新页面数据；过期结果丢弃。个人子树以 scope.key 挂载，因此退出 / 切账号会清理本地状态。不要把 token 当成 React key，也不要在每次 TOKEN_REFRESHED 重置编辑表单。

## 5. 保留风险与未测项

- 真实邮箱注册、确认邮件送达与确认链接未测；确认提示分支已做逻辑测试，不能把管理员确认沙箱当邮件送达验收。
- 原生 Android / iOS 会话持久化、系统键盘 / 真机 AppState、APK / iOS 构建未测；没有把 Web 验证当作移动端证据。原生构建由后续独立任务完成。
- 最终官方 npm audit 为 19 high、0 moderate、0 critical。剩余根公告为 braces（GHSA-vfj7-8cjw-p6xm）与 node-forge（GHSA-86w9-cpqp-85rv），沿 Expo 构建工具链传播；没有安全兼容修复，工具建议的 major 降级到 Expo 44 不采用，未运行 audit fix --force。原始 JSON 在忽略的 .expo/npm-audit.json。
- 干净安装仍提示 ESLint 9 维护期；Node 原生 TS 测试有 MODULE_TYPELESS_PACKAGE_JSON 性能提示。为这两个非阻塞提示未改全项目模块制式或强升不兼容依赖。
- 本任务未运行新的原生 JS 导出或原生构建，没有声称它们通过；没有部署生产版本。

建议 Conventional Commit：`feat(auth): add email login and isolated persistent sessions`。
