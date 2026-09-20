# FlowLedger

> **A practical control layer for registered AI workflows.**
> Report spend, document ownership, and make cooperative pre-execution guard decisions explainable.

[![Built with Supabase](https://img.shields.io/badge/Built%20with-Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com)
[![Deployed on Netlify](https://img.shields.io/badge/Deployed%20on-Netlify-00C7B7?style=flat&logo=netlify&logoColor=white)](https://netlify.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is FlowLedger?

Most companies running AI workflows have no idea what they're spending, which flows are failing, or when a runaway automation is burning through their budget. FlowLedger fixes that.

Any registered AI workflow — whether it runs on Zapier, n8n, Make, LangChain, Claude Code, or a custom script — can send authenticated telemetry to FlowLedger after it executes. FlowLedger records usage, aggregates spend, exposes workspace governance, and can deny the next guarded request when a policy boundary is reached.

**Core loop:**

```
Your AI workflow runs → POSTs run data to FlowLedger → Dashboard updates in real time
```

No SDK. No proxy layer. No agents. Just a webhook.

---

## Live demo

Open `/demo` for the simplified synthetic dashboard, `/demo/spending` for the spend breakdown, `/demo/management` for the review queue, and `/demo/replay` for a deterministic runaway-agent example. Demo records never enter live workspace totals.

The signed-in `/dashboard`, `/analytics`, and `/command-center` provide corresponding account overview, spending, and review views. They use the existing Supabase project, workspace membership, RLS, and server-side aggregate functions when the configured environment variables and additive migrations are present.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [Ingest API](#ingest-api)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Guarded request protocol](#guarded-request-protocol)
- [Project structure](#project-structure)
- [Integrations](#integrations)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Current — v1 (MVP)

**Flow management**
- Create and manage flows representing any AI workflow, agent, or automation
- Assign platform (Zapier, n8n, Make, LangChain, Claude Code, Other) and model
- Pause and resume flows manually with a single toggle

**Run ingestion**
- Webhook-based ingest endpoint — works with any tool that can make an HTTP POST request
- Stores status, duration, token count, cost, and error messages per run
- Server-side edge function — credentials are validated server-side and never exposed to the browser

**Real-time status engine**
- Derives flow status automatically after every run
- `Live` — last run succeeded, error rate across last 10 runs below 20%
- `Degraded` — error rate across last 10 runs exceeds 20%
- `Error` — most recent run failed
- Dashboard and flow detail pages update via Supabase Realtime — no polling, no page refresh

**Spend tracking**
- Per-run cost stored in USD
- Aggregated metrics: spend today, spend this month, spend per flow
- 7-day spend bar chart on dashboard

**Budget enforcement**
- Set a monthly spend limit per flow
- Optionally set a UTC daily limit and guard protection mode
- Budget utilisation progress bar on every flow row
- Guarded admission reserves the requested maximum cost transactionally before a provider call
- Settlement records actual incurred cost, flags above-bound completions, and preserves the audit trail

**Alerts**
- Create in-app alert rules with configurable conditions: error rate, spend limit, budget exceeded, token spike
- Alert history log with timestamps and resolution status
- Email and outbound webhook delivery are not implemented in this prototype

**Analytics**
- Daily spend breakdown chart
- Top flows by cost
- Total token consumption by model
- Success rate trends

**Auth and security**
- Email/password and Google OAuth via Supabase Auth
- Workspace-scoped Row Level Security with `admin` and `member` roles
- Revocable, per-flow external credentials stored only as hashes
- Admin-only policy, review, incident-resolution, and emergency-stop RPCs with audit entries

**Developer docs**
- Public `/docs` page with full ingest API reference
- Copy-paste setup guides for Zapier, n8n, Make, and Claude Code
- Shell script wrapper for automatic Claude Code session tracking

---

## Tech stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + TypeScript | Component model, strong ecosystem |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Charts | Recharts | Lightweight, composable |
| Backend | Supabase (Postgres + Auth + Realtime + Edge Functions) | Single platform for DB, auth, real-time, and serverless |
| Ingest API | Supabase Edge Functions (Deno) | Server-side execution, no cold starts, global edge deployment |
| Rate limiting | Not implemented | Keep the current edge functions behind Supabase/project-level controls |
| Email | Not implemented | In-app alerts are the supported notification surface |
| Payments | Not implemented | Subscription billing is outside this build |
| Deployment | Netlify | Git-based deploys, preview environments, global CDN |
| Fonts | DM Serif Display + DM Sans | Editorial-modern design system |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Client (Netlify)                       │
│         React + Tailwind + Recharts + Supabase JS        │
└────────────────────────┬────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   Supabase Platform  │
              │                      │
              │  ┌────────────────┐  │
              │  │   PostgreSQL   │  │◄── Row Level Security
              │  │    (flows,     │  │    on all tables
              │  │     runs,      │  │
              │  │    alerts)     │  │
              │  └───────┬────────┘  │
              │          │           │
              │  ┌───────▼────────┐  │
              │  │   Realtime     │  │──► Dashboard updates
              │  │  (postgres     │  │    without refresh
              │  │   changes)     │  │
              │  └────────────────┘  │
              │                      │
              │  ┌────────────────┐  │
              │  │ Edge Function  │  │◄── POST /ingest/:flowId
              │  │  (ingest API)  │  │    from any AI tool
              │  └───────┬────────┘  │
              │          │           │
              │  ┌───────▼────────┐  │
              │  │  Supabase Auth │  │
              │  │ (email + OAuth)│  │
              │  └────────────────┘  │
              └──────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   External Services  │
              │  Resend · Upstash    │
              │  Stripe (planned)    │
              └──────────────────────┘
```

**Key architectural decisions:**

**Webhook-first ingestion** — FlowLedger does not sit in the execution path of your AI workflows. It receives data after the fact. This means zero latency impact on your workflows and no single point of failure. The tradeoff is that data accuracy depends on what the caller sends.

**Edge function for ingest** — the ingest endpoint runs as a Supabase Edge Function (Deno runtime) so the `service_role` key used to bypass RLS for inserts is never exposed to the browser. All other reads use the anon key with RLS enforced.

**Realtime via Postgres changes** — rather than polling, the dashboard subscribes to `INSERT` events on the `runs` table filtered by the user's flows. When a new run arrives, the client re-fetches aggregated metrics from the DB rather than computing them from the event payload, avoiding stale state.

**Status derived, never stored** — flow status (`Live`, `Degraded`, `Error`) is computed on read from the last 10 runs. It is never stored as a column. This means status is always accurate and never gets out of sync with the actual run history.

---

## Database schema

```sql
-- Flows: one per AI workflow, agent, or automation
create table flows (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  name          text not null,
  platform      text not null,           -- Zapier, n8n, Make, Claude Code, Other
  model         text not null,           -- gpt-4o, claude-3-5-sonnet, etc.
  flow_enabled  boolean default true,    -- pause/resume toggle
  budget_limit  numeric,                 -- monthly spend cap in USD (nullable)
  created_at    timestamptz default now()
);

-- Runs: one per execution of a flow
create table runs (
  id            uuid primary key default gen_random_uuid(),
  flow_id       uuid references flows not null,
  status        text not null,           -- 'success' | 'error'
  duration_ms   integer not null,
  token_count   integer not null,
  cost_usd      numeric not null,
  error_message text,                    -- nullable
  created_at    timestamptz default now()
);

-- Index for fast per-flow run queries
create index runs_flow_id_created_at
  on runs (flow_id, created_at desc);

-- Alert rules
create table alert_rules (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users not null,
  name              text not null,
  condition_type    text not null,       -- error_rate | spend_limit | budget_exceeded | token_spike
  threshold         numeric not null,
  scope             text not null,       -- 'all' | flow_id
  flow_id           uuid references flows,
  notify_email      boolean default true,
  notify_slack      boolean default false,
  slack_webhook_url text,
  enabled           boolean default true,
  cooldown_minutes  integer default 60,
  created_at        timestamptz default now()
);

-- Alert events (history)
create table alert_events (
  id           uuid primary key default gen_random_uuid(),
  rule_id      uuid references alert_rules not null,
  flow_id      uuid references flows,
  triggered_at timestamptz default now(),
  resolved_at  timestamptz,
  status       text default 'open'       -- 'open' | 'resolved'
);

-- Row Level Security
alter table flows       enable row level security;
alter table runs        enable row level security;
alter table alert_rules enable row level security;
alter table alert_events enable row level security;

-- Users only see their own data
create policy "users see own flows"
  on flows for all using (auth.uid() = user_id);

create policy "users see runs for own flows"
  on runs for all using (
    flow_id in (select id from flows where user_id = auth.uid())
  );
```

---

## Ingest API

The ingest endpoint is the core of FlowLedger. Any tool that can make an HTTP POST request can send data to it.

**Endpoint**

```
POST https://your-project.supabase.co/functions/v1/ingest/:flowId
```

**Headers**

```
Authorization: Bearer your-supabase-access-token-or-flow-credential
Content-Type: application/json
```

**Request body**

```json
{
  "event_id": "invoice-2026-09-17-0001",
  "status": "success",
  "duration_ms": 1840,
  "token_count": 1160,
  "cost_usd": 0.0058,
  "source": "live",
  "error_message": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | `"success"` or `"error"` |
| `duration_ms` | integer | Yes | Execution time in milliseconds |
| `token_count` | integer | Yes | Total tokens consumed (input + output) |
| `cost_usd` | number | Yes | Cost of this run in USD |
| `event_id` | string | Yes | Stable per-flow identifier; retries are idempotent |
| `source` | string | No | `live`, `monitor`, or `guarded`; defaults to `live` |
| `error_message` | string | No | Error description if status is `"error"` |

**Responses**

```json
{ "recorded": true, "run_id": "uuid", "duplicate": false,
  "control": { "allow_next": true, "reason": "ok" } }

{ "recorded": true, "run_id": "uuid", "duplicate": false,
  "control": { "allow_next": false, "reason": "budget_exceeded" } }
```

Telemetry recording and permission to start a new guarded call are separate. A cooperating workflow should call the guard endpoint before the provider, skip the provider when admission is denied, and settle the reservation after the call completes.

## Guarded request protocol

```text
POST /functions/v1/guard/:flowId
  { "request_id": "stable-request-id", "max_cost_usd": 0.02 }

if allowed:
  invoke provider
  POST /functions/v1/settle
    { "reservation_id": "uuid", "status": "success",
      "duration_ms": 120, "token_count": 64, "actual_cost_usd": 0.018 }
else:
  do not invoke provider
```

The checked-in [`examples/guarded-agent.mjs`](examples/guarded-agent.mjs) uses a counted deterministic mock provider. It does not call a paid model. `credentials` issues a one-time per-flow credential; the plaintext is returned once and only its hash is stored.

---

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- A Netlify site for deployment, if you want to publish the frontend

### Local development

```bash
# Clone the repository
git clone https://github.com/AbdullahMSaid/flowledger-command-center.git
cd flowledger-command-center

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Fill in your Supabase credentials in .env.local

# Run the development server
npm run dev
```

Without Supabase variables, the development server still exposes the public demo and a local-only preview sign-in at `/login`. Use `test@gmail.com` with the supplied local test password; this session only unlocks the synthetic Command Center and never reads or writes Supabase data. Configured environments always use real Supabase Auth.

### Supabase setup

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref oqteckpmfkbopbjznyie

# Review the additive migrations, then apply them to the connected project
supabase db push

# Deploy the server functions after the migrations are applied
supabase functions deploy ingest
supabase functions deploy guard
supabase functions deploy settle
supabase functions deploy credentials

# Optional local/staging test workspace; credentials are supplied via env only
npm run provision:workspace
```

`provision:workspace` requires `SUPABASE_SERVICE_ROLE_KEY`, `FLOWLEDGER_ADMIN_EMAIL`, `FLOWLEDGER_ADMIN_PASSWORD`, `FLOWLEDGER_MEMBER_EMAIL`, and `FLOWLEDGER_MEMBER_PASSWORD`. It creates or reuses two users and adds the second user as a member of the first user's private workspace. It never prints passwords.

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build the project
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

Or connect the GitHub repo to Netlify for automatic deployments on every push — go to app.netlify.com, click "Add new site", and select your repository. Set the build command to `npm run build` and the publish directory to `dist`.

> **Note:** Supabase Edge Functions are hosted on Supabase's infrastructure, not Netlify. You do not need Netlify Functions for the ingest endpoint — it runs independently on Supabase's global edge network.

---

## Environment variables

```bash
# .env.local for local authenticated development. Set the same public values in
# Netlify Site settings → Environment variables for the deployed frontend.

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Only needed for edge functions (set in Supabase dashboard)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Do not use the local preview account as a deployed credential. It is enabled only for a Vite development build with Supabase unconfigured.

The current prototype does not claim email delivery, outbound webhooks, provider adapters, rate limiting, billing, or automatic business-outcome instrumentation. Those integrations should remain explicitly marked unavailable until implemented and tested.

---

## Project structure

```text
flowledger-command-center/
├── src/
│   ├── components/          # Application and shared UI components
│   ├── hooks/               # Authentication and UI hooks
│   ├── integrations/        # Supabase browser client and generated types
│   ├── lib/                 # Demo state, guard policy, metrics, and utilities
│   ├── pages/               # Public, demo, and authenticated screens
│   ├── test/                # Test setup and smoke tests
│   └── App.tsx              # Routes and authentication boundaries
├── supabase/
│   ├── functions/
│   │   ├── credentials/    # Issue scoped flow credentials
│   │   ├── guard/          # Reserve budget before a provider call
│   │   ├── ingest/         # Record workflow telemetry
│   │   └── settle/         # Settle guarded reservations
│   └── migrations/          # Additive PostgreSQL migrations
├── docs/                    # Environment and launch runbooks
├── examples/                # Deterministic guarded-agent example
└── README.md
```

---

## Integrations

### Works today (webhook-based)

Any tool that can make an HTTP POST request at the end of a workflow execution.

| Tool | Setup | Guide |
|------|-------|-------|
| Zapier | Add a Webhooks by Zapier step as the final action | [Docs →](https://flowledgerai.com/docs#zapier) |
| n8n | Add an HTTP Request node at the end of your workflow | [Docs →](https://flowledgerai.com/docs#n8n) |
| Make (Integromat) | Add an HTTP module as the final module | [Docs →](https://flowledgerai.com/docs#make) |
| Claude Code | Use the shell wrapper script | [Docs →](https://flowledgerai.com/docs#claude-code) |
| LangChain | Add a requests call in your chain's callback | [Docs →](https://flowledgerai.com/docs#langchain) |
| Custom scripts | Any language with HTTP support | [Docs →](https://flowledgerai.com/docs#custom) |

### Planned — direct API integrations (v2)

Rather than relying on users to add a webhook step, FlowLedger will connect directly to platform APIs using the user's credentials and pull usage data automatically.

| Platform | Data available | Status |
|----------|---------------|--------|
| Anthropic API | Token usage by day, model, cost | Planned Q3 2026 |
| OpenAI API | Token usage, cost, model breakdown | Planned Q3 2026 |
| Zapier | Zap run history, task usage | Planned Q4 2026 |
| Make | Scenario run history, operations used | Planned Q4 2026 |
| LangSmith | Trace data, token counts, latency | Planned Q4 2026 |

---

## Roadmap

### v1 — MVP (current)
- [x] Flow management (create, pause, resume)
- [x] Webhook ingest endpoint (Edge Function)
- [x] Real-time dashboard via Supabase Realtime
- [x] Status engine (Live / Degraded / Error)
- [x] Spend tracking and budget enforcement
- [x] Alert rules (error rate, spend, budget exceeded)
- [ ] Email and Slack notifications (not implemented; in-app alert history is supported)
- [x] Google OAuth
- [x] Simulate Run and Simulate 10 Runs demo tools
- [x] Technical documentation page
- [x] Analytics (spend breakdown, top flows, token usage)

### v2 — Control layer (Q3 2026)
- [ ] Direct Anthropic API integration (auto-pull usage data)
- [ ] Direct OpenAI API integration
- [ ] API key management with scoped permissions
- [ ] Stripe billing (Starter / Growth / Enterprise tiers)
- [ ] Team management (invite members, role-based access)
- [ ] Workspace switching (multi-org support)
- [ ] Audit log with CSV export
- [ ] Mobile-responsive dashboard improvements

### v3 — Intelligence layer (Q4 2026)
- [ ] Zapier and Make direct integrations (pull run history via OAuth)
- [ ] Cost optimisation recommendations ("Switch this flow from GPT-4o to Claude Haiku — save $240/mo")
- [ ] Anomaly detection (flag unusual spend spikes automatically)
- [ ] Workflow template marketplace (community-contributed flow configs)
- [ ] LangSmith and LangFuse integration
- [ ] Scheduled reports (weekly spend summary via email)

### v4 — Enterprise layer (2027)
- [ ] SSO (SAML / OIDC)
- [ ] SOC 2 audit trail
- [ ] Custom retention policies for run data
- [ ] AI spend negotiation (bulk API rate resale)
- [ ] On-premise / private cloud deployment option
- [ ] SLA monitoring and uptime guarantees per flow
- [ ] Model routing (auto-switch models based on cost/performance rules)

---

## Contributing

FlowLedger is currently in closed beta. If you're interested in contributing or integrating FlowLedger into your own tooling, reach out at abdullahi_said1@outlook.com.

When the project opens for contributions a full contributing guide will be added here covering:
- Local development setup
- Branch naming conventions
- Pull request process
- Writing and running tests
- Edge function development and local testing with Supabase CLI

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Built with

- [Supabase](https://supabase.com) — database, auth, real-time, and edge functions
- [Netlify](https://netlify.com) — deployment and CDN
- [Recharts](https://recharts.org) — charting
- [Tailwind CSS](https://tailwindcss.com) — styling
- [Lovable](https://lovable.dev) — rapid prototyping and initial build

---

<p align="center">
  <strong>FlowLedger</strong> · Registered workflow spend control prototype.<br>
  <a href="https://flowledgerai.com">flowledgerai.com</a> · 
  <a href="mailto:abdullahi_said1@outlook.com">abdullahi_said1@outlook.com</a>
</p>
