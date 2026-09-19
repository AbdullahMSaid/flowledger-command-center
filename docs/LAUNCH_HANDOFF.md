# FlowLedger launch handoff

## What is implemented

- A unified light-mode workspace shell and simplified primary dashboard inspired by compact observability products: scoped metrics, one attention strip, one flow inventory, one spend chart, and a conspicuous Add flow action.
- Responsive desktop table and mobile flow-card inventory, verified at 1440×900 and 390×844.
- Progressive Add flow: essential fields first, optional governance fields behind More options, safe pending experiment defaults, then connection guidance.
- Flow Detail tabs for Overview, Activity, Spending, Controls, and Settings; Spending has period controls and workflow drilldowns.

- Public `/demo` with deterministic virtual time, replay, detection, pre-execution block semantics, incident evidence, policy adjustment, resume, and reversible reset.
- Standalone synthetic `/demo`, `/demo/spending`, `/demo/management`, `/demo/replay`, and workflow-detail experiences. Synthetic records are isolated and excluded from live totals.
- Authenticated `/dashboard` and `/command-center` backed by the existing Supabase client, workspace membership, RLS, and server-side aggregates.
- Workspace roles: `admin` and `member`. Workspace visibility is enforced through RLS and server-side functions.
- Additive governance fields on the existing `flows` entity: owner, team, purpose, lifecycle, approval/review, protection, control, budget, and value estimate fields.
- Authenticated, idempotent `ingest` telemetry. Recorded incurred cost is separate from guidance about whether the next request should run.
- Workspace-scoped in-app alert rules and history; unsupported email and outbound webhook controls are intentionally unavailable.
- Event-driven server signals evaluate configured alert rules with a 15-minute cooldown, create/update explainable spend incidents from live run telemetry, and preserve denied-request evidence.
- Guard reservation and settlement functions. The checked-in example uses a deterministic mock provider and never calls a paid model.
- One-time, revocable per-flow credentials stored only as hashes.
- Admin-only policy updates, reviews/promotions, incident resolution, emergency-stop controls, and audit entries.
- Authoritative management and flow-detail aggregates that exclude `synthetic_demo` rows.
- Audited archival preserves run history and costs; authenticated hard deletes are revoked.
- Management governance forms persist accountable owner, budget owner, team, and business purpose through workspace-validated RPCs. Inventory filters cover owner, team, environment, platform, model, and approval.
- Summary metrics distinguish the selected reporting period from month-to-date spend and suppress monthly projections until one full day of data exists.
- The authenticated operations dashboard reads daily/monthly spend from workspace-scoped server aggregates, uses exact database counts for daily runs, and applies UTC day/month boundaries.

## Data boundaries

| Surface | Data source | What it proves |
| --- | --- | --- |
| `/demo` | Local deterministic fixtures | Product story and interaction only; no provider or production calls |
| `/demo` | Local deterministic fixtures | Simplified synthetic operations dashboard |
| `/demo/spending` | Local deterministic fixtures | Spend trend and workflow spend breakdown |
| `/demo/management` | Local deterministic fixtures | Review queue with local-only decisions |
| `/demo/replay` | Local deterministic fixtures | Runaway-agent incident replay |
| Signed-in `/dashboard` | Supabase, or labeled development preview fixtures | Account overview and workflow inventory |
| Signed-in `/analytics` | Supabase, or labeled development preview fixtures | Account spending view |
| Signed-in `/command-center` | Supabase, or labeled development preview fixtures | Account review queue (preview) / existing governance controls (live) |
| Authenticated dashboard | Existing Supabase workspace data | Registered workflows and reported telemetry visible to the signed-in member |
| Authenticated Command Center | Supabase RPC aggregates, inventory, incidents | Workspace-scoped operational and governance state |
| `examples/guarded-agent.mjs` | Supabase Edge Functions plus deterministic mock provider | A cooperating runner can refuse provider execution after a denied guard decision |

No current feature claims automatic discovery of private employee activity, physical cancellation of an external workflow, email delivery, outbound webhook delivery, provider adapters, rate limiting, billing, or automatic business-outcome instrumentation.

## Verification evidence

Passed locally:

```bash
npm ci
npm run build
npm test -- --run
npm run lint
npm run typecheck
git diff --check
```

The build and tests pass. Lint has zero errors and seven Fast Refresh warnings in shared UI components; the earlier three lint errors were fixed.

Browser-verified locally:

- `/demo` renders without Supabase credentials.
- `/demo/management` renders the isolated synthetic review queue; `/command-center` is reserved for the signed-in account view.
- Command Center filters render and expose workflow, owner, team, environment, platform, model, and approval dimensions.
- The policy shortcut applies the safer policy and restores the original policy.
- Replay controls and responsive layout render at the local preview URL.
- The full 48-second replay completed locally and showed warning, `REQUEST BLOCKED`, seven blocked requests, incident evidence, safer policy, and reversible restoration of the original policy.

Not yet integration-verified:

- Remote Supabase migration/function deployment.
- RLS and RPC tests across two workspaces and admin/member roles.
- Reservation concurrency, settlement races, and UTC budget-boundary tests.
- Authenticated browser walkthrough against populated remote workspace data.
- `npm run verify:guard` smoke gate against a configured local/staging project.
- Event-driven signal behavior and database concurrency under a running Supabase/Postgres instance.
- Governance editor and persisted month-to-date summary behavior against a configured workspace.
- Authenticated mobile QA against populated remote workspace data. The synthetic preview was inspected at 390×844, and the full timed replay was completed locally with warning → pre-execution block, incident evidence, safer policy, and restoration.

