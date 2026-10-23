# T13 完整业务 Android 内测候选

- 状态：planned，等待T11客户端修复 / 独审 / CI合并；开工前记录实际main提交，不使用T09旧Auth快照替代。
- 阶段 / 分支 / 目录：Day 7；主控创建codex/build-mvp-android，复用D:/yk-native隔离worktree。切分支前确认旧分支干净、T09 APK已有独立备份。
- 依赖：T09可复现插件已合并PR #10、T10闭环PR #9、T11完整客户端；工具链、Ninja长路径修复与签名证据见T09 result。T12若发现源码缺陷需纳入最终候选或重新构建，不能以过期包声明修复已交付。
- 目标：从准确业务提交构建包含邮箱Auth、周计划、POI围栏、打卡 / 补卡 / 可选总结和统计的ARM64内测APK，并按设备条件完成运行验收。
- 写入范围：本worktree忽略的android/与构建产物、必要最小构建修复 / 回归检查及本任务result；若需源码修复先记录原因和范围，冻结后独立审查。不改旧迁移、HANDOFF、产品范围或真实签名材料，不操作Git。
- 只白名单注入Supabase客户端URL / anon或publishable，以及AMAP_ANDROID_KEY；绝不把Web服务Key、service_role、数据库 / UI测试密码放入Expo。真实Key不进命令输出 / Git / 报告；高德测试签名沿用T09已验证SHA1。
- 使用已验证工具链，实际prebuild与minify=true release。Gradle / npm / 临时缓存使用D盘、受控并行，无需重装已可用工具链；避免并行构建或未保存node_modules补丁。记录准确源提交与是否存在源码改动。
- 验收APK：文件大小 / SHA256、包名 / 版本、ARM64、v2测试签名及SHA1、非debuggable、内嵌Hermes / DEX、许可资产、ZIP CRC与最终精简权限；Web服务Key不能进入APK。副本放独立artifacts目录，不能只留会被prebuild清除的android输出。
- 当前电脑尚未检测到安卓设备，主控已询问用户是否方便连接。设备就绪后由Agent安装 / 启动，先只操作本App；登录、周网格、计划 / 围栏、权限 / 拒绝 / 前后台与真实定位等实际结果分别记录。不得伪造位置、改生产时钟或用模拟坐标冒充真实围栏。
- 无设备时仍完成构建与静态验证，交付可追溯APK，明确安装 / 原生定位 / 系统字体与键盘 / 冷热启动未测。Windows本机iOS不可用单列，不把Android证据写成双端验收。
- 回报：docs/tasks/day7/T13-mvp-android.result.md，包含产物 / 代码提交、命令与结果、设备证据或具体缺口、上游依赖审计限制。源码及产物冻结后独立审查。
- 非目标：正式签名 / 商店上架、付费EAS或账号承诺、iOS本机构建、通知或第二周功能。
