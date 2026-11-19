import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '../../components/Feedback';
import { BackHeader, Page } from '../../components/Layout';
import { db } from '../../db/db';
import { initDb } from '../../db/init';

export default function ResetData() {
  const [text, setText] = useState('');
  const nav = useNavigate();
  return (
    <Page>
      <BackHeader title="Reset all data" />
      <div className="card p-5 space-y-4">
        <p className="text-[15px]">
          This permanently deletes <b>every workout, food log, body measurement, photo, chat and setting</b> on this device. It cannot be undone. Export a backup first.
        </p>
        <label className="block">
          <span className="label">Type DELETE to confirm</span>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="characters" />
        </label>
        <button
          className="btn-primary !bg-danger"
          disabled={text !== 'DELETE'}
          onClick={async () => {
            await db.delete();
            await db.open();
            await initDb();
            localStorage.clear();
            toast('All data deleted');
            nav('/onboarding', { replace: true });
          }}
        >
          Delete everything
        </button>
      </div>
    </Page>
  );
}
