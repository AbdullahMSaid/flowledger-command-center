import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const sections = [
  { id: "introduction", label: "Introduction" },
  { id: "quick-start", label: "Quick start" },
  { id: "payload-reference", label: "Payload reference" },
  { id: "claude-code", label: "Claude Code" },
  { id: "zapier", label: "Zapier" },
  { id: "n8n", label: "n8n" },
  { id: "status-budget", label: "Status & budget" },
  { id: "responses", label: "API responses" },
];

const CodeBlock = ({ children, lang }: { children: string; lang?: string }) => (
  <div className="rounded-xl bg-[hsl(var(--dark-surface))] border border-white/[0.06] overflow-hidden my-5">
    {lang && (
      <div className="px-4 py-2 border-b border-white/[0.06] text-[11px] text-white/30 uppercase tracking-wider font-body">
        {lang}
      </div>
    )}
    <pre className="p-5 overflow-x-auto text-[13px] leading-relaxed text-white/80 font-mono">
      <code>{children}</code>
    </pre>
  </div>
);

const SectionHeading = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="font-display text-[32px] leading-[1.15] tracking-tight text-foreground mt-16 mb-4 scroll-mt-24">
    {children}
  </h2>
);

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-lg font-medium text-foreground tracking-tight mb-2 mt-8 font-body">{children}</h3>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[15px] text-ink2 leading-relaxed mb-4 font-body">{children}</p>
);

