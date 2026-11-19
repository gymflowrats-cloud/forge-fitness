import { Beef, Flame, Scale, Target } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Profile } from '../../db/types';
import { movingAverage } from '../../lib/calc';
import { prettyDate } from '../../lib/dates';
import { fmtInt, fmtNum, fmtSigned } from '../../lib/format';
import { addDays, average, mondayOf, weeksBetween } from '../../lib/stats';
import { toDispW, wUnit, type Units } from '../../lib/units';
import { ChartCard, InsightCard, StatTile, TipBox, axisProps, useChartColors } from './chartTheme';
import type { StatsData } from './useStatsData';

export function NutritionStats({ d, units, profile }: { d: StatsData; units: Units; profile?: Profile }) {
  const c = useChartColors();
  const goal = profile?.calorieTarget ?? 2200;
  const pGoal = profile?.proteinG ?? 150;
  const byDay = new Map<string, { cal: number; p: number; carbs: number; f: number }>();
  for (const l of d.foodLogs) {
    if (l.date < d.from || l.date > d.to) continue;
    const t = byDay.get(l.date) ?? { cal: 0, p: 0, carbs: 0, f: 0 };
    t.cal += l.calories; t.p += l.protein; t.carbs += l.carbs; t.f += l.fat;
    byDay.set(l.date, t);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, t]) => ({ date, ...t }));
  if (!days.length) return <div className="card p-8 text-center text-muted">Log food on the Food tab to see nutrition stats.</div>;

  const status = (cal: number) => (Math.abs(cal - goal) <= goal * 0.05 ? 'within' : cal > goal ? 'over' : 'under');
  const colorFor = (s: string) => (s === 'within' ? c.good : s === 'over' ? c.bad : c.other);
  const avgCal = average(days.map((x) => x.cal));
  const avgP = average(days.map((x) => x.p));
  const pHit = days.filter((x) => x.p >= pGoal * 0.95).length;
  const totP = days.reduce((a, x) => a + x.p * 4, 0);
  const totC = days.reduce((a, x) => a + x.carbs * 4, 0);
  const totF = days.reduce((a, x) => a + x.f * 9, 0);
  const totK = totP + totC + totF || 1;
  const macro = [
    { name: 'Protein', v: totP, g: avgP, color: c.cat[0]! },
    { name: 'Carbs', v: totC, g: average(days.map((x) => x.carbs)), color: c.cat[1]! },
    { name: 'Fat', v: totF, g: average(days.map((x) => x.f)), color: c.cat[2]! },
  ];

  // Weekly: avg kcal & protein, and weight trend change
  const weeks = weeksBetween(d.from, d.to);
  const ma = movingAverage(d.weights.map((w) => ({ date: w.date, value: w.weight })), 7);
  const trendAt = (k: string) => [...ma].reverse().find((p) => p.date <= k)?.value ?? null;
  const weekly = weeks.map((w) => {
    const ds = days.filter((x) => mondayOf(x.date) === w);
    const end = addDays(w, 6) > d.to ? d.to : addDays(w, 6);
    const a = trendAt(addDays(w, -1));
    const b = trendAt(end);
    return { week: w, kcal: ds.length ? Math.round(average(ds.map((x) => x.cal))) : null, protein: ds.length ? Math.round(average(ds.map((x) => x.p))) : null, n: ds.length, dW: a != null && b != null ? Math.round((toDispW(b - a, units) ?? 0) * 10) / 10 : null };
  }).filter((w) => w.n > 0);
  const wantDown = profile?.goal === 'lose' || profile?.goal === 'recomp';

  const insights: { text: string; tone: 'good' | 'bad' | 'warn' | 'neutral'; icon: JSX.Element }[] = [];
  const diff = avgCal - goal;
  insights.push({ text: `Avg ${fmtInt(avgCal)} kcal, ${fmtInt(Math.abs(diff))} ${diff < 0 ? 'below' : 'above'} target`, tone: Math.abs(diff) <= goal * 0.05 ? 'good' : 'warn', icon: <Flame size={20} /> });
  insights.push({ text: `Protein target hit on ${pHit} of ${days.length} logged days (avg ${Math.round(avgP)} g)`, tone: pHit / days.length >= 0.7 ? 'good' : 'warn', icon: <Beef size={20} /> });
  const recentW = weekly.filter((w) => w.dW != null).slice(-3);
  if (recentW.length >= 2) {
    const avgDW = average(recentW.map((w) => w.dW!));
    const avgK = average(recentW.map((w) => w.kcal ?? 0));
    insights.push({ text: `At ~${fmtInt(avgK)} kcal/day your weight is moving ${fmtSigned(avgDW, 1)} ${wUnit(units)}/week`, tone: (avgDW < 0) === wantDown ? 'good' : 'warn', icon: <Scale size={20} /> });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Avg kcal" value={fmtInt(avgCal)} sub={`goal ${fmtInt(goal)}`} />
        <StatTile label="Avg protein" value={`${Math.round(avgP)}g`} sub={`goal ${pGoal}g`} tone={avgP >= pGoal * 0.95 ? 'good' : undefined} />
        <StatTile label="Protein hit" value={`${pHit}/${days.length}`} sub="days" />
      </div>

      <ChartCard title="Daily calories" sub={`Dashed line = ${fmtInt(goal)} kcal goal`} legend={[{ label: 'Within ±5%', color: c.good }, { label: 'Over', color: c.bad }, { label: 'Under', color: colorFor('under') }]}>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={days} margin={{ top: 6, right: 4, left: -8, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="date" tickFormatter={(k) => prettyDate(k, 'MMM d')} {...axisProps(c)} minTickGap={20} />
            <YAxis {...axisProps(c)} width={44} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
            <Tooltip cursor={{ fill: c.primarySoft }} content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={prettyDate(String(payload[0].payload.date))} rows={[{ label: 'Calories', value: fmtInt(payload[0].payload.cal) }, { label: 'Protein', value: `${Math.round(payload[0].payload.p)} g` }, { label: 'vs goal', value: fmtSigned(payload[0].payload.cal - goal, 0) }]} /> : null)} />
            <ReferenceLine y={goal} stroke={c.axis} strokeDasharray="5 4" />
            <Bar dataKey="cal" radius={[4, 4, 0, 0]} maxBarSize={18}>
              {days.map((x) => <Cell key={x.date} fill={colorFor(status(x.cal))} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Macro split" sub="Share of calories in range">
        <div className="flex items-center gap-4">
          <div className="w-[120px] h-[120px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={macro} dataKey="v" nameKey="name" innerRadius={36} outerRadius={58} paddingAngle={2} stroke={c.card} strokeWidth={2} isAnimationActive={false}>
                  {macro.map((m) => <Cell key={m.name} fill={m.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {macro.map((m) => (
              <div key={m.name} className="flex items-center gap-2 text-[14px]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
                <span>{m.name}</span>
                <span className="ml-auto font-bold tabular">{Math.round((m.v / totK) * 100)}%</span>
                <span className="text-muted tabular w-14 text-right">{Math.round(m.g)} g</span>
              </div>
            ))}
          </div>
        </div>
      </ChartCard>

      <ChartCard title="Is my intake working?" sub="Weekly average calories, and how the weight trend moved that week">
        <div className="text-[13px] font-semibold text-muted mb-1">Avg kcal / day</div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={weekly} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} syncId="intake" barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="week" tickFormatter={(k) => prettyDate(k, 'MMM d')} {...axisProps(c)} hide />
            <YAxis {...axisProps(c)} width={44} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} />
            <Tooltip cursor={{ fill: c.primarySoft }} content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={`Week of ${prettyDate(String(payload[0].payload.week), 'MMM d')}`} rows={[{ label: 'Avg kcal', value: fmtInt(payload[0].payload.kcal) }, { label: 'Avg protein', value: `${payload[0].payload.protein} g` }, { label: 'Weight Δ', value: payload[0].payload.dW != null ? `${fmtSigned(payload[0].payload.dW)} ${wUnit(units)}` : '—' }]} /> : null)} />
            <ReferenceLine y={goal} stroke={c.axis} strokeDasharray="5 4" />
            <Bar dataKey="kcal" fill={c.primary} radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
        <div className="text-[13px] font-semibold text-muted mb-1 mt-3">Weight trend change ({wUnit(units)}/week)</div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={weekly} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} syncId="intake" barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="week" tickFormatter={(k) => prettyDate(k, 'MMM d')} {...axisProps(c)} minTickGap={16} />
            <YAxis {...axisProps(c)} width={44} tickFormatter={(v) => fmtNum(v, 1)} />
            <Tooltip cursor={{ fill: c.primarySoft }} content={({ active, payload }) => (active && payload?.[0] ? <TipBox title={`Week of ${prettyDate(String(payload[0].payload.week), 'MMM d')}`} rows={[{ label: 'Weight Δ', value: payload[0].payload.dW != null ? `${fmtSigned(payload[0].payload.dW)} ${wUnit(units)}` : '—' }]} /> : null)} />
            <ReferenceLine y={0} stroke={c.axis} />
            <Bar dataKey="dW" radius={[4, 4, 4, 4]} maxBarSize={26}>
              {weekly.map((w) => <Cell key={w.week} fill={w.dW == null ? c.other : (w.dW < 0) === wantDown ? c.good : c.bad} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 border-t border-line pt-3">
          <div className="grid grid-cols-4 text-[11px] font-bold uppercase text-muted pb-1"><span>Week</span><span className="text-right">kcal</span><span className="text-right">Protein</span><span className="text-right">Weight Δ</span></div>
          {[...weekly].reverse().slice(0, 6).map((w) => (
            <div key={w.week} className="grid grid-cols-4 text-[13px] py-1 tabular">
              <span>{prettyDate(w.week, 'MMM d')}</span>
              <span className="text-right font-semibold">{w.kcal != null ? fmtInt(w.kcal) : '—'}</span>
              <span className="text-right">{w.protein ?? '—'} g</span>
              <span className="text-right">{w.dW != null ? fmtSigned(w.dW) : '—'}</span>
            </div>
          ))}
        </div>
      </ChartCard>

      <div className="space-y-2">
        <div className="section-label mt-2">Insights</div>
        {insights.slice(0, 3).map((i) => <InsightCard key={i.text} text={i.text} tone={i.tone} icon={i.icon} />)}
      </div>
      <p className="text-[12px] text-muted flex items-center gap-1.5"><Target size={14} /> Weight change uses the 7-day average trend, not single weigh-ins.</p>
    </div>
  );
}
