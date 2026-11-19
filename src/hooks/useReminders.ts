import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { shiftKey, todayKey, weekStartKey, weekdayOf, daysBetween } from '../lib/dates';
import { useProfile, useSettings } from './useData';

/** Last occurrence (<= today) of the weekly check-in day. */
export function lastCheckInDate(checkInDay: number, today = todayKey()) {
  const diff = (weekdayOf(today) - checkInDay + 7) % 7;
  return shiftKey(today, -diff);
}

export function useReminders() {
  const s = useSettings();
  const p = useProfile();
  const today = todayKey();
  const checkIn = lastCheckInDate(p?.checkInDay ?? 0, today);
  const measuredSince = useLiveQuery(() => db.measurements.where('date').aboveOrEqual(shiftKey(checkIn, -1)).count(), [checkIn], 1);
  const recapCount = useLiveQuery(
    () => db.coachMessages.where('createdAt').aboveOrEqual(weekStartKey(today)).filter((m) => m.kind === 'recap').count(),
    [today],
    1,
  );
  const hasWorkouts = useLiveQuery(() => db.workoutSessions.count(), [], 0);

  const checkInKey = `checkin-${checkIn}`;
  const recapKey = `recap-${weekStartKey(today)}`;
  const backupKey = 'backup';
  const backupBase = s.lastBackupAt ?? p?.createdAt ?? null;
  const snoozed = s.dismissed[backupKey] && daysBetween(s.dismissed[backupKey]!.slice(0, 10), today) < 14;
  return {
    checkInDue: !!p && p.createdAt.slice(0, 10) < checkIn && (measuredSince ?? 1) === 0 && !s.dismissed[checkInKey],
    checkInKey,
    recapReady: !!(s.geminiKey || s.proxyUrl) && (recapCount ?? 1) === 0 && (hasWorkouts ?? 0) > 0 && !s.dismissed[recapKey],
    recapKey,
    backupDue: !!backupBase && daysBetween(backupBase.slice(0, 10), today) >= 14 && !snoozed && (hasWorkouts ?? 0) > 0,
    backupKey,
  };
}
