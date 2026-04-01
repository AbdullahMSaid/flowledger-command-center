import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const routeLinks = [
  { label: "Docs", href: "/docs" },
  { label: "Investors", href: "/investors" },
];

const hashLinks = [
  { label: "Product", hash: "product" },
  { label: "Integrations", hash: "integrations" },
  { label: "Pricing", hash: "pricing" },
];

const Navbar = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth(false);

  const handleHashClick = (hash: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileOpen(false);
    if (window.location.pathname === "/") {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/#" + hash);
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-surface/92 backdrop-blur-[12px]">
      <div className="flex items-center justify-between px-6 md:px-12 py-5">
        <Link to="/" className="font-display text-[22px] tracking-tight">
          Flow<span className="text-electric-blue">Ledger</span>
        </Link>
        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          {hashLinks.map((link) => (
            <a
              key={link.label}
              href={`/#${link.hash}`}
              onClick={handleHashClick(link.hash)}
              className="text-sm text-ink2 hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
          {routeLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="text-sm text-ink2 hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              to="/dashboard"
              className="bg-foreground text-background px-5 py-2.5 rounded-lg text-sm font-medium tracking-tight hover:opacity-90 transition-opacity"
            >
              Go to dashboard →
            </Link>
          ) : (
            <Link
              to="/signup"
              className="bg-foreground text-background px-5 py-2.5 rounded-lg text-sm font-medium tracking-tight hover:opacity-90 transition-opacity"
            >
              Start free →
            </Link>
          )}
          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="md:hidden flex flex-col border-t border-border bg-surface/95 px-6 py-4 gap-4">
          {hashLinks.map((link) => (
            <a
              key={link.label}
              href={`/#${link.hash}`}
              onClick={handleHashClick(link.hash)}
              className="text-sm text-ink2 hover:text-foreground transition-colors py-1"
            >
              {link.label}
            </a>
          ))}
          {routeLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-sm text-ink2 hover:text-foreground transition-colors py-1"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
