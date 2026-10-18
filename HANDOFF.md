# HANDOFF — 研刻 YanKe 项目状态

> 本文件是项目当前状态的唯一事实来源。每个 PR 合并后必须更新。
> 只写「现在」和「下一步」，历史决策见 docs/decisions.md，历史变更见 git log。

**最后更新**：2026-10-18 by <你的名字>
**当前阶段**：Day 0（文档与环境准备完成，尚未开始编码）
**当前分支**：main
**最新可用提交**：<commit hash>
**最新内测包**：无

---

## 1. 一句话状态

仓库文档与规范已落库，Expo 项目尚未初始化。下一步是 Day 1：骨架 + 定位可行性验证 + 静态时间表。

## 2. 任务状态快照

对照 docs/qoder-tasks.md 的 Day 列表：

| Day | 内容 | 状态 | 备注 |
|---|---|---|---|
| Day 1 | 骨架 + 定位验证 + 静态网格 | 未开始 | 关键风险：expo-gaode-map 与 timegrid 可用性 |
| Day 2 | 计划 CRUD | 未开始 | |
| Day 3 | 选点 + 围栏绑定 | 未开始 | |
| Day 4 | 打卡闭环 | 未开始 | |
| Day 5 | 总结 + 统计 | 未开始 | |
| Day 6 | 打磨 + 通知 | 未开始 | |
| Day 7 | 构建 + 验收 | 未开始 | |

状态取值只用：未开始 / 进行中 / 待验证 / 已完成 / 阻塞。

## 3. 已完成且可运行的东西

- 无。当前仓库只有文档，没有可运行代码。

## 4. 进行中 / 半成品（下一个 agent 必须知道）

- 无。

## 5. 阻塞项

- 无。

## 6. 已知坑与技术债

- 无。（踩坑后立即记录，例如“expo-gaode-map 在 Expo Go 下不可用，必须 development build”）

## 7. 关键决策速查

完整见 docs/decisions.md。当前生效的决策摘要：

- 后端用 Supabase 而非 Firebase（国内可访问性）
- 登录第一版用邮箱，不做手机号验证码
- 时间表组件优先 `@symbiot.dev/react-native-timegrid`，Day 1 验证，失败降级
- 打卡只附着于计划，不独立存在；不做防作弊与轨迹
- 第一周不做社交，第二周迭代

## 8. 环境与密钥（不含密钥本体）

- `.env` 需包含：`EXPO_PUBLIC_SUPABASE_URL`、`EXPO_PUBLIC_SUPABASE_ANON_KEY`、`EXPO_PUBLIC_AMAP_WEB_KEY`
- Supabase 项目节点：<填写>
- 高德 Key 类型：Web 服务 Key（用于 POI 搜索）；客户端定位 Key 见 expo-gaode-map 配置
- 密钥获取方式：<填写，例如“私聊仓库所有者”或“1Password 条目 yanke-env”>

## 9. 给新 agent 的阅读顺序

1. 本文件（你正在读）
2. README.md
3. DEVELOPMENT.md
4. docs/prd.md
5. docs/decisions.md
6. docs/qoder-tasks.md 中当前 Day 及之后的任务卡
7. docs/design-tokens.md
8. docs/schema.sql

读完不要立刻写代码，先按第 10 节模板输出你的理解与计划。

## 10. 新 agent 启动自检模板

每个新 agent 接手时，先输出以下内容，等人工确认后再动手：

- 你对产品核心闭环的一句话理解
- 当前阶段与你判断的下一步
- 你计划修改/新增的文件清单
- 你不打算动但可能相关的文件
- 你需要人工确认的疑问（最多 3 条）
- 你发现的本文件与代码不一致之处

## 11. 更新记录

| 日期 | 更新者 | 变更 |
|---|---|---|
| 2026-10-18 | <你> | 初始化 |