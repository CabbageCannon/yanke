# 研刻 YanKe

面向考研备考人的极简 App：周网格 → 学习计划 → 可选地点围栏 → 时间窗口打卡 → 时长 → 手动完成（可选总结）→ 统计。

## 当前状态

邮箱账号、周网格计划CRUD、高德POI选点与可选围栏、实时打卡 / 七天补卡、可选总结和统计客户端均已合并。Supabase测试项目的迁移、可信RPC和鉴权POI代理已部署并分别通过真实服务验证；正在完成集成体验检查与完整业务Android候选构建。
[HANDOFF.md](HANDOFF.md) 提供最新状态与验证证据，不能仅凭 scripts 判断可启动。
已连接 [GitHub](https://github.com/CabbageCannon/yanke)，无需重新 clone。

## 技术方向

- Expo / React Native / TypeScript / Expo Router。
- Supabase 邮箱 Auth + Postgres，RLS 隔离本人数据。
- 高德原生前台定位和 POI 选点，原生桥接版本先验证。
- 时间表优先验证 @symbiot.dev/react-native-timegrid。
- 极简、深墨绿、低饱和科目色，无自定义启动页与重动效。

实际基础版本：Expo 58 / React Native 0.88 / React 19.3，timegrid 精确固定 0.2.2，高德模块 2.3.1；准确解析版本见 lockfile。
timegrid 0.2.3 / 0.2.4 发布包存在 Context 分裂，不能盲升；原因见 docs/decisions.md 的 ADR-012。
依赖与环境由 Agent 自主安装配置，复现命令如下。
高德原生定位使用 development build；Expo Go 不代表原生能力可用。
高德 Web 服务 Key 和 Supabase 服务端秘密不得进入客户端包。

## 本地运行与检查

执行 Agent 负责安装和排错；本机已用 Node 24.21 / npm 11.19 验证，不要求用户手动准备依赖。

```powershell
npm ci
npm run start
# Web 业务界面预览（不支持原生高德定位）
npm run web
# 静态检查
npm run lint
npm run typecheck
npm run test:auth
npm run test:plans
npm run test:geofence
npm run test:study
npx expo install --check
npx expo-doctor
```

无云配置时显示明确的基础骨架与未配置提示，不模拟登录或保存。需要接真实服务时，从 .env.example 生成忽略的本地配置或使用平台 secrets，不提交真实值。高德两类Key的平台选择及注入边界见[高德配置](docs/amap-setup.md)。
`npm run android` / `npm run ios` 是原生 development build 命令，需要相应工具链；Windows 无法本机构建 iOS。
高德 JS 配置检查和 Android JS / Hermes 打包不等于已构建 APK 或验证真机定位。
Web已验证真实登录、计划持久化、无围栏学习闭环、POI选点和围栏编辑；原生围栏打卡须使用Android安装包，Web / Expo Go会明确提示能力限制。T09已有原生release构建证据，但它是旧Auth快照，不能当作完整业务候选。

原生设备定位 / 权限、安装与冷 / 热启动、真实注册 / 重置邮件送达及iOS仍待验；正式上线隐私政策与受保护的账号注销路径亦未完成。当前锁文件保留19项high上游工具链依赖风险，详见HANDOFF；不将内部测试版本视为商店发布版本。

## Agent 接手

先读 [AGENTS.md](AGENTS.md) 和 [HANDOFF.md](HANDOFF.md)，简述下一步后直接执行已授权工作。
主控统一沟通和规划；代码通过新分支 / 子任务实现，独立审查后集成。
安装、配置、排错、账号注册登录、云部署和 Git 提交合并无需逐次批准。
缺秘密、交互验证、产品冲突或重大架构变更才升级，详见授权入口。

## 文档

- [开发规范](DEVELOPMENT.md)
- [Agent 工作流](docs/agent-workflow.md)
- [PRD](docs/prd.md)
- [技术与交付计划](docs/plan.md)
- [技术架构](docs/architecture.md)
- [七天任务总览](docs/tasks.md) 与 [任务目录](docs/tasks/)
- [数据库 Schema 阅读副本](docs/schema.sql)
- [数据库迁移与本地 / 云验证](docs/database.md)
- [设计 token](docs/design-tokens.md)
- [决策记录](docs/decisions.md)

## 第一周范围

计划、可选围栏、正常 / 迟到打卡（无宽限）、七天手填补卡、手动完成与可选总结、科目时长 / 完成率 / 连续天数，邮箱登录。
不做社交、防作弊、轨迹、手机号验证码。
通知、复杂重复、拖拽只记候选，不作为闭环前置；不自动承诺第二周社交。
目标是经过验证的可安装测试版本，Android 优先；iOS 按实际账号、签名和设备条件记录。
