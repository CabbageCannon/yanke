# 数据库与打卡 RPC（T02 / T07 / T08）

两条迁移已部署专属免费测试项目 `yanke-dev`（Tokyo，PostgreSQL 17.11）：T07 的真实 GoTrue / JWT / PostgREST / 双用户 RLS 共11组通过；T08 独立 SQL 审查及本地42组通过后，追加 RPC 迁移，真实四 RPC / 独立事务争锁共8组通过。客户端仍不能直接写 `checkins`。规则见PRD v0.4 / ADR-014；数据库能力不代表 App、定位或完整 MVP 已验收。

## 来源与迁移

- `supabase/migrations/` 是唯一迁移来源，按文件名顺序执行。已在真实环境执行的迁移不可改写，后续变更新增迁移。
- `docs/schema.sql` 是现有迁移 SQL 按文件名排序、以一个换行连接的副本，供阅读，不是第二个编辑入口。
- 新增迁移时重新拼接副本；`scripts/db/verify.mjs` 会检查一致性并在新建的临时数据库重放全部迁移。
- 初始迁移依赖 Supabase 提供的 `auth.users`、`auth.uid()`、`anon` / `authenticated` / `service_role`，使用 PostgreSQL 15+ 的 `security_invoker` 视图。本地验证替换这些平台对象，不模拟完整 Supabase。
- 初始迁移 `20261021000100` 与追加迁移 `20261022000100` 已在真实项目执行。T07 / T08 分别核实 migration list 与 dry-run up-to-date；两个阶段均用本轮新建并清理的身份进行真实服务验证，详见对应回报及 `scripts/integration/README.md`。
- 真实注册邮件送达与App会话由对应任务另测；云验证重放入口见scripts/integration/README.md。

## 表与客户端合同

| 对象 | 行为 |
|---|---|
| `profiles` | 注册写入 `auth.users` 后，安全限定 search_path 的触发器创建 `id`；不重复保存 Auth 邮箱。昵称可空，非空时不能全为空格，最多 50 字符。本人可读及修改昵称，不能自行建档或删档。 |
| `plans` | 本人可读、创建、编辑和软删。科目仅数学 / 英语 / 政治 / 专业课 / 其他；标题可空，非空时不能全为空格，最多 100 字符。`status` 为 pending / completed / missed / deleted；总结可空，最多 2000 个 PostgreSQL 字符（PRD 的280字为建议），可以不填而直接完成。 |
| `checkins` | 每计划最多一条，`(plan_id, user_id)` 复合外键保证同用户关联。本人只读，客户端不能插入、修改或删除。`type` 为 normal / late / makeup；分钟数为非负 integer。 |

计划 `start_at` / `end_at` 是非空、有限的 `timestamptz`，结束至少晚于开始 15 分钟，且在所存时区是同一自然日、本地时间满足 `08:00 ≤ start < end ≤ 23:00`。恰好次日 00:00 也算跨日，不能保存。重叠不受约束，允许保存。

`timezone` 创建时取设备 IANA 时区并冻结，缺省 `Asia/Shanghai`。客户端创建时应显式传设备时区；数据库拒绝未知名称及数值偏移，不把设备本地业务规则改为固定中国时区。支持 `America/New_York` 等有夏令时的区域和 `UTC`；客户端无修改 `id` / `user_id` / `created_at` / `timezone` 的列权限。创建时可自带 UUID，也可使用默认 UUID。

围栏关闭时名称、中心、半径全部为 `null`；开启时必须同时提供非空名称（最多 120 字符）、纬度 [-90, 90]、经度 [-180, 180] 和整数半径 [50, 1000] 米。调用方开启围栏时选择默认 200 米，数据库不会为关闭的围栏留下半径。中心坐标使用 **GCJ-02**；数据库只能验证范围，坐标来源仍需高德集成验证。不保存实际用户位置或轨迹。

打卡写入触发器从同一用户的计划复制 `subject`、`plan_start_at`、`plan_end_at`、`plan_timezone`，并生成保存原本地学习日的 `study_date`。后续编辑计划不会改变这些快照；打卡行也不能修改快照或归属。T08 可信 RPC 先锁定计划、校验业务规则后写入 `checkins`，不接受客户端的实时权威时间或时长。补卡输入使用 numeric，在转换为 integer 前拒绝小数、NaN、无穷与范围外值。

客户端删除计划用 `update plans set status = 'deleted' ...`，查询时间表过滤该状态；`DELETE` 权限和策略都没有授予，历史打卡保留。删除 `auth.users` 账号则通过外键级联清除本人 profile、plans、checkins；客户端注销账号仍需未来可信服务端入口。不要用硬删计划实现客户端删除。

`authenticated` 仅获得明确的表 / 列 grants 及本人 RLS 策略；`anon` 无数据访问权。两个 trigger helper 不允许客户端直接执行。`service_role` 是可信服务端边界，可绕过 RLS 和执行受信写入，严禁进入客户端。

## 统计合同

两个视图都使用 `security_invoker = true`，通过调用者对底层表的权限和 RLS 读取本人行：

- `v_user_daily_stats`：按 `user_id, study_date` 返回 `plan_count`、`completed_plan_count`、`completion_rate`、`checkin_count`、`total_minutes`。计划数来自该本地日的全部非删除计划，包括未来计划；完成数仅计 `completed`。分钟数来自独立打卡快照，软删计划不移除分钟数。只有历史打卡、没有非删除计划的日期，计划数为 0、完成率为 `null`。
- `v_user_daily_subject_stats`：按 `user_id, study_date, subject` 返回打卡数与累计分钟。补卡按原计划学习日统计，不按 `checked_at` 的提交日。

