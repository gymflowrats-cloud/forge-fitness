import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NumberInput } from '../../components/Controls';
import { DateChips } from '../../components/DateChips';
import { toast } from '../../components/Feedback';
import { FullSheet } from '../../components/Sheet';
import { db } from '../../db/db';
import { MEASUREMENT_KEYS, MEASUREMENT_LABELS, type Measurement, type MeasurementKey } from '../../db/types';
import { todayKey } from '../../lib/dates';
import { fmtSigned } from '../../lib/format';
import { uid } from '../../lib/id';
import { fromDispL, lUnit, toDispL, type Units } from '../../lib/units';
import { imageToBase64 } from '../../services/gemini';

export function usePhotoUrl(id: string | null | undefined) {
  const photo = useLiveQuery(async () => (id ? await db.photos.get(id) : undefined), [id]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(photo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  return url;
}

const empty = (date: string): Measurement => ({
  id: uid(), date, photoBlobId: null, note: '',
  chest: null, waist: null, hips: null, neck: null, armL: null, armR: null, thighL: null, thighR: null, calves: null, bodyFat: null,
});

export function MeasurementSheet({ open, onClose, units, existing }: { open: boolean; onClose: () => void; units: Units; existing?: Measurement | null }) {
  const [m, setM] = useState<Measurement>(existing ?? empty(todayKey()));
  const [weight, setWeight] = useState<number | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const existingPhoto = usePhotoUrl(m.photoBlobId);

  useEffect(() => {
    if (open) {
      setM(existing ?? empty(todayKey()));
      setPhoto(null);
      setPhotoPreview(null);
      setWeight(null);
    }
  }, [open, existing]);

  const prev = useLiveQuery(
    () => db.measurements.where('date').below(m.date).reverse().sortBy('date'),
    [m.date],
    [] as Measurement[],
  ) ?? [];
  const lastOf = (k: MeasurementKey) => prev.find((p) => p[k] != null)?.[k] ?? null;
  const dispOf = (k: MeasurementKey, v: number | null) => (k === 'bodyFat' ? v : toDispL(v, units));
  const unitOf = (k: MeasurementKey) => (k === 'bodyFat' ? '%' : lUnit(units));

  async function save() {
    let photoBlobId = m.photoBlobId;
    if (photo) {
      photoBlobId = uid();
      await db.photos.add({ id: photoBlobId, blob: photo, createdAt: new Date().toISOString() });
      if (m.photoBlobId) await db.photos.delete(m.photoBlobId);
    }
    await db.measurements.put({ ...m, photoBlobId });
    if (weight) {
      const ex = await db.bodyWeights.where('date').equals(m.date).first();
      await db.bodyWeights.put({ id: ex?.id ?? uid(), date: m.date, weight: units === 'metric' ? weight * 2.2046226218 : weight });
    }
    toast('Check-in saved', 'success');
    onClose();
  }

  return (
    <FullSheet open={open} onClose={onClose} title={existing ? 'Edit check-in' : 'Weekly check-in'} footer={<button className="btn-primary" onClick={save}>Save check-in</button>}>
      <div className="space-y-5">
        <div>
          <div className="section-label mb-2">Date</div>
          <DateChips value={m.date} onChange={(d) => setM({ ...m, date: d })} />
        </div>
        {!existing && (
          <label className="block">
            <span className="section-label">Weight ({units === 'metric' ? 'kg' : 'lb'}) · optional</span>
            <NumberInput value={weight} onChange={setWeight} placeholder="Also log weight" className="input mt-2" />
          </label>
        )}
        <div className="card divide-y divide-line">
          {MEASUREMENT_KEYS.map((k) => {
            const last = dispOf(k, lastOf(k));
            const cur = dispOf(k, m[k]);
            const delta = cur != null && last != null ? cur - last : null;
            return (
              <div key={k} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{MEASUREMENT_LABELS[k]}</div>
                  <div className="text-[13px] text-muted">
                    {last != null ? `Last: ${last} ${unitOf(k)}` : 'No previous'}
                    {delta != null && delta !== 0 && (
                      <span className={`ml-2 font-bold ${k === 'waist' || k === 'bodyFat' ? (delta < 0 ? 'text-success' : 'text-danger') : delta > 0 ? 'text-success' : 'text-danger'}`}>
                        {fmtSigned(delta)}
                      </span>
                    )}
                  </div>
                </div>
                <NumberInput
                  ariaLabel={MEASUREMENT_LABELS[k]}
                  value={cur}
                  placeholder="–"
                  onChange={(v) => setM({ ...m, [k]: v == null ? null : k === 'bodyFat' ? v : fromDispL(v, units) })}
                  className="w-24 h-12 rounded-xl bg-track/70 text-center font-bold tabular outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="w-6 text-[13px] text-muted">{unitOf(k)}</span>
              </div>
            );
          })}
        </div>
        <div>
          <div className="section-label mb-2">Progress photo (stays on this phone)</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const { blob } = await imageToBase64(f, 1280, 0.75);
              setPhoto(blob);
              setPhotoPreview(URL.createObjectURL(blob));
            }}
          />
          {photoPreview || existingPhoto ? (
            <div className="relative">
              <img src={photoPreview ?? existingPhoto!} alt="Progress" className="w-full max-h-80 object-cover rounded-card" />
              <button aria-label="Remove photo" className="absolute top-3 right-3 h-11 w-11 rounded-full bg-black/50 text-white flex items-center justify-center" onClick={() => { setPhoto(null); setPhotoPreview(null); setM({ ...m, photoBlobId: null }); }}>
                <Trash2 size={18} />
              </button>
            </div>
          ) : (
            <button className="btn-secondary w-full !rounded-btn min-h-[52px]" onClick={() => fileRef.current?.click()}><Camera size={20} /> Add photo</button>
          )}
        </div>
        <label className="block">
          <span className="section-label">Note</span>
          <input className="input mt-2" value={m.note} onChange={(e) => setM({ ...m, note: e.target.value })} placeholder="Optional" />
        </label>
      </div>
    </FullSheet>
  );
}
