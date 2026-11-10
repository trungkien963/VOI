-- ============================================================================
-- 0001_enums_and_extensions.sql
-- Định nghĩa Extensions và toàn bộ Enum Types cho FN-APP (Phase 1 + Phase 2 hooks)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

CREATE TYPE public.income_source_type AS ENUM ('salary', 'family', 'freelance', 'multiple');
CREATE TYPE public.color_mode_type AS ENUM ('light', 'dark', 'system');
CREATE TYPE public.account_type AS ENUM ('cash', 'bank', 'ewallet', 'credit_card', 'savings');
CREATE TYPE public.account_member_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE public.category_kind AS ENUM ('expense', 'income');

CREATE TYPE public.transaction_type AS ENUM (
  'expense',
  'income',
  'transfer',
  'opening_balance',
  'adjustment',
  'lend',
  'borrow',
  'debt_collect',
  'debt_repay'
);

CREATE TYPE public.transaction_source AS ENUM (
  'quick_input',
  'form',
  'recurring',
  'reconcile',
  'onboarding'
);

CREATE TYPE public.debt_direction AS ENUM ('receivable', 'payable');
CREATE TYPE public.debt_status AS ENUM ('open', 'settled', 'cancelled');
CREATE TYPE public.debt_origin AS ENUM ('opening_balance', 'lend', 'borrow', 'paid_for_others');
CREATE TYPE public.recurring_frequency AS ENUM ('weekly', 'monthly', 'yearly');
CREATE TYPE public.fx_rate_source AS ENUM ('api', 'manual');

CREATE TYPE public.onboarding_checklist_item AS ENUM (
  'create_main_account',
  'add_more_accounts',
  'add_credit_card',
  'add_receivables',
  'add_payables',
  'add_installments',
  'add_recurring'
);

CREATE TYPE public.checklist_item_status AS ENUM ('pending', 'done', 'skipped');
CREATE TYPE public.activity_day_kind AS ENUM ('logged', 'zero_spend_checkin', 'freeze_used');
CREATE TYPE public.audit_action_type AS ENUM ('insert', 'update', 'delete');

-- ============================================================================
-- 0002_core_tables_and_indexes.sql
-- Toàn bộ 17 bảng cốt lõi của FN-APP, Constraints (ON DELETE RESTRICT) & Indexes
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  base_currency CHAR(3) NOT NULL DEFAULT 'VND',
  thousands_input_mode BOOLEAN NOT NULL DEFAULT TRUE,
  income_source public.income_source_type,
  payday_day SMALLINT CHECK (payday_day IS NULL OR (payday_day >= 1 AND payday_day <= 31)),
  has_credit_card BOOLEAN,
  reminder_time TIME,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00:00',
  quiet_hours_end TIME NOT NULL DEFAULT '07:00:00',
  theme_id TEXT NOT NULL DEFAULT 'pop',
  color_mode public.color_mode_type NOT NULL DEFAULT 'system',
  hide_balances BOOLEAN NOT NULL DEFAULT FALSE,
  locale TEXT NOT NULL DEFAULT 'vi',
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  learned_category_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  onboarding_completed_at TIMESTAMPTZ,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  type public.account_type NOT NULL,
  icon TEXT NOT NULL DEFAULT 'hexagon',
  color TEXT NOT NULL DEFAULT '#0057FF',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_accounts_created_by ON public.accounts(created_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_updated_at ON public.accounts(updated_at);

CREATE TABLE public.account_members (
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.account_member_role NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, user_id)
);

CREATE INDEX idx_account_members_user_account ON public.account_members(user_id, account_id);

CREATE TABLE public.pockets (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  currency CHAR(3) NOT NULL DEFAULT 'VND',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  cached_balance_minor BIGINT NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_pockets_account_currency UNIQUE (account_id, currency)
);

