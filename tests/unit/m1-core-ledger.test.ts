import { describe, expect, it } from 'vitest';
import { FnAppLocalDB } from '../../src/db/dexie-schema';
import { AccountRepository } from '../../src/db/repositories/account-repository';
import { PocketRepository } from '../../src/db/repositories/pocket-repository';
import { TransactionRepository } from '../../src/db/repositories/transaction-repository';
import { SYSTEM_CATEGORY_IDS } from '../../src/domain/categories/default-categories';
import {
  computeAccountBalanceInBase,
  computeNetWorth,
  computePeriodReportSummary,
  computePocketBalanceFromLines,
  isReportableInIncomeExpense,
} from '../../src/domain/ledger/balance-calculator';
import { buildTransferWithFeeBundles, getLedgerStrategy } from '../../src/domain/ledger/strategies';
import {
  computeImpliedFxRate,
  convertMinorToBase,
  formatMoney,
  fromMinorUnits,
  toMinorUnits,
} from '../../src/domain/money/currency';
import type { DebtItem } from '../../src/domain/types/entities';

describe('Milestone 1: Core Ledger (Money Utils, Account/Pocket CRUD, Section 5.1, 5.2 & 5.7 Rules)', () => {
  it('handles ISO 4217 minor units, VND/USD formatting, compact mode, and FX conversion without float drift', () => {
    // VND (0 decimals)
    expect(toMinorUnits(45000, 'VND')).toBe(45000);
    expect(fromMinorUnits(45000, 'VND')).toBe(45000);
    expect(formatMoney(45000, 'VND')).toBe('45.000đ');
    expect(formatMoney(45000, 'VND', { compact: true })).toBe('45k');
    expect(formatMoney(1250000, 'VND', { compact: true })).toBe('1,3tr');
    expect(formatMoney(45000, 'VND', { hidden: true })).toBe('••••••đ');

    // USD (2 decimals)
    expect(toMinorUnits(12.5, 'USD')).toBe(1250);
    expect(fromMinorUnits(1250, 'USD')).toBe(12.5);
    expect(formatMoney(1250, 'USD')).toBe('$12.50');
    expect(formatMoney(1250, 'USD', { hidden: true })).toBe('$••••••');

    // 100 USD (10,000 cents) -> VND at 25,400 = 2,540,000 VND
    expect(convertMinorToBase(10000, 'USD', 'VND', 25400)).toBe(2540000);
  });

  it('enforces all Section 5.1 transaction line invariants and report inclusion rules', () => {
    // 1. Expense: 1 negative line, reportable
    const exp = getLedgerStrategy('expense').buildBundle({
      transactionId: 'tx-exp',
      userId: 'u1',
      type: 'expense',
      amountMinor: 55000,
      currency: 'VND',
      sourceAccountId: 'acc-1',
      sourcePocketId: 'p-1',
      categoryId: SYSTEM_CATEGORY_IDS.foodDining,
    });
    expect(exp.lines).toHaveLength(1);
    expect(exp.lines[0]?.signed_amount_minor).toBe(-55000);
    expect(isReportableInIncomeExpense('expense')).toBe(true);

    // 2. Income: 1 positive line, reportable
    const inc = getLedgerStrategy('income').buildBundle({
      transactionId: 'tx-inc',
      userId: 'u1',
      type: 'income',
      amountMinor: 15000000,
      currency: 'VND',
      sourceAccountId: 'acc-1',
      sourcePocketId: 'p-1',
      categoryId: SYSTEM_CATEGORY_IDS.salary,
    });
    expect(inc.lines).toHaveLength(1);
    expect(inc.lines[0]?.signed_amount_minor).toBe(15000000);
    expect(isReportableInIncomeExpense('income')).toBe(true);

    // 3. Opening balance: 1 line (can be negative for credit card opening debt), NOT reportable
    const obCredit = getLedgerStrategy('opening_balance').buildBundle({
      transactionId: 'tx-ob-cc',
      userId: 'u1',
      type: 'opening_balance',
      amountMinor: -2000000,
      currency: 'VND',
      sourceAccountId: 'acc-cc',
      sourcePocketId: 'p-cc',
    });
    expect(obCredit.lines[0]?.signed_amount_minor).toBe(-2000000);
    expect(isReportableInIncomeExpense('opening_balance')).toBe(false);

    // 4. Adjustment (Reconcile): negative attaches "Không nhớ rõ", positive attaches "Thu nhập không rõ"
    const adjNeg = getLedgerStrategy('adjustment').buildBundle({
      transactionId: 'tx-adj-neg',
      userId: 'u1',
      type: 'adjustment',
      amountMinor: -30000,
      currency: 'VND',
      sourceAccountId: 'acc-1',
      sourcePocketId: 'p-1',
    });
    expect(adjNeg.transaction.category_id).toBe(SYSTEM_CATEGORY_IDS.unknownExpense);
    expect(adjNeg.lines[0]?.signed_amount_minor).toBe(-30000);

    const adjPos = getLedgerStrategy('adjustment').buildBundle({
      transactionId: 'tx-adj-pos',
      userId: 'u1',
      type: 'adjustment',
      amountMinor: 50000,
      currency: 'VND',
      sourceAccountId: 'acc-1',
      sourcePocketId: 'p-1',
    });
    expect(adjPos.transaction.category_id).toBe(SYSTEM_CATEGORY_IDS.unknownIncome);
    expect(adjPos.lines[0]?.signed_amount_minor).toBe(50000);
    expect(isReportableInIncomeExpense('adjustment')).toBe(true);

    // 5. Lend / Borrow / Debt Collect / Debt Repay: 1 signed line, NOT reportable
    const lend = getLedgerStrategy('debt_lend').buildBundle({
      transactionId: 'tx-lend',
      userId: 'u1',
      type: 'debt_lend',
      amountMinor: 500000,
      currency: 'VND',
      sourceAccountId: 'acc-1',
      sourcePocketId: 'p-1',
      debtId: 'debt-1',
    });
    expect(lend.lines[0]?.signed_amount_minor).toBe(-500000);
    expect(isReportableInIncomeExpense('debt_lend')).toBe(false);
    expect(isReportableInIncomeExpense('debt_borrow')).toBe(false);
    expect(isReportableInIncomeExpense('debt_collect')).toBe(false);
    expect(isReportableInIncomeExpense('debt_repay')).toBe(false);
    expect(isReportableInIncomeExpense('transfer')).toBe(false);
  });

  it('enforces Section 5.2 cross-currency transfer (infers FX rate) and linked transfer fee expense (group_id)', () => {
    // Send 100 USD (10,000 cents), receive 2,540,000 VND, plus 1 USD (100 cents) transfer fee
    expect(computeImpliedFxRate(10000, 'USD', 2540000, 'VND')).toBe(25400);

    const bundles = buildTransferWithFeeBundles({
      transactionId: 'tx-fx-transfer',
      userId: 'u1',
      type: 'transfer',
      amountMinor: 10000, // $100.00
      currency: 'USD',
      sourceAccountId: 'acc-usd',
      sourcePocketId: 'pocket-usd',
      destinationAccountId: 'acc-vnd',
      destinationPocketId: 'pocket-vnd',
      destinationAmountMinor: 2540000, // 2,540,000 VND
      destinationCurrency: 'VND',
      transferFeeMinor: 100, // $1.00 fee
      note: 'Exchange USD to VND',
    });

    expect(bundles).toHaveLength(2);
    const transferBundle = bundles[0]!;
    const feeBundle = bundles[1]!;

    // Transfer bundle has 2 lines (-10,000 USD cents and +2,540,000 VND) and impliedFxRate = 25400
    expect(transferBundle.impliedFxRate).toBe(25400);
    expect(transferBundle.lines[0]?.signed_amount_minor).toBe(-10000);
    expect(transferBundle.lines[0]?.currency).toBe('USD');
    expect(transferBundle.lines[1]?.signed_amount_minor).toBe(2540000);
    expect(transferBundle.lines[1]?.currency).toBe('VND');

    // Fee bundle is a separate `expense` with category "Phí" linked via shared `group_id`
    expect(feeBundle.transaction.type).toBe('expense');
    expect(feeBundle.transaction.category_id).toBe(SYSTEM_CATEGORY_IDS.feesInterest);
    expect(feeBundle.transaction.group_id).toBe(transferBundle.transaction.group_id);
    expect(feeBundle.lines[0]?.signed_amount_minor).toBe(-100);
  });

  it('executes Account/Pocket CRUD, Expense/Income/Transfer atomic lifecycle, Soft-Delete + Undo, and Section 5.7 Net Worth & Historical Report formulas', async () => {
    const db = new FnAppLocalDB('test_fn_app_m1_ledger');
    await db.delete();
    await db.open();

    const accRepo = new AccountRepository(db);
    const pocketRepo = new PocketRepository(db);
    const txRepo = new TransactionRepository(db);

    // 1. Create Bank Account (opening balance 5,000,000 VND) & Credit Card (opening debt -1,000,000 VND)
    const { account: bankAcc, defaultPocket: bankVndPocket } =
      await accRepo.createAccountWithOpeningBalance({
        id: 'acc-bank',
        name: 'VCB Bank',
        type: 'bank',
        currency: 'VND',
        openingBalanceMinor: 5_000_000,
      });

    const { account: ccAcc, defaultPocket: ccPocket } =
      await accRepo.createAccountWithOpeningBalance({
        id: 'acc-cc',
        name: 'VIB Credit Card',
        type: 'credit_card',
        currency: 'VND',
        openingBalanceMinor: -1_000_000,
      });

    // Add a USD pocket inside Bank Account with $100.00 (10,000 cents) opening balance
    const bankUsdPocket = await pocketRepo.createPocketWithOpeningBalance({
      id: 'pocket-bank-usd',
      accountId: bankAcc.id,
      name: 'VCB USD',
      currency: 'USD',
      openingBalanceMinor: 10_000, // $100.00
    });

    // 2. Log an Expense (100,000 VND lunch on Bank VND) and an USD Expense ($10 = 1,000 cents at historical rate 25,000 VND/USD)
    await txRepo.createFromInputAtomic({
      transactionId: 'tx-lunch',
      userId: 'local-user',
      type: 'expense',
      amountMinor: 100_000,
      currency: 'VND',
      sourceAccountId: bankAcc.id,
      sourcePocketId: bankVndPocket.id,
      categoryId: SYSTEM_CATEGORY_IDS.foodDining,
      occurredAt: '2026-11-08T12:00:00.000Z',
    });

    await txRepo.createFromInputAtomic({
      transactionId: 'tx-usd-sub',
      userId: 'local-user',
      type: 'expense',
      amountMinor: 1_000, // $10.00
      currency: 'USD',
      fxRateToBase: 25_000, // Historical FX rate at time of transaction: 1 USD = 25,000 VND -> 250,000 VND
      sourceAccountId: bankAcc.id,
      sourcePocketId: bankUsdPocket.id,
      categoryId: SYSTEM_CATEGORY_IDS.foodDining,
      occurredAt: '2026-11-08T13:00:00.000Z',
    });

    // 3. Log a Transfer (500,000 VND from Bank VND to pay Credit Card)
    await txRepo.createFromInputAtomic({
      transactionId: 'tx-pay-cc',
      userId: 'local-user',
      type: 'transfer',
      amountMinor: 500_000,
      currency: 'VND',
      sourceAccountId: bankAcc.id,
      sourcePocketId: bankVndPocket.id,
      destinationAccountId: ccAcc.id,
      destinationPocketId: ccPocket.id,
      occurredAt: '2026-11-08T14:00:00.000Z',
    });

    // Verify Pocket Balances match sum of lines (Section 5.7)
    const allLines = await txRepo.listActiveLines();
    const bankVndFromLines = computePocketBalanceFromLines(bankVndPocket.id, allLines);
    const ccFromLines = computePocketBalanceFromLines(ccPocket.id, allLines);
    const bankUsdFromLines = computePocketBalanceFromLines(bankUsdPocket.id, allLines);

    expect(bankVndFromLines).toBe(5_000_000 - 100_000 - 500_000); // 4,400,000 VND
    expect(ccFromLines).toBe(-1_000_000 + 500_000); // -500,000 VND
    expect(bankUsdFromLines).toBe(9_000); // $90.00 (9,000 cents)

    const updatedBankVnd = await pocketRepo.findById(bankVndPocket.id);
    const updatedCc = await pocketRepo.findById(ccPocket.id);
    const updatedBankUsd = await pocketRepo.findById(bankUsdPocket.id);
    expect(updatedBankVnd?.cached_balance_minor).toBe(4_400_000);
    expect(updatedCc?.cached_balance_minor).toBe(-500_000);
    expect(updatedBankUsd?.cached_balance_minor).toBe(9_000);

    // 4. Verify Soft-Delete & 1-Tap Restore (Undo)
    await txRepo.softDeleteTransactionAtomic('tx-lunch');
    expect((await pocketRepo.findById(bankVndPocket.id))?.cached_balance_minor).toBe(4_500_000);

    await txRepo.restoreTransactionAtomic('tx-lunch');
    expect((await pocketRepo.findById(bankVndPocket.id))?.cached_balance_minor).toBe(4_400_000);

    // 5. Verify Section 5.7 Net Worth (uses LATEST FX rate = 26,000 VND/USD + open receivables - open payables)
    const activePockets = await pocketRepo.listActivePockets();
    const openDebts: DebtItem[] = [
      {
        id: 'd-rec',
        user_id: 'local-user',
        counterparty_id: 'cp-1',
        direction: 'they_owe',
        status: 'open',
        title: 'Minh owes lunch',
        principal_minor: 300_000,
        remaining_minor: 300_000,
        currency: 'VND',
        opened_date: '2026-11-08',
        due_date: null,
        origin_transaction_id: null,
        note: null,
        settled_at: null,
        created_at: '2026-11-08T00:00:00Z',
        updated_at: '2026-11-08T00:00:00Z',
      },
      {
        id: 'd-pay',
        user_id: 'local-user',
        counterparty_id: 'cp-2',
        direction: 'i_owe',
        status: 'open',
        title: 'Owe Lan',
        principal_minor: 100_000,
        remaining_minor: 100_000,
        currency: 'VND',
        opened_date: '2026-11-08',
        due_date: null,
        origin_transaction_id: null,
        note: null,
        settled_at: null,
        created_at: '2026-11-08T00:00:00Z',
        updated_at: '2026-11-08T00:00:00Z',
      },
    ];

    const latestFx = { USD: 26_000 };
    const bankBalanceAtLatestFx = computeAccountBalanceInBase(bankAcc.id, activePockets, latestFx);
    // 4,400,000 VND + ($90 * 26,000 = 2,340,000 VND) = 6,740,000 VND
    expect(bankBalanceAtLatestFx).toBe(6_740_000);

    const netWorth = computeNetWorth({
      pockets: activePockets,
      debts: openDebts,
      latestFxRatesToBase: latestFx,
    });
    // Pockets: 4,400,000 + 2,340,000 - 500,000 = 6,240,000
    // Debts: +300,000 (they_owe) - 100,000 (i_owe) = +200,000 -> Total Net Worth = 6,440,000 VND
    expect(netWorth).toBe(6_440_000);

    // 6. Verify Section 5.7 Historical Report Summary:
    // Uses historical `amount_base_minor` (25,000 VND/USD for the $10 expense = 250,000 VND),
    // NOT the latest 26,000 rate, and excludes `opening_balance` and `transfer`!
    const allTxs = await txRepo.listActiveTransactions();
    const finalLines = await txRepo.listActiveLines();
    const report = computePeriodReportSummary(allTxs, finalLines, '2026-11-01', '2026-11-30');
    expect(report.totalExpenseBaseMinor).toBe(100_000 + 250_000); // 350,000 VND
    expect(report.totalIncomeBaseMinor).toBe(0);

    await db.close();
  });
});
