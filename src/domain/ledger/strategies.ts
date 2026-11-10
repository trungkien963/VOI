import { SYSTEM_CATEGORY_IDS } from '../categories/default-categories';
import {
  computeImpliedFxRate,
  convertMinorToBase,
  getDefaultFxRateToBase,
} from '../money/currency';
import type { TransactionLine, TransactionType } from '../types/entities';
import {
  BaseLedgerStrategy,
  type LedgerBundleResult,
  type LedgerEntryInput,
} from './base-strategy';

export { BaseLedgerStrategy, type LedgerBundleResult, type LedgerEntryInput };
export type TransactionBundle = LedgerBundleResult;

export function buildTransactionBundle(input: LedgerEntryInput): LedgerBundleResult {
  return getLedgerStrategy(input.type).buildBundle(input);
}

export class OutflowSingleLineStrategy extends BaseLedgerStrategy {
  readonly supportedType: TransactionType;

  constructor(type: TransactionType) {
    super();
    this.supportedType = type;
  }

  protected override validateInput(input: LedgerEntryInput): void {
    super.validateInput(input);
    if (input.amountMinor <= 0) {
      throw new Error('INVALID_AMOUNT: Outflow amount must be greater than 0');
    }
  }

  protected createLines(input: LedgerEntryInput, createdAt: string): TransactionLine[] {
    return [this.buildSingleLine(input, -Math.abs(input.amountMinor), createdAt)];
  }

  protected assertLedgerInvariants(lines: TransactionLine[]): void {
    const first = lines[0];
    if (lines.length !== 1 || !first || first.signed_amount_minor >= 0) {
      throw new Error(
        `LEDGER_INVARIANT_VIOLATION: ${this.supportedType} must have 1 negative line`,
      );
    }
  }
}

export class InflowSingleLineStrategy extends BaseLedgerStrategy {
  readonly supportedType: TransactionType;

  constructor(type: TransactionType) {
    super();
    this.supportedType = type;
  }

  protected override validateInput(input: LedgerEntryInput): void {
    super.validateInput(input);
    if (input.amountMinor <= 0) {
      throw new Error('INVALID_AMOUNT: Inflow amount must be greater than 0');
    }
  }

  protected createLines(input: LedgerEntryInput, createdAt: string): TransactionLine[] {
    return [this.buildSingleLine(input, Math.abs(input.amountMinor), createdAt)];
  }

  protected assertLedgerInvariants(lines: TransactionLine[]): void {
    const first = lines[0];
    if (lines.length !== 1 || !first || first.signed_amount_minor <= 0) {
      throw new Error(
        `LEDGER_INVARIANT_VIOLATION: ${this.supportedType} must have 1 positive line`,
      );
    }
  }
}

export class TransferLedgerStrategy extends BaseLedgerStrategy {
  readonly supportedType: TransactionType;

  constructor(type: TransactionType = 'transfer') {
    super();
    this.supportedType = type;
  }

  protected override validateInput(input: LedgerEntryInput): void {
    super.validateInput(input);
    if (input.amountMinor <= 0) {
      throw new Error('INVALID_AMOUNT: Transfer amount must be greater than 0');
    }
    const sameAccount =
      !input.destinationAccountId || input.destinationAccountId === input.sourceAccountId;
    const samePocket = (input.destinationPocketId ?? null) === (input.sourcePocketId ?? null);
    if (sameAccount && samePocket) {
      throw new Error('INVALID_TRANSFER: Destination pocket/account must differ from source');
    }
  }

  protected createLines(input: LedgerEntryInput, createdAt: string): TransactionLine[] {
    const destAccountId = input.destinationAccountId ?? input.sourceAccountId;
    const dstCurrency = input.destinationCurrency ?? input.currency;
    const dstAmountMinor = Math.abs(input.destinationAmountMinor ?? input.amountMinor);

    const srcRate =
      dstCurrency.toUpperCase() === 'VND' && input.currency.toUpperCase() !== 'VND'
        ? computeImpliedFxRate(input.amountMinor, input.currency, dstAmountMinor, 'VND')
        : (input.fxRateToBase ?? getDefaultFxRateToBase(input.currency, 'VND'));

    const dstRate = input.destinationFxRateToBase ?? getDefaultFxRateToBase(dstCurrency, 'VND');

    return [
      {
        id: `${input.transactionId}-line-out`,
        user_id: input.userId,
        transaction_id: input.transactionId,
        account_id: input.sourceAccountId,
        pocket_id: input.sourcePocketId,
        signed_amount_minor: -Math.abs(input.amountMinor),
        currency: input.currency,
        fx_rate_to_base: srcRate,
        amount_base_minor: convertMinorToBase(
          -Math.abs(input.amountMinor),
          input.currency,
          'VND',
          srcRate,
        ),
        is_fee: false,
        line_note: input.note ?? null,
        created_at: createdAt,
        deleted_at: null,
      },
      {
        id: `${input.transactionId}-line-in`,
        user_id: input.userId,
        transaction_id: input.transactionId,
        account_id: destAccountId,
        pocket_id: input.destinationPocketId ?? null,
        signed_amount_minor: dstAmountMinor,
        currency: dstCurrency,
        fx_rate_to_base: dstRate,
        amount_base_minor: convertMinorToBase(dstAmountMinor, dstCurrency, 'VND', dstRate),
        is_fee: false,
        line_note: input.note ?? null,
        created_at: createdAt,
        deleted_at: null,
      },
    ];
  }

  protected assertLedgerInvariants(lines: TransactionLine[], input: LedgerEntryInput): void {
    const first = lines[0];
    const second = lines[1];
    if (lines.length !== 2 || !first || !second) {
      throw new Error('LEDGER_INVARIANT_VIOLATION: Transfer must have 2 lines');
    }
    if (first.signed_amount_minor >= 0 || second.signed_amount_minor <= 0) {
      throw new Error('LEDGER_INVARIANT_VIOLATION: Transfer must have -source and +dest lines');
    }
    const dstCurrency = input.destinationCurrency ?? input.currency;
    if (dstCurrency.toUpperCase() === input.currency.toUpperCase()) {
      if (first.signed_amount_minor + second.signed_amount_minor !== 0) {
        throw new Error('LEDGER_INVARIANT_VIOLATION: Same-currency transfer lines must sum to 0');
      }
    }
  }
}

export class OpeningBalanceLedgerStrategy extends BaseLedgerStrategy {
  readonly supportedType: TransactionType = 'opening_balance';

  protected createLines(input: LedgerEntryInput, createdAt: string): TransactionLine[] {
    return [this.buildSingleLine(input, input.amountMinor, createdAt)];
  }

  protected assertLedgerInvariants(lines: TransactionLine[]): void {
    if (lines.length !== 1 || !lines[0] || lines[0].signed_amount_minor === 0) {
      throw new Error('LEDGER_INVARIANT_VIOLATION: Opening balance must have 1 non-zero line');
    }
  }
}

export class AdjustmentLedgerStrategy extends BaseLedgerStrategy {
  readonly supportedType: TransactionType = 'adjustment';

  protected override resolveCategoryId(input: LedgerEntryInput): string | null {
    if (input.categoryId) return input.categoryId;
    return input.amountMinor < 0
      ? SYSTEM_CATEGORY_IDS.unknownExpense
      : SYSTEM_CATEGORY_IDS.unknownIncome;
  }

  protected createLines(input: LedgerEntryInput, createdAt: string): TransactionLine[] {
    return [this.buildSingleLine(input, input.amountMinor, createdAt)];
  }

  protected assertLedgerInvariants(lines: TransactionLine[]): void {
    if (lines.length !== 1 || !lines[0] || lines[0].signed_amount_minor === 0) {
      throw new Error('LEDGER_INVARIANT_VIOLATION: Adjustment must have 1 non-zero line');
    }
  }
}

const STRATEGIES: Record<TransactionType, BaseLedgerStrategy> = {
  expense: new OutflowSingleLineStrategy('expense'),
  credit_card_spend: new OutflowSingleLineStrategy('credit_card_spend'),
  debt_lend: new OutflowSingleLineStrategy('debt_lend'),
  debt_repay: new OutflowSingleLineStrategy('debt_repay'),
  income: new InflowSingleLineStrategy('income'),
  credit_card_refund: new InflowSingleLineStrategy('credit_card_refund'),
  debt_borrow: new InflowSingleLineStrategy('debt_borrow'),
  debt_collect: new InflowSingleLineStrategy('debt_collect'),
  transfer: new TransferLedgerStrategy('transfer'),
  credit_card_payment: new TransferLedgerStrategy('credit_card_payment'),
  opening_balance: new OpeningBalanceLedgerStrategy(),
  adjustment: new AdjustmentLedgerStrategy(),
};

export function getLedgerStrategy(type: TransactionType): BaseLedgerStrategy {
  return STRATEGIES[type];
}

export function buildTransferWithFeeBundles(input: LedgerEntryInput): LedgerBundleResult[] {
  const feeMinor = input.transferFeeMinor ?? 0;
  const sharedGroupId =
    feeMinor > 0 ? (input.groupId ?? `${input.transactionId}-group`) : (input.groupId ?? null);

  const transferBundle = getLedgerStrategy('transfer').buildBundle({
    ...input,
    groupId: sharedGroupId,
  });

  if (feeMinor <= 0) return [transferBundle];

  const feeBundle = getLedgerStrategy('expense').buildBundle({
    transactionId: `${input.transactionId}-fee`,
    userId: input.userId,
    type: 'expense',
    amountMinor: feeMinor,
    currency: input.currency,
    fxRateToBase: input.fxRateToBase,
    sourceAccountId: input.sourceAccountId,
    sourcePocketId: input.sourcePocketId,
    categoryId: SYSTEM_CATEGORY_IDS.feesInterest,
    groupId: sharedGroupId,
    note: input.note ? `${input.note} (Phí chuyển khoản)` : 'Phí chuyển khoản',
    occurredAt: input.occurredAt,
  });

  return [transferBundle, feeBundle];
}
