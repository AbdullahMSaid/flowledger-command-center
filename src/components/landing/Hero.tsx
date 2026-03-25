import { Button } from "@/components/ui/button";
import dashboardMockup from "@/assets/dashboard-mockup.jpg";

const Hero = () => {
  return (
    <section className="container py-20 lg:py-28">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-electric-blue">
            AI Operations Platform
          </span>
          <h1 className="font-display text-5xl lg:text-6xl leading-[1.1] text-foreground">
            The command center for your AI workflows
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
            Track, govern, and optimize every automation and AI agent running across your organization — from a single pane of glass.
          </p>
          <div className="flex items-center gap-4">
            <Button variant="hero" size="lg">
              Get early access
            </Button>
            <Button variant="hero-outline" size="lg">
              View live demo
            </Button>
          </div>
        </div>
        <div className="relative">
          <div className="border border-border rounded-lg overflow-hidden shadow-2xl shadow-foreground/5">
            <img
              src={dashboardMockup}
              alt="FlowLedger dashboard showing live AI workflow statuses, spend metrics, and volume charts"
              width={1200}
              height={800}
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
