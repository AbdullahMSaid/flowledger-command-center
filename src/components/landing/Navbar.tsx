import { Link, useNavigate } from "react-router-dom";

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

  const handleHashClick = (hash: string) => (e: React.MouseEvent) => {
    e.preventDefault();
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
    <nav className="sticky top-0 z-50 flex items-center justify-between px-12 py-5 border-b border-border bg-surface/92 backdrop-blur-[12px]">
      <Link to="/" className="font-display text-[22px] tracking-tight">
        Flow<span className="text-electric-blue">Ledger</span>
      </Link>
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
      <Link
        to="/signup"
        className="bg-foreground text-background px-5 py-2.5 rounded-lg text-sm font-medium tracking-tight hover:opacity-90 transition-opacity"
      >
        Start free →
      </Link>
    </nav>
  );
};

export default Navbar;
