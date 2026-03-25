const stats = [
  { value: "$847B", label: "AI market by 2030" },
  { value: "73%", label: "of enterprises have no AI governance" },
  { value: "11×", label: "YoY growth in workflow volume" },
  { value: "$0", label: "dominant competitor exists today" },
];

const MarketSection = () => {
  return (
    <section className="bg-dark-surface text-dark-surface-foreground py-24">
      <div className="container space-y-16">
        <h2 className="font-display text-4xl lg:text-5xl text-center max-w-3xl mx-auto leading-tight">
          Every enterprise will need an AI Ops layer within 24 months.
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12">
          {stats.map((stat) => (
            <div key={stat.label} className="space-y-2">
              <p className="font-display text-4xl text-emerald">{stat.value}</p>
              <p className="text-sm text-dark-surface-foreground/70">{stat.label}</p>
            </div>
          ))}
        </div>
        <blockquote className="border-l-2 border-electric-blue pl-6 max-w-2xl mx-auto">
          <p className="text-lg italic text-dark-surface-foreground/80">
            "FlowLedger is building the Datadog for AI operations — a category that doesn't have a clear leader yet, but will be essential infrastructure for every company running AI at scale."
          </p>
        </blockquote>
      </div>
    </section>
  );
};

export default MarketSection;
