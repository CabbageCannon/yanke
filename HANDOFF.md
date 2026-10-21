# HANDOFF — 研刻 YanKe

状态入口；代码、命令结果、Git / 云平台状态才是完成证据。
历史见任务回报与 Git，每阶段主控直接更新。

**最后更新**：2026-10-21，主控 Agent
**当前阶段**：Day 0，规范已修订，准备前置 GitHub 提交
**当前分支**：codex/docs-autonomous-workflow
**基准提交**：c656224（本阶段最终提交见 Git / PR）
**仓库**：https://github.com/CabbageCannon/yanke （公开）
**内测包 / 云部署**：无

## 1. 一句话状态

已有文档和占位配置，尚无 Expo 依赖、lockfile、路由；先修正规范提交 GitHub，再正式开发。

## 2. 任务快照

| 阶段 | 内容 | 状态 |
|---|---|---|
| Day 0 | 授权 / SOP / 引用修订，独立审查后先推送 GitHub | 已审查，待推送 |
| Day 1 | PRD / 架构 / Schema、Expo 与依赖验证 | 未开始 |
| Day 2 | 计划 CRUD 和网格持久化 | 未开始 |
| Day 3 | 高德选点与可选围栏 | 未开始 |
| Day 4 | 打卡、迟到时长、七天补卡 | 未开始 |
| Day 5 | 总结和统计 | 未开始 |
| Day 6 | 异常、视觉与启动体验 | 未开始 |
| Day 7 | 云端、构建与设备验收 | 未开始 |

## 3. 已完成与证据

- origin 已连接，远程 main 为 c656224，不需重复 clone。
- Git / Node / npm / gh 可用；gh 登录 CabbageCannon，可访问仓库。
- 已读原文件，确认过时人工门禁、失效 qoder-tasks 引用、产品歧义。
- 仅为工具和仓库检查，不代表 Expo / 数据库 / 云服务已运行。
- 文档链接和 git diff --check 通过；独立审查无阻塞，剩余初始化配置问题见第 6 节。

## 4. 进行中

- Day 0 独立审查、提交、推送完成前不开展应用实现。
- 起点有用户未提交修改：agent-workflow 阅读路径调整、删除 new-agent-instruction、增加 tasks/.gitkeep。
- 保留删除旧入口，以 AGENTS.md 替代；阅读路径意图纳入 SOP。

## 5. 阻塞与输入

- 待澄清 normal / late 重叠：建议开始时刻为界、无宽限。
- 待澄清总结可选还是必填：新需求建议填一句后完成。
- 高德平台 Key、Supabase URL / publishable Key 尚未提供或发现。
- 不阻塞规范和脚手架；真实集成按实际凭据与账号状态推进。

## 6. 已知限制

- package.json 只有 scripts，app.config.ts 引用了未安装插件，不能视作已初始化。
- 原 CI 在无 lockfile 时 npm ci；需区分文档阶段与应用阶段。
- 高德原生需 development build，Expo Go / Web 不证明原生定位可用。
- 旧 SQL 无唯一打卡、完整所有权关联，统计 view 需检查 RLS；未验证不得部署。
- 高德 Web Key 不可放 EXPO_PUBLIC，需服务端鉴权代理。
- Windows 无本机 iOS 原生构建，EAS / Apple 状态未验证。

## 7. 生效授权与决策

- 主控规划集成，代码必须经新分支和子任务，独立审查。
- 依赖 / CLI / 环境 / 账号注册登录 / 云配置部署 / 文档 Schema / Git 合并均持续授权。
- 仅缺秘密 / 交互验证、产品冲突、重大架构等才升级，不重复问权限。
- 第一次先提交推送规范再正式初始化，每阶段更新本文。
- 第一周无社交、防作弊、轨迹、手机号验证码；未绑定地点只看时间。

## 8. 环境与凭据位置

- Windows / PowerShell，Node 24.21.0，npm 11.19.0。
- GitHub 已登录，不需要用户再提供访问令牌。
- Supabase / EAS / 高德账号、项目与 Key 尚未确认；授权不是配置完成。
- 真实值只在忽略文件 / 平台秘密存储，本文不含密钥。

## 9. 下一步顺序

1. 读 AGENTS、本文、DEVELOPMENT、docs/agent-workflow。
2. 查工作区 / 远程，确认 Day 0 是否已推送，避免重复或丢改动。
3. 完成独立审查与前置 GitHub 提交，再开初始化分支和子任务。
4. 细化架构 Schema，核查实际依赖版本，不照占位配置盲装。
5. 缺凭据继续独立工作，真实结果写回报和本文。
