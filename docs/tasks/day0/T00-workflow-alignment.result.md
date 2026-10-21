# T00 回报

## 状态
规范修订完成，等待独立审查和前置 GitHub 提交。

## 实际范围
- 增加跨 Agent AGENTS 入口，重写开发规范 / SOP / HANDOFF / 总览 / 计划。
- 同步 PRD 的可选地点与范围，保留未答复的时间和总结歧义；追加 ADR。
- 清理失效 qoder-tasks 路径，保留用户旧入口删除与任务目录。
- 忽略真实环境与签名文件，移除 Web Key public 示例；PR 模板和规范阶段 CI 对齐实际状态。

## 验证
- 已执行 git diff --check：通过（只有 Windows 换行提醒）。
- 已扫描旧审批与引用：剩余相关措辞用于说明废止规则 / 历史 ADR，不是有效门禁。
- 尚无应用依赖 / 代码，应用 lint / 类型 / 原生检查不适用，没有声称已运行。

## 偏离、风险和未测
- 无业务代码实现；文档超过参考行数是整套旧规范的必要联动。
- app.config.ts 仍有旧 public Web Key 和未安装插件占位，T01 初始化时由实现子任务清理，不注入真实 Key。
- CI 无 lockfile 分支仅用于当前文档准备阶段，初始化后改为必须安装检查。
- 原 Schema 不是可部署最终迁移；产品歧义待回复。

## 建议提交
docs(workflow): align autonomous agent permissions and handoff
