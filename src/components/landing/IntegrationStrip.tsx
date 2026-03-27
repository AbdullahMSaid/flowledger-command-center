const integrations = ["Zapier", "n8n", "Make", "LangChain", "OpenAI", "Anthropic", "Notion", "Slack"];

const IntegrationStrip = () => {
  return (
    <section id="integrations" className="border-y border-border py-7 bg-card px-12">
      <div className="container flex items-center justify-between gap-8 px-0">
        <span className="text-xs text-ink3 whitespace-nowrap tracking-wider uppercase">
          Connects with
        </span>
        <div className="flex items-center gap-10 flex-wrap">
          {integrations.map((name) => (
            <span key={name} className="text-base font-medium text-foreground/60 tracking-tight">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default IntegrationStrip;
