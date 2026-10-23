# T10 打卡 / 补卡 / 完成与统计客户端：实现回报

- 日期：2026-10-22实现，2026-10-23接力核对与收尾。
- 状态：**源码冻结，自测完成，交独立审查**。主控负责Git同步、提交、PR与CI；本任务没有切分支、操作index或远程。
- 分支 / 基准：codex/feat-study-loop-ui，45ff7f2。保留主控的HANDOFF / decisions改动，不改旧迁移、PRD、高德模块或秘密。
- 接力边界：原实现作者在上下文中断前已报告写入闭环验证。本次接力作者读取现有源码、重跑下列命令、重新生产导出并完成定向真实浏览器验收；没有修改实现源码。前作者报告和本次实际重跑在下文分别标明。

## 交付

| 文件 | 行为 |
| --- | --- |
| src/study/study-domain.ts | 补卡整数1–1440校验；总结按Unicode字符计数；同集合加权完成率、科目含0聚合；明确错误文案 |
| src/study/study-data.ts | 本人计划与打卡读回；三个写RPC精确参数和single复合对象；统计按study_date过滤、稳定分页与连续天数标量RPC |
| src/study/plan-detail.tsx | 详情、实时打卡、补卡、手动完成 / 编辑总结；互斥提交、scope / 挂载 / 请求序号；写入不确定时先读回，读回亦失败则下次写前先核对；失败保留输入 |
| src/study/stats-panel.tsx | 默认本周与累计、科目分钟、完成率、连续天数；切换期间旧结果不能覆盖当前区间；加载 / 错误 / 重试 |
| src/study/study-sheet.tsx | 沿用主题的可滚动详情 / 统计弹层、键盘避让和可访问按钮 |
| src/plans/plan-data.ts、plan-domain.ts | 计划读取包含summary；编辑仍只写计划可编辑字段，不覆盖新的completed / summary / timezone |
| src/plans/plans-screen.tsx | 点块 / 列表进入详情，完成状态文字和勾选、统计入口、操作后刷新 |
| scripts/study/verify.test.mjs、package.json、CI | 8组规则 / RPC合同 / 分页 / 编辑隔离测试，CI执行test:study |
| .gitignore | 忽略output/与.playwright-cli/验收产物 |

未新增依赖或迁移。实时分钟完全采用服务器返回，不提交客户端时钟或自行估算保存值。无围栏不申请定位；有围栏计划明确提示定位尚未接入并禁用实时入口，不传伪造true。补卡不申请定位、不叠加打卡、不自动完成。无卡可完成，UI显示0分钟，不能生成打卡或增加连续天数。

总结预填现状；未改动传null保留，改动后传字符串，显式空白清空。280字仅建议，2000个Unicode字符为前置安全上限。写入失败与服务端结果不确定均保留当前输入；先读回真实状态再提供重试，避免把网络错误伪报为未保存或叠加分钟。

## 本次实际执行（2026-10-23）

| 命令 / 检查 | 结果 |
| --- | --- |
| npm run test:study | 8 / 8通过，0失败 / skipped |
| npm run test:plans | 8 / 8通过，0失败 / skipped |
| npm run typecheck | 通过 |
| npm run lint | 通过，无lint错误 / 警告 |
| npx expo install --check | Dependencies are up to date |
| npx expo export --platform web --output-dir output/t10-web-final --max-workers 2 | 当前冻结源码导出通过，5个Web bundle、3条静态路由 |
| git diff --check | 通过 |

Node内建测试提示仓库未声明type的ESM推断警告，Expo导出有NO_COLOR / FORCE_COLOR环境提示；均不影响退出码。没有为消除工具提示改模块类型或依赖。旧output/t10-web-export早于源码最后修改，最终证据以本次output/t10-web-final为准。

