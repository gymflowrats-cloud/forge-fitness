import { Download, FileJson, FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { SegmentedControl } from '../../components/Controls';
import { AlertRow, toast } from '../../components/Feedback';
import { BackHeader, Page } from '../../components/Layout';
import { BottomSheet } from '../../components/Sheet';
import { useSettings, useUnits } from '../../hooks/useData';
import { exportBackupFile, exportCSV, importBackup, inspectBackup, type BackupSummary } from '../../services/backup';

export default function Backup() {
  const s = useSettings();
  const units = useUnits();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ parsed: { data: Record<string, unknown[]> }; summary: BackupSummary } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  const days = s.lastBackupAt ? Math.floor((Date.now() - Date.parse(s.lastBackupAt)) / 86400000) : null;

  return (
    <Page>
      <BackHeader title="Backup & export" />
      <div className="space-y-4">
        <AlertRow tone={days == null || days >= 14 ? 'warn' : 'success'}>
          {days == null ? 'You have never backed up.' : `Last backup ${days === 0 ? 'today' : `${days} day${days > 1 ? 's' : ''} ago`}.`} All data lives only on this phone — if you delete the home-screen app or clear Safari data, it's gone. Export a backup every week or two and save it to Files / iCloud Drive.
        </AlertRow>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3"><FileJson className="text-primary" /><div className="font-bold text-[17px]">Full backup (JSON)</div></div>
          <p className="text-muted text-[14px]">Everything: workouts, routine, food, body, photos, coach chat and settings. Your Gemini key is never included.</p>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await exportBackupFile();
                if (r !== 'cancelled') toast('Backup exported', 'success');
              } catch (e) {
                console.error(e);
                toast('Export failed', 'error');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download size={20} /> Export backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const r = inspectBackup(await f.text());
              if (!r.ok) return toast(r.error, 'error');
              setPending({ parsed: r.parsed, summary: r.summary });
            }}
          />
          <button className="btn-secondary w-full !rounded-btn min-h-[52px]" onClick={() => fileRef.current?.click()}>
            <Upload size={20} /> Import backup
          </button>
        </div>

        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3"><FileSpreadsheet className="text-primary" /><div className="font-bold text-[17px]">Spreadsheet export (CSV)</div></div>
          <div className="grid grid-cols-3 gap-2">
            {(['workouts', 'food', 'body'] as const).map((k) => (
              <button key={k} className="btn-secondary !rounded-btn min-h-[52px] capitalize" onClick={() => exportCSV(k, units).catch(() => toast('Export failed', 'error'))}>
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      <BottomSheet open={!!pending} onClose={() => setPending(null)} title="Import backup">
        {pending && (
          <div className="space-y-4">
            <div className="text-muted text-[14px]">
              Exported {new Date(pending.summary.exportedAt).toLocaleString()} · {pending.summary.counts.workoutSessions} workouts, {pending.summary.counts.foodLogs} food entries, {pending.summary.counts.bodyWeights} weigh-ins, {pending.summary.counts.photos} photos.
            </div>
            <SegmentedControl options={[{ value: 'merge', label: 'Merge' }, { value: 'replace', label: 'Replace' }]} value={mode} onChange={setMode} tone={mode === 'replace' ? 'danger' : 'primary'} />
            <p className="text-[14px] text-muted">
              {mode === 'merge' ? 'Adds the backup to what is on this phone. Items with the same ID are updated from the backup.' : 'Deletes everything on this phone first, then restores the backup. Cannot be undone.'}
            </p>
            <button
              className={`btn-primary ${mode === 'replace' ? '!bg-danger' : ''}`}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await importBackup(pending.parsed, mode);
                  toast('Backup imported', 'success');
                  setPending(null);
                } catch (e) {
                  console.error(e);
                  toast('Import failed — nothing was changed', 'error');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {mode === 'merge' ? 'Merge into this phone' : 'Replace all data'}
            </button>
          </div>
        )}
      </BottomSheet>
    </Page>
  );
}