const Docs = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const SidebarNav = ({ className = "" }: { className?: string }) => (
    <nav className={className}>
      <ul className="space-y-1">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={() => setSidebarOpen(false)}
              className="block text-sm text-ink2 hover:text-primary py-1.5 px-3 rounded-lg hover:bg-primary/5 transition-colors font-body"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Mobile sidebar dropdown */}
      <div className="md:hidden sticky top-[73px] z-40 bg-background border-b border-border px-6 py-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex items-center gap-2 text-sm font-medium text-foreground font-body"
        >
          On this page
          <ChevronDown className={`w-4 h-4 transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
        </button>
        {sidebarOpen && (
          <div className="mt-2 pb-1">
            <SidebarNav />
          </div>
        )}
      </div>

      <div className="container flex gap-12 py-12">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-56 shrink-0">
          <div className="sticky top-28">
            <div className="text-xs font-medium tracking-[1.5px] uppercase text-ink3 mb-4 font-body">On this page</div>
            <SidebarNav />
          </div>
        </aside>

        {/* Main content */}
        <motion.main
          className="flex-1 min-w-0 max-w-3xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="mb-12">
            <div className="text-xs font-medium tracking-[2px] uppercase text-primary mb-3 font-body">Documentation</div>
            <h1 className="font-display text-[44px] leading-[1.1] tracking-tight mb-4">FlowLedger Docs</h1>
            <P>Everything you need to connect your AI workflows and start tracking spend, errors, and performance.</P>
          </div>

          {/* ═══ Section 1 — Introduction ═══ */}
          <SectionHeading id="introduction">How FlowLedger works</SectionHeading>
          <P>
            FlowLedger tracks any AI workflow by receiving run data through a simple webhook. Your workflow runs, then sends a POST request to your unique ingest URL. FlowLedger stores the run, calculates status, updates your spend, and fires any alerts — in real time. No SDK required. No agents. No proxy layers. Just a webhook.
          </P>

          {/* ═══ Section 2 — Quick start ═══ */}
          <SectionHeading id="quick-start">Quick start in 3 steps</SectionHeading>

          <div className="space-y-6 mb-6">
            <div className="flex gap-4">
              <div className="text-primary font-display text-xl mt-0.5 shrink-0">1</div>
              <div>
                <div className="text-[15px] font-medium text-foreground font-body mb-1">Create a flow</div>
                <P>Go to your dashboard and click Add Flow. Give it a name, pick the platform (Zapier, n8n, Claude Code, Other), and pick the model.</P>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-primary font-display text-xl mt-0.5 shrink-0">2</div>
              <div>
                <div className="text-[15px] font-medium text-foreground font-body mb-1">Copy your webhook URL</div>
                <P>From the flow detail page, copy the ingest URL. It looks like:</P>
                <code className="text-[13px] text-primary bg-primary/5 px-2.5 py-1 rounded-md font-mono break-all">
                  POST https://your-project.supabase.co/functions/v1/ingest/:flowId
                </code>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-primary font-display text-xl mt-0.5 shrink-0">3</div>
              <div>
                <div className="text-[15px] font-medium text-foreground font-body mb-1">Send your first run</div>
                <P>POST a JSON body to that URL after your workflow executes. See the run appear on your dashboard in real time.</P>
              </div>
            </div>
          </div>

          <CodeBlock lang="bash">{`curl -X POST https://your-project.supabase.co/functions/v1/ingest/YOUR_FLOW_ID \\
  -H 'Authorization: Bearer your-api-key' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "status": "success",
    "duration_ms": 1840,
    "token_count": 1160,
    "cost_usd": 0.0058,
    "error_message": null
  }'`}</CodeBlock>

          {/* ═══ Section 3 — Payload reference ═══ */}
          <SectionHeading id="payload-reference">Ingest payload reference</SectionHeading>
          <div className="rounded-xl border border-border overflow-hidden my-5">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left px-4 py-3 font-medium text-foreground">Field</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground">Required</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr><td className="px-4 py-3 font-mono text-primary text-[13px]">status</td><td className="px-4 py-3 text-ink2">string</td><td className="px-4 py-3 text-ink2">Yes</td><td className="px-4 py-3 text-ink2">'success' or 'error'</td></tr>
                <tr><td className="px-4 py-3 font-mono text-primary text-[13px]">duration_ms</td><td className="px-4 py-3 text-ink2">integer</td><td className="px-4 py-3 text-ink2">Yes</td><td className="px-4 py-3 text-ink2">How long the run took in milliseconds</td></tr>
                <tr><td className="px-4 py-3 font-mono text-primary text-[13px]">token_count</td><td className="px-4 py-3 text-ink2">integer</td><td className="px-4 py-3 text-ink2">Yes</td><td className="px-4 py-3 text-ink2">Total tokens consumed (input + output)</td></tr>
                <tr><td className="px-4 py-3 font-mono text-primary text-[13px]">cost_usd</td><td className="px-4 py-3 text-ink2">number</td><td className="px-4 py-3 text-ink2">Yes</td><td className="px-4 py-3 text-ink2">Cost of this run in USD e.g. 0.0058</td></tr>
                <tr><td className="px-4 py-3 font-mono text-primary text-[13px]">error_message</td><td className="px-4 py-3 text-ink2">string</td><td className="px-4 py-3 text-ink2">No</td><td className="px-4 py-3 text-ink2">Error description if status is 'error'</td></tr>
              </tbody>
            </table>
          </div>

          {/* ═══ Section 4 — Claude Code ═══ */}
          <SectionHeading id="claude-code">Tracking Claude Code sessions</SectionHeading>
          <P>
            Claude Code is one of the most powerful uses of FlowLedger. Most teams using Claude Code have no idea what they are spending per session, per project, or per week. FlowLedger fixes that.
          </P>

          <SubHeading>Option 1 — Manual sync from Anthropic console</SubHeading>
          <P>
            Go to console.anthropic.com → Usage. Note your token consumption for the session. POST that data to your FlowLedger ingest URL. Best for occasional tracking or auditing past usage.
          </P>

          <SubHeading>Option 2 — Wrap Claude Code with a tracking script</SubHeading>
          <P>
            Create a shell script that runs Claude Code and automatically POSTs a run record to FlowLedger when the session ends. This gives you duration tracking and error detection with zero manual effort.
          </P>
          <CodeBlock lang="bash">{`#!/bin/bash
# Save as claude-tracked, run chmod +x claude-tracked
# Use: ./claude-tracked instead of claude

FLOW_ID="your-flow-id-here"
WEBHOOK="https://your-project.supabase.co/functions/v1/ingest/$FLOW_ID"

START=$(date +%s%3N)
claude "$@"
EXIT_CODE=$?
END=$(date +%s%3N)
DURATION=$((END - START))

STATUS="success"
if [ $EXIT_CODE -ne 0 ]; then STATUS="error"; fi

curl -s -X POST "$WEBHOOK" \\
  -H "Authorization: Bearer any-token" \\
  -H "Content-Type: application/json" \\
  -d "{\\"status\\":\\"$STATUS\\",\\"duration_ms\\":$DURATION,\\"token_count\\":0,\\"cost_usd\\":0}"

echo "FlowLedger: session tracked"`}</CodeBlock>

          <SubHeading>Option 3 — Direct Anthropic API sync (coming soon)</SubHeading>
          <P>
            Connect your Anthropic API key in Settings and FlowLedger will pull your usage data automatically — no webhook setup required. Token counts, costs, and model breakdowns appear in your dashboard without any manual steps. This feature is on our roadmap.
          </P>

          {/* ═══ Section 5 — Zapier ═══ */}
          <SectionHeading id="zapier">Connecting a Zapier workflow</SectionHeading>
          <P>
            Add a final step to any Zap using the Webhooks by Zapier action. Set the method to POST, paste your FlowLedger ingest URL, and map the following fields from your previous Zap steps into the JSON body:
          </P>
          <CodeBlock lang="json">{`{
  "status": "success",
  "duration_ms": 2100,
  "token_count": "{{openai_usage_total_tokens}}",
  "cost_usd": 0.011,
  "error_message": null
}`}</CodeBlock>
          <P>
            Map token_count from your OpenAI or Anthropic step response. If your Zap uses a filter or error path, send status: error on those branches and include the error description in error_message.
          </P>

          {/* ═══ Section 6 — n8n ═══ */}
          <SectionHeading id="n8n">Connecting an n8n workflow</SectionHeading>
          <P>
            Add an HTTP Request node at the end of your n8n workflow. Set method to POST and paste your ingest URL. In the body, use n8n expressions to map real values from your AI node:
          </P>
          <CodeBlock lang="json">{`{
  "status": "success",
  "duration_ms": "{{ $now.diff($runIndex.startTime) }}",
  "token_count": "{{ $node['OpenAI'].data.usage.total_tokens }}",
  "cost_usd": 0.008,
  "error_message": null
}`}</CodeBlock>

          {/* ═══ Section 7 — Status & budget ═══ */}
          <SectionHeading id="status-budget">How status is calculated</SectionHeading>
          <P>FlowLedger calculates flow status automatically after every run:</P>

          <div className="space-y-3 my-5">
            <div className="flex items-start gap-3 bg-card border border-border rounded-xl p-4">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent mt-1.5 shrink-0" />
              <div>
                <span className="text-sm font-medium text-foreground font-body">Live</span>
                <span className="text-sm text-ink2 font-body"> — Last run succeeded and error rate across last 10 runs is below 20%</span>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-card border border-border rounded-xl p-4">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[hsl(40,100%,50%)] mt-1.5 shrink-0" />
              <div>
                <span className="text-sm font-medium text-foreground font-body">Degraded</span>
                <span className="text-sm text-ink2 font-body"> — Error rate across last 10 runs exceeds 20%</span>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-card border border-border rounded-xl p-4">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-destructive mt-1.5 shrink-0" />
              <div>
                <span className="text-sm font-medium text-foreground font-body">Error</span>
                <span className="text-sm text-ink2 font-body"> — Most recent run failed</span>
              </div>
            </div>
          </div>

          <SubHeading>Budget limits</SubHeading>
          <P>
            Set a monthly budget limit on any flow from the dashboard. When total cost_usd for the month reaches the limit, FlowLedger automatically pauses the flow and returns this response to any further ingest requests:
          </P>
          <CodeBlock lang="json">{`{ "ok": false, "reason": "budget_exceeded" }`}</CodeBlock>
          <P>
            Your workflow should check for ok: false and handle the paused state — for example by notifying your team or skipping the AI step until the budget resets.
          </P>

          {/* ═══ Section 8 — Responses ═══ */}
          <SectionHeading id="responses">Ingest API responses</SectionHeading>
          <div className="rounded-xl border border-border overflow-hidden my-5">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left px-4 py-3 font-medium text-foreground">Response</th>
                  <th className="text-left px-4 py-3 font-medium text-foreground">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3 font-mono text-primary text-[13px]">{`{ ok: true, run_id: '...' }`}</td>
                  <td className="px-4 py-3 text-ink2">Run recorded successfully</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-primary text-[13px]">{`{ ok: false, reason: 'paused' }`}</td>
                  <td className="px-4 py-3 text-ink2">Flow was manually paused</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-primary text-[13px]">{`{ ok: false, reason: 'budget_exceeded' }`}</td>
                  <td className="px-4 py-3 text-ink2">Monthly budget limit reached</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="h-20" />
        </motion.main>
      </div>

      <Footer />
    </div>
  );
};

export default Docs;
