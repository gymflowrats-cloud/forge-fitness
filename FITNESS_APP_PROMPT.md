# Build "Forge" — my personal gym, body & nutrition tracker (iPhone PWA)

You are building a complete, production-quality personal fitness app for me. I will use it **every day in the gym on my iPhone**, so speed of logging sets/reps with one thumb is the #1 priority. Read this whole file before writing code, then build it in the phases listed at the end. After each phase, run the build and fix all errors before moving on.

Design reference screenshots are in `./design-reference/` (they're from my finance app "Pocket"). **Match that visual style closely** — same colors, card shapes, typography, toggles, bottom tab bar and floating + button. Read the images before you start on the UI.

---

## 1. Platform & hosting (must be $0)

- Build a **Progressive Web App (PWA)** that I install on my iPhone with Safari → Share → **Add to Home Screen**. It must open full-screen like a native app (no Safari bars), with its own icon and splash colour.
- It must **work fully offline in the gym** (bad signal). All data stays on the device; only AI features need internet.
- Host free on **GitHub Pages** (deploy with a GitHub Actions workflow). Also make it work on Vercel / Cloudflare Pages with no changes if I switch.
- No backend server, no paid services, no login screen needed (single user). No Apple Developer account needed.

### Tech stack
- **React 18 + TypeScript + Vite**
- **Tailwind CSS** (put the design tokens below in `tailwind.config`)
- **Dexie.js** (IndexedDB) for local storage, with `dexie-react-hooks` (`useLiveQuery`)
- **vite-plugin-pwa** (Workbox) for service worker, manifest and offline caching (`registerType: 'autoUpdate'`)
- **Recharts** for charts
- **React Router** (hash router, so GitHub Pages refreshes don't 404)
- **date-fns** for dates
- **lucide-react** for icons
- **Zustand** only if needed for UI state

### iPhone/PWA requirements (don't skip these)
- `manifest.webmanifest` with `display: "standalone"`, `theme_color`, `background_color`, name, short_name, icons 192/512 + maskable.
- `apple-touch-icon` (180×180), `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `viewport-fit=cover`.
- Generate a simple app icon (white rounded square with a dumbbell on the dark green background, same idea as the Pocket wallet icon) as PNGs in `public/`.
- Respect safe areas: `env(safe-area-inset-top/bottom)` for the header and bottom tab bar.
- All inputs `font-size >= 16px` so iOS doesn't zoom in. Number inputs use `inputMode="decimal"` / `"numeric"` so the number pad opens.
- Call `navigator.storage.persist()` on first launch so iOS is less likely to clear data.
- No `alert()` / `confirm()`; use in-app bottom sheets and toasts.
- Touch targets at least 44×44px. Add light haptic-style feedback (a quick scale animation) on set completion.
- Vite `base` must be configurable for GitHub Pages (`/<repo-name>/`).

---

## 2. Design system (copy the Pocket screenshots)

| Token | Value (approx — sample the screenshots to refine) |
|---|---|
| Primary (forest green) | `#36493B` (buttons, active tab, selected chips) |
| Hero card gradient | `#3E5444` → `#2C3B30` |
| App background | `#F5F4F0` (warm off-white) |
| Card | `#FFFFFF`, 1px border `#E8E6E0`, radius 24px, very soft shadow |
| Segmented control track | `#ECEBE6`, selected pill = primary green with white text |
| Accent red (terracotta) | `#9B4234` (over calorie goal, missed, decreases) |
| Accent green (positive) | `#3F6B4A` (PRs, increases, goals hit) |
| Warning (amber) | `#D08A2E` (like the "You overspent" alert) |
| Text primary | `#1C1C1A`; secondary `#6B6B66` |
| Font | **Plus Jakarta Sans** (self-host it via `@fontsource` so it works offline); big bold numbers like "-$46,877" |

UI patterns to reuse from the screenshots:
- **Header block**: small grey "Welcome back" + bold name, with the date navigator pill on the right (`< Nov 2026 >` style → I'll use it as `< Thu, Nov 19 >`).
- **Hero card**: dark green gradient, big white number, two sub-stats split by a thin divider (like Net Worth / Cash tracked / Debt left).
- **Two small stat cards** side by side with a round tinted icon (like Income / Expense).
- **Dismissible banner card** with sparkle icon (like "Your October recap is ready") → for "Your weekly AI recap is ready" and "Weekly measurements due".
- **Alert row** with amber icon (like "You overspent…") → e.g. "You're 40g short on protein today".
- **Segmented toggle** (Sign In / Create Account, Expense / Income).
- **Horizontal scroll chips** (category chips, date chips "Today 19 Nov / Y'day 18 / Tue 17") → reuse for workout-day switcher and date picker.
- **Big dark green primary button** full width, radius 16px.
- **Floating bottom tab bar**: white, rounded, slightly translucent with backdrop blur, 4–5 tabs with icon + label; active tab filled icon.
- **Round + floating action button** in dark green, bottom right above the tab bar.
- **List rows** like the Subscriptions list: initials avatar square on the left, title + grey subtitle, value on the right, `×` to remove.
- **Progress bar** like the Education loan card (thin, rounded, light track).
- Full-screen modal sheets with `×` top-left and centred title (like "Add Transaction").
- Support **dark mode** that follows the system (dark charcoal background, same green accents).

---

## 3. Navigation

Bottom tab bar (5 tabs):
1. **Today** (dumbbell icon): today's workout logging (the main screen)
2. **Food** (utensils): calorie and macro logging
3. **Body** (ruler/scale): weight and weekly measurements
4. **Stats** (pie/chart): all progress charts
5. **Coach** (sparkles): Gemini AI coach

A gear icon in the Today header opens **Settings** (profile, goals, routine editor, exercise library, AI key, units, backup).

---

## 4. Features in detail

### 4.1 First-run onboarding (3 short screens, skippable)
- Name, sex, age, height, current weight, goal (lose fat / build muscle / recomp / maintain), activity level, units (**lb/in by default**, toggle kg/cm).
- Auto-calculate a suggested daily calorie and protein target (Mifflin-St Jeor BMR × activity, ± goal adjustment; protein ~0.8–1 g per lb of bodyweight). I can override.
- Then go straight to the **Routine builder**.

### 4.2 Routine builder (I set this up first)
- I create **workout templates** ("Push", "Pull", "Legs", "Upper", "Cardio + Abs", etc.).
- Each template has an ordered list of exercises, each with **default target sets, target reps (or rep range like 8–12), optional target weight, rest timer seconds**.
- I map each **weekday → template** (or "Rest day"). Example: Mon=Push, Tue=Pull, Wed=Legs, Thu=Rest, Fri=Upper, Sat=Lower, Sun=Rest.
- Drag to reorder exercises (use `@dnd-kit` for touch-friendly reordering). Duplicate template. Edit later at any time; editing a template **must not change past logged workouts**.

### 4.3 Exercise library
- Seed ~80 common exercises (chest, back, shoulders, biceps, triceps, legs, glutes, core, cardio) with: name, primary muscle group, secondary muscles, equipment (barbell, dumbbell, machine, cable, bodyweight, kettlebell, cardio machine).
- **Exercise types** decide the input fields:
  - `weight_reps` (weight × reps): bench press, etc.
  - `bodyweight_reps` (reps, optional added weight): pull-ups, dips
  - `time` (duration): plank
  - `cardio` (duration + distance + optional calories): treadmill, bike
- I can create custom exercises. Searchable list with muscle-group filter chips.

### 4.4 TODAY screen ⭐ most important
- On open, **automatically load the template mapped to today's weekday**. Header shows e.g. "Thursday · Push Day".
- **Workout switcher**: a horizontal chip row of all my templates ("Push · Mon", "Pull · Tue", "Legs · Wed"…). One tap switches today's session to that template. This is for when I miss a day and do it on another day. If I've already logged sets, ask in a bottom sheet: "Switch and keep logged sets / Switch and discard". Also offer "Empty workout".
- **Date chips** (Today / Y'day / Tue 17 / Mon 16…, like the Add Transaction screen) so I can log or fix a past day.
- Each exercise is a card:
  - Name, muscle tag, and a grey line **"Last time: 3 × 10 @ 135 lb"** taken from the most recent session of that exercise (any template).
  - A set table: `Set | Previous | lb | Reps | ✓`. Rows are **pre-filled with target values / last time's values** so most of the time I only tap ✓ or adjust one number.
  - Big +/- steppers for weight (step 5 lb / 2.5 kg, configurable) and reps (step 1), plus tap-to-type.
  - Tapping ✓ marks the set done (green row), and **auto-starts the rest timer** (sticky mini timer bar above the tab bar with -15s / +15s / skip, vibration via `navigator.vibrate` where supported and a sound when done).
  - "+ Add set" copies the previous set. Swipe left on a set to delete it. Optional set type: warm-up / working / drop set / failure.
  - Per-exercise note field (e.g. "seat height 4").
  - **PR badge** 🏆 when a set beats my best weight, best reps at that weight, or best estimated 1RM (Epley: `w × (1 + reps/30)`).
- **After the default exercises: "+ Add exercise"** button opens the library search (or create new). Added exercises show a small "Extra" tag. Bottom sheet asks: "Add only today" or "Also add to the Push template".
- Reorder or skip exercises for today without changing the template.
- Top hero card (green gradient like Net Worth): **session timer**, total volume (lb), sets completed / planned, with a progress bar.
- **Finish Workout** button → summary sheet: duration, volume, sets, PRs hit, comparison vs last time for this template (↑/↓ volume %), optional "How did it feel?" 1–5 rating and note. Save.
- Rest day: show a friendly card with "Log anyway" (switch to any template) and quick links to log weight and food.
- Auto-save every change instantly to IndexedDB; an in-progress workout survives the app being closed.

### 4.5 FOOD screen (calories)
- Date navigator header. Hero card: **calories eaten / goal** with a ring or bar, remaining calories, and a macro bar (protein / carbs / fat in grams vs target).
- Meals: Breakfast, Lunch, Dinner, Snacks (configurable). Each meal is a card with its items and calories.
- **Add food** sheet (copy the Add Transaction layout):
  - Quick add: name + calories (+ optional P/C/F).
  - **My foods** (saved items with serving size) and **Recent** chips for one-tap re-logging.
  - **"Describe with AI"**: I type "2 eggs, 2 slices wheat toast with butter, black coffee" → Gemini returns structured items with estimated calories and macros → I review and edit, then save.
  - **"Snap a photo"** (optional): take or upload a meal photo → Gemini estimates items and calories → review and save. Resize the image client-side before sending.
  - Copy yesterday's meal / save a meal as a reusable combo.
- Water tracker (tap a glass +8 oz) as a small card.
- Alert row (amber, like "You overspent") when over calories or under protein late in the day.

### 4.6 BODY screen (weight + weekly measurements)
- Hero card: current weight, change this week, change since start, goal weight with progress bar.
- **Quick weight log** (daily optional): big number input + Save.
- **Weekly measurements**: chest, waist, hips, neck, left/right arm, left/right thigh, calves, body-fat % (optional), each optional. Show a banner "Weekly check-in due" on my chosen day (default Sunday) if not logged yet that week.
- Show last value next to each field and the delta after entering.
- Optional progress photo per check-in (stored locally as compressed blobs, never uploaded unless I send it to AI).
- History list of check-ins (like Subscriptions rows) with edit/delete.

### 4.7 STATS screen: make this really good
Top segmented toggle: **Gym | Body | Nutrition**, plus a range selector chip row: 4W / 12W / 6M / 1Y / All.

**Gym**
- Workouts per week bar chart + current streak + a **GitHub-style consistency heatmap** (calendar of training days, coloured by volume).
- Weekly total volume (line/bar), with % change vs previous period.
- **Per-exercise progress**: pick an exercise → line chart of best set weight and estimated 1RM over time, plus a PR history list.
- **Muscle group split**: donut chart of sets per muscle group this week vs a target (e.g. 10–20 sets/muscle/week) shown as horizontal bars. Highlight under-trained muscles.
- Planned vs completed: adherence % (scheduled days vs days actually trained).
- Top PRs this month cards.

**Body**
- Weight chart with a **7-day moving average trend line** on top of the raw points, plus goal line.
- Measurement trends (multi-select which measurements to show), waist-to-height ratio.
- Weekly rate of change (lb/week) with a note if it's too fast or slow for my goal.

**Nutrition**
- Daily calories vs goal bar chart (bars red when over, green when within ±5%).
- Average calories and protein per week, days protein target hit.
- Macro split donut.
- **Combined chart**: weekly avg calories vs weekly weight change, to see whether my intake is working.

Each section ends with 2–3 auto-generated plain-English insight cards computed locally (no AI needed), e.g. "Bench 1RM up 6% in 4 weeks", "Legs trained only 1×/week lately", "Avg 1,950 kcal, 250 below target".

### 4.8 COACH screen (Gemini AI)
**Important context:** my Google AI Pro subscription is for the Gemini app. API calls need a separate **Gemini API key from Google AI Studio** (aistudio.google.com/apikey), which has a free tier for Flash models. Build for that.

- Settings field to paste the **Gemini API key**, stored only on device (IndexedDB/localStorage). **Never hard-code a key or commit one to the repo.** Show a "Test connection" button.
- **Model is configurable** in Settings. Default to the current Gemini Flash model; add a "Load available models" button that calls the `models.list` endpoint and lets me pick. Don't hard-code a model name that may be retired; keep it in one config constant.
- Call the REST API directly from the browser (`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`) with the key in the `x-goog-api-key` header. Wrap it in `src/services/gemini.ts`. Use `responseMimeType: "application/json"` + a `responseSchema` wherever I need structured output (food parsing, plan suggestions).
- Also create an **optional** `cloudflare-worker/` folder with a tiny proxy Worker (free tier) that holds the key as a secret, plus instructions, in case I later want the key off the device. The app should support either "direct key" or "proxy URL" mode.
- Build a **context builder** (`src/services/coachContext.ts`) that summarises my data into compact JSON (not raw dumps): profile and goals, routine, last 4 weeks of workouts (per exercise: best sets, volume trend, e1RM trend), PRs, missed days, weight trend and measurements, average calories/protein vs targets.
- Coach UI:
  - **Weekly recap card** (like "Your October recap is ready" banner on Today): generated once per week on demand: wins, what slipped, 3 specific actions for next week.
  - **Quick prompt chips**: "Should I increase weight on anything?", "Am I eating enough protein?", "Why is my weight stalling?", "Suggest a deload", "Adjust my routine for weak points", "Plan today's meals to hit my macros".
  - Chat with message history (saved locally), markdown rendering of answers.
  - **Actionable suggestions**: when the AI suggests progressive overload (e.g. "increase bench to 145 lb"), return structured JSON and show an "Apply to template" button that updates the target weight/reps after I confirm.
- System prompt for the coach: evidence-based strength and nutrition coach, uses only the provided data, is concise and specific with numbers, flags if data is insufficient, never gives medical advice, and recommends seeing a professional for pain or injury.
- Graceful handling: no key → friendly setup card; offline → "Coach needs internet"; 429 rate limit → retry message.

### 4.9 Settings
- Profile and goals (calorie and macro targets, goal weight, weekly check-in day).
- Routine builder and weekday mapping, exercise library.
- Units (lb/kg, in/cm), weight increment step, default rest timer.
- AI: API key / proxy URL, model picker, test button.
- **Backup**: Export all data as JSON (download/share via the iOS share sheet), Import JSON (with merge/replace option), Export CSV of workouts, food, and body. Show a reminder every 2 weeks: "Back up your data". This matters because data lives only on the phone.
- Theme: system / light / dark.
- "Reset all data" with typed confirmation.

---

## 5. Data model (Dexie tables; use string UUIDs and ISO dates)

```
profile           { id, name, sex, birthYear, heightIn, units, goal, activityLevel, calorieTarget, proteinG, carbsG, fatG, goalWeight, checkInDay, createdAt }
exercises         { id, name, type, primaryMuscle, secondaryMuscles[], equipment, isCustom, archived }
templates         { id, name, color, exercises: [{ exerciseId, order, targetSets, targetRepsMin, targetRepsMax, targetWeight, restSec }] , archived }
weekSchedule      { weekday (0-6), templateId | null }
workoutSessions   { id, date (YYYY-MM-DD), templateId|null, templateNameSnapshot, startedAt, endedAt, status ('in_progress'|'done'), rating, note }
sessionExercises  { id, sessionId, exerciseId, order, isExtra, note }
sets              { id, sessionExerciseId, sessionId, exerciseId, order, setType, weight, reps, durationSec, distance, completed, completedAt, isPR }
foods             { id, name, servingDesc, calories, protein, carbs, fat, isFavorite, lastUsedAt }
foodLogs          { id, date, meal, foodId|null, name, servings, calories, protein, carbs, fat, source ('manual'|'ai'|'photo') }
water             { date, oz }
bodyWeights       { id, date, weight }
measurements      { id, date, chest, waist, hips, neck, armL, armR, thighL, thighR, calves, bodyFat, photoBlobId|null, note }
photos            { id, blob, createdAt }
coachMessages     { id, role, content, createdAt, structured? }
settings          { key, value }
```
Index `sets` by `exerciseId` and `sessionId`, `workoutSessions` by `date`, `foodLogs` by `date`. Version the schema with Dexie migrations so future changes don't wipe data.

---

## 6. Code quality
- Folder structure: `src/{components,features/{today,food,body,stats,coach,settings,onboarding},db,services,hooks,lib,styles}`.
- Pure functions for calculations (`lib/calc.ts`: e1RM, volume, moving average, BMR/TDEE, streaks, PR detection, adherence) with **Vitest unit tests**.
- Reusable UI primitives that match the design: `Card`, `HeroCard`, `StatCard`, `SegmentedControl`, `ChipRow`, `BottomSheet`, `Stepper`, `ProgressBar`, `TabBar`, `Fab`, `Banner`, `AlertRow`, `EmptyState`.
- Seed a **demo data generator** (Settings → Developer → "Load 8 weeks of sample data") so the charts can be checked without real data; clearable.
- Smooth but light animations (Framer Motion or CSS); 60fps on iPhone.
- Accessibility: labels on icon buttons, sufficient contrast.
- No console errors; `npm run build` and `npm run test` must pass.

---

## 7. Build phases (do them in order, verify each)
1. **Scaffold**: Vite + React + TS + Tailwind + PWA plugin + router + fonts + design tokens + TabBar/primitives + app icon + manifest. Confirm it builds.
2. **Data layer**: Dexie schema, seed exercise library, onboarding, settings, routine builder and weekday mapping.
3. **Today screen**: full logging flow, workout switcher, date chips, add extra exercise, rest timer, PRs, finish summary. This must be polished.
4. **Food** screen (manual + saved + recent; AI parsing wired in phase 7).
5. **Body** screen (weight + weekly measurements + photos).
6. **Stats** screen with all charts + local insights + demo data generator.
7. **Gemini integration**: service, context builder, Coach screen, AI food parsing and photo estimate, apply-suggestion flow, optional Cloudflare Worker proxy.
8. **Backup/export/import**, dark mode, offline test (build + `vite preview`, then toggle offline in devtools), Lighthouse PWA check.
9. **Deploy**: GitHub Actions workflow for GitHub Pages, and write `README.md` with:
   - how to run locally (`npm i`, `npm run dev`, and how to open it on my iPhone on the same Wi-Fi with `--host`)
   - step-by-step GitHub Pages deploy
   - **how to install on iPhone** (Safari → Share → Add to Home Screen)
   - how to get a free Gemini API key in Google AI Studio and paste it in Settings
   - backup advice (export JSON regularly; data is per-device and lost if I delete the home screen app)

When you finish, give me a short summary of what was built, anything you couldn't do, and the exact commands to run and deploy.
