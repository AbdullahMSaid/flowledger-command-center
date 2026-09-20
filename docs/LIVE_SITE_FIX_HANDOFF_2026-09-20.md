# FlowLedger live-site repair handoff — September 20, 2026

## Assignment and scope

The user requests implementation of the issues below in the existing `Import FlowLedger repository` task, then a return to strategy after repairs. Work in `/Users/abdullahisaid/Projects/FlowLedger`, not the strategy task's stale detached worktree. Copy this document into that checkout as `docs/LIVE_SITE_FIX_HANDOFF_2026-09-20.md`, link it from the current handoff/progress documents, and maintain evidence and status per item. Preserve unrelated uncommitted files. No redesign, dark mode, new billing, or broad strategy expansion.

Keep the light LangChain-inspired UI: restrained blue, white panels, thin borders, readable compact tables, simple overview, deeper controls within one or two clicks. Business managers should understand costs, ownership, issues and next decisions; engineers should find connection, activity and controls without a separate product experience.

The user's transcript frames the business need: an out-of-office automation scanned channels and allegedly cost $10,000/day; leadership needs visibility, governance, control, an end to open-ended experiments, and evidence of ROI. Treat this as user-provided context, not a verified customer case or marketing endorsement.

## Deployment context — do not conflate two failures

The user reports commit `05d2250` fixed authentication routing and was pushed/deployed, followed by README commit `a3199ec`. The audit checkout includes both. Verify the current production revision before changing already-fixed behavior.

Independent browser testing on `https://flowledgerai.com` successfully signed into the user-authorized test account, saw six existing workflows, and then opened `/command-center`. The authenticated page went blank with browser console error `TypeError: Cannot read properties of null (reading 'production_count')` in `CommandCenter-CdPEqmXZ.js`. This is distinct from signed-out redirect behavior. A passing redirect test does not prove the signed-in page works. Do not assume Netlify delay explains this.

No existing account workflows were modified or removed in the audit. Attempted creation of `QA temporary workflow Sep 20` failed, so there is no audit-created record to clean up. Do not commit account credentials; obtain the authorized test credentials from task conversation context or the delegating message.

## Required repairs and acceptance checks

### 1. Authenticated Reviews crash — highest priority

- Reproduce signed-in `/command-center` and inspect actual RPC/error/empty states. Local `src/pages/CommandCenter.tsx` dereferences `liveSummary.production_count` and other fields in its `governance` calculation without a null guard despite guarded cards above it.
- Fix the underlying data contract/query failure where applicable, as well as null safety. Show useful loading, empty, unavailable and retry states. Do not silently invent zeros or substitute synthetic data.
- Verify signed-out redirect, signed-in populated and empty workspaces, denied access, and failed aggregates. Keep `/demo/management` isolated and public.

### 2. Add workflow fails — highest priority

- Live Add workflow with name, n8n platform and model returned `new row for relation "flows" violates check constraint "flows_protection_mode_check"`.
- `src/components/dashboard/AddFlowModal.tsx` sends `monitor_only`; foundation migration and `supabase/SQL_EDITOR_UPDATE.sql` constrain values to `Guard connected` / `Monitor only`. Audit all reads/writes, types and comparisons for this mismatch (Dashboard also compares `guard_connected`). Choose a consistent contract compatible with existing records; don't weaken RLS or constraints to bypass it.
- Inspect legacy Setup creation paths for missing workspace/creator fields and converge on one valid creation service.
- Verify create → reload → same workflow, correct workspace and ownership permissions, no fabricated activity/cost, and actionable connection next step.

### 3. Rename and edit workflow/connection settings

- Live detail Settings contains only a copyable ingest endpoint and text saying “See Connect,” with no actionable Connect link or editor. No rename control was found.
- Provide clear editable name, platform/model and applicable metadata; connection settings must target the selected workflow, not force creation of a duplicate. Explain that changing a platform label does not itself connect a provider.
- Provide success/error feedback and persistence after reload. Enforce existing role/assignment permissions server-side. Keep reporting-only distinct from verified guard protection.

### 4. Archive/remove workflows

- No archive/delete control is exposed in the live Overview or detail page. `DeleteFlowModal.tsx` calls `archive_flow` but search found no imports/uses in the current UI.
- Wire a discoverable Archive action with clear consequences and confirmation, plus archived listing/recovery where supported. Preserve run history, costs and incidents. Do not hard-delete historical financial records to clean the screen.
- Verify archived records leave the active list, cannot gain new guard admissions, and do not erase incurred spend from historical totals. If restore is offered, test it and avoid silently re-enabling paid execution.
- Exercise only a disposable test workflow; leave the six existing records intact.

### 5. Consistent navigation and working links

- `/setup` still replaces the shared workspace shell with a legacy Integrations header; its Docs link goes to `/docs` and loses account context. `/docs?mode=account` works correctly from the main shell.
- Keep Overview/Spending/Reviews/Settings/Help and a direct return path across setup, detail, help and replay. Preserve demo/account context and authentication.
- Homepage “Explore sample” header/footer buttons currently lead to `/signup`, unlike the main sample CTA `/demo`. Align labels and destinations; offer an explicit account entry separately.
- Audit the visible nav, rows, actions, help anchors and footer items. Do not present inert text as functional Privacy/Terms links or claim pages that do not exist.

### 6. Complete a usable reporting connection path

