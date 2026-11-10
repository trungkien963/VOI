import type { CurrencyCode } from '../money/currency';
import type { RecurringRule, SupportedLocale } from '../types/entities';
import { clampDayOfMonth, formatIsoDateUtc } from './credit-card-calculator';
import { buildTransactionBundle, type TransactionBundle } from './strategies';

/**
 * Advances a date string (`YYYY-MM-DD`) by the rule's frequency & interval,
 * applying Section 5.8 End-of-Month Clamping for `monthly` and `yearly` rules.
 */
export function computeNextRunDateAfter(
  currentRunDateIso: string,
  rule: Pick<RecurringRule, 'frequency' | 'interval_count' | 'day_of_month'>,
): string {
  const interval = Math.max(1, rule.interval_count || 1);
  const parts = currentRunDateIso.slice(0, 10).split('-').map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;

  if (rule.frequency === 'daily') {
    const dt = new Date(Date.UTC(year, month - 1, day + interval));
    return dt.toISOString().slice(0, 10);
  }

  if (rule.frequency === 'weekly') {
    const dt = new Date(Date.UTC(year, month - 1, day + interval * 7));
    return dt.toISOString().slice(0, 10);
  }

  if (rule.frequency === 'yearly') {
    const targetYear = year + interval;
    const anchorDay = rule.day_of_month ?? day;
    return formatIsoDateUtc(targetYear, month, anchorDay);
  }

  // Default: 'monthly' with Section 5.8 End-of-Month Clamp (29, 30, 31 -> lastDayOfMonth)
  const zeroBasedMonth = month - 1 + interval;
  const targetYear = year + Math.floor(zeroBasedMonth / 12);
  const targetMonthOneBased = (zeroBasedMonth % 12) + 1;
  const anchorDay = rule.day_of_month ?? day;
  const clampedDay = clampDayOfMonth(targetYear, targetMonthOneBased, anchorDay);
  return formatIsoDateUtc(targetYear, targetMonthOneBased, clampedDay);
}

/**
 * Section 8.8: Checks if a recurring rule is currently due and waiting for user confirmation.
 */
export function isRecurringRuleDue(
  rule: Pick<RecurringRule, 'is_active' | 'next_run_date' | 'skipped_dates'>,
  todayIso: string = new Date().toISOString().slice(0, 10),
): boolean {
  if (!rule.is_active) return false;
  const skipped = rule.skipped_dates ?? [];
  if (skipped.includes(rule.next_run_date)) return false;
  return rule.next_run_date <= todayIso;
}

/**
 * Formats installment progress badge (e.g., "Kỳ 3/12" or "Term 3/12") when `total_occurrences` is set.
 */
export function formatInstallmentProgress(
  rule: Pick<RecurringRule, 'total_occurrences' | 'occurrences_done'>,
  locale: SupportedLocale = 'en',
): string | null {
  const total = rule.total_occurrences ?? null;
  if (total === null || total <= 0) return null;
  const nextTerm = Math.min(total, (rule.occurrences_done ?? 0) + 1);
  return locale === 'vi' ? `Kỳ ${nextTerm}/${total}` : `Term ${nextTerm}/${total}`;
}

export interface ConfirmRecurringResult {
  updatedRule: RecurringRule;
  transactionBundle: TransactionBundle;
}

/**
 * Section 8.8: Confirms a due recurring rule, generating the real ledger `TransactionBundle`
 * and advancing `occurrences_done` + `next_run_date`.
 */
export function confirmRecurringRuleOccurrence(params: {
  rule: RecurringRule;
  transactionId: string;
  actualAmountMinor?: number;
  currency?: CurrencyCode;
  occurredAt?: string;
}): ConfirmRecurringResult {
  const { rule, transactionId } = params;
  const finalAmountMinor =
    params.actualAmountMinor !== undefined
      ? Math.abs(Math.trunc(params.actualAmountMinor))
      : Math.abs(rule.amount_minor);

  const occurredAtIso = params.occurredAt ?? `${rule.next_run_date}T09:00:00.000Z`;
  const nextOccurrencesDone = (rule.occurrences_done ?? 0) + 1;
  const totalOccurrences = rule.total_occurrences ?? null;
  const isCompletedInstallment =
    totalOccurrences !== null && totalOccurrences > 0 && nextOccurrencesDone >= totalOccurrences;

  const nextRunDate = computeNextRunDateAfter(rule.next_run_date, rule);

  const updatedRule: RecurringRule = {
    ...rule,
    occurrences_done: nextOccurrencesDone,
    last_run_date: rule.next_run_date,
    next_run_date: nextRunDate,
    is_active: isCompletedInstallment ? false : rule.is_active,
    updated_at: new Date().toISOString(),
  };

  const transactionBundle = buildTransactionBundle({
    transactionId,
    userId: rule.user_id,
    type: rule.template_type,
    amountMinor: finalAmountMinor,
    currency: params.currency ?? 'VND',
    sourceAccountId: rule.account_id,
    sourcePocketId: rule.pocket_id,
    destinationAccountId: rule.to_account_id ?? undefined,
    categoryId: rule.category_id,
    counterpartyId: rule.counterparty_id,
    recurringRuleId: rule.id,
    source: 'recurring',
    note: rule.note ?? rule.title,
    occurredAt: occurredAtIso,
  });

  return {
    updatedRule,
    transactionBundle,
  };
}

/**
 * Section 8.8: Skips the current cycle of a due recurring rule (`skipped_dates`),
 * advancing `next_run_date` without creating any ledger transaction.
 */
export function skipRecurringRuleOccurrence(rule: RecurringRule): RecurringRule {
  const skipped = Array.from(new Set([...(rule.skipped_dates ?? []), rule.next_run_date]));
  const nextRunDate = computeNextRunDateAfter(rule.next_run_date, rule);

  return {
    ...rule,
    skipped_dates: skipped,
    next_run_date: nextRunDate,
    updated_at: new Date().toISOString(),
  };
}
