# T08 打卡 / 补卡 / 完成与连续天数 RPC 回报

- 状态：SQL / 本地42组及独立审查已通过，PR #5 已合并 main `c74e16e`；审查后追加云部署和真实8组验收完成，新增脚本 / 说明冻结待独立审查。
- 日期：2026-10-22；分支：`codex/feat-checkin-rpcs`；基准：`ad00493`；worktree：`D:/yanke-checkin-rpcs`。
- 实现阶段未修改旧迁移、应用、依赖、主目录分支 / index 或 T07 配置；SQL经主控提交 / 合并后，按扩展任务只向既有项目追加已审迁移。本人不操作 Git。

## 接口合同

已先向主控报告并确认以下准确签名：

| 函数 | 返回 |
|---|---|
| `check_in_plan(p_plan_id uuid, p_geofence_verified boolean default false)` | 单个 `checkins` 复合对象 |
| `makeup_plan(p_plan_id uuid, p_duration_minutes numeric, p_summary text default null)` | 单个 `checkins` 复合对象 |
| `complete_plan(p_plan_id uuid, p_summary text default null)` | 单个 `plans` 复合对象 |
| `get_checkin_streak(p_today date)` | integer |

- 实时打卡只用获得计划行锁后的 `clock_timestamp()`，无客户端时间 / 实时分钟参数。normal `[start−15分钟,start]` 取完整计划分钟；late `(start,end)` 取剩余分钟，均向下取整；不足一分钟可为0，无宽限。围栏启用时仅接受明确 true；无围栏不依赖定位，不收集实际位置。
- 补卡 `[end,end+168小时]` 含两端，numeric 输入在转换为 integer 前拒绝小数 / NaN / 无限 / null，范围1–1440。按原计划日期 / 科目快照，不依赖定位，不自动完成。
- 总结合同经主控确认：省略 / null 保留原总结；空串 / 纯空白明确清空为 SQL null；有内容 trim 后覆盖。覆盖 ECMAScript trim 的常用 Unicode 空白，最多2000个 PostgreSQL 字符，PRD 的280字为建议。完成状态 / 总结原子保存，补卡 / 总结原子保存。
- 未打卡也可完成，不创建虚假打卡 / 时长；可重复保存完成及总结。
- 写入口均检查 `auth.uid()` 和本人非删除计划、固定空 search_path、`security definer`、显式 execute grant，仅 authenticated 可调用。计划行 `FOR UPDATE` 串行化相关写动作，checkins 唯一约束最终兜底。
- 实时重放返回任一已存在 normal / late / makeup 的原记录，即使原窗口已关闭也不重算；补卡遇任一已有打卡明确返回 `23505`。删除计划后拒绝写入口；未知 / 他人 / 删除统一 `P0002`。未认证为 `42501`，无效参数 / 窗口为 `22023`。
- 连续天数按本人 checkins.study_date 去重，含0分钟有效卡、软删计划历史，排除观察日之后日期。今天无卡可从昨天起算；补卡填原日，未打卡完成不加天数。p_today 仅是展示时区观察日，不授予时间写入权。

## 文件

- 新迁移 `supabase/migrations/20261022000100_checkin_rpcs.sql`；原基础迁移完全不改。
- `docs/schema.sql` 按文件名顺序拼接两个迁移，用一致性断言保护。
- `scripts/db/verify-checkin-rpcs.mjs`：18组新增规则检查；接入现有 `scripts/db/verify.mjs`，现有 CI 命令会实际执行新增检查。
- `docs/database.md`：更新 T07 已部署基础迁移 / 真实11组事实，追加 RPC 参数 / 返回 / 重放 / 错误码 / 总结 / 验证边界合同，不保留过期“未部署Supabase”结论。

## 实际验证

临时工具目录原已不存在，按授权恢复 `@electric-sql/pglite@0.5.10` 到 OS 临时目录，未增加 App 依赖：

```powershell
$yankeDbTools = Join-Path $env:TEMP 'yanke-db-validation'
npm install --prefix $yankeDbTools --no-save --no-package-lock @electric-sql/pglite@0.5.10
node scripts/db/verify.mjs (Join-Path $yankeDbTools 'node_modules/@electric-sql/pglite/dist/index.js')
node --check scripts/db/verify.mjs
node --check scripts/db/verify-checkin-rpcs.mjs
git diff --check
```

全部退出0。实际引擎 PostgreSQL18.6 / PGlite0.5.10，共42组通过，原24组基础检查全部保留，新18组包括：

1. 生产函数签名、security definer / search_path / execute grants、写入口行锁及服务器时钟定义。
2. 未修改生产入口的真实服务器时刻 / 迟到记录冒烟。
3. 开始前15分钟和开始时刻均为normal。
4. 开始后1毫秒、迟到1分钟、结束前不足一分钟的 late / 向下取整 / 0分钟。
5. 窗口开启前、结束和结束后拒绝且不写。
6. 可选围栏的明确 true、false / null 拒绝，无围栏不需定位。
7. 实时重放不重写原记录 / 时间 / 时长，补卡冲突。
8. 八个快速重复请求只返回同一条记录。
9. 补卡 end 和 end+168小时、1440分钟、原学习日快照、可选总结 / 不自动完成。
10. 补卡端点外拒绝，小数 / 非有限 / 空 / 越界拒绝，最小1分钟允许。
11. 补卡总结超限完整回滚，不留打卡或覆盖旧总结。
12. 无打卡完成、空白 / Unicode trim / 上限、失败不留半状态。
13. 补卡 null 保留总结、纯空白清空，后续直接完成不丢总结。
14. 跨用户 / 未知 / 删除计划写入口拒绝。
15. anon 与无 uid 的 authenticated 对所有入口拒绝。
16. 后续编辑 / 软删保留历史科目 / 学习日。
17. 连续天数去重、0分钟、未来排除、今日 / 昨日起算、断档、空日期拒绝。
18. 补卡补齐跨周断档、手动完成不加打卡日、不同用户隔离。

