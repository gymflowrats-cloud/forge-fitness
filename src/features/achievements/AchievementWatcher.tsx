import { useEffect, useRef } from 'react';
import { celebrate } from '../../components/Celebrate';
import { db } from '../../db/db';
import { getSettings, setSetting } from '../../db/settings';
import { todayKey } from '../../lib/dates';
import { addDays } from '../../lib/stats';
import { useAchievements } from './useAchievements';

/** Pops a celebration the first time an achievement unlocks. Existing ones are marked seen silently on first run. */
export function AchievementWatcher() {
  const list = useAchievements();
  const busy = useRef(false);
  useEffect(() => {
    if (!list || busy.current) return;
    busy.current = true;
    (async () => {
      const s = await getSettings();
      const unlocked = list.filter((a) => a.unlocked).map((a) => a.id);
      const raw = await db.settings.get('seenAchievements');
      if (!raw) {
        await setSetting('seenAchievements', unlocked);
        return;
      }
      const seen = new Set(s.seenAchievements);
      const fresh = list.filter((a) => a.unlocked && !seen.has(a.id));
      if (!fresh.length) return;
      await setSetting('seenAchievements', [...seen, ...fresh.map((a) => a.id)]);
      // Only celebrate things earned just now; old ones (backup restore, sample data) are marked seen quietly.
      const recentFrom = addDays(todayKey(), -1);
      for (const a of fresh.filter((x) => !x.date || x.date >= recentFrom).slice(0, 2)) {
        await celebrate('achievement', a.title, a.sub);
        await new Promise((r) => setTimeout(r, 900));
      }
    })().finally(() => {
      busy.current = false;
    });
  }, [list]);
  return null;
}
