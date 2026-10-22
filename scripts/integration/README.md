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

它不验证真实收件箱的注册确认 / 重置密码邮件，不验证 App 的会话恢复、原生定位、打卡 RPC 或完整 MVP。`supabase/config.toml` 是本地开发配置，不会凭其存在改变云端 Auth 设置。
