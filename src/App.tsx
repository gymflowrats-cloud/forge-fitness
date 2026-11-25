import { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/Feedback';
import { CelebrationLayer } from './components/Celebrate';
import { TabBar } from './components/Layout';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import { initDb } from './db/init';
import { getSettings, justOnboarded } from './db/settings';
import { useSettings } from './hooks/useData';
import { setLook, setTheme, type Palette } from './lib/theme';
import { autoSync } from './services/googleHealth';
import { refreshRemindersOnOpen } from './services/push';
const Onboarding = lazy(() => import('./features/onboarding/Onboarding'));
import Today from './features/today/Today';
import Food from './features/food/Food';
import Body from './features/body/Body';
const Stats = lazy(() => import('./features/stats/Stats'));
const Coach = lazy(() => import('./features/coach/Coach'));
const Achievements = lazy(() => import('./features/achievements/Achievements'));
const WeeklyRecap = lazy(() => import('./features/recap/WeeklyRecap'));
const RemindersSettings = lazy(() => import('./features/settings/RemindersSettings'));
import { AchievementWatcher } from './features/achievements/AchievementWatcher';
import SettingsHome from './features/settings/SettingsHome';
import ProfileSettings from './features/settings/ProfileSettings';
import Routines from './features/settings/Routines';
const TemplateEditor = lazy(() => import('./features/settings/TemplateEditor'));
import ExerciseLibrary from './features/settings/ExerciseLibrary';
import Preferences from './features/settings/Preferences';
const AISettings = lazy(() => import('./features/settings/AISettings'));
const Backup = lazy(() => import('./features/settings/Backup'));
const Developer = lazy(() => import('./features/settings/Developer'));
const HealthSettings = lazy(() => import('./features/settings/HealthSettings'));
import ResetData from './features/settings/ResetData';

function Shell({ onboarded }: { onboarded: boolean }) {
  const loc = useLocation();
  const settings = useSettings();
  // Live flag (undefined while loading) so finishing onboarding is picked up immediately.
  const live = useLiveQuery(() => db.settings.get('onboarded').then((r) => !!r?.value), []);
  // justOnboarded() covers the gap between saving the flag and the live query noticing it.
  const isOnboarded = justOnboarded() || (live ?? onboarded);
  useEffect(() => {
    setTheme(settings.theme);
  }, [settings.theme]);
  // Undefined while loading, so the defaults never briefly override the saved look.
  const look = useLiveQuery(() => getSettings().then((x) => `${x.palette}|${x.sportyNumbers}|${x.heroTexture}`), []);
  useEffect(() => {
    if (!look) return;
    const [palette, sporty, texture] = look.split('|');
    setLook({ palette: palette as Palette, sporty: sporty === 'true', texture: texture === 'true' });
  }, [look]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  // Pull fresh Fitbit data on open and whenever the app comes back to the foreground.
  useEffect(() => {
    refreshRemindersOnOpen();
  }, []);
  useEffect(() => {
    autoSync();
    const onVis = () => document.visibilityState === 'visible' && autoSync();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  const hideTabs = loc.pathname.startsWith('/onboarding');
  if (!isOnboarded && !hideTabs) return <Navigate to="/onboarding" replace />;
  return (
    <>
      <Suspense fallback={<div className="h-full bg-bg" />}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/today" element={<Today />} />
        <Route path="/food" element={<Food />} />
        <Route path="/body" element={<Body />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/recap" element={<WeeklyRecap />} />
        <Route path="/settings" element={<SettingsHome />} />
        <Route path="/settings/profile" element={<ProfileSettings />} />
        <Route path="/settings/routines" element={<Routines />} />
        <Route path="/settings/routines/:id" element={<TemplateEditor />} />
        <Route path="/settings/exercises" element={<ExerciseLibrary />} />
        <Route path="/settings/preferences" element={<Preferences />} />
        <Route path="/settings/ai" element={<AISettings />} />
        <Route path="/settings/backup" element={<Backup />} />
        <Route path="/settings/developer" element={<Developer />} />
        <Route path="/settings/health" element={<HealthSettings />} />
        <Route path="/settings/reminders" element={<RemindersSettings />} />
        <Route path="/settings/reset" element={<ResetData />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
      </Suspense>
      {!hideTabs && <TabBar />}
      <Toaster />
      <CelebrationLayer />
      {isOnboarded && <AchievementWatcher />}
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState<null | { onboarded: boolean }>(null);
  useEffect(() => {
    (async () => {
      await initDb();
      const s = await getSettings();
      setReady({ onboarded: s.onboarded });
    })().catch((e) => {
      console.error(e);
      setReady({ onboarded: true });
    });
  }, []);
  if (!ready) return <div className="h-full bg-bg" />;
  return (
    <ErrorBoundary>
      <HashRouter>
        <Shell onboarded={ready.onboarded} />
      </HashRouter>
    </ErrorBoundary>
  );
}
