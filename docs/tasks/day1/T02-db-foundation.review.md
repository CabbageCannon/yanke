# T02 独立代码审查

- 日期：2026-10-21；目录：D:/yanke-db-foundation；分支：codex/chore-db-foundation；基准：b1bb007。
- 结论：**通过**。未发现本任务基础 Schema 范围内的阻塞或非阻塞问题，可由主控提交集成。
- 范围：任务卡 / 回报、database 说明、初始迁移与 schema 副本、验证脚本，以及相关开发 / 产品规则。

本次把旧草案替换为可重放的数据库基础：Auth 建档、本人计划、可信打卡写入、历史快照和安全统计视图。最终打卡 / 补卡 / 完成 RPC 与连续天数尚未交付，待决产品规则没有提前落地。

## 正确性与权限

- `auth.users` 插入通过限定空 search_path 的 security definer 触发器创建 profile；客户端无自行建档 / 删档权限。账号删除逐级清除本人三表数据，另一用户保留。
- profiles / plans / checkins 均启用 RLS，authenticated 的身份来自 auth.uid()，有 USING / WITH CHECK 和明确表 / 列 grants。归属、时区、创建时间不可由客户端改写；无身份的 authenticated 看不到数据，anon 无读取权。
- 显式撤回模拟平台默认宽权限，再授最少权限。authenticated 的 checkins 仅可读，没有插入 / 更新 / 删除或硬删计划权限；service_role 保留可信服务端写入边界。
- `(plan_id, user_id)` 复合外键限制同用户关联，plan_id 唯一限制单计划单打卡；验证额外关闭快照触发器，单独证明复合 FK 本身拒绝跨用户关联。
- 两个统计视图均为 security_invoker，底层本人 RLS 实际生效；未借视图 owner 权限暴露另一用户数据。
- 打卡插入覆盖调用方快照值，从关联本人计划复制科目 / 时间 / 时区并生成学习日；更新禁止改写这些快照。计划编辑和软删除保留原日期 / 科目及历史分钟。
- 计划软删只改状态；完成率分子分母取同一非删除集合，包含未来计划，零分母为 null。时长单独按打卡快照聚合，补卡归原学习日，跨日期移动计划不搬移历史时长。
- 时间约束覆盖有限时刻、至少15分钟、记录时区同日、08:00与23:00端点；支持有效 IANA 时区并拒绝未知名称 / 数值偏移。围栏可选，关闭时字段全空，启用时名称 / 范围 / 整数半径完整；没有实际定位或轨迹字段。

## 实际重放与检查

复用系统临时目录已有的 PGlite 依赖，没有安装或修改应用依赖。实际执行：

```powershell
node scripts/db/verify.mjs (Join-Path $env:TEMP 'yanke-db-validation/node_modules/@electric-sql/pglite/dist/index.js')
node --check scripts/db/verify.mjs
git diff --check
Get-FileHash -Algorithm SHA256 supabase/migrations/20261021000100_foundation.sql,docs/schema.sql
```

- 引擎输出 PostgreSQL 18.6 / PGlite 0.5.10；24组检查全部通过，脚本退出码0。
- 覆盖双用户读写隔离、匿名 / 无身份、列权限、直接打卡写入拒绝、独立复合 FK、重复打卡、非法时间 / 围栏 / 文本 / 枚举 / 分钟数、IANA 与网格端点、安全视图、未来计划、补卡日期、编辑快照、软删与账号级联。
- `node --check`、`git diff --check` 通过；仅本机 LF→CRLF 提醒。
- 迁移与 docs/schema.sql 的 SHA256 完全一致；相关新增文件和 Schema 均未发现行尾空格。
- 阅读并追踪了迁移完整191行及验证脚本完整252行，没有把测试数量代替权限和数据流审查。

## 测试桩与未测边界

- 每次检查独立创建内存库，只用 `auth.users(id)`、session setting 的 auth.uid() 和平台角色桩；表约束、触发器、FK、grants、RLS 与视图由 PostgreSQL 引擎执行。
- 桩不覆盖 GoTrue、真实 JWT 注入、PostgREST 列权限行为、Supabase 托管角色默认值、云端 PG 版本、迁移部署或账号注销服务入口。PG18本地通过不能替代目标 PG15+ 云环境验证；database 和 result 已明确说明。
- 当前允许计划基础 status / summary CRUD，不把它当作总结必填或完成状态流已验收；可信 RPC 仍需按最终产品规则补身份 / 所有权、锁定计划、服务器时刻与输入校验。
- 未重放外部数据库、未接触云端或真实用户数据；本迁移仅面向新库，已部署旧库须先核实并采用增量迁移。

审查 Agent 仅新增本报告，未修改实现、切分支、提交或推送。
