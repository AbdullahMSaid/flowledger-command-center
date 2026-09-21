# FlowLedger demo-readiness checklist

Last updated: 2026-09-21

This is a factual release checklist. “Live verified” means an observed production result; it is not inferred from a successful build.

## Baseline and improvements

| Area | Baseline | Current result | Evidence |
| --- | --- | --- | --- |
| New-account provisioning | Auth could return `Database error saving new user` when its workspace trigger failed. | Provisioning trigger was recreated as an idempotent private-workspace transaction. | Supabase migration `20260921010000` recorded remotely. |
| Account navigation | Protected route and each destination independently requested the same Supabase session. | One in-flight session lookup is shared; stale session responses cannot overwrite a sign-out. | `src/hooks/useAuth.ts`; typecheck and build pass. |
| Workspace navigation | Dashboard, Spending, and Reviews each queried the same membership row after navigation. | Membership lookup is shared per signed-in user and retries after an error. | `src/lib/workspace.ts`; consumers updated. |
| JavaScript delivery | Main production entry was 539 kB minified / 159 kB gzip. | Entry is 122 kB minified / 35 kB gzip; React, Supabase, Radix, icons, and charts are separately cacheable. | Matching local production builds; chart code remains a lazy 372 kB chunk. |
| Connection setup | Generic Settings had an old flow-creation path with out-of-date, unauthenticated examples. | Connections are explicitly workflow-specific. Generic Settings explains the path; `?flow=` returns to that workflow’s Settings tab. | `src/pages/Setup.tsx`, `src/pages/FlowDetail.tsx`. |
| Archived workflows in Reviews | Archived workflows still looked active in management lists and review queues. | Active management, value coverage, and review queues exclude archived workflows; archived history remains in database accounting. | Live authenticated QA found the issue; `src/pages/CommandCenter.tsx` fix is pending this deployment. |
| Public CTA | Header “Explore sample” sent signed-out visitors to Sign up. | It opens the public demo, consistent with the label. | `src/components/landing/Navbar.tsx`. |
| Modal interaction | Add, archive, and budget dialogs had no Escape handling; archive/budget could close during a request. | Escape works while idle; archive/budget dialogs cannot dismiss mid-request; initial focus is present for the destructive/budget dialog. | Modal components. |

## Acceptance status

| Journey | Status | Evidence / limitation |
| --- | --- | --- |
| Public landing, demo and replay isolation | Pass locally; previously live accepted | No account data is used by demo routes. Re-run after this deployment. |
| Signed-out private routes | Pass previously live | `/command-center` redirects to login. Re-run after this deployment. |
| Existing authenticated workspace and Reviews | Pass previously live | Reviews null-aggregate failure fixed in prior production work. Must re-check after current deploy. |
| Add → configure → sample activity → archive | Pass previously live | Prior acceptance used a disposable flow and preserved existing workflows. Re-run after current deploy only with a disposable flow. |
| New email / Google signup | Database repair deployed; browser acceptance pending | Creating a new external account was intentionally not automated. Test manually with a fresh address after deployment. |
| Real provider reporting | Not verified | Requires a customer-controlled provider/workflow and scoped credential; no paid call was made. |
| Guard denial and settlement | Protocol checked previously; provider execution not verified | Do not describe this as provider enforcement without a runner using the guard. |
| Responsive and keyboard core flow | Partial | Narrow-table containers and modal Escape/focus were inspected in code. Full browser/device sweep remains pending. |
| Accessibility | Partial | Semantic buttons/labels are present in core changed paths. No automated axe/Lighthouse run is available in this repository. |

## Required checks before the interview/customer demo

1. On `https://flowledgerai.com`, open the public demo, load a month, open Spending, Reviews, Help, and the replay. Confirm no account email appears.
2. Sign in with the demo account. Open Overview, Spending, Reviews, Settings, and one workflow by direct URL then reload it.
3. Create one disposable workflow. Confirm it appears after reload, open **Edit workflow**, set a daily and monthly budget, create a reporting key only if it is safe to replace any prior key, then archive the disposable workflow.
4. Create a fresh email or Google test account. Confirm it receives a private workspace and can reach its empty Overview. This is the final acceptance check for the signup repair.
5. In browser developer tools, confirm no console errors or failed document/script requests during the above journey.

## Manager workflow

1. **Overview → Add workflow**: name it, choose source/model, optionally add owner/team and responsibility.
2. Choose **real reporting** or clearly labeled **sample activity**. A source name alone is not a connection.
3. Open the workflow → **Edit workflow** → **Settings**: update identity, budgets, connection, and archive state.
4. Use **Reviews** for ownership, approval, next review, and value assumptions.
5. Archive instead of deleting when a workflow is retired; its history remains in accounting.

## 10-minute demo path

1. Open the public demo and state that its data is synthetic.
2. Use Overview to identify spend, owner, and attention state.
3. Open a workflow to show activity, budgets, and the difference between monitoring and guard connection.
4. Open Reviews to show ownership and decision context.
5. Run the replay: warning → denied call → evidence → policy adjustment → explicit resume.
6. Close by opening a real account workflow’s Settings and explain that a workflow-specific reporting credential—not a provider label—creates the telemetry connection.

## Remaining limits, ranked

1. **Fresh-account acceptance is pending.** The production migration is applied, but a real new account has not been created by automated QA.
2. **No field performance telemetry.** Bundle evidence is reproducible local build output, not real-user Core Web Vitals. Add RUM only when there is a clear product decision it will support.
3. **Large historical datasets need production load testing.** Current UI caps common inventory/activity queries, but a customer-scale workload has not been profiled.
4. **Provider execution remains external.** FlowLedger receives reported events and can participate in the guard protocol; it does not prove a third-party provider connection merely from a selected platform.
