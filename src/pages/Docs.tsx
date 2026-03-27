import { motion } from "framer-motion";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

/* ─── Business Case Data (from pitch deck) ─── */
const problemCards = [
  { title: "No visibility", desc: "Teams don't know which AI workflows are running, who owns them, or what they're costing." },
  { title: "No accountability", desc: "When an AI pipeline breaks silently, it takes hours to notice. There's no single place to look." },
  { title: "No governance", desc: "AI API spend is scattered across tools, cards, and teams — with zero budget control or audit trail." },
];

const marketStats = [
  { stat: "$847B", label: "Global AI software market by 2030" },
  { stat: "73%", label: "Enterprises with zero AI governance today" },
  { stat: "11×", label: "YoY growth in enterprise workflow volume" },
  { stat: "$0", label: "Dominant player in AI Ops category" },
];

const revenueStreams = [
  { title: "SaaS Subscriptions", desc: "$49 → $499/mo. Seat-based + workflow volume tiers.", icon: "💳" },
  { title: "Marketplace Cut", desc: "20% of template sales. Users publish workflow templates.", icon: "🏪" },
  { title: "AI Spend Management", desc: "Negotiate bulk API rates with OpenAI, Anthropic. Resell with margin.", icon: "📊" },
  { title: "Compliance Module", desc: "$50K+/yr enterprise. SOC2, GDPR-ready audit logs.", icon: "🛡️" },
];