真实浏览器采用Playwright CLI / Chromium，静态HTTP预览最终生产导出，既有已确认沙箱身份登录。凭据只从忽略文件读取，未输出 / 提交；没有创建新云身份或修改本轮云测试数据。

- 从列表打开已完成的数学计划，真实读回“正常打卡 · 60分钟”，保持“✓ 已完成”。
- 本周真实统计195分钟，已完成3 / 全部6个计划，完成率50%；累计225分钟。320px时文档scrollWidth=320，无横向溢出；390px详情与320px统计可滚动操作。
- 重载保留当前登录；随后把两个真实统计view响应留待处理，关闭统计并退出账号，确认登录页出现，再释放两个响应。两个响应均已实际返回，旧统计没有回填；再次重载仍为登录页。
- 上述最终包流程pageerror数组为空。静态Python预览缺favicon导致资源404，浏览器有密码输入不在form内的提示，均非应用运行时异常。
- 第一次延迟响应自动化脚本在回包未完成前移除route，触发“Route is already handled”；修正为等两个响应完成后移除route再重跑通过。这是验收脚本错误，没有改产品代码绕过。

最终包截图（本地忽略产物，可由主控 / 审查查看）：

- output/playwright/t10/resume-normal-390.png：正常60分钟且已完成。
- output/playwright/t10/resume-week-390.png：本周195分钟、3 / 6。
- output/playwright/t10/resume-all-320.png：累计225分钟、各科目明细。
- output/playwright/t10/resume-signedout-320.png：延迟旧会话响应之后，重载仍退出。

接力作者已实际查看390详情和320累计截图，布局无截断 / 横向溢出；其他截图由同一最终包脚本生成。可重放脚本output/playwright/t10/resume-check.js使用现有沙箱数据和上述标题，不作为提交到CI的凭据依赖测试。

## 前作者已报告的写入验收（2026-10-22，本次不冒充重跑）

前作者在主控可追溯子任务消息中报告：

- 正常打卡返回60分钟，双击仅一次RPC；打卡后需手动完成。
- 结束后补90分钟，重复补卡返回23505，没有叠加；总结保留 / 修改 / 空白清空。
- 无卡直接完成，0条打卡 / 0分钟。
- 真实写入成功但中断响应，读回唯一45分钟记录。
- 本周195分钟 / 累计225分钟、完成3 / 6；跨周软删保留30分钟历史。
- 保存旧编辑草稿不覆盖另一次完成状态 / 新总结；统计旧周延迟响应不覆盖累计。
- 离线保留输入、320 / 390和放大字体操作检查通过。

本轮核对到以下原截图仍在output/playwright/t10/：realtime-completed-390.png、makeup-summary-cleared-390.png、offline-draft-320.png、stats-week-390.png、stats-cumulative-320.png、stats-cumulative-history-390.png、detail-large-font-320.png、detail-large-font-top-320.png。它们是前作者证据，不能单凭截图证明全部请求次数或并发语义。本次重新读回的正常分钟、完成状态和总统计与前报告一致；精确时间端点 / 真并发引用T08后端及云验收，未改云时钟或生产RPC。

## 保留数据、限制与下一步

既有UI沙箱仍保留6个本周非删除计划以及历史软删记录；用于后续高德 / 原生联调。未擅自清理先前阶段数据。浏览器最终已退出，临时预览和浏览器收尾后停止；.env内容与生成产物不提交。

未验证：Android / iOS设备操作、系统字体缩放 / 原生键盘、真实高德位置判断、邮件送达、真实设备启动耗时；Web验收不能替代这些。由于T11尚未接UI，有围栏实时打卡仍暂不可用。实时late与精确端点的可信计算沿用已验证T08，本次不重复完整Auth / 数据库套件。

建议提交：`feat(study): add check-in completion and study statistics`。本任务未部署新函数或迁移；直接revert本阶段客户端变更可回到仅计划CRUD。独立审查通过后由主控更新HANDOFF、同步main并执行PR / CI集成。
