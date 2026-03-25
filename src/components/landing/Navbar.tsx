import { Button } from "@/components/ui/button";

const navLinks = ["Product", "Integrations", "Pricing", "Docs"];

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-10">
          <a href="/" className="font-display text-xl text-foreground">
            FlowLedger
          </a>
          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link}>
                <a
                  href={`#${link.toLowerCase()}`}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <Button variant="nav" size="sm">
          Start free →
        </Button>
      </div>
    </nav>
  );
};

export default Navbar;
