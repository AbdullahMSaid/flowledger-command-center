const steps = [
  {
    num: "01",
    title: "Register the workflows you want to track",
    desc: "Connect any workflow that can send an authenticated webhook. FlowLedger records the metadata you choose to report; it does not discover private employee activity.",
  },
  {
    num: "02",
    title: "See ownership and cost clearly",
    desc: "Review registered workflows, owners, teams, reported spend, governance gaps, and telemetry health in one workspace-scoped view.",
  },
  {
    num: "03",
    title: "Set limits. Guard the next call.",
    desc: "Guard-connected workflows request permission before a costly call. FlowLedger can deny the next admission at the cap; monitor-only workflows remain reporting-only.",
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
        Register the workflows your team wants to understand, then use reported telemetry and cooperative guard decisions to make spend explainable.
      </p>
      <div className="grid md:grid-cols-3 gap-8">
        {steps.map((step) => (
          <div key={step.num} className="p-8 bg-card border border-border rounded-2xl">
            <div className="font-display text-5xl text-primary/30 leading-none mb-3">
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
