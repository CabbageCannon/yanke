import { WeekTimetable } from '@/components/week-timetable';
import { AccountMenu } from '@/auth/auth-gate';

export default function WeekScreen() {
  return <WeekTimetable toolbar={<AccountMenu />} />;
}
