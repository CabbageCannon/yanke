# Qoder 每日任务卡

每张卡按 DEVELOPMENT.md 第 4 节模板下发。以下为每日目标与文件边界。

## Day 1
目标：Expo+TS+Router 骨架；Supabase 邮箱登录；expo-gaode-map 定位跑通；timegrid 验证并渲染静态网格。
允许新增：app/_layout.tsx, app/(auth)/login.tsx, app/(auth)/register.tsx, app/(tabs)/_layout.tsx, app/(tabs)/index.tsx, src/lib/supabase.ts, src/components/TimeGrid/*, src/constants/theme.ts, src/constants/subjects.ts
禁止修改：docs/*, DEVELOPMENT.md
验收：
1. 新用户邮箱注册登录后可进入主页
2. development build 下点击按钮能拿到当前经纬度
3. 主页渲染 7 列 × 8:00–23:00 网格，今日列头高亮
4. 点击空白格 console 打印开始/结束时间
Commit 建议：feat(auth), feat(timetable), chore(config)

## Day 2
目标：计划 CRUD + 落格渲染 + 基础重复 + 复制到其他天。
允许新增：src/components/PlanEditorSheet.tsx, src/components/PlanBlock.tsx, src/hooks/usePlans.ts, src/types/index.ts, app/plan/[id].tsx
允许修改：app/(tabs)/index.tsx, src/components/TimeGrid/index.tsx
验收：
1. 创建 9:00–11:00 数学后网格对应位置出现数学色块
2. 重启 App 后计划仍在
3. 编辑时间后色块位置更新
4. 删除后色块消失
5. 复制到其他天生成新计划
Commit 建议：feat(plan), feat(timetable)

## Day 3
目标：选点页 + 围栏绑定 + 半径滑块。
允许新增：app/geofence/pick.tsx, src/lib/amap.ts, src/hooks/useGeofence.ts, src/lib/geo.ts
允许修改：src/components/PlanEditorSheet.tsx
验收：
1. 计划编辑页开关可开启绑定
2. 搜索“图书馆”返回 POI 列表，选中回填名称与经纬度
3. 半径滑块 50–1000m 默认 200
4. 保存后详情显示地点名与半径
Commit 建议：feat(geofence), feat(ui)

## Day 4
目标：打卡闭环 + normal/late 判定 + 补卡。
允许新增：src/components/CheckinSheet.tsx, src/hooks/useCheckin.ts, src/lib/duration.ts
允许修改：app/plan/[id].tsx, src/components/PlanBlock.tsx
验收：
1. 围栏内 + 时间窗口内点击打卡写入 checkins
2. 晚于开始打卡 type=late
3. 围栏外提示未到达，不写入
4. 计划结束后 7 天内补卡可手填分钟数并写总结
Commit 建议：feat(checkin), fix(checkin)

## Day 5
目标：完成并写总结、顺延、统计页。
允许新增：src/components/SummarySheet.tsx, app/(tabs)/stats.tsx
允许修改：app/plan/[id].tsx, src/components/PlanBlock.tsx
验收：
1. 完成后色块变暗打勾，详情可见总结
2. 顺延到明天生成次日同时间计划，原计划 missed
3. 统计页科目累计时长、完成率、连续打卡天数正确（按 PRD 3.6）
Commit 建议：feat(plan), feat(stats)

## Day 6
目标：空状态、加载态、定位失败提示、重叠错位、本地通知、视觉对齐。
允许新增：src/components/EmptyState.tsx, src/lib/notifications.ts
允许修改：全局 UI 样式
验收：
1. 无计划时显示空状态文案
2. 定位失败有 Toast 提示
3. 重叠计划右移并降透明度
4. 计划开始前 10 分钟触发本地通知
Commit 建议：feat(ui), feat(notification), style(ui)

## Day 7
目标：EAS 构建、Supabase 统计视图、逐条验收。
允许新增：eas.json, docs/changelog.md
验收：
1. Android APK 可安装
2. iOS 开发包可运行
3. PRD 第 5 节 8 条全部通过并记录
Commit 建议：build(config), docs(changelog)