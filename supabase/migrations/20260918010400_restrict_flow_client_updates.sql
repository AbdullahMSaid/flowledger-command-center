-- Members may rename or describe assigned flows, but budgets, ownership,
-- lifecycle, approval, and protection changes must go through audited RPCs.

REVOKE UPDATE ON public.flows FROM authenticated;
GRANT UPDATE (name, description, business_purpose, team_label, platform, model) ON public.flows TO authenticated;
