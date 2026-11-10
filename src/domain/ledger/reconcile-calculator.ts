import { SYSTEM_CATEGORY_IDS } from '../categories/default-categories';
import type { CurrencyCode } from '../money/currency';
import { buildTransactionBundle, type TransactionBundle } from './strategies';

export type ReconcileOutcomeKind = 'matched' | 'deficit' | 'surplus';

export interface ReconcileInput {
  transactionId: string;
  userId: string;
  accountId: string;
  pocketId: string;
  currency?: CurrencyCode;
  fxRateToBase?: number;
  appBalanceMinor: number;
  actualBalanceMinor: number;
  occurredAt?: string;
}

export interface ReconcileResult {
  kind: ReconcileOutcomeKind;
  deltaMinor: number;
  categoryId: string | null;
  bundle: TransactionBundle | null;
}

/**
 * Section 5.4: Balance Reconcile (Đối soát số dư).
 * Delta = Actual Balance - App Balance.
 * - Delta < 0: creates negative `adjustment` linked to `unknown-expense` ("Không nhớ rõ").
 * - Delta > 0: creates positive `adjustment` linked to `unknown-income` ("Thu nhập không rõ").
 * - Delta === 0: creates no transaction (`bundle: null`).
 */
export function computeReconcileAdjustment(input: ReconcileInput): ReconcileResult {
  const deltaMinor = Math.trunc(input.actualBalanceMinor) - Math.trunc(input.appBalanceMinor);

  if (deltaMinor === 0) {
    return {
      kind: 'matched',
      deltaMinor: 0,
      categoryId: null,
      bundle: null,
    };
  }

  const isDeficit = deltaMinor < 0;
  const categoryId = isDeficit
    ? SYSTEM_CATEGORY_IDS.unknownExpense
    : SYSTEM_CATEGORY_IDS.unknownIncome;

  const bundle = buildTransactionBundle({
    transactionId: input.transactionId,
    userId: input.userId,
    type: 'adjustment',
    amountMinor: deltaMinor,
    currency: input.currency ?? 'VND',
    fxRateToBase: input.fxRateToBase,
    sourceAccountId: input.accountId,
    sourcePocketId: input.pocketId,
    categoryId,
    occurredAt: input.occurredAt,
    source: 'reconcile',
    note: isDeficit ? 'Reconcile deficit' : 'Reconcile surplus',
  });

  return {
    kind: isDeficit ? 'deficit' : 'surplus',
    deltaMinor,
    categoryId,
    bundle,
  };
}