- Setup has Claude Code, Zapier and n8n tabs, but legacy n8n/Zapier guidance omits required stable event IDs and authentication. Public docs disagree with newer setup; some examples use a broad/expiring Supabase access token, and the Claude wrapper reports zero tokens/cost while surrounding copy implies cost tracking.
- Unify instructions with deployed ingest/credentials contracts. Provide a workflow-specific reporting credential path, stable retry-safe event IDs, real cost/token mapping where available, explicit missing/estimated data, and last-received/test status. Never equate a copied URL with a connected agent.
- Prefer customer-side provider secrets and metadata push; FlowLedger must not collect provider master/admin keys. Never describe encryption at rest as protection from a compromised application server. Do not invent universal read-only keys, automatic discovery, or native OpenRouter support.
- Verify one non-production reporting path and one denied guarded admission/settlement path if the necessary environment is available; distinguish protocol tests from actual provider execution. No paid provider calls merely to demonstrate this. Mark any external dependency as unverified with the exact remaining step.

### 7. Demo simulation correctness and meaningful status

- Month load worked and consistently displayed $66.24 / 216 executions on Overview and Spending. But all three workflows exceeded displayed budgets while only one needed attention, and a guard-connected workflow remained Live. Fix period alignment, scenario data, status and attention calculations coherently. Monitor-only over-budget spend can occur, but must be explained; guarded excess must not imply protections silently failed.
- Verify week/month/reset and detail/Spending/Reviews consistency. Month charts should use meaningful period labels rather than an unexplained seven-weekday axis.
- The replay successfully warned, blocked, exposed incident evidence, narrowed scope and resumed while preserving spent cost ($0.57 → $0.58). Preserve that behavior and its clear synthetic labels.
- Live Overview marked all six workflows Live, including workflows with old/error history. Define freshness and failure status honestly; “enabled” is not proof of a healthy connection. Separate governance gaps from operational issues rather than presenting missing owners/reviews as universally healthy.

### 8. Finish existing governance/value functionality without strategy expansion

- Restore the live owner, review date, decision and notes journey. Ensure edits persist with an auditable history and proper permissions.
- Make existing value assumptions/outcome evidence discoverable alongside spend for keep/change/retire decisions. Label estimates and their basis; costs alone do not prove ROI. Reuse existing functionality instead of inventing a broad new ROI engine.
- The sample review form already exposes owner/date/note/decision. Match the live workflow's usability and clearly report any remaining strategic limitation.

## Verification, delivery and boundaries

Use focused regression tests for null/failed aggregates, canonical protection values, workflow lifecycle and role restrictions, then the repository's typecheck, tests, build and lint. Tests must exercise behavior, not just restate implementation. Check desktop and narrow layouts.

Use the authenticated production test account for browser acceptance, not only synthetic preview: sign in, add disposable workflow, rename, edit connection metadata, reload, inspect tabs, review, archive and verify historical accounting. Do not mutate existing customer workflows. Do not persist secrets in docs, fixtures, logs or screenshots.

Continue the user's already-authorized code-fix/push workflow from the implementation task. Commit only intended changes, push through the established path, and verify the deployed revision and signed-in behavior after deployment. If remote schema/function changes are necessary, inspect existing state and prepare targeted additive changes; do not blindly rerun the monolithic SQL file or overwrite unrelated pending database/docs work. Follow applicable approval requirements for actual remote actions.

Keep this file updated with fixed / verified locally / verified live / blocked status and concrete evidence. Do not declare everything complete based on a successful build or signed-out redirect. Final handoff should include commit/deployment identity, an acceptance-results table, exact remaining blockers, and how the user can add, rename, reconnect and archive a workflow. Then stop for the user's hands-on trial and strategy review.

## Implementation status — September 20, 2026

| Item | Status | Evidence |
| --- | --- | --- |
| Authenticated Reviews crash | Fixed locally | `liveSummary` has an explicit unavailable state before governance counts render; no synthetic fallback is used. |
| Safe workflow registration | Fixed locally; migration pending deployment | UI and RLS policy now use canonical `Monitor only`, matching the existing check constraint. |
| Full lifecycle, connection, navigation, demo, governance review | In progress | Not yet accepted live; existing records have not been modified. |

Local validation: `bun run typecheck`, `bun run test` (10 tests), and `bun run build` passed after the first repair batch.

### Live workflow acceptance — completed

- Workflow detail now owns identity/responsibility editing, daily/monthly budgets, reporting connection, pause/resume, and archival. The generic command-center jump was removed.
- Authenticated Settings retains the workspace shell. The live command center no longer links authenticated users into the synthetic replay.
- Created and reloaded three active test-account workflows: Out-of-office responder (Maya · Operations, $2/day, $30/month), Invoice extractor — OpenRouter (Eric · Sales, $5/day, $100/month), and AI support triage (Sam · Engineering, $10/day, $250/month).
- Created then archived Lab research assistant — Jared ($1/day, $15/month). It is absent from the active dashboard; its direct archived detail and accounting view remain available.
- Live testing exposed and fixed ambiguous-column failures in both `set_flow_policy` and `archive_flow`; targeted migrations `20260920160000` and `20260920161500` are applied remotely.
- Production authenticated Reviews loads as a live account with no demo replay link. Existing six workflows were not modified or archived.
- Combined onboarding shipped in `24d0e7c`: Add workflow now registers source/owner/responsibility, then offers either a scoped real-reporting key or 24 labeled sample hourly runs in the same dialog. Live acceptance generated 24 runs / 31,419 tokens / $0.26 for a disposable n8n workflow, confirmed all 24 `synthetic_seed` activity rows after reload, then archived the disposable workflow.
