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

