import type { Account, Pocket } from '../types/entities';

export interface CreditCardStatementCycle {
  currentDebtMinor: number;
  creditLimitMinor: number | null;
  remainingLimitMinor: number | null;
  utilizationRatio: number | null;
  nextStatementDateIso: string | null;
  nextDueDateIso: string | null;
}

/**
 * Section 5.8: End-of-Month Clamp for days 29, 30, 31.
 * For example, day 31 in February 2026 (28 days) clamps to 28; in April (30 days) clamps to 30.
 */
export function clampDayOfMonth(year: number, monthOneBased: number, targetDay: number): number {
  const lastDay = new Date(Date.UTC(year, monthOneBased, 0)).getUTCDate();
  return Math.max(1, Math.min(targetDay, lastDay));
}

export function formatIsoDateUtc(year: number, monthOneBased: number, day: number): string {
  const clamped = clampDayOfMonth(year, monthOneBased, day);
  const mm = String(monthOneBased).padStart(2, '0');
  const dd = String(clamped).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Computes the next occurrence of a monthly day (1..31) on or after `referenceDateIso` (YYYY-MM-DD).
 */
export function computeNextMonthlyDateIso(targetDay: number, referenceDateIso: string): string {
  const parts = referenceDateIso.slice(0, 10).split('-').map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;

  const clampedThisMonth = clampDayOfMonth(year, month, targetDay);
  if (clampedThisMonth >= day) {
    return formatIsoDateUtc(year, month, targetDay);
  }

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return formatIsoDateUtc(nextYear, nextMonth, targetDay);
}

/**
 * Section 5.3: Credit Card Debt, Remaining Limit & Next Statement/Due Dates.
 * - Credit card pocket has negative balance when carrying debt (`cached_balance_minor < 0`).
 * - `currentDebtMinor` is positive when `cached_balance_minor < 0`.
 */
export function computeCreditCardSummary(
  account: Pick<Account, 'credit_limit_minor' | 'statement_day' | 'payment_due_day'> & {
    due_day?: number | null;
  },
  cardPocket: Pick<Pocket, 'cached_balance_minor'>,
  referenceDateIso: string = new Date().toISOString().slice(0, 10),
): CreditCardStatementCycle {
  const currentDebtMinor =
    cardPocket.cached_balance_minor < 0 ? Math.abs(cardPocket.cached_balance_minor) : 0;
  const creditLimitMinor = account.credit_limit_minor ?? null;

  const remainingLimitMinor =
    creditLimitMinor !== null ? Math.max(0, creditLimitMinor - currentDebtMinor) : null;

  const utilizationRatio =
    creditLimitMinor !== null && creditLimitMinor > 0
      ? Number((currentDebtMinor / creditLimitMinor).toFixed(4))
      : null;

  const nextStatementDateIso =
    account.statement_day !== null && account.statement_day !== undefined
      ? computeNextMonthlyDateIso(account.statement_day, referenceDateIso)
      : null;

  const dueDay = account.payment_due_day ?? account.due_day ?? null;
  const nextDueDateIso =
    dueDay !== null && dueDay !== undefined
      ? computeNextMonthlyDateIso(dueDay, referenceDateIso)
      : null;

  return {
    currentDebtMinor,
    creditLimitMinor,
    remainingLimitMinor,
    utilizationRatio,
    nextStatementDateIso,
    nextDueDateIso,
  };
}
