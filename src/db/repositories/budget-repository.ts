import type { Table } from 'dexie';
import { makeFundBudgetKey } from '../../domain/budgets/budget-calculator';
import { SYSTEM_CATEGORY_IDS } from '../../domain/categories/default-categories';
import { clampDayOfMonth, formatIsoDateUtc } from '../../domain/ledger/credit-card-calculator';
import { computeNextRunDateAfter } from '../../domain/ledger/recurring-calculator';
import { getLedgerStrategy } from '../../domain/ledger/strategies';
import type { Account, Budget, Pocket, RecurringRule } from '../../domain/types/entities';
import { accountRepository } from './account-repository';
import { BaseRepository } from './base-repository';
import { onboardingRepository } from './onboarding-repository';
import { recurringRepository } from './recurring-repository';
import { transactionRepository } from './transaction-repository';

export interface UpsertBudgetInput {
  monthKey: string;
  categoryId: string | null;
  limitMinor: number;
  alertThresholdPct?: number;
}

export interface CreateFundInput {
  name: string;
  monthlyContributionMinor: number;
  goalTargetMinor: number | null;
  initialBalanceMinor?: number;
  monthKey: string;
}

export interface FundTransferInput {
  fundAccountId: string;
  liquidAccountId: string;
  amountMinor: number;
  direction: 'contribute' | 'withdraw';
  dateIso?: string;
  note?: string;
}

export interface SetupOrConfirmSalaryInput {
  amountMinor: number;
  paydayDayOfMonth: number;
  accountId: string;
  pocketId: string | null;
  referenceDateIso: string;
  confirmForCurrentMonth: boolean;
  title?: string;
}

export class BudgetRepository extends BaseRepository<Budget> {
  protected readonly tableName = 'budgets';

  protected get table(): Table<Budget, string> {
    return this.db.budgets;
  }

  public async upsertMonthlyBudgetAtomic(input: UpsertBudgetInput): Promise<Budget> {
    const nowIso = new Date().toISOString();
    const limitMinor = Math.max(0, Math.trunc(input.limitMinor));
    const all = await this.db.budgets.toArray();
    const existing = all.find(
      (b) => b.month_key === input.monthKey && b.category_id === input.categoryId,
    );

    const budget: Budget = {
      id: existing?.id ?? `bgt-${input.monthKey}-${input.categoryId ?? 'overall'}-${Date.now()}`,
      user_id: existing?.user_id ?? 'local-user',
      month_key: input.monthKey,
      category_id: input.categoryId,
      limit_minor: limitMinor,
      rollover_enabled: true,
      rollover_minor: existing?.rollover_minor ?? 0,
      alert_threshold_pct: input.alertThresholdPct ?? existing?.alert_threshold_pct ?? 80,
      created_at: existing?.created_at ?? nowIso,
      updated_at: nowIso,
    };

    await this.upsertAtomic(budget);
    await onboardingRepository.markStepCompleted('created_first_budget_or_goal');
    return budget;
  }

  public async removeCategoryBudgetAtomic(categoryId: string | null): Promise<void> {
    const all = await this.db.budgets.toArray();
    const matching = all.filter((b) => b.category_id === categoryId);
    for (const item of matching) {
      await this.db.budgets.delete(item.id);
    }
  }

  /**
   * 1-Tap Smart Preset: Populates balanced monthly caps for core categories
   * (Food & Dining, Housing & Bills, Transport, Shopping, Lifestyle & Social).
   */
  public async applySmartPresetCapsAtomic(
    monthKey: string,
    baseMonthlyIncomeMinor = 15_000_000,
  ): Promise<void> {
    const income = baseMonthlyIncomeMinor > 0 ? baseMonthlyIncomeMinor : 15_000_000;
    const round100k = (val: number): number =>
      Math.max(500_000, Math.round(val / 100_000) * 100_000);

    const presets: Array<{ categoryId: string; limitMinor: number }> = [
      {
        categoryId: '10000000-0000-4000-8000-000000000001', // Ăn uống
        limitMinor: round100k(income * 0.22),
      },
      {
        categoryId: '10000000-0000-4000-8000-000000000003', // Nhà ở & Hóa đơn
        limitMinor: round100k(income * 0.25),
      },
      {
        categoryId: '10000000-0000-4000-8000-000000000002', // Di chuyển
        limitMinor: round100k(income * 0.06),
      },
      {
        categoryId: '10000000-0000-4000-8000-000000000005', // Giải trí & Xã hội
        limitMinor: round100k(income * 0.08),
      },
      {
        categoryId: '10000000-0000-4000-8000-000000000004', // Mua sắm
        limitMinor: round100k(income * 0.08),
      },
    ];

    for (const p of presets) {
      await this.upsertMonthlyBudgetAtomic({
        monthKey,
        categoryId: p.categoryId,
        limitMinor: p.limitMinor,
        alertThresholdPct: 80,
      });
    }
  }

