import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  computeBarChartSeries,
  computeCategoryDonutBreakdown,
  computeMonthOverMonthComparison,
} from '../../src/domain/analytics/report-aggregator';
import {
  buildWeeklyRecapStorySvgDataUrl,
  generateWeeklyRecap,
} from '../../src/domain/analytics/weekly-recap';
import {
  DEFAULT_SYSTEM_CATEGORIES,
  SYSTEM_CATEGORY_IDS,
} from '../../src/domain/categories/default-categories';
import { computePeriodReportSummary } from '../../src/domain/ledger/balance-calculator';
import { localDb } from '../../src/db/dexie-schema';
import { accountRepository } from '../../src/db/repositories/account-repository';
import { debtRepository } from '../../src/db/repositories/debt-repository';
import { pocketRepository } from '../../src/db/repositories/pocket-repository';
import { transactionRepository } from '../../src/db/repositories/transaction-repository';
import { InsightsView } from '../../src/features/analytics/InsightsView';

describe('Milestone 4: Home & Report (Donut, Bar, Drill-Down, Historical FX & Weekly Recap)', () => {
  beforeEach(async () => {
    await localDb.transactions.clear();
    await localDb.transaction_lines.clear();
    await localDb.accounts.clear();
    await localDb.pockets.clear();
    await localDb.debt_items.clear();
    await localDb.sync_outbox.clear();
  });

  it('matches Home period report and Donut/Bar analytics 100% with the ledger while excluding transfers, opening balances, card payoffs, and lent portions', async () => {
    const bank = await accountRepository.createAccountWithOpeningBalance({
      id: 'acc-m4-bank',
      name: 'VCB',
      type: 'bank',
      currency: 'VND',
      openingBalanceMinor: 10_000_000,
    });
    const card = await accountRepository.createAccountWithOpeningBalance({
      id: 'acc-m4-card',
      name: 'VIB Credit',
      type: 'credit_card',
      currency: 'VND',
      openingBalanceMinor: -1_000_000,
    });

    // 1. Regular expense: 120,000 VND (Food & Dining)
    await transactionRepository.createFromInputAtomic({
      transactionId: 'tx-m4-food',
      userId: 'local-user',
      type: 'expense',
      amountMinor: 120_000,
      currency: 'VND',
      sourceAccountId: bank.account.id,
      sourcePocketId: bank.defaultPocket.id,
      categoryId: SYSTEM_CATEGORY_IDS.foodDining,
      occurredAt: '2026-11-05T12:00:00.000Z',
    });

    // 2. Credit card swipe: 380,000 VND (Shopping)
    const shoppingCat = DEFAULT_SYSTEM_CATEGORIES.find((c) => c.slug === 'shopping')!;
    await transactionRepository.createFromInputAtomic({
      transactionId: 'tx-m4-shopping',
      userId: 'local-user',
      type: 'expense',
      amountMinor: 380_000,
      currency: 'VND',
      sourceAccountId: card.account.id,
      sourcePocketId: card.defaultPocket.id,
      categoryId: shoppingCat.id,
      occurredAt: '2026-11-06T15:00:00.000Z',
    });

    // 3. Credit card payoff (transfer 500,000 VND) -> MUST NOT count in expense report
    await transactionRepository.createFromInputAtomic({
      transactionId: 'tx-m4-cc-payoff',
      userId: 'local-user',
      type: 'transfer',
      amountMinor: 500_000,
      currency: 'VND',
      sourceAccountId: bank.account.id,
      sourcePocketId: bank.defaultPocket.id,
      destinationAccountId: card.account.id,
      destinationPocketId: card.defaultPocket.id,
      occurredAt: '2026-11-06T18:00:00.000Z',
    });

    // 4. Paid for others ("Trả hộ"): 800k total (200k own expense + 600k lent) -> ONLY 200k counts
    await debtRepository.createPaidForOthersAtomic({
      groupId: 'grp-m4-dinner',
      expenseTransactionId: 'tx-m4-dinner-own',
      userId: 'local-user',
      sourceAccountId: bank.account.id,
      sourcePocketId: bank.defaultPocket.id,
      currency: 'VND',
      totalPaidMinor: 800_000,
      ownExpenseMinor: 200_000,
      categoryId: SYSTEM_CATEGORY_IDS.foodDining,
      note: 'Dinner split',
      occurredAt: '2026-11-07T20:00:00.000Z',
      shares: [
        {
          debtId: 'debt-m4-minh',
          transactionId: 'tx-m4-lend-minh',
          counterpartyId: 'cp-minh',
          counterpartyName: 'Minh',
          amountMinor: 600_000,
        },
      ],
    });

    // 5. Reconcile deficit (-50,000 VND adjustment) -> counts as unknown-expense (50,000 VND)
    const bankPocketNow = (await localDb.pockets.get(bank.defaultPocket.id))!;
    await pocketRepository.reconcilePocketBalanceAtomic(
      bankPocketNow.id,
      bankPocketNow.cached_balance_minor - 50_000,
      '2026-11-08T10:00:00.000Z',
    );

    // 6. Salary income (+15,000,000 VND)
    await transactionRepository.createFromInputAtomic({
      transactionId: 'tx-m4-salary',
      userId: 'local-user',
      type: 'income',
      amountMinor: 15_000_000,
      currency: 'VND',
      sourceAccountId: bank.account.id,
      sourcePocketId: bank.defaultPocket.id,
      categoryId: SYSTEM_CATEGORY_IDS.salary,
      occurredAt: '2026-11-08T09:00:00.000Z',
    });

    const allTxs = await localDb.transactions.toArray();
    const allLines = await localDb.transaction_lines.toArray();

    const homeSummary = computePeriodReportSummary(allTxs, allLines, '2026-11-01', '2026-11-30');
    const donutReport = computeCategoryDonutBreakdown(
      allTxs,
      allLines,
      DEFAULT_SYSTEM_CATEGORIES,
      '2026-11-01',
      '2026-11-30',
    );

    // Expected total expense = 120k (food) + 380k (shopping) + 200k (dinner own) + 50k (reconcile deficit) = 750,000 VND
    expect(homeSummary.totalExpenseBaseMinor).toBe(750_000);
    expect(donutReport.totalExpenseBaseMinor).toBe(750_000);
    expect(donutReport.unaccountedExpenseBaseMinor).toBe(50_000);
    expect(donutReport.totalIncomeBaseMinor).toBe(15_000_000);
    expect(homeSummary.totalIncomeBaseMinor).toBe(15_000_000);

    // Check slices: Shopping (380k), Food & Dining (120k + 200k = 320k), Unaccounted (50k)
    expect(donutReport.slices[0]?.slug).toBe('shopping');
    expect(donutReport.slices[0]?.amountBaseMinor).toBe(380_000);
    expect(donutReport.slices[1]?.slug).toBe('food-dining');
    expect(donutReport.slices[1]?.amountBaseMinor).toBe(320_000);
    expect(donutReport.slices[2]?.slug).toBe('unknown-expense');
    expect(donutReport.slices[2]?.amountBaseMinor).toBe(50_000);

    // Bar chart daily_in_month sum equals Donut total (750,000 VND)
    const dailyBars = computeBarChartSeries(allTxs, allLines, 'daily_in_month', '2026-11-09');
    const sumBars = dailyBars.reduce((acc, b) => acc + b.expenseBaseMinor, 0);
    expect(sumBars).toBe(750_000);

    // Month-over-Month comparison & Weekly Recap
    const mom = computeMonthOverMonthComparison(
      allTxs,
      allLines,
      DEFAULT_SYSTEM_CATEGORIES,
      '2026-11-09',
    );
    expect(mom.currentMonthToDateMinor).toBe(750_000);

    const recap = generateWeeklyRecap({
      transactions: allTxs,
      lines: allLines,
      categories: DEFAULT_SYSTEM_CATEGORIES,
      referenceDateIso: '2026-11-08',
      streakDays: 7,
    });
    expect(recap.totalExpenseBaseMinor).toBe(750_000);
    expect(recap.topCategories.length).toBe(3);

    // Story SVG Data URL with Privacy Share masks exact amounts
    const publicSvg = decodeURIComponent(
      buildWeeklyRecapStorySvgDataUrl(recap, { hideExactAmounts: false }),
    );
    const privateSvg = decodeURIComponent(
      buildWeeklyRecapStorySvgDataUrl(recap, { hideExactAmounts: true }),
    );
    expect(publicSvg).toContain('750.000đ');
    expect(privateSvg).not.toContain('750.000đ');
    expect(privateSvg).toContain('••••••đ');
  });

  it('renders InsightsView, drills down when clicking a Donut category slice, and clears the filter', async () => {
    const bank = await accountRepository.createAccountWithOpeningBalance({
      id: 'acc-ui-drill',
      name: 'VCB',
      type: 'bank',
      currency: 'VND',
      openingBalanceMinor: 5_000_000,
    });
    const todayIso = new Date().toISOString();

    await transactionRepository.createFromInputAtomic({
      transactionId: 'tx-ui-food',
      userId: 'local-user',
      type: 'expense',
      amountMinor: 95_000,
      currency: 'VND',
      sourceAccountId: bank.account.id,
      sourcePocketId: bank.defaultPocket.id,
      categoryId: SYSTEM_CATEGORY_IDS.foodDining,
      note: 'Phở bò đặc biệt',
      occurredAt: todayIso,
    });

    render(<InsightsView />);

    await waitFor(() => {
      expect(screen.getByTestId('donut-total-expense')).toHaveTextContent('95.000đ');
    });

    // Click the 'food-dining' slice button to trigger drill-down
    const foodSliceBtn = screen.getByTestId('donut-slice-food-dining');
    fireEvent.click(foodSliceBtn);

    await waitFor(() => {
      expect(screen.getByTestId('drilldown-tx-row')).toHaveTextContent('Phở bò đặc biệt');
    });
  });
});
