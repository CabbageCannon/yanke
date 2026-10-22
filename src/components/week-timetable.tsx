import { TimeGrid, type TimeGridEvent } from '@symbiot.dev/react-native-timegrid';
import { addDays, format, startOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale/zh-CN';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/theme';

type Props = { toolbar?: ReactNode; notice?: string; navigation?: ReactNode; status?: ReactNode;
  weekStart?: Date; timezone?: string; events?: TimeGridEvent[]; caption?: string;
  onCreate?: (date: Date) => void; onSelect?: (id: string) => void };

export function WeekTimetable({ toolbar, notice, navigation, status, weekStart: selectedWeek,
  timezone, events, caption = '本周还没有学习计划', onCreate, onSelect }: Props) {
  const [defaultWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekStart = selectedWeek ?? defaultWeek;
  // SSR viewport width is zero; mount the grid after measuring its container.
  const [gridWidth, setGridWidth] = useState(0);
  const weekEnd = addDays(weekStart, 6);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.heading}>
        {toolbar}
        <Text accessibilityRole="header" style={styles.title}>
          本周时间表
        </Text>
        <Text style={styles.dateRange}>
          {format(weekStart, 'M月d日')} — {format(weekEnd, 'M月d日')}
        </Text>
        {navigation}
        <Text style={styles.caption}>{caption}</Text>
        {notice && <Text style={styles.caption}>{notice}</Text>}
        {status}
      </View>
      <View style={styles.grid} onLayout={({ nativeEvent }) => setGridWidth(nativeEvent.layout.width)}>
        {gridWidth > 0 && <TimeGrid
          key={weekStart.toISOString()}
          startDate={weekStart}
          timezone={timezone}
          events={events}
          onDatetimePress={onCreate ? ({ date }) => onCreate(date) : undefined}
          onEventPress={onSelect ? ({ event }) => onSelect(event.id) : undefined}
          weekStartsOn={1}
          numberOfDays={7}
          width={gridWidth}
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
        />}
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
