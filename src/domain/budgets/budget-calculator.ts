import { SYSTEM_CATEGORY_IDS } from '../categories/default-categories';
import { resolveEffectiveCategoryId } from '../quick-parser/parser';
import type {
  Account,
  Budget,
  Category,
  Pocket,
  RecurringRule,
  Transaction,
  TransactionLine,
} from '../types/entities';

export const FUND_BUDGET_PREFIX = 'FUND:';

export function makeFundBudgetKey(accountId: string): string {
  return `${FUND_BUDGET_PREFIX}${accountId}`;
}

export function isFundBudgetKey(categoryId: string | null): boolean {
  return typeof categoryId === 'string' && categoryId.startsWith(FUND_BUDGET_PREFIX);
}

export function extractFundAccountId(categoryId: string | null): string | null {
  if (!isFundBudgetKey(categoryId) || !categoryId) return null;
  return categoryId.slice(FUND_BUDGET_PREFIX.length);
}

export type ExpenseCapStatus = 'safe' | 'warning' | 'exceeded';
export type FundProgressStatus = 'on_track' | 'completed' | 'surplus';

export interface CategoryBudgetProgress {
  budgetId: string | null;
  category: Category;
  limitMinor: number;
  spentMinor: number;
  remainingMinor: number;
  overAmountMinor: number;
  usagePct: number;
  dailySafeMinor: number;
  alertThresholdPct: number;
  status: ExpenseCapStatus;
}

export interface FundProgressItem {
  account: Account;
  pocket: Pocket | null;
  budgetId: string | null;
  /** Tier 1: Monthly Contribution Flow */
  monthlyTargetMinor: number;
  monthlyContributedMinor: number;
  monthlyWithdrawnMinor: number;
  monthlyNetContributedMinor: number;
  monthlySurplusMinor: number;
  monthlyPct: number;
  monthlyStatus: FundProgressStatus;
  /** Tier 2: Accumulated Fund Pot / Goal Balance */
  accumulatedBalanceMinor: number;
  goalTargetMinor: number | null;
  goalPct: number | null;
}

export interface ThreeTierFinancialOverview {
  monthKey: string;
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;

  /** Tier 1: Net Worth Components */
  liquidWalletsMinor: number;
  savingsFundsMinor: number;
  creditCardDebtMinor: number;
  netFriendIouMinor: number;
  totalNetWorthMinor: number;

  /** Tier 2: Monthly Cashflow Components */
  monthlyIncomeMinor: number;
  monthlyOwnExpenseMinor: number;
  monthlyNetFundContributionMinor: number;
  monthlyNetCashflowMinor: number;

  /** Tier 3: Daily Safe-to-Spend & Expense Caps */
  totalExpenseCapMinor: number;
  hasExplicitExpenseCap: boolean;
  remainingExpenseBudgetMinor: number;
  dailyBudgetSafeMinor: number;
  dailyLiquidSafeMinor: number;
  effectiveDailySafeMinor: number;
  isLiquidConstrained: boolean;

  categoryBudgets: CategoryBudgetProgress[];
  exceededCategories: CategoryBudgetProgress[];
  warningCategories: CategoryBudgetProgress[];
  funds: FundProgressItem[];
  totalFundSurplusMinor: number;
}

export interface SalaryMonthlyStatus {
  salaryRule: RecurringRule | null;
  confirmedThisMonthMinor: number;
  isConfirmedThisMonth: boolean;
  suggestedAmountMinor: number;
  lastMonthSalaryMinor: number;
  paydayDayOfMonth: number;
  defaultAccountId: string | null;
  defaultPocketId: string | null;
}

