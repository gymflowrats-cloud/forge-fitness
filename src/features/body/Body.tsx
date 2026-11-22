import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, Ruler, Scale, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HeroCard, HeroPill, HeroSplit, SectionTitle } from '../../components/Card';
import { NumberInput, ProgressBar } from '../../components/Controls';
import { Banner, EmptyState, toast } from '../../components/Feedback';
import { DateNav, ListRow, Page, PageTitle } from '../../components/Layout';
import { ConfirmSheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { dismiss } from '../../db/settings';
import { MEASUREMENT_KEYS, MEASUREMENT_LABELS, type BodyWeight, type Measurement } from '../../db/types';
import { useProfile, useUnits } from '../../hooks/useData';
import { useReminders } from '../../hooks/useReminders';
import { movingAverage } from '../../lib/calc';
import { prettyDate, shiftKey, todayKey } from '../../lib/dates';
import { fmtNum, fmtSigned } from '../../lib/format';
import { uid } from '../../lib/id';
import { fromDispW, lUnit, toDispL, toDispW, wUnit } from '../../lib/units';
import { MeasurementSheet, usePhotoUrl } from './MeasurementSheet';

function Thumb({ id, fallback }: { id: string | null; fallback: string }) {
  const url = usePhotoUrl(id);
  return url ? <img src={url} alt="" className="h-14 w-14 rounded-[18px] object-cover" /> : <>{fallback}</>;
}

export default function Body() {
  const p = useProfile();
  const units = useUnits();
  const reminders = useReminders();
  const [params, setParams] = useSearchParams();
  const [date, setDate] = useState(todayKey());
  const [w, setW] = useState<number | null>(null);
  const [checkIn, setCheckIn] = useState(false);
  const [editM, setEditM] = useState<Measurement | null>(null);
  const [delM, setDelM] = useState<Measurement | null>(null);

  useEffect(() => {
    if (params.get('checkin') === '1') {
      setCheckIn(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const weights = useLiveQuery(() => db.bodyWeights.orderBy('date').toArray(), [], [] as BodyWeight[]) ?? [];
  const measurements = useLiveQuery(() => db.measurements.orderBy('date').reverse().toArray(), [], [] as Measurement[]) ?? [];
  const onDate = weights.find((x) => x.date === date);
  useEffect(() => {
    setW(onDate ? toDispW(onDate.weight, units) : null);
  }, [onDate?.weight, date, units]); // eslint-disable-line react-hooks/exhaustive-deps

  const latest = weights[weights.length - 1];
  const ma = movingAverage(weights.map((x) => ({ date: x.date, value: x.weight })), 7);
  const trendNow = ma[ma.length - 1]?.value ?? null;
  const weekAgoKey = shiftKey(todayKey(), -7);
  const trendWeekAgo = [...ma].reverse().find((x) => x.date <= weekAgoKey)?.value ?? null;
  const weekChange = trendNow != null && trendWeekAgo != null ? trendNow - trendWeekAgo : null;
  const start = p?.startWeight ?? weights[0]?.weight ?? null;
  const sinceStart = latest && start != null ? latest.weight - start : null;
  const goal = p?.goalWeight ?? null;
  const toGoalPct = goal != null && start != null && latest ? Math.max(0, Math.min(1, (start - latest.weight) / (start - goal || 1))) : 0;
  const wantDown = goal != null && start != null ? goal < start : true;
  const good = (d: number | null) => (d == null || Math.abs(d) < 0.05 ? undefined : (d < 0) === wantDown ? 'success' : 'danger') as 'success' | 'danger' | undefined;

  async function saveWeight() {
    if (!w) return toast('Enter a weight', 'error');
    await db.bodyWeights.put({ id: onDate?.id ?? uid(), date, weight: fromDispW(w, units) });
    toast(`Saved ${w} ${wUnit(units)} for ${date === todayKey() ? 'today' : prettyDate(date)}`, 'success');
  }

  const summarize = (m: Measurement) =>
    MEASUREMENT_KEYS.filter((k) => m[k] != null)
      .slice(0, 3)
      .map((k) => `${MEASUREMENT_LABELS[k]} ${k === 'bodyFat' ? m[k] + '%' : toDispL(m[k], units) + ' ' + lUnit(units)}`)
      .join(' · ') || 'Photo / note only';

  return (
    <Page>
      <PageTitle title="Body" sub="Weight & check-ins" right={<DateNav date={date} onChange={setDate} />} />

      {reminders.checkInDue && (
        <div className="mb-4">
          <Banner icon={<Ruler size={26} />} title="Weekly check-in due" sub="Tap to log measurements and a photo" onClick={() => setCheckIn(true)} onDismiss={() => dismiss(reminders.checkInKey)} />
        </div>
      )}

      <HeroCard>
        <div className="flex items-center justify-between">
          <span className="text-[16px] text-white/75">Current weight</span>
          {weekChange != null && (
            <HeroPill tone={good(weekChange)}>
              {weekChange < 0 ? <ArrowDown size={14} /> : <ArrowUp size={14} />} {fmtNum(Math.abs(toDispW(weekChange, units)!))} {wUnit(units)} this week
            </HeroPill>
          )}
        </div>
        <div className="num text-[56px] font-extrabold tracking-tight tabular leading-tight">
          {latest ? fmtNum(toDispW(latest.weight, units)) : '—'} <span className="text-[22px] text-white/70">{wUnit(units)}</span>
        </div>
        <HeroSplit
          items={[
            { label: 'Since start', value: sinceStart != null ? `${fmtSigned(toDispW(sinceStart, units)!)} ${wUnit(units)}` : '—', tone: good(sinceStart) },
            { label: 'Goal', value: goal != null ? `${fmtNum(toDispW(goal, units))} ${wUnit(units)}` : 'Not set' },
          ]}
        />
        {goal != null && <ProgressBar light value={toGoalPct} max={1} className="mt-4" />}
      </HeroCard>

      <div className="card p-5 mt-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-success/15 text-success flex items-center justify-center"><Scale size={20} /></div>
          <div>
            <div className="font-bold text-[17px]">Log weight</div>
            <div className="text-[13px] text-muted">{date === todayKey() ? 'Today' : prettyDate(date)}{onDate ? ' · already logged' : ''}</div>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <div className="flex-1 min-w-0 flex items-center rounded-btn border border-line bg-card px-4 focus-within:border-primary">
            <NumberInput ariaLabel="Body weight" value={w} onChange={setW} placeholder={latest ? String(toDispW(latest.weight, units)) : '0'} className="flex-1 min-w-0 h-[60px] bg-transparent text-[30px] font-extrabold tabular outline-none placeholder:text-muted/40" />
            <span className="font-bold text-muted">{wUnit(units)}</span>
          </div>
          <button className="btn-primary !w-auto px-6" onClick={saveWeight}>Save</button>
        </div>
      </div>

      <SectionTitle title="Check-ins" sub="Weekly measurements & photos" action={<button className="btn-secondary" onClick={() => { setEditM(null); setCheckIn(true); }}>+ Add</button>} />
      {measurements.length === 0 ? (
        <EmptyState icon={<Ruler size={30} />} title="No check-ins yet" sub="Measure once a week, same time of day, for the cleanest trend." action={<button className="btn-primary" onClick={() => setCheckIn(true)}>Start weekly check-in</button>} />
      ) : (
        <div className="space-y-3">
          {measurements.map((m) => (
            <ListRow
              key={m.id}
              title={prettyDate(m.date, 'EEE, MMM d, yyyy')}
              sub={summarize(m)}
              avatar={<Thumb id={m.photoBlobId} fallback={prettyDate(m.date, 'd')} />}
              onClick={() => { setEditM(m); setCheckIn(true); }}
              trailing={<button aria-label="Delete check-in" className="btn-ghost text-muted" onClick={() => setDelM(m)}><X size={20} /></button>}
            />
          ))}
        </div>
      )}

      <SectionTitle title="Weight log" sub={`${weights.length} entries`} />
      <div className="space-y-2">
        {[...weights].reverse().slice(0, 14).map((x, i, arr) => {
          const prev = arr[i + 1];
          const d = prev ? toDispW(x.weight - prev.weight, units)! : null;
          return (
            <div key={x.id} className="card px-4 py-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="font-semibold">{prettyDate(x.date)}</div>
                {d != null && d !== 0 && <div className={`text-[13px] font-semibold ${good(d) === 'success' ? 'text-success' : 'text-danger'}`}>{fmtSigned(d)} {wUnit(units)}</div>}
              </div>
              <div className="font-extrabold tabular text-[17px]">{fmtNum(toDispW(x.weight, units))} {wUnit(units)}</div>
              <button aria-label="Delete weight" className="btn-ghost text-muted" onClick={async () => { await db.bodyWeights.delete(x.id); toast('Weight deleted', 'default', { label: 'Undo', run: () => db.bodyWeights.put(x) }); }}>
                <X size={20} />
              </button>
            </div>
          );
        })}
        {weights.length === 0 && <div className="text-muted text-center py-4">No weights logged yet.</div>}
      </div>

      <MeasurementSheet open={checkIn} onClose={() => { setCheckIn(false); setEditM(null); }} units={units} existing={editM} />
      <ConfirmSheet
        open={!!delM}
        onClose={() => setDelM(null)}
        title="Delete check-in?"
        message={delM ? `Measurements${delM.photoBlobId ? ' and photo' : ''} from ${prettyDate(delM.date)} will be removed.` : ''}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!delM) return;
          await db.measurements.delete(delM.id);
          if (delM.photoBlobId) await db.photos.delete(delM.photoBlobId);
        }}
      />
    </Page>
  );
}
