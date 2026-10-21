# T02 Supabase 数据库基础与本地验证

- 阶段：Day 1 数据层；分支 codex/chore-db-foundation；基准 b1bb007；隔离 worktree D:/yanke-db-foundation。
- 依赖：Day 0 规范已合并。与 Expo T01 物理隔离，不共享 npm / Git index。
- 目标：替换不安全旧 schema 草案，形成可复用的初始迁移、RLS 和真实 PostgreSQL 语义的本地验证证据。
- 可写：docs/schema.sql、supabase/**、scripts 或 tests 中仅数据库相关的新文件、docs/tasks/day1/T02-db-foundation.result.md、必要的数据库说明 docs/database.md。
- 禁止写：package.json / lockfile、应用和 Expo 配置、AGENTS / DEVELOPMENT / HANDOFF / README / PRD / decisions / architecture、真实 env、其他任务文件。
- 依赖权限：为本地检查可在 OS 临时目录安装临时依赖（例如 PGlite，它运行真实 PG 引擎），不要为了 SQL 检查改应用依赖。若本机有可用 PostgreSQL / Docker 可复用，不要破坏已有实例。
- 数据模型：profiles 由 auth.users 注册触发创建；plans 属于本人；checkins 独立表但必须关联同一 user_id 的计划，每计划最多一条；计划客户端删除为软删除，保留历史打卡。账号删除级联清除本人数据。
- 约束：时间非空且结束晚于开始、最短15分钟、不跨计划记录的 IANA 时区自然日；科目 / 标题长度，status / checkin type 枚举，时长非负整数；围栏可选但启用时名称、GCJ-02 中心、50–1000m半径齐全。只保存围栏中心，不保存实际用户位置或轨迹。
- 2026-10-21 澄清：固定可见网格为08:00–23:00，计划在自身记录时区内必须满足08:00≤start<end≤23:00，加入越界测试；完成率分子分母必须来自同一非删除集合，删除同时排除两者。
- 权限：所有本人表 RLS 与显式 grants；checkins 同用户复合外键；统计 view 使用 security_invoker，不能绕 RLS。客户端不能直接任意写入打卡时长，先预留服务端 RPC 写路径，基础阶段禁止 authenticated 直接写 checkins。
- 产品待决不实现：normal / late 的最终边界、总结是否必填仍在等用户澄清，故不要落最终打卡 / 完成 RPC，也不能声称完整业务后端已完成。
- 完成率口径保持旧需求 completed / 全部非删除计划，含同一统计区间未来计划；累计分钟来自有效 checkins，补卡归属原计划学习日。连续天数可只写设计说明留后续 RPC，不要造伪完成。
- 校验：SQL 能在真实 PG 语义环境执行；用 auth/users/role stub 的自包含测试验证两个不同用户隔离、不同用户关联被拒、同计划重复被拒、非法围栏/时间被拒、统计 view 不泄露、软删保留打卡和账号级联。清楚区分测试 stub 与 Supabase 真实云环境。
- 记录数据库迁移如何成为唯一来源，docs/schema.sql 如何保持一致；不要执行真实云部署或填入秘密。
- 不提交、不 push、不切分支。完成写 result 并通知主控，主控审查后在此 worktree 提交再集成。
- 非目标：最终业务 RPC、云项目、反作弊、轨迹、重复计划、通知、Auth UI。
