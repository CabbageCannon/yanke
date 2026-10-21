# T02 数据库基础实现回报

- 状态：`self_tested`，本任务基础范围完成，等待主控独立审查；不是完整业务后端。
- 工作区：`D:/yanke-db-foundation`；分支 `codex/chore-db-foundation`；基准 `b1bb007`。
- 未切分支、未提交 / push、未部署云端，未修改应用 package.json / lockfile 或主控文档。

## 交付文件

| 文件 | 内容 |
|---|---|
| `supabase/migrations/20261021000100_foundation.sql` | 唯一来源的初始迁移：三表、注册触发器、约束、复合外键、RLS、显式 grants、打卡快照和两个 security_invoker 视图。 |
| `docs/schema.sql` | 初始迁移完整副本，替换未经验证的旧草案；重放脚本检查一致性。 |
| `scripts/db/verify.mjs` | 新建内存 PostgreSQL 实例并重放迁移，24 组 assert 验证；失败返回非零退出码。 |
| `docs/database.md` | 数据访问与时区 / 围栏 / 统计合同、迁移来源、重放步骤、测试桩与云端验证边界。 |
| 本文件 | 证据、未测项和集成说明。 |

## 行为与约束

- Auth 注册触发创建 profile；账号删除级联清除本人三表数据。profile 不重复保存邮箱。
- 计划限五个固定科目，标题 / 昵称 / 围栏名称有长度及非空白约束；状态和打卡类型有限集合；总结暂可空。
- 时间为有限 UTC timestamptz，创建时记录并冻结设备 IANA 时区，最短 15 分钟、同一本地自然日，并满足主控补充的 `08:00 ≤ start < end ≤ 23:00`。支持 IANA 夏令时区域，默认 Asia/Shanghai 不替代设备时区输入。
- 围栏关闭要求所有中心字段为空，开启要求名称、GCJ-02 中心及 50–1000 米整数半径齐全；不保存实际用户定位或轨迹。
- 客户端不能硬删计划、改变归属或时区；只能以 deleted 状态软删。本人数据由 RLS 隔离，匿名不可读；客户端 checkins 只读，不能伪造时长。
- 复合外键保证 checkin 与 plan 同用户，每计划最多一条打卡。可信写入触发器复制计划科目、时间、时区，生成原学习日快照，并禁止修改快照。计划编辑或软删不影响历史分钟和科目归属。
- 每日统计的完成数和计划数使用同一非删除计划集合，包含未来计划，分母为零时完成率 null；打卡分钟独立聚合，补卡归原计划学习日。两个视图均由调用者权限及 RLS 执行。

## 实际验证

平台：Windows PowerShell、Node 24.21.0、npm 11.19.0。Docker 可执行文件存在，但服务管道未运行，未启动或修改已有 Docker 环境。采用系统临时目录的 `@electric-sql/pglite@0.5.10`（Apache-2.0），不进入应用依赖。

执行命令（仓库根目录）：

```powershell
$validationDir = Join-Path $env:TEMP 'yanke-db-validation'
New-Item -ItemType Directory -Path $validationDir -Force | Out-Null
npm install --prefix $validationDir --no-save --no-package-lock @electric-sql/pglite@0.5.10
node scripts/db/verify.mjs (Join-Path $validationDir 'node_modules/@electric-sql/pglite/dist/index.js')
node --check scripts/db/verify.mjs
git diff --check
```

- 安装成功；引擎输出 `PostgreSQL 18.6 (PGlite 0.5.10) on wasm32-unknown-emscripten`。
- 迁移重放与 schema 副本一致性通过。
- 最终输出：`24 checks passed. Supabase Auth/API/cloud deployment were not tested.`；退出码 0。
- 覆盖双用户 profile / plans / checkins 隔离、越权写入、无身份 authenticated、anon 拒绝、列级权限、触发器 helper 无客户端执行权。
- 覆盖重复打卡、跨用户关联（另禁用快照触发器单独验证复合 FK）、非法时间 / 围栏 / 枚举 / 文本 / 分钟数、时区和夏令时区域、08:00 / 23:00 端点。
- 覆盖两个 security_invoker 视图、未来计划、补卡原学习日、编辑快照稳定、软删保留分钟且移出分子分母、零分母、账号级联且不影响另一用户。
- `node --check` 和 `git diff --check` 通过；Git 仅报告本机 LF→CRLF 提示，无 whitespace 错误。新文件也扫描了行尾空格，无匹配。

测试桩仅有 `auth.users(id)`、读取 session setting 的 `auth.uid()` 和平台角色；初始化时故意模拟过宽默认 grants，以验证迁移显式撤权。约束 / 外键 / 触发器 / RLS / grants / 视图均由 PostgreSQL 引擎真实执行。脚本每次独立建库，不依赖外部服务或秘密。

## 偏离、未测项和后续

- 没有最终实时打卡 / 补卡 / 完成 RPC；normal / late 与总结规则仍待确认，不能声称规则已经服务端校验。当前计划 status / summary 属基础 CRUD 合同，未来完成流程需随确认规则补受信入口与权限。
- 连续天数仅记录设计方向，未实现或声称已通过；不增加后台定位、轨迹、防作弊等范围。
- 未测 Supabase GoTrue 注册、真实 JWT / PostgREST、实际云 PG 版本、云部署或设备。迁移采用 PG15+ 支持的安全视图能力，本地 PG18 通过不能代替 Supabase 环境验证。
- 本次初始迁移只适用于新库；尚无已部署旧 schema 的迁移证据。如后续发现真实旧库，先核实远程状态，再写增量迁移，不直接运行覆盖。
- 建议主控独立审查通过后提交 `chore(db): add validated Supabase foundation`，再集成并更新 HANDOFF；无需用户重复批准。
