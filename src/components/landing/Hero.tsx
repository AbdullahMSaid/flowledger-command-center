import { useState } from "react";

const flows = [
  { name: "Customer support triage", meta: "GPT-4o · Zapier · Last run 2m ago", status: "Live", statusClass: "bg-[#E6FBF4] text-[#0A7A57]" },
  { name: "Invoice extraction agent", meta: "Claude 3.5 · n8n · Last run 14m ago", status: "Live", statusClass: "bg-[#E6FBF4] text-[#0A7A57]" },
  { name: "Weekly report generator", meta: "GPT-4o · Make.com · Runs Fridays", status: "Degraded", statusClass: "bg-[#FFF8E6] text-[#8B6000]" },
  { name: "Lead enrichment pipeline", meta: "Claude 3 Haiku · LangChain · 3 errors", status: "Error", statusClass: "bg-[#FFF0F0] text-[#A32D2D]" },
];

const Hero = () => {
  return (
    <section className="container py-24 lg:py-[100px]">
      <div className="grid lg:grid-cols-2 gap-20 items-center">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#EEF3FF] border border-primary/15 rounded-full pl-[5px] pr-3.5 py-[5px] mb-4">
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
            <span className="text-xs text-primary font-medium">Now in public beta</span>
          </div>
          <div className="text-xs font-medium tracking-[2px] uppercase text-electric-blue mb-5">
            AI Operations Platform
          </div>
          <h1 className="font-display text-[58px] leading-[1.08] tracking-tight mb-6">
            Stop your AI from <em className="text-primary">burning money.</em>
          </h1>
          <p className="text-[17px] text-ink2 leading-[1.7] font-light mb-9 max-w-lg">
            Set budget limits, pause runaway workflows, and see exactly where every dollar goes — in real time.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <a href="/signup" className="bg-primary text-primary-foreground px-7 py-3.5 rounded-lg text-[15px] font-medium tracking-tight hover:translate-y-[-1px] hover:shadow-[0_8px_24px_rgba(26,75,255,0.3)] transition-all">
              Get early access
            </a>
            <a href="/signup" className="border border-border bg-card text-foreground px-7 py-3.5 rounded-lg text-[15px] hover:border-ink3 transition-colors">
              View live demo
            </a>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.08)]">
          <div className="bg-[#F4F4F2] border-b border-border px-4 py-3 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F5F]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FFBE2E]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#2ACF60]" />
            <span className="text-xs text-ink3 ml-2">FlowLedger — Workspace Overview</span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {[
                { label: "Active flows", val: "247", delta: "↑ 18 this week" },
                { label: "AI spend / mo", val: "$4,821", delta: "↓ 12% vs last month" },
                { label: "Uptime", val: "99.7%", delta: "↑ from 98.2%" },
              ].map((s) => (
                <div key={s.label} className="bg-[#F7F7F5] rounded-lg px-3.5 py-3">
                  <div className="text-[10px] text-ink3 uppercase tracking-wider mb-1">{s.label}</div>
                  <div className="text-xl font-medium text-foreground">{s.val}</div>
                  <div className="text-[10px] text-emerald mt-0.5">{s.delta}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              {flows.map((f) => (
                <div key={f.name} className="flex items-center justify-between bg-[#F7F7F5] rounded-lg px-3 py-2.5">
                  <div>
                    <div className="text-xs font-medium text-foreground">{f.name}</div>
                    <div className="text-[10px] text-ink3 mt-0.5">{f.meta}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${f.statusClass}`}>
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3.5 h-12 relative overflow-hidden">
              <svg className="w-full h-12" viewBox="0 0 300 48" preserveAspectRatio="none">
                <polyline points="0,40 30,36 60,28 90,32 120,18 150,22 180,10 210,14 240,6 270,10 300,4" fill="none" stroke="hsl(225 100% 55%)" strokeWidth="1.5" opacity="0.4" />
                <polyline points="0,44 30,42 60,38 90,40 120,30 150,34 180,22 210,26 240,18 270,22 300,16" fill="none" stroke="hsl(160 100% 39%)" strokeWidth="1.5" opacity="0.4" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
