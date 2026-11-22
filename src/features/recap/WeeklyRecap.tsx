import { useLiveQuery } from 'dexie-react-hooks';
import { Award, ChevronLeft, ChevronRight, Dumbbell, Footprints, Moon, Scale, Share2, Trophy, Utensils } from 'lucide-react';
import { useState } from 'react';
import { toast } from '../../components/Feedback';
import { BackHeader, Page } from '../../components/Layout';
import { db } from '../../db/db';
import { useProfile, useUnits } from '../../hooks/useData';
import { prettyDate, todayKey } from '../../lib/dates';
import { fmtInt, fmtNum, fmtPct, fmtSigned } from '../../lib/format';
import { buildRecap, type Recap } from '../../lib/recap';
import { addDays, mondayOf } from '../../lib/stats';
import { lbToKg, toDispW, wUnit, type Units } from '../../lib/units';
import { loadAchievements } from '../achievements/useAchievements';

export async function loadRecap(weekStart: string): Promise<Recap> {
  const from = addDays(weekStart, -7);
  const to = addDays(weekStart, 6);
  const [sessions, sets, exercises, schedule, weights, foodLogs, profile, wearable, achievements] = await Promise.all([
    db.workoutSessions.where('date').between(from, to, true, true).toArray(),
    db.sets.where('date').between(from, to, true, true).toArray(),
    db.exercises.toArray(),
    db.weekSchedule.toArray(),
    db.bodyWeights.where('date').between(from, to, true, true).toArray(),
    db.foodLogs.where('date').between(weekStart, to, true, true).toArray(),
    db.profile.get('me'),
    db.wearableDays.where('date').between(weekStart, to, true, true).toArray(),
    loadAchievements(),
  ]);
  return buildRecap({
    weekStart, sessions, sets,
    exerciseNames: new Map(exercises.map((e) => [e.id, e.name])),
    scheduledWeekdays: schedule.filter((s) => s.templateId).map((s) => s.weekday),
    weights, foodLogs,
    calorieTarget: profile?.calorieTarget ?? null, proteinTarget: profile?.proteinG ?? null,
    wearable, achievements,
  });
}

const vol = (lb: number, u: Units) => fmtInt(u === 'metric' ? lbToKg(lb) : lb);
const range = (r: Recap) => `${prettyDate(r.weekStart, 'MMM d')} – ${prettyDate(r.weekEnd, 'MMM d')}`;