Mobile and desktop layout QA is now complete for the simplified local preview dashboard. Authenticated mobile QA against a populated Supabase workspace remains unverified.

## Production blockers that remain open

- Run the additive schema in a real Supabase/Postgres environment and execute every RLS/RPC path for admin, member, removed creator, assigned member, and unrelated workspace identities.
- Qualify same-name PL/pgSQL output variables/columns in management RPCs and execute them under the target Postgres settings.
- Verify guard admission and settlement share a durable locking protocol, preserve emergency-stop state, reconcile ingest/settlement order, expose cancellation/reconciliation, and prevent duplicate provider execution at the runner boundary.
- Standardize aggregate semantics for archived history, `synthetic_seed`, experiment transition periods, selected periods, and value coverage. Missing aggregates must remain unavailable rather than display as zero.
- Replace high-volume browser chart aggregation with server buckets or complete pagination.
- Finish a single audited credential rotate/revoke lifecycle and migrate all Setup tabs to the workspace-aware, authenticated flow creation path.
- Remote migrations, Edge Function deployment, Netlify configuration, and production publishing remain unauthorized and were not performed.

## Local commands

```bash
npm ci
npm run dev -- --host 127.0.0.1
npm run build
npm test -- --run
npm run verify:guard
npm run verify:workspace
```

`verify:guard` is a configured local/staging smoke check. Supply `FLOWLEDGER_URL`, `FLOW_ID`, and `FLOWLEDGER_FLOW_CREDENTIAL`; set `GUARD_TEST_MAX_COST_USD` above the remaining policy budget with `EXPECT_GUARD_DENIAL=1` to prove denial occurs before the counted provider callback. On an allowed request it settles twice and asserts the same run ID is returned, proving settlement idempotency.

`verify:workspace` signs in the provisioned admin and member users, verifies shared workspace reads and admin aggregation, proves member policy mutation is denied, and optionally verifies an outsider cannot read the workspace when `FLOWLEDGER_OUTSIDER_EMAIL` and `FLOWLEDGER_OUTSIDER_PASSWORD` are supplied.

For authenticated local development, create `.env.local` from `.env.example` with the existing Supabase project's public URL and anon key. The public demo does not require those variables.

For a Supabase-free local UI check, open `/login` and select **Enter sample workspace**. This development-only session shows isolated preview data, is labeled `Local preview · signed in`, and never grants access to live data. It is not enabled in production builds.

## Final navigation and sample-simulation polish

- Product Help uses `/docs?mode=demo`, `/docs?mode=preview`, or `/docs?mode=account` to retain the shared shell and active context. The marketing documentation remains available at plain `/docs`.
- The replay uses `/demo/replay?mode=demo` or `/demo/replay?mode=preview`. It is always a deterministic synthetic example and provides direct Overview navigation through the shared shell.
- Sample Overview has **Simulate activity** controls. “Load 1 week” and “Load 1 month” replace—not accumulate—the local sample scenario, and persist across ordinary navigation/reload. The scenario updates Overview, Spending, flow detail, and sample attention from one isolated local dataset. **Reset sample** returns that mode to seeded data.
- Final browser checks passed for distinct landing entry links, demo/preview shell continuity, Help/replay one-click Overview return, and cross-view scenario totals. The reset button was not clicked during final QA so the tester’s current synthetic sample state was retained. No live Supabase account, remote migration, provider, Netlify, or production data action was performed.

## Existing Supabase/Netlify staging path

Review the additive migrations against the connected project before applying them. The repository's project reference is in `supabase/config.toml`.

```bash
supabase login
supabase link --project-ref oqteckpmfkbopbjznyie
supabase db push
supabase functions deploy ingest
supabase functions deploy guard
supabase functions deploy settle
supabase functions deploy credentials
```

Set the frontend's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify. Set `SUPABASE_SERVICE_ROLE_KEY` only in Supabase Edge Function secrets. Never commit those values or place a service-role key in the Vite bundle.

For a local/staging two-user permission test, supply the service-role key and two credential pairs through environment variables, then run `npm run provision:workspace`. The script creates or reuses the users, relies on the workspace-provisioning trigger for the admin's private workspace, and adds the second user as a member without printing passwords.

These commands are deployment instructions. They were not run during this build.

## 60-second recording script

1. Open `/demo` and identify the synthetic-only scope.
2. Start the runaway-agent replay.
3. Show the virtual clock moving from baseline to warning to blocked.
4. Point to the evidence: baseline, current rate, detection rule, and blocked request.
5. Apply `Narrow scope + lower rate`, then show that it can be restored.
6. Open `/demo/management` and complete a local-only review decision; explain that the queue owns approval, ownership, and next-review work while the workflow detail holds the supporting context.
7. If showing the authenticated path, call out that telemetry and aggregate data are workspace-scoped and synthetic demo records are excluded.
8. Close with the guard example: authorization occurs before the provider callback; settlement records actual incurred cost afterward.

## Draft LinkedIn post

I built FlowLedger to make AI workflow spending observable and controllable before a runaway automation becomes an expensive surprise.

The prototype tracks registered workflows, ownership, reported cost, governance gaps, and review state. Its guard path makes a pre-execution authorization decision, reserves the requested budget, and records the actual result separately. The public demo shows the failure mode with deterministic synthetic traffic; the authenticated path uses Supabase workspace controls and server-side aggregates.

Demo: [link to be added]

I would value feedback on the management workflow, the guard/settlement protocol, and what evidence teams need before approving an AI workflow for production.

This is a prototype, not a claim of customer savings, universal integrations, or endorsement by any individual or company.
