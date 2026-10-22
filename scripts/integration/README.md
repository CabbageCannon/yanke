# 真实 Supabase 集成检查

`verify-supabase.mjs` 使用 Node 22+ 原生 `fetch`，不安装应用依赖、不修改迁移，也不以缺凭据跳过来伪装通过。

仅针对你已授权的独立测试项目运行。管理员 API 创建两个随机 `@example.invalid` 邮箱沙箱身份，`email_confirm: true`，**不发送邮件**；真实密码登录、刷新、JWT / PostgREST / RLS 都由 Supabase 执行。最终删除本轮创建的身份，并用服务端身份检查 profile、plan、checkin 级联清理。脚本不删除既有用户或 UI 验收账号。

在已被 Git 忽略的 `.env.integration.local` 放入以下配置，不要提交真实值：

```dotenv
YANKE_SUPABASE_URL=https://<project-ref>.supabase.co
YANKE_SUPABASE_PROJECT_REF=<project-ref>
YANKE_SUPABASE_ANON_KEY=<legacy-anon-key>
YANKE_SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
# 必须显式重复目标 ref 才允许创建测试身份。
YANKE_SUPABASE_INTEGRATION_CONFIRM=<project-ref>
```

在仓库根目录执行：

```powershell
node --env-file=.env.integration.local scripts/integration/verify-supabase.mjs
```

成功时输出 11 组检查通过、两个身份清理及级联检查通过。任一失败退出码为 1；如果清理因网络失败，也会返回失败，需管理员只处理该次沙箱身份。不要将完整请求、响应、环境文件或会话写入日志。

覆盖：真实 GoTrue 密码登录 / 用户接口 / 刷新、注册触发器、匿名拒绝、双用户表和视图隔离、列授权、计划约束、禁止客户端直接打卡 / 硬删计划、可信打卡快照 / 外键、软删后的历史统计与账号级联。

该基础脚本不验证真实收件箱的注册确认 / 重置密码邮件、App 会话恢复、原生定位、打卡 RPC 或完整 MVP。`supabase/config.toml` 是本地开发配置，不会凭其存在改变云端 Auth 设置。

## 打卡 RPC 与独立事务并发

`verify-checkin-rpcs.mjs` 针对已部署 `20261022000100` 的测试项目，复用上述明确目标 / 变更确认配置，另外要求 `YANKE_SUPABASE_DB_PASSWORD`。只通过已链接的 `supabase/.temp/pooler-url` 连接准确项目的 Supabase session pooler（5432），不能指向其他项目或 transaction pooler。先以已有 CLI 会话执行 `supabase link --project-ref <project-ref>` 并安全输入数据库密码；不要把密码放命令参数或日志。

仅为验证锁争用，在 OS 工具目录安装 MIT 许可的 `pg@8.16.3`，不加入 App 依赖。示例 PowerShell：

```powershell
$yankePgTools = Join-Path $env:TEMP 'yanke-pg-integration'
npm install --prefix $yankePgTools --no-save --no-package-lock --no-audit pg@8.16.3
node --env-file=.env.integration.local scripts/integration/verify-checkin-rpcs.mjs (Join-Path $yankePgTools 'node_modules/pg/lib/index.js')
```

脚本从官方 HTTPS 地址取得并校验固定指纹的 Supabase Root2021 CA，保持 TLS 证书验证。使用两个本轮随机沙箱的真实 GoTrue 密码会话调用四个 PostgREST RPC；写入口使用单对象 Accept（Supabase JS 可用 `.rpc(...).single()`），连续天数返回数字。验证数值参数小数 / 非有限拒绝、正常 / 迟到 / 补卡、总结保留 / 清空 / 原子失败、权限、快照与历史天数。

并发测试先用独立管理连接持有本轮某计划行锁，再并发发送四个真实 HTTP RPC。另一连接用 `pg_blocking_pids` 观察至少两个不同 PostgreSQL 后端确实等待该锁，随后释放，验证实时调用只返回同一条记录，补卡恰好一次成功、三次唯一冲突。没有观察到独立争锁就失败，不能拿客户端并行代替数据库证据。请求结果及时挂接 allSettled，网络失败也先释放锁并等待本批请求结束。

成功时输出8组、争锁后端数、两个身份删除与级联清理。只删除本轮创建身份，不触碰已有 UI 沙箱。精确时刻端点仍由本地42组检查覆盖；云测试用当前真实时刻创建合法计划，不修改服务器时钟或添加客户端时间参数，也不验证真实邮件或原生位置。
