const Footer = () => {
  return (
    <footer className="border-t border-border py-10">
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="font-display text-lg text-foreground">FlowLedger</span>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} FlowLedger, Inc.</span>
          <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="#" className="hover:text-foreground transition-colors">Terms</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
