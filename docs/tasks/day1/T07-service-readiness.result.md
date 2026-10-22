# T07 服务就绪回报

- 状态：已完成真实 Supabase 测试环境与基础迁移验收；实现冻结，待独立审查及主控集成。
- 日期：2026-10-22；分支：`codex/chore-service-readiness`；基准：`ad00493`。
- 工作目录：`D:/yanke-service-readiness`。未切换或修改主目录分支 / index，未 commit / push。

## 已交付

- 使用已有有效 Supabase CLI 会话，准备专属免费测试项目 `yanke-dev`，Tokyo / `ap-northeast-1`，项目 ref `jhaxdxokcszbbkbvagtl`。组织 free 方案已由上个执行上下文核实；本次接续再次查询项目为 `ACTIVE_HEALTHY`，没有重复建项目或付费升级。
- 基础迁移 `20261021000100` 已在该项目执行。接续后用 `migration list --linked` 核实本地 / 远程相同，`db push --dry-run --linked` 返回 `upToDate=true`、空待执行列表。没有改写任何既有迁移；远程 PostgreSQL 17.11.0.003。
- 精简 `supabase/config.toml` 和 CLI 生成的 `supabase/.gitignore`：本地 API、PG17、邮箱 Auth 与确认邮件、本地测试邮箱服务；关闭手机号注册 / 匿名登录、Realtime / Storage / Studio / Analytics / Edge Runtime。这是本地配置，未用 config push 覆盖云端设置。
- `scripts/integration/verify-supabase.mjs`：Node 原生 fetch，无应用依赖。要求明确环境配置、准确项目 URL / ref 和重复 ref 的变更确认值才执行；创建本轮沙箱、真实登录、验证并清理；缺配置直接失败，不假装 CI 通过。
- `scripts/integration/README.md`：配置合同、重放命令、真实覆盖与局限。

## 实际验证

- `npx --yes supabase@latest --version`：2.121.0。
- `npx --yes supabase@latest projects list --output json`：仅筛选目标项目输出名称 / ref / region / status；`ACTIVE_HEALTHY`。
- `npx --yes supabase@latest migration list --linked`：`20261021000100` local / remote 都存在。
- `npx --yes supabase@latest db push --dry-run --linked`：两次均 up to date；本次不需重复部署迁移。
- 原生 fetch `/auth/v1/health`：200；`/auth/v1/settings`：邮箱启用、手机禁用、允许注册、mailer_autoconfirm=false。未打印 Key 或完整响应。
- 显式设置 `YANKE_SUPABASE_INTEGRATION_CONFIRM` 后运行：`node --env-file=.env.service-readiness.local scripts/integration/verify-supabase.mjs`，退出 0，11 组通过：
  1. 真实 GoTrue 密码登录、`/user` 和 refresh token。
  2. 管理员创建已确认邮箱身份后的 profile 触发器，两个用户读取隔离。
  3. anon 无权读取三表与两个统计视图。
  4. 本人昵称更新、created_at 列权限、他人 profile 更新隔离。
  5. 双用户计划创建 / 查询、伪造归属插入拒绝。
  6. 本人编辑、归属 / 冻结时区列权限、他人计划更新隔离。
  7. 实际 Postgres 拒绝不足 15 分钟 / 跨日时间、残缺围栏。
  8. 客户端直接插入 checkin、硬删除 plan 被拒绝。
  9. 可信 service_role 打卡写入快照与同用户复合外键。
  10. checkin 与两个 security_invoker 视图通过 JWT 隔离用户。
  11. 软删计划保留打卡分钟，完成率分母归零且比例为 null。
- 脚本 finally 删除本轮两个随机沙箱 Auth 身份，并逐个检查 profiles / plans / checkins 不再有该用户数据；退出 0、无清理失败。最后只调整摘要输出为明确的已清理计数，没有改检查逻辑。
- `node --check scripts/integration/verify-supabase.mjs`、`git diff --check` 通过。
- `git check-ignore` 确认服务配置、主目录客户端配置与 UI 沙箱凭据文件均被忽略。

## 秘密与 UI 验收交接

- 在事先通知主控后，仅向主目录 `.env.local` 填充缺失或空的 `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`，保留已有非空值。未注入 service_role 或数据库密码；未输出实际值。
- 服务端 / CLI 配置留在本 worktree 被忽略的 `.env.service-readiness.local`。字段为 `YANKE_SUPABASE_DB_PASSWORD`、`YANKE_SUPABASE_PROJECT_REF`、`YANKE_SUPABASE_URL`、`YANKE_SUPABASE_ANON_KEY`、`YANKE_SUPABASE_SERVICE_ROLE_KEY`；不进入 Git、回报或客户端。
- 为 T05 / T06 留一个管理员已确认的 UI 沙箱身份，不发送邮件。凭据只在 `D:/yanke/.env.ui-sandbox.local`，字段为 `YANKE_UI_TEST_EMAIL` / `YANKE_UI_TEST_PASSWORD` / `YANKE_UI_TEST_USER_ID`。已通知主控与 T05 只安全读取，不输出值；此身份不由集成脚本清理，保留供应用验收。

## 未测项与限制

- 本次使用管理员创建已确认沙箱后执行真实邮箱密码 Auth，**没有**对真实收件箱调用注册确认邮件、重置密码邮件或验证 SMTP 送达。云端仍要求邮箱确认，不是全局关闭确认来绕过测试。
- App 会话持久化 / 退出 / UI 错误由 T05 验证，计划 CRUD UI 由 T06 验证；本结果不能替代它们。
- Expo CLI 未登录；本机 Docker Desktop 已尝试自主启动但 IPC engine.sock 故障。云项目可用后未扩大本地 Docker 排错。
- 没有部署 MVP、打卡 / 完成 RPC、高德代理或原生安装包，没有真机定位证据。

建议提交：`chore(supabase): prepare cloud sandbox and real integration checks`。
