# FlowLedger

> **The circuit breaker for enterprise AI spend.**  
> Track, govern, and control every AI workflow across your organisation — in real time.

[![Built with Supabase](https://img.shields.io/badge/Built%20with-Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com)
[![Deployed on Netlify](https://img.shields.io/badge/Deployed%20on-Netlify-00C7B7?style=flat&logo=netlify&logoColor=white)](https://netlify.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is FlowLedger?

Most companies running AI workflows have no idea what they're spending, which flows are failing, or when a runaway automation is burning through their budget. FlowLedger fixes that.

Any AI workflow — whether it runs on Zapier, n8n, Make, LangChain, Claude Code, or a custom script — can send a single webhook call to FlowLedger after it executes. FlowLedger handles the rest: status tracking, spend aggregation, budget enforcement, real-time alerts, and a unified dashboard across every tool in your stack.

**Core loop:**

```
Your AI workflow runs → POSTs run data to FlowLedger → Dashboard updates in real time
```

No SDK. No proxy layer. No agents. Just a webhook.

---

## Live demo

> Sign up at [flowledger.com](https://flowledger.com) and use the **Simulate 10 Runs** button on the dashboard to see the full real-time loop — status updates, spend tracking, and budget enforcement — without connecting a real workflow.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Database schema](#database-schema)
- [Ingest API](#ingest-api)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
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
- Server-side edge function — API keys never exposed to the browser

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
- Budget utilisation progress bar on every flow row
- When limit is reached: flow auto-pauses, ingest endpoint returns `{ ok: false, reason: "budget_exceeded" }`
- Workflows that respect the response can self-govern without manual intervention

**Alerts**
- Create alert rules with configurable conditions: error rate, spend limit, budget exceeded, token spike
- Notification channels: email (Resend), Slack webhook
- Alert history log with timestamps and resolution status

**Analytics**
- Daily spend breakdown chart
- Top flows by cost
- Total token consumption by model
- Success rate trends

**Auth and security**
- Email/password and Google OAuth via Supabase Auth
- Row Level Security on all tables — users only ever see their own workspace data
- API key management for ingest authentication

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
| Rate limiting | Upstash Redis | Fast key-value store for per-workspace rate limiting |
| Email | Resend | Transactional email for alerts and auth |
| Payments | Stripe (planned) | Subscription billing with webhooks |
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
Authorization: Bearer your-api-key
Content-Type: application/json
```

**Request body**

```json
{
  "status": "success",
  "duration_ms": 1840,
  "token_count": 1160,
  "cost_usd": 0.0058,
  "error_message": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | `"success"` or `"error"` |
| `duration_ms` | integer | Yes | Execution time in milliseconds |
| `token_count` | integer | Yes | Total tokens consumed (input + output) |
| `cost_usd` | number | Yes | Cost of this run in USD |
| `error_message` | string | No | Error description if status is `"error"` |

**Responses**

```json
{ "ok": true, "run_id": "uuid" }              // Run recorded
{ "ok": false, "reason": "paused" }           // Flow manually paused
{ "ok": false, "reason": "budget_exceeded" }  // Monthly budget reached
```

**Your workflow should check `ok` in the response.** If `false`, skip the AI step or notify your team rather than continuing to execute and accumulate cost.

---

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- A Vercel account (free tier works)

### Local development

```bash
# Clone the repository
git clone https://github.com/your-org/flowledger.git
cd flowledger

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Fill in your Supabase credentials in .env

# Run the development server
npm run dev
```

### Supabase setup

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Deploy edge functions
supabase functions deploy ingest
```

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
# .env (Netlify reads this locally; set production values in Netlify dashboard → Site settings → Environment variables)

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Only needed for edge functions (set in Supabase dashboard)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Resend (email alerts)
RESEND_API_KEY=your-resend-api-key

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# Stripe (billing — when enabled)
STRIPE_SECRET_KEY=your-stripe-secret
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
```

---

## Project structure

```
flowledger/
├── src/
│   ├── components/          # Shared UI components
│   │   ├── ui/              # Base components (Button, Badge, Card, etc.)
│   │   ├── FlowTable.tsx    # Dashboard flow table with status badges
│   │   ├── MetricCard.tsx   # Summary stat cards
│   │   ├── SpendChart.tsx   # Recharts bar chart
│   │   └── SimulateButton.tsx
│   ├── pages/
│   │   ├── Landing.tsx      # Public landing page
│   │   ├── Pricing.tsx      # Pricing comparison
│   │   ├── Docs.tsx         # Technical documentation
│   │   ├── Investors.tsx    # Business case / pitch content
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── Dashboard.tsx    # Main authenticated view
│   │   ├── FlowDetail.tsx   # Per-flow run history and stats
│   │   ├── Analytics.tsx    # Spend and usage analytics
│   │   └── Alerts.tsx       # Alert rules and history
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   ├── statusEngine.ts  # Flow status derivation logic
│   │   └── formatters.ts    # Currency, duration, date helpers
│   └── hooks/
│       ├── useFlows.ts      # Flow CRUD and realtime subscription
│       ├── useRuns.ts       # Run history queries
│       └── useMetrics.ts    # Aggregated dashboard metrics
├── supabase/
│   ├── functions/
│   │   └── ingest/
│   │       └── index.ts     # Edge function — ingest endpoint
│   └── migrations/          # Database migrations
├── public/
└── README.md
```

---

## Integrations

### Works today (webhook-based)

Any tool that can make an HTTP POST request at the end of a workflow execution.

| Tool | Setup | Guide |
|------|-------|-------|
| Zapier | Add a Webhooks by Zapier step as the final action | [Docs →](/docs#zapier) |
| n8n | Add an HTTP Request node at the end of your workflow | [Docs →](/docs#n8n) |
| Make (Integromat) | Add an HTTP module as the final module | [Docs →](/docs#make) |
| Claude Code | Use the shell wrapper script | [Docs →](/docs#claude-code) |
| LangChain | Add a requests call in your chain's callback | [Docs →](/docs#langchain) |
| Custom scripts | Any language with HTTP support | [Docs →](/docs#custom) |

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
- [x] Email and Slack notifications
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

FlowLedger is currently in closed beta. If you're interested in contributing or integrating FlowLedger into your own tooling, reach out at hello@flowledger.com.

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
- [Resend](https://resend.com) — transactional email
- [Upstash](https://upstash.com) — serverless Redis for rate limiting
- [Tailwind CSS](https://tailwindcss.com) — styling
- [Lovable](https://lovable.dev) — rapid prototyping and initial build

---

<p align="center">
  <strong>FlowLedger</strong> · The AI Ops layer every enterprise will need.<br>
  <a href="https://flowledger.com">flowledger.com</a> · 
  <a href="mailto:hello@flowledger.com">hello@flowledger.com</a>
</p>