/** Draw a shareable 1080×1350 image of the recap using the current palette. */
export async function renderImage(r: Recap, units: Units, name: string): Promise<Blob | null> {
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  if (!g) return null;
  try {
    await Promise.all([document.fonts.load('700 80px "Barlow Condensed"'), document.fonts.load('800 40px "Plus Jakarta Sans"'), document.fonts.load('500 30px "Plus Jakarta Sans"')]);
  } catch { /* fall back to system fonts */ }
  const st = getComputedStyle(document.documentElement);
  const v = (k: string) => `rgb(${st.getPropertyValue(k).trim().split(/\s+/).join(',')})`;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, v('--c-hero-from'));
  grad.addColorStop(1, v('--c-hero-to'));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W, 0, 0, W, 0, 900);
  glow.addColorStop(0, v('--c-accent').replace('rgb(', 'rgba(').replace(')', ',0.35)'));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  const sans = '"Plus Jakarta Sans", system-ui, sans-serif';
  const num = '"Barlow Condensed", "Plus Jakarta Sans", sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.font = `600 34px ${sans}`;
  g.fillText(`WEEK IN REVIEW · ${range(r).toUpperCase()}`, 80, 130);
  g.fillStyle = '#fff';
  g.font = `800 72px ${sans}`;
  const words = r.headline.split(' ');
  let line = '';
  let y = 230;
  for (const w of words) {
    if (g.measureText(line + w).width > W - 160) { g.fillText(line.trim(), 80, y); line = ''; y += 86; }
    line += w + ' ';
  }
  g.fillText(line.trim(), 80, y);

  const tiles: [string, string][] = [
    ['Workouts', r.planned ? `${r.workouts}/${r.planned}` : String(r.workouts)],
    [`Volume (${units === 'metric' ? 'kg' : 'lb'})`, vol(r.volume, units)],
    ['PRs', String(r.prs.length)],
    ['Sets', String(r.setsDone)],
  ];
  if (r.weightAvg != null) tiles.push([`Avg weight (${wUnit(units)})`, fmtNum(toDispW(r.weightAvg, units), 1)]);
  if (r.calAvg != null) tiles.push(['Avg kcal', fmtInt(r.calAvg)]);
  if (r.stepsAvg != null) tiles.push(['Avg steps', fmtInt(r.stepsAvg)]);
  if (r.proteinAvg != null) tiles.push(['Avg protein', `${fmtInt(r.proteinAvg)} g`]);
  const top = y + 70;
  tiles.slice(0, 8).forEach(([label, value], k) => {
    const cx = 80 + (k % 2) * 470;
    const cy = top + Math.floor(k / 2) * 190;
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.beginPath();
    g.roundRect(cx, cy, 440, 165, 32);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.font = `600 28px ${sans}`;
    g.fillText(label, cx + 32, cy + 52);
    g.fillStyle = '#fff';
    g.font = `700 84px ${num}`;
    g.fillText(value, cx + 32, cy + 135);
  });
  if (r.prs.length) {
    g.fillStyle = v('--c-accent');
    g.font = `700 30px ${sans}`;
    const pr = r.prs.slice(0, 2).map((p) => `${p.name}${p.weight ? ` ${fmtNum(toDispW(p.weight, units), 1)}${wUnit(units)}` : ''} × ${p.reps}`).join('   ·   ');
    g.fillText(`🏆 ${pr}`, 80, H - 140);
  }
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.font = `600 30px ${sans}`;
  g.fillText(`${name ? name + ' · ' : ''}Forge`, 80, H - 70);
  return new Promise((res) => cv.toBlob((b) => res(b), 'image/png'));
}

function Tile({ icon, label, value, sub, tone }: { icon: JSX.Element; label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-muted text-[13px] font-semibold">{icon}{label}</div>
      <div className="num text-[30px] font-extrabold tabular leading-tight mt-1">{value}</div>
      {sub && <div className={`text-[12px] ${tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-danger' : 'text-muted'}`}>{sub}</div>}
    </div>
  );
}

