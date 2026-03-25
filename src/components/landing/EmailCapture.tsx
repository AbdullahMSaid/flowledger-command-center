import { useState } from "react";
import { Button } from "@/components/ui/button";

const EmailCapture = () => {
  const [email, setEmail] = useState("");

  return (
    <section className="border-t border-border py-24">
      <div className="container max-w-2xl text-center space-y-8">
        <h2 className="font-display text-4xl text-foreground">
          Ready to see what's running in your org?
        </h2>
        <p className="text-muted-foreground">
          Get early access to FlowLedger. No credit card required.
        </p>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex items-center gap-3 max-w-md mx-auto"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="flex-1 h-12 px-4 rounded-sm border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button variant="hero" size="lg">
            Get access
          </Button>
        </form>
      </div>
    </section>
  );
};

export default EmailCapture;
