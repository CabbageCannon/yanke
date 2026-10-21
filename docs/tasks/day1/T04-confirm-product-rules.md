# T04 同步用户确认的打卡与总结规则

- 阶段 / 分支 / 基准：Day 1补充，codex/docs-checkin-rules，991b1bb。
- 依赖与可并行性：用户已回复两项澄清；主控改文档，独立审查串行。
- 目标：将无迟到宽限、总结可选写成当前产品合同，解除旧待答状态。
- 写入范围：AGENTS.md、README.md、HANDOFF.md、docs/prd.md、architecture.md、database.md、tasks.md、decisions.md及本任务卡 / result / review。
- 禁止写入：应用代码、依赖、迁移、历史任务result / review；不将规则确认写成业务已实现。
- 权限：主控直接维护文档，沿用Git提交推送和检查后合并授权，无新依赖或云配置。
- 验收：精确记录normal与late端点、无宽限；正常完成及补卡总结可选；当前规格无旧待答，历史证据保留且有当前规则入口。
- 验证：git diff --check、文档引用与跨文件规则核对；独立审查；不重复应用 / 数据库本地测试。
- 非目标：实现RPC / 页面、修改七天范围或宣称云端 / 原生通过。
- 回报：同目录T04-confirm-product-rules.result.md及.review.md。
