const stats = [
  { num: "1", label: "Deterministic public failure-mode demo" },
  { num: "2", label: "Workspace roles: admin and member" },
  { num: "0", label: "Provider calls made by the public demo" },
  { num: "1", label: "Cooperative guard and settlement path" },
];

const MarketSection = () => {
  return (
    <section className="bg-foreground text-white py-24 px-12">
      <div className="container px-0">
        <div className="text-xs font-medium tracking-[2px] uppercase text-white/40 mb-4">
          The opportunity
        </div>
        <h2 className="font-display text-5xl leading-[1.08] tracking-tight mb-12 max-w-[640px]">
          A practical control layer for{" "}
          <em className="text-[#7EB5FF]">registered AI workflows</em>
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
            "Make the expensive call explainable before it becomes an expensive surprise."
          </blockquote>
          <cite className="text-[13px] text-white/40 not-italic">— FlowLedger product thesis</cite>
        </div>
      </div>
    </section>
  );
};

export default MarketSection;
