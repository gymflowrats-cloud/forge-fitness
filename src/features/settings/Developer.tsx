import { useState } from 'react';
import { toast } from '../../components/Feedback';
import { BackHeader, Page } from '../../components/Layout';
import { clearDemoData, loadDemoData } from '../../db/demo';

export default function Developer() {
  const [busy, setBusy] = useState(false);
  return (
    <Page>
      <BackHeader title="Developer" />
      <div className="card p-5 space-y-4">
        <div>
          <div className="font-bold text-[17px]">Sample data</div>
          <p className="text-muted text-[15px] mt-1">Adds 8 weeks of workouts, weigh-ins, measurements and food logs so you can try the charts. Days that already have real data are skipped. Sample rows can be removed at any time without touching your own data.</p>
        </div>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await loadDemoData(8);
              toast(`Added ${r.sessions} workouts, ${r.weights} weigh-ins, ${r.logs} food entries`, 'success');
            } catch (e) {
              console.error(e);
              toast('Could not load sample data', 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          Load 8 weeks of sample data
        </button>
        <button
          className="btn-secondary w-full !rounded-btn min-h-[52px]"
          disabled={busy}
          onClick={async () => {
            await clearDemoData();
            toast('Sample data cleared');
          }}
        >
          Clear sample data
        </button>
      </div>
    </Page>
  );
}
