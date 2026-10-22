# T07 可用账号与真实Supabase环境调查

- 阶段 / 分支 / 基准：正式研发基础设施；codex/chore-service-readiness；ad00493；隔离worktree D:/yanke-service-readiness。
- 依赖 / 并行：与T05应用实现并行，禁止切换或改写主目录分支、依赖和源码。
- 目标：核实已有Supabase / Expo会话、CLI和本地容器能力；在既有授权内尽量准备真实测试Supabase与迁移验证。
- 写入范围：本worktree的必要supabase配置（不改现有迁移）、scripts/integration/verify-supabase.mjs及必要说明、docs/tasks/day1/T07-service-readiness.result.md。集成脚本用原生fetch / Node，显式配置才可重放，不因缺凭据跳过就声称CI通过。临时工具安装用OS临时目录；主控允许在D:/yanke/.env.local安全填充已取得的客户端URL / Key，须保留已有值并先通知，真实值不得进报告或工具输出。
- 权限：依赖 / CLI / 必需环境安装、已有会话使用、新免费测试项目 / 注册登录 / 部署已授权，无需重复问许可。不能编造身份、泄露令牌或自动接受未知付费承诺；不能覆盖不明现有项目或对真实数据做破坏性操作。
- 已知线索：主控检查C:/Users/zjl13/.supabase目录及.expo/state.json存在，相关进程环境变量和D:/yanke/.env*真实配置均未发现。目录存在不能推断已登录；用CLI / 管理API最小输出验证，不打印凭据文件。
- 调查：优先已有CLI或自主npx运行；只记录账号会话是否有效、项目是否与YanKe对应、可用容器 / 原生工具链状态。若需邮箱确认 / MFA / 缺秘密，汇报已尝试、影响与用户最小动作；继续独立工作，不把常规安装交用户。
- 云端成功条件：确认新的测试目标、应用迁移、验证真实邮箱Auth和双用户RLS的可行性；测试身份不能冒用真实人，真实发信只在已授权账号 / 沙箱内，凭据留安全忽略存储。只在完成证据齐全时称云端通过。若缺可用会话，可评估已存在容器跑本地Supabase；不得用PGlite桩冒充GoTrue / PostgREST。
- 浏览器如有必要用playwright技能 / CLI；不要读取或解密无关浏览器Cookie / 密码库。缺本人交互就把所需动作留主控汇报。
- 非目标：应用业务实现、MVP发布、EAS收费构建、账号删除、为拿到凭据扫描不相关文件。
- 回报：T07-service-readiness.result.md，区分成功 / 缺口与实际命令，完整不泄密；不commit / push / 切分支，由主控集成。
