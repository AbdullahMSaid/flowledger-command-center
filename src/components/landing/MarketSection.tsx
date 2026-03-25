const stats = [
  { num: "$847B", label: "Global AI software market by 2030" },
  { num: "73%", label: "Of enterprises have no AI governance today" },
  { num: "11×", label: "YoY growth in enterprise AI workflow volume" },
  { num: "$0", label: "Dominant player in AI Ops category today" },
];

const MarketSection = () => {
  return (
    <section className="bg-foreground text-white py-24 px-12">
      <div className="container px-0">
        <div className="text-xs font-medium tracking-[2px] uppercase text-white/40 mb-4">
          The opportunity
        </div>
        <h2 className="font-display text-5xl leading-[1.08] tracking-tight mb-12 max-w-[640px]">
          Every enterprise will need an{" "}
          <em className="text-[#7EB5FF]">AI Ops layer</em> within 24 months
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {stats.map((s) => (
            <div key={s.num} className="border-l-2 border-white/10 pl-5">
              <div className="font-display text-[40px] leading-none">{s.num}</div>
              <div className="text-[13px] text-white/50 mt-1.5">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 max-w-[640px]">
          <blockquote className="font-display text-xl leading-relaxed text-white/85 italic mb-4">
            "The next Datadog won't monitor servers. It will monitor AI. FlowLedger is building that layer before anyone else realizes the category exists."
          </blockquote>
          <cite className="text-[13px] text-white/40 not-italic">— Positioning thesis, Q1 2026</cite>
        </div>
      </div>
    </section>
  );
};

export default MarketSection;
