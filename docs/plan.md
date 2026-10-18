# 项目计划书 v0.1 — 研刻 YanKe

## 目标
7 天内 1 人完成可安装内测包，跑通核心闭环；第二周迭代社交与推送。
上线定义：第一周产出 Android APK 与 iOS 开发包/TestFlight，不追求商店正式上架。

## 技术栈
- 客户端：Expo + TypeScript + Expo Router
- 定位：expo-gaode-map（development build 验证）
- 时间表：主选 `@symbiot.dev/react-native-timegrid`，Day1 验证；不可用则降级 `react-native-calendar-timetable`，再不行自绘网格
- 后端：Supabase（亚洲节点：日本/韩国/新加坡），邮箱 Auth
- 选点：高德 Web 服务 API（封装于 src/lib/amap.ts）
- 通知：expo-notifications（本地）

## 职责边界
- expo-gaode-map：客户端定位
- 高德 Web API：POI 搜索 / 地理编码
- 围栏判断：客户端 Haversine 计算，不依赖服务端
- 高德 MCP：仅作为开发期辅助工具，不进入运行时依赖

## 七天任务

### Day 1 — 骨架 + 定位可行性 + 静态时间表
- 初始化 Expo + TS + Expo Router
- 配置 Supabase，邮箱登录页跑通
- 安装 expo-gaode-map，development build 跑通“获取当前经纬度”
- 验证 timegrid 组件可用性，渲染 8:00–23:00 周网格，今日高亮，空白格可点击
- 交付：可登录、可看到网格、可打印点击时间

### Day 2 — 计划 CRUD + 网格渲染
- 计划创建/编辑/删除底部面板
- 写 Supabase plans；计划块按科目色渲染
- 重复：仅本次 / 每周同天；复制到其他天
- 交付：计划能落格、能持久化

### Day 3 — 选点 + 围栏绑定
- 计划编辑页加绑定开关；选点页高德 POI 搜索 + 地图点选兜底
- 半径滑块 50–1000m 默认 200
- 保存 geofence_* 字段；详情显示地点与半径
- 交付：计划可绑定地点

### Day 4 — 打卡闭环
- 计划详情打卡按钮；获取定位，Haversine 计算距离
- ≤半径且时间窗口内允许打卡；写 checkins，判定 normal/late
- 围栏外提示；补卡入口（结束后 7 天内手填时长与总结）
- 交付：打卡可写入、类型正确

### Day 5 — 完成总结 + 统计
- 完成并写总结底部面板；status=completed；色块变暗打勾
- 顺延到明天；原计划 missed
- 统计页：科目累计、完成率、连续打卡天数（按 PRD 3.6 规则）
- 交付：统计数字正确

### Day 6 — 打磨 + 异常
- 空状态、加载态、定位失败提示、计划重叠错位
- 视觉对齐 design-tokens
- 若 timegrid 支持拖拽则做长按调整；否则用编辑时间替代，不阻塞上线
- 本地通知：开始前 10 分钟、打卡截止前
- 交付：可演示完整流程

### Day 7 — 构建 + 最小后台 + 验收
- EAS Build 出 Android APK；iOS 开发包/TestFlight
- Supabase Studio 建统计视图
- 逐条跑 PRD 验收标准
- 交付：内测包 + 验收记录

## 第二周 backlog
好友请求/列表、好友可见帖子（文字+照片，Storage）、评论、举报/拉黑、远程推送与站内消息、极简 Web 后台、复杂重复、跨天计划、内容审核基础、隐私政策/用户协议/注销/位置权限说明。

## 风险
| 风险 | 应对 |
|---|---|
| expo-gaode-map 与 Expo SDK 不兼容 | Day1 验证，失败换 react-native-amap-geolocation |
| timegrid 依赖不可用 | Day1 验证，降级备选或自绘 |
| 一周做不完拖拽/复杂重复 | 拖拽降级编辑时间；重复只做两档 |
| Supabase 国内延迟 | 亚洲节点；MVP 可接受；后续可自部署 |
| iOS 上架周期 | 第一周只出开发包/TestFlight |
| 合规 | 第一周不做社交；第二周发帖必须加举报/拉黑 |