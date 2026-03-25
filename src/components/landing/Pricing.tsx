import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    cta: "Start free trial",
    highlighted: false,
    features: [
      "Up to 50 workflows",
      "3 integrations",
      "7-day log retention",
      "Email alerts",
      "Community support",
    ],
  },
  {
    name: "Growth",
    price: "$249",
    period: "/mo",
    cta: "Start free trial",
    highlighted: true,
    badge: "Most popular",
    features: [
      "Unlimited workflows",
      "Unlimited integrations",
      "90-day log retention",
      "Cost guardrails & budgets",
      "Compliance policies",
      "Slack & PagerDuty alerts",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    cta: "Talk to sales",
    highlighted: false,
    features: [
      "Everything in Growth",
      "SSO & SCIM",
      "Audit logs",
      "Custom data retention",
      "Dedicated CSM",
      "SLA guarantee",
    ],
  },
];

const Pricing = () => {
  return (
    <section className="container py-24" id="pricing">
      <h2 className="font-display text-4xl text-foreground mb-4 text-center">
        Pricing
      </h2>
      <p className="text-muted-foreground text-center mb-16 max-w-lg mx-auto">
        Start free. Scale when you're ready. No credit card required.
      </p>
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative rounded-lg border p-8 flex flex-col ${
              tier.highlighted
                ? "border-primary shadow-lg shadow-primary/10"
                : "border-border"
            }`}
          >
            {tier.badge && (
              <span className="absolute -top-3 left-6 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-sm">
                {tier.badge}
              </span>
            )}
            <h3 className="font-display text-2xl text-foreground">{tier.name}</h3>
            <div className="mt-4 mb-6">
              <span className="text-4xl font-bold font-body text-foreground">{tier.price}</span>
              <span className="text-muted-foreground">{tier.period}</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {tier.features.map((feature) => (
                <li key={feature} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-emerald mt-0.5">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              variant={tier.highlighted ? "hero" : "hero-outline"}
              className="w-full"
            >
              {tier.cta}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Pricing;
