const Footer = () => {
  return (
    <footer className="border-t border-border py-8 px-12 flex items-center justify-between bg-card">
      <div className="font-display text-lg">
        Flow<span className="text-electric-blue">Ledger</span>
      </div>
      <div className="text-[13px] text-ink3">
        © {new Date().getFullYear()} FlowLedger, Inc. · Privacy · Terms
      </div>
    </footer>
  );
};

export default Footer;
