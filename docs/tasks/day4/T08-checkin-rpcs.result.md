# T08 打卡 / 补卡 / 完成与连续天数 RPC 回报

- 状态：本地实现和 PostgreSQL 语义自测完成，接口与代码冻结，待独立审查 / 主控集成。
- 日期：2026-10-22；分支：`codex/feat-checkin-rpcs`；基准：`ad00493`；worktree：`D:/yanke-checkin-rpcs`。
- 未修改旧迁移、应用、依赖、主目录分支 / index、T07 配置或云端业务；未 commit / push。

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

## 云端 / 并发边界与下一步

- T07 已在 `yanke-dev`（Tokyo，PG17.11）部署基础迁移，并通过11组真实 GoTrue / JWT / PostgREST / RLS 检查；那不等于 T08 RPC 已部署或验证。
- 本轮遵照主控要求**没有**部署新迁移，没有用云端测试身份改写业务，也没有清理 T05 / T06 UI 沙箱。
- PGlite auth.users / auth.uid / 平台角色是桩，规则执行是实际 PostgreSQL。快速请求因 PGlite 单连接排队，只证明重放 / 唯一结果，不能替代两个独立事务争锁的验收。
- 独立 SQL 审查并集成后，由主控在同一免费测试项目部署新迁移，再验真实 JWT / PostgREST 四 RPC、参数解析、小数拒绝与跨连接并发。不要为端点测试给云端生产函数加客户端时间参数。
- 未含 App 页面、POI代理、原生定位 / 安装包 / 真机验证；不能称完整 MVP。

建议提交：`feat(checkin): add trusted check-in completion and streak RPCs`。
