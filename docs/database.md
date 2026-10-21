# 数据库基础（T02）

当前交付是表、约束、权限、统计视图和本地验证，**没有最终打卡 / 完成业务 RPC，也未部署 Supabase**。normal / late 边界及总结必填规则等待产品确认；客户端不能写 `checkins`，因此还不能完成真实打卡闭环。

## 来源与迁移

- `supabase/migrations/` 是唯一迁移来源，按文件名顺序执行。已在真实环境执行的迁移不可改写，后续变更新增迁移。
- `docs/schema.sql` 是现有迁移 SQL 的顺序拼接副本，供阅读，不是第二个编辑入口。本次只有初始迁移，两个文件内容完全一致。
- 新增迁移时重新拼接副本；`scripts/db/verify.mjs` 会检查一致性并在新建的临时数据库重放全部迁移。
- 初始迁移依赖 Supabase 提供的 `auth.users`、`auth.uid()`、`anon` / `authenticated` / `service_role`，使用 PostgreSQL 15+ 的 `security_invoker` 视图。本地验证替换这些平台对象，不模拟完整 Supabase。
- 尚未创建云项目或执行远程迁移。真实部署后必须另测 Auth 注册触发器、PostgREST 列权限、JWT / RLS、注销账号与实际 PostgreSQL 版本。

## 表与客户端合同

| 对象 | 行为 |
|---|---|
| `profiles` | 注册写入 `auth.users` 后，安全限定 search_path 的触发器创建 `id`；不重复保存 Auth 邮箱。昵称可空，非空时不能全为空格，最多 50 字符。本人可读及修改昵称，不能自行建档或删档。 |
| `plans` | 本人可读、创建、编辑和软删。科目仅数学 / 英语 / 政治 / 专业课 / 其他；标题可空，非空时不能全为空格，最多 100 字符。`status` 为 pending / completed / missed / deleted；总结可空，最多 2000 字符，目前没有必填规则。 |
| `checkins` | 每计划最多一条，`(plan_id, user_id)` 复合外键保证同用户关联。本人只读，客户端不能插入、修改或删除。`type` 为 normal / late / makeup；分钟数为非负 integer。 |

计划 `start_at` / `end_at` 是非空、有限的 `timestamptz`，结束至少晚于开始 15 分钟，且在所存时区是同一自然日、本地时间满足 `08:00 ≤ start < end ≤ 23:00`。恰好次日 00:00 也算跨日，不能保存。重叠不受约束，允许保存。

`timezone` 创建时取设备 IANA 时区并冻结，缺省 `Asia/Shanghai`。客户端创建时应显式传设备时区；数据库拒绝未知名称及数值偏移，不把设备本地业务规则改为固定中国时区。支持 `America/New_York` 等有夏令时的区域和 `UTC`；客户端无修改 `id` / `user_id` / `created_at` / `timezone` 的列权限。创建时可自带 UUID，也可使用默认 UUID。

围栏关闭时名称、中心、半径全部为 `null`；开启时必须同时提供非空名称（最多 120 字符）、纬度 [-90, 90]、经度 [-180, 180] 和整数半径 [50, 1000] 米。调用方开启围栏时选择默认 200 米，数据库不会为关闭的围栏留下半径。中心坐标使用 **GCJ-02**；数据库只能验证范围，坐标来源仍需高德集成验证。不保存实际用户位置或轨迹。

打卡写入触发器从同一用户的计划复制 `subject`、`plan_start_at`、`plan_end_at`、`plan_timezone`，并生成保存原本地学习日的 `study_date`。后续编辑计划不会改变这些快照；打卡行也不能修改快照或归属。未来可信 RPC 应锁定计划、校验业务规则后写入 `checkins`，不要接受客户端提交的时长作为实时打卡权威值。SQL integer 存储不是 RPC 输入校验的替代，RPC 应在转换前拒绝小数。

客户端删除计划用 `update plans set status = 'deleted' ...`，查询时间表过滤该状态；`DELETE` 权限和策略都没有授予，历史打卡保留。删除 `auth.users` 账号则通过外键级联清除本人 profile、plans、checkins；客户端注销账号仍需未来可信服务端入口。不要用硬删计划实现客户端删除。

`authenticated` 仅获得明确的表 / 列 grants 及本人 RLS 策略；`anon` 无数据访问权。两个 trigger helper 不允许客户端直接执行。`service_role` 是可信服务端边界，可绕过 RLS 和执行受信写入，严禁进入客户端。

## 统计合同

两个视图都使用 `security_invoker = true`，通过调用者对底层表的权限和 RLS 读取本人行：

- `v_user_daily_stats`：按 `user_id, study_date` 返回 `plan_count`、`completed_plan_count`、`completion_rate`、`checkin_count`、`total_minutes`。计划数来自该本地日的全部非删除计划，包括未来计划；完成数仅计 `completed`。分钟数来自独立打卡快照，软删计划不移除分钟数。只有历史打卡、没有非删除计划的日期，计划数为 0、完成率为 `null`。
- `v_user_daily_subject_stats`：按 `user_id, study_date, subject` 返回打卡数与累计分钟。补卡按原计划学习日统计，不按 `checked_at` 的提交日。

按周 / 月用 `study_date` 过滤区间再聚合；区间完成率为 `sum(completed_plan_count) / sum(plan_count)`，分母为零显示无计划，不能平均每日完成率。修改计划日期或科目会改变计划分母的归属，但已打卡分钟和科目仍属于原快照。

连续天数尚未实现。后续应从本人打卡的去重 `study_date` 按确认的“截至哪天”和有效打卡口径计算，不从补卡提交日算；本次不虚构 RPC 或连续天数结果。

## 本地重放（PowerShell）

在仓库根目录运行，临时依赖不写入应用 package.json / lockfile：

```powershell
$validationDir = Join-Path $env:TEMP 'yanke-db-validation'
New-Item -ItemType Directory -Path $validationDir -Force | Out-Null
npm install --prefix $validationDir --no-save --no-package-lock @electric-sql/pglite@0.5.10
node scripts/db/verify.mjs (Join-Path $validationDir 'node_modules/@electric-sql/pglite/dist/index.js')
git diff --check
```

PGlite 0.5.10 为 Apache-2.0 许可，运行 WASM 编译的 PostgreSQL 18.6；它仅是临时验证工具，不进入 Expo / React Native 应用。验证脚本每次新建内存数据库，不接触已有数据库或云项目，失败时退出码为 1。

测试桩只提供 `auth.users(id)`、基于 session setting 的 `auth.uid()` 及三个角色，并故意先为客户端角色模拟宽松默认 grants，以检查迁移是否撤销访问。表约束、触发器、复合外键、角色 grants、RLS 和安全视图由实际 PostgreSQL 引擎执行。它不能验证 Supabase GoTrue、PostgREST、真实 JWT、云权限或网络。
