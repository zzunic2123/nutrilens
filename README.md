# NutriLens

NutriLens is a lightweight, installable calorie and macro journal built for a small invite-only group. It supports photo analysis, natural-language meal descriptions, manual entry, daily and weekly insight views, and fixed Web Push reminders.

The application works immediately in a polished local demo mode. Connecting Supabase enables real accounts and persistence; connecting OpenAI enables structured food analysis.

## What is implemented

- Responsive Preact + TypeScript PWA with desktop sidebar and mobile bottom navigation
- Persistent sample-data mode for product review before backend setup
- Google authentication flow through Supabase Auth
- Photo, text and manual meal-entry paths
- Browser-side photo resizing, metadata removal and compression
- Mandatory edit/confirmation screen before AI estimates are saved
- One aggregate database row per meal—no `meal_items` table
- Strict OpenAI Responses API JSON Schema
- Daily calories, protein, carbohydrates, fat and fiber progress
- Seven- and thirty-day reports with custom lightweight SVG/CSS charts
- Deterministic, goal-based guidance instead of extra AI calls
- Per-user Postgres Row Level Security and email allowlist
- Fixed reminders in code, Web Push subscriptions and duplicate-delivery protection
- Dark, light and system appearance modes
- GitHub Pages and Supabase deployment workflows
- Unit tests for nutrition, dates, image sizing and the AI response validator

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Preact, TypeScript, Vite |
| PWA | Vite PWA / Workbox, custom push service worker |
| Icons and UI | Lucide, custom CSS, bundled Manrope variable font |
| Authentication and database | Supabase Auth + Postgres + RLS |
| Server code | Supabase Edge Functions (Deno/TypeScript) |
| AI | OpenAI Responses API with image input and strict Structured Outputs |
| Scheduling | Supabase Cron invoking an Edge Function |
| Static hosting | GitHub Pages |

## Run immediately

Requirements: Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Without environment variables, NutriLens opens with local sample data. Changes made in demo mode are kept in browser storage. Use **Settings → Reset sample data** to restore the original week.

Useful checks:

```bash
npm run typecheck
npm test
npm run build
```

With the development server running, `npm run visual:check` exercises the main
capture and review flow in Chrome and saves light/dark screenshots under `/tmp`.
Set `CHROME_PATH` if Chrome is installed somewhere other than
`/usr/bin/google-chrome`.

## Connect the real backend

Follow [docs/SETUP.md](docs/SETUP.md) in order. The short version is:

1. Create one Supabase project.
2. Apply `supabase/migrations`.
3. Add your email to `allowed_users`.
4. Configure Google Auth and redirect URLs.
5. Add Supabase public values to `.env`.
6. Add `OPENAI_API_KEY` only to Supabase Project Secrets.
7. Deploy both Edge Functions.
8. Generate VAPID keys and configure the fixed reminder Cron job.

## Data model

- `profiles`: display name, targets, timezone and push preference
- `allowed_users`: invite-only email allowlist
- `meals`: one confirmed total per meal
- `ai_usage`: request ID, model and token counts—never photos or prompts
- `push_subscriptions`: browser delivery endpoints and Web Push public encryption material
- `notification_deliveries`: idempotency records preventing duplicate notifications

Detected foods in an AI response are transient review information. They are deliberately not saved as separate database items.

## Privacy and accuracy

- The OpenAI key never enters the browser or GitHub Pages build.
- Photos are compressed in the browser, sent through an authenticated Edge Function and not written to Supabase Storage or Postgres.
- AI inputs are not recorded in `ai_usage`.
- The app requires user confirmation before an estimate becomes a meal.
- Food-photo nutrition values are estimates, especially for portions, oils, sauces and hidden ingredients.
- Guidance is informational and is not medical advice.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the request and security boundaries.
