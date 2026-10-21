# 开发规范

适用于所有 Agent。授权入口见 AGENTS.md，执行流程见 docs/agent-workflow.md。

## 1. 分支与提交

- main 是唯一长期分支，保持可复现、可验证。修改经任务分支和 PR 集成。
- 默认 codex/<type>-<topic>，例如 codex/chore-expo-bootstrap、codex/feat-plan-crud。
- 主控创建 / 切换分支后再分派；共享目录中子 Agent 不自行切分支或操作公共 index。
- 并行实现使用隔离 worktree；保留已有用户改动，仅提交已审阅文件。
- 无需逐次批准 commit、push、PR、merge；独立审查和检查通过后主控可自主合并，遵守远程保护。
- 优先 squash merge。回滚用新分支 revert，不强推 main。

提交格式：`<type>(<scope>): <subject>`，采用 Conventional Commits。
type：feat / fix / docs / chore / build / ci / test / refactor / perf / style。
scope 按职责命名，例如 auth、timetable、plan、geofence、checkin、stats、db、config、deps、workflow。

示例：

```text
docs(workflow): align agent permissions and handoff rules
chore(config): initialize Expo application
feat(checkin): calculate late check-in duration
```

一次提交完成一个逻辑目标。约 300 行是拆分参考，不是硬上限；脚手架、锁文件、迁移和必要联动可例外。
禁止无意义的 update / wip；禁止提交依赖目录、构建产物、真实密钥。

## 2. 自主执行与升级

用户已授权安装依赖 / CLI、环境、账号注册登录、Supabase / EAS / MCP 配置、部署、排错、Schema / 文档修改和 Git 集成。
Agent 直接执行必要工作，记录结果，不把命令或常规故障交用户处理。
新增依赖说明用途、许可和兼容性，使用 Expo 推荐的版本安装方式并提交 lockfile，不另求批准。
只有缺失秘密 / 用户交互验证、实质产品冲突、重大架构 / 范围改变或超出授权的破坏性操作才升级。

## 3. 实现标准

- TypeScript strict；避免无理由 any、静默 catch、伪造成功状态和多余抽象。
- 路由放 app/，共享实现放 src/；UI 使用对应 docs/design-tokens.md 的主题常量。
- 时间存 UTC timestamptz，展示和统计遵循 PRD 的业务时区；可信边界校验时长和权限。
- 校验表单、网络失败、空状态、权限拒绝和重复操作。
- 地点可选：无围栏只检查时间，不能被定位权限阻塞。
- 不做后台定位、轨迹、防作弊、社交或手机号验证码。
- 区分 Expo Go 和 development build；没有真机证据不能声称高德定位可用。

## 4. 检查与证据

- 文档：核对引用、规则一致性和 git diff --check，无需纯文字测试。
- 初始化后：npm ci、npm run lint、npm run typecheck，非平凡规则用小而有意义的边界测试。
- 按改动验证 Metro 打包、Expo 配置、原生构建与设备流程；Web 打包不能代表移动端验证。
- 数据库验证约束、RLS 用户隔离和迁移；只有 SQL 文件不代表已部署。
- 回报写实际命令、结果、平台和未测项。失败要修复或标记，不勾选没运行的检查。
- 缺密钥继续静态开发，但真实 Auth、POI、定位、云部署必须单独记待验证。
- CI 不得把纯文档仓库当作已经初始化的应用。

## 5. PR 与阶段交付

实现 Agent 写 result，独立审查 Agent 检查逻辑、安全、边界和验证覆盖，主控集成。
PR 写最终行为、任务、实际验证、未测项与回滚方式，使用 .github/pull_request_template.md。
检查和独立审查通过后主控自主合并，不逐卡等人工验收。
真实设备 / 账号缺口保留为待验证，不能伪造或静默省略。

每阶段更新 HANDOFF：任务快照、产物、证据、半成品、阻塞、下一步。
方向决策追加 docs/decisions.md；详情和历史放 docs/tasks/ 与 Git。
HANDOFF 尽量不超过 120 行，主控自行提交，不需要用户改写或确认。

## 6. 环境与秘密

- 只提交 .env.example 占位符；真实值进忽略文件或平台秘密存储。
- 客户端可用 Supabase publishable / anon Key，但必须依赖 RLS；service_role / secret Key 不进客户端。
- EXPO_PUBLIC_* 不是秘密存储。高德 Web 服务 Key 放服务端，经鉴权代理请求 POI。
- 原生高德 Key 按包名 / 签名约束并由构建配置注入，不能与 Web 服务 Key 混用。
- 使用平台当前支持的 CLI，不记录令牌，不把登录信息写进 HANDOFF。
- 账号 / 项目“已配置”以实际工具结果为准，授权不等于已完成。

## 7. 任务交接

任务卡含目标、依赖、分支、写入范围、验收、非目标、回报位置。
阅读必要上下文不受文件白名单限制；合理联动由主控修订任务卡授权。
不因超过三个文件、新增依赖或修改 Schema 重复求人工批准。
下一 Agent 从 AGENTS / HANDOFF 读取状态，简述下一步后直接执行已授权工作。