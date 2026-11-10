import type { CurrencyCode } from '../money/currency';
import type { DebtItem, Transaction } from '../types/entities';
import { buildTransactionBundle, type TransactionBundle } from './strategies';

export interface PaidForOthersShare {
  debtId: string;
  transactionId: string;
  counterpartyId: string;
  counterpartyName: string;
  amountMinor: number;
  dueDate?: string | null;
}

export interface BuildPaidForOthersInput {
  groupId: string;
  expenseTransactionId: string;
  userId: string;
  sourceAccountId: string;
  sourcePocketId: string;
  currency?: CurrencyCode;
  fxRateToBase?: number;
  totalPaidMinor: number;
  ownExpenseMinor: number;
  categoryId: string | null;
  note: string | null;
  occurredAt?: string;
  shares: ReadonlyArray<PaidForOthersShare>;
}

export interface PaidForOthersBundleResult {
  groupId: string;
  totalPaidMinor: number;
  ownExpenseMinor: number;
  totalLentMinor: number;
  transactionBundles: TransactionBundle[];
  debtItems: DebtItem[];
}

/**
 * Section 5.5: "Trả hộ" (Paid for Others) when logging an expense.
 * Example: 4 people dine out, user pays 800k, user's own share is 200k, others owe 600k.
 * - Generates a shared `group_id` for the entire cluster.
 * - Creates 1 `expense` transaction for `ownExpenseMinor` (200k, counted in expense report).
 * - Creates 1 or more `debt_lend` transactions totaling 600k (NOT counted in expense report) + `DebtItem` records (`origin: 'paid_for_others'`).
 * - Total pocket deduction = 200k + 600k = 800k.
 */
export function buildPaidForOthersBundles(
  input: BuildPaidForOthersInput,
): PaidForOthersBundleResult {
  const nowIso = input.occurredAt ?? new Date().toISOString();
  const dateOnly = nowIso.slice(0, 10);
  const currency = input.currency ?? 'VND';

  const totalLentMinor = input.shares.reduce((sum, s) => sum + Math.abs(s.amountMinor), 0);
  if (Math.abs(input.ownExpenseMinor) + totalLentMinor !== Math.abs(input.totalPaidMinor)) {
    throw new Error('PaidForOthers: ownExpenseMinor + sum(shares) must equal totalPaidMinor');
  }

  const transactionBundles: TransactionBundle[] = [];
  const debtItems: DebtItem[] = [];

  if (input.ownExpenseMinor > 0) {
    const ownExpenseBundle = buildTransactionBundle({
      transactionId: input.expenseTransactionId,
      userId: input.userId,
      type: 'expense',
      amountMinor: input.ownExpenseMinor,
      currency,
      fxRateToBase: input.fxRateToBase,
      sourceAccountId: input.sourceAccountId,
      sourcePocketId: input.sourcePocketId,
      categoryId: input.categoryId,
      groupId: input.groupId,
      note: input.note,
      occurredAt: nowIso,
    });
    transactionBundles.push(ownExpenseBundle);
  }

  for (const share of input.shares) {
    const shareMinor = Math.abs(share.amountMinor);
    if (shareMinor <= 0) continue;

    const debtItem: DebtItem = {
      id: share.debtId,
      user_id: input.userId,
      counterparty_id: share.counterpartyId,
      counterparty_name: share.counterpartyName,
      direction: 'they_owe',
      origin: 'paid_for_others',
      status: 'open',
      title: input.note
        ? `${input.note} (${share.counterpartyName})`
        : `Paid for ${share.counterpartyName}`,
      principal_minor: shareMinor,
      remaining_minor: shareMinor,
      currency,
      opened_date: dateOnly,
      due_date: share.dueDate ?? null,
      origin_transaction_id: share.transactionId,
      note: input.note,
      settled_at: null,
      deleted_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    debtItems.push(debtItem);

    const lendBundle = buildTransactionBundle({
      transactionId: share.transactionId,
      userId: input.userId,
      type: 'debt_lend',
      amountMinor: shareMinor,
      currency,
      fxRateToBase: input.fxRateToBase,
      sourceAccountId: input.sourceAccountId,
      sourcePocketId: input.sourcePocketId,
      counterpartyId: share.counterpartyId,
      groupId: input.groupId,
      debtId: share.debtId,
      note: input.note
        ? `${input.note} · Trả hộ ${share.counterpartyName}`
        : `Trả hộ ${share.counterpartyName}`,
      occurredAt: nowIso,
    });
    transactionBundles.push(lendBundle);
  }

  return {
    groupId: input.groupId,
    totalPaidMinor: Math.abs(input.ownExpenseMinor) + totalLentMinor,
    ownExpenseMinor: Math.abs(input.ownExpenseMinor),
    totalLentMinor,
    transactionBundles,
    debtItems,
  };
}

export interface GroupClusterSummary {
  groupId: string;
  totalPaidMinor: number;
  ownExpenseMinor: number;
  lentMinor: number;
  feeMinor: number;
}

/**
 * Summarizes a transaction group (`group_id`) for display on the Ledger list (Section 5.5).
 */
export function summarizeTransactionGroup(
  groupId: string,
  transactions: ReadonlyArray<
    Pick<Transaction, 'group_id' | 'type' | 'amount_minor' | 'voided_at'>
  >,
): GroupClusterSummary {
  const active = transactions.filter((t) => t.group_id === groupId && t.voided_at === null);
  let ownExpenseMinor = 0;
  let lentMinor = 0;
  const feeMinor = 0;

  for (const tx of active) {
    if (tx.type === 'expense') {
      ownExpenseMinor += Math.abs(tx.amount_minor);
    } else if (tx.type === 'debt_lend') {
      lentMinor += Math.abs(tx.amount_minor);
    }
  }

  return {
    groupId,
    totalPaidMinor: ownExpenseMinor + lentMinor + feeMinor,
    ownExpenseMinor,
    lentMinor,
    feeMinor,
  };
}
