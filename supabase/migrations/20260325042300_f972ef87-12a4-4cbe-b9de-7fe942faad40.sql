
-- Fix the permissive INSERT policy on runs
-- Drop the overly permissive policy and replace with one scoped to service_role
DROP POLICY "Service role can insert runs" ON public.runs;

-- Only allow inserts when the flow exists (basic validation)
-- The edge function uses service_role which bypasses RLS, so this policy
-- is for any authenticated user inserting via client (which we don't want)
-- We'll rely on service_role bypassing RLS for the ingest endpoint