按周 / 月用 `study_date` 过滤区间再聚合；区间完成率为 `sum(completed_plan_count) / sum(plan_count)`，分母为零显示无计划，不能平均每日完成率。修改计划日期或科目会改变计划分母的归属，但已打卡分钟和科目仍属于原快照。

`get_checkin_streak` 从本人 `checkins` 的去重 `study_date` 计算连续天数。normal / late / makeup 均有效，结束前不足一分钟产生的0分钟记录也计打卡日；手动完成而无打卡不增加天数。观察日当天无卡可从昨天起算；如果最新打卡早于昨天则为0。观察日以后的日期不参与，补卡属于原学习日，可补齐历史连续日期；软删计划不移除历史打卡日。

## RPC 合同（T08）

四个入口均 `security definer`、固定空 `search_path`，只向 `authenticated` 显式授予 execute，并再次拒绝 `auth.uid()` 为空。调用者不能指定用户 ID。写入口按本人非删除计划执行 `FOR UPDATE`，与并发计划编辑、删除和其他打卡 / 完成动作串行。

| 函数 / 参数 | 返回 | 行为 |
|---|---|---|
| `check_in_plan(p_plan_id uuid, p_geofence_verified boolean = false)` | 单个 `checkins` 复合对象 | 在获得计划锁后取服务器 `clock_timestamp()`；`[start−15分钟,start]` 为 normal，取计划分钟向下取整；`(start,end)` 为 late，取剩余分钟向下取整，可为0。其他时刻拒绝。有围栏仅接受明确 true，无围栏不依赖定位；不接收或存储实际位置。打卡不改变完成状态。 |
| `makeup_plan(p_plan_id uuid, p_duration_minutes numeric, p_summary text = null)` | 单个 `checkins` 复合对象 | 服务器时刻位于 `[end,end+168小时]` 才可，含两端；分钟必须为1–1440整数，不按计划时长截断。写入 makeup 与可选总结为同一事务，不自动完成。 |
| `complete_plan(p_plan_id uuid, p_summary text = null)` | 单个 `plans` 复合对象 | 设为 completed，并原子处理总结；不要求已有打卡、不生成打卡或虚构分钟。允许再次保存完成状态 / 总结。 |
| `get_checkin_streak(p_today date)` | integer | 调用者传设备展示时区的观察日期，只影响统计观察日；必须非空、有限，不授予时间写入权。按上节口径计算本人连续天数。 |

Supabase 客户端通过 `.rpc('函数名', { p_plan_id: id, ... })` 使用上述准确参数名，写函数可追加 `.single()` 获取单对象，连续天数返回数字；不能传用户 ID、服务器时间、实时分钟数。补卡 numeric 接受 JSON 数字，非法小数不会被 integer 参数隐式四舍五入。

总结统一规则：省略 / null 表示保留原总结；空字符串或纯空白明确清空为 SQL null；有内容去首尾空白后覆盖。修剪包括空格、制表 / 换行、不换行空格、全角空格等 ECMAScript trim 空白。2000字符按修剪后的内容检查，超限拒绝整个动作，不保留半条补卡或半完成状态。

实时请求重放会返回已有的 normal / late / makeup 原记录，即使原窗口已关闭，也不会重新计算、改写时长或生成第二条；本人计划被软删后仍拒绝该入口。补卡遇到任何已有记录均返回唯一冲突。计划行锁在检查和写入期间保持，唯一约束提供最终兜底；并发失败必须按失败处理，不能虚报成功。

错误码：`42501` 未认证 / 无函数权限；`P0002` 本人非删除计划不存在（与他人计划相同响应）；`22023` 窗口、围栏、分钟、总结或观察日无效；`23505` 补卡重复冲突。错误不包含他人数据或凭据。原生围栏 true 为已接受的自律边界，不能作为服务端实际验证定位或防作弊证据。

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

测试桩只提供 `auth.users(id)`、基于 session setting 的 `auth.uid()` 及三个角色，并故意先为客户端角色模拟宽松默认 grants，以检查迁移是否撤销访问。表约束、触发器、复合外键、角色 grants、RLS、安全视图和 RPC 由实际 PostgreSQL 引擎执行。

当前42组检查包含旧24组和新增18组 RPC 边界。先用未经修改的迁移验证生产函数签名、授权、锁和真实服务器时刻；之后仅在一次性测试数据库替换两处时钟调用，精确覆盖开始前15分钟 / 开始 / 迟到1分钟 / 结束 / 0分钟、补卡168小时两端 / 超期 / 小数 / 重复、空总结、权限、快照与连续日期。测试时钟 schema 只存在于脚本创建的临时 DB，不在迁移中，不提供客户端传时间的生产入口。

PGlite 单连接执行快速重复调用并验证唯一结果，不能证明两个独立事务的真实锁等待行为；本地脚本不验证 GoTrue、PostgREST、真实 JWT、云权限或网络。

T08 另以真实测试项目执行8组 JWT / PostgREST RPC 检查。独立管理连接持计划行锁，另一连接通过 pg_blocking_pids 观察实时请求至少2个、补卡请求4个不同后端争锁，释放后分别得到单条原记录重放、一次成功加三次唯一冲突；两个临时身份最终删除并检查级联。生产函数未加测试时钟，TLS 使用官方固定指纹 CA 且保持证书验证。云端时间端点不人为伪造，精确边界证据仍来自本地测试。T07 的基础11组与 T08 云8组详见各自回报，重放命令见 `scripts/integration/README.md`。