export default function WeeklyRecap() {
  const units = useUnits();
  const profile = useProfile();
  const thisWeek = mondayOf(todayKey());
  const [week, setWeek] = useState(addDays(thisWeek, -7));
  const r = useLiveQuery(() => loadRecap(week), [week]);
  const [sharing, setSharing] = useState(false);

  async function share() {
    if (!r) return;
    setSharing(true);
    try {
      const blob = await renderImage(r, units, profile?.name ?? '');
      if (!blob) throw new Error('Could not draw image');
      const file = new File([blob], `forge-week-${r.weekStart}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'My week in Forge' });
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Sharing failed', 'error');
    } finally {
      setSharing(false);
    }
  }

  const volDelta = r && r.prevVolume ? ((r.volume - r.prevVolume) / r.prevVolume) * 100 : null;
  const wDelta = r && r.weightAvg != null && r.prevWeightAvg != null ? (toDispW(r.weightAvg, units) ?? 0) - (toDispW(r.prevWeightAvg, units) ?? 0) : null;
  return (
    <Page>
      <BackHeader title="Weekly recap" />
      <div className="flex items-center justify-between mb-3">
        <button aria-label="Previous week" className="btn-ghost" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft size={22} /></button>
        <div className="font-bold">{week === thisWeek ? 'This week so far' : r ? range(r) : ''}</div>
        <button aria-label="Next week" className="btn-ghost disabled:opacity-30" disabled={week >= thisWeek} onClick={() => setWeek(addDays(week, 7))}><ChevronRight size={22} /></button>
      </div>
      {!r ? null : !r.hasData ? (
        <div className="card p-8 text-center text-muted">Nothing logged this week.</div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-card p-6 text-white hero-surface shadow-float">
            <div className="text-white/70 text-[13px] font-semibold uppercase tracking-wider">Week in review</div>
            <div className="text-[28px] font-extrabold leading-tight mt-1">{r.headline}</div>
            <div className="mt-4 flex gap-6">
              <div><div className="text-white/70 text-[13px]">Workouts</div><div className="num text-[40px] font-extrabold leading-none tabular">{r.workouts}{r.planned ? <span className="text-white/60 text-[24px]">/{r.planned}</span> : null}</div></div>
              <div><div className="text-white/70 text-[13px]">PRs</div><div className="num text-[40px] font-extrabold leading-none tabular">{r.prs.length}</div></div>
              <div><div className="text-white/70 text-[13px]">Sets</div><div className="num text-[40px] font-extrabold leading-none tabular">{r.setsDone}</div></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Tile icon={<Dumbbell size={16} />} label={`Volume (${units === 'metric' ? 'kg' : 'lb'})`} value={vol(r.volume, units)} sub={volDelta != null ? `${fmtPct(volDelta)} vs last week` : undefined} tone={volDelta != null ? (volDelta >= 0 ? 'good' : 'bad') : undefined} />
            <Tile icon={<Scale size={16} />} label={`Avg weight (${wUnit(units)})`} value={r.weightAvg != null ? fmtNum(toDispW(r.weightAvg, units), 1) : '—'} sub={wDelta != null ? `${fmtSigned(wDelta, 1)} vs last week` : undefined} />
            <Tile icon={<Utensils size={16} />} label="Avg calories" value={r.calAvg != null ? fmtInt(r.calAvg) : '—'} sub={r.foodDays ? `${r.foodDays} days logged${r.calTarget ? ` · target ${fmtInt(r.calTarget)}` : ''}` : 'No food logged'} />
            <Tile icon={<Utensils size={16} />} label="Avg protein" value={r.proteinAvg != null ? `${fmtInt(r.proteinAvg)} g` : '—'} sub={r.proteinTarget && r.foodDays ? `Goal hit ${r.proteinDaysHit}/${r.foodDays} days` : undefined} tone={r.proteinTarget && r.foodDays ? (r.proteinDaysHit >= r.foodDays * 0.7 ? 'good' : 'bad') : undefined} />
            {r.stepsAvg != null && <Tile icon={<Footprints size={16} />} label="Avg steps" value={fmtInt(r.stepsAvg)} />}
            {r.sleepAvg != null && <Tile icon={<Moon size={16} />} label="Avg sleep" value={`${Math.floor(r.sleepAvg / 60)}h${String(Math.round(r.sleepAvg % 60)).padStart(2, '0')}`} />}
          </div>

          {r.prs.length > 0 && (
            <div className="card p-4">
              <div className="font-extrabold mb-2 flex items-center gap-2"><Trophy size={18} className="text-gold" /> Personal records</div>
              {r.prs.map((p) => (
                <div key={p.name} className="flex justify-between py-1.5 border-t border-line first:border-0 text-[14px]">
                  <span className="font-semibold">{p.name}</span>
                  <span className="tabular">{p.weight ? `${fmtNum(toDispW(p.weight, units), 1)} ${wUnit(units)} × ` : ''}{p.reps}</span>
                </div>
              ))}
            </div>
          )}
          {r.achievements.length > 0 && (
            <div className="card p-4">
              <div className="font-extrabold mb-2 flex items-center gap-2"><Award size={18} className="text-gold" /> Achievements earned</div>
              <div className="flex flex-wrap gap-2">{r.achievements.map((a) => <span key={a} className="rounded-full bg-gold/15 text-[13px] font-semibold px-3 py-1">{a}</span>)}</div>
            </div>
          )}
          <button className="btn-primary" onClick={share} disabled={sharing}><Share2 size={20} /> {sharing ? 'Preparing…' : 'Share as image'}</button>
        </div>
      )}
    </Page>
  );
}
