import { formatMoney } from '../money/currency';
import type { DebtItem, DebtStatus, SupportedLocale, Transaction } from '../types/entities';

export interface ComputedDebtSummary {
  principalMinor: number;
  paidMinor: number;
  remainingMinor: number;
  status: DebtStatus;
}

/**
 * Section 5.6: Formula for `remaining_minor` and `principal_minor` of a `DebtItem`.
 * - If `origin === 'opening_balance'`:
 *     Principal = debt.principal_minor
 *     Remaining = max(0, Principal - sum(|debt_collect or debt_repay|))
 * - If `origin IN ('lend', 'borrow', 'paid_for_others')`:
 *     Principal = sum(|debt_lend or debt_borrow|) (or fallback to debt.principal_minor)
 *     Remaining = max(0, Principal - sum(|debt_collect or debt_repay|))
 * - When Remaining <= 0, status automatically transitions to `'settled'`.
 */
export function computeDebtSummaryFromTransactions(
  debt: Pick<DebtItem, 'id' | 'origin' | 'principal_minor' | 'status'>,
  linkedTransactions: ReadonlyArray<
    Pick<Transaction, 'debt_id' | 'type' | 'amount_minor' | 'voided_at'>
  >,
): ComputedDebtSummary {
  if (debt.status === 'cancelled') {
    return {
      principalMinor: debt.principal_minor,
      paidMinor: 0,
      remainingMinor: 0,
      status: 'cancelled',
    };
  }

  const activeTxs = linkedTransactions.filter(
    (tx) => tx.debt_id === debt.id && tx.voided_at === null,
  );

  let lentOrBorrowedSum = 0;
  let repaidOrCollectedSum = 0;

  for (const tx of activeTxs) {
    if (tx.type === 'debt_lend' || tx.type === 'debt_borrow') {
      lentOrBorrowedSum += Math.abs(tx.amount_minor);
    } else if (tx.type === 'debt_collect' || tx.type === 'debt_repay') {
      repaidOrCollectedSum += Math.abs(tx.amount_minor);
    }
  }

  const origin = debt.origin ?? 'lend';
  const principalMinor =
    origin === 'opening_balance'
      ? Math.abs(debt.principal_minor)
      : lentOrBorrowedSum > 0
        ? lentOrBorrowedSum
        : Math.abs(debt.principal_minor);

  const remainingMinor = Math.max(0, principalMinor - repaidOrCollectedSum);
  const status: DebtStatus = remainingMinor <= 0 ? 'settled' : 'open';

  return {
    principalMinor,
    paidMinor: repaidOrCollectedSum,
    remainingMinor,
    status,
  };
}

/**
 * Section 8.7: Generates a cheerful, polite reminder message ("Nhắc khéo") for copying/sharing.
 */
export function buildPoliteDebtReminderText(params: {
  counterpartyName: string;
  remainingMinor: number;
  currency?: string;
  note?: string | null;
  locale?: SupportedLocale;
}): string {
  const formattedAmount = formatMoney(params.remainingMinor, params.currency ?? 'VND');
  const noteSuffix = params.note ? ` (${params.note})` : '';

  if (params.locale === 'vi') {
    return `Chào ${params.counterpartyName} ơi ✨ Nhắc nhẹ khoản ${formattedAmount}${noteSuffix} hôm trước nhé, khi nào tiện chuyển giúp mình nha. Cảm ơn nhiều nè! ☕`;
  }

  return `Hey ${params.counterpartyName} ✨ Just a friendly reminder about the ${formattedAmount}${noteSuffix} from earlier — feel free to send it over whenever convenient. Thanks a bunch! ☕`;
}
