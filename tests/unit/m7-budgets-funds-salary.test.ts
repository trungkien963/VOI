import { describe, expect, it } from 'vitest';
import { DEFAULT_STARTER_ACCOUNTS, DEFAULT_STARTER_POCKETS } from '../../src/db/dexie-schema';
import {
  computeSalaryMonthlyStatus,
  computeThreeTierFinancialOverview,
  makeFundBudgetKey,
} from '../../src/domain/budgets/budget-calculator';
import {
  DEFAULT_SYSTEM_CATEGORIES,
  SYSTEM_CATEGORY_IDS,
} from '../../src/domain/categories/default-categories';
import { computeNetWorth } from '../../src/domain/ledger/balance-calculator';
import { buildTransactionBundle } from '../../src/domain/ledger/strategies';
import type { Account, Budget, Pocket, RecurringRule } from '../../src/domain/types/entities';

describe('budget-calculator & 3-tier financial correlation', () => {
  const baseAccounts: Account[] = [
    {
      ...DEFAULT_STARTER_ACCOUNTS[0]!,
      id: 'acc-bank',
      type: 'bank',
      cached_balance_minor: 16_000_000,
    },
    {
      ...DEFAULT_STARTER_ACCOUNTS[0]!,
      id: 'acc-fund-emergency',
      name: 'Quỹ Dự Phòng Khẩn Cấp',
      type: 'savings',
      cached_balance_minor: 24_000_000,
    },
  ];

  const basePockets: Pocket[] = [
    {
      ...DEFAULT_STARTER_POCKETS[0]!,
      id: 'pocket-bank',
      account_id: 'acc-bank',
      type: 'spendable',
      cached_balance_minor: 16_000_000,
    },
    {
      ...DEFAULT_STARTER_POCKETS[0]!,
      id: 'pocket-fund-emergency',
      account_id: 'acc-fund-emergency',
      name: 'Quỹ Dự Phòng Khẩn Cấp (VND)',
      type: 'goal',
      target_amount_minor: 50_000_000,
      cached_balance_minor: 24_000_000,
    },
  ];

  it('computes 2-tier Fund surplus (>100%), category caps (warning/exceeded), and daily safe-to-spend accurately', () => {
    const salaryBundle = buildTransactionBundle({
      transactionId: 'tx-sal-1',
      userId: 'local-user',
      type: 'income',
      amountMinor: 20_000_000,
      currency: 'VND',
      sourceAccountId: 'acc-bank',
      sourcePocketId: 'pocket-bank',
      categoryId: SYSTEM_CATEGORY_IDS.salary,
      occurredAt: '2026-11-05T09:00:00.000Z',
    });

    const foodBundle = buildTransactionBundle({
      transactionId: 'tx-food-1',
      userId: 'local-user',
      type: 'expense',
      amountMinor: 2_700_000, // 90% of 3,000,000 cap -> warning
      currency: 'VND',
      sourceAccountId: 'acc-bank',
      sourcePocketId: 'pocket-bank',
      categoryId: SYSTEM_CATEGORY_IDS.foodDining,
      occurredAt: '2026-11-08T12:00:00.000Z',
    });

    const shoppingCatId = '10000000-0000-4000-8000-000000000004';
    const shoppingBundle = buildTransactionBundle({
      transactionId: 'tx-shop-1',
      userId: 'local-user',
      type: 'expense',
      amountMinor: 1_800_000, // 120% of 1,500,000 cap -> exceeded (+300k)
      currency: 'VND',
      sourceAccountId: 'acc-bank',
      sourcePocketId: 'pocket-bank',
      categoryId: shoppingCatId,
      occurredAt: '2026-11-09T15:00:00.000Z',
    });

    // Over-contribute 4,000,000 to Emergency Fund (monthly target is 3,000,000 -> 133% surplus!)
    const fundTransferBundle = buildTransactionBundle({
      transactionId: 'tx-fund-1',
      userId: 'local-user',
      type: 'transfer',
      amountMinor: 4_000_000,
      currency: 'VND',
      sourceAccountId: 'acc-bank',
      sourcePocketId: 'pocket-bank',
      destinationAccountId: 'acc-fund-emergency',
      destinationPocketId: 'pocket-fund-emergency',
      occurredAt: '2026-11-10T10:00:00.000Z',
    });

    const budgets: Budget[] = [
      {
        id: 'b-food',
        user_id: 'local-user',
        month_key: '2026-11',
        category_id: SYSTEM_CATEGORY_IDS.foodDining,
        limit_minor: 3_000_000,
        rollover_enabled: true,
        rollover_minor: 0,
        alert_threshold_pct: 80,
        created_at: '2026-11-01T00:00:00.000Z',
        updated_at: '2026-11-01T00:00:00.000Z',
      },
      {
        id: 'b-shop',
        user_id: 'local-user',
        month_key: '2026-11',
        category_id: shoppingCatId,
        limit_minor: 1_500_000,
        rollover_enabled: true,
        rollover_minor: 0,
        alert_threshold_pct: 80,
        created_at: '2026-11-01T00:00:00.000Z',
        updated_at: '2026-11-01T00:00:00.000Z',
      },
      {
        id: 'b-fund',
        user_id: 'local-user',
        month_key: '2026-11',
        category_id: makeFundBudgetKey('acc-fund-emergency'),
        limit_minor: 3_000_000,
        rollover_enabled: true,
        rollover_minor: 0,
        alert_threshold_pct: 100,
        created_at: '2026-11-01T00:00:00.000Z',
        updated_at: '2026-11-01T00:00:00.000Z',
      },
    ];

    const totalNetWorthMinor = computeNetWorth({ pockets: basePockets, debts: [] });
    const overview = computeThreeTierFinancialOverview({
      accounts: baseAccounts,
      pockets: basePockets,
      categories: DEFAULT_SYSTEM_CATEGORIES,
      transactions: [
        salaryBundle.transaction,
        foodBundle.transaction,
        shoppingBundle.transaction,
        fundTransferBundle.transaction,
      ],
      lines: [
        ...salaryBundle.lines,
        ...foodBundle.lines,
        ...shoppingBundle.lines,
        ...fundTransferBundle.lines,
      ],
      budgets,
      netFriendIouMinor: 0,
      totalNetWorthMinor,
      referenceDateIso: '2026-11-10', // 21 days remaining in Nov (10..30 inclusive)
    });

    // Tier 1: Net Worth = 16M liquid + 24M fund = 40M
    expect(overview.totalNetWorthMinor).toBe(40_000_000);
    expect(overview.liquidWalletsMinor).toBe(16_000_000);
    expect(overview.savingsFundsMinor).toBe(24_000_000);

    // Tier 2: Monthly Cashflow = 20M income - 4.5M expense - 4M fund contribution = +11.5M
    expect(overview.monthlyIncomeMinor).toBe(20_000_000);
    expect(overview.monthlyOwnExpenseMinor).toBe(4_500_000);
    expect(overview.monthlyNetFundContributionMinor).toBe(4_000_000);
    expect(overview.monthlyNetCashflowMinor).toBe(11_500_000);

    // Category Caps: Shopping is exceeded (120%), Food is warning (90%)
    expect(overview.exceededCategories).toHaveLength(1);
    expect(overview.exceededCategories[0]?.category.id).toBe(shoppingCatId);
    expect(overview.exceededCategories[0]?.overAmountMinor).toBe(300_000);

    expect(overview.warningCategories).toHaveLength(1);
    expect(overview.warningCategories[0]?.category.id).toBe(SYSTEM_CATEGORY_IDS.foodDining);
    expect(overview.warningCategories[0]?.usagePct).toBe(90);
    expect(overview.warningCategories[0]?.dailySafeMinor).toBe(Math.floor(300_000 / 21));

    // Fund Progress: 4M contributed vs 3M monthly target -> 'surplus' (+1M), 24M / 50M goal (48%)
    expect(overview.funds).toHaveLength(1);
    const fund = overview.funds[0]!;
    expect(fund.monthlyStatus).toBe('surplus');
    expect(fund.monthlySurplusMinor).toBe(1_000_000);
    expect(fund.monthlyPct).toBe(133);
    expect(fund.accumulatedBalanceMinor).toBe(24_000_000);
    expect(fund.goalPct).toBe(48);
  });

  it('rolls over prior month salary suggestion when current month is unconfirmed', () => {
    const lastMonthSalary = buildTransactionBundle({
      transactionId: 'tx-sal-oct',
      userId: 'local-user',
      type: 'income',
      amountMinor: 22_500_000,
      currency: 'VND',
      sourceAccountId: 'acc-bank',
      sourcePocketId: 'pocket-bank',
      categoryId: SYSTEM_CATEGORY_IDS.salary,
      occurredAt: '2026-10-05T09:00:00.000Z',
    });

    const rules: RecurringRule[] = [];
    const status = computeSalaryMonthlyStatus({
      recurringRules: rules,
      transactions: [lastMonthSalary.transaction],
      accounts: baseAccounts,
      pockets: basePockets,
      referenceDateIso: '2026-11-10',
    });

    expect(status.isConfirmedThisMonth).toBe(false);
    expect(status.lastMonthSalaryMinor).toBe(22_500_000);
    expect(status.suggestedAmountMinor).toBe(22_500_000);
  });
});