export function getMonthDaysInfo(referenceDateIso: string): {
  monthKey: string;
  monthStartIso: string;
  monthEndIso: string;
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;
} {
  const cleanIso = referenceDateIso.slice(0, 10);
  const parts = cleanIso.split('-').map(Number);
  const year = parts[0] || 2026;
  const month = parts[1] || 1;
  const day = parts[2] || 1;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clampedDay = Math.min(Math.max(1, day), daysInMonth);
  const daysElapsed = clampedDay;
  const daysRemaining = Math.max(1, daysInMonth - clampedDay + 1);
  const monthKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const monthStartIso = `${monthKey}-01`;
  const monthEndIso = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;

  return {
    monthKey,
    monthStartIso,
    monthEndIso,
    daysInMonth,
    daysElapsed,
    daysRemaining,
  };
}

/**
 * Resolves the effective budget per `category_id` for `monthKey`.
 * If a budget isn't explicitly created for `monthKey` yet, automatically inherits the most recent
 * prior month's budget for that `category_id` so the user doesn't have to re-configure caps every month.
 */
export function resolveEffectiveBudgetsForMonth(
  allBudgets: ReadonlyArray<Budget>,
  monthKey: string,
): Map<string, Budget> {
  const sorted = [...allBudgets]
    .filter((b) => b.limit_minor > 0 && b.month_key <= monthKey)
    .sort(
      (a, b) => a.month_key.localeCompare(b.month_key) || a.updated_at.localeCompare(b.updated_at),
    );

  const map = new Map<string, Budget>();
  for (const b of sorted) {
    const key = b.category_id ?? '__OVERALL__';
    map.set(key, b);
  }
  return map;
}

/**
 * Computes Monthly Salary status: checks active salary RecurringRule and past salary transactions
 * so the user can auto-rollover and confirm their monthly salary in 1 tap.
 */
export function computeSalaryMonthlyStatus(params: {
  recurringRules: ReadonlyArray<RecurringRule>;
  transactions: ReadonlyArray<Transaction>;
  accounts: ReadonlyArray<Account>;
  pockets: ReadonlyArray<Pocket>;
  referenceDateIso: string;
}): SalaryMonthlyStatus {
  const { recurringRules, transactions, accounts, pockets, referenceDateIso } = params;
  const { monthKey } = getMonthDaysInfo(referenceDateIso);

  const activeSalaryRules = recurringRules.filter(
    (r) =>
      r.is_active &&
      r.template_type === 'income' &&
      (r.category_id === SYSTEM_CATEGORY_IDS.salary ||
        r.title.toLowerCase().includes('lương') ||
        r.title.toLowerCase().includes('salary')),
  );
  const salaryRule = activeSalaryRules[0] ?? null;

  const salaryTxs = transactions
    .filter(
      (tx) =>
        tx.voided_at === null &&
        tx.status !== 'void' &&
        tx.type === 'income' &&
        (resolveEffectiveCategoryId(tx) === SYSTEM_CATEGORY_IDS.salary ||
          (salaryRule && tx.recurring_rule_id === salaryRule.id)),
    )
    .sort((a, b) => b.txn_date.localeCompare(a.txn_date));

  const thisMonthSalaryTxs = salaryTxs.filter((tx) => tx.txn_date.startsWith(monthKey));
  const confirmedThisMonthMinor = thisMonthSalaryTxs.reduce(
    (sum, tx) => sum + Math.abs(tx.amount_minor),
    0,
  );

  const priorSalaryTx = salaryTxs.find((tx) => !tx.txn_date.startsWith(monthKey)) ?? null;
  const lastMonthSalaryMinor = priorSalaryTx ? Math.abs(priorSalaryTx.amount_minor) : 0;

  const suggestedAmountMinor =
    salaryRule?.amount_minor ??
    (lastMonthSalaryMinor > 0 ? lastMonthSalaryMinor : confirmedThisMonthMinor);

  const defaultBank =
    accounts.find((a) => a.archived_at === null && a.type === 'bank') ??
    accounts.find((a) => a.archived_at === null) ??
    null;
  const defaultAccountId = salaryRule?.account_id ?? defaultBank?.id ?? null;
  const defaultPocket =
    (salaryRule?.pocket_id ? pockets.find((p) => p.id === salaryRule.pocket_id) : null) ??
    (defaultAccountId
      ? pockets.find(
          (p) =>
            p.account_id === defaultAccountId &&
            p.archived_at === null &&
            (p.currency ?? 'VND') === 'VND',
        )
      : null) ??
    pockets.find((p) => p.archived_at === null) ??
    null;

  return {
    salaryRule,
    confirmedThisMonthMinor,
    isConfirmedThisMonth: confirmedThisMonthMinor > 0,
    suggestedAmountMinor,
    lastMonthSalaryMinor,
    paydayDayOfMonth: salaryRule?.day_of_month ?? 5,
    defaultAccountId,
    defaultPocketId: defaultPocket?.id ?? null,
  };
}

