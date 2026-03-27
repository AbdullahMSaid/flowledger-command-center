
DROP POLICY "Service can insert alert history" ON public.alert_history;
CREATE POLICY "Authenticated can insert alert history" ON public.alert_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
