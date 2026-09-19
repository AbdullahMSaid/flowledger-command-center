import { useState } from "react";
import { Link } from "react-router-dom";

const EmailCapture = () => {
  const [email, setEmail] = useState("");

  return (
    <section className="bg-card border-t border-border">
      <div className="container max-w-[800px] py-24 text-center">
        <h2 className="font-display text-5xl leading-[1.1] tracking-tight mb-4">
          Ready to inspect the failure mode?
        </h2>
        <p className="text-base text-ink2 font-light mb-9">
          Run the deterministic demo, then configure the existing Supabase workspace when you are ready to test authenticated data.
        </p>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex items-center gap-2.5 justify-center flex-wrap"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Work email address"
            className="border border-border rounded-lg px-[18px] py-3.5 text-[15px] font-body text-foreground bg-card w-[280px] focus:outline-none focus:border-primary"
          />
          <Link
            to="/signup"
            className="bg-primary text-primary-foreground px-7 py-3.5 rounded-lg text-[15px] font-medium tracking-tight hover:translate-y-[-1px] hover:shadow-[0_8px_24px_rgba(26,75,255,0.3)] transition-all"
          >
            Explore the sample →
          </Link>
        </form>
      </div>
    </section>
  );
};

export default EmailCapture;
