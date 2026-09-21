# FlowLedger environments and go-live runbook

## The important distinction

This repository has two intentional operating modes:

| Mode | When it is used | Sign-in and data behavior |
| --- | --- | --- |
| Local synthetic preview | A Vite **development** server has no Supabase variables | `/demo` is public; `/login` can enter a browser-only sample workspace. All activity, spend, budgets, reviews, and resets are stored only in local browser storage. |
| Authenticated Supabase workspace | The frontend has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` | Standard Supabase email/password and Google sign-in are used. Workspace records, workflows, and reported telemetry come from Supabase. |

The local preview is deliberately excluded from production builds (`import.meta.env.DEV`). It is not a fallback production login and must never be used as a deployed credential.

Pushing `main` publishes the application code. It does **not** by itself configure Netlify variables, apply Supabase migrations, deploy Edge Functions, or configure Supabase Auth. The normal site will use usual sign-in only after those live services are configured.

## 1. Run locally with synthetic demo data

Use this for interface work, demos, and safe product testing without a database or provider connector.

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 8080
```

Do **not** create `.env.local` for this mode. Then:

1. Open `/demo` for the public sample workspace.
2. Open `/login` and choose **Enter sample workspace** for the local signed-in preview.
3. Use **Reset sample** to clear only that browser mode's local sample data.

Demo-created workflows receive intentionally fabricated, clearly labeled spend, budget, and activity. Preview-account workflows do not invent financial data; they remain empty and prompt connector setup. Neither mode contacts Supabase or a provider.

The local preview works only with `npm run dev`. It will not appear after `npm run build` / `npm run preview`, nor on Netlify.

## 2. Run locally against a real Supabase project

Use a non-production Supabase project first whenever possible.

```bash
cp .env.example .env.local
```

Set only public browser values in `.env.local`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

Then run:

```bash
npm run dev -- --host 127.0.0.1 --port 8080
```

The normal Supabase login screen will now appear. Sign in with a real test user created in that Supabase project. The browser must never receive `SUPABASE_SERVICE_ROLE_KEY`.

Before using a project that does not already have this application's schema and functions, follow the deployment sequence below against that project's reference—not blindly against production.

## 3. Prepare Supabase for a live workspace

These are remote, state-changing commands. Review the migrations and verify the selected project before running them.

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push

supabase functions deploy ingest
supabase functions deploy guard
supabase functions deploy settle
supabase functions deploy credentials
```

The migrations in `supabase/migrations/` create the workspace, flow, telemetry, policy, review, credential, and aggregate-query support expected by the live UI.

For Edge Functions, ensure `SUPABASE_SERVICE_ROLE_KEY` is available to the Supabase runtime. It is server-only: never add it to `.env.local` as a `VITE_` value or to Netlify. If a project does not provide the secret automatically, set it only as an Edge Function secret:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Optional development/staging workspace provisioning requires server-only variables and creates users. Run it only against a non-production project unless those accounts are intended:

```bash
npm run provision:workspace
```

## 4. Configure Netlify for the normal site

In Netlify, set these **production** environment variables for the site that deploys `main`:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

They are Vite build-time variables, so trigger a new production deploy after changing them. The repository's `netlify.toml` already uses `npm run build`, publishes `dist`, and redirects SPA routes to `index.html`.

For Supabase Auth, add the normal site's URL to Supabase Auth URL configuration and add the deployed callback URL used by the app:

```text
https://YOUR_NORMAL_SITE/dashboard
```

If Google sign-in is enabled, configure the Google provider in Supabase and ensure its authorized redirect URI matches the Supabase project's auth callback URL. Email/password sign-in requires a real user in Supabase Auth and the project's email-confirmation policy to match your intended onboarding.

## 5. Safe production verification order

Before deploying:

```bash
npm run typecheck
npm test -- --run
npm run build
```

After Netlify finishes deploying `main`:

1. Confirm `/demo` remains synthetic and publicly available.
2. Confirm `/login` shows standard Supabase login—not **Enter sample workspace**.
3. Sign in with a non-admin test account and confirm it sees only its permitted workspace.
4. Create a workflow and confirm it asks for connector setup, with no fabricated spend or budget.
5. Connect one non-production workflow, send one authenticated telemetry event, and verify its spend appears only in that workspace.
6. Exercise one guard denial and settlement with `npm run verify:guard`; verify member/admin access with `npm run verify:workspace` when the required test credentials are set.

Do not point a provider connector at a production workflow until the staging checks above pass and the budget/guard behavior has been reviewed by the workspace owner.

## Current status after this code push

The application code, migrations, and Edge Function source are on `main`. The local checkout cannot confirm the current Netlify environment variables, live Supabase migration state, deployed Edge Function versions, Auth redirect URLs, or provider credentials. Treat the live sign-in path as ready in code but unverified in the remote environment until the checklist above is completed.
