import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarCheck, Coffee, Database, Flag, LayoutList, Plus, Ruler, Settings, Target, Trophy, Utensils } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeroCard, HeroPill, HeroSplit } from '../../components/Card';
import { Chip, ChipRow, ProgressBar } from '../../components/Controls';
import { DateChips } from '../../components/DateChips';
import { ExercisePicker } from '../../components/ExercisePicker';
import { Banner, EmptyState, toast } from '../../components/Feedback';
import { Page, WelcomeHeader } from '../../components/Layout';
import { BottomSheet, ConfirmSheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { dismiss, setSetting } from '../../db/settings';
import type { Exercise, SessionExercise, Template, WorkoutSet, WorkoutSession } from '../../db/types';
import { addExtraExercise, createSession, removeSessionExercise, deleteSession, ensureScheduledSession, getSessionForDate, lastPerformance, sessionHasCompletedSets, switchTemplate } from '../../db/workouts';
import { useExerciseMap, useProfile, useSettings, useUnits, useWeightStep } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { useReminders } from '../../hooks/useReminders';
import { totalVolume } from '../../lib/calc';
import { WEEKDAYS, WEEKDAYS_SHORT, prettyDate, todayKey, weekdayOf } from '../../lib/dates';
import { fmtDuration, fmtInt } from '../../lib/format';
import { lbToKg } from '../../lib/units';
import { ExerciseCard } from './ExerciseCard';
import { FinishSheet } from './FinishSheet';
import { FocusLogger } from './FocusLogger';
import { RestTimerBar } from './RestTimerBar';
import { WearableCard } from '../../components/WearableCard';

export default function Today() {
  const nav = useNavigate();
  const profile = useProfile();
  const settings = useSettings();
  const units = useUnits();
  const step = useWeightStep();
  const exMap = useExerciseMap();
  const reminders = useReminders();
  const [date, setDate] = useState(todayKey());
  const isToday = date === todayKey();

  // Auto-load today's scheduled template
  useEffect(() => {
    if (isToday) ensureScheduledSession(date);
  }, [date, isToday]);

  const session = useLiveQuery(() => getSessionForDate(date), [date]);
  const templatesQ = useLiveQuery(() => db.templates.filter((t) => !t.archived).toArray().then((l) => l.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))), []);
  const templates: Template[] = templatesQ ?? [];
  const schedule = useLiveQuery(() => db.weekSchedule.toArray(), [], []) ?? [];
  const ses = useLiveQuery(
    () => (session ? db.sessionExercises.where('sessionId').equals(session.id).sortBy('order') : Promise.resolve([] as SessionExercise[])),
    [session?.id],
    [] as SessionExercise[],
  ) ?? [];
  const sets = useLiveQuery(
    () => (session ? db.sets.where('sessionId').equals(session.id).toArray() : Promise.resolve([] as WorkoutSet[])),
    [session?.id],
    [] as WorkoutSet[],
  ) ?? [];
  const exIdsKey = ses.map((s) => s.exerciseId).join(',');
  const lastMap = useLiveQuery(async () => {
    const m = new Map<string, WorkoutSet[]>();
    if (!session) return m;
    for (const se of ses) m.set(se.exerciseId, await lastPerformance(se.exerciseId, session.date, session.id));
    return m;
  }, [session?.id, exIdsKey, session?.date]) ?? new Map<string, WorkoutSet[]>();

  const [switchTo, setSwitchTo] = useState<{ id: string | null } | null>(null);
  const [picking, setPicking] = useState(false);
  const [pendingExtra, setPendingExtra] = useState<Exercise | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [showPickers, setShowPickers] = useState(false);
  useEffect(() => {
    setShowPickers(false);
  }, [date, session?.templateId]);

  const scheduledId = schedule.find((s) => s.weekday === weekdayOf(date))?.templateId ?? null;
  const scheduledTemplate = templates.find((t) => t.id === scheduledId);
  const activeSes = ses.filter((s) => !s.skipped);
  const activeSeIds = new Set(activeSes.map((s) => s.id));
  const plannedSets = sets.filter((s) => activeSeIds.has(s.sessionExerciseId));
  const doneSets = plannedSets.filter((s) => s.completed);
  const volume = totalVolume(sets);
  const prs = sets.filter((s) => s.isPR).length;
  const now = useNow(1000, !!session?.startedAt && session.status !== 'done');
  const elapsed = session?.startedAt ? ((session.endedAt ? Date.parse(session.endedAt) : now) - Date.parse(session.startedAt)) / 1000 : 0;

  const focusMode = settings.logView !== 'list';
  const inWorkout = !!session && !!session.startedAt && session.status !== 'done' && isToday;
  const compact = focusMode && inWorkout && !showPickers;
  const seHasOpen = (id: string) => sets.some((s) => s.sessionExerciseId === id && !s.completed);
  const focusedSe = focusId && activeSes.some((s) => s.id === focusId) && seHasOpen(focusId) ? focusId : activeSes.find((s) => seHasOpen(s.id))?.id ?? null;

  const daysFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of schedule) if (s.templateId) m.set(s.templateId, [m.get(s.templateId), WEEKDAYS_SHORT[s.weekday]].filter(Boolean).join('/'));
    return m;
  }, [schedule]);

  async function pickTemplate(id: string | null) {
    if (!session) {
      await createSession(date, id);
      return;
    }
    if (session.templateId === id && id !== null) return;
    if (await sessionHasCompletedSets(session.id)) setSwitchTo({ id });
    else await switchTemplate(session.id, id, false);
  }

  async function onPickExercise(e: Exercise) {
    setPicking(false);
    let sid = session?.id;
    if (!sid) sid = await createSession(date, null);
    const s = await db.workoutSessions.get(sid);
    if (s?.templateId) setPendingExtra(e);
    else {
      await addExtraExercise(sid, e.id, false, settings.defaultRestSec);
      toast(`Added ${e.name}`, 'success');
    }
  }

  const title = session ? `${WEEKDAYS[weekdayOf(date)]} · ${session.templateNameSnapshot}${session.templateId ? ' Day' : ''}` : scheduledTemplate ? `${WEEKDAYS[weekdayOf(date)]} · ${scheduledTemplate.name} Day` : `${WEEKDAYS[weekdayOf(date)]} · Rest Day`;
  const volDisp = fmtInt(units === 'metric' ? lbToKg(volume) : volume);

  return (
    <Page>
      <WelcomeHeader
        sub={isToday ? `Welcome back, ${profile?.name ?? ''}` : prettyDate(date, 'EEEE, MMM d')}
        name={title}
        onTitleClick={compact ? () => setShowPickers(true) : undefined}
        right={
          <div className="flex gap-2 shrink-0">
            {session && (
              <button
                aria-label={focusMode ? 'Switch to list view' : 'Switch to focus view'}
                className="h-12 w-12 rounded-full bg-card border border-line shadow-card flex items-center justify-center"
                onClick={() => setSetting('logView', focusMode ? 'list' : 'focus')}
              >
                {focusMode ? <LayoutList size={21} /> : <Target size={21} />}
              </button>
            )}
            <button aria-label="Settings" className="h-12 w-12 rounded-full bg-card border border-line shadow-card flex items-center justify-center" onClick={() => nav('/settings')}>
              <Settings size={22} />
            </button>
          </div>
        }
      />

      {compact ? null : (
      <>
      <div className="space-y-3">
        {reminders.recapReady && isToday && (
          <Banner title="Your weekly AI recap is ready" sub="Tap to see how last week went" onClick={() => nav('/coach?recap=1')} onDismiss={() => dismiss(reminders.recapKey)} />
        )}
        {reminders.checkInDue && isToday && (
          <Banner icon={<Ruler size={26} />} title="Weekly measurements due" sub="Log weight & measurements in Body" onClick={() => nav('/body?checkin=1')} onDismiss={() => dismiss(reminders.checkInKey)} />
        )}
        {reminders.backupDue && isToday && (
          <Banner icon={<Database size={24} />} title="Back up your data" sub="It's been 2+ weeks. Data lives only on this phone." onClick={() => nav('/settings/backup')} onDismiss={() => dismiss(reminders.backupKey)} />
        )}
      </div>

      <div className="mt-4 space-y-3">
        <WearableCard date={date} />
        <DateChips value={date} onChange={setDate} />
        <ChipRow>
          {templates.map((t) => (
            <Chip key={t.id} active={session?.templateId === t.id} onClick={() => pickTemplate(t.id)}>
              {t.name}
              {daysFor.get(t.id) && <span className={`text-[13px] font-medium ${session?.templateId === t.id ? 'text-white/75' : 'text-muted'}`}>· {daysFor.get(t.id)}</span>}
            </Chip>
          ))}
          <Chip active={!!session && !session.templateId} onClick={() => pickTemplate(null)}>
            Empty workout
          </Chip>
        </ChipRow>
      </div>
      </>
      )}

      {!session && templatesQ && templates.length === 0 && (
        <div className="mt-5">
          <EmptyState icon={<CalendarCheck size={30} />} title="Set up your routine" sub="Create workout templates and map them to weekdays — then today's workout loads automatically." action={<button className="btn-primary" onClick={() => nav('/settings/routines')}>Open routine builder</button>} />
        </div>
      )}

      {!session && templates.length > 0 && (
        <div className="mt-5 card p-6">
          <div className="h-14 w-14 rounded-[18px] bg-soft text-primary flex items-center justify-center"><Coffee size={28} /></div>
          <div className="text-[22px] font-extrabold mt-4">{isToday ? (scheduledTemplate ? 'Loading workout…' : 'Rest day. Recover well.') : `Nothing logged on ${prettyDate(date)}`}</div>
          <p className="text-muted mt-1">
            {isToday ? 'Muscles grow while you rest. Walk, stretch, eat your protein.' : 'Pick a workout above to log it for this day.'}
          </p>
          <div className="mt-5 space-y-2">
            <button className="btn-primary" onClick={() => pickTemplate(scheduledTemplate?.id ?? templates[0]!.id)}>
              Log {scheduledTemplate?.name ?? templates[0]!.name} anyway
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary !rounded-btn" onClick={() => nav('/body')}><Ruler size={18} /> Log weight</button>
              <button className="btn-secondary !rounded-btn" onClick={() => nav('/food')}><Utensils size={18} /> Log food</button>
            </div>
          </div>
        </div>
      )}

      {session && (
        <>
          {compact ? (
            <div className="rounded-[22px] px-5 py-3.5 text-white bg-gradient-to-br from-hero-from to-hero-to shadow-float">
              <div className="flex items-center gap-4">
                <div className="text-[28px] font-extrabold tabular leading-none">{fmtDuration(elapsed)}</div>
                <div className="flex-1 grid grid-cols-2 gap-2 text-[13px]">
                  <div><div className="text-white/65">Volume</div><div className="font-bold tabular">{volDisp} {units === 'metric' ? 'kg' : 'lb'}</div></div>
                  <div><div className="text-white/65">Sets</div><div className="font-bold tabular">{doneSets.length}/{plannedSets.length}{prs > 0 && <span className="ml-1.5">🏆{prs}</span>}</div></div>
                </div>
              </div>
              <ProgressBar light value={doneSets.length} max={plannedSets.length || 1} className="mt-3 !h-1.5" />
            </div>
          ) : (
          <HeroCard className="mt-5">
            <div className="flex items-center justify-between">
              <span className="text-[16px] text-white/75">{session.status === 'done' ? 'Completed' : session.startedAt ? 'Session time' : 'Not started'}</span>
              {prs > 0 ? <HeroPill tone="success"><Trophy size={14} /> {prs} PR{prs > 1 ? 's' : ''}</HeroPill> : session.status === 'done' && <HeroPill tone="success">✓ Done</HeroPill>}
            </div>
            <div className="text-[52px] font-extrabold tracking-tight tabular leading-tight">{fmtDuration(elapsed)}</div>
            <HeroSplit
              items={[
                { label: `Volume (${units === 'metric' ? 'kg' : 'lb'})`, value: volDisp },
                { label: 'Sets done', value: `${doneSets.length} / ${plannedSets.length}` },
              ]}
            />
            <ProgressBar light value={doneSets.length} max={plannedSets.length || 1} className="mt-4" />
          </HeroCard>
          )}

          {focusMode && ses.length > 0 ? (
            <div className="mt-3">
              <FocusLogger
                ses={ses}
                sets={sets}
                exMap={exMap}
                lastMap={lastMap}
                units={units}
                step={step}
                onAddExercise={() => setPicking(true)}
                onFinish={() => setFinishing(true)}
              />
              {doneSets.length === 0 && (
                <button className="w-full min-h-[44px] text-muted font-semibold text-sm mt-2" onClick={() => setConfirmDelete(true)}>
                  Discard this workout
                </button>
              )}
            </div>
          ) : (
          <div className="mt-3 space-y-4">
            {ses.map((se, i) => (
              <ExerciseCard
                key={se.id}
                se={se}
                exercise={exMap.get(se.exerciseId)}
                sets={sets.filter((s) => s.sessionExerciseId === se.id).sort((a, b) => a.order - b.order)}
                last={lastMap.get(se.exerciseId) ?? []}
                units={units}
                step={step}
                isFirst={i === 0}
                isLast={i === ses.length - 1}
                sessionDate={session.date}
                focused={focusedSe === se.id}
                onFocus={() => setFocusId(se.id)}
              />
            ))}
            {ses.length === 0 && (
              <EmptyState icon={<Plus size={30} />} title="Empty workout" sub="Add exercises from your library to get going." />
            )}
            <button className="btn-secondary w-full !rounded-btn min-h-[52px] border border-dashed border-line !bg-transparent" onClick={() => setPicking(true)}>
              <Plus size={20} /> Add exercise
            </button>
            <button className="btn-primary" onClick={() => setFinishing(true)}>
              <Flag size={20} /> {session.status === 'done' ? 'View / edit summary' : 'Finish Workout'}
            </button>
            {doneSets.length === 0 && (
              <button className="w-full min-h-[44px] text-muted font-semibold text-sm" onClick={() => setConfirmDelete(true)}>
                Discard this workout
              </button>
            )}
          </div>
          )}

          <FinishSheet open={finishing} onClose={() => setFinishing(false)} session={session as WorkoutSession} units={units} />
        </>
      )}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={onPickExercise}
        selected={new Set(ses.map((s) => s.exerciseId))}
        onRemove={async (e) => {
          const se = ses.find((x) => x.exerciseId === e.id);
          if (!se) return;
          if (sets.some((x) => x.sessionExerciseId === se.id && x.completed)) return toast(`${e.name} has logged sets — remove it from its ··· menu`, 'error');
          await removeSessionExercise(se.id);
          toast(`Removed ${e.name} from this workout`);
        }}
      />

      <BottomSheet open={!!pendingExtra} onClose={() => setPendingExtra(null)} title={`Add ${pendingExtra?.name ?? ''}`}>
        <div className="space-y-2">
          <button
            className="btn-primary"
            onClick={async () => {
              await addExtraExercise(session!.id, pendingExtra!.id, false, settings.defaultRestSec);
              setPendingExtra(null);
            }}
          >
            Add only today
          </button>
          <button
            className="btn-secondary w-full !rounded-btn min-h-[52px]"
            onClick={async () => {
              await addExtraExercise(session!.id, pendingExtra!.id, true, settings.defaultRestSec);
              toast(`Also added to ${session!.templateNameSnapshot}`, 'success');
              setPendingExtra(null);
            }}
          >
            Also add to the {session?.templateNameSnapshot} template
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!switchTo} onClose={() => setSwitchTo(null)} title="Switch workout?">
        <p className="text-muted mb-4">You've already logged sets in this session.</p>
        <div className="space-y-2">
          <button className="btn-primary" onClick={async () => { await switchTemplate(session!.id, switchTo!.id, true); setSwitchTo(null); }}>
            Switch and keep logged sets
          </button>
          <button className="btn-primary !bg-danger" onClick={async () => { await switchTemplate(session!.id, switchTo!.id, false); setSwitchTo(null); }}>
            Switch and discard
          </button>
          <button className="w-full min-h-[44px] font-semibold text-muted" onClick={() => setSwitchTo(null)}>Cancel</button>
        </div>
      </BottomSheet>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Discard this workout?"
        message="No sets are completed yet. This removes the session for this day."
        confirmLabel="Discard"
        danger
        onConfirm={() => session && deleteSession(session.id)}
      />
      <RestTimerBar />
    </Page>
  );
}
