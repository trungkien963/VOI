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

