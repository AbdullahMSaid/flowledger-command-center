
-- Create flows table
CREATE TABLE public.flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create runs table
CREATE TABLE public.runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  duration_ms INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  cost_usd NUMERIC NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_runs_flow_created ON public.runs(flow_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for flows
CREATE POLICY "Users can view their own flows"
  ON public.flows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own flows"
  ON public.flows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flows"
  ON public.flows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flows"
  ON public.flows FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for runs: users can read runs belonging to their flows
CREATE POLICY "Users can view runs of their own flows"
  ON public.runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.flows
      WHERE flows.id = runs.flow_id
      AND flows.user_id = auth.uid()
    )
  );

-- Service role can insert runs (for the ingest endpoint)
CREATE POLICY "Service role can insert runs"
  ON public.runs FOR INSERT
  WITH CHECK (true);

-- Enable realtime for runs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.runs;

-- Seed data function: called after first signup
CREATE OR REPLACE FUNCTION public.seed_user_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  flow1_id UUID;
  flow2_id UUID;
  i INTEGER;
  run_status TEXT;
  run_error TEXT;
  run_cost NUMERIC;
  run_duration INTEGER;
  run_tokens INTEGER;
  run_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Create seed flows
  INSERT INTO public.flows (id, user_id, name, platform, model)
  VALUES (gen_random_uuid(), NEW.id, 'Customer support triage', 'Zapier', 'gpt-4o')
  RETURNING id INTO flow1_id;

  INSERT INTO public.flows (id, user_id, name, platform, model)
  VALUES (gen_random_uuid(), NEW.id, 'Invoice extraction agent', 'n8n', 'claude-3-5-haiku')
  RETURNING id INTO flow2_id;

  -- Create 15 seed runs spread across last 7 days
  FOR i IN 1..15 LOOP
    IF random() < 0.8 THEN
      run_status := 'success';
      run_error := NULL;
    ELSE
      run_status := 'error';
      run_error := CASE (floor(random() * 3))::int
        WHEN 0 THEN 'Rate limit exceeded on OpenAI API'
        WHEN 1 THEN 'Timeout waiting for upstream response'
        ELSE 'Invalid input format in payload'
      END;
    END IF;

    run_cost := round((random() * 0.078 + 0.002)::numeric, 4);
    run_duration := (random() * 3200 + 800)::integer;
    run_tokens := (random() * 4000 + 500)::integer;
    run_time := now() - (random() * interval '7 days');

    INSERT INTO public.runs (flow_id, status, duration_ms, token_count, cost_usd, error_message, created_at)
    VALUES (
      CASE WHEN random() < 0.5 THEN flow1_id ELSE flow2_id END,
      run_status,
      run_duration,
      run_tokens,
      run_cost,
      run_error,
      run_time
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger to seed data on new user signup
CREATE TRIGGER on_auth_user_created_seed
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_user_data();
