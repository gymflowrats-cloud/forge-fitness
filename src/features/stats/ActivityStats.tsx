import { Footprints, HeartPulse, Moon, TrendingDown, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { prettyDate } from '../../lib/dates';
import { fmtInt } from '../../lib/format';
import { average } from '../../lib/stats';
import { ChartCard, InsightCard, StatTile, TipBox, axisProps, useChartColors } from './chartTheme';
import type { StatsData } from './useStatsData';

const hm = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`;

export function ActivityStats({ d }: { d: StatsData }) {
  const c = useChartColors();
  const nav = useNavigate();
  const rows = d.wearable.filter((w) => w.date >= d.from && w.date <= d.to);
  if (!d.wearable.length)
    return (
      <div className="card p-6 text-center">
        <HeartPulse className="mx-auto text-primary" size={30} />
        <div className="font-bold text-[17px] mt-2">Connect your Fitbit</div>
        <p className="text-muted text-[14px] mt-1">See steps, calories burned, resting heart rate, HRV and sleep here.</p>
        <button className="btn-primary mt-4" onClick={() => nav('/settings/health')}>Set up Google Health</button>
      </div>
    );
  const vals = (k: 'steps' | 'restingHr' | 'sleepMin' | 'hrvMs' | 'caloriesOut') => rows.map((r) => r[k]).filter((v): v is number => v != null);
  const avgSteps = average(vals('steps'));
  const avgRhr = average(vals('restingHr'));
  const avgSleep = average(vals('sleepMin'));
  const avgBurn = average(vals('caloriesOut'));
  const sleepRows = rows.filter((r) => r.sleepMin != null).map((r) => ({ date: r.date, hours: Math.round((r.sleepMin! / 60) * 10) / 10 }));
  const rhrRows = rows.filter((r) => r.restingHr != null);
  const hrvRows = rows.filter((r) => r.hrvMs != null);

  // Insights: compare first vs second half of the range
  const half = <T,>(a: T[]) => [a.slice(0, Math.floor(a.length / 2)), a.slice(Math.floor(a.length / 2))];
  const insights: { text: string; tone: 'good' | 'bad' | 'warn' | 'neutral'; icon: JSX.Element }[] = [];
  if (rhrRows.length >= 8) {
    const [a, b] = half(rhrRows.map((r) => r.restingHr!));
    const diff = average(b) - average(a);
    if (Math.abs(diff) >= 1) insights.push({ text: `Resting heart rate ${diff < 0 ? 'down' : 'up'} ${Math.abs(diff).toFixed(1)} bpm across this period${diff > 2 ? ' — could be fatigue, stress or poor sleep' : ''}`, tone: diff < 0 ? 'good' : 'warn', icon: diff < 0 ? <TrendingDown size={20} /> : <TrendingUp size={20} /> });
  }
  if (sleepRows.length >= 5) {
    const short = sleepRows.filter((r) => r.hours < 7).length;
    insights.push({ text: `Average sleep ${hm(avgSleep)}; ${short} of ${sleepRows.length} nights under 7 hours`, tone: short / sleepRows.length > 0.4 ? 'warn' : 'good', icon: <Moon size={20} /> });
  }
  if (avgSteps) insights.push({ text: `Averaging ${fmtInt(avgSteps)} steps/day${avgSteps < 7000 ? ' — a daily walk would lift recovery and calorie burn' : ''}`, tone: avgSteps >= 8000 ? 'good' : 'neutral', icon: <Footprints size={20} /> });

  const tip = (label: string, fmt: (v: number) => string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ active, payload }: any) => (active && payload?.[0] ? <TipBox title={prettyDate(String(payload[0].payload.date))} rows={[{ label, value: fmt(payload[0].value as number) }]} /> : null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Avg steps" value={avgSteps ? fmtInt(avgSteps) : '—'} sub="per day" />
        <StatTile label="Avg burned" value={avgBurn ? fmtInt(avgBurn) : '—'} sub="kcal / day" />
        <StatTile label="Resting HR" value={avgRhr ? Math.round(avgRhr) : '—'} sub="bpm average" />
        <StatTile label="Sleep" value={avgSleep ? hm(avgSleep) : '—'} sub="per night" />
      </div>

      <ChartCard title="Steps" sub="Dashed line = 8,000/day">
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="date" tickFormatter={(k) => prettyDate(k, 'MMM d')} {...axisProps(c)} minTickGap={20} />
            <YAxis {...axisProps(c)} width={44} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
            <Tooltip cursor={{ fill: c.primarySoft }} content={tip('Steps', (v) => fmtInt(v))} />
            <ReferenceLine y={8000} stroke={c.axis} strokeDasharray="5 4" />
            <Bar dataKey="steps" fill={c.primary} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {rhrRows.length >= 2 && (
        <ChartCard title="Resting heart rate" sub="Lower over time usually means better fitness and recovery">
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={rhrRows} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="date" tickFormatter={(k) => prettyDate(k, 'MMM d')} {...axisProps(c)} minTickGap={24} />
              <YAxis {...axisProps(c)} width={44} domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={(v) => Math.round(v).toString()} />
              <Tooltip cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} content={tip('Resting HR', (v) => `${v} bpm`)} />
              <Line type="monotone" dataKey="restingHr" stroke={c.primary} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: c.primary }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {sleepRows.length >= 2 && (
        <ChartCard title="Sleep" sub="Hours asleep per night · dashed line = 7h">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sleepRows} margin={{ top: 4, right: 4, left: -12, bottom: 0 }} barCategoryGap="18%">
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="date" tickFormatter={(k) => prettyDate(k, 'MMM d')} {...axisProps(c)} minTickGap={20} />
              <YAxis {...axisProps(c)} width={44} />
              <Tooltip cursor={{ fill: c.primarySoft }} content={tip('Asleep', (v) => hm(v * 60))} />
              <ReferenceLine y={7} stroke={c.axis} strokeDasharray="5 4" />
              <Bar dataKey="hours" fill={c.primary} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {hrvRows.length >= 2 && (
        <ChartCard title="Heart rate variability" sub="Nightly average (ms) · higher usually means better recovered">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={hrvRows} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="date" tickFormatter={(k) => prettyDate(k, 'MMM d')} {...axisProps(c)} minTickGap={24} />
              <YAxis {...axisProps(c)} width={44} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(v) => Math.round(v).toString()} />
              <Tooltip cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} content={tip('HRV', (v) => `${v} ms`)} />
              <Line type="monotone" dataKey="hrvMs" stroke={c.primary} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: c.primary }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="space-y-2">
        <div className="section-label mt-2">Insights</div>
        {insights.map((i) => <InsightCard key={i.text} text={i.text} tone={i.tone} icon={i.icon} />)}
        {insights.length === 0 && <div className="text-muted text-sm">A week or two of Fitbit data unlocks insights here.</div>}
      </div>
    </div>
  );
}
