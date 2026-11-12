export type AccountType = 'cash' | 'bank' | 'e_wallet' | 'savings' | 'credit_card';

export type PocketType = 'spendable' | 'goal' | 'buffer';

export type TransactionType =
  | 'expense'
  | 'income'
  | 'transfer'
  | 'opening_balance'
  | 'credit_card_spend'
  | 'credit_card_payment'
  | 'credit_card_refund'
  | 'debt_borrow'
  | 'debt_lend'
  | 'debt_repay'
  | 'debt_collect'
  | 'adjustment';

export type TransactionSource =
  'quick_add' | 'manual' | 'recurring' | 'reconcile' | 'onboarding' | 'csv_import' | 'system';

export type TransactionStatus = 'posted' | 'pending' | 'void';

export type StatementStatus = 'open' | 'closed' | 'paid' | 'overdue';

export type DebtDirection = 'i_owe' | 'they_owe';

export type DebtStatus = 'open' | 'settled' | 'cancelled';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type CategoryKind = 'expense' | 'income' | 'system';

export type ColorMode = 'system' | 'light' | 'dark';

export type SupportedLocale = 'en' | 'vi';

export type ThemeId = 'pop' | 'cobalt' | 'matcha' | 'flamingo' | 'sunny' | 'rose';

export type GeometricShape =
  | 'triangle' // Cost / Chi tiêu (#FF6B35)
  | 'square' // Earn / Thu nhập (#10B981)
  | 'circle' // Borrow & Lend / Sổ nợ (#8B5CF6)
  | 'diamond' // Transfer / Chuyển khoản (#0D9488)
  | 'arch' // Savings & Goals / Tiết kiệm (#FFB703)
  | 'hexagon' // Bank & Recurring Bills (#3B82F6)
  | 'pentagon' // Credit Card & Installments (#F472B6)
  | 'rainbow'; // Rewards, Gifts & Cashback (#FB7185)

export type BuddyAccessory =
  | 'none'
  | 'curly-hair'
  | 'spiky-hair'
  | 'cheering'
  | 'glasses'
  | 'cap'
  | 'headphones'
  | 'pencil'
  | 'bag-handle';

export type BuddyMood = 'happy' | 'chill' | 'wink' | 'excited' | 'calm' | 'worried' | 'surprised';

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

export type OutboxOperation = 'upsert_tx_bundle' | 'void_tx' | 'upsert' | 'delete';

