
-- Alert rules table
CREATE TABLE public.alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all',
  flow_id UUID REFERENCES public.flows(id) ON DELETE CASCADE,
  notify_email BOOLEAN NOT NULL DEFAULT true,
  slack_webhook_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert rules" ON public.alert_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own alert rules" ON public.alert_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alert rules" ON public.alert_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alert rules" ON public.alert_rules FOR DELETE USING (auth.uid() = user_id);

-- Alert history table
CREATE TABLE public.alert_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  rule_name TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  flow_id UUID REFERENCES public.flows(id) ON DELETE SET NULL,
  flow_name TEXT,
  status TEXT NOT NULL DEFAULT 'triggered',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert history" ON public.alert_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert alert history" ON public.alert_history FOR INSERT WITH CHECK (true);
