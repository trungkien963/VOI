import { useState, type FormEvent, type ReactElement } from 'react';
import { AlertTriangle, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_STARTER_ACCOUNTS, DEFAULT_STARTER_POCKETS, localDb } from '../../db/dexie-schema';
import { budgetRepository } from '../../db/repositories/budget-repository';
import {
  computeSalaryMonthlyStatus,
  computeThreeTierFinancialOverview,
} from '../../domain/budgets/budget-calculator';
import { DEFAULT_SYSTEM_CATEGORIES } from '../../domain/categories/default-categories';
import { computeNetWorth } from '../../domain/ledger/balance-calculator';
import { formatMoney, parseFlexibleMoneyInput } from '../../domain/money/currency';
import type { Category } from '../../domain/types/entities';
import { getCategoryDisplayName, useTranslation } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { CategoryIcon } from '../../shared/ui/CategoryIcon';

export interface BudgetAndFundsSectionProps {
  referenceDateIso?: string;
  hideBalances?: boolean;
  initialFocus?: 'all' | 'salary' | 'caps' | 'funds';
}

export function BudgetAndFundsSection({
  referenceDateIso = new Date().toISOString().slice(0, 10),
  hideBalances = false,
}: BudgetAndFundsSectionProps): ReactElement {
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';

  const allAccounts = useLiveQuery(
    async () => {
      const list = await localDb.accounts.toArray();
      return list.sort((a, b) => a.sort_order - b.sort_order);
    },
    [],
    [],
  );
  const activeAccounts =
    allAccounts.filter((a) => a.archived_at === null).length > 0
      ? allAccounts.filter((a) => a.archived_at === null)
      : DEFAULT_STARTER_ACCOUNTS;

  const allPockets = useLiveQuery(() => localDb.pockets.toArray(), [], []);
  const activePockets =
    allPockets.filter((p) => p.archived_at === null).length > 0
      ? allPockets.filter((p) => p.archived_at === null)
      : DEFAULT_STARTER_POCKETS;

  const liveCategories = useLiveQuery(() => localDb.categories.toArray(), [], []);
  const allCategories: ReadonlyArray<Category> =
    liveCategories.length > 0
      ? [
          ...DEFAULT_SYSTEM_CATEGORIES,
          ...liveCategories.filter(
            (c) => !DEFAULT_SYSTEM_CATEGORIES.some((sys) => sys.id === c.id),
          ),
        ]
      : DEFAULT_SYSTEM_CATEGORIES;

  const parentExpenseCategories = allCategories.filter(
    (c) => c.kind === 'expense' && c.parent_id === null && c.archived_at === null,
  );

  const transactions = useLiveQuery(() => localDb.transactions.toArray(), [], []);
  const lines = useLiveQuery(() => localDb.transaction_lines.toArray(), [], []);
  const debts = useLiveQuery(() => localDb.debt_items.toArray(), [], []);
  const budgets = useLiveQuery(() => localDb.budgets.toArray(), [], []);
  const recurringRules = useLiveQuery(() => localDb.recurring_rules.toArray(), [], []);

  const totalNetWorthMinor = computeNetWorth({ pockets: activePockets, debts });
  const walletsOnlyMinor = computeNetWorth({ pockets: activePockets, debts: [] });
  const netFriendIouMinor = totalNetWorthMinor - walletsOnlyMinor;

  const overview = computeThreeTierFinancialOverview({
    accounts: activeAccounts,
    pockets: activePockets,
    categories: allCategories,
    transactions,
    lines,
    budgets,
    netFriendIouMinor,
    totalNetWorthMinor,
    referenceDateIso,
  });

  const salaryStatus = computeSalaryMonthlyStatus({
    recurringRules,
    transactions,
    accounts: activeAccounts,
    pockets: activePockets,
    referenceDateIso,
  });

  const [showAddCap, setShowAddCap] = useState(false);
  const [selectedCapCategoryId, setSelectedCapCategoryId] = useState<string>(
    parentExpenseCategories[0]?.id ?? '10000000-0000-4000-8000-000000000001',
  );
  const [capAmountText, setCapAmountText] = useState('');

  const handleSaveCategoryCap = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const limitMinor = parseFlexibleMoneyInput(capAmountText, 'VND');
    if (limitMinor <= 0 || !selectedCapCategoryId) return;

    await budgetRepository.upsertMonthlyBudgetAtomic({
      monthKey: overview.monthKey,
      categoryId: selectedCapCategoryId,
      limitMinor,
      alertThresholdPct: 80,
    });
    setCapAmountText('');
    setShowAddCap(false);
  };

  const overallSpentPct =
    overview.totalExpenseCapMinor > 0
      ? Math.min(
          100,
          Math.round((overview.monthlyOwnExpenseMinor / overview.totalExpenseCapMinor) * 100),
        )
      : 0;

  return (
    <Card className="space-y-3.5">
      {/* Clean Top Summary: Daily Safe-to-Spend + Month Progress Bar */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-[var(--ink-secondary)]">
            {isVi
              ? `Hạn mức chi tiêu · Được tiêu mỗi ngày (còn ${overview.daysRemaining} ngày)`
              : `Spending Caps · Safe to spend daily (${overview.daysRemaining} days left)`}
          </p>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <p
              className="text-2xl font-extrabold tracking-tight text-[#2563EB] tabular-nums"
              data-testid="daily-safe-to-spend-amount"
            >
              {formatMoney(overview.effectiveDailySafeMinor, 'VND', { hidden: hideBalances })}
            </p>
            <span className="text-xs font-bold text-[var(--ink-secondary)]">
              {isVi ? '/ ngày' : '/ day'}
            </span>
          </div>
        </div>

        <Button
          variant={showAddCap ? 'outline' : 'subtle'}
          size="xs"
          className="shrink-0"
          onClick={() => setShowAddCap((v) => !v)}
        >
          {showAddCap ? (
            <>
              <X className="h-3.5 w-3.5" />
              <span>{isVi ? 'Đóng' : 'Close'}</span>
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              <span>{isVi ? 'Đặt trần mục' : 'Add Cap'}</span>
            </>
          )}
        </Button>
      </div>

      {/* Compact Month Budget Bar */}
      {overview.totalExpenseCapMinor > 0 && (
        <div className="rounded-2xl bg-[var(--bg-subtle)]/70 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--ink-secondary)]">
              {isVi ? 'Đã chi tháng này:' : 'Spent this month:'}{' '}
              <strong className="font-extrabold text-[var(--ink-primary)] tabular-nums">
                {formatMoney(overview.monthlyOwnExpenseMinor, 'VND', { hidden: hideBalances })}
              </strong>
            </span>
            <span className="font-semibold text-[var(--ink-secondary)] tabular-nums">
              {isVi ? 'Còn lại:' : 'Left:'}{' '}
              <strong className="font-extrabold text-[#059669]">
                {formatMoney(overview.remainingExpenseBudgetMinor, 'VND', {
                  hidden: hideBalances,
                })}
              </strong>
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-card)]">
            <div
              className={`h-full rounded-full transition-all ${
                overallSpentPct >= 100
                  ? 'bg-[#EF4444]'
                  : overallSpentPct >= 80
                    ? 'bg-[#F59E0B]'
                    : 'bg-[#2563EB]'
              }`}
              style={{ width: `${Math.max(4, overallSpentPct)}%` }}
            />
          </div>
        </div>
      )}

      {/* Liquid Wallet Guardrail Notice */}
      {overview.isLiquidConstrained && (
        <div className="flex items-center gap-2 rounded-xl bg-[#F59E0B]/12 px-3 py-2 text-[11px] font-semibold text-[#B45309]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {isVi
              ? `Số dư ví thực tế hiện còn ${formatMoney(overview.liquidWalletsMinor, 'VND')} (~${formatMoney(overview.dailyLiquidSafeMinor, 'VND')}/ngày).`
              : `Actual wallet cash is ${formatMoney(overview.liquidWalletsMinor, 'VND')} (~${formatMoney(overview.dailyLiquidSafeMinor, 'VND')}/day).`}
          </span>
        </div>
      )}

      {/* Either show the Add Form OR the Category List / Empty State */}
      {showAddCap ? (
        <form
          onSubmit={(e) => void handleSaveCategoryCap(e)}
          className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 p-3.5"
        >
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                {isVi ? 'Hạng mục' : 'Category'}
              </label>
              <select
                value={selectedCapCategoryId}
                onChange={(e) => setSelectedCapCategoryId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)]"
              >
                {parentExpenseCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {getCategoryDisplayName(cat, t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                {isVi ? 'Trần tháng (VND)' : 'Monthly Cap (VND)'}
              </label>
              <input
                type="text"
                required
                inputMode="decimal"
                value={capAmountText}
                onChange={(e) => setCapAmountText(e.target.value)}
                placeholder="3500000"
                className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-extrabold text-[var(--ink-primary)] tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {['1500000', '3000000', '4500000', '6000000'].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setCapAmountText(amt)}
                className="rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-primary)] hover:border-[var(--border-strong)]"
              >
                {formatMoney(Number(amt), 'VND')}
              </button>
            ))}
          </div>

          <Button type="submit" variant="ink" size="sm" fullWidth>
            {isVi ? 'Lưu hạn mức' : 'Save Cap'}
          </Button>
        </form>
      ) : overview.categoryBudgets.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-subtle)]/55 p-4 text-center">
          <p className="text-xs font-bold text-[var(--ink-primary)]">
            {isVi ? 'Chưa có hạn mức cho từng hạng mục' : 'No category spending caps set yet'}
          </p>
          <p className="mt-1 text-[11px] text-[var(--ink-secondary)]">
            {isVi
              ? 'Bấm nút dưới để VOI tự động chia hạn mức hợp lý cho 5 mục chính (Ăn uống, Nhà ở, Di chuyển, Giải trí, Mua sắm):'
              : 'Tap below to auto-fill balanced monthly caps for your top 5 categories:'}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="ink"
              size="sm"
              data-testid="apply-smart-preset-caps-btn"
              onClick={() =>
                void budgetRepository.applySmartPresetCapsAtomic(
                  overview.monthKey,
                  salaryStatus.suggestedAmountMinor ||
                    overview.monthlyIncomeMinor ||
                    15_000_000,
                )
              }
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isVi ? 'Tự động gợi ý 5 hạng mục' : 'Auto-set 5 Category Caps'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowAddCap(true)}>
              {isVi ? 'Tự chọn từng mục' : 'Set manually'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-hairline)]">
          {overview.categoryBudgets.map((item) => {
            const catName = getCategoryDisplayName(item.category, t);
            const barWidth = Math.min(100, Math.max(4, item.usagePct));
            const isExceeded = item.status === 'exceeded';
            const isWarning = item.status === 'warning';

            const badgeCls = isExceeded
              ? 'bg-[#EF4444]/14 text-[#DC2626]'
              : isWarning
                ? 'bg-[#F59E0B]/16 text-[#D97706]'
                : 'bg-[#10B981]/12 text-[#059669]';

            const barColorCls = isExceeded
              ? 'bg-[#EF4444]'
              : isWarning
                ? 'bg-[#F59E0B]'
                : 'bg-[#10B981]';

            return (
              <div
                key={item.category.id}
                data-testid={`category-cap-row-${item.category.slug}`}
                className="py-2.5 first:pt-0.5 last:pb-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <CategoryIcon
                      slug={item.category.slug}
                      colorHex={item.category.color_hex}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-extrabold text-[var(--ink-primary)]">
                          {catName}
                        </p>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${badgeCls}`}
                        >
                          {isExceeded
                            ? isVi
                              ? `Vượt +${formatMoney(item.overAmountMinor, 'VND', { hidden: hideBalances })}`
                              : `Over +${formatMoney(item.overAmountMinor, 'VND', { hidden: hideBalances })}`
                            : isWarning
                              ? isVi
                                ? `Sắp hết ${item.usagePct}%`
                                : `${item.usagePct}%`
                              : `${item.usagePct}%`}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-[var(--ink-secondary)] tabular-nums">
                        {isExceeded
                          ? isVi
                            ? 'Đã hết hạn mức tháng'
                            : 'Monthly cap reached'
                          : isVi
                            ? `Được tiêu: ${formatMoney(item.dailySafeMinor, 'VND', { hidden: hideBalances })}/ngày`
                            : `${formatMoney(item.dailySafeMinor, 'VND', { hidden: hideBalances })}/day left`}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <div className="text-right tabular-nums">
                      <p className="text-xs font-extrabold text-[var(--ink-primary)]">
                        {formatMoney(item.spentMinor, 'VND', { hidden: hideBalances })}
                      </p>
                      <p className="text-[10px] font-medium text-[var(--ink-muted)]">
                        / {formatMoney(item.limitMinor, 'VND', { hidden: hideBalances })}
                      </p>
                    </div>
                    <button
                      type="button"
                      title={isVi ? 'Sửa' : 'Edit'}
                      onClick={() => {
                        setSelectedCapCategoryId(item.category.id);
                        setCapAmountText(String(item.limitMinor));
                        setShowAddCap(true);
                      }}
                      className="rounded-lg p-1 text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title={isVi ? 'Xoá' : 'Remove'}
                      onClick={() =>
                        void budgetRepository.removeCategoryBudgetAtomic(item.category.id)
                      }
                      className="rounded-lg p-1 text-[var(--ink-muted)] hover:bg-[#EF4444]/10 hover:text-[#DC2626]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div
                    className={`h-full rounded-full transition-all ${barColorCls}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
