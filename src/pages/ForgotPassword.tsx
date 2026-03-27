import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <Link to="/" className="block font-display text-[22px] tracking-tight mb-10 text-center">
          Flow<span className="text-primary">Ledger</span>
        </Link>
        <h1 className="font-display text-3xl tracking-tight text-center mb-2">Reset password</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Enter your email and we'll send you a reset link.
        </p>

        {success ? (
          <div className="text-center">
            <p className="text-sm text-foreground mb-4">
              Check your email for a password reset link.
            </p>
            <Link to="/login" className="text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-border rounded-lg px-4 py-3 text-sm bg-card text-foreground focus:outline-none focus:border-primary"
                  placeholder="you@company.com"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground py-3 rounded-lg text-sm font-medium tracking-tight hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
            <p className="text-sm text-muted-foreground text-center mt-6">
              <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
