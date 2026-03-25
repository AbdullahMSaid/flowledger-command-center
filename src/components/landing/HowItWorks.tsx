const steps = [
  {
    num: "01",
    title: "Connect your stack",
    desc: "One-click integrations with Zapier, Make, n8n, LangChain, OpenAI, Anthropic and 80+ more. No code required.",
  },
  {
    num: "02",
    title: "Discover every flow",
    desc: "FlowLedger auto-discovers all running automations and agents, maps their dependencies, and tracks their performance in real time.",
  },
  {
    num: "03",
    title: "Govern and optimize",
    desc: "Set spend limits, get alerted on failures, enforce compliance policies, and optimize token usage across every workflow.",
  },
];

const HowItWorks = () => {
  return (
    <section className="container py-24">
      <div className="text-xs font-medium tracking-[2px] uppercase text-electric-blue mb-4 text-center">
        How it works
      </div>
      <h2 className="font-display text-[42px] leading-[1.1] tracking-tight text-center mb-4">
        From chaos to control,<br />in minutes
      </h2>
      <p className="text-base text-ink2 text-center font-light mb-16 max-w-[560px] mx-auto">
        Connect your tools, and FlowLedger automatically discovers and maps every AI workflow running in your organization.
      </p>
      <div className="grid md:grid-cols-3 gap-8">
        {steps.map((step) => (
          <div key={step.num} className="p-8 bg-card border border-border rounded-2xl">
            <div className="font-display text-5xl text-primary/10 leading-none mb-3">
              {step.num}
            </div>
            <h3 className="text-[17px] font-medium text-foreground tracking-tight mb-2 font-body">
              {step.title}
            </h3>
            <p className="text-sm text-ink2 leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;
