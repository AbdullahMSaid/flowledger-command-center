# FlowLedger implementation progress

## Current production checkpoint — September 20, 2026

This section is authoritative. Older sections below preserve implementation history and may describe gates that have since been completed.

### Repository and deployment

- Repository: `AbdullahMSaid/flowledger-command-center`, branch `main`.
- Production: [flowledgerai.com](https://flowledgerai.com), deployed automatically by Netlify from `main`.
- Supabase project: `oqteckpmfkbopbjznyie`; all checked-in migrations through `20260920170000_seed_workflow_sample_activity.sql` match the remote migration history.
- Latest functional commit: `24d0e7c` (`feat: combine workflow creation and connection setup`).
- Latest documentation commit: `c604720`.
- Credentials and test-account passwords are intentionally absent from repository files.

### Working product surfaces

| Surface | Purpose | Data boundary |
| --- | --- | --- |
| `/demo` | Public simplified product demo | Local deterministic synthetic data |
| `/demo/spending` | Demo spend view | Same isolated sample workspace |
| `/demo/management` | Demo reviews/governance | Same isolated sample workspace |
| `/demo/replay` | Runaway-agent guard replay | Synthetic only; no provider calls |
| `/dashboard` | Signed-in overview and workflow inventory | Authenticated Supabase workspace |
| `/flows/:id` | Selected workflow management | Authenticated, workspace-scoped data |
| `/analytics` | Signed-in spend, runs, and token analysis | Authenticated Supabase workspace |
| `/command-center` | Portfolio reviews, incidents, governance, and value evidence | Authenticated Supabase workspace |
| `/setup` | Connection guidance | Authenticated shell and account context |
| `/docs?mode=account` | Signed-in help | Account-context navigation |

Demo routes never read account data. Signed-in routes require a real Supabase session and no longer substitute demo records when live queries fail.

### Completed manager workflow

1. **Add workflow** collects name, source/platform, model, owner/team, responsibility, and optional description.
2. The same window immediately offers:
   - **Connect real activity:** workflow-specific ingest endpoint plus one-time scoped reporting-key issuance. Provider master keys remain with the provider.
   - **Generate sample activity:** 24 clearly labeled `synthetic_seed` hourly runs with varied tokens, duration, and spend. No provider is called.
3. Selecting a workflow opens its own control surface with Overview, Activity, Spending, Controls, and Settings.
4. **Edit workflow** changes name, owner/team label, platform, model, responsibility, and description, with persisted feedback.
5. **Budgets** supports daily and monthly USD limits plus Monitor-only or Guard-connected protection.
6. **Pause/resume** controls new guarded admissions and does not claim to stop an uninstrumented external provider.
7. **Archive** removes a workflow from the active dashboard, blocks future guarded admissions, and preserves activity, spend, incidents, and its direct historical detail page.

The workflow page—not the generic command center—is now the primary place to manage a selected agent. The authenticated command center no longer links users into the synthetic replay.

### Live acceptance evidence

The production account was used only with the user-authorized test credentials; credentials were not saved or printed in project files.

Verified live:

- Signed-out `/command-center` redirects to `/login`.
- Signed-in `/command-center` renders authenticated workspace data without the prior `production_count` null crash.
- Workflow creation persists after reload with the correct workspace and no automatic fabricated spend.
- Identity/responsibility editing and daily/monthly budgets persist after reload.
- Archive removes the workflow from the active list while its archived detail and accounting view remain accessible.
- Settings retains Overview/Spending/Reviews/Settings/Help navigation.
- Authenticated Reviews has no link into `/demo/replay`.
- Combined onboarding generated 24 sample runs, 31,419 tokens, and $0.26 for a disposable n8n workflow. All 24 rows reloaded as `synthetic_seed`; the disposable workflow was then archived.
- The six pre-existing account workflows were preserved.

Live business-manager scenario now present:

| Workflow | Owner / team | Source / model | Daily | Monthly | State |
| --- | --- | --- | ---: | ---: | --- |
| Out-of-office responder | Maya / Operations | Claude Code / Claude Sonnet | $2 | $30 | Active, monitor only |
| Invoice extractor — OpenRouter | Eric / Sales | n8n / OpenRouter | $5 | $100 | Active, monitor only |
| AI support triage | Sam / Engineering | Zapier / ChatGPT | $10 | $250 | Active, monitor only |
| Lab research assistant — Jared | Jared / Lab | Custom / Claude | $1 | $15 | Archived; history preserved |

### Production database and function repairs

- `05d2250`: authenticated production routes now wait for the Supabase session and redirect signed-out users.
- `ab660a0` plus `20260920143000`: Reviews null safety and canonical `Monitor only` insert/RLS contract.
- `0af1462`: selected-workflow editing, budgets, connection section, pause/resume, and archive UI.
- `eab1cd7` plus `20260920160000`: fixed ambiguous columns in `set_flow_policy`.
- `634cc3f` plus `20260920161500`: fixed ambiguous columns in `archive_flow`.
- `bf25acc`: business owner/team dashboard display and removal of authenticated demo-replay link.
- `24d0e7c` plus `20260920170000`: combined creation/connection/sample onboarding.
- Supabase `credentials` Edge Function is deployed. It revokes the previous active key when issuing a replacement and returns plaintext only once; hashes remain server-side.

### Verification status

Latest local checks passed:

```bash
bun run typecheck
bun run test      # 5 files, 10 tests
bun run build
bun run lint      # zero errors; seven existing Fast Refresh warnings
```

Production browser acceptance covered desktop authentication, creation, editing, budgets, sample activity, reload persistence, command-center scope, archive, active-list removal, and archived history. Narrow/mobile authenticated lifecycle testing was not repeated after the latest onboarding change.

### Honest remaining limitations

- A generated reporting key and endpoint do not connect a provider automatically. The customer must configure Zapier, n8n, Make, Claude Code, or custom code to POST stable event IDs and real token/cost metadata.
- The real scoped-key button is deployed but was not clicked during final acceptance because issuing a key intentionally revokes that workflow's previous key.
- The three manager-scenario workflows are currently **Monitor only**. They show reported spend but cannot prevent a provider call until their runner uses the guard/reservation/settlement protocol and protection is changed to **Guard connected**.
- No paid provider call was made. OpenRouter is represented as the selected model/provider label; no native OpenRouter adapter or automatic discovery is claimed.
- Setup still contains older provider-specific instructional tabs. The new Add workflow window is the preferred connection entry point; remaining setup copy should eventually be reduced around that single path.
- Archived workflows are preserved and directly addressable, but there is not yet a dedicated archived-workflows browser or restore action.
- High-volume Analytics still caps its client query at 5,000 rows; server-side chart buckets remain future scale work.
- Guard concurrency, settlement races, multi-workspace admin/member verification, and authenticated narrow-layout QA remain material production-hardening tasks.

### Resume point

1. Start by reading this section and `docs/LIVE_SITE_FIX_HANDOFF_2026-09-20.md`.
2. Ask the user to trial Add workflow → real connection or sample activity → workflow Settings → budgets → archive.
3. Do not alter the six older workflows or the three active manager-scenario workflows without explicit direction.
4. For strategy, focus next on the smallest real provider reporting walkthrough and guard-connected proof, not a redesign or new billing system.
5. Preserve unrelated local documentation/schema files currently outside the committed change set.

## Current phase

Phase 6 — light-mode product simplification and local verification (implemented locally; remote schema/function deployment and database integration gates unverified).

## Completed

- Confirmed HEAD `a0bab3c` and created feature branch `feat/runaway-spend-guard`.
- Read the repository structure, migrations, package scripts, and master prompt. No `AGENTS.md` files are present.
- Installed dependencies from `package-lock.json` with `npm ci`.
- Added a public, Supabase-independent `/demo` route with deterministic fixtures, virtual time, replay controls, anomaly explanation, pre-execution block semantics, incident detail, and policy-adjustment/resume flow.
- Added a Phase 1 `/command-center` route showing synthetic workspace spend, critical incidents, workflow inventory, governance checks, experiment review queue, and clearly labeled value estimates.
- Added the landing-page CTA `Try the runaway-agent demo`.
- Added safe local preview behavior for missing Supabase variables so eager imports do not blank the app.
- Added additive workspace, membership, governance/value, incident, audit, flow-credential, run-source, reservation, and settlement schema migrations.
- Replaced the ingest handler's bearer-prefix check with Supabase user or hashed per-flow credential authentication, strict payload validation, idempotent event recording, and separate control guidance.
- Added `guard` and `settle` Edge Functions plus `examples/guarded-agent.mjs`; the example invokes its deterministic mock provider only after an allow decision.
- Removed random post-signup sample-run behavior in favor of private workspace provisioning.
- Updated browser simulation callers to use the authenticated session, stable event IDs, and response-body error handling.
- Added pure guard policy tests for exact budget boundaries, null/zero caps, and emergency-stop semantics.
- Added hashed one-time flow credential issuance for external runners; credentials can authenticate ingest, guard, and settlement without exposing a browser publishable key.
- Added transactional `set_flow_control` with pause, explicit emergency-stop latch/clear, resume guards, permission checks, and audit entries.
- Added the matching one-time credential issuance endpoint and wired guard/settle authentication to accept the per-flow credential without exposing its hash.
- Added `set_flow_control` to the authenticated dashboard path and preserved paused/emergency-stopped status in Flow Detail.
- Corrected Flow Detail status calculation so paused and emergency-stopped states remain distinct from health.
- Updated the public docs and curl/script examples for authenticated, idempotent telemetry and honest post-run control semantics.
- Added the explicit `Restore original policy` action to the demo; policy changes are now reversible without editing fields manually.
- Added server-side `get_workspace_summary` and admin-only `review_flow` RPCs for period-scoped management metrics and production review/promotion rules.
- Wired authenticated `/command-center` sessions to the workspace summary RPC for period-scoped spend, run, workflow, incident, and governance counts; anonymous visitors retain the isolated synthetic view.
- Added server-backed paginated inventory aggregates, audited incident resolution, authoritative flow detail period summaries, and admin-only budget/protection policy updates.
- Added authenticated review queue actions for approve/reject/pending decisions with production requirements and audit notes.
- Updated the operational dashboard to read workspace-scoped flows and preserved separate emergency-stopped status; removed destructive run-history reset behavior.
- Added shared value-metric calculations that return `N/A` for missing values or zero cost.
- Added audited flow archival through an admin-only RPC; archived flows stop new runs while retaining run history, costs, incidents, and audit evidence. Direct authenticated hard deletes are revoked.
- Corrected the live inventory's last-telemetry aggregate so synthetic demo runs cannot appear as real workspace activity.
- Added the workspace provisioning script for creating/reusing an admin and member account without printing credentials, plus the authenticated configuration-required guard for routes that cannot safely run without Supabase variables.
- Added live Command Center filters, incident resolution notes, review decisions, value-estimate editing, and workspace-scoped governance/value controls on the existing Supabase foundation.
- Added server summary fields that keep selected-period totals separate from month-to-date spend, experiment spend, value coverage, and monthly projection inputs.
- Added workspace member lookup and a management governance editor for accountable owner, budget owner, team, and business purpose; owner choices are validated server-side against the flow workspace.
- Extended flow creation to persist description, business purpose, and team instead of leaving governance fields empty by default.
- Added `scripts/verify-guard-protocol.mjs` and `npm run verify:guard` for a configured local/staging smoke gate covering deny-before-provider behavior and repeated-settlement idempotency.
- Re-scoped legacy alert rules/history into workspace RLS and removed misleading email/Slack delivery controls; the Alerts page now clearly supports in-app history only.
- Added event-driven database signals: live run inserts evaluate alert rules with cooldowns, five-minute spend anomalies create/update incident evidence, and denied guard reservations increment open-incident blocked counts.
- Aligned management mutation guards with workspace roles: admin-only RPC actions now have matching admin checks in the Command Center handlers, while the Alerts page hides rule mutations for members.
- Made ingest event IDs, guard request IDs, and settlement reservation IDs reject conflicting payload replays with a 409-compatible database conflict instead of silently accepting them.
- Added `scripts/verify-workspace-access.mjs` and `npm run verify:workspace` for configured admin/member workspace-access checks, with optional unrelated-workspace isolation coverage.
- Replaced authenticated Dashboard daily/monthly cost sums with workspace-scoped server inventory/summary aggregates, exact per-flow daily run counts, and UTC day/month boundaries; added the server `today_run_count` summary field.
- Fixed the dashboard aggregate fetch ordering so inventory data is loaded before per-flow enrichment reads it; this prevents a live workspace initialization race.
- Added a development-only local preview sign-in for `test@gmail.com` when Supabase is unconfigured; it routes to labeled synthetic management data and leaves the real Supabase Auth path unchanged.
- Added a development-only synthetic `/dashboard` for that local preview session, so the dashboard no longer stops at the Supabase configuration gate when the local preview account is active; live dashboard routes still require the configured Supabase variables.
- Removed unsupported public marketing claims about automatic discovery, one-click integrations, notification delivery, billing, and prior traction; landing, investor, README, and docs copy now distinguish prototype scope from future work.

## Strategy checkpoint

- The local product surface is now a coherent working prototype: public demo, local-preview sign-in, synthetic Dashboard, synthetic/live-aware Command Center, guard replay, incident evidence, reversible policy changes, and the authenticated Supabase implementation are all represented in the codebase.
- The strongest implementation choice was preserving the existing Supabase foundation and adding the guard, governance, incident, value, archival, and workspace controls additively instead of replacing the application with an unrelated architecture.
- The safest next phase is integration validation: compare the additive migrations with the connected Supabase project, apply only after review, then run real admin/member, RLS, Edge Function, replay-idempotency, and concurrency checks before expanding product scope.
- The local preview is intentionally a development aid, not a substitute for production authentication or live data. Its test account and synthetic metrics must remain isolated from Supabase and Netlify production behavior.

## Light-mode product simplification

- Consolidated the primary product experience around one compact `/dashboard` instead of forcing users to choose between competing operational and management home pages. The deeper `/command-center` remains reachable as Management.
- Separated public demo and signed-in account scopes. The demo now has `/demo` (simplified dashboard), `/demo/management` (complex management), and `/demo/replay` (incident replay); signed-in users have `/dashboard` and `/command-center` with account-specific labeling and navigation.
- Changed sign-in success to land on `/dashboard`, and prevented demo management routes from loading authenticated Supabase data even when a user is signed in.
- Added a shared light workspace shell with compact navigation, workspace/scope context, restrained blue active states, and a responsive mobile navigation row.
- Rebuilt the main dashboard around four scoped metrics, one actionable attention strip, one readable flow inventory, and one restrained spend chart. The default table now prioritizes Name, Owner, Status, Spend, and Budget.
- Removed the random live run simulation controls from the main dashboard so synthetic test actions can no longer be mistaken for live operational telemetry from that surface.
- Reworked Add flow into a small essential form with optional governance fields behind `More options`, safe experiment/pending/monitor-only defaults, and a clear post-create connection step.
- Added a development-only Add flow experience that mutates local component state only and explicitly states that it creates no Supabase record or credential.
- Rebuilt Analytics in the same light product system with Cost/Runs/Tokens metric tabs, 7/30-day scope, one chart, and a flow breakdown; synthetic demo and seed sources are excluded from its client query.
- Completed the business-user usability pass. Public demo and signed-in preview now each use an isolated, persisted local sample workspace: totals, workflow lists, spending, reviews, and workflow details all derive from the same data and survive navigation/reload until Reset sample is selected.
- Added workflow-specific sample detail routes (`/demo/flows/:id` and `/flows/:id`) with Summary, Activity, Controls, and Settings, so an issue or a row always opens its own workflow rather than the public replay or a generic management page.
- Refocused sample `/demo/management` and preview `/command-center` on Reviews. Review decisions require an owner, a next review date when applicable, and a note; the local sample visibly updates without pretending to send a notification or mutate a live workspace.
- Added sample Spending routes, streamlined the shared shell around Overview, Spending, Reviews, Settings/Help, replaced manager-facing technical copy with plainer terms, and moved connection detail behind a workflow Settings disclosure.
- Fixed development-preview route protection: sign-out now removes preview access and direct `/dashboard` navigation returns to `/login`. The local login now has an explicit development-only “Enter sample workspace” action rather than a shared test password flow.
- Made Add workflow keyboard-dismissible with Escape, clarified that creation is local sample data, and removed endpoint/credential implementation detail from its primary completion state.
- Reorganized Flow Detail into Overview, Activity, Spending, Controls, and Settings tabs. Pause/resume remains directly discoverable; management controls and connection details are one click away.
- Corrected the Command Center live-data boundary: an empty or failed authenticated workspace no longer substitutes synthetic inventory, and failed aggregates render `Unavailable` instead of invented live values.
- Added `npm run typecheck` and fixed the existing Supabase function type paths and Analytics import errors that Vite build did not detect.
- Added an additive RLS migration that limits member-created flows to pending, monitor-only experiments with no privileged governance, approval, budget, emergency-stop, or ownership fields.
- Corrected deterministic replay accounting so policy changes no longer rewrite earlier accumulated cost and resolved incidents retain the seven historically blocked requests.
- Updated the Claude Code setup script to require a scoped flow credential and include an idempotent event ID and explicit monitor source. The browser test button now refuses to send unauthenticated telemetry.
- Browser-verified the shared preview dashboard, progressive Add flow fields, preview-only creation/connection step, and synthetic Analytics navigation. Captured and inspected 1440×900 desktop and 390×844 mobile screenshots; the mobile flow inventory uses cards rather than a clipped table.

## Known issues / follow-up

- Demo policy shortcut is reversible: `Narrow scope + lower rate` changes to `Restore original policy`, which returns the original policy and clears the manual resume state. Browser interaction was verified in the local preview.
- Mobile screenshot QA, local migration execution, remote migration/function deployment, and database concurrency tests remain unverified. The full timed browser replay has now been completed locally: baseline → warning → pre-execution block, incident evidence, safer policy, and policy restoration were all observed.
- The new guard smoke gate preflight exits as expected because no `FLOWLEDGER_URL`, flow credential, or configured project variables are present in this checkout.
- The new workspace-access smoke gate preflight exits as expected because no Supabase URL/anon key or provisioned admin/member credentials are present in this checkout.
- Live Command Center value metrics remain `N/A` until the connected workspace has user-entered value estimates and the new summary migration is applied.
- The existing Supabase project reference is preserved in `supabase/config.toml`, but this checkout intentionally has no `.env` credentials. Netlify-hosted environment variables and the currently deployed remote schema were not inspected or changed.
- Backend integration follow-up remains material: execute and qualify ambiguous PL/pgSQL RPC return-column references; verify guard/settlement locking, emergency-stop preservation, cancellation/reconciliation, durable runner execution deduplication, and credential rotation/revocation against a real Postgres instance.
- Server aggregates still need one consistent archival/source/experiment-period contract. In particular, historical archived-flow inclusion, `synthetic_seed` exclusion, experiment transition timestamps, and matched value-coverage costs require database-level validation before production reporting claims.
- The authenticated Analytics chart currently reads at most 5,000 eligible rows for the selected period. Authoritative high-volume chart buckets should move to a paginated or server-aggregated RPC before production scale.
- Setup tabs outside the corrected Claude Code example still need to be consolidated onto the same workspace-aware creation and scoped-credential path; do not treat those legacy examples as launch-verified.
- Lint now has zero errors and seven existing Fast Refresh warnings in shared UI components.
- The local preview server remains available at `http://127.0.0.1:8080`; browser sanity checks continue to show the public demo and command-center routes instead of a blank screen.
- Browser verification after the management audit: Command Center filters expand across owner/team/environment/platform/model/approval and the synthetic view remains isolated.
- Browser verification after replay-conflict changes: `/command-center` and `/demo` both render at `http://127.0.0.1:8080` with no blank-screen regression.
- Final browser check: landing page copy, synthetic `/command-center`, and `/demo` all rendered after the final build; the handoff tab is left on `/demo`.
- Usability-pass browser verification: demo issue → its own workflow detail → review/resume action; demo review → required decision/note → persisted queue update; preview entry → overview → Add workflow modal Escape dismissal; sign-out → direct `/dashboard` redirect back to login. Automated typecheck, build, 8 tests, lint (zero errors/seven existing Fast Refresh warnings), and diff validation passed.
- Final navigation/simulation polish: Help (`/docs?mode=demo|preview|account`) and guided replay (`/demo/replay?mode=demo|preview`) now retain the shared product shell, active demo/preview context, and one-click Overview access. The public Help and replay remain explicitly synthetic and never use account data.
- Added a compact sample-only **Simulate activity** control. “Load 1 week” and “Load 1 month” replace the illustrative local scenario rather than append costs; persisted local figures update Overview, Spending, workflow details, and the sample attention state together. It makes no Supabase write, provider call, or production telemetry event.
- Browser verification of final polish: landing entry links resolve separately to `/demo` and `/demo/replay?mode=demo`; demo Help and replay retain the demo shell; preview replay retains preview account shell; Help returns to Overview in one click; loading the one-month scenario showed `$66.24` / `216` executions consistently in Overview and Spending; loading the one-week scenario showed `$16.56` / `54` executions and one local sample issue. Reset control was preserved but not activated during final browser QA to avoid erasing the current local sample state.

## Resume instructions

1. Read this checkpoint and the attached `FlowLedger-Master-Prompt.md`, starting at the Phase 3 guard/concurrency gates and Phase 5 handoff checks.
2. If the user authorizes remote maintenance, compare the additive migrations/functions with the connected Supabase project before applying anything; do not replace the existing schema.
3. Start local Supabase/Postgres if available and run the migrations plus RLS/RPC/concurrency tests; otherwise keep those gates marked unverified.
4. Continue with membership-safe ownership assignment, local migration/RLS/concurrency validation when Docker or a connected Supabase environment is available, and the authenticated guard walkthrough.

The current branch is `feat/runaway-spend-guard`. No remote migration, deployment, production push, or external message has been performed.

## Baseline checks

- `npm run build`: passed.
- `npm test -- --run`: passed (1 existing test before Phase 1).
- `npm run lint`: passed with seven existing Fast Refresh warnings in shared UI components.
- `npm run build` after Phase 1: passed.
- `npm test -- --run` after Phase 1: passed (2 files, 3 tests).
- `npm run build` after Phase 2 changes: passed.
- `npm test -- --run` after Phase 2 changes: passed (4 files, 6 tests).
- `git diff --check`: passed.
- `npm run lint` after Phase 4 changes: passed with seven existing Fast Refresh warnings; the three prior errors were fixed.
- `npm run lint` after archival changes: passed with seven existing Fast Refresh warnings and zero errors.
- `npm run build` after archival changes: passed.
- `npm test -- --run` after archival changes: passed (4 files, 8 tests).
- `git diff --check` after archival changes: passed.
- `npm run lint`, `npm run build`, and `npm test -- --run` after inventory telemetry fix: passed; 4 files and 8 tests green.
- `npm run lint`, `npm run build`, and `npm test -- --run` after summary/governance changes: passed; 4 files and 8 tests green.
- `node --check scripts/verify-guard-protocol.mjs` plus the full lint/build/test/diff check after the guard smoke script: passed; 4 files and 8 tests green.
- Full lint/build/test/diff check after workspace alert scoping: passed; 4 files and 8 tests green.
- Full lint/build/test/diff check after event-driven signal migrations: passed; 4 files and 8 tests green.
- Full lint/build/test/diff check after role-gating changes: passed; 4 files and 8 tests green.
- Full lint/build/test/diff check after replay-conflict changes: passed; 4 files and 8 tests green.
- Full lint/build/test/diff check after Dashboard aggregate/UTC changes: passed; 4 files and 8 tests green.
- Final local lint/build/test/diff and both server-script syntax checks after copy, UTC, aggregate, and public drilldown fixes: passed; 4 files and 8 tests green, with seven pre-existing Fast Refresh warnings.
- Final verification after the dashboard fetch-order fix: lint/build/tests/diff and both server-script syntax checks passed again.
- Browser verification: `/login` accepted the local preview account and redirected to `/command-center`, which showed `Local preview · signed in` and explicitly stated that Supabase was not configured.
- Browser verification: `/dashboard` now renders the labeled `Local preview · synthetic` operations dashboard with deterministic workflow metrics, links to the demo and Command Center, and an explicit live-Supabase configuration notice.
- Light-mode redesign verification: `npm run typecheck`, build, 8 tests, lint (zero errors/seven existing Fast Refresh warnings), and diff check passed. Desktop and mobile screenshots were inspected after the responsive flow-card fix.
- Strategy handoff checkpoint: current work is ready for an architecture/product review focused on sequencing the Supabase integration gate, production-readiness risks, and the smallest next increments.
- `node --check` for both server-backed verification scripts plus full lint/build/test/diff: passed; 4 files and 8 tests green.
- `npm run verify:guard`: not integration-run; preflight reported missing `FLOWLEDGER_URL`, `FLOW_ID`, and flow credential.
- `npm run verify:workspace`: not integration-run; preflight reported missing Supabase URL/anon key and admin/member credentials.
- `npm run build` after guard/control changes: passed.
- `npm test -- --run` after guard/control changes: passed (3 files, 6 tests).
- `npm run build` after controls/credential changes: passed.
- `npm test -- --run` after controls/credential changes: passed (3 files, 6 tests).
- Browser verification: `/demo` and `/command-center` rendered at the local preview URL; replay start and responsive layout were inspected. The full timed replay walkthrough completed at 48 seconds and showed warning → `REQUEST BLOCKED`, seven blocked requests, incident evidence, policy narrowing, and restoration of the original policy. Mobile screenshot capture remains to be completed.
- Browser verification after the management wiring: `/demo` and anonymous `/command-center` render successfully at `http://127.0.0.1:8080`; policy reset interaction remains reversible.
- `supabase db lint --local`: not run to completion; local Postgres at `127.0.0.1:54322` is not running. No remote migration was attempted.
- `supabase status` / `supabase start`: blocked because Docker Desktop is not running or installed in this environment.
- Remote Supabase/Netlify configuration: existing project wiring is present in the repository, but deployment credentials and remote state are not available in this local checkout; no remote write was attempted.

## Next action

Next action: review the simplified local product with Abdullah, then—only with explicit authorization and connected-project access—validate the additive migrations/RPCs/Edge Functions against Supabase before any deployment. Keep the unresolved accounting, concurrency, membership, and credential-lifecycle gates marked unverified until real database tests pass.
