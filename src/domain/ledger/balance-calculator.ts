import { convertMinorToBase, getDefaultFxRateToBase } from '../money/currency';
import type {
  DebtItem,
  Pocket,
  Transaction,
  TransactionLine,
  TransactionType,
} from '../types/entities';

/**
 * Section 5.1 Table: Determines whether a transaction type counts toward the Income/Expense report.
 * Only `expense`, `credit_card_spend`, `income`, `credit_card_refund`, and `adjustment` are included.
 * `transfer`, `opening_balance`, `debt_lend`, `debt_borrow`, `debt_collect`, `debt_repay`, `credit_card_payment` are EXCLUDED.
 */
export function isReportableInIncomeExpense(type: TransactionType): boolean {
  switch (type) {
    case 'expense':
    case 'credit_card_spend':
    case 'income':
    case 'credit_card_refund':
    case 'adjustment':
      return true;
    case 'transfer':
    case 'opening_balance':
    case 'credit_card_payment':
    case 'debt_lend':
    case 'debt_borrow':
    case 'debt_collect':
    case 'debt_repay':
      return false;
  }
}

/**
 * Section 5.7: Source-of-truth balance of a pocket = sum of `signed_amount_minor`
 * of all non-deleted lines (`deleted_at == null`) belonging to non-voided transactions.
 */
export function computePocketBalanceFromLines(
  pocketId: string,
  lines: ReadonlyArray<TransactionLine>,
  voidedTransactionIds?: ReadonlySet<string>,
): number {
  let sum = 0;
  for (const line of lines) {
    if (line.pocket_id !== pocketId) continue;
    if (line.deleted_at) continue;
    if (voidedTransactionIds?.has(line.transaction_id)) continue;
    sum += line.signed_amount_minor;
  }
  return sum;
}

/**
 * Section 5.7: Account balance in base currency (VND) = sum of active pockets converted at latest FX rate.
 */
export function computeAccountBalanceInBase(
  accountId: string,
  pockets: ReadonlyArray<Pocket>,
  latestFxRatesToBase: Readonly<Record<string, number>> = {},
  baseCurrency = 'VND',
): number {
  let totalBaseMinor = 0;
  for (const pocket of pockets) {
    if (pocket.account_id !== accountId || pocket.archived_at) continue;
    const currency = pocket.currency ?? 'VND';
    const rate =
      latestFxRatesToBase[currency.toUpperCase()] ?? getDefaultFxRateToBase(currency, baseCurrency);
    totalBaseMinor += convertMinorToBase(pocket.cached_balance_minor, currency, baseCurrency, rate);
  }
  return totalBaseMinor;
}

export interface NetWorthInput {
  pockets: ReadonlyArray<Pocket>;
  debts?: ReadonlyArray<DebtItem>;
  latestFxRatesToBase?: Readonly<Record<string, number>>;
  baseCurrency?: string;
}

/**
 * Section 5.7: Total Net Worth (base currency) =
 *   sum of all active pocket balances converted at latest FX rate (including negative credit card balances)
 *   + sum of open receivable debts (`they_owe` remaining_minor)
 *   - sum of open payable debts (`i_owe` remaining_minor).
 */
export function computeNetWorth({
  pockets,
  debts = [],
  latestFxRatesToBase = {},
  baseCurrency = 'VND',
}: NetWorthInput): number {
  let netWorthMinor = 0;

  for (const pocket of pockets) {
    if (pocket.archived_at) continue;
    const currency = pocket.currency ?? 'VND';
    const rate =
      latestFxRatesToBase[currency.toUpperCase()] ?? getDefaultFxRateToBase(currency, baseCurrency);
    netWorthMinor += convertMinorToBase(pocket.cached_balance_minor, currency, baseCurrency, rate);
  }

  for (const debt of debts) {
    if (debt.status !== 'open' || debt.remaining_minor <= 0) continue;
    const rate =
      latestFxRatesToBase[debt.currency.toUpperCase()] ??
      getDefaultFxRateToBase(debt.currency, baseCurrency);
    const remainingBase = convertMinorToBase(
      debt.remaining_minor,
      debt.currency,
      baseCurrency,
      rate,
    );
    if (debt.direction === 'they_owe') {
      netWorthMinor += remainingBase;
    } else if (debt.direction === 'i_owe') {
      netWorthMinor -= remainingBase;
    }
  }

  return netWorthMinor;
}

export interface PeriodReportSummary {
  totalExpenseBaseMinor: number;
  totalIncomeBaseMinor: number;
  unknownAdjustmentExpenseMinor: number;
  unknownAdjustmentIncomeMinor: number;
  byCategoryExpenseBaseMinor: Record<string, number>;
}

/**
 * Section 5.1 & 5.7: Historical Income/Expense Report Summary.
 * Uses `amount_base_minor` locked at the time of each transaction so historical reports
 * never change when exchange rates fluctuate later.
 */
export function computePeriodReportSummary(
  transactions: ReadonlyArray<Transaction>,
  lines: ReadonlyArray<TransactionLine>,
  startDate?: string,
  endDate?: string,
): PeriodReportSummary {
  const linesByTxId = new Map<string, TransactionLine[]>();
  for (const line of lines) {
    if (line.deleted_at) continue;
    const list = linesByTxId.get(line.transaction_id) ?? [];
    list.push(line);
    linesByTxId.set(line.transaction_id, list);
  }

  let totalExpenseBaseMinor = 0;
  let totalIncomeBaseMinor = 0;
  let unknownAdjustmentExpenseMinor = 0;
  let unknownAdjustmentIncomeMinor = 0;
  const byCategoryExpenseBaseMinor: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.voided_at || tx.status === 'void') continue;
    if (!isReportableInIncomeExpense(tx.type)) continue;
    if (startDate && tx.txn_date < startDate) continue;
    if (endDate && tx.txn_date > endDate) continue;

    const txLines = linesByTxId.get(tx.id) ?? [];
    const signedBaseSum = txLines.reduce((acc, l) => {
      const baseVal =
        l.amount_base_minor ??
        convertMinorToBase(
          l.signed_amount_minor,
          l.currency ?? tx.currency,
          'VND',
          l.fx_rate_to_base,
        );
      return acc + baseVal;
    }, 0);

    if (tx.type === 'adjustment') {
      if (signedBaseSum < 0) {
        const absVal = Math.abs(signedBaseSum);
        totalExpenseBaseMinor += absVal;
        unknownAdjustmentExpenseMinor += absVal;
        if (tx.category_id) {
          byCategoryExpenseBaseMinor[tx.category_id] =
            (byCategoryExpenseBaseMinor[tx.category_id] ?? 0) + absVal;
        }
      } else if (signedBaseSum > 0) {
        totalIncomeBaseMinor += signedBaseSum;
        unknownAdjustmentIncomeMinor += signedBaseSum;
      }
      continue;
    }

    if (signedBaseSum < 0) {
      const absVal = Math.abs(signedBaseSum);
      totalExpenseBaseMinor += absVal;
      if (tx.category_id) {
        byCategoryExpenseBaseMinor[tx.category_id] =
          (byCategoryExpenseBaseMinor[tx.category_id] ?? 0) + absVal;
      }
    } else if (signedBaseSum > 0) {
      totalIncomeBaseMinor += signedBaseSum;
    }
  }

  return {
    totalExpenseBaseMinor,
    totalIncomeBaseMinor,
    unknownAdjustmentExpenseMinor,
    unknownAdjustmentIncomeMinor,
    byCategoryExpenseBaseMinor,
  };
}
