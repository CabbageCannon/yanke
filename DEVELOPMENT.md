# 开发规范与 Qoder 协作流程

## 1. 分支策略
- `main` 为唯一长期分支，开启分支保护，禁止直接 push，必须走 PR
- 每日从 `main` 开分支：`feature/dayN-主题`，如 `feature/day4-checkin`
- 修复：`fix/简短描述`；杂项：`chore/`、`docs/`、`refactor/`、`test/`
- 分支生命周期不超过 2 天
- 合并方式：Squash merge，保持 main 线性

## 2. Commit Message（Conventional Commits）
格式：`<type>(<scope>): <subject>`

type：feat / fix / refactor / style / perf / docs / test / chore / build / ci
scope：timetable / plan / geofence / checkin / stats / auth / notification / ui / db / config / deps / docs

示例：
- feat(timetable): 支持点击空白格创建计划
- feat(geofence): 计划编辑页增加地点绑定与半径滑块
- fix(checkin): 修正迟到打卡时长计算
- chore(deps): 升级 expo-gaode-map

粒度要求：
- 一个 commit 只做一件逻辑完整的事，可独立运行、可独立回滚
- 单次 diff 不超过 300 行，超过就拆
- 禁止 update / fix bug / 修改 / wip
- 提交前必须通过 lint 与 typecheck

禁止提交：
- .env、密钥、Supabase service role key、高德 Key 明文
- node_modules、.expo、ios/、android/ 生成目录
- 大段调试 console.log、整块注释代码

## 3. PR 规范
- 即使单人开发也必须走 PR
- 标题同样使用 Conventional Commits
- 必须填写 `.github/pull_request_template.md`
- PR 中逐条勾选 PRD 验收标准

## 4. Qoder 任务下发模板
### Context
当前 Day N，分支 feature/dayN-xxx。
关键文件：...
数据表结构见 docs/schema.sql。

### Task
实现：<一句话目标>

### Files
- 允许修改：...
- 允许新增：...
- 禁止修改：...（如需改先说明）

### Acceptance
1. ...
2. ...

### Constraints
- 遵循本文件 commit 规范
- 不引入重型依赖，新增依赖先列理由
- 不提交 .env
- UI 遵循 docs/design-tokens.md

### Commit
建议拆分：
- feat(scope): ...
- feat(scope): ...

## 5. Qoder 硬约束
1. 不允许直接操作 main，所有改动在 feature 分支
2. 涉及 3 个以上文件或新增依赖的任务，先输出改动方案与文件清单，人工确认后执行
3. 每次任务结束必须产出可运行状态，不允许半成品过夜
4. Qoder 生成的代码必须本地跑通再 commit
5. 依赖新增需人工确认

## 6. 每日节奏
- 开始：拉最新 main，开当天分支，拆 3–5 个 Qoder 子任务
- 开发中：每完成子任务本地验证 → commit → push
- 收尾：lint/typecheck → 开 PR 自审 → Squash 合并 → 打 tag `v0.1.0-dN`
- 记录：更新 GitHub Projects 看板

## 7. CI
PR 到 main 时运行 lint 与 typecheck，见 `.github/workflows/ci.yml`。

## 8. 环境变量
- 提交 `.env.example`
- 真实 `.env` 只放本地
- 客户端仅用 Supabase anon key，service role key 永不进客户端
- EAS 密钥用 `eas secret` 管理

## 9. 回滚
- main 必须随时可运行
- 出包失败优先 revert 当天 PR，不在 main 热修
- 第一周结束产出 CHANGELOG.md