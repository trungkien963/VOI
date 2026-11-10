import {
  computeImpliedFxRate,
  convertMinorToBase,
  getDefaultFxRateToBase,
} from '../money/currency';
import type {
  Transaction,
  TransactionLine,
  TransactionSource,
  TransactionType,
} from '../types/entities';

export interface LedgerEntryInput {
  transactionId: string;
  userId: string;
  type: TransactionType;
  amountMinor: number;
  currency: string;
  fxRateToBase?: number;
  sourceAccountId: string;
  sourcePocketId: string | null;
  destinationAccountId?: string;
  destinationPocketId?: string | null;
  destinationAmountMinor?: number;
  destinationCurrency?: string;
  destinationFxRateToBase?: number;
  transferFeeMinor?: number;
  groupId?: string | null;
  debtId?: string | null;
  categoryId?: string | null;
  counterpartyId?: string | null;
  recurringRuleId?: string | null;
  source?: TransactionSource;
  note?: string | null;
  occurredAt?: string;
}

export interface LedgerBundleResult {
  transaction: Transaction;
  lines: TransactionLine[];
  accountBalanceDeltas: Record<string, number>;
  pocketBalanceDeltas: Record<string, number>;
  impliedFxRate?: number;
}

/**
 * Abstract base strategy (Template Method Pattern) enforcing Section 5.1 & 5.2 ledger invariants.
 */
export abstract class BaseLedgerStrategy {
  abstract readonly supportedType: TransactionType;

  public buildBundle(input: LedgerEntryInput): LedgerBundleResult {
    this.validateInput(input);
    const nowIso = new Date().toISOString();
    const occurredAt = input.occurredAt ?? nowIso;

    const transaction: Transaction = {
      id: input.transactionId,
      user_id: input.userId,
      client_id: input.transactionId,
      type: this.supportedType,
      status: 'posted',
      source: input.source ?? 'quick_add',
      occurred_at: occurredAt,
      txn_date: occurredAt.slice(0, 10),
      amount_minor: Math.abs(input.amountMinor),
      currency: input.currency,
      category_id: this.resolveCategoryId(input),
      counterparty_id: input.counterpartyId ?? null,
      group_id: input.groupId ?? null,
      debt_id: input.debtId ?? null,
      merchant_name: null,
      note: input.note ?? null,
      raw_input_text: input.note ?? null,
      is_reimbursable: false,
      linked_transaction_id: null,
      recurring_rule_id: input.recurringRuleId ?? null,
      created_at: nowIso,
      updated_at: nowIso,
      voided_at: null,
    };

    const lines = this.createLines(input, nowIso);
    this.assertLedgerInvariants(lines, input);

    const accountBalanceDeltas: Record<string, number> = {};
    const pocketBalanceDeltas: Record<string, number> = {};
    for (const line of lines) {
      accountBalanceDeltas[line.account_id] =
        (accountBalanceDeltas[line.account_id] ?? 0) + line.signed_amount_minor;
      if (line.pocket_id) {
        pocketBalanceDeltas[line.pocket_id] =
          (pocketBalanceDeltas[line.pocket_id] ?? 0) + line.signed_amount_minor;
      }
    }

    const dstCurrency = input.destinationCurrency ?? input.currency;
    const impliedFxRate =
      this.supportedType === 'transfer' &&
      input.destinationAmountMinor !== undefined &&
      dstCurrency.toUpperCase() !== input.currency.toUpperCase()
        ? computeImpliedFxRate(
            input.amountMinor,
            input.currency,
            input.destinationAmountMinor,
            dstCurrency,
          )
        : undefined;

    return {
      transaction,
      lines,
      accountBalanceDeltas,
      pocketBalanceDeltas,
      ...(impliedFxRate !== undefined ? { impliedFxRate } : {}),
    };
  }

  protected resolveCategoryId(input: LedgerEntryInput): string | null {
    return input.categoryId ?? null;
  }

  protected validateInput(input: LedgerEntryInput): void {
    if (input.amountMinor === 0) {
      throw new Error('INVALID_AMOUNT: Amount cannot be 0');
    }
    if (!input.sourceAccountId) {
      throw new Error('INVALID_ACCOUNT: Source account is required');
    }
  }

  protected buildSingleLine(
    input: LedgerEntryInput,
    signedMinor: number,
    createdAt: string,
  ): TransactionLine {
    const rate = input.fxRateToBase ?? getDefaultFxRateToBase(input.currency, 'VND');
    return {
      id: `${input.transactionId}-line-1`,
      user_id: input.userId,
      transaction_id: input.transactionId,
      account_id: input.sourceAccountId,
      pocket_id: input.sourcePocketId,
      signed_amount_minor: signedMinor,
      currency: input.currency,
      fx_rate_to_base: rate,
      amount_base_minor: convertMinorToBase(signedMinor, input.currency, 'VND', rate),
      is_fee: false,
      line_note: input.note ?? null,
      created_at: createdAt,
      deleted_at: null,
    };
  }

  protected abstract createLines(input: LedgerEntryInput, createdAt: string): TransactionLine[];
  protected abstract assertLedgerInvariants(
    lines: TransactionLine[],
    input: LedgerEntryInput,
  ): void;
}