  /**
   * Creates a Savings / Sinking Fund Account (`type: 'savings'`), sets its overall Goal target
   * on the default Pocket, and sets its Monthly Contribution target in `budgets`.
   */
  public async createFundAtomic(
    input: CreateFundInput,
  ): Promise<{ account: Account; pocket: Pocket }> {
    const { account, defaultPocket } = await accountRepository.createAccountWithOpeningBalance({
      name: input.name.trim(),
      type: 'savings',
      currency: 'VND',
      openingBalanceMinor: Math.max(0, Math.trunc(input.initialBalanceMinor ?? 0)),
      colorHex: '#10B981',
      iconName: 'arch',
    });

    const updatedPocket: Pocket = {
      ...defaultPocket,
      type: 'goal',
      target_amount_minor:
        input.goalTargetMinor && input.goalTargetMinor > 0
          ? Math.trunc(input.goalTargetMinor)
          : null,
      updated_at: new Date().toISOString(),
    };
    await this.db.pockets.put(updatedPocket);

    if (input.monthlyContributionMinor > 0) {
      await this.upsertMonthlyBudgetAtomic({
        monthKey: input.monthKey,
        categoryId: makeFundBudgetKey(account.id),
        limitMinor: input.monthlyContributionMinor,
        alertThresholdPct: 100,
      });
    }

    await onboardingRepository.markStepCompleted('created_first_budget_or_goal');
    return { account, pocket: updatedPocket };
  }

  /**
   * Updates an existing Fund's monthly contribution target and overall goal target.
   */
  public async updateFundTargetsAtomic(params: {
    fundAccountId: string;
    monthKey: string;
    monthlyContributionMinor: number;
    goalTargetMinor: number | null;
  }): Promise<void> {
    const pockets = await this.db.pockets
      .where('account_id')
      .equals(params.fundAccountId)
      .toArray();
    const defaultPocket = pockets.find((p) => p.archived_at === null) ?? pockets[0];
    if (defaultPocket) {
      await this.db.pockets.put({
        ...defaultPocket,
        type: 'goal',
        target_amount_minor:
          params.goalTargetMinor && params.goalTargetMinor > 0
            ? Math.trunc(params.goalTargetMinor)
            : null,
        updated_at: new Date().toISOString(),
      });
    }

    await this.upsertMonthlyBudgetAtomic({
      monthKey: params.monthKey,
      categoryId: makeFundBudgetKey(params.fundAccountId),
      limitMinor: Math.max(0, Math.trunc(params.monthlyContributionMinor)),
      alertThresholdPct: 100,
    });
  }

