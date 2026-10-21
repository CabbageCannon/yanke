import { TimeGrid } from '@symbiot.dev/react-native-timegrid';
import { addDays, format, startOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale/zh-CN';
import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

export function WeekTimetable() {
  const [weekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const { width } = useWindowDimensions();
  const weekEnd = addDays(weekStart, 6);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          本周时间表
        </Text>
        <Text style={styles.dateRange}>
          {format(weekStart, 'M月d日')} — {format(weekEnd, 'M月d日')}
        </Text>
        <Text style={styles.caption}>本周还没有学习计划</Text>
      </View>
      <View style={styles.grid}>
        <TimeGrid
          startDate={weekStart}
          weekStartsOn={1}
          numberOfDays={7}
          width={width}
          timeFrom={8 * 60}
          timeTo={23 * 60}
          timeInterval={30}
          timeStep={30}
          locale={zhCN}
          dayHeaderTextFormat={'EEEEEE\nd'}
          timelineTextFormat="HH:mm"
          dayHeaderHeight={56}
          timelineWidth={44}
          draggable={false}
          swipeable={false}
          isAllDayEventsEnabled={false}
          isAllDayEventsVisible={false}
          isNowIndicatorVisible
          theme={{
            scheme: 'light',
            backgroundColor: theme.colors.card,
            dayHeaderBackgroundColor: theme.colors.background,
            dayHeaderTextColor: theme.colors.primary,
            headerSafeAreaBackgroundColor: theme.colors.background,
            timelineBackgroundColor: theme.colors.card,
            timelineTextColor: theme.colors.secondaryText,
            verticalLineColor: theme.colors.border,
            horizontalLineColor: theme.colors.border,
            nowIndicatorColor: theme.colors.primary,
            eventBackgroundColor: theme.subjects.other,
            eventTextColor: theme.colors.text,
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  heading: { padding: theme.spacing.page, gap: theme.spacing.block },
  title: {
    fontSize: theme.fontSize.title,
    fontWeight: '600',
    color: theme.colors.text,
  },
  dateRange: {
    fontSize: theme.fontSize.body,
    color: theme.colors.primary,
    fontVariant: ['tabular-nums'],
  },
  caption: { fontSize: theme.fontSize.caption, color: theme.colors.secondaryText },
  grid: { flex: 1, backgroundColor: theme.colors.card },
});
