# Current Supabase schema snapshot

Captured from the SQL Editor JSON result supplied on 2026-09-20. This describes the `public` schema only, before the new workspace and governance migrations are applied. It contains schema metadata, not table rows. Re-run the snapshot query after migrations and replace/update this file when the database changes.

## Tables

### `flows`

RLS enabled. Columns: `id uuid` (primary key, `gen_random_uuid()`), `user_id uuid` (required), `name text` (required), `platform text` (required), `model text` (required), `flow_enabled boolean` (required, default `true`), `budget_limit numeric`, `created_at timestamptz` (required, default `now()`).

### `runs`

RLS enabled. Columns: `id uuid` (primary key, `gen_random_uuid()`), `flow_id uuid` (required), `status text` (required), `duration_ms integer` (required), `token_count integer` (required), `cost_usd numeric` (required), `error_message text`, `created_at timestamptz` (required, default `now()`).

### `alert_rules`

RLS enabled. Columns: `id uuid` (primary key, `gen_random_uuid()`), `user_id uuid` (required), `name text` (required), `condition_type text` (required), `threshold numeric` (required), `scope text` (required, default `'all'`), `flow_id uuid`, `notify_email boolean` (required, default `true`), `slack_webhook_url text`, `enabled boolean` (required, default `true`), `created_at timestamptz` (required, default `now()`).

### `alert_history`

RLS enabled. Columns: `id uuid` (primary key, `gen_random_uuid()`), `user_id uuid` (required), `rule_id uuid`, `rule_name text` (required), `condition_type text` (required), `flow_id uuid`, `flow_name text`, `status text` (required, default `'triggered'`), `created_at timestamptz` (required, default `now()`).

## Foreign keys

- `runs.flow_id` → `flows.id`
- `alert_rules.flow_id` → `flows.id`
- `alert_history.flow_id` → `flows.id`
- `alert_history.rule_id` → `alert_rules.id`

## Row-level security policies

- `flows`: authenticated users can select, insert, update, and delete their own rows (`auth.uid() = user_id`).
- `runs`: users can select runs belonging to their own flows. No client insert policy was present in the snapshot.
- `alert_rules`: users can select, insert, update, and delete their own rules (`auth.uid() = user_id`).
- `alert_history`: users can select their own history; authenticated insert checks `auth.uid() = user_id`.

## Functions, triggers, and Realtime

- Function: `seed_user_data()`; trigger function, `SECURITY DEFINER`.
- Triggers in `public`: none reported by the snapshot query.
- Realtime publication: `runs` is included. The user separately queried the publication and reported only `runs`; `alert_history` was not included.

## Not included in this snapshot

This is not a complete Supabase project export. It does not describe `auth.users`, Auth provider settings, Storage, Edge Function deployments or secrets, Netlify environment variables, or application API keys. The attached schema result contained no row data or secret values.
