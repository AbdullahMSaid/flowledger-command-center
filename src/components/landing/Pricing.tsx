const tiers = [
  {
    tier: "Starter",
    price: "49",
    period: "per month",
    cta: "Get started",
    featured: false,
    highlight: "Monitor up to $500/mo in AI spend",
    features: [
      "Up to 25 active flows",
      "5 integrations",
      "7-day audit history",
      "Email alerts",
    ],
  },
  {
    tier: "Growth",
    price: "249",
    period: "per month",
    cta: "Start free trial",
    featured: true,
    highlight: "Monitor up to $10,000/mo in AI spend",
    features: [
      "Unlimited flows",
      "All integrations",
      "90-day audit history",
      "Spend optimization",
      "Slack + PagerDuty alerts",
      "Workflow marketplace",
    ],
  },
  {
    tier: "Enterprise",
    price: "Custom",
    period: "contact us",
    cta: "Talk to sales",
    featured: false,
    highlight: "Unlimited AI spend monitoring",
    features: [
      "Everything in Growth",
      "SOC 2 & GDPR audit logs",
      "SSO & role-based access",
      "Dedicated SLA",
      "Custom integrations",
      "AI spend negotiation",
    ],
  },
];

const Pricing = () => {
  return (
    <section className="container py-24" id="pricing">
      <div className="text-xs font-medium tracking-[2px] uppercase text-electric-blue mb-4 text-center">
        Pricing
      </div>
      <h2 className="font-display text-[42px] leading-[1.1] tracking-tight text-center mb-4">
        Simple, usage-based pricing
      </h2>
      <p className="text-base text-ink2 text-center font-light mb-16 max-w-[560px] mx-auto">
        Start free. Scale as your AI footprint grows.
      </p>
      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {tiers.map((t) => (
          <div
            key={t.tier}
            className={`relative bg-card border rounded-2xl p-8 flex flex-col ${
              t.featured
                ? "border-2 border-primary bg-[#F7F9FF]"
                : "border-border"
            }`}
          >
            {t.featured && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[11px] font-medium px-3.5 py-1 rounded-full whitespace-nowrap tracking-wider">
                Most popular
              </span>
            )}
            <div className="text-xs font-medium tracking-[1.5px] uppercase text-ink3 mb-3">
              {t.tier}
            </div>
            <div className="font-display leading-none mb-1">
              {t.price === "Custom" ? (
                <span className="text-[32px]">{t.price}</span>
              ) : (
                <span className="text-[42px]">
                  <sup className="text-lg align-top font-body">$</sup>
                  {t.price}
                </span>
              )}
            </div>
            <div className="text-[13px] text-ink3 mb-6">{t.period}</div>
            <ul className="flex flex-col gap-2.5 mb-7 flex-1">
              {t.features.map((f) => (
                <li key={f} className="text-sm text-ink2 pl-5 relative">
                  <span className="absolute left-0 text-emerald font-medium">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#"
              className={`block text-center py-2.5 rounded-lg text-sm font-medium transition-all ${
                t.featured
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-border text-foreground hover:border-ink3"
              }`}
            >
              {t.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Pricing;
