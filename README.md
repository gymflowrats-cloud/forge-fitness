# Forge — gym, body & nutrition tracker (iPhone PWA)

Forge is a personal fitness app you install on your iPhone from Safari. It works fully offline in the gym, keeps every byte of data on your phone, and costs $0 to host. Only the AI coach and AI food logging need internet (Google Gemini, free tier).

**Tabs:** Today (workout logging) · Food (calories & macros) · Body (weight, measurements, photos) · Stats (charts & insights) · Coach (Gemini). Settings is behind the gear on Today.

Built with React 18, TypeScript, Vite, Tailwind, Dexie (IndexedDB), vite-plugin-pwa (Workbox), Recharts, React Router (hash router), date-fns, lucide-react, @dnd-kit, and Zustand.

---

## Run locally

Requires Node 20+.

```bash
npm i
npm run dev
```

Open http://localhost:5173.

### Open it on your iPhone (same Wi-Fi)

```bash
npm run dev -- --host
```

Vite prints a `Network:` URL like `http://192.168.1.23:5173`. Open that URL in Safari on your phone.

The service worker and "Add to Home Screen" offline mode need HTTPS, so test those on the deployed GitHub Pages URL, not over the LAN.

### Other commands

```bash
npm test          # Vitest unit + IndexedDB integration tests
npm run build     # type-check + production build into dist/
npm run preview   # serve dist/ (test offline: DevTools → Network → Offline, reload)
npm run icons     # regenerate the app icons in public/
```

To see the charts without real data, go to **Settings → Developer → Load 8 weeks of sample data**. You can clear the sample data at any time and your own data stays untouched.

---

## Deploy free on GitHub Pages

1. Create a new GitHub repository, for example `forge`, and push this folder to its `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Forge"
   git branch -M main
   git remote add origin https://github.com/<you>/forge.git
   git push -u origin main
   ```
2. On GitHub, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` runs the tests, builds with `BASE_PATH=/<repo-name>/`, and publishes. Watch it in the **Actions** tab.
4. Your app is live at `https://<you>.github.io/<repo-name>/`.

Every push to `main` redeploys. Installed apps update automatically the next time you open them while online.

**Vercel / Cloudflare Pages:** import the repo with build command `npm run build` and output directory `dist`. Don't set `BASE_PATH` there; the app defaults to `/`.

---

## Install on iPhone

1. Open your Pages URL in **Safari**. It must be Safari, not Chrome.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Launch **Forge** from the home screen. It opens full-screen with no Safari bars.
4. Open it once while online so it caches everything. After that it works offline.

---

## Free Gemini API key (AI coach & food logging)

Your Google AI Pro subscription covers the Gemini *app*. The API is separate and has its own free tier.

1. Go to **https://aistudio.google.com/apikey** and sign in with your Google account.
2. Click **Create API key** and copy it.
3. In Forge, go to **Settings → AI coach**, paste the key, and tap **Test**.
4. Optional: tap **Load models** to pick a different model. The default is `gemini-3.5-flash`, defined once in `src/db/settings.ts`. If Google retires a model, Forge automatically switches to the replacement Google names in its error (or the newest Flash model) and remembers it.
5. Responses can take 10–60 seconds depending on Google's load; requests time out after 90 seconds with a clear message.

The key is stored only on your phone. It is never committed to the repo and never included in backups.

If you'd rather keep the key off the phone, deploy the optional proxy in [`cloudflare-worker/`](cloudflare-worker/README.md) and switch Settings → AI coach to **Proxy URL**.

---

## Back up your data (important)

All data lives in IndexedDB on your phone. If you delete the home-screen app, clear Safari website data, or lose the phone, the data is gone.

- Use **Settings → Backup & export → Export backup** every week or two. It produces one JSON file with everything, including progress photos. Save it to Files or iCloud Drive using the share sheet.
- To restore, or to move to a new phone, use **Import backup**. **Merge** adds to what's on the phone; **Replace** restores exactly the backup.
- CSV exports for workouts, food, and body open in Numbers, Excel, or Google Sheets.
- Forge shows a reminder banner when your last backup is more than 2 weeks old.
- On first launch Forge calls `navigator.storage.persist()` to ask iOS not to evict its storage.

---

## Project layout

```
src/
  components/       UI primitives (Card, HeroCard, StatCard, SegmentedControl, Chip/ChipRow, BottomSheet,
                    FullSheet, Stepper, ProgressBar, TabBar, Fab, Banner, AlertRow, EmptyState, Ring…)
  features/
    today/          workout logging, exercise cards, rest timer, finish summary
    food/           food diary, add-food sheet (quick / saved / AI text & photo)
    body/           weight, weekly check-ins, progress photos
    stats/          Gym / Body / Nutrition charts + local insights
    coach/          Gemini chat, weekly recap, apply-to-template suggestions
    settings/       profile, routine builder (drag & drop), library, AI, backup, developer, reset
    onboarding/     3-step first run
  db/               Dexie schema (versioned), seed exercises, workout/food/routine operations, demo data
  services/         gemini.ts (REST wrapper), coachContext.ts, coach.ts, backup.ts
  lib/              pure, tested helpers: calc.ts (e1RM, BMR/TDEE, PRs, streaks…), stats.ts, units, dates, csv
cloudflare-worker/  optional Gemini proxy
```

Data is stored in canonical units (lb, inches, miles) and converted for display, so switching between lb/in and kg/cm is lossless. Schema changes must add a new `db.version(n)` with an upgrade function in `src/db/db.ts`. Never edit an existing version.