  /**
   * Contributes money from a liquid spendable wallet to a Fund, or withdraws from a Fund back to a liquid wallet.
   * Uses a real double-line `transfer` transaction so Total Net Worth remains constant while Liquid Safe-to-Spend
   * and Fund Monthly/Accumulated progress update atomically.
   */
  public async transferBetweenWalletAndFundAtomic(input: FundTransferInput): Promise<void> {
    const amountMinor = Math.abs(Math.trunc(input.amountMinor));
    if (amountMinor <= 0) return;

    const allPockets = await this.db.pockets.toArray();
    const fundPocket = allPockets.find(
      (p) =>
        p.account_id === input.fundAccountId &&
        p.archived_at === null &&
        (p.currency ?? 'VND') === 'VND',
    );
    const liquidPocket = allPockets.find(
      (p) =>
        p.account_id === input.liquidAccountId &&
        p.archived_at === null &&
        (p.currency ?? 'VND') === 'VND',
    );

    if (!fundPocket || !liquidPocket) {
      throw new Error('Matching VND pockets for Fund transfer not found');
    }

    const fundAcc = await this.db.accounts.get(input.fundAccountId);
    const isContribute = input.direction === 'contribute';
    const sourceAccountId = isContribute ? input.liquidAccountId : input.fundAccountId;
    const sourcePocketId = isContribute ? liquidPocket.id : fundPocket.id;
    const destinationAccountId = isContribute ? input.fundAccountId : input.liquidAccountId;
    const destinationPocketId = isContribute ? fundPocket.id : liquidPocket.id;

    const occurredAt = input.dateIso
      ? `${input.dateIso.slice(0, 10)}T10:00:00.000Z`
      : new Date().toISOString();

    const defaultNote = isContribute
      ? `Góp vào ${fundAcc?.name ?? 'Quỹ tiết kiệm'}`
      : `Rút từ ${fundAcc?.name ?? 'Quỹ tiết kiệm'} về ví`;

    const transferBundle = getLedgerStrategy('transfer').buildBundle({
      transactionId: `tx-fund-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: 'local-user',
      type: 'transfer',
      amountMinor,
      currency: 'VND',
      sourceAccountId,
      sourcePocketId,
      destinationAccountId,
      destinationPocketId,
      categoryId: SYSTEM_CATEGORY_IDS.internalTransfer,
      note: input.note?.trim() || defaultNote,
      occurredAt,
    });

    await transactionRepository.saveBundlesAtomic([transferBundle]);
  }

  /**
   * Sets up or updates the user's Monthly Salary rule (`template_type: 'income'`)
   * and optionally confirms/posts the salary transaction for the current month in 1 tap.
   */
  public async setupOrConfirmMonthlySalaryAtomic(
    input: SetupOrConfirmSalaryInput,
  ): Promise<RecurringRule> {
    const amountMinor = Math.abs(Math.trunc(input.amountMinor));
    const payday = Math.min(31, Math.max(1, Math.trunc(input.paydayDayOfMonth || 5)));
    const cleanRefDate = input.referenceDateIso.slice(0, 10);
    const [yearStr, monthStr] = cleanRefDate.split('-');
    const year = Number(yearStr) || 2026;
    const month = Number(monthStr) || 1;
    const clampedDayThisMonth = clampDayOfMonth(year, month, payday);
    const thisMonthRunDate = formatIsoDateUtc(year, month, clampedDayThisMonth);

    const allRules = await this.db.recurring_rules.toArray();
    const existingSalaryRule =
      allRules.find(
        (r) =>
          r.is_active &&
          r.template_type === 'income' &&
          (r.category_id === SYSTEM_CATEGORY_IDS.salary ||
            r.title.toLowerCase().includes('lương') ||
            r.title.toLowerCase().includes('salary')),
      ) ?? null;

    const nowIso = new Date().toISOString();
    let rule: RecurringRule;

    if (existingSalaryRule) {
      rule = {
        ...existingSalaryRule,
        title: input.title?.trim() || existingSalaryRule.title,
        amount_minor: amountMinor,
        day_of_month: payday,
        account_id: input.accountId,
        pocket_id: input.pocketId,
        category_id: SYSTEM_CATEGORY_IDS.salary,
        updated_at: nowIso,
      };
      await recurringRepository.upsertAtomic(rule);
    } else {
      rule = await recurringRepository.createRuleAtomic({
        title: input.title?.trim() || 'Lương hàng tháng',
        templateType: 'income',
        frequency: 'monthly',
        dayOfMonth: payday,
        nextRunDate: thisMonthRunDate,
        amountMinor,
        accountId: input.accountId,
        pocketId: input.pocketId,
        categoryId: SYSTEM_CATEGORY_IDS.salary,
        note: 'Lương hàng tháng',
      });
    }

    if (input.confirmForCurrentMonth && amountMinor > 0) {
      const nextMonthDate = computeNextRunDateAfter(thisMonthRunDate, {
        frequency: 'monthly',
        interval_count: 1,
        day_of_month: payday,
      });

      const txBundle = getLedgerStrategy('income').buildBundle({
        transactionId: `tx-salary-${year}-${String(month).padStart(2, '0')}-${Date.now()}`,
        userId: rule.user_id,
        type: 'income',
        amountMinor,
        currency: 'VND',
        sourceAccountId: input.accountId,
        sourcePocketId: input.pocketId,
        categoryId: SYSTEM_CATEGORY_IDS.salary,
        recurringRuleId: rule.id,
        source: 'recurring',
        note: `${rule.title} (${String(month).padStart(2, '0')}/${year})`,
        occurredAt: `${cleanRefDate}T09:00:00.000Z`,
      });

      await transactionRepository.saveBundlesAtomic([txBundle]);

      rule = {
        ...rule,
        last_run_date: cleanRefDate,
        next_run_date: nextMonthDate,
        occurrences_done: (rule.occurrences_done ?? 0) + 1,
        updated_at: nowIso,
      };
      await recurringRepository.upsertAtomic(rule);
    }

    await onboardingRepository.markStepCompleted('added_income_or_recurring_or_NA');
    return rule;
  }
}

export const budgetRepository = new BudgetRepository();