export interface Profile {
  user_id: string;
  display_name: string | null;
  base_currency: string;
  locale: string;
  timezone: string;
  week_starts_on: number;
  month_Anchor_day: number;
  hide_balances_by_default: boolean;
  theme_id: ThemeId;
  color_mode: ColorMode;
  onboarding_step: string;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingChecklistState {
  user_id: string;
  created_main_account: boolean;
  added_second_account_or_NA: boolean;
  added_credit_card_or_NA: boolean;
  logged_first_3_expenses: boolean;
  added_income_or_recurring_or_NA: boolean;
  created_first_budget_or_goal: boolean;
  tried_3_second_quick_add: boolean;
  dismissed_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  institution_name: string | null;
  color_hex: string;
  icon_name: GeometricShape;
  include_in_net_worth: boolean;
  is_default_spend: boolean;
  cached_balance_minor: number;
  credit_limit_minor: number | null;
  statement_day: number | null;
  payment_due_day: number | null;
  grace_period_days: number | null;
  apr_bps: number | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pocket {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  currency?: string;
  type: PocketType;
  target_amount_minor: number | null;
  target_date: string | null;
  cached_balance_minor: number;
  color_hex: string;
  icon_name: GeometricShape;
  is_default: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  parent_id: string | null;
  name: string;
  slug: string;
  kind: CategoryKind;
  icon_name: GeometricShape;
  color_hex: string;
  keywords: string[];
  is_essential: boolean;
  is_system: boolean;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color_hex: string;
  created_at: string;
}

export interface Counterparty {
  id: string;
  user_id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  note: string | null;
  avatar_color_hex: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  client_id: string;
  type: TransactionType;
  status: TransactionStatus;
  source: TransactionSource;
  occurred_at: string;
  txn_date: string;
  amount_minor: number;
  currency: string;
  category_id: string | null;
  counterparty_id: string | null;
  group_id?: string | null;
  debt_id?: string | null;
  merchant_name: string | null;
  note: string | null;
  raw_input_text: string | null;
  is_reimbursable: boolean;
  linked_transaction_id: string | null;
  recurring_rule_id: string | null;
  created_at: string;
  updated_at: string;
  voided_at: string | null;
}

export interface TransactionLine {
  id: string;
  user_id: string;
  transaction_id: string;
  account_id: string;
  pocket_id: string | null;
  signed_amount_minor: number;
  currency?: string;
  fx_rate_to_base?: number;
  amount_base_minor?: number;
  is_fee: boolean;
  line_note: string | null;
  created_at: string;
  deleted_at?: string | null;
}

export interface TransactionTag {
  transaction_id: string;
  tag_id: string;
  user_id: string;
}

export interface CreditCardStatement {
  id: string;
  user_id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  statement_date: string;
  due_date: string;
  status: StatementStatus;
  opening_balance_minor: number;
  new_charges_minor: number;
  refunds_and_credits_minor: number;
  fees_and_interest_minor: number;
  statement_balance_minor: number;
  minimum_due_minor: number;
  paid_amount_minor: number;
  closed_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DebtOrigin = 'opening_balance' | 'lend' | 'borrow' | 'paid_for_others';

export interface DebtItem {
  id: string;
  user_id: string;
  counterparty_id: string;
  counterparty_name?: string;
  direction: DebtDirection;
  origin?: DebtOrigin;
  status: DebtStatus;
  title: string;
  principal_minor: number;
  remaining_minor: number;
  currency: string;
  opened_date: string;
  due_date: string | null;
  origin_transaction_id: string | null;
  note: string | null;
  settled_at: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtSettlement {
  id: string;
  user_id: string;
  debt_item_id: string;
  transaction_id: string;
  amount_minor: number;
  settled_date: string;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  month_key: string;
  category_id: string | null;
  limit_minor: number;
  rollover_enabled: boolean;
  rollover_minor: number;
  alert_threshold_pct: number;
  created_at: string;
  updated_at: string;
}

export interface RecurringRule {
  id: string;
  user_id: string;
  title: string;
  template_type: TransactionType;
  frequency: RecurrenceFrequency;
  interval_count: number;
  day_of_month: number | null;
  day_of_week: number | null;
  next_run_date: string;
  last_run_date: string | null;
  auto_post: boolean;
  remind_days_before: number;
  amount_minor: number;
  account_id: string;
  to_account_id: string | null;
  pocket_id: string | null;
  category_id: string | null;
  counterparty_id: string | null;
  note: string | null;
  total_occurrences?: number | null;
  occurrences_done?: number;
  skipped_dates?: string[];
  require_confirmation?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MerchantAlias {
  id: string;
  user_id: string;
  pattern_normalized: string;
  category_id: string | null;
  default_account_id: string | null;
  hit_count: number;
  last_used_at: string;
}

export interface AuditEvent {
  id: string;
  user_id: string;
  entity_table: string;
  entity_id: string;
  action: 'insert' | 'update' | 'void' | 'delete';
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  client_timestamp: string | null;
  created_at: string;
}

export interface SyncOutboxItem {
  seq?: number;
  client_mutation_id: string;
  entity_table: string;
  operation: OutboxOperation;
  entity_id: string;
  payload: Record<string, unknown>;
  created_at: number;
  retry_count: number;
  status?: 'pending' | 'dead_letter';
  last_error?: string | null;
}

export interface SyncCursor {
  table_name: string;
  last_synced_updated_at: string;
}