/* ─── Tech Stack Data ─── */
const techLayers = [
  {
    label: "Frontend",
    color: "from-primary/20 to-primary/5",
    borderColor: "border-primary/30",
    accentColor: "text-primary",
    tools: [
      { name: "React", desc: "Component architecture" },
      { name: "TypeScript", desc: "Type safety" },
      { name: "Tailwind CSS", desc: "Utility-first styling" },
      { name: "Recharts", desc: "Data visualization" },
      { name: "Framer Motion", desc: "Animations" },
      { name: "Vite", desc: "Build tooling" },
    ],
  },
  {
    label: "Backend & Data",
    color: "from-emerald/20 to-emerald/5",
    borderColor: "border-emerald/30",
    accentColor: "text-emerald",
    tools: [
      { name: "Supabase", desc: "Postgres + Auth + Realtime" },
      { name: "Edge Functions", desc: "Serverless compute" },
      { name: "Row Level Security", desc: "Data protection" },
      { name: "Realtime", desc: "Live subscriptions" },
    ],
  },
  {
    label: "Ingestion & APIs",
    color: "from-[hsl(40,100%,50%)]/20 to-[hsl(40,100%,50%)]/5",
    borderColor: "border-[hsl(40,100%,50%)]/30",
    accentColor: "text-[hsl(40,90%,45%)]",
    tools: [
      { name: "Webhook API", desc: "Event ingestion" },
      { name: "Bearer Auth", desc: "Token authentication" },
      { name: "Upstash Redis", desc: "Rate limiting" },
      { name: "REST API", desc: "Third-party integrations" },
    ],
  },
  {
    label: "Billing & Notifications",
    color: "from-destructive/15 to-destructive/5",
    borderColor: "border-destructive/20",
    accentColor: "text-destructive",
    tools: [
      { name: "Stripe", desc: "Checkout & subscriptions" },
      { name: "Resend", desc: "Transactional email" },
      { name: "Slack Webhooks", desc: "Team alerts" },
      { name: "PagerDuty", desc: "Enterprise on-call" },
    ],
  },
  {
    label: "Infrastructure",
    color: "from-ink3/15 to-ink3/5",
    borderColor: "border-ink3/20",
    accentColor: "text-ink3",
    tools: [
      { name: "Vercel", desc: "Edge deployment" },
      { name: "GitHub", desc: "CI/CD & version control" },
      { name: "Lovable", desc: "AI-assisted development" },
      { name: "PostgREST", desc: "Auto-generated API" },
    ],
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

const Docs = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ═══════ HERO ═══════ */}
      <section className="container py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-xs font-medium tracking-[2px] uppercase text-electric-blue mb-4">
            Business Case & Technology
          </div>
          <h1 className="font-display text-[52px] leading-[1.08] tracking-tight mb-5">
            Why <em className="text-primary">FlowLedger</em> exists
          </h1>
          <p className="text-[17px] text-ink2 font-light max-w-2xl mx-auto leading-relaxed">
            The AI Ops category doesn't exist yet. We're building it — before anyone else realizes the category exists.
          </p>
        </motion.div>
      </section>

      {/* ═══════ THE PROBLEM ═══════ */}
      <section className="container pb-20">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
          <motion.p variants={fadeUp} custom={0} className="text-xs font-medium tracking-[2px] uppercase text-electric-blue mb-3 text-center">
            The Problem
          </motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="font-display text-[38px] leading-[1.1] tracking-tight text-center mb-12">
            Every company is running AI.<br />Nobody can see it.
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-6">
            {problemCards.map((c, i) => (
              <motion.div
                key={c.title}
                variants={fadeUp}
                custom={i + 2}
                className="bg-card border border-border rounded-2xl p-8 hover:border-primary/20 transition-colors"
              >
                <h3 className="text-lg font-medium text-foreground tracking-tight mb-2 font-body">{c.title}</h3>
                <p className="text-sm text-ink2 leading-relaxed">{c.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════ MARKET OPPORTUNITY ═══════ */}
      <section className="border-y border-border bg-card">
        <div className="container py-20">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <motion.p variants={fadeUp} custom={0} className="text-xs font-medium tracking-[2px] uppercase text-electric-blue mb-3 text-center">
              Market Opportunity
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-[38px] leading-[1.1] tracking-tight text-center mb-14">
              The numbers speak for themselves
            </motion.h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {marketStats.map((s, i) => (
                <motion.div key={s.stat} variants={fadeUp} custom={i + 2} className="text-center">
                  <div className="font-display text-[44px] tracking-tight text-primary leading-none mb-2">{s.stat}</div>
                  <div className="text-sm text-ink2 leading-snug max-w-[180px] mx-auto">{s.label}</div>
                </motion.div>
              ))}
            </div>
            <motion.blockquote variants={fadeUp} custom={7} className="mt-14 text-center max-w-3xl mx-auto">
              <p className="text-[17px] text-ink2 italic font-light leading-relaxed">
                "The next Datadog won't monitor servers. It will monitor AI. FlowLedger is building that layer before anyone else realizes the category exists."
              </p>
            </motion.blockquote>
          </motion.div>
        </div>
      </section>

      {/* ═══════ BUSINESS MODEL ═══════ */}
      <section className="container py-20">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
          <motion.p variants={fadeUp} custom={0} className="text-xs font-medium tracking-[2px] uppercase text-electric-blue mb-3 text-center">
            Business Model
          </motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="font-display text-[38px] leading-[1.1] tracking-tight text-center mb-14">
            Four revenue streams. All compounding.
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-6">
            {revenueStreams.map((r, i) => (
              <motion.div
                key={r.title}
                variants={fadeUp}
                custom={i + 2}
                className="bg-card border border-border rounded-2xl p-7 flex gap-5 items-start hover:border-primary/20 transition-colors"
              >
                <div className="text-3xl shrink-0 mt-0.5">{r.icon}</div>
                <div>
                  <h3 className="text-[17px] font-medium text-foreground tracking-tight mb-1 font-body">{r.title}</h3>
                  <p className="text-sm text-ink2 leading-relaxed">{r.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════ TECH STACK ═══════ */}
      <section className="border-t border-border bg-[hsl(var(--dark-surface))] text-[hsl(var(--dark-surface-foreground))]">
        <div className="container py-24">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
            <motion.p variants={fadeUp} custom={0} className="text-xs font-medium tracking-[2px] uppercase text-electric-blue mb-3 text-center">
              Technology
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="font-display text-[42px] leading-[1.1] tracking-tight text-center mb-4">
              Built to scale. Moving fast.
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-base text-center font-light mb-16 max-w-xl mx-auto opacity-60">
              Entire stack is serverless-first, type-safe, and deployable to production in under 5 minutes.
            </motion.p>

            <div className="space-y-6">
              {techLayers.map((layer, li) => (
                <motion.div
                  key={layer.label}
                  variants={fadeUp}
                  custom={li + 3}
                  className={`rounded-2xl border ${layer.borderColor} bg-gradient-to-r ${layer.color} p-6 backdrop-blur-sm`}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-2.5 h-2.5 rounded-full ${layer.accentColor} bg-current`} />
                    <h3 className={`text-sm font-medium tracking-[1.5px] uppercase ${layer.accentColor}`}>
                      {layer.label}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {layer.tools.map((tool, ti) => (
                      <motion.div
                        key={tool.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: li * 0.1 + ti * 0.05, duration: 0.35 }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        className="bg-[hsl(var(--dark-surface))] border border-white/[0.06] rounded-xl px-4 py-3.5 cursor-default"
                      >
                        <div className="text-sm font-medium text-white/90 tracking-tight">{tool.name}</div>
                        <div className="text-[11px] text-white/40 mt-0.5">{tool.desc}</div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Connection lines decoration */}
            <motion.div
              variants={fadeUp}
              custom={10}
              className="mt-16 flex items-center justify-center gap-3"
            >
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                >
                  <div className="w-2 h-2 rounded-full bg-primary/40" />
                  {i < 4 && <div className="w-12 h-px bg-primary/20" />}
                </motion.div>
              ))}
            </motion.div>
            <motion.p variants={fadeUp} custom={11} className="text-center text-xs text-white/30 mt-4 tracking-wider uppercase">
              Fully connected · Real-time · Serverless
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ═══════ TRACTION ═══════ */}
      <section className="container py-20">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={stagger}>
          <motion.p variants={fadeUp} custom={0} className="text-xs font-medium tracking-[2px] uppercase text-electric-blue mb-3 text-center">
            Traction & Roadmap
          </motion.p>
          <motion.h2 variants={fadeUp} custom={1} className="font-display text-[38px] leading-[1.1] tracking-tight text-center mb-14">
            Where we are. Where we're going.
          </motion.h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <motion.div variants={fadeUp} custom={2} className="bg-card border border-border rounded-2xl p-7">
              <h3 className="text-xs font-medium tracking-[1.5px] uppercase text-emerald mb-5">Now</h3>
              <ul className="space-y-3">
                {[
                  "Working MVP — live demo running today",
                  "Core ingest pipeline fully functional",
                  "Real-time dashboard with live data",
                  "Simulated run data demonstrates full loop",
                  "Landing page live at flowledger.com",
                ].map((item) => (
                  <li key={item} className="text-sm text-ink2 pl-5 relative">
                    <span className="absolute left-0 text-emerald font-medium">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeUp} custom={3} className="bg-card border border-border rounded-2xl p-7">
              <h3 className="text-xs font-medium tracking-[1.5px] uppercase text-primary mb-5">Next 12 Months</h3>
              <ul className="space-y-3">
                {[
                  "Q2 2026 — 10 paying beta customers",
                  "Q3 2026 — Full integration marketplace live",
                  "Q3 2026 — Stripe billing + enterprise tier",
                  "Q4 2026 — AI spend management module",
                  "Q1 2027 — $1M ARR target",
                ].map((item) => (
                  <li key={item} className="text-sm text-ink2 pl-5 relative">
                    <span className="absolute left-0 text-primary font-medium">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default Docs;
