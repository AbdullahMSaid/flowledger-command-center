const steps = [
  {
    number: "01",
    title: "Connect your stack",
    description:
      "Plug in Zapier, Make, n8n, LangChain, or any AI tool in under two minutes. We handle auth and schema detection.",
  },
  {
    number: "02",
    title: "Discover every flow",
    description:
      "FlowLedger auto-maps every workflow, agent, and automation — including the ones your team forgot about.",
  },
  {
    number: "03",
    title: "Govern and optimize",
    description:
      "Set cost guardrails, latency alerts, and compliance policies. Cut AI spend by 40% without touching a single workflow.",
  },
];

const HowItWorks = () => {
  return (
    <section className="container py-24" id="product">
      <h2 className="font-display text-4xl text-foreground mb-16 text-center">
        How it works
      </h2>
      <div className="grid md:grid-cols-3 gap-12">
        {steps.map((step) => (
          <div key={step.number} className="space-y-4">
            <span className="text-sm font-semibold text-electric-blue">
              {step.number}
            </span>
            <h3 className="font-display text-2xl text-foreground">
              {step.title}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;
