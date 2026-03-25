const integrations = [
  "Zapier", "n8n", "Make", "LangChain", "OpenAI", "Anthropic", "Notion", "Slack",
];

const IntegrationStrip = () => {
  return (
    <section className="border-y border-border py-10">
      <div className="container">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Connects with:
          </span>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {integrations.map((name) => (
              <span key={name} className="text-sm font-semibold text-foreground">
                {name}
              </span>
            ))}
            <span className="text-sm text-muted-foreground">and 80 more</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default IntegrationStrip;
