import { useState } from 'react';
import { Chip, ChipRow, Stepper } from '../../components/Controls';
import { BottomSheet } from '../../components/Sheet';
import { BARS_KG, BARS_LB, PLATES_KG, PLATES_LB, platesPerSide } from '../../lib/progression';
import { fmtNum } from '../../lib/format';
import type { Units } from '../../lib/units';

// Competition-style plate colours (kg) / common gym colours (lb)
const PLATE_COLOR: Record<string, string> = {
  '25': '#C8332B', '20': '#2B5DAE', '15': '#D9A62B', '10': '#3E8B4F', '5': '#E8E6E0', '2.5': '#2C2C2A', '1.25': '#9A9A94',
  '45': '#2B5DAE', '35': '#D9A62B', 'lb25': '#3E8B4F', 'lb10': '#E8E6E0', 'lb5': '#C8332B', 'lb2.5': '#2C2C2A',
};
const colorOf = (p: number, units: Units) => (units === 'imperial' ? PLATE_COLOR[[25, 10, 5, 2.5].includes(p) ? `lb${p}` : String(p)] : PLATE_COLOR[String(p)]) ?? '#888';
const height = (p: number, max: number) => 44 + (p / max) * 76;

export function PlateSheet({ open, onClose, units, initial, onUse }: { open: boolean; onClose: () => void; units: Units; initial: number | null; onUse?: (v: number) => void }) {
  const metric = units === 'metric';
  const bars = metric ? BARS_KG : BARS_LB;
  const plates = metric ? PLATES_KG : PLATES_LB;
  const [bar, setBar] = useState(bars[0]!);
  const [target, setTarget] = useState<number | null>(null);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setTarget(initial ?? bar);
  }
  const t = target ?? bar;
  const r = platesPerSide(t, bar, plates);
  const u = metric ? 'kg' : 'lb';
  return (
    <BottomSheet open={open} onClose={onClose} title="Plate calculator" footer={onUse && r.achieved !== initial ? <button className="btn-primary" onClick={() => { onUse(r.achieved); onClose(); }}>Use {fmtNum(r.achieved, 2)} {u}</button> : undefined}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Target ({u})</span>
          <Stepper value={t} onChange={(v) => setTarget(v)} step={metric ? 2.5 : 5} min={0} decimals={2} label="target weight" />
        </div>
        <div>
          <span className="label">Bar</span>
          <ChipRow>{bars.map((b) => <Chip key={b} active={bar === b} onClick={() => setBar(b)}>{b} {u}</Chip>)}</ChipRow>
        </div>
        <div className="card p-4">
          <div className="text-[13px] text-muted text-center mb-2">Each side</div>
          <div className="flex items-center justify-center h-[130px]">
            <div className="h-3 w-10 rounded-l bg-[#9A9A94]" />
            <div className="h-6 w-2 bg-[#7a7a74]" />
            {r.perSide.length === 0 && <div className="text-muted text-[14px] px-3">Empty bar</div>}
            {r.perSide.map((p, i) => (
              <div key={i} className="mx-[1px] rounded-[4px] border border-black/10 flex items-center justify-center" style={{ height: height(p, plates[0]!), width: p >= (metric ? 10 : 25) ? 22 : 15, background: colorOf(p, units) }}>
                <span className="text-[9px] font-bold [writing-mode:vertical-rl] rotate-180" style={{ color: ['#E8E6E0', '#D9A62B'].includes(colorOf(p, units)) ? '#2C2C2A' : '#fff' }}>{p}</span>
              </div>
            ))}
            <div className="h-3 w-6 rounded-r bg-[#9A9A94]" />
          </div>
          <div className="text-center mt-2">
            <span className="num text-[22px] font-extrabold tabular">{r.perSide.length ? r.perSide.join(' + ') : '—'}</span>
          </div>
          {r.remainder !== 0 && <div className="text-center text-[13px] text-warn mt-1">Closest: {fmtNum(r.achieved, 2)} {u} ({r.remainder > 0 ? `${fmtNum(r.remainder, 2)} short` : 'over'})</div>}
        </div>
      </div>
    </BottomSheet>
  );
}
