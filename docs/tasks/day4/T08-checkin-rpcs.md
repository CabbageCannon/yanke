# T08 打卡 / 补卡 / 完成与连续天数RPC

- 阶段 / 分支 / 基准：Day 4 / 5服务端；2026-10-22开工，codex/feat-checkin-rpcs，隔离worktree D:/yanke-checkin-rpcs，基准ad00493；T07已冻结并已部署基础迁移。
- 依赖 / 并行：PRD v0.4 / ADR-014、基础迁移；与客户端Auth / 计划CRUD可在隔离worktree并行，SQL接口先通知主控后冻结。
- 目标：后续追加迁移，交付客户端可调用的本人实时打卡、七天补卡、手动完成（可选总结）、连续打卡天数查询；不改旧迁移。
- 写入范围：新增supabase/migrations迁移、同步docs/schema.sql、scripts/db/必要验证、docs/database.md及本任务result；不改应用、依赖或HANDOFF。新增配置 / 脚本联动先告知主控，不操作Git。
- 最小接口候选：check_in_plan(plan_id, geofence_verified=false)、makeup_plan(plan_id, duration_minutes, summary=null)、complete_plan(plan_id, summary=null)、get_checkin_streak(today)。实际参数名 / 返回类型由实现先提供给主控，保持最小，不能接受客户端权威服务器时间或实时分钟数。
- 实时：服务器时刻t，start−15分钟≤t≤start为normal取计划分钟；start<t<end为late取end−t的分钟向下取整，无宽限，其他时刻拒绝。仅本人非删除计划，唯一checkin且不自动完成。无围栏不要求定位；有围栏需客户端一次前台判断的明确通过值，不接收 / 存实际位置。本版接受客户端自律边界，不加防作弊。
- 补卡：仅本人非删除且未打卡计划；end≤t≤end+168小时，整数1–1440分钟（转换前拒绝小数、NaN / 无限等），可选总结。不能叠加已有normal / late / makeup；原学习日 / 科目快照不变。补卡与手动完成是两个动作，不暗中改成自动完成。
- 完成：未打卡也可手动完成，时长0且不伪造打卡；总结留空 / 仅空白允许，有内容去首尾空白，完成状态与内容原子保存。文本上限沿用DB安全上限并与客户端合同写清；不引入AI生成文本。
- 权限 / 并发：auth.uid()身份与所有权检查，固定search_path、显式execute grants，匿名无权，直接checkins写仍禁止。写入锁定同一计划，重复请求不生成第二条或改写原时长；回放 / 冲突行为明确。不要为了测试暴露可由客户端传时间的生产入口。
- 连续天数：按本人有效checkins.study_date去重，今日无卡可从昨天起算，补卡归原日，未来日期不参与；today由客户端以展示时区的日期传入，只控制统计观察日，不授予他人数据访问。
- 验收：重放现有24组基础检查，新增开始前15分 / 开始 / 迟到1分 / 结束 / 0分、补卡两端与超期 / 小数 / 重复、空总结完成、跨用户 / 匿名 / 删除、历史快照和连续日期边界。实际PostgreSQL语义，明确Auth桩与真实服务不同；真实测试项目可用时再做JWT / PostgREST调用，先确认只部署本项目的新迁移。
- 非目标：POI代理、原生定位、UI、轨迹、防作弊或社交；不因函数存在宣称完整MVP通过。
- 回报：docs/tasks/day4/T08-checkin-rpcs.result.md，含接口合同、迁移 / 验证命令、真实通过与未测、部署目标和建议提交；完成冻结供独立审查。

## 审查后云验收扩展（2026-10-22）

- 迁移238da0f已由独立上下文审查通过并同步main 5f6e465。只允许向已有yanke-dev（ref jhaxdxokcszbbkbvagtl）追加20261022000100；先核对migration list / dry-run，禁止重建基础库或覆盖云Auth配置。
- 服务端凭据只从忽略的.env.integration.local安全读入，禁止打印值、写入客户端或Git。T05 / T06 UI沙箱不得删除。
- 实现可新增scripts/integration/verify-checkin-rpcs.mjs、更新README和本任务result；临时数据库客户端依赖只装D盘工具目录，不加入App依赖。主控负责HANDOFF及Git，不擅自切主目录分支。
- 用本轮新建并最终清理的两个临时身份，验证真实JWT / PostgREST四RPC、匿名 / 越权、补卡小数拒绝 / 重复、无卡完成、总结保留 / 清空、原学习日 / streak及软删历史。用独立连接或明确争锁手段验证同计划并发实时重放 / 补卡冲突，不能把单连接排队当并发通过。
- 真实时刻仅测当下可成立窗口，不修改已审查函数添加测试时钟。时间端点继续引用本地42组；云测试失败应保留错误证据并修最小原因，涉及业务SQL修改须再独立审查。
- 部署后核对migration list与dry-run，并报告准确云版本、通过组数、清理结果和未测项。新脚本冻结后交独立审查，不自行提交 / 推送。