精确端点测试方法：先用原封不动的生产迁移执行建库、原24组基础检查、生产入口服务器时刻验证；随后只在一次性 PGlite 数据库中将**两处** `pg_catalog.clock_timestamp()` 改为测试时钟并重建函数，再验证精确端点。脚本断言只替换两处；测试时钟 schema 不在部署迁移中，也没有对外可传 `p_now` 的生产入口。

## 审查后真实云部署与8组验收

- SQL 独立审查 / 本地42组重放通过后，主控授权在已有 `yanke-dev`（ref `jhaxdxokcszbbkbvagtl`，Tokyo）追加迁移。先 `supabase link` 到准确项目；`migration list --linked` 与 `db push --dry-run --linked` 显示只有 `20261022000100_checkin_rpcs.sql` 待执行。
- `npx --yes supabase@2.121.0 db push --linked --yes` 退出0，明确 Applying migration。部署后和恢复执行时再次 `migration list --linked` / `db push --linked --dry-run`：两条 local / remote 都存在，`upToDate=true`，没有待执行迁移。未重建基础库 / 覆盖云 Auth / 改写已审 SQL。
- 新增 `scripts/integration/verify-checkin-rpcs.mjs`，更新 `scripts/integration/README.md` 与 `docs/database.md`。原生 fetch 负责真实 GoTrue / PostgREST，MIT 许可 `pg@8.16.3` 仅装 `D:/yanke-tools/db-integration`，不增加应用依赖。
- 脚本读取已忽略的 `D:/yanke/.env.integration.local`，显式 ref 确认，只连接匹配的session pooler。初次 TLS 连接因 Supabase自签根链拒绝，未创建身份；从官方HTTPS源读取并固定指纹校验 Supabase Root2021 CA 后，保持 `rejectUnauthorized=true` 成功连接PG17.11。没有降低TLS验证。

```powershell
$env:YANKE_SUPABASE_INTEGRATION_CONFIRM = 'jhaxdxokcszbbkbvagtl'
node --env-file=D:/yanke/.env.integration.local scripts/integration/verify-checkin-rpcs.mjs D:/yanke-tools/db-integration/node_modules/pg/lib/index.js
```

实际退出0，共8组通过：

1. 真实 JWT 实时 normal、原记录重放、手动完成与总结 trim / 省略保留 / 空白清空。
2. 真实服务器时刻 late 与剩余分钟、围栏明确 true。
3. PostgREST numeric 参数拒绝小数 / 非有限 / 空 / 越界；有效补卡、原学习日、可选总结、不自动完成、重复冲突。
4. 无打卡完成不加分钟或打卡日，总结超限不留下半状态。
5. 四入口匿名拒绝、写入口跨用户 / 删除拒绝，直接 checkins 写仍被禁止。
6. 独立连接锁住本轮计划，观察 **2个**不同PG后端确实等待锁；释放后四个实时调用返回同一记录 / 时间 / 分钟。
7. 独立连接持锁，观察 **4个**不同PG后端等待；释放后补卡一次成功、三次23505，库中仅一条。
8. 补卡归原日、软删 / 编辑保留历史、今日无卡从昨天起算、补齐连续日期、不同用户隔离。

本轮两个随机 `@example.invalid` 身份由管理员确认创建，不发送邮件；finally 只删除本轮创建的Auth身份，并逐个检查 profiles / plans / checkins 级联无遗留，输出 `2/2` 清理通过。未读取输出或删除 T05 / T06 UI 沙箱，未把任何服务端值写入客户端 / Git。并发请求及时挂接 allSettled，避免网络失败在释放锁前产生未处理拒绝。

`node --check scripts/integration/verify-checkin-rpcs.mjs` 与 `git diff --check` 通过。云脚本最终只加强并发请求失败收集，没有改生产SQL或测试断言；交独立上下文审查 / 重放。

## 保留边界

- PGlite auth.users / auth.uid / 平台角色仍是桩；快速排队不等于并发。上述真实云争锁另有独立连接 / pg_blocking_pids 证据。
- 云端仅测真实当前可成立窗口，不修改服务器时钟。精确normal / late / 168小时端点仍引用本地42组，不为测试增加生产时间参数。
- 未验证真实注册确认 / 密码重置邮件送达，管理员确认的沙箱不替代邮箱收件验收。
- 未含 App 页面、POI代理、原生定位 / 安装包 / 真机验证；不能称完整 MVP。

SQL 已合并；本次云验收建议提交：`test(checkin): verify cloud RPCs and concurrent transactions`。
