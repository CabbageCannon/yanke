# T00 修订自主授权与跨 Agent 工作规范

- 阶段：Day 0；分支：codex/docs-autonomous-workflow；基准：c656224。
- 依赖：用户 2026-10-21 最新授权；无并行写入。
- 目标：先统一规范并提交 GitHub，再正式初始化 Expo。
- 文档实现者：主控 PM；这是规范任务，不是业务代码任务。
- 可修改：AGENTS.md、README.md、DEVELOPMENT.md、HANDOFF.md、docs/agent-workflow.md、docs/plan.md、docs/tasks.md、docs/prd.md、docs/decisions.md、.github/pull_request_template.md。
- 关联配置范围：.gitignore、.env.example、.github/workflows/ci.yml。只解决保密和尚无 lockfile 的规范阶段检查，不初始化应用。
- 保留用户删除 docs/new-agent-instruction.md 的意图及 docs/tasks/.gitkeep。
- 禁止写入：业务代码、package.json 依赖、app.config.ts 原生配置、真实 .env、schema.sql。
- 验收：无重复人工审批；新分支 / 子任务 / 独立审查 / 阶段 HANDOFF 仍有效；引用真实路径；尊重用户修改；不得伪称运行或云部署成功。
- 检查：git diff --check，扫描旧门禁与失效路径；独立审查当前 diff 与关联上下文。
- 非目标：Expo 实现、最终业务规则与数据库迁移、真实账号 / 部署。
- 回报：T00-workflow-alignment.result.md；审查：T00-workflow-alignment.review.md。
