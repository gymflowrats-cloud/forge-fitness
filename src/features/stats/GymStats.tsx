import { CalendarCheck, Flame, Medal, TrendingDown, TrendingUp, Trophy, Target } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ProgressBar } from '../../components/Controls';
import { MUSCLE_LABELS } from '../../db/seedExercises';
import type { Muscle } from '../../db/types';
import { adherence, pctChange, trainingStreak, weekStreak } from '../../lib/calc';
import { prettyDate } from '../../lib/dates';
import { fmtInt, fmtNum, fmtPct } from '../../lib/format';
import { addDays, changeOver, exerciseProgress, mondayOf, perWeek, setsPerMuscle, trainedDates, volumeByDate, weeksBetween } from '../../lib/stats';
import { toDispW, wUnit, type Units } from '../../lib/units';
import { ChartCard, InsightCard, StatTile, TipBox, axisProps, useChartColors } from './chartTheme';
import type { StatsData } from './useStatsData';

const wk = (k: string) => prettyDate(k, 'MMM d');

export function GymStats({ d, units }: { d: StatsData; units: Units }) {
  const c = useChartColors();
  const W = (lb: number) => toDispW(lb, units) ?? 0;
  const inRange = (k: string) => k >= d.from && k <= d.to;
  const trained = useMemo(() => trainedDates(d.sessions, d.sets), [d]);
  const volDate = useMemo(() => volumeByDate(d.sessions, d.sets), [d]);
  const weeks = weeksBetween(d.from, d.to);
  const isScheduled = (wd: number) => !!d.schedule.find((s) => s.weekday === wd)?.templateId;
  const hasSchedule = d.schedule.some((s) => s.templateId);

  const perWk = perWeek([...trained].filter(inRange), weeks);
  const volWk = perWeek([...volDate.keys()].filter(inRange), weeks, (k) => W(volDate.get(k) ?? 0));
  const volCur = [...volDate].filter(([k]) => inRange(k)).reduce((a, [, v]) => a + v, 0);
  const volPrev = [...volDate].filter(([k]) => k >= d.prevFrom && k < d.from).reduce((a, [, v]) => a + v, 0);
  const volDelta = volPrev ? pctChange(volPrev, volCur) : null;
  const streak = trainingStreak(trained, hasSchedule ? isScheduled : () => false, d.to);
  const wStreak = weekStreak(trained, d.to);
  const firstTrained = [...trained].sort()[0];
  const adhFrom = firstTrained && firstTrained > d.from ? firstTrained : d.from;
  const adh = hasSchedule && firstTrained ? adherence(trained, isScheduled, adhFrom, d.to) : null;
  const sessionsInRange = [...trained].filter(inRange).length;

  // Exercise picker: exercises with history, highest total volume first
  const exCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of d.sets) if (s.date && inRange(s.date)) m.set(s.exerciseId, (m.get(s.exerciseId) ?? 0) + Math.max(1, (s.weight ?? 0) * (s.reps ?? 0)));
    return [...m].filter(([id]) => { const t = d.exercises.get(id)?.type; return t === 'weight_reps' || t === 'bodyweight_reps'; }).sort((a, b) => b[1] - a[1]);
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const [exId, setExId] = useState<string | null>(null);
  const selEx = exId && exCounts.some(([id]) => id === exId) ? exId : exCounts[0]?.[0] ?? null;
  const progress = selEx ? exerciseProgress(d.sets.filter((s) => s.exerciseId === selEx)).filter((p) => inRange(p.date)).map((p) => ({ ...p, bestD: W(p.best), e1rmD: Math.round(W(p.e1rm)) })) : [];
  const prList = selEx ? d.sets.filter((s) => s.exerciseId === selEx && s.isPR).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 6) : [];

  // Muscle split this week
  const thisWeek = mondayOf(d.to);
  const muscleMap = new Map([...d.exercises.values()].map((e) => [e.id, { primary: e.primaryMuscle as string, secondary: e.secondaryMuscles as string[] }]));
  const weekSets = d.sets.filter((s) => (s.date ?? '') >= thisWeek);
  const perMuscle = setsPerMuscle(weekSets, muscleMap);
  const TRACKED: Muscle[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'];
  const muscleRows = TRACKED.map((m) => ({ m, label: MUSCLE_LABELS[m], v: perMuscle[m] ?? 0 })).sort((a, b) => b.v - a.v);
  const donutRaw = muscleRows.filter((r) => r.v > 0);
  const donut = [...donutRaw.slice(0, 7), ...(donutRaw.length > 7 ? [{ m: 'other' as Muscle, label: 'Other', v: donutRaw.slice(7).reduce((a, r) => a + r.v, 0) }] : [])];
  const colorOf = (i: number, label: string) => (label === 'Other' ? c.other : c.cat[i]!);

  // Heatmap: columns = weeks (max 26), rows Mon..Sun
  const heatWeeks = weeks.slice(-26);
  const maxVol = Math.max(1, ...[...volDate.values()]);
  const heatLevel = (k: string) => {
    if (!trained.has(k)) return 0;
    const v = volDate.get(k) ?? 0;
    return v <= 0 ? 1 : Math.min(4, 1 + Math.floor((v / maxVol) * 3.999));
  };

  // Top PRs this month
  const monthStart = addDays(d.to, -30);
  const monthPRs = d.sets.filter((s) => s.isPR && (s.date ?? '') >= monthStart).sort((a, b) => (b.weight ?? 0) * (1 + (b.reps ?? 0) / 30) - (a.weight ?? 0) * (1 + (a.reps ?? 0) / 30));
  const topPRs: typeof monthPRs = [];
  for (const p of monthPRs) if (!topPRs.some((x) => x.exerciseId === p.exerciseId)) topPRs.push(p);

  // Insights
  const insights: { text: string; tone: 'good' | 'bad' | 'warn' | 'neutral'; icon: JSX.Element }[] = [];
  for (const [id] of exCounts.slice(0, 5)) {
    const pts = exerciseProgress(d.sets.filter((s) => s.exerciseId === id)).map((p) => ({ date: p.date, value: p.e1rm }));
    const ch = changeOver(pts, 28, d.to);
    if (ch != null && Math.abs(ch) >= 2) {
      insights.push({ text: `${d.exercises.get(id)?.name} est. 1RM ${ch > 0 ? 'up' : 'down'} ${Math.abs(Math.round(ch))}% in 4 weeks`, tone: ch > 0 ? 'good' : 'bad', icon: ch > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} /> });
      break;
    }
  }
  const last4 = addDays(d.to, -27);
  const legDays = new Set(d.sets.filter((s) => (s.date ?? '') >= last4 && ['quads', 'hamstrings'].includes(d.exercises.get(s.exerciseId)?.primaryMuscle ?? '')).map((s) => s.date)).size;
  if (sessionsInRange > 3 && legDays / 4 < 1.5) insights.push({ text: `Legs trained only ${fmtNum(legDays / 4, 1)}×/week lately`, tone: 'warn', icon: <Target size={20} /> });
  const under = muscleRows.filter((r) => r.v > 0 && r.v < 10).map((r) => r.label);
  if (!insights.some((i) => i.text.startsWith('Legs')) && under.length && weekSets.length) insights.push({ text: `Under 10 sets this week: ${under.slice(0, 3).join(', ')}`, tone: 'warn', icon: <Target size={20} /> });
  if (adh) insights.push({ text: `${Math.round(adh.pct)}% adherence — ${adh.hit} of ${adh.scheduled} planned days trained`, tone: adh.pct >= 80 ? 'good' : adh.pct >= 60 ? 'neutral' : 'bad', icon: <CalendarCheck size={20} /> });
  if (volDelta != null && insights.length < 3) insights.push({ text: `Total volume ${volDelta >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(volDelta))}% vs previous period`, tone: volDelta >= 0 ? 'good' : 'bad', icon: volDelta >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} /> });

  if (!d.sets.length) return <div className="card p-8 text-center text-muted">Log a workout (or load sample data in Settings → Developer) to see gym stats.</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Streak" value={<span className="inline-flex items-center gap-1"><Flame size={20} className="text-warn" />{streak}</span>} sub={hasSchedule ? 'training days' : 'days'} />
        <StatTile label="Weeks" value={wStreak} sub="in a row" />
        <StatTile label="Adherence" value={adh ? `${Math.round(adh.pct)}%` : '—'} sub={adh ? `${adh.hit}/${adh.scheduled} days` : 'set a schedule'} tone={adh ? (adh.pct >= 80 ? 'good' : adh.pct < 60 ? 'bad' : undefined) : undefined} />
      </div>

      <ChartCard title="Workouts per week" sub={`${sessionsInRange} sessions in range`}>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={perWk} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="week" tickFormatter={wk} {...axisProps(c)} minTickGap={16} />
            <YAxis allowDecimals={false} {...axisProps(c)} width={40} />
            <Tooltip cursor={{ fill: c.primarySoft }} content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={`Week of ${wk(String(payload[0].payload.week))}`} rows={[{ label: 'Workouts', value: payload[0].value as number }]} /> : null)} />
            <Bar dataKey="value" fill={c.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Consistency" sub="Each square is a day · darker = more volume">
        <div className="flex gap-[3px] overflow-x-auto no-scrollbar pb-1">
          <div className="flex flex-col gap-[3px] pr-1 text-[9px] text-muted">
            {['M', '', 'W', '', 'F', '', 'S'].map((l, i) => <div key={i} className="h-[13px] leading-[13px]">{l}</div>)}
          </div>
          {heatWeeks.map((w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, i) => {
                const k = addDays(w, i);
                const future = k > d.to;
                const lvl = heatLevel(k);
                return (
                  <div
                    key={k}
                    title={`${prettyDate(k)}${trained.has(k) ? ` · ${fmtInt(W(volDate.get(k) ?? 0))} ${wUnit(units)}` : ''}`}
                    className="h-[13px] w-[13px] rounded-[3px]"
                    style={{ background: future ? 'transparent' : c.heat[lvl] }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 justify-end mt-2 text-[11px] text-muted">
          Less {c.heat.map((h) => <span key={h} className="h-[11px] w-[11px] rounded-[3px]" style={{ background: h }} />)} More
        </div>
      </ChartCard>

      <ChartCard
        title="Weekly volume"
        sub={`${fmtInt(W(volCur))} ${wUnit(units)} in range`}
        right={volDelta != null ? <span className={`text-[13px] font-bold rounded-full px-2.5 py-1 ${volDelta >= 0 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>{fmtPct(volDelta)} vs prev</span> : undefined}
      >
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={volWk} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="week" tickFormatter={wk} {...axisProps(c)} minTickGap={16} />
            <YAxis {...axisProps(c)} width={44} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
            <Tooltip cursor={{ fill: c.primarySoft }} content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={`Week of ${wk(String(payload[0].payload.week))}`} rows={[{ label: 'Volume', value: `${fmtInt(payload[0].value as number)} ${wUnit(units)}` }]} /> : null)} />
            <Bar dataKey="value" fill={c.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Exercise progress"
        legend={[{ label: 'Best set weight', color: c.cat[0]! }, { label: 'Est. 1RM', color: c.cat[1]! }]}
        right={
          <select aria-label="Exercise" className="max-w-[170px] h-11 rounded-xl bg-track px-3 text-[16px] font-semibold outline-none" value={selEx ?? ''} onChange={(e) => setExId(e.target.value)}>
            {exCounts.map(([id]) => <option key={id} value={id}>{d.exercises.get(id)?.name}</option>)}
          </select>
        }
      >
        {progress.length < 2 ? (
          <div className="text-muted text-center py-8">Need at least 2 sessions of this exercise in range.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={progress} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="date" tickFormatter={wk} {...axisProps(c)} minTickGap={20} />
              <YAxis {...axisProps(c)} width={44} domain={['dataMin - 10', 'dataMax + 5']} tickFormatter={(v) => Math.round(v).toString()} />
              <Tooltip cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} content={({ active, payload }) => (active && payload?.length ? <TipBox title={prettyDate(String(payload[0]!.payload.date))} rows={[{ label: 'Best set', value: `${fmtNum(payload[0]!.payload.bestD)} × ${payload[0]!.payload.reps}`, color: c.cat[0] }, { label: 'Est. 1RM', value: `${payload[0]!.payload.e1rmD} ${wUnit(units)}`, color: c.cat[1] }]} /> : null)} />
              <Line type="monotone" dataKey="bestD" stroke={c.cat[0]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: c.cat[0] }} activeDot={{ r: 5, stroke: c.card, strokeWidth: 2 }} />
              <Line type="monotone" dataKey="e1rmD" stroke={c.cat[1]} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: c.card, strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
        {prList.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <div className="section-label mb-2">PR history</div>
            <div className="space-y-1.5">
              {prList.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[14px]">
                  <Trophy size={15} className="text-warn" />
                  <span className="text-muted w-20">{prettyDate(s.date!, 'MMM d')}</span>
                  <span className="font-bold tabular">{fmtNum(W(s.weight ?? 0))} {wUnit(units)} × {s.reps}</span>
                  <span className="ml-auto text-muted tabular">1RM ≈ {Math.round(W((s.weight ?? 0) * (1 + (s.reps ?? 0) / 30)))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Muscle split this week" sub="Working sets · secondary muscles count ½ · target 10–20">
        {donut.length === 0 ? (
          <div className="text-muted text-center py-6">No sets logged this week yet.</div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-[130px] h-[130px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donut} dataKey="v" nameKey="label" innerRadius={40} outerRadius={62} paddingAngle={2} stroke={c.card} strokeWidth={2} isAnimationActive={false}>
                    {donut.map((r, i) => <Cell key={r.label} fill={colorOf(i, r.label)} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={String(payload[0].name)} rows={[{ label: 'Sets', value: fmtNum(payload[0].value as number) }]} /> : null)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              {donut.map((r, i) => (
                <div key={r.label} className="flex items-center gap-2 text-[13px]">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colorOf(i, r.label) }} />
                  <span className="truncate">{r.label}</span>
                  <span className="ml-auto font-bold tabular">{fmtNum(r.v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-5 space-y-2.5">
          {muscleRows.map((r) => {
            const low = r.v < 10;
            return (
              <div key={r.m}>
                <div className="flex justify-between text-[13px] mb-1">
                  <span className={low ? 'font-semibold' : ''}>{r.label}{low && <span className="ml-1.5 text-[11px] font-bold text-warn">▲ under-trained</span>}</span>
                  <span className="tabular text-muted">{fmtNum(r.v)} / 10–20</span>
                </div>
                <ProgressBar value={r.v} max={20} tone={low ? 'warn' : r.v > 20 ? 'danger' : 'success'} className="!h-2" />
              </div>
            );
          })}
        </div>
      </ChartCard>

      {topPRs.length > 0 && (
        <div>
          <div className="section-label mb-2 mt-2">Top PRs · last 30 days</div>
          <div className="grid grid-cols-2 gap-3">
            {topPRs.slice(0, 4).map((s, i) => (
              <div key={i} className="card p-4 min-w-0">
                <div className="h-9 w-9 rounded-full bg-warn/15 text-warn flex items-center justify-center"><Medal size={18} /></div>
                <div className="text-[13px] text-muted mt-2 truncate">{d.exercises.get(s.exerciseId)?.name}</div>
                <div className="text-[19px] font-extrabold tabular">{fmtNum(W(s.weight ?? 0))} × {s.reps}</div>
                <div className="text-[12px] text-muted">{prettyDate(s.date!, 'MMM d')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="section-label mt-2">Insights</div>
        {insights.slice(0, 3).map((i) => <InsightCard key={i.text} text={i.text} tone={i.tone} icon={i.icon} />)}
        {insights.length === 0 && <div className="text-muted text-sm">Keep logging — insights appear after a couple of weeks.</div>}
      </div>
    </div>
  );
}
