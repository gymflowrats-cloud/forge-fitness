import { Gauge, Ruler, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { Chip, ChipRow } from '../../components/Controls';
import type { Measurement, Profile } from '../../db/types';
import { movingAverage, weeklyRate } from '../../lib/calc';
import { prettyDate } from '../../lib/dates';
import { fmtNum, fmtSigned } from '../../lib/format';
import { addDays } from '../../lib/stats';
import { lUnit, toDispL, toDispW, wUnit, type Units } from '../../lib/units';
import { ChartCard, InsightCard, StatTile, TipBox, axisProps, useChartColors } from './chartTheme';
import type { StatsData } from './useStatsData';

// 7 series max = 7 categorical slots; each key owns its slot permanently (color follows the entity).
const SERIES: { key: string; label: string; get: (m: Measurement) => number | null }[] = [
  { key: 'waist', label: 'Waist', get: (m) => m.waist },
  { key: 'chest', label: 'Chest', get: (m) => m.chest },
  { key: 'hips', label: 'Hips', get: (m) => m.hips },
  { key: 'arms', label: 'Arms (avg)', get: (m) => avg(m.armL, m.armR) },
  { key: 'thighs', label: 'Thighs (avg)', get: (m) => avg(m.thighL, m.thighR) },
  { key: 'neck', label: 'Neck', get: (m) => m.neck },
  { key: 'calves', label: 'Calves', get: (m) => m.calves },
];
function avg(a: number | null, b: number | null) {
  const v = [a, b].filter((x): x is number => x != null);
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
}

export function BodyStats({ d, units, profile }: { d: StatsData; units: Units; profile?: Profile }) {
  const c = useChartColors();
  const [sel, setSel] = useState<string[]>(['waist', 'arms']);
  const W = (lb: number) => toDispW(lb, units) ?? 0;
  const ma = movingAverage(d.weights.map((w) => ({ date: w.date, value: w.weight })), 7);
  const rows = d.weights
    .map((w, i) => ({ date: w.date, raw: W(w.weight), trend: Math.round(W(ma[i]!.value) * 10) / 10 }))
    .filter((r) => r.date >= d.from);
  const goal = profile?.goalWeight != null ? W(profile.goalWeight) : null;
  const last28 = d.weights.filter((w) => w.date > addDays(d.to, -28)).map((w) => ({ date: w.date, value: w.weight }));
  const rate = weeklyRate(last28);
  const cur = d.weights[d.weights.length - 1]?.weight ?? null;
  const ratePct = rate != null && cur ? (rate / cur) * 100 : null;
  const g = profile?.goal ?? 'maintain';
  let rateNote = '';
  let rateTone: 'good' | 'bad' | 'warn' | 'neutral' = 'neutral';
  if (ratePct != null) {
    if (g === 'lose') {
      if (ratePct > -0.2) { rateNote = 'Slower than a typical fat-loss pace (0.5–1%/wk). Consider a 100–200 kcal cut.'; rateTone = 'warn'; }
      else if (ratePct < -1.2) { rateNote = 'Faster than 1%/wk — risk of muscle loss. Consider eating a bit more.'; rateTone = 'bad'; }
      else { rateNote = 'Right in the 0.5–1%/wk fat-loss sweet spot.'; rateTone = 'good'; }
    } else if (g === 'build') {
      if (ratePct < 0.1) { rateNote = 'Not gaining — add ~150–250 kcal/day to support muscle growth.'; rateTone = 'warn'; }
      else if (ratePct > 0.6) { rateNote = 'Gaining fast (>0.5%/wk) — likely adding extra fat.'; rateTone = 'warn'; }
      else { rateNote = 'A lean-gain pace (0.25–0.5%/wk). Nice.'; rateTone = 'good'; }
    } else {
      rateNote = Math.abs(ratePct) < 0.3 ? 'Stable — consistent with your goal.' : `Drifting ${ratePct > 0 ? 'up' : 'down'} — adjust intake if unintended.`;
      rateTone = Math.abs(ratePct) < 0.3 ? 'good' : 'warn';
    }
  }
  const ms = d.measurements.filter((m) => m.date >= d.from);
  const mRows = ms.map((m) => {
    const r: Record<string, number | string | null> = { date: m.date };
    for (const s of SERIES) {
      const v = s.get(m);
      r[s.key] = v == null ? null : toDispL(v, units);
    }
    r.bodyFat = m.bodyFat;
    return r;
  });
  const bfRows = mRows.filter((r) => r.bodyFat != null);
  const latestWaist = [...d.measurements].reverse().find((m) => m.waist != null)?.waist ?? null;
  const whtr = latestWaist && profile?.heightIn ? latestWaist / profile.heightIn : null;
  const firstWaist = ms.find((m) => m.waist != null)?.waist ?? null;
  const waistDelta = latestWaist != null && firstWaist != null ? latestWaist - firstWaist : null;

  if (!d.weights.length && !d.measurements.length) return <div className="card p-8 text-center text-muted">Log your weight on the Body tab to see trends here.</div>;

  const insights: { text: string; tone: 'good' | 'bad' | 'warn' | 'neutral'; icon: JSX.Element }[] = [];
  if (rate != null) insights.push({ text: `Trend ${fmtSigned(W(rate), 2)} ${wUnit(units)}/week over the last 4 weeks. ${rateNote}`, tone: rateTone, icon: rate < 0 ? <TrendingDown size={20} /> : <TrendingUp size={20} /> });
  if (waistDelta != null && Math.abs(waistDelta) >= 0.25) insights.push({ text: `Waist ${waistDelta < 0 ? 'down' : 'up'} ${fmtNum(Math.abs(toDispL(waistDelta, units)!))} ${lUnit(units)} in this range`, tone: waistDelta < 0 ? 'good' : 'warn', icon: <Ruler size={20} /> });
  if (whtr) insights.push({ text: `Waist-to-height ${whtr.toFixed(2)} — ${whtr < 0.5 ? 'in the healthy range (<0.50)' : 'above 0.50; trimming the waist lowers health risk'}`, tone: whtr < 0.5 ? 'good' : 'warn', icon: <Gauge size={20} /> });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Current" value={cur ? fmtNum(W(cur)) : '—'} sub={wUnit(units)} />
        <StatTile label="Rate / wk" value={rate != null ? fmtSigned(W(rate), 2) : '—'} sub={ratePct != null ? `${fmtSigned(ratePct, 2)}% bw` : 'need 2+ weeks'} tone={rateTone === 'good' ? 'good' : rateTone === 'bad' ? 'bad' : undefined} />
        <StatTile label="Waist / height" value={whtr ? whtr.toFixed(2) : '—'} sub={whtr ? (whtr < 0.5 ? 'healthy' : 'aim < 0.50') : 'log waist'} tone={whtr ? (whtr < 0.5 ? 'good' : 'bad') : undefined} />
      </div>

      <ChartCard title="Weight trend" sub="Dots = weigh-ins · line = 7-day average" legend={[{ label: 'Weigh-in', color: c.other }, { label: '7-day trend', color: c.primary }, ...(goal != null ? [{ label: 'Goal', color: c.good, dashed: true }] : [])]}>
        {rows.length < 2 ? (
          <div className="text-muted text-center py-8">Log at least two weigh-ins in this range.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={rows} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="date" tickFormatter={(k) => prettyDate(k, 'MMM d')} {...axisProps(c)} minTickGap={24} />
              <YAxis {...axisProps(c)} width={44} domain={[(min: number) => Math.floor(Math.min(min, goal ?? min) - 1), (max: number) => Math.ceil(Math.max(max, goal ?? max) + 1)]} />
              <Tooltip cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} content={({ active, payload }) => (active && payload?.length ? <TipBox title={prettyDate(String(payload[0]!.payload.date))} rows={[{ label: 'Weigh-in', value: `${payload[0]!.payload.raw} ${wUnit(units)}`, color: c.other }, { label: '7-day avg', value: `${payload[0]!.payload.trend} ${wUnit(units)}`, color: c.primary }]} /> : null)} />
              {goal != null && <ReferenceLine y={goal} stroke={c.good} strokeDasharray="5 4" strokeWidth={1.5} />}
              <Scatter dataKey="raw" fill={c.other} shape={(p: { cx?: number; cy?: number }) => <circle cx={p.cx} cy={p.cy} r={3} fill={c.other} />} isAnimationActive={false} />
              <Line type="monotone" dataKey="trend" stroke={c.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: c.card, strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Measurements" sub={`${lUnit(units)} · pick up to 4`} legend={SERIES.map((s, i) => ({ s, i })).filter(({ s }) => sel.includes(s.key)).map(({ s, i }) => ({ label: s.label, color: c.cat[i]! }))}>
        <ChipRow className="mb-3">
          {SERIES.map((s) => (
            <Chip key={s.key} active={sel.includes(s.key)} onClick={() => setSel(sel.includes(s.key) ? sel.filter((x) => x !== s.key) : sel.length >= 4 ? sel : [...sel, s.key])}>
              {s.label}
            </Chip>
          ))}
        </ChipRow>
        {mRows.length < 2 ? (
          <div className="text-muted text-center py-6">Need 2+ check-ins in this range.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={mRows} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="date" tickFormatter={(k) => prettyDate(k, 'MMM d')} {...axisProps(c)} minTickGap={24} />
              <YAxis {...axisProps(c)} width={44} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v) => Math.round(v).toString()} />
              <Tooltip cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} content={({ active, payload }) => (active && payload?.length ? <TipBox title={prettyDate(String(payload[0]!.payload.date))} rows={payload.map((p) => ({ label: SERIES.find((s) => s.key === p.dataKey)?.label ?? '', value: `${fmtNum(p.value as number)} ${lUnit(units)}`, color: p.color }))} /> : null)} />
              {SERIES.map((s, i) => sel.includes(s.key) && <Line key={s.key} type="monotone" dataKey={s.key} stroke={c.cat[i]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: c.cat[i] }} connectNulls activeDot={{ r: 5, stroke: c.card, strokeWidth: 2 }} />)}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {bfRows.length >= 2 && (
        <ChartCard title="Body fat %">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={bfRows} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="date" tickFormatter={(k) => prettyDate(k, 'MMM d')} {...axisProps(c)} minTickGap={24} />
              <YAxis {...axisProps(c)} width={44} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v) => Math.round(v).toString()} />
              <Tooltip content={({ active, payload }) => (active && payload?.length ? <TipBox title={prettyDate(String(payload[0]!.payload.date))} rows={[{ label: 'Body fat', value: `${payload[0]!.value}%` }]} /> : null)} />
              <Line type="monotone" dataKey="bodyFat" stroke={c.primary} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: c.primary }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="space-y-2">
        <div className="section-label mt-2">Insights</div>
        {insights.map((i) => <InsightCard key={i.text} text={i.text} tone={i.tone} icon={i.icon} />)}
        {insights.length === 0 && <InsightCard text="Log weight a few times a week for a reliable trend." icon={<Scale size={20} />} />}
      </div>
    </div>
  );
}
