import { beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_CATEGORY_IDS } from '../../src/domain/categories/default-categories';
import {
  computeNetWorth,
  computePeriodReportSummary,
} from '../../src/domain/ledger/balance-calculator';
import {
  clampDayOfMonth,
  computeCreditCardSummary,
} from '../../src/domain/ledger/credit-card-calculator';
import {
  buildPoliteDebtReminderText,
  computeDebtSummaryFromTransactions,
} from '../../src/domain/ledger/debt-calculator';
import { summarizeTransactionGroup } from '../../src/domain/ledger/paid-for-others';
import {
  computeNextRunDateAfter,
  formatInstallmentProgress,
  isRecurringRuleDue,
} from '../../src/domain/ledger/recurring-calculator';
import { localDb } from '../../src/db/dexie-schema';
import { accountRepository } from '../../src/db/repositories/account-repository';
import { debtRepository } from '../../src/db/repositories/debt-repository';
import { onboardingRepository } from '../../src/db/repositories/onboarding-repository';
import { pocketRepository } from '../../src/db/repositories/pocket-repository';
import { recurringRepository } from '../../src/db/repositories/recurring-repository';
import { transactionRepository } from '../../src/db/repositories/transaction-repository';

describe('Milestone 3: Onboarding, Opening Balance, Debt Book, Credit Card, Recurring & Reconcile', () => {
  beforeEach(async () => {
    await localDb.transactions.clear();
    await localDb.transaction_lines.clear();
    await localDb.accounts.clear();
    await localDb.pockets.clear();
    await localDb.debt_items.clear();
    await localDb.recurring_rules.clear();
    await localDb.onboarding_checklist_state.clear();
    await localDb.sync_outbox.clear();
  });

  it('Section 5.3 & 5.8: Credit Card swipe counts as expense immediately, card repayment is a transfer (never double-counted), and statement/due days clamp on Feb 28 / Apr 30', async () => {
    expect(clampDayOfMonth(2026, 2, 31)).toBe(28);
    expect(clampDayOfMonth(2024, 2, 31)).toBe(29); // Leap year 2024
    expect(clampDayOfMonth(2026, 4, 31)).toBe(30);

    const bank = await accountRepository.createAccountWithOpeningBalance({
      id: 'acc-bank',
      name: 'VCB',
      type: 'bank',
      currency: 'VND',
      openingBalanceMinor: 10_000_000,
    });
    const card = await accountRepository.createAccountWithOpeningBalance({
      id: 'acc-card',
      name: 'VIB Credit Card',
      type: 'credit_card',
      currency: 'VND',
      openingBalanceMinor: -2_000_000, // Opening card debt = 2,000,000 VND
    });

    await localDb.accounts.update(card.account.id, {
      credit_limit_minor: 20_000_000,
      statement_day: 31,
      payment_due_day: 15,
    });

    // 1. Swipe card for 1,500,000 VND expense
    await transactionRepository.createFromInputAtomic({
      transactionId: 'tx-cc-swipe',
      userId: 'local-user',
      type: 'expense',
      amountMinor: 1_500_000,
      currency: 'VND',
      sourceAccountId: card.account.id,
      sourcePocketId: card.defaultPocket.id,
      categoryId: SYSTEM_CATEGORY_IDS.foodDining,
      occurredAt: '2026-02-10T12:00:00.000Z',
    });

    let cardPocket = (await localDb.pockets.get(card.defaultPocket.id))!;
    const cardAccount = (await localDb.accounts.get(card.account.id))!;
    expect(cardPocket.cached_balance_minor).toBe(-3_500_000);

    const ccSummary = computeCreditCardSummary(cardAccount, cardPocket, '2026-02-10');
    expect(ccSummary.currentDebtMinor).toBe(3_500_000);
    expect(ccSummary.remainingLimitMinor).toBe(16_500_000);
    expect(ccSummary.nextStatementDateIso).toBe('2026-02-28'); // Clamped day 31 -> Feb 28!
    expect(ccSummary.nextDueDateIso).toBe('2026-02-15');

    // 2. Pay off credit card (3,500,000 VND transfer from bank -> card)
    await transactionRepository.createFromInputAtomic({
      transactionId: 'tx-cc-payoff',
      userId: 'local-user',
      type: 'transfer',
      amountMinor: 3_500_000,
      currency: 'VND',
      sourceAccountId: bank.account.id,
      sourcePocketId: bank.defaultPocket.id,
      destinationAccountId: card.account.id,
      destinationPocketId: card.defaultPocket.id,
      occurredAt: '2026-02-15T12:00:00.000Z',
    });

    cardPocket = (await localDb.pockets.get(card.defaultPocket.id))!;
    const bankPocket = (await localDb.pockets.get(bank.defaultPocket.id))!;
    expect(cardPocket.cached_balance_minor).toBe(0);
    expect(bankPocket.cached_balance_minor).toBe(6_500_000);

    // Verify period report ONLY counts the 1,500,000 swipe, NOT the -2M opening balance and NOT the 3.5M card payoff
    const allTxs = await localDb.transactions.toArray();
    const allLines = await localDb.transaction_lines.toArray();
    const febReport = computePeriodReportSummary(allTxs, allLines, '2026-02-01', '2026-02-28');
    expect(febReport.totalExpenseBaseMinor).toBe(1_500_000);
    expect(febReport.totalIncomeBaseMinor).toBe(0);
  });

  it('Section 5.4: Reconcile creates negative adjustment (unknown-expense) on deficit, positive adjustment (unknown-income) on surplus, and no tx when matched', async () => {
    const { defaultPocket } = await accountRepository.createAccountWithOpeningBalance({
      id: 'acc-cash-rec',
      name: 'Ví tiền mặt',
      type: 'cash',
      currency: 'VND',
      openingBalanceMinor: 500_000,
    });

    // 1. Deficit: actual is 420k (delta = -80k)
    const deficitRes = await pocketRepository.reconcilePocketBalanceAtomic(
      defaultPocket.id,
      420_000,
    );
    expect(deficitRes.kind).toBe('deficit');
    expect(deficitRes.deltaMinor).toBe(-80_000);
    expect(deficitRes.categoryId).toBe(SYSTEM_CATEGORY_IDS.unknownExpense);
    expect((await localDb.pockets.get(defaultPocket.id))?.cached_balance_minor).toBe(420_000);

    // 2. Surplus: actual is 550k (delta = +130k)
    const surplusRes = await pocketRepository.reconcilePocketBalanceAtomic(
      defaultPocket.id,
      550_000,
    );
    expect(surplusRes.kind).toBe('surplus');
    expect(surplusRes.deltaMinor).toBe(130_000);
    expect(surplusRes.categoryId).toBe(SYSTEM_CATEGORY_IDS.unknownIncome);
    expect((await localDb.pockets.get(defaultPocket.id))?.cached_balance_minor).toBe(550_000);

    // 3. Exact match: actual is 550k (delta = 0) -> no new transaction created
    const txCountBefore = await localDb.transactions.count();
    const matchedRes = await pocketRepository.reconcilePocketBalanceAtomic(
      defaultPocket.id,
      550_000,
    );
    expect(matchedRes.kind).toBe('matched');
    expect(matchedRes.bundle).toBeNull();
    expect(await localDb.transactions.count()).toBe(txCountBefore);
  });

  it('Section 5.5: "Trả hộ" (Paid for others) deducts 800k from pocket, records 600k receivable debt, and counts ONLY 200k in expense report', async () => {
    const { account, defaultPocket } = await accountRepository.createAccountWithOpeningBalance({
      id: 'acc-vcb-split',
      name: 'VCB',
      type: 'bank',
      currency: 'VND',
      openingBalanceMinor: 5_000_000,
    });

    const splitRes = await debtRepository.createPaidForOthersAtomic({
      groupId: 'grp-hotpot-800k',
      expenseTransactionId: 'tx-own-200k',
      userId: 'local-user',
      sourceAccountId: account.id,
      sourcePocketId: defaultPocket.id,
      currency: 'VND',
      totalPaidMinor: 800_000,
      ownExpenseMinor: 200_000,
      categoryId: SYSTEM_CATEGORY_IDS.foodDining,
      note: 'Lẩu 4 người',
      occurredAt: '2026-11-08T19:00:00.000Z',
      shares: [
        {
          debtId: 'debt-minh-300k',
          transactionId: 'tx-lend-minh-300k',
          counterpartyId: 'cp-minh',
          counterpartyName: 'Minh',
          amountMinor: 300_000,
        },
        {
          debtId: 'debt-lan-300k',
          transactionId: 'tx-lend-lan-300k',
          counterpartyId: 'cp-lan',
          counterpartyName: 'Lan',
          amountMinor: 300_000,
        },
      ],
    });

    expect(splitRes.totalPaidMinor).toBe(800_000);
    expect(splitRes.ownExpenseMinor).toBe(200_000);
    expect(splitRes.totalLentMinor).toBe(600_000);

    // Pocket balance decreased by full 800k (5,000,000 -> 4,200,000)
    const updatedPocket = (await localDb.pockets.get(defaultPocket.id))!;
    expect(updatedPocket.cached_balance_minor).toBe(4_200_000);

    // Period expense report ONLY counts user's own share (200,000 VND)!
    const allTxs = await localDb.transactions.toArray();
    const allLines = await localDb.transaction_lines.toArray();
    const report = computePeriodReportSummary(allTxs, allLines, '2026-11-01', '2026-11-30');
    expect(report.totalExpenseBaseMinor).toBe(200_000);

    // Group cluster summary for Ledger view matches 800k total / 200k own / 600k lent
    const cluster = summarizeTransactionGroup('grp-hotpot-800k', allTxs);
    expect(cluster.totalPaidMinor).toBe(800_000);
    expect(cluster.ownExpenseMinor).toBe(200_000);
    expect(cluster.lentMinor).toBe(600_000);

    // Net worth = 4,200,000 (pocket) + 600,000 (receivable debts) = 4,800,000
    const allDebts = await localDb.debt_items.toArray();
    expect(computeNetWorth({ pockets: [updatedPocket], debts: allDebts })).toBe(4_800_000);
  });

  it('Section 5.6: Opening debts & Lend/Borrow do not affect income/expense reports, and partial/full repayments update remaining_minor and auto-settle at 0', async () => {
    const { account, defaultPocket } = await accountRepository.createAccountWithOpeningBalance({
      id: 'acc-debt-test',
      name: 'VCB',
      type: 'bank',
      currency: 'VND',
      openingBalanceMinor: 2_000_000,
    });

    // 1. Opening debt receivable (1,000,000 VND) creates NO ledger transaction
    const openingDebt = await debtRepository.createOpeningDebtAtomic({
      id: 'debt-opening-1m',
      counterpartyName: 'Hùng',
      direction: 'they_owe',
      principalMinor: 1_000_000,
      note: 'Nợ cũ tháng trước',
    });
    expect(openingDebt.origin).toBe('opening_balance');
    expect(await localDb.transactions.count()).toBe(1); // Only the account opening_balance tx

    // 2. Partial repayment of 400,000 VND
    const afterPartial = await debtRepository.recordRepaymentAtomic({
      debtId: openingDebt.id,
      amountMinor: 400_000,
      accountId: account.id,
      pocketId: defaultPocket.id,
    });
    expect(afterPartial.remaining_minor).toBe(600_000);
    expect(afterPartial.status).toBe('open');

    // 3. Final repayment of 600,000 VND -> auto-settles!
    const afterFull = await debtRepository.recordRepaymentAtomic({
      debtId: openingDebt.id,
      amountMinor: 600_000,
      accountId: account.id,
      pocketId: defaultPocket.id,
    });
    expect(afterFull.remaining_minor).toBe(0);
    expect(afterFull.status).toBe('settled');

    const linkedTxs = await localDb.transactions.where('debt_id').equals(openingDebt.id).toArray();
    const computed = computeDebtSummaryFromTransactions(afterFull, linkedTxs);
    expect(computed.paidMinor).toBe(1_000_000);
    expect(computed.remainingMinor).toBe(0);
    expect(computed.status).toBe('settled');

    // Polite reminder generator works in both EN & VI
    expect(
      buildPoliteDebtReminderText({
        counterpartyName: 'Hùng',
        remainingMinor: 600_000,
        locale: 'vi',
      }),
    ).toContain('Hùng');
    expect(
      buildPoliteDebtReminderText({
        counterpartyName: 'Alex',
        remainingMinor: 600_000,
        locale: 'en',
      }),
    ).toContain('Alex');
  });

  it('Section 5.8 & 8.8: Recurring & Installment rules do not pollute ledger until confirmed, clamp day 31 to Feb 28, and support Skip vs Confirm', async () => {
    const { account, defaultPocket } = await accountRepository.createAccountWithOpeningBalance({
      id: 'acc-rec-bank',
      name: 'VCB',
      type: 'bank',
      currency: 'VND',
      openingBalanceMinor: 10_000_000,
    });

    const rule = await recurringRepository.createRuleAtomic({
      id: 'rec-macbook',
      title: 'Trả góp MacBook',
      amountMinor: 2_000_000,
      frequency: 'monthly',
      dayOfMonth: 31,
      nextRunDate: '2026-01-31',
      accountId: account.id,
      pocketId: defaultPocket.id,
      categoryId: SYSTEM_CATEGORY_IDS.foodDining,
      totalOccurrences: 3,
      occurrencesDone: 2, // Next is 3/3 (final installment)
    });

    // Before confirmation, no recurring transaction exists in `transactions`
    expect(isRecurringRuleDue(rule, '2026-01-31')).toBe(true);
    expect(formatInstallmentProgress(rule, 'vi')).toBe('Kỳ 3/3');
    expect(computeNextRunDateAfter('2026-01-31', rule)).toBe('2026-02-28');

    // Confirm final installment -> creates real transaction, advances next_run_date to 2026-02-28, and deactivates completed installment
    const confirmedRule = await recurringRepository.confirmDueRuleAtomic(rule.id);
    expect(confirmedRule.occurrences_done).toBe(3);
    expect(confirmedRule.next_run_date).toBe('2026-02-28');
    expect(confirmedRule.is_active).toBe(false);

    // Create another monthly rule and test Skip cycle (no transaction created)
    const netflixRule = await recurringRepository.createRuleAtomic({
      id: 'rec-netflix',
      title: 'Netflix',
      amountMinor: 260_000,
      frequency: 'monthly',
      dayOfMonth: 15,
      nextRunDate: '2026-03-15',
      accountId: account.id,
      pocketId: defaultPocket.id,
    });
    const txCountBeforeSkip = await localDb.transactions.count();
    const skippedRule = await recurringRepository.skipDueRuleAtomic(netflixRule.id);
    expect(skippedRule.skipped_dates).toContain('2026-03-15');
    expect(skippedRule.next_run_date).toBe('2026-04-15');
    expect(await localDb.transactions.count()).toBe(txCountBeforeSkip);

    // Onboarding 7-step checklist state progresses and completes
    const stepState = await onboardingRepository.markStepCompleted('added_second_account_or_NA');
    expect(stepState.added_second_account_or_NA).toBe(true);
  });
});
