-- =============================================================================
-- FN-APP Phase 1 — Milestone 5: Web Push Subscriptions & pg_cron Dispatcher
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  daily_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_reminder_hour SMALLINT NOT NULL DEFAULT 20 CHECK (daily_reminder_hour BETWEEN 0 AND 23),
  credit_card_due_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  recurring_due_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  debt_due_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_recap_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start SMALLINT NOT NULL DEFAULT 22 CHECK (quiet_hours_start BETWEEN 0 AND 23),
  quiet_hours_end SMALLINT NOT NULL DEFAULT 7 CHECK (quiet_hours_end BETWEEN 0 AND 23),
  sent_today_count SMALLINT NOT NULL DEFAULT 0 CHECK (sent_today_count BETWEEN 0 AND 2),
  last_sent_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY push_subscriptions_insert_own ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_subscriptions_update_own ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Note: When pg_cron is enabled on Supabase, schedule hourly evaluation:
-- SELECT cron.schedule(
--   'fn-app-hourly-push-dispatcher',
--   '0 * * * *',
--   $$SELECT net.http_post(url := current_setting('app.edge_push_dispatcher_url', true))$$
-- );

