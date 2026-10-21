# 研刻 YanKe

面向考研备考人的极简 App：周网格 → 学习计划 → 可选地点围栏 → 时间窗口打卡 → 时长 → 手写总结 → 统计。

## 当前状态

开发准备阶段：已有文档和占位配置，Expo 尚未初始化。
[HANDOFF.md](HANDOFF.md) 提供最新状态与验证证据，不能仅凭 scripts 判断可启动。
已连接 [GitHub](https://github.com/CabbageCannon/yanke)，无需重新 clone。

## 技术方向

- Expo / React Native / TypeScript / Expo Router。
- Supabase 邮箱 Auth + Postgres，RLS 隔离本人数据。
- 高德原生前台定位和 POI 选点，原生桥接版本先验证。
- 时间表优先验证 @symbiot.dev/react-native-timegrid。
- 极简、深墨绿、低饱和科目色，无自定义启动页与重动效。

依赖与环境由 Agent 自主安装配置。初始化后补充可复现启动命令。
高德原生定位使用 development build；Expo Go 不代表原生能力可用。
高德 Web 服务 Key 和 Supabase 服务端秘密不得进入客户端包。

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
- [七天任务总览](docs/tasks.md) 与 [任务目录](docs/tasks/)
- [数据库 Schema 草案](docs/schema.sql)
- [设计 token](docs/design-tokens.md)
- [决策记录](docs/decisions.md)

## 第一周范围

计划、可选围栏、正常 / 迟到打卡、七天手填补卡、总结、科目时长 / 完成率 / 连续天数，邮箱登录。
不做社交、防作弊、轨迹、手机号验证码。
通知、复杂重复、拖拽只记候选，不作为闭环前置；不自动承诺第二周社交。
目标是经过验证的可安装测试版本，Android 优先；iOS 按实际账号、签名和设备条件记录。