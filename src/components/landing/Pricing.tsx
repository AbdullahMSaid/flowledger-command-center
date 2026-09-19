import { Link } from "react-router-dom";

const Pricing = () => {
  return (
    <section className="container py-24" id="pricing">
      <div className="text-xs font-medium tracking-[2px] uppercase text-electric-blue mb-4 text-center">
        Access
      </div>
      <h2 className="font-display text-[42px] leading-[1.1] tracking-tight text-center mb-4">
        Explore the product
      </h2>
      <p className="text-base text-ink2 text-center font-light mb-16 max-w-[560px] mx-auto">
        This prototype has no plans, billing, or customer access tiers. Use the sample workspace to see the core experience, or connect the existing Supabase foundation for account data.
      </p>
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center">
        <div className="text-xs font-medium uppercase tracking-[1.5px] text-ink3">What you can try now</div>
        <ul className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm text-ink2"><li>• A simple overview of workflows, spend, and issues</li><li>• A guided review and a clear example of budget protection</li><li>• An isolated development sample workspace</li></ul>
        <div className="mt-7 flex flex-wrap justify-center gap-3"><Link to="/demo" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Open sample workspace</Link><Link to="/docs" className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground">Read help</Link></div>
      </div>
    </section>
  );
};

export default Pricing;