CREATE INDEX idx_pockets_account_id ON public.pockets(account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pockets_updated_at ON public.pockets(updated_at);

CREATE TABLE public.credit_card_details (
  account_id UUID PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  credit_limit_minor BIGINT CHECK (credit_limit_minor IS NULL OR credit_limit_minor >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'VND',
  statement_day SMALLINT NOT NULL CHECK (statement_day >= 1 AND statement_day <= 31),
  due_day SMALLINT NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.category_kind NOT NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  slug TEXT,
  icon TEXT NOT NULL DEFAULT 'circle',
  color TEXT NOT NULL DEFAULT '#FF6B00',
  parent_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  budget_group_id UUID,
  phase2_group_hint TEXT,
  default_keywords TEXT[] NOT NULL DEFAULT '{}',
  is_system_special BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_categories_owner ON public.categories(owner_user_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_categories_system_slug ON public.categories(slug) WHERE owner_user_id IS NULL AND slug IS NOT NULL;

CREATE TABLE public.tags (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_tags_owner_name UNIQUE (owner_user_id, name)
);

CREATE TABLE public.debts (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  direction public.debt_direction NOT NULL,
  counterparty_name TEXT NOT NULL CHECK (char_length(trim(counterparty_name)) > 0),
  principal_minor BIGINT NOT NULL CHECK (principal_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'VND',
  due_date DATE,
  note TEXT,
  status public.debt_status NOT NULL DEFAULT 'open',
  origin public.debt_origin NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_debts_owner_status ON public.debts(owner_user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_debts_updated_at ON public.debts(updated_at);

CREATE TABLE public.recurring_rules (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  template JSONB NOT NULL,
  frequency public.recurring_frequency NOT NULL,
  interval_count SMALLINT NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
  day_of_month SMALLINT CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
  day_of_week SMALLINT CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  start_date DATE NOT NULL,
  end_date DATE,
  total_occurrences INTEGER CHECK (total_occurrences IS NULL OR total_occurrences > 0),
  occurrences_done INTEGER NOT NULL DEFAULT 0 CHECK (occurrences_done >= 0),
  next_due_at DATE NOT NULL,
  skipped_dates DATE[] NOT NULL DEFAULT '{}',
  require_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_recurring_owner_due ON public.recurring_rules(owner_user_id, next_due_at)
  WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY,
  type public.transaction_type NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  note TEXT,
  source public.transaction_source NOT NULL DEFAULT 'quick_input',
  group_id UUID,
  recurring_rule_id UUID REFERENCES public.recurring_rules(id) ON DELETE RESTRICT,
  debt_id UUID REFERENCES public.debts(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_transactions_creator_occurred ON public.transactions(created_by, occurred_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_group_id ON public.transactions(group_id)
  WHERE group_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_transactions_debt_id ON public.transactions(debt_id)
  WHERE debt_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_transactions_updated_at ON public.transactions(updated_at);

CREATE TABLE public.transaction_lines (
  id UUID PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  pocket_id UUID NOT NULL REFERENCES public.pockets(id) ON DELETE RESTRICT,
  amount_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  fx_rate_to_base NUMERIC(18, 6) NOT NULL DEFAULT 1.0 CHECK (fx_rate_to_base > 0),
  amount_base_minor BIGINT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_tx_lines_pocket_active ON public.transaction_lines(pocket_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_tx_lines_account_tx ON public.transaction_lines(account_id, transaction_id);
CREATE INDEX idx_tx_lines_transaction_id ON public.transaction_lines(transaction_id);
CREATE INDEX idx_tx_lines_updated_at ON public.transaction_lines(updated_at);

CREATE TABLE public.transaction_tags (
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE public.exchange_rates (
  rate_date DATE NOT NULL,
  base_currency CHAR(3) NOT NULL,
  quote_currency CHAR(3) NOT NULL,
  rate NUMERIC(18, 6) NOT NULL CHECK (rate > 0),
  source public.fx_rate_source NOT NULL DEFAULT 'api',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rate_date, base_currency, quote_currency)
);

CREATE INDEX idx_exchange_rates_lookup ON public.exchange_rates(base_currency, quote_currency, rate_date DESC);

CREATE TABLE public.onboarding_checklist (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item public.onboarding_checklist_item NOT NULL,
  status public.checklist_item_status NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, item)
);

CREATE TABLE public.activity_days (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  kind public.activity_day_kind NOT NULL,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, activity_date)
);

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_push_user_endpoint UNIQUE (user_id, endpoint)
);

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  row_id UUID NOT NULL,
  action public.audit_action_type NOT NULL,
  before_state JSONB,
  after_state JSONB,
  actor_user_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_row ON public.audit_log(table_name, row_id, occurred_at DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_user_id, occurred_at DESC);

-- ============================================================================
-- 0003_triggers_audit_and_balances.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_set_server_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles', 'accounts', 'account_members', 'pockets',
    'credit_card_details', 'categories', 'tags', 'debts',
    'recurring_rules', 'transactions', 'transaction_lines',
    'exchange_rates', 'onboarding_checklist', 'activity_days', 'push_subscriptions'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_server_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_server_updated_at();',
      tbl
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_auto_insert_account_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.account_members (account_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (account_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_accounts_auto_owner
AFTER INSERT ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.tg_auto_insert_account_owner();

CREATE OR REPLACE FUNCTION public.tg_sync_transaction_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    UPDATE public.transaction_lines
    SET deleted_at = NEW.deleted_at,
        client_updated_at = NEW.client_updated_at,
        updated_at = clock_timestamp()
    WHERE transaction_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_transactions_sync_soft_delete
AFTER UPDATE OF deleted_at ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_transaction_soft_delete();

CREATE OR REPLACE FUNCTION public.recalculate_pocket_balance(p_pocket_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  SELECT COALESCE(SUM(amount_minor), 0)
  INTO v_balance
  FROM public.transaction_lines
  WHERE pocket_id = p_pocket_id
    AND deleted_at IS NULL;

  UPDATE public.pockets
  SET cached_balance_minor = v_balance,
      updated_at = clock_timestamp()
  WHERE id = p_pocket_id;

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_update_pocket_cached_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_pocket_balance(NEW.pocket_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.pocket_id IS DISTINCT FROM NEW.pocket_id THEN
      PERFORM public.recalculate_pocket_balance(OLD.pocket_id);
    END IF;
    PERFORM public.recalculate_pocket_balance(NEW.pocket_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_pocket_balance(OLD.pocket_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tr_transaction_lines_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transaction_lines
FOR EACH ROW
EXECUTE FUNCTION public.tg_update_pocket_cached_balance();

CREATE OR REPLACE FUNCTION public.tg_record_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action public.audit_action_type;
  v_row_id UUID;
  v_before JSONB := NULL;
  v_after JSONB := NULL;
  v_actor UUID;
BEGIN
  v_actor := COALESCE(auth.uid(), CASE WHEN TG_OP = 'DELETE' THEN OLD.created_by ELSE NEW.created_by END);

  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_row_id := NEW.id;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_row_id := NEW.id;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_row_id := OLD.id;
    v_before := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_log (table_name, row_id, action, before_state, after_state, actor_user_id, occurred_at)
  VALUES (TG_TABLE_NAME, v_row_id, v_action, v_before, v_after, v_actor, clock_timestamp());

  RETURN NULL;
END;
$$;

DO $$
DECLARE
  audited_tbl TEXT;
BEGIN
  FOREACH audited_tbl IN ARRAY ARRAY['accounts', 'debts', 'transactions', 'transaction_lines']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER tr_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_record_audit_log();',
      audited_tbl, audited_tbl
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- 0004_rls_policies.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_account_member(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id = p_account_id
      AND am.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_account(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id = p_account_id
      AND am.user_id = auth.uid()
      AND am.role IN ('owner', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_account_owner(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.account_id = p_account_id
      AND am.user_id = auth.uid()
      AND am.role = 'owner'
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY accounts_select_member ON public.accounts FOR SELECT USING (public.is_account_member(id));
CREATE POLICY accounts_insert_creator ON public.accounts FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY accounts_update_writer ON public.accounts FOR UPDATE USING (public.can_write_account(id)) WITH CHECK (public.can_write_account(id));
CREATE POLICY accounts_delete_owner ON public.accounts FOR DELETE USING (public.is_account_owner(id));

CREATE POLICY account_members_select ON public.account_members FOR SELECT USING (user_id = auth.uid() OR public.is_account_member(account_id));
CREATE POLICY account_members_insert_owner ON public.account_members FOR INSERT WITH CHECK (public.is_account_owner(account_id));
CREATE POLICY account_members_update_owner ON public.account_members FOR UPDATE USING (public.is_account_owner(account_id)) WITH CHECK (public.is_account_owner(account_id));
CREATE POLICY account_members_delete_owner ON public.account_members FOR DELETE USING (public.is_account_owner(account_id));

CREATE POLICY pockets_select_member ON public.pockets FOR SELECT USING (public.is_account_member(account_id));
CREATE POLICY pockets_insert_writer ON public.pockets FOR INSERT WITH CHECK (created_by = auth.uid() AND public.can_write_account(account_id));
CREATE POLICY pockets_update_writer ON public.pockets FOR UPDATE USING (public.can_write_account(account_id)) WITH CHECK (public.can_write_account(account_id));
CREATE POLICY pockets_delete_owner ON public.pockets FOR DELETE USING (public.is_account_owner(account_id));

CREATE POLICY cc_details_select_member ON public.credit_card_details FOR SELECT USING (public.is_account_member(account_id));
CREATE POLICY cc_details_insert_writer ON public.credit_card_details FOR INSERT WITH CHECK (public.can_write_account(account_id));
CREATE POLICY cc_details_update_writer ON public.credit_card_details FOR UPDATE USING (public.can_write_account(account_id)) WITH CHECK (public.can_write_account(account_id));
CREATE POLICY cc_details_delete_owner ON public.credit_card_details FOR DELETE USING (public.is_account_owner(account_id));

CREATE POLICY categories_select_sys_or_own ON public.categories FOR SELECT USING (owner_user_id IS NULL OR owner_user_id = auth.uid());
CREATE POLICY categories_insert_own ON public.categories FOR INSERT WITH CHECK (owner_user_id = auth.uid() AND is_system_special = FALSE);
CREATE POLICY categories_update_own ON public.categories FOR UPDATE USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid() AND is_system_special = FALSE);
CREATE POLICY categories_delete_own ON public.categories FOR DELETE USING (owner_user_id = auth.uid() AND is_system_special = FALSE);

CREATE POLICY tags_select_own ON public.tags FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY tags_insert_own ON public.tags FOR INSERT WITH CHECK (owner_user_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY tags_update_own ON public.tags FOR UPDATE USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY tags_delete_own ON public.tags FOR DELETE USING (owner_user_id = auth.uid());

CREATE POLICY debts_select_own ON public.debts FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY debts_insert_own ON public.debts FOR INSERT WITH CHECK (owner_user_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY debts_update_own ON public.debts FOR UPDATE USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY debts_delete_own ON public.debts FOR DELETE USING (owner_user_id = auth.uid());

CREATE POLICY recurring_select_own ON public.recurring_rules FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY recurring_insert_own ON public.recurring_rules FOR INSERT WITH CHECK (owner_user_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY recurring_update_own ON public.recurring_rules FOR UPDATE USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY recurring_delete_own ON public.recurring_rules FOR DELETE USING (owner_user_id = auth.uid());

CREATE POLICY transactions_select_access ON public.transactions FOR SELECT USING (
  created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.transaction_lines tl WHERE tl.transaction_id = public.transactions.id AND public.is_account_member(tl.account_id)
  )
);
CREATE POLICY transactions_insert_own ON public.transactions FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY transactions_update_access ON public.transactions FOR UPDATE USING (
  created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.transaction_lines tl WHERE tl.transaction_id = public.transactions.id AND public.can_write_account(tl.account_id)
  )
) WITH CHECK (created_by = auth.uid());
CREATE POLICY transactions_delete_access ON public.transactions FOR DELETE USING (created_by = auth.uid());

CREATE POLICY tx_lines_select_member ON public.transaction_lines FOR SELECT USING (public.is_account_member(account_id));
CREATE POLICY tx_lines_insert_writer ON public.transaction_lines FOR INSERT WITH CHECK (created_by = auth.uid() AND public.can_write_account(account_id));
CREATE POLICY tx_lines_update_writer ON public.transaction_lines FOR UPDATE USING (public.can_write_account(account_id)) WITH CHECK (public.can_write_account(account_id));
CREATE POLICY tx_lines_delete_writer ON public.transaction_lines FOR DELETE USING (public.can_write_account(account_id));

CREATE POLICY tx_tags_select_own ON public.transaction_tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = public.transaction_tags.transaction_id AND t.created_by = auth.uid())
);
CREATE POLICY tx_tags_insert_own ON public.transaction_tags FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = public.transaction_tags.transaction_id AND t.created_by = auth.uid())
);
CREATE POLICY tx_tags_delete_own ON public.transaction_tags FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = public.transaction_tags.transaction_id AND t.created_by = auth.uid())
);

CREATE POLICY exchange_rates_select_all ON public.exchange_rates FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');
CREATE POLICY exchange_rates_insert_manual ON public.exchange_rates FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND source = 'manual');

CREATE POLICY checklist_select_own ON public.onboarding_checklist FOR SELECT USING (user_id = auth.uid());
CREATE POLICY checklist_insert_own ON public.onboarding_checklist FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY checklist_update_own ON public.onboarding_checklist FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY activity_days_select_own ON public.activity_days FOR SELECT USING (user_id = auth.uid());
CREATE POLICY activity_days_insert_own ON public.activity_days FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY activity_days_update_own ON public.activity_days FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY push_sub_select_own ON public.push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY push_sub_insert_own ON public.push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY push_sub_update_own ON public.push_subscriptions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY push_sub_delete_own ON public.push_subscriptions FOR DELETE USING (user_id = auth.uid());

CREATE POLICY audit_log_select_actor ON public.audit_log FOR SELECT USING (actor_user_id = auth.uid());

-- ============================================================================
-- 0005_atomic_rpcs.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_transaction_bundle(
  p_transaction JSONB,
  p_lines JSONB,
  p_tag_ids UUID[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tx_id UUID;
  v_tx_type public.transaction_type;
  v_client_updated_at TIMESTAMPTZ;
  v_existing_client_updated_at TIMESTAMPTZ;
  v_deleted_at TIMESTAMPTZ;
  v_line JSONB;
  v_line_count INT;
  v_neg_count INT := 0;
  v_pos_count INT := 0;
  v_amt BIGINT;
  v_tag_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be authenticated';
  END IF;

  v_tx_id := (p_transaction->>'id')::UUID;
  v_tx_type := (p_transaction->>'type')::public.transaction_type;
  v_client_updated_at := COALESCE((p_transaction->>'client_updated_at')::TIMESTAMPTZ, NOW());
  v_deleted_at := (p_transaction->>'deleted_at')::TIMESTAMPTZ;

  SELECT client_updated_at INTO v_existing_client_updated_at
  FROM public.transactions
  WHERE id = v_tx_id;

  IF v_existing_client_updated_at IS NOT NULL AND v_existing_client_updated_at > v_client_updated_at THEN
    RETURN jsonb_build_object(
      'status', 'skipped_stale',
      'transaction_id', v_tx_id,
      'server_client_updated_at', v_existing_client_updated_at
    );
  END IF;

  v_line_count := jsonb_array_length(p_lines);
  IF v_deleted_at IS NULL THEN
    IF v_tx_type = 'transfer' AND v_line_count <> 2 THEN
      RAISE EXCEPTION 'INVALID_LEDGER_INVARIANT: transfer must have exactly 2 lines';
    ELSIF v_tx_type <> 'transfer' AND v_line_count <> 1 THEN
      RAISE EXCEPTION 'INVALID_LEDGER_INVARIANT: % must have exactly 1 line', v_tx_type;
    END IF;

    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      v_amt := (v_line->>'amount_minor')::BIGINT;
      IF v_amt < 0 THEN v_neg_count := v_neg_count + 1; END IF;
      IF v_amt > 0 THEN v_pos_count := v_pos_count + 1; END IF;
    END LOOP;

    IF v_tx_type IN ('expense', 'lend', 'debt_repay') AND v_neg_count <> 1 THEN
      RAISE EXCEPTION 'INVALID_LEDGER_INVARIANT: % line must be negative', v_tx_type;
    ELSIF v_tx_type IN ('income', 'borrow', 'debt_collect') AND v_pos_count <> 1 THEN
      RAISE EXCEPTION 'INVALID_LEDGER_INVARIANT: % line must be positive', v_tx_type;
    ELSIF v_tx_type = 'transfer' AND (v_neg_count <> 1 OR v_pos_count <> 1) THEN
      RAISE EXCEPTION 'INVALID_LEDGER_INVARIANT: transfer must have 1 negative line and 1 positive line';
    END IF;
  END IF;

  INSERT INTO public.transactions (
    id, type, occurred_at, category_id, note, source,
    group_id, recurring_rule_id, debt_id, created_by,
    client_updated_at, deleted_at
  )
  VALUES (
    v_tx_id,
    v_tx_type,
    COALESCE((p_transaction->>'occurred_at')::TIMESTAMPTZ, NOW()),
    NULLIF(p_transaction->>'category_id', '')::UUID,
    p_transaction->>'note',
    COALESCE((p_transaction->>'source')::public.transaction_source, 'quick_input'),
    NULLIF(p_transaction->>'group_id', '')::UUID,
    NULLIF(p_transaction->>'recurring_rule_id', '')::UUID,
    NULLIF(p_transaction->>'debt_id', '')::UUID,
    auth.uid(),
    v_client_updated_at,
    v_deleted_at
  )
  ON CONFLICT (id) DO UPDATE SET
    type = EXCLUDED.type,
    occurred_at = EXCLUDED.occurred_at,
    category_id = EXCLUDED.category_id,
    note = EXCLUDED.note,
    source = EXCLUDED.source,
    group_id = EXCLUDED.group_id,
    recurring_rule_id = EXCLUDED.recurring_rule_id,
    debt_id = EXCLUDED.debt_id,
    client_updated_at = EXCLUDED.client_updated_at,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = clock_timestamp();

  UPDATE public.transaction_lines
  SET deleted_at = COALESCE(v_deleted_at, clock_timestamp()),
      client_updated_at = v_client_updated_at,
      updated_at = clock_timestamp()
  WHERE transaction_id = v_tx_id
    AND id NOT IN (
      SELECT (elem->>'id')::UUID FROM jsonb_array_elements(p_lines) AS elem
    );

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO public.transaction_lines (
      id, transaction_id, account_id, pocket_id,
      amount_minor, currency, fx_rate_to_base, amount_base_minor,
      created_by, client_updated_at, deleted_at
    )
    VALUES (
      (v_line->>'id')::UUID,
      v_tx_id,
      (v_line->>'account_id')::UUID,
      (v_line->>'pocket_id')::UUID,
      (v_line->>'amount_minor')::BIGINT,
      COALESCE(v_line->>'currency', 'VND'),
      COALESCE((v_line->>'fx_rate_to_base')::NUMERIC, 1.0),
      (v_line->>'amount_base_minor')::BIGINT,
      auth.uid(),
      v_client_updated_at,
      COALESCE(v_deleted_at, (v_line->>'deleted_at')::TIMESTAMPTZ)
    )
    ON CONFLICT (id) DO UPDATE SET
      account_id = EXCLUDED.account_id,
      pocket_id = EXCLUDED.pocket_id,
      amount_minor = EXCLUDED.amount_minor,
      currency = EXCLUDED.currency,
      fx_rate_to_base = EXCLUDED.fx_rate_to_base,
      amount_base_minor = EXCLUDED.amount_base_minor,
      client_updated_at = EXCLUDED.client_updated_at,
      deleted_at = EXCLUDED.deleted_at,
      updated_at = clock_timestamp();
  END LOOP;

  DELETE FROM public.transaction_tags WHERE transaction_id = v_tx_id;
  IF p_tag_ids IS NOT NULL AND array_length(p_tag_ids, 1) > 0 THEN
    FOREACH v_tag_id IN ARRAY p_tag_ids
    LOOP
      INSERT INTO public.transaction_tags (transaction_id, tag_id)
      VALUES (v_tx_id, v_tag_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'status', 'synced',
    'transaction_id', v_tx_id,
    'server_updated_at', clock_timestamp()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_account_permanently()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  DELETE FROM public.transaction_tags WHERE transaction_id IN (SELECT id FROM public.transactions WHERE created_by = v_uid);
  DELETE FROM public.transaction_lines WHERE created_by = v_uid;
  DELETE FROM public.transactions WHERE created_by = v_uid;
  DELETE FROM public.recurring_rules WHERE owner_user_id = v_uid;
  DELETE FROM public.debts WHERE owner_user_id = v_uid;
  DELETE FROM public.credit_card_details WHERE account_id IN (SELECT id FROM public.accounts WHERE created_by = v_uid);
  DELETE FROM public.pockets WHERE created_by = v_uid;
  DELETE FROM public.account_members WHERE user_id = v_uid;
  DELETE FROM public.accounts WHERE created_by = v_uid;
  DELETE FROM public.tags WHERE owner_user_id = v_uid;
  DELETE FROM public.categories WHERE owner_user_id = v_uid;
  DELETE FROM public.onboarding_checklist WHERE user_id = v_uid;
  DELETE FROM public.activity_days WHERE user_id = v_uid;
  DELETE FROM public.push_subscriptions WHERE user_id = v_uid;
  DELETE FROM public.audit_log WHERE actor_user_id = v_uid;
  DELETE FROM public.profiles WHERE id = v_uid;

  RETURN TRUE;
END;
$$;

-- ============================================================================
-- seed.sql
-- ============================================================================

INSERT INTO public.categories (
  id, owner_user_id, kind, name, slug, icon, color, phase2_group_hint, default_keywords, is_system_special, sort_order
)
VALUES
  ('00000000-0000-4000-8000-000000000101', NULL, 'expense', 'Ăn uống (bữa chính)', 'food_main', 'circle', '#FF6B00', 'Thiết yếu', ARRAY['ăn sáng', 'ăn trưa', 'ăn tối', 'cơm', 'phở', 'bún', 'mì', 'bánh mì', 'xôi'], FALSE, 1),
  ('00000000-0000-4000-8000-000000000102', NULL, 'expense', 'Đi chợ/siêu thị', 'groceries', 'arch', '#00B853', 'Thiết yếu', ARRAY['đi chợ', 'siêu thị', 'bachhoaxanh', 'winmart', 'coopmart', 'rau', 'thịt', 'trái cây'], FALSE, 2),
  ('00000000-0000-4000-8000-000000000103', NULL, 'expense', 'Đi lại', 'transport', 'hexagon', '#0057FF', 'Thiết yếu', ARRAY['xăng', 'grab', 'be', 'xanh sm', 'gửi xe', 'vé xe', 'taxi', 'bus'], FALSE, 3),
  ('00000000-0000-4000-8000-000000000104', NULL, 'expense', 'Đồ dùng cá nhân', 'personal_care', 'triangle', '#FF7CE5', 'Thiết yếu', ARRAY['dầu gội', 'sữa tắm', 'kem đánh răng', 'cắt tóc', 'giặt ủi', 'mỹ phẩm'], FALSE, 4),
  ('00000000-0000-4000-8000-000000000201', NULL, 'expense', 'Tiền nhà', 'rent', 'square', '#0057FF', 'Hóa đơn cố định', ARRAY['tiền nhà', 'tiền phòng', 'tiền trọ'], FALSE, 5),
  ('00000000-0000-4000-8000-000000000202', NULL, 'expense', 'Điện nước', 'utilities', 'triangle', '#FFC700', 'Hóa đơn cố định', ARRAY['tiền điện', 'tiền nước', 'điện nước', 'phí quản lý'], FALSE, 6),
  ('00000000-0000-4000-8000-000000000203', NULL, 'expense', 'Internet/điện thoại', 'telecom', 'hexagon', '#0057FF', 'Hóa đơn cố định', ARRAY['wifi', 'internet', 'cước điện thoại', 'nạp đt', 'nạp điện thoại', '4g', '5g', 'viettel', 'mobifone', 'vinaphone'], FALSE, 7),
  ('00000000-0000-4000-8000-000000000204', NULL, 'expense', 'Subscription', 'subscription', 'square', '#FF7CE5', 'Hóa đơn cố định', ARRAY['netflix', 'spotify', 'youtube', 'icloud', 'chatgpt', 'claude', 'canva'], FALSE, 8),
  ('00000000-0000-4000-8000-000000000301', NULL, 'expense', 'Gửi bố mẹ', 'family_support', 'arch', '#FF7CE5', 'Gửi về nhà', ARRAY['gửi bố mẹ', 'gửi mẹ', 'gửi ba', 'biếu bố mẹ', 'gửi về nhà'], FALSE, 9),
  ('00000000-0000-4000-8000-000000000401', NULL, 'expense', 'Đám cưới', 'wedding', 'triangle', '#FF6B00', 'Hiếu hỉ', ARRAY['đám cưới', 'mừng cưới', 'phong bì cưới', 'tiền cưới'], FALSE, 10),
  ('00000000-0000-4000-8000-000000000402', NULL, 'expense', 'Sinh nhật', 'birthday', 'circle', '#FF7CE5', 'Hiếu hỉ', ARRAY['sinh nhật', 'quà sinh nhật'], FALSE, 11),
  ('00000000-0000-4000-8000-000000000403', NULL, 'expense', 'Thăm hỏi', 'visiting', 'arch', '#FFC700', 'Hiếu hỉ', ARRAY['thăm bệnh', 'thăm hỏi', 'đám giỗ', 'phúng điếu'], FALSE, 12),
  ('00000000-0000-4000-8000-000000000404', NULL, 'expense', 'Quà tặng', 'gifts', 'square', '#FF6B00', 'Hiếu hỉ', ARRAY['quà', 'tặng quà', 'lì xì'], FALSE, 13),
  ('00000000-0000-4000-8000-000000000501', NULL, 'expense', 'Cafe/trà sữa', 'coffee_tea', 'circle', '#FF6B00', 'Vui chơi', ARRAY['cafe', 'cà phê', 'cf', 'trà sữa', 'highlands', 'phúc long', 'starbucks', 'katinat', 'phela'], FALSE, 14),
  ('00000000-0000-4000-8000-000000000502', NULL, 'expense', 'Ăn ngoài/nhậu', 'dining_out', 'square', '#FFC700', 'Vui chơi', ARRAY['ăn ngoài', 'nhậu', 'bia', 'lẩu', 'nướng', 'bbq', 'buffet', 'ốc'], FALSE, 15),
  ('00000000-0000-4000-8000-000000000503', NULL, 'expense', 'Đặt đồ ăn', 'food_delivery', 'triangle', '#FF6B00', 'Vui chơi', ARRAY['grabfood', 'shopeefood', 'befood', 'đặt đồ ăn', 'ăn vặt'], FALSE, 16),
  ('00000000-0000-4000-8000-000000000504', NULL, 'expense', 'Giải trí', 'entertainment', 'hexagon', '#FF7CE5', 'Vui chơi', ARRAY['xem phim', 'cgv', 'lotte cinema', 'game', 'karaoke', 'concert', 'bida'], FALSE, 17),
  ('00000000-0000-4000-8000-000000000505', NULL, 'expense', 'Mua sắm', 'shopping', 'triangle', '#FF7CE5', 'Vui chơi', ARRAY['shopee', 'lazada', 'tiktok shop', 'quần áo', 'giày', 'áo', 'quần', 'mua sắm'], FALSE, 18),
  ('00000000-0000-4000-8000-000000000506', NULL, 'expense', 'Du lịch', 'travel', 'circle', '#0057FF', 'Vui chơi', ARRAY['du lịch', 'vé máy bay', 'khách sạn', 'homestay', 'resort'], FALSE, 19),
  ('00000000-0000-4000-8000-000000000601', NULL, 'expense', 'Khám bệnh/thuốc', 'healthcare', 'arch', '#00B853', 'Sức khỏe & phát triển', ARRAY['thuốc', 'khám bệnh', 'nha khoa', 'bệnh viện', 'pharmacity', 'long châu'], FALSE, 20),
  ('00000000-0000-4000-8000-000000000602', NULL, 'expense', 'Gym/thể thao', 'fitness', 'hexagon', '#00B853', 'Sức khỏe & phát triển', ARRAY['gym', 'cầu lông', 'bơi', 'chạy bộ', 'yoga', 'pickleball', 'đá bóng'], FALSE, 21),
  ('00000000-0000-4000-8000-000000000603', NULL, 'expense', 'Học tập', 'education', 'square', '#0057FF', 'Sức khỏe & phát triển', ARRAY['sách', 'khóa học', 'học tiếng anh', 'ielts', 'coursera', 'udemy'], FALSE, 22),
  ('00000000-0000-4000-8000-000000000701', NULL, 'expense', 'Phí', 'fee', 'square', '#141413', 'Đặc biệt', ARRAY['phí chuyển khoản', 'phí thường niên', 'phí rút tiền', 'phí'], TRUE, 23),
  ('00000000-0000-4000-8000-000000000702', NULL, 'expense', 'Không nhớ rõ', 'unknown_expense', 'circle', '#141413', 'Đặc biệt', ARRAY['không nhớ', 'quên', 'không rõ'], TRUE, 24),
  ('00000000-0000-4000-8000-000000000801', NULL, 'income', 'Lương', 'salary', 'arch', '#00B853', 'Thu nhập', ARRAY['lương', 'nhận lương'], FALSE, 1),
  ('00000000-0000-4000-8000-000000000802', NULL, 'income', 'Thưởng', 'bonus', 'circle', '#FFC700', 'Thu nhập', ARRAY['thưởng', 'nhận thưởng', 'kpi', 'thưởng tết'], FALSE, 2),
  ('00000000-0000-4000-8000-000000000803', NULL, 'income', 'Freelance/làm thêm', 'freelance', 'hexagon', '#0057FF', 'Thu nhập', ARRAY['freelance', 'job ngoài', 'làm thêm', 'OT'], FALSE, 3),
  ('00000000-0000-4000-8000-000000000804', NULL, 'income', 'Được cho/tặng', 'gifted_income', 'triangle', '#FF7CE5', 'Thu nhập', ARRAY['được tặng', 'được cho', 'mẹ cho', 'bố cho'], FALSE, 4),
  ('00000000-0000-4000-8000-000000000805', NULL, 'income', 'Hoàn tiền/cashback', 'cashback', 'circle', '#00B853', 'Thu nhập', ARRAY['hoàn tiền', 'cashback'], FALSE, 5),
  ('00000000-0000-4000-8000-000000000806', NULL, 'income', 'Khác', 'other_income', 'square', '#0057FF', 'Thu nhập', ARRAY['thu khác'], FALSE, 6),
  ('00000000-0000-4000-8000-000000000807', NULL, 'income', 'Thu nhập không rõ', 'unknown_income', 'arch', '#141413', 'Đặc biệt', ARRAY[]::TEXT[], TRUE, 7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.exchange_rates (rate_date, base_currency, quote_currency, rate, source)
VALUES
  (CURRENT_DATE, 'USD', 'VND', 25400.000000, 'api'),
  (CURRENT_DATE, 'EUR', 'VND', 27500.000000, 'api'),
  (CURRENT_DATE, 'JPY', 'VND', 168.000000, 'api'),
  (CURRENT_DATE, 'KRW', 'VND', 18.500000, 'api'),
  (CURRENT_DATE, 'SGD', 'VND', 19000.000000, 'api'),
  (CURRENT_DATE, 'THB', 'VND', 745.000000, 'api')
ON CONFLICT (rate_date, base_currency, quote_currency) DO NOTHING;

