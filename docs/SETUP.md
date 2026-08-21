# Production setup

Complete these steps in order. Nothing in this repository creates paid resources or deploys automatically until you push it and configure the workflows.

## 1. Create Supabase

Create a new project in the Supabase Dashboard and keep its project reference and database password.

Install and authenticate the CLI:

```bash
npm install --global supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

For local Supabase development, use `supabase start`, then `supabase db reset`.

## 2. Invite yourself

Run this in the Supabase SQL editor, using lowercase:

```sql
insert into public.allowed_users (email)
values ('your-google-email@example.com')
on conflict (email) do nothing;
```

Repeat it for each friend. Removing an email immediately blocks that account through RLS and the analysis function, without deleting its historical data.

## 3. Configure Google sign-in

In Google Cloud:

1. Create or select a project.
2. Configure the OAuth consent screen.
3. Create a Web OAuth client.
4. Add the Supabase callback shown under **Authentication → Providers → Google** as an authorized redirect URI. It normally looks like `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.

In Supabase:

1. Enable the Google provider and add its client ID and secret.
2. Under **Authentication → URL Configuration**, set the production Site URL to the GitHub Pages URL.
3. Add both local and production redirect URLs, for example:
   - `http://localhost:5173/**`
   - `https://YOUR_GITHUB_USER.github.io/YOUR_REPOSITORY/**`

## 4. Configure frontend variables

Copy `.env.example` to `.env` and fill in:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_VAPID_PUBLIC_KEY=added-in-step-6
```

These values are public application configuration. Never add the service-role key or OpenAI key to a `VITE_` variable.

## 5. Configure OpenAI securely

Set secrets inside the Supabase project:

```bash
supabase secrets set OPENAI_API_KEY=YOUR_OPENAI_API_KEY
supabase secrets set OPENAI_MODEL=gpt-5.6-luna
supabase secrets set AI_DAILY_LIMIT=30
supabase secrets set APP_ORIGINS=http://localhost:5173,https://YOUR_GITHUB_USER.github.io
```

`OPENAI_MODEL` is configuration rather than a secret, but keeping it server-side lets you change models without rebuilding the PWA.

Deploy the analysis function:

```bash
supabase functions deploy analyze-meal
```

The function validates the Supabase user, email allowlist, input size, daily limit, OpenAI refusal/incomplete states, and the structured response before returning it.

## 6. Configure Web Push

Generate a VAPID key pair locally:

```bash
npx web-push generate-vapid-keys
```

Put the public key in `.env` as `VITE_VAPID_PUBLIC_KEY`. Put the private values in Supabase secrets:

```bash
supabase secrets set VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY
supabase secrets set VAPID_PRIVATE_KEY=YOUR_PRIVATE_KEY
supabase secrets set VAPID_SUBJECT=mailto:you@example.com
supabase secrets set APP_URL=https://YOUR_GITHUB_USER.github.io/YOUR_REPOSITORY/
supabase secrets set CRON_SECRET=GENERATE_A_LONG_RANDOM_VALUE
```

Deploy:

```bash
supabase functions deploy send-reminders --no-verify-jwt
```

It intentionally uses `--no-verify-jwt` because it is invoked by Cron, but it rejects every request without the separate `x-cron-secret` header.

Enable Supabase Cron, `pg_net` and Vault. In **Integrations → Vault**, add
`nutrilens_function_url` and `nutrilens_cron_secret` exactly as described at
the top of `supabase/snippets/configure_reminder_cron.sql`, then run that
snippet. Cron runs every five minutes; the function declares newly completed
Leaderboard periods and then decides whether a fixed Europe/Zagreb reminder is
due. This keeps daylight-saving logic out of UTC Cron expressions and keeps the
Cron credential encrypted rather than embedded in the scheduled command.

## 7. Test locally with real services

```bash
supabase functions serve --env-file supabase/.env.local
npm run dev
```

Copy `supabase/functions.env.example` to the ignored file `supabase/.env.local` first.

Test at least:

- invited Google account can sign in;
- a non-invited account cannot read/write data or analyse food;
- manual meal save and delete;
- text and photo estimates, including repeated review-screen corrections;
- meal detail components, favourite toggling and one-tap repeat logging;
- profile goal changes persist after a reload;
- refusal, timeout and daily-limit errors;
- two users cannot directly query each other’s meals or profiles;
- an invited user can see every invited Player in Today, Week, and Month standings;
- a Player meal view contains names, times, nutrition, and components but no notes, email, favourites, source, confidence, or AI metadata;
- historical meal access succeeds only for a stored Champion’s exact winning period;
- weekly/monthly declaration is idempotent, applies the four/fifteen-day thresholds, and stays unchanged after later meal edits;
- removing an email from `allowed_users` removes that Player and their public meals while preserving their historical trophy snapshot;
- notification subscription from each target phone/browser;
- duplicate Cron calls produce one delivery per subscription and slot.

## 8. Configure GitHub

Create a repository and push this local Git repository when ready. In repository **Settings → Pages**, choose **GitHub Actions** as the source.

Add Actions variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- optionally `VITE_PRIVACY_URL`

Add Actions secrets used only to deploy Supabase:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`

Do not put `OPENAI_API_KEY`, `VAPID_PRIVATE_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in the frontend workflow.

## 9. Before inviting friends

- Set a monthly OpenAI project budget and usage alerts.
- Test 30–50 representative meals and compare `gpt-5.6-luna` with a stronger configured model if needed.
- Publish a short privacy notice explaining that photographs are sent to OpenAI for analysis.
- Confirm your intended calorie and macro defaults; current defaults are 2200 kcal, 140g protein, 245g carbs, 70g fat and 30g fiber.
- Adjust fixed times in both `src/lib/constants.ts` and `supabase/functions/send-reminders/index.ts` if desired.
