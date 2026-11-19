import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SectionTitle } from '../../components/Card';
import { Banner, EmptyState, toast } from '../../components/Feedback';
import { BackHeader, ListRow, Page } from '../../components/Layout';
import { BottomSheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { createStarterRoutine, createTemplate, duplicateTemplate, setWeekday } from '../../db/routines';
import type { Template } from '../../db/types';
import { WEEKDAYS, WEEKDAYS_SHORT } from '../../lib/dates';
import { Dumbbell } from 'lucide-react';

export default function Routines() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const welcome = params.get('welcome') === '1';
  const templates = useLiveQuery(() => db.templates.filter((t) => !t.archived).toArray().then((l) => l.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))), [], [] as Template[]) ?? [];
  const schedule = useLiveQuery(() => db.weekSchedule.toArray(), [], []) ?? [];
  const [pickDay, setPickDay] = useState<number | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const tName = (id: string | null) => (id ? templates.find((t) => t.id === id)?.name ?? 'Rest' : 'Rest');
  // Mon-first display
  const order = [1, 2, 3, 4, 5, 6, 0];

  async function create() {
    if (!name.trim()) return;
    const id = await createTemplate(name.trim());
    setNaming(false);
    setName('');
    nav(`/settings/routines/${id}`);
  }

  return (
    <Page>
      <BackHeader title="Routine" right={welcome ? <button className="font-bold text-primary px-2 min-h-[44px]" onClick={() => nav('/today', { replace: true })}>Done</button> : undefined} />
      {welcome && (
        <div className="mb-4">
          <Banner title="Set up your routine" sub="Create workout templates, then map each weekday. You can change this any time." />
        </div>
      )}

      <SectionTitle
        title="Templates"
        action={<button className="btn-secondary" onClick={() => setNaming(true)}><Plus size={18} /> Add</button>}
      />
      {templates.length === 0 ? (
        <EmptyState
          icon={<Dumbbell size={30} />}
          title="No workout templates yet"
          sub="Create Push / Pull / Legs or your own split. Or start from a ready-made PPL routine."
          action={
            <div className="space-y-2">
              <button className="btn-primary" onClick={() => setNaming(true)}><Plus size={20} /> New template</button>
              <button className="btn-secondary w-full !rounded-btn" onClick={async () => { await createStarterRoutine(); toast('Starter PPL routine added', 'success'); }}>
                <Sparkles size={18} /> Use starter Push/Pull/Legs
              </button>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const days = schedule.filter((s) => s.templateId === t.id).map((s) => WEEKDAYS_SHORT[s.weekday]).join(', ');
            return (
              <ListRow
                key={t.id}
                title={t.name}
                sub={`${t.exercises.length} exercises${days ? ' · ' + days : ''}`}
                onClick={() => nav(`/settings/routines/${t.id}`)}
                avatar={<span style={{ color: t.color }}>{t.name.slice(0, 2).toUpperCase()}</span>}
                trailing={
                  <button aria-label={`Duplicate ${t.name}`} className="btn-ghost text-muted" onClick={async () => { await duplicateTemplate(t.id); toast('Template duplicated'); }}>
                    <Copy size={20} />
                  </button>
                }
              />
            );
          })}
        </div>
      )}

      <SectionTitle title="Weekly schedule" sub="Tap a day to pick its workout" />
      <div className="card divide-y divide-line overflow-hidden">
        {order.map((wd) => {
          const tid = schedule.find((s) => s.weekday === wd)?.templateId ?? null;
          return (
            <button key={wd} className="w-full flex items-center justify-between px-4 min-h-[56px] active:bg-track" onClick={() => setPickDay(wd)}>
              <span className="font-semibold">{WEEKDAYS[wd]}</span>
              <span className={`font-bold ${tid ? 'text-primary' : 'text-muted'}`}>{tName(tid)}</span>
            </button>
          );
        })}
      </div>
      {welcome && (
        <button className="btn-primary mt-6" onClick={() => nav('/today', { replace: true })}>Start training</button>
      )}

      <BottomSheet open={pickDay != null} onClose={() => setPickDay(null)} title={pickDay != null ? WEEKDAYS[pickDay] : ''}>
        <div className="space-y-2">
          {[{ id: null as string | null, name: 'Rest day' }, ...templates.map((t) => ({ id: t.id as string | null, name: t.name }))].map((o) => {
            const cur = schedule.find((s) => s.weekday === pickDay)?.templateId ?? null;
            return (
              <button
                key={o.id ?? 'rest'}
                className={`w-full min-h-[52px] rounded-btn border px-4 text-left font-bold ${cur === o.id ? 'bg-primary text-white border-primary' : 'bg-card border-line'}`}
                onClick={async () => {
                  await setWeekday(pickDay!, o.id);
                  setPickDay(null);
                }}
              >
                {o.name}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <BottomSheet open={naming} onClose={() => setNaming(false)} title="New template" footer={<button className="btn-primary" onClick={create} disabled={!name.trim()}>Create</button>}>
        <input autoFocus className="input" placeholder="e.g. Push, Upper, Cardio + Abs" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
        <div className="flex flex-wrap gap-2 mt-3">
          {['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Cardio + Abs'].map((n) => (
            <button key={n} className="btn-secondary !min-h-[38px] text-sm" onClick={() => setName(n)}>{n}</button>
          ))}
        </div>
      </BottomSheet>
    </Page>
  );
}
