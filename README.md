# 研刻 YanKe

面向考研备考人的极简时间表 + 地点约束打卡工具。

- 核心界面：周网格时间表，点击空白格创建学习计划
- 每个计划可选绑定一个地点围栏，到达围栏内才能打卡
- 打卡附着于计划，完成后写一句小总结
- 统计：科目累计时长、完成率、连续打卡天数

## 技术栈
Expo (React Native) + TypeScript + Expo Router
Supabase（邮箱 Auth + Postgres）
expo-gaode-map（定位）+ 高德 Web 服务（POI 搜索）

## 本地启动
1. 复制 `.env.example` 为 `.env` 并填写
2. `npm install`
3. `npx expo start`
4. 定位功能需 development build：`npx expo run:android` 或 `npx expo run:ios`

## 文档索引
- 开发规范与协作流程：`DEVELOPMENT.md`
- 产品需求：`docs/prd.md`
- 项目计划与任务拆解：`docs/plan.md`
- 设计 token：`docs/design-tokens.md`
- 数据库结构：`docs/schema.sql`
- Qoder 每日任务卡：`docs/qoder-tasks.md`

## 第一周范围
仅交付「时间表 → 绑定地点 → 打卡 → 总结 → 统计」闭环。
社交（好友/帖子/评论）、远程推送、AI 总结、内容审核不在第一周范围。