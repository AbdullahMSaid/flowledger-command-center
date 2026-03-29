const navLinks = [
  { label: "Product", href: "/#product" },
  { label: "Integrations", href: "/#integrations" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Investors", href: "/investors" },
];

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-12 py-5 border-b border-border bg-surface/92 backdrop-blur-[12px]">
      <a href="/" className="font-display text-[22px] tracking-tight">
        Flow<span className="text-electric-blue">Ledger</span>
      </a>
      <div className="hidden md:flex items-center gap-8">
        {navLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="text-sm text-ink2 hover:text-foreground transition-colors"
          >
            {link.label}
          </a>
        ))}
      </div>
      <a
        href="/signup"
        className="bg-foreground text-background px-5 py-2.5 rounded-lg text-sm font-medium tracking-tight hover:opacity-90 transition-opacity"
      >
        Start free →
      </a>
    </nav>
  );
};

export default Navbar;
