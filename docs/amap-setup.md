# 高德 Key 配置

本机配置入口为仓库根目录 `.env.amap.local`。这是已被 Git 忽略的本地文件，不会出现在 GitHub；切换电脑或新 Agent 接手时先检查文件是否存在，缺失时由 Agent 建立空模板。不要将真实值写入文档、聊天或提交。

| 本地配置项 | 高德控制台服务平台 | 用途 |
|---|---|---|
| `AMAP_WEB_SERVICE_KEY` | Web服务 | 服务端 POI 搜索 |
| `AMAP_ANDROID_KEY` | Android平台 | Android 单次前台定位 |

Android 内测配置：

- 包名：`com.yanke.app`。
- 测试签名 SHA1：`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`。
- 该签名用于当前内部测试，正式发布或换签名时须重新核对 Key 的签名限制。

在文件中各自等号后填写对应 Key，保存后告知主控“已配置”即可。高德账号本人登录、邮箱或手机验证由用户完成；依赖、CLI、注入配置和部署继续由 Agent 负责。

`.env.amap.local` 这一自定义名称不会被 Expo 自动加载。构建进程只能单独注入 Android / iOS 原生 Key；Web 服务 Key 只上传到 Supabase Edge secrets，由鉴权 POI 代理使用，不得进入 `EXPO_PUBLIC_*`、客户端配置或客户端包。不要将整个文件上传到云端或复制成 Expo 客户端环境文件。

配置存在不代表真实服务可用。Agent 应分别记录已部署代理搜索、安装包编译和设备前台定位的证据；缺设备时保留定位未验证。完整任务与接口见 `docs/tasks/day3/T11-amap-geofence.md`。
