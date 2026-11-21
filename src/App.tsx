import { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/Feedback';
import { TabBar } from './components/Layout';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import { initDb } from './db/init';
import { getSettings } from './db/settings';
import { useSettings } from './hooks/useData';
import { setTheme } from './lib/theme';
import { autoSync } from './services/googleHealth';
const Onboarding = lazy(() => import('./features/onboarding/Onboarding'));
import Today from './features/today/Today';
import Food from './features/food/Food';
import Body from './features/body/Body';
const Stats = lazy(() => import('./features/stats/Stats'));
const Coach = lazy(() => import('./features/coach/Coach'));
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
  const isOnboarded = live ?? onboarded;
  useEffect(() => {
    setTheme(settings.theme);
  }, [settings.theme]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  // Pull fresh Fitbit data on open and whenever the app comes back to the foreground.
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
        <Route path="/settings/reset" element={<ResetData />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
      </Suspense>
      {!hideTabs && <TabBar />}
      <Toaster />
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
