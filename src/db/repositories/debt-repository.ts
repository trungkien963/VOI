import type { Table } from 'dexie';
import { computeDebtSummaryFromTransactions } from '../../domain/ledger/debt-calculator';
import {
  buildPaidForOthersBundles,
  type BuildPaidForOthersInput,
  type PaidForOthersBundleResult,
} from '../../domain/ledger/paid-for-others';
import { buildTransactionBundle } from '../../domain/ledger/strategies';
import { parseQuickInput } from '../../domain/quick-parser/parser';
import type { DebtDirection, DebtItem } from '../../domain/types/entities';
import { BaseRepository } from './base-repository';
import { transactionRepository } from './transaction-repository';

export interface CreateOpeningDebtInput {
  id?: string;
  userId?: string;
  counterpartyName: string;
  direction: DebtDirection;
  principalMinor: number;
  currency?: string;
  dueDate?: string | null;
  note?: string | null;
  categoryId?: string | null;
}

export interface CreateLendOrBorrowInput extends CreateOpeningDebtInput {
  sourceAccountId: string;
  sourcePocketId: string;
}

export class DebtRepository extends BaseRepository<DebtItem> {
  protected readonly tableName = 'debt_items';

  protected get table(): Table<DebtItem, string> {
    return this.db.debt_items;
  }

  public async listActiveDebts(): Promise<DebtItem[]> {
    const all = await this.db.debt_items.toArray();
    return all.filter((d) => !d.deleted_at && d.status !== 'cancelled');
  }

  /**
   * Section 5.6: Creates an existing opening debt (`origin = 'opening_balance'`)
   * WITHOUT creating any income/expense transaction in the ledger.
   */
  public async createOpeningDebtAtomic(input: CreateOpeningDebtInput): Promise<DebtItem> {
    const nowIso = new Date().toISOString();
    const id = input.id ?? `debt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const principal = Math.abs(Math.trunc(input.principalMinor));

    const debt: DebtItem = {
      id,
      user_id: input.userId ?? 'local-user',
      counterparty_id: `cp-${input.counterpartyName.toLowerCase().replace(/\s+/g, '-')}`,
      counterparty_name: input.counterpartyName.trim(),
      direction: input.direction,
      origin: 'opening_balance',
      status: 'open',
      title: input.note?.trim() || input.counterpartyName.trim(),
      principal_minor: principal,
      remaining_minor: principal,
      currency: input.currency ?? 'VND',
      opened_date: nowIso.slice(0, 10),
      due_date: input.dueDate ?? null,
      origin_transaction_id: null,
      note: input.note ?? null,
      settled_at: null,
      deleted_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    await this.upsertAtomic(debt);
    return debt;
  }

  /**
   * Creates a `lend` or `borrow` debt item AND records the corresponding pocket movement atomically.
   */
  public async createLendOrBorrowAtomic(input: CreateLendOrBorrowInput): Promise<DebtItem> {
    const nowIso = new Date().toISOString();
    const debtId = input.id ?? `debt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const txId = `tx-${debtId}`;
    const principal = Math.abs(Math.trunc(input.principalMinor));
    const isLend = input.direction === 'they_owe';

    const debt: DebtItem = {
      id: debtId,
      user_id: input.userId ?? 'local-user',
      counterparty_id: `cp-${input.counterpartyName.toLowerCase().replace(/\s+/g, '-')}`,
      counterparty_name: input.counterpartyName.trim(),
      direction: input.direction,
      origin: isLend ? 'lend' : 'borrow',
      status: 'open',
      title: input.note?.trim() || input.counterpartyName.trim(),
      principal_minor: principal,
      remaining_minor: principal,
      currency: input.currency ?? 'VND',
      opened_date: nowIso.slice(0, 10),
      due_date: input.dueDate ?? null,
      origin_transaction_id: txId,
      note: input.note ?? null,
      settled_at: null,
      deleted_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const inferredCategoryId =
      input.categoryId !== undefined
        ? input.categoryId
        : input.note?.trim()
          ? parseQuickInput(input.note).categoryId
          : null;

    const bundle = buildTransactionBundle({
      transactionId: txId,
      userId: debt.user_id,
      type: isLend ? 'debt_lend' : 'debt_borrow',
      amountMinor: principal,
      currency: debt.currency,
      sourceAccountId: input.sourceAccountId,
      sourcePocketId: input.sourcePocketId,
      categoryId: inferredCategoryId,
      counterpartyId: debt.counterparty_id,
      debtId: debt.id,
      note: input.note ?? `${isLend ? 'Lent to' : 'Borrowed from'} ${debt.counterparty_name}`,
      occurredAt: nowIso,
    });

    await this.upsertAtomic(debt);
    await transactionRepository.saveBundlesAtomic([bundle]);
    return debt;
  }

  /**
   * Section 5.6: Records a partial or full repayment (`debt_collect` or `debt_repay`),
   * recalculates `remaining_minor`, and transitions `status` to `'settled'` when `remaining_minor <= 0`.
   */
  public async recordRepaymentAtomic(params: {
    debtId: string;
    amountMinor: number;
    accountId: string;
    pocketId: string;
    note?: string | null;
  }): Promise<DebtItem> {
    const debt = await this.db.debt_items.get(params.debtId);
    if (!debt) {
      throw new Error(`DebtItem ${params.debtId} not found`);
    }

    const repayAmount = Math.abs(Math.trunc(params.amountMinor));
    const txType = debt.direction === 'they_owe' ? 'debt_collect' : 'debt_repay';
    const txId = `tx-repay-${debt.id}-${Date.now()}`;

    const bundle = buildTransactionBundle({
      transactionId: txId,
      userId: debt.user_id,
      type: txType,
      amountMinor: repayAmount,
      currency: debt.currency,
      sourceAccountId: params.accountId,
      sourcePocketId: params.pocketId,
      counterpartyId: debt.counterparty_id,
      debtId: debt.id,
      note: params.note ?? `Repayment · ${debt.counterparty_name ?? debt.title}`,
    });

    await transactionRepository.saveBundlesAtomic([bundle]);

    const linkedTxs = await this.db.transactions.where('debt_id').equals(debt.id).toArray();
    const summary = computeDebtSummaryFromTransactions(debt, linkedTxs);
    const nowIso = new Date().toISOString();

    const updatedDebt: DebtItem = {
      ...debt,
      principal_minor: summary.principalMinor,
      remaining_minor: summary.remainingMinor,
      status: summary.status,
      settled_at: summary.status === 'settled' ? nowIso : null,
      updated_at: nowIso,
    };

    await this.upsertAtomic(updatedDebt);
    return updatedDebt;
  }

  /**
   * Section 5.5: Executes "Trả hộ" (Paid for others) split expense + lend cluster atomically.
   */
  public async createPaidForOthersAtomic(
    input: BuildPaidForOthersInput,
  ): Promise<PaidForOthersBundleResult> {
    const result = buildPaidForOthersBundles(input);
    for (const debt of result.debtItems) {
      await this.upsertAtomic(debt);
    }
    await transactionRepository.saveBundlesAtomic(result.transactionBundles);
    return result;
  }
}

export const debtRepository = new DebtRepository();