/**
 * Computes the complete 3-Tier Financial Overview:
 * - Tier 1: Total Net Worth (Liquid Wallets + Savings Funds + Friend IOUs - Credit Card Debt)
 * - Tier 2: Monthly Cashflow (Income - Own Share Expenses - Net Fund Contributions)
 * - Tier 3: Daily Safe-to-Spend (`? tiền / ngày`), Category Expense Caps, and 2-Tier Fund Progress
 */
export function computeThreeTierFinancialOverview(params: {
  accounts: ReadonlyArray<Account>;
  pockets: ReadonlyArray<Pocket>;
  categories: ReadonlyArray<Category>;
  transactions: ReadonlyArray<Transaction>;
  lines: ReadonlyArray<TransactionLine>;
  budgets: ReadonlyArray<Budget>;
  netFriendIouMinor: number;
  totalNetWorthMinor: number;
  referenceDateIso: string;
}): ThreeTierFinancialOverview {
  const {
    accounts,
    pockets,
    categories,
    transactions,
    lines,
    budgets,
    netFriendIouMinor,
    totalNetWorthMinor,
    referenceDateIso,
  } = params;

  const { monthKey, monthStartIso, monthEndIso, daysInMonth, daysElapsed, daysRemaining } =
    getMonthDaysInfo(referenceDateIso);

  const activeAccounts = accounts.filter((a) => a.archived_at === null);
  const liquidAccounts = activeAccounts.filter(
    (a) => a.type === 'bank' || a.type === 'cash' || a.type === 'e_wallet',
  );
  const fundAccounts = activeAccounts.filter((a) => a.type === 'savings');
  const creditAccounts = activeAccounts.filter((a) => a.type === 'credit_card');

  const liquidWalletsMinor = liquidAccounts.reduce((s, a) => s + a.cached_balance_minor, 0);
  const savingsFundsMinor = fundAccounts.reduce((s, a) => s + a.cached_balance_minor, 0);
  const creditCardDebtMinor = creditAccounts.reduce(
    (s, a) => s + Math.max(0, -a.cached_balance_minor),
    0,
  );

  // Map parent category for child categories so spending on "Eating out" rolls up into "Food & Dining"
  // if the budget is set on "Food & Dining" (or on the specific child if budgeted directly).
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const effectiveBudgets = resolveEffectiveBudgetsForMonth(budgets, monthKey);

  const validTxs = transactions.filter(
    (tx) =>
      tx.voided_at === null &&
      tx.status !== 'void' &&
      tx.txn_date >= monthStartIso &&
      tx.txn_date <= monthEndIso,
  );
  const validTxById = new Map(validTxs.map((tx) => [tx.id, tx]));

  const linesByTxId = new Map<string, TransactionLine[]>();
  for (const l of lines) {
    if (l.deleted_at) continue;
    if (!validTxById.has(l.transaction_id)) continue;
    const arr = linesByTxId.get(l.transaction_id) ?? [];
    arr.push(l);
    linesByTxId.set(l.transaction_id, arr);
  }

  let monthlyIncomeMinor = 0;
  let monthlyOwnExpenseMinor = 0;
  const directCategorySpend = new Map<string, number>();
  const parentRolledUpSpend = new Map<string, number>();

  for (const tx of validTxs) {
    if (tx.type === 'income' || tx.type === 'credit_card_refund') {
      monthlyIncomeMinor += Math.abs(tx.amount_minor);
    } else if (tx.type === 'expense' || tx.type === 'credit_card_spend') {
      const amt = Math.abs(tx.amount_minor);
      monthlyOwnExpenseMinor += amt;
      const effCatId = resolveEffectiveCategoryId(tx);
      if (effCatId) {
        directCategorySpend.set(effCatId, (directCategorySpend.get(effCatId) ?? 0) + amt);
        const catObj = categoryById.get(effCatId);
        const rootId = catObj?.parent_id ?? effCatId;
        parentRolledUpSpend.set(rootId, (parentRolledUpSpend.get(rootId) ?? 0) + amt);
      }
    }
  }

  // Compute Fund Progress (Tier 1: Monthly Flow & Tier 2: Accumulated Balance)
  const funds: FundProgressItem[] = fundAccounts.map((fundAcc) => {
    const fundPocket =
      pockets.find((p) => p.account_id === fundAcc.id && p.archived_at === null) ?? null;
    const fundBudget = effectiveBudgets.get(makeFundBudgetKey(fundAcc.id)) ?? null;
    const monthlyTargetMinor = fundBudget?.limit_minor ?? 0;

    let monthlyContributedMinor = 0;
    let monthlyWithdrawnMinor = 0;

    for (const [txId, txLines] of linesByTxId.entries()) {
      const tx = validTxById.get(txId);
      if (!tx) continue;
      // Exclude opening_balance so setting initial fund balance isn't mistaken for monthly cashflow contribution
      if (tx.type === 'opening_balance') continue;
      for (const l of txLines) {
        if (l.account_id !== fundAcc.id) continue;
        if (l.signed_amount_minor > 0) {
          monthlyContributedMinor += l.signed_amount_minor;
        } else if (l.signed_amount_minor < 0) {
          monthlyWithdrawnMinor += Math.abs(l.signed_amount_minor);
        }
      }
    }

    const monthlyNetContributedMinor = Math.max(0, monthlyContributedMinor - monthlyWithdrawnMinor);
    const monthlySurplusMinor =
      monthlyTargetMinor > 0 ? Math.max(0, monthlyNetContributedMinor - monthlyTargetMinor) : 0;
    const monthlyPct =
      monthlyTargetMinor > 0
        ? Math.round((monthlyNetContributedMinor / monthlyTargetMinor) * 100)
        : monthlyNetContributedMinor > 0
          ? 100
          : 0;

    const monthlyStatus: FundProgressStatus =
      monthlyTargetMinor > 0 && monthlyNetContributedMinor > monthlyTargetMinor
        ? 'surplus'
        : monthlyTargetMinor > 0 && monthlyNetContributedMinor >= monthlyTargetMinor
          ? 'completed'
          : 'on_track';

    const accumulatedBalanceMinor = Math.max(0, fundAcc.cached_balance_minor);
    const goalTargetMinor = fundPocket?.target_amount_minor ?? null;
    const goalPct =
      goalTargetMinor && goalTargetMinor > 0
        ? Math.min(999, Math.round((accumulatedBalanceMinor / goalTargetMinor) * 100))
        : null;

    return {
      account: fundAcc,
      pocket: fundPocket,
      budgetId: fundBudget?.id ?? null,
      monthlyTargetMinor,
      monthlyContributedMinor,
      monthlyWithdrawnMinor,
      monthlyNetContributedMinor,
      monthlySurplusMinor,
      monthlyPct,
      monthlyStatus,
      accumulatedBalanceMinor,
      goalTargetMinor,
      goalPct,
    };
  });

  const monthlyNetFundContributionMinor = funds.reduce(
    (s, f) => s + f.monthlyNetContributedMinor,
    0,
  );
  const totalFundSurplusMinor = funds.reduce((s, f) => s + f.monthlySurplusMinor, 0);

  // Compute Category Expense Budgets
  const categoryBudgets: CategoryBudgetProgress[] = [];
  for (const [key, b] of effectiveBudgets.entries()) {
    if (key === '__OVERALL__' || isFundBudgetKey(key)) continue;
    const cat = categoryById.get(key);
    if (!cat || cat.kind !== 'expense') continue;

    const spentMinor =
      cat.parent_id === null
        ? (parentRolledUpSpend.get(cat.id) ?? 0)
        : (directCategorySpend.get(cat.id) ?? 0);
    const limitMinor = b.limit_minor;
    const remainingMinor = Math.max(0, limitMinor - spentMinor);
    const overAmountMinor = Math.max(0, spentMinor - limitMinor);
    const usagePct = limitMinor > 0 ? Math.round((spentMinor / limitMinor) * 100) : 0;
    const dailySafeMinor = Math.floor(remainingMinor / daysRemaining);
    const threshold = b.alert_threshold_pct || 80;

    const status: ExpenseCapStatus =
      spentMinor >= limitMinor ? 'exceeded' : usagePct >= threshold ? 'warning' : 'safe';

    categoryBudgets.push({
      budgetId: b.id,
      category: cat,
      limitMinor,
      spentMinor,
      remainingMinor,
      overAmountMinor,
      usagePct,
      dailySafeMinor,
      alertThresholdPct: threshold,
      status,
    });
  }

  categoryBudgets.sort((a, b) => b.usagePct - a.usagePct || b.spentMinor - a.spentMinor);

  const overallBudgetObj = effectiveBudgets.get('__OVERALL__') ?? null;
  const sumCategoryCapsMinor = categoryBudgets.reduce((s, c) => s + c.limitMinor, 0);
  const hasExplicitExpenseCap = Boolean(overallBudgetObj) || sumCategoryCapsMinor > 0;

  const totalExpenseCapMinor = overallBudgetObj
    ? Math.max(overallBudgetObj.limit_minor, sumCategoryCapsMinor)
    : sumCategoryCapsMinor > 0
      ? sumCategoryCapsMinor
      : monthlyIncomeMinor > 0
        ? Math.max(0, monthlyIncomeMinor - monthlyNetFundContributionMinor)
        : 0;

  const remainingExpenseBudgetMinor = Math.max(0, totalExpenseCapMinor - monthlyOwnExpenseMinor);
  const dailyBudgetSafeMinor =
    totalExpenseCapMinor > 0 ? Math.floor(remainingExpenseBudgetMinor / daysRemaining) : 0;

  const positiveLiquidMinor = Math.max(0, liquidWalletsMinor);
  const dailyLiquidSafeMinor = Math.floor(positiveLiquidMinor / daysRemaining);

  const isLiquidConstrained =
    hasExplicitExpenseCap &&
    liquidWalletsMinor > 0 &&
    liquidWalletsMinor < remainingExpenseBudgetMinor;

  const effectiveDailySafeMinor =
    totalExpenseCapMinor > 0
      ? isLiquidConstrained
        ? Math.min(dailyBudgetSafeMinor, dailyLiquidSafeMinor)
        : dailyBudgetSafeMinor
      : dailyLiquidSafeMinor;

  const monthlyNetCashflowMinor =
    monthlyIncomeMinor - monthlyOwnExpenseMinor - monthlyNetFundContributionMinor;

  return {
    monthKey,
    daysInMonth,
    daysElapsed,
    daysRemaining,
    liquidWalletsMinor,
    savingsFundsMinor,
    creditCardDebtMinor,
    netFriendIouMinor,
    totalNetWorthMinor,
    monthlyIncomeMinor,
    monthlyOwnExpenseMinor,
    monthlyNetFundContributionMinor,
    monthlyNetCashflowMinor,
    totalExpenseCapMinor,
    hasExplicitExpenseCap,
    remainingExpenseBudgetMinor,
    dailyBudgetSafeMinor,
    dailyLiquidSafeMinor,
    effectiveDailySafeMinor,
    isLiquidConstrained,
    categoryBudgets,
    exceededCategories: categoryBudgets.filter((c) => c.status === 'exceeded'),
    warningCategories: categoryBudgets.filter((c) => c.status === 'warning'),
    funds,
    totalFundSurplusMinor,
  };
}
