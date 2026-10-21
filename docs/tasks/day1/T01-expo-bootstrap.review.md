# T01 独立代码审查

- 日期：2026-10-21；目录：D:/yanke；分支：codex/chore-expo-bootstrap；审查时 HEAD：ba9fb70。
- 范围：任务卡 / 最终回报，app、src、package / lockfile、Expo / TS / ESLint 配置、CI，以及 README / HANDOFF 的事实边界。
- 结论：**有条件通过**。无阻塞问题，可提交并运行远程 CI；保留下面已记录的上游工具链审计风险，不把审计失败改称通过。

本次建立可无 Key 打开的 Expo Router 空周网格，并接入实际 timegrid。当前没有 Auth UI、计划 CRUD、打卡 RPC、POI 或完整统计，不构成完整 MVP 或原生验收。

## 代码、配置与依赖结论

- Router 入口、GestureHandlerRootView、安全区域和页面 flex 结构完整；主题值对应设计 token。网格实际使用七天、周一、08:00–23:00和30分钟配置，无虚构计划 / 登录 / 定位状态，无自定义启动页。
- package.json、lockfile 和实际安装的 timegrid / Expo / Router / React / RN / Reanimated / Worklets 等版本一致；根依赖与开发依赖清单一致。锁文件下载地址均为官方 registry，未发现含凭据的下载 URL。
- timegrid **0.2.2精确固定有代码与运行依据**：独立读取已有0.2.3 / 0.2.4发布包，useScrollXY消费 Context$3$1，ScrollXYProvider提供另一 Context$3；安装的0.2.2由 ScrollProvider / useScroll共用 Context$8。没有通过改 node_modules 或换库掩盖问题；ADR-012和回报准确保留升级限制。
- app / src 未导入高德运行时、未请求位置或真实服务。高德仅构建插件配置；无服务端 Web Key 输出，后台定位关闭，Android 后台位置 / 前台位置服务 / 外部存储权限显式移除，iOS无后台定位模式。
- CI移除无lockfile跳过逻辑，强制npm ci、lint、类型和Expo版本检查，并执行Web静态渲染捕捉Context回归。独立数据库job固定PGlite0.5.10，位于runner临时目录，没有加入移动端依赖。
- README / HANDOFF明确原生编译、APK、真机、云端Auth / JWT / PostgREST和高德实际定位未验证；未把Hermes JS导出、高德插件introspection或数据库基础写成完整业务成功。

## 实际定向复验

- `npm run lint`、`npm run typecheck`、`npx expo install --check`：通过，依赖匹配。
- 清除子进程中的高德 / Supabase配置并设置 `EXPO_NO_DOTENV=1` 后，执行Web导出到OS临时目录：退出0，SSR和三个静态路由导出成功。未重装773个应用包。
- 同样无Key条件下，`expo config --type introspect --json` 退出0；筛选检查SDK58、仅router extra、后台选项关闭、iOS后台模式为空及Android权限移除标记，未输出秘密值。
- Playwright使用独立Chrome会话访问本次无Key导出：320×844，HTTP200，08:30 / 22:30网格文本存在，scrollWidth=viewportWidth=320，pageerror为空。只复验当前骨架，没有扩大业务流程范围。
- `git diff --check`通过，仅LF / CRLF提醒；相关新增源码 / 配置无行末空白。README / HANDOFF的14个本地Markdown链接有效，HANDOFF为79行。
- 核对环境 / 导出 / 签名样例的gitignore规则有效。检查高德postinstall只探测Expo Modules基础设施；安装脚本允许项按版本固定。
- 本次启动的浏览器会话与本地HTTP服务均已关闭；导出和CLI临时产物没有写入受审实现。

## 非阻塞风险

1. **上游工具链审计仍有告警。** 读取现有最终审计JSON，确认19 high、7 moderate、0 critical，总26项，根公告为braces、node-forge和uuid，与T01回报一致。已记录路径集中于Metro / CLI / iOS工程工具链；自动建议降到Expo44与当前匹配栈冲突，本轮未发现可直接应用的兼容修复证据。保留回报中的风险说明，跟踪上游并在后续发布前复核；不得报告“零漏洞”或使用force降级掩盖结果。

## 验证边界

本审查未重复npm ci、Android JS导出、Doctor或网络审计，相关最终执行证据来自T01回报；本轮独立重放的是上述定向检查。未运行远程Actions、原生构建、设备、Auth / 高德真实服务，T02 / T03未重新全量审查。

审查 Agent 仅新增本报告，未修改实现、切分支、提交或推送。
