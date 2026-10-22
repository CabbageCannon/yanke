# T05 邮箱账号与会话

- 阶段 / 分支 / 基准：正式研发，Day 1补齐；codex/feat-auth-plans；ad00493。
- 依赖 / 并行：已有Expo骨架与基础迁移；云环境调查T07独立执行，不因暂缺Key停止本任务。
- 目标：Supabase官方客户端、邮箱密码注册 / 登录 / 退出、持久会话与安全的页面访问边界；未配置时仍可打开骨架。
- 写入范围：app/、src/、package.json / lock、必要测试与配置、.github/workflows/ci.yml、.env.example、docs/tasks/day1/T05-email-auth.result.md。CI需实际运行新增纯逻辑Auth测试，不以缺云凭据跳过代替通过。合理联动先告知主控。不改HANDOFF / PRD / 历史报告 / 迁移，不操作Git index或远程。
- 必要依赖权限：自主安装Supabase官方JS客户端、Expo适配持久存储 / URL polyfill及确有必要的检查依赖，按Expo兼容版本；不用全局状态框架，不更新已固定timegrid。
- 业务要求：邮箱密码，邮箱确认时明确提示，不能伪造已登录；登录失败 / 网络错误 / 恢复会话失败可重试；退出 / 切账号清理本人数据并阻断旧请求回填；监听AppState刷新需正确清理。没有会话不得请求个人计划。
- 配置要求：只读客户端URL与publishable / anon Key，绝不客户端用service_role；不打印秘密。支持现有EXPO_PUBLIC_SUPABASE_ANON_KEY，可增加publishable Key名称；真实配置不进Git。T07管理真实.env.local，本任务不得覆盖。
- 视觉：沿用深墨绿、低饱和主题；短标签、合理触控目标、密码输入保护、键盘 / 窄屏可操作，不在面向用户的界面堆环境变量或实现术语。
- 验收：lint / typecheck / Expo依赖匹配、无Key的Web静态渲染、必要Auth边界验证；有真实服务再测注册 / 登录 / 恢复 / 退出，缺配置标待测，不用mock声称真实Auth通过。为T06提供清晰且最小的client / session复用入口。
- 非目标：计划CRUD、POI / 定位、打卡、完整统计、密码重置 / 注销等额外功能；不宣称完整Day 1云端验收。
- 回报：同目录T05-email-auth.result.md，列文件、实际命令、通过 / 失败、未测、接口入口、依赖用途与建议Conventional Commit。完成即冻结，等待独立审查。
