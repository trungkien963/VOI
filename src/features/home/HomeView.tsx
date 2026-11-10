import { useEffect, useState, type ReactElement } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Check,
  ChevronRight,
  CreditCard,
  Landmark,
  PiggyBank,
  Scale,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUiStore } from '../../app/ui-store';
import { DEFAULT_STARTER_ACCOUNTS, DEFAULT_STARTER_POCKETS, localDb } from '../../db/dexie-schema';
import { budgetRepository } from '../../db/repositories/budget-repository';
import { computeMonthOverMonthComparison } from '../../domain/analytics/report-aggregator';
import {
  computeSalaryMonthlyStatus,
  computeThreeTierFinancialOverview,
  type FundProgressItem,
} from '../../domain/budgets/budget-calculator';
import { DEFAULT_SYSTEM_CATEGORIES } from '../../domain/categories/default-categories';
import {
  computeNetWorth,
  computePeriodReportSummary,
} from '../../domain/ledger/balance-calculator';
import { summarizeTransactionGroup } from '../../domain/ledger/paid-for-others';
import { isRecurringRuleDue } from '../../domain/ledger/recurring-calculator';
import { formatMoney, parseFlexibleMoneyInput } from '../../domain/money/currency';
import { resolveEffectiveCategoryId } from '../../domain/quick-parser/parser';
import type { AccountType, Category, Pocket } from '../../domain/types/entities';
import {
  getCategoryDisplayName,
  useTranslation,
  type TranslationDictionary,
} from '../../shared/i18n';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import {
  GeometricClusterIcon,
  type ClusterMascotMood,
} from '../../shared/ui/GeometricClusterIcon';
import { ReconcileSheet } from '../assets/ReconcileSheet';
import { BudgetAndFundsSection } from '../budgets/BudgetAndFundsSection';
import { OnboardingChecklistCard } from '../onboarding/OnboardingChecklistCard';

interface WeekDayItem {
  label: string;
  dayNumber: string;
  isoDate: string;
  isToday: boolean;
  isFuture: boolean;
}

function getCurrentWeekStrip(dict: TranslationDictionary): WeekDayItem[] {
  const labels = [
    dict.weekStrip.mon,
    dict.weekStrip.tue,
    dict.weekStrip.wed,
    dict.weekStrip.thu,
    dict.weekStrip.fri,
    dict.weekStrip.sat,
    dict.weekStrip.sun,
  ];
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const currentDay = now.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  return labels.map((label, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const isoDate = d.toISOString().slice(0, 10);
    return {
      label,
      dayNumber: String(d.getDate()).padStart(2, '0'),
      isoDate,
      isToday: isoDate === todayIso,
      isFuture: isoDate > todayIso,
    };
  });
}

function getAccountTypeMeta(
  type: AccountType,
  dict: TranslationDictionary,
): { label: string; bgClass: string; textClass: string; icon: ReactElement } {
  switch (type) {
    case 'bank':
      return {
        label: dict.accounts.bankType,
        bgClass: 'bg-[#3B82F6]/12',
        textClass: 'text-[#2563EB]',
        icon: <Landmark className="h-4 w-4" />,
      };
    case 'cash':
      return {
        label: dict.accounts.cashType,
        bgClass: 'bg-[#F59E0B]/14',
        textClass: 'text-[#D97706]',
        icon: <Banknote className="h-4 w-4" />,
      };
    case 'e_wallet':
      return {
        label: dict.accounts.eWalletType,
        bgClass: 'bg-[#EC4899]/12',
        textClass: 'text-[#DB2777]',
        icon: <Smartphone className="h-4 w-4" />,
      };
    case 'credit_card':
      return {
        label: dict.accounts.creditType,
        bgClass: 'bg-[#8B5CF6]/12',
        textClass: 'text-[#7C3AED]',
        icon: <CreditCard className="h-4 w-4" />,
      };
    case 'savings':
    default:
      return {
        label: dict.accounts.savingsType,
        bgClass: 'bg-[#10B981]/12',
        textClass: 'text-[#059669]',
        icon: <PiggyBank className="h-4 w-4" />,
      };
  }
}

interface FlowShortcutItem {
  id: 'flow-cost' | 'flow-earn' | 'flow-debt' | 'flow-transfer';
  label: string;
  bgClass: string;
  textClass: string;
  icon: ReactElement;
}

export function HomeView(): ReactElement {
  const {
    hideBalances,
    checkedInNoSpendToday,
    openQuickAdd,
    openEditTransaction,
    checkInNoSpendToday,
    clearNoSpendDate,
    setActiveTab,
    setWalletSubTab,
  } = useUiStore();
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';

  const todayIso = new Date().toISOString().slice(0, 10);
  const [selectedDateIso, setSelectedDateIso] = useState<string>(todayIso);
  const [isDayDetailOpen, setIsDayDetailOpen] = useState(false);
  const [isBudgetSheetOpen, setIsBudgetSheetOpen] = useState(false);
  const [budgetSheetFocus, setBudgetSheetFocus] = useState<'all' | 'salary' | 'caps' | 'funds'>(
    'all',
  );
  const [reconcilingPocket, setReconcilingPocket] = useState<Pocket | null>(null);
  const [contributingFund, setContributingFund] = useState<FundProgressItem | null>(null);
  const [fundContributeAmountText, setFundContributeAmountText] = useState('');
  const [fundContributeWalletId, setFundContributeWalletId] = useState('');
  const weekDays = getCurrentWeekStrip(t);

  const allAccounts = useLiveQuery(
    async () => {
      const all = await localDb.accounts.toArray();
      return all.sort((a, b) => a.sort_order - b.sort_order);
    },
    [],
    [],
  );
  const liveAccounts = allAccounts.filter((a) => a.archived_at === null);

  const allPockets = useLiveQuery(() => localDb.pockets.toArray(), [], []);
  const activeAccountIds = new Set(liveAccounts.map((a) => a.id));
  const livePockets = allPockets
    .filter((p) => p.archived_at === null && activeAccountIds.has(p.account_id))
    .sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)));

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

  const liveTransactions = useLiveQuery(() => localDb.transactions.toArray(), [], []);
  const liveLines = useLiveQuery(() => localDb.transaction_lines.toArray(), [], []);
  const liveDebts = useLiveQuery(() => localDb.debt_items.toArray(), [], []);
  const liveRecurring = useLiveQuery(() => localDb.recurring_rules.toArray(), [], []);
  const liveBudgets = useLiveQuery(() => localDb.budgets.toArray(), [], []);

  const monthStartIso = `${todayIso.slice(0, 7)}-01`;

  const activeTxs = liveTransactions.filter((tx) => tx.voided_at === null && tx.status !== 'void');
  const activeDatesSet = new Set(activeTxs.map((tx) => tx.txn_date));
  const selectedDayTransactions = activeTxs.filter((tx) => tx.txn_date === selectedDateIso);

  const todayReport = computePeriodReportSummary(
    liveTransactions,
    liveLines,
    todayIso,
    todayIso,
  );
  const selectedDayReport = computePeriodReportSummary(
    liveTransactions,
    liveLines,
    selectedDateIso,
    selectedDateIso,
  );
  const monthReport = computePeriodReportSummary(
    liveTransactions,
    liveLines,
    monthStartIso,
    todayIso,
  );
  const momComparison = computeMonthOverMonthComparison(
    liveTransactions,
    liveLines,
    allCategories,
    todayIso,
  );
  const dueRecurring = liveRecurring.filter((r) => isRecurringRuleDue(r, todayIso));
  const netWorthMinor = computeNetWorth({ pockets: livePockets, debts: liveDebts });
  const walletsOnlyMinor = computeNetWorth({ pockets: livePockets, debts: [] });
  const netDebtMinor = netWorthMinor - walletsOnlyMinor;

  // Total cash outflow from wallet on selectedDateIso (Own share + Paid for friends)
  const selectedDayLentMinor = selectedDayTransactions
    .filter((tx) => tx.type === 'debt_lend')
    .reduce((acc, tx) => acc + Math.abs(tx.amount_minor), 0);

  const openReceivableMinor = liveDebts
    .filter((d) => !d.deleted_at && d.status === 'open' && d.direction === 'they_owe')
    .reduce((acc, d) => acc + d.remaining_minor, 0);
  const openPayableMinor = liveDebts
    .filter((d) => !d.deleted_at && d.status === 'open' && d.direction === 'i_owe')
    .reduce((acc, d) => acc + d.remaining_minor, 0);

  // Consolidate companion debt_lend rows that belong to a Split Bill group_id
  const splitExpenseGroupIds = new Set(
    selectedDayTransactions
      .filter((tx) => tx.group_id && tx.type === 'expense')
      .map((tx) => tx.group_id as string),
  );
  const consolidatedDayTransactions = selectedDayTransactions.filter(
    (tx) => !(tx.type === 'debt_lend' && tx.group_id && splitExpenseGroupIds.has(tx.group_id)),
  );

  // Auto-clear "No spend today" if the user has logged an expense today
  useEffect(() => {
    if (todayReport.totalExpenseBaseMinor > 0 && checkedInNoSpendToday) {
      clearNoSpendDate(todayIso);
    }
  }, [todayReport.totalExpenseBaseMinor, checkedInNoSpendToday, clearNoSpendDate, todayIso]);

  const displayAccounts = liveAccounts.length > 0 ? liveAccounts : DEFAULT_STARTER_ACCOUNTS;
  const displayPockets = livePockets.length > 0 ? livePockets : DEFAULT_STARTER_POCKETS;
  const defaultReconcilePocket =
    livePockets.find((p) => p.is_default && (p.currency ?? 'VND') === 'VND') ??
    livePockets[0] ??
    DEFAULT_STARTER_POCKETS[0] ??
    null;

  const overview = computeThreeTierFinancialOverview({
    accounts: displayAccounts,
    pockets: displayPockets,
    categories: allCategories,
    transactions: liveTransactions,
    lines: liveLines,
    budgets: liveBudgets,
    netFriendIouMinor: netDebtMinor,
    totalNetWorthMinor: netWorthMinor,
    referenceDateIso: todayIso,
  });

  const salaryStatus = computeSalaryMonthlyStatus({
    recurringRules: liveRecurring,
    transactions: liveTransactions,
    accounts: displayAccounts,
    pockets: displayPockets,
    referenceDateIso: todayIso,
  });

  const liquidAccounts = displayAccounts.filter(
    (a) => a.type === 'bank' || a.type === 'cash' || a.type === 'e_wallet',
  );

  // Funds that still need a monthly contribution this month
  const pendingFunds = overview.funds.filter((f) => {
    const effectiveTarget = f.monthlyTargetMinor > 0 ? f.monthlyTargetMinor : 2_000_000;
    return f.monthlyNetContributedMinor < effectiveTarget;
  });

  const unconfirmedSalaryPromptCount =
    !salaryStatus.isConfirmedThisMonth &&
    salaryStatus.suggestedAmountMinor > 0 &&
    !salaryStatus.salaryRule
      ? 1
      : 0;
  const totalUpcomingCount =
    dueRecurring.length + unconfirmedSalaryPromptCount + pendingFunds.length;

  // Dynamic Hero Mascot Mood & Live Financial Coach Speech Bubble
  const topExceeded = overview.exceededCategories[0] ?? null;
  const topWarning = overview.warningCategories[0] ?? null;

  const mascotMood: ClusterMascotMood =
    !salaryStatus.isConfirmedThisMonth && salaryStatus.suggestedAmountMinor > 0
      ? 'payday'
      : topExceeded
        ? 'danger'
        : topWarning
          ? 'warning'
          : overview.totalFundSurplusMinor > 0
            ? 'surplus'
            : 'happy';

  const coachBubbleText =
    !salaryStatus.isConfirmedThisMonth && salaryStatus.suggestedAmountMinor > 0
      ? isVi
        ? `💰 Lương tháng ${overview.monthKey} (${formatMoney(salaryStatus.suggestedAmountMinor, 'VND', { hidden: hideBalances })}) sẵn sàng · Chạm xác nhận!`
        : `💰 ${overview.monthKey} salary (${formatMoney(salaryStatus.suggestedAmountMinor, 'VND', { hidden: hideBalances })}) ready · Tap to confirm!`
      : topExceeded
        ? isVi
          ? `🚨 ${getCategoryDisplayName(topExceeded.category, t)} vượt trần +${formatMoney(topExceeded.overAmountMinor, 'VND', { hidden: hideBalances })} · Chạm xem chi tiết!`
          : `🚨 ${getCategoryDisplayName(topExceeded.category, t)} over cap +${formatMoney(topExceeded.overAmountMinor, 'VND', { hidden: hideBalances })} · Tap to review!`
        : topWarning
          ? isVi
            ? `⚠️ ${getCategoryDisplayName(topWarning.category, t)} sắp hết (${topWarning.usagePct}%) · Còn tiêu ${formatMoney(topWarning.dailySafeMinor, 'VND', { hidden: hideBalances })}/ngày`
            : `⚠️ ${getCategoryDisplayName(topWarning.category, t)} at ${topWarning.usagePct}% · ${formatMoney(topWarning.dailySafeMinor, 'VND', { hidden: hideBalances })}/day left`
          : overview.totalFundSurplusMinor > 0
            ? isVi
              ? `✨ Vượt mục tiêu góp Quỹ +${formatMoney(overview.totalFundSurplusMinor, 'VND', { hidden: hideBalances })} · Được tiêu ${formatMoney(overview.effectiveDailySafeMinor, 'VND', { hidden: hideBalances })}/ngày!`
              : `✨ Fund surplus +${formatMoney(overview.totalFundSurplusMinor, 'VND', { hidden: hideBalances })} · Safe ${formatMoney(overview.effectiveDailySafeMinor, 'VND', { hidden: hideBalances })}/day!`
            : overview.effectiveDailySafeMinor > 0
              ? isVi
                ? `✨ Hôm nay bạn có thể tiêu ${formatMoney(overview.effectiveDailySafeMinor, 'VND', { hidden: hideBalances })}/ngày`
                : `✨ Safe to spend ${formatMoney(overview.effectiveDailySafeMinor, 'VND', { hidden: hideBalances })}/day`
              : isVi
                ? '✨ Đặt lương & trần chi tiêu để VOI tính định mức / ngày cho bạn!'
                : '✨ Set salary & spending caps to unlock your daily safe-to-spend!';

  const openBudgetSheet = (focus: 'all' | 'salary' | 'caps' | 'funds' = 'all'): void => {
    setBudgetSheetFocus(focus);
    setIsBudgetSheetOpen(true);
  };

  const handleFlowShortcutClick = (flowId: FlowShortcutItem['id']): void => {
    if (flowId === 'flow-debt') {
      openQuickAdd({ kind: 'expense', dateIso: selectedDateIso, splitMode: true });
      return;
    }
    const kind =
      flowId === 'flow-earn' ? 'income' : flowId === 'flow-transfer' ? 'transfer' : 'expense';
    openQuickAdd({ kind, dateIso: selectedDateIso });
  };

  const coreFlowShortcuts: ReadonlyArray<FlowShortcutItem> = [
    {
      id: 'flow-cost',
      label: t.flows.cost,
      bgClass: 'bg-[#FF6B35]/12',
      textClass: 'text-[#FF6B35]',
      icon: <ArrowUpRight className="h-4 w-4 stroke-[2.4]" />,
    },
    {
      id: 'flow-earn',
      label: t.flows.earn,
      bgClass: 'bg-[#10B981]/12',
      textClass: 'text-[#059669]',
      icon: <ArrowDownLeft className="h-4 w-4 stroke-[2.4]" />,
    },
    {
      id: 'flow-debt',
      label: t.flows.borrowLend,
      bgClass: 'bg-[#8B5CF6]/12',
      textClass: 'text-[#7C3AED]',
      icon: <Users className="h-4 w-4 stroke-[2.2]" />,
    },
    {
      id: 'flow-transfer',
      label: t.flows.transfer,
      bgClass: 'bg-[#0D9488]/12',
      textClass: 'text-[#0D9488]',
      icon: <ArrowLeftRight className="h-4 w-4 stroke-[2.2]" />,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Interactive 7-Day Week Strip */}
      <section aria-label={t.weekStrip.ariaLabel} className="grid grid-cols-7 gap-1.5">
        {weekDays.map((day) => {
          const isSelected = day.isoDate === selectedDateIso;
          const hasActivity = activeDatesSet.has(day.isoDate);
          return (
            <button
              key={day.isoDate}
              type="button"
              onClick={() => setSelectedDateIso(day.isoDate)}
              data-testid={`week-strip-day-${day.isoDate}`}
              className={`group flex flex-col items-center gap-1 rounded-2xl py-1 transition hover:bg-[var(--bg-subtle)] ${
                day.isFuture && !isSelected && !hasActivity ? 'opacity-55' : ''
              }`}
            >
              <span
                className={`text-[11px] font-bold ${
                  isSelected
                    ? 'text-[var(--ink-primary)]'
                    : day.isToday
                      ? 'text-[#FF6B35]'
                      : 'text-[var(--ink-muted)]'
                }`}
              >
                {day.label}
              </span>
              <div
                className={`relative flex h-10 w-10 items-center justify-center rounded-full text-xs font-extrabold tabular-nums transition ${
                  isSelected
                    ? 'bg-[#141413] text-white shadow-xs'
                    : day.isToday
                      ? 'border-2 border-[#141413] bg-[var(--bg-card)] text-[var(--ink-primary)]'
                      : 'border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-primary)] group-hover:border-[var(--border-strong)]'
                }`}
              >
                {day.dayNumber}
                {hasActivity && (
                  <span
                    className={`absolute -bottom-0.5 h-1.5 w-1.5 rounded-full ${
                      isSelected ? 'bg-[#FF6B35]' : 'bg-[#141413]'
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </section>

      {/* CARD 1: FOCUSED HERO SUMMARY (Breathable 3-Zone Layout, Zero Duplicate Text) */}
      <Card aria-labelledby="hero-today-heading">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p
                id="hero-today-heading"
                className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase"
              >
                {selectedDateIso === todayIso
                  ? t.hero.todaySpentLabel
                  : isVi
                    ? `CHI TIÊU NGÀY ${selectedDateIso}`
                    : `SPENT ON ${selectedDateIso}`}
              </p>
              {selectedDateIso !== todayIso && (
                <button
                  type="button"
                  onClick={() => setSelectedDateIso(todayIso)}
                  className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-primary)] hover:bg-[var(--border-hairline)]"
                >
                  {isVi ? 'Về Hôm nay' : 'Back to Today'}
                </button>
              )}
            </div>

            {/* Hero Number: Your True Personal Spending (consistent with This Month!) */}
            <p
              className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--ink-primary)] sm:text-4xl tabular-nums"
              data-testid="today-spent-amount"
            >
              {formatMoney(selectedDayReport.totalExpenseBaseMinor, 'VND', {
                hidden: hideBalances,
              })}
            </p>

            {/* Single Compact Metadata Line (Never wraps into 2 messy lines) */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-secondary)]">
                <span>{t.hero.monthSpentLabel}:</span>
                <strong
                  className="font-extrabold text-[var(--ink-primary)] tabular-nums"
                  data-testid="month-spent-amount"
                >
                  {formatMoney(monthReport.totalExpenseBaseMinor, 'VND', { hidden: hideBalances })}
                </strong>
                {momComparison.deltaPercentage !== null && (
                  <span className="text-[10px] font-bold text-[var(--ink-muted)]">
                    ({momComparison.deltaPercentage > 0
                      ? `+${momComparison.deltaPercentage}%`
                      : `${momComparison.deltaPercentage}%`})
                  </span>
                )}
              </span>

              {selectedDayLentMinor > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#8B5CF6]/10 px-2.5 py-1 text-[11px] font-bold text-[#6D28D9] tabular-nums">
                  <Users className="h-3 w-3 shrink-0" />
                  <span className="whitespace-nowrap">
                    {isVi ? 'Ứng hộ: ' : 'Advanced: '}+
                    {formatMoney(selectedDayLentMinor, 'VND', { hidden: hideBalances })}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Mascot Anchor (~1/5 Card Width, Whole & Unclipped) */}
          <button
            type="button"
            onClick={() => openBudgetSheet('caps')}
            data-testid="hero-mascot-stage"
            className="shrink-0 transition-transform hover:scale-[1.03]"
            aria-label={coachBubbleText}
          >
            <GeometricClusterIcon
              variant="stay-together"
              mood={mascotMood}
              size={88}
              label="Geometric Pop Buddies"
            />
          </button>
        </div>

        {/* Unified 2-Column Smart Row: Left = Safe-to-Spend/Day, Right = Selected Day Activity */}
        <div
          className={`mt-3 grid gap-2 ${
            consolidatedDayTransactions.length > 0 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          <button
            type="button"
            onClick={() => openBudgetSheet('caps')}
            data-testid="home-safe-to-spend-banner"
            className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 px-3 py-2.5 text-left transition hover:border-[var(--border-strong)]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[11px] font-semibold text-[var(--ink-secondary)]">
                  {isVi ? 'Được tiêu / ngày' : 'Safe to spend / day'}
                </span>
                {overview.exceededCategories.length > 0 ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#EF4444]" />
                ) : overview.warningCategories.length > 0 ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#F59E0B]" />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#10B981]" />
                )}
              </div>
              <p
                className="mt-0.5 truncate text-xs font-extrabold text-[#2563EB] tabular-nums"
                data-testid="home-daily-safe-amount"
              >
                {formatMoney(overview.effectiveDailySafeMinor, 'VND', { hidden: hideBalances })}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
          </button>

          {consolidatedDayTransactions.length > 0 && (
            <button
              type="button"
              onClick={() => setIsDayDetailOpen(true)}
              className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 px-3 py-2.5 text-left transition hover:border-[var(--border-strong)]"
            >
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-[var(--ink-secondary)]">
                  {selectedDateIso === todayIso
                    ? isVi
                      ? 'Giao dịch hôm nay'
                      : "Today's activity"
                    : selectedDateIso}
                </p>
                <p className="mt-0.5 truncate text-xs font-extrabold text-[var(--ink-primary)]">
                  {isVi
                    ? `${consolidatedDayTransactions.length} giao dịch`
                    : `${consolidatedDayTransactions.length} transaction(s)`}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
            </button>
          )}
        </div>

        {/* 4 Clean Vector Squircle Action Shortcuts */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {coreFlowShortcuts.map((flow) => (
            <button
              key={flow.id}
              type="button"
              data-testid={`home-shortcut-${flow.id}`}
              onClick={() => handleFlowShortcutClick(flow.id)}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] py-2.5 transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]/50"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${flow.bgClass} ${flow.textClass}`}
              >
                {flow.icon}
              </span>
              <span className="text-[11px] font-bold text-[var(--ink-primary)]">{flow.label}</span>
            </button>
          ))}
        </div>

        {(activeTxs.length === 0 ||
          (selectedDateIso === todayIso && todayReport.totalExpenseBaseMinor === 0)) && (
          <Card.Footer className="flex flex-col gap-2">
            {activeTxs.length === 0 && (
              <Button
                variant="ink"
                size="md"
                fullWidth
                onClick={() => openQuickAdd({ kind: 'expense', dateIso: selectedDateIso })}
                className="justify-between"
              >
                <span className="truncate">{t.hero.primaryCta}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </Button>
            )}

            {selectedDateIso === todayIso && todayReport.totalExpenseBaseMinor === 0 && (
              <Button
                variant={checkedInNoSpendToday ? 'success' : 'subtle'}
                size="md"
                fullWidth
                onClick={checkInNoSpendToday}
                disabled={checkedInNoSpendToday}
              >
                {checkedInNoSpendToday ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>{t.hero.noSpendCheckedIn}</span>
                  </>
                ) : (
                  <span>{t.hero.noSpendTodayBtn}</span>
                )}
              </Button>
            )}
          </Card.Footer>
        )}
      </Card>

      {/* UNIFIED UPCOMING REMINDERS (Monthly Salary + Monthly Fund Contributions + Due Bills) */}
      {totalUpcomingCount > 0 && (
        <Card>
          <Card.Header bordered>
            <h2 className="text-sm font-bold text-[var(--ink-primary)]">
              {t.m4.upcomingRemindersTitle} ({totalUpcomingCount})
            </h2>
            {dueRecurring.length > 0 && (
              <Button
                variant="ink"
                size="xs"
                onClick={() => {
                  setWalletSubTab('recurring');
                  setActiveTab('wallets');
                }}
              >
                {t.m3.confirmBtn}
              </Button>
            )}
          </Card.Header>
          <Card.Body className="mt-2 space-y-2">
            {unconfirmedSalaryPromptCount > 0 && (
              <div
                data-testid="home-salary-rollover-banner"
                className="flex items-center justify-between gap-2 rounded-xl bg-[#10B981]/10 px-2.5 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Banknote className="h-4 w-4 shrink-0 text-[#059669]" />
                  <span className="truncate font-bold text-[var(--ink-primary)]">
                    {isVi
                      ? `Lương tháng ${overview.monthKey}: +${formatMoney(salaryStatus.suggestedAmountMinor, 'VND', { hidden: hideBalances })}`
                      : `${overview.monthKey} Salary: +${formatMoney(salaryStatus.suggestedAmountMinor, 'VND', { hidden: hideBalances })}`}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      setWalletSubTab('recurring');
                      setActiveTab('wallets');
                    }}
                  >
                    {isVi ? 'Sửa' : 'Edit'}
                  </Button>
                  <Button
                    variant="ink"
                    size="xs"
                    onClick={() => {
                      const targetAccId =
                        salaryStatus.defaultAccountId ??
                        displayAccounts[0]?.id ??
                        'acc-default-bank';
                      void budgetRepository.setupOrConfirmMonthlySalaryAtomic({
                        amountMinor: salaryStatus.suggestedAmountMinor,
                        paydayDayOfMonth: salaryStatus.paydayDayOfMonth,
                        accountId: targetAccId,
                        pocketId: salaryStatus.defaultPocketId,
                        referenceDateIso: todayIso,
                        confirmForCurrentMonth: true,
                        title: isVi ? 'Lương hàng tháng' : 'Monthly Salary',
                      });
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isVi ? 'Xác nhận' : 'Confirm'}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Monthly Savings Fund Contribution Reminders */}
            {pendingFunds.map((fund) => {
              const targetMinor = fund.monthlyTargetMinor > 0 ? fund.monthlyTargetMinor : 2_000_000;
              const remainingMinor = Math.max(0, targetMinor - fund.monthlyNetContributedMinor);
              return (
                <div
                  key={`reminder-fund-${fund.account.id}`}
                  data-testid={`home-fund-reminder-${fund.account.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl bg-[#10B981]/10 px-2.5 py-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setWalletSubTab('wallets');
                      setActiveTab('wallets');
                    }}
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <PiggyBank className="h-4 w-4 shrink-0 text-[#059669]" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[var(--ink-primary)]">
                        {isVi ? `Góp ${fund.account.name}` : `Contribute to ${fund.account.name}`}
                      </p>
                      <p className="truncate text-[11px] font-medium text-[var(--ink-secondary)] tabular-nums">
                        {fund.monthlyNetContributedMinor > 0
                          ? isVi
                            ? `Đã góp ${formatMoney(fund.monthlyNetContributedMinor, 'VND', { hidden: hideBalances })} · Còn ${formatMoney(remainingMinor, 'VND', { hidden: hideBalances })}`
                            : `Saved ${formatMoney(fund.monthlyNetContributedMinor, 'VND', { hidden: hideBalances })} · ${formatMoney(remainingMinor, 'VND', { hidden: hideBalances })} left`
                          : isVi
                            ? `Định mức tháng: ${formatMoney(targetMinor, 'VND', { hidden: hideBalances })}`
                            : `Monthly target: ${formatMoney(targetMinor, 'VND', { hidden: hideBalances })}`}
                      </p>
                    </div>
                  </button>

                  <Button
                    variant="ink"
                    size="xs"
                    className="shrink-0"
                    onClick={() => {
                      setContributingFund(fund);
                      setFundContributeAmountText(String(remainingMinor));
                      setFundContributeWalletId(liquidAccounts[0]?.id ?? '');
                    }}
                  >
                    <ArrowUpRight className="h-3 w-3" />
                    <span>{isVi ? 'Góp quỹ' : 'Contribute'}</span>
                  </Button>
                </div>
              );
            })}

            {dueRecurring.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-xs font-semibold text-[var(--ink-primary)]"
              >
                <span>{r.title}</span>
                <span
                  className={`font-extrabold tabular-nums ${
                    r.template_type === 'income' ? 'text-[#059669]' : 'text-[var(--ink-primary)]'
                  }`}
                >
                  {r.template_type === 'income' ? '+' : ''}
                  {formatMoney(r.amount_minor, 'VND', { hidden: hideBalances })}
                </span>
              </div>
            ))}
          </Card.Body>
        </Card>
      )}

      {/* CARD 2: CLEAN ACCOUNTS, FRIEND IOUs & NET WORTH SUMMARY */}
      <Card aria-labelledby="accounts-summary-heading">
        <Card.Header bordered>
          <div>
            <h2
              id="accounts-summary-heading"
              className="text-sm font-bold text-[var(--ink-primary)]"
            >
              {t.accounts.sectionTitle}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-secondary)]">{t.accounts.netWorthLabel}</p>
            {(overview.funds.length > 0 || netDebtMinor !== 0) && (
              <p className="mt-0.5 text-[11px] font-medium text-[var(--ink-secondary)] tabular-nums">
                {isVi ? 'Ví tiêu: ' : 'Liquid: '}
                {formatMoney(overview.liquidWalletsMinor, 'VND', { hidden: hideBalances })}
                {overview.funds.length > 0 && (
                  <>
                    {' · '}
                    <span className="font-semibold text-[#059669]">
                      {isVi ? 'Quỹ: ' : 'Funds: '}
                      {formatMoney(overview.savingsFundsMinor, 'VND', { hidden: hideBalances })}
                    </span>
                  </>
                )}
                {netDebtMinor !== 0 && (
                  <>
                    {' · '}
                    {isVi ? 'Nợ ròng: ' : 'IOUs: '}
                    {formatMoney(netDebtMinor, 'VND', {
                      hidden: hideBalances,
                      showPlusSign: netDebtMinor > 0,
                    })}
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end">
            {netWorthMinor >= 0 ? (
              <span className="inline-block rounded-full bg-[#10B981]/12 px-2 py-0.5 text-[10px] font-bold text-[#059669]">
                {t.accounts.spendableBadge}
              </span>
            ) : (
              defaultReconcilePocket && (
                <button
                  type="button"
                  onClick={() => setReconcilingPocket(defaultReconcilePocket)}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--ink-primary)] transition hover:bg-[#141413] hover:text-white"
                >
                  <Scale className="h-3 w-3" />
                  <span>{isVi ? 'Nhập số dư thực tế →' : 'Set opening balance →'}</span>
                </button>
              )
            )}
            <p
              className="mt-1 text-lg font-extrabold text-[var(--ink-primary)] tabular-nums"
              data-testid="net-worth-amount"
            >
              {formatMoney(netWorthMinor, 'VND', { hidden: hideBalances })}
            </p>
          </div>
        </Card.Header>

        <Card.Body className="mt-1">
          <ul className="divide-y divide-[var(--border-hairline)]">
            {displayAccounts
              .filter((acc) => acc.type !== 'savings')
              .map((acc) => {
                const typeMeta = getAccountTypeMeta(acc.type, t);
                return (
                  <li key={acc.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setWalletSubTab('wallets');
                        setActiveTab('wallets');
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-1 py-2.5 text-left transition hover:bg-[var(--bg-subtle)]"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${typeMeta.bgClass} ${typeMeta.textClass}`}
                        >
                          {typeMeta.icon}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-[var(--ink-primary)]">{acc.name}</p>
                          <p className="text-[11px] font-medium text-[var(--ink-secondary)]">
                            {typeMeta.label}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-extrabold text-[var(--ink-primary)] tabular-nums">
                          {formatMoney(acc.cached_balance_minor, 'VND', { hidden: hideBalances })}
                        </span>
                        <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" />
                      </div>
                    </button>
                  </li>
                );
              })}

            {/* Consolidated Savings & Goal Funds Row inside Net Worth Summary */}
            {overview.funds.length > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setWalletSubTab('wallets');
                    setActiveTab('wallets');
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-1 py-2.5 text-left transition hover:bg-[var(--bg-subtle)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#10B981]/12 text-[#059669]">
                      <PiggyBank className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-[var(--ink-primary)]">
                          {isVi
                            ? `Quỹ tích lũy (${overview.funds.length})`
                            : `Savings Funds (${overview.funds.length})`}
                        </p>
                        {overview.totalFundSurplusMinor > 0 && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#10B981]/16 px-1.5 py-0.5 text-[10px] font-extrabold text-[#059669]">
                            <Sparkles className="h-2.5 w-2.5" />
                            <span>
                              +{formatMoney(overview.totalFundSurplusMinor, 'VND', { hidden: hideBalances })}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] font-medium text-[var(--ink-secondary)] tabular-nums">
                        {isVi ? 'Đã góp tháng này: ' : 'Contributed this month: '}
                        <span className="font-semibold text-[#059669]">
                          +{formatMoney(overview.monthlyNetFundContributionMinor, 'VND', { hidden: hideBalances })}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-extrabold text-[#059669] tabular-nums">
                      {formatMoney(overview.savingsFundsMinor, 'VND', { hidden: hideBalances })}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" />
                  </div>
                </button>
              </li>
            )}

            {/* Integrated Net Debt Row inside Assets & Net Worth so the math adds up visually */}
            {(openReceivableMinor > 0 || openPayableMinor > 0) && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setWalletSubTab('debts');
                    setActiveTab('wallets');
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-1 py-2.5 text-left transition hover:bg-[var(--bg-subtle)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#8B5CF6]/12 text-[#7C3AED]">
                      <Users className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--ink-primary)]">
                        {isVi ? 'Sổ nợ bạn bè (Ròng)' : 'Friend IOUs (Net)'}
                      </p>
                      <p className="truncate whitespace-nowrap text-[11px] font-medium text-[var(--ink-secondary)] tabular-nums">
                        <span className="font-semibold text-[#059669]">
                          +{formatMoney(openReceivableMinor, 'VND', { hidden: hideBalances })}
                        </span>
                        {' / '}
                        <span className="font-semibold text-[var(--ink-primary)]">
                          -{formatMoney(openPayableMinor, 'VND', { hidden: hideBalances })}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm font-extrabold tabular-nums ${
                        netDebtMinor >= 0 ? 'text-[#059669]' : 'text-[var(--ink-primary)]'
                      }`}
                    >
                      {formatMoney(netDebtMinor, 'VND', {
                        hidden: hideBalances,
                        showPlusSign: netDebtMinor > 0,
                      })}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" />
                  </div>
                </button>
              </li>
            )}
          </ul>
        </Card.Body>
      </Card>

      <ReconcileSheet
        pocket={reconcilingPocket}
        onClose={() => setReconcilingPocket(null)}
        onReconciled={() => setReconcilingPocket(null)}
      />

      {/* CARD 3: COMPACT 1-LINE ONBOARDING CHECKLIST */}
      <OnboardingChecklistCard />

      {/* DETAIL SHEET: Selected Day Transactions Breakdown */}
      <BottomSheet
        open={isDayDetailOpen}
        onClose={() => setIsDayDetailOpen(false)}
        title={isVi ? `Giao dịch ngày ${selectedDateIso}` : `Activity on ${selectedDateIso}`}
        titleId="home-day-detail-sheet-title"
        closeLabel={isVi ? 'Đóng' : 'Close'}
      >
        <div className="space-y-3">
          <div className="divide-y divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3">
            {consolidatedDayTransactions.map((tx) => {
              const effectiveCatId = resolveEffectiveCategoryId(tx);
              const cat = allCategories.find((c) => c.id === effectiveCatId);
              const linkedDebt = tx.debt_id ? liveDebts.find((d) => d.id === tx.debt_id) : null;
              const groupSummary =
                tx.group_id && tx.type === 'expense'
                  ? summarizeTransactionGroup(tx.group_id, activeTxs)
                  : null;

              const catName = cat ? getCategoryDisplayName(cat, t) : t.flows.cost;
              const mainText = tx.note?.trim() || catName;
              const subTag =
                tx.type === 'debt_borrow'
                  ? isVi
                    ? `Nợ ${linkedDebt?.counterparty_name ?? ''}`.trim()
                    : `IOU ${linkedDebt?.counterparty_name ?? ''}`.trim()
                  : groupSummary && groupSummary.lentMinor > 0
                    ? isVi
                      ? `Chia bill · Phần bạn ${formatMoney(groupSummary.ownExpenseMinor, tx.currency, { hidden: hideBalances })}`
                      : `Split · Yours ${formatMoney(groupSummary.ownExpenseMinor, tx.currency, { hidden: hideBalances })}`
                    : catName;

              const rawAmt =
                groupSummary && groupSummary.lentMinor > 0
                  ? groupSummary.totalPaidMinor
                  : Math.abs(tx.amount_minor);
              const isOutflow =
                tx.type === 'expense' ||
                tx.type === 'credit_card_spend' ||
                tx.type === 'debt_lend' ||
                tx.type === 'debt_repay';
              const signedAmt = isOutflow ? -rawAmt : rawAmt;

              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => {
                    setIsDayDetailOpen(false);
                    openEditTransaction(tx.id);
                  }}
                  className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-xs transition hover:bg-[var(--bg-subtle)]/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[var(--ink-primary)]">{mainText}</p>
                    <p className="truncate text-[11px] text-[var(--ink-secondary)]">{subTag}</p>
                  </div>
                  <span
                    className={`shrink-0 font-extrabold tabular-nums ${
                      tx.type === 'income' ? 'text-[#059669]' : 'text-[var(--ink-primary)]'
                    }`}
                  >
                    {tx.type === 'debt_borrow' ? (isVi ? 'Nợ ' : 'IOU ') : ''}
                    {formatMoney(signedAmt, tx.currency, {
                      hidden: hideBalances,
                      showPlusSign: tx.type === 'income',
                    })}
                  </span>
                </button>
              );
            })}
          </div>

          <Button
            variant="ink"
            size="md"
            fullWidth
            onClick={() => {
              setIsDayDetailOpen(false);
              setActiveTab('transactions');
            }}
          >
            <span>{isVi ? 'Mở toàn bộ Sổ giao dịch →' : 'Open Full Ledger →'}</span>
          </Button>
        </div>
      </BottomSheet>

      {/* DETAIL SHEET: Safe-to-Spend (/day) & Category Spending Caps */}
      <BottomSheet
        open={isBudgetSheetOpen}
        onClose={() => setIsBudgetSheetOpen(false)}
        title={isVi ? 'Hạn mức chi tiêu & Định mức / ngày' : 'Daily Safe-to-Spend & Category Caps'}
        titleId="home-budget-sheet-title"
        closeLabel={isVi ? 'Đóng' : 'Close'}
      >
        <BudgetAndFundsSection
          referenceDateIso={todayIso}
          hideBalances={hideBalances}
          initialFocus={budgetSheetFocus}
        />
      </BottomSheet>

      {/* QUICK FUND CONTRIBUTION SHEET FROM HOME REMINDER */}
      <BottomSheet
        open={Boolean(contributingFund)}
        onClose={() => setContributingFund(null)}
        title={
          contributingFund
            ? isVi
              ? `Góp vào ${contributingFund.account.name}`
              : `Contribute to ${contributingFund.account.name}`
            : ''
        }
        titleId="home-fund-contribute-sheet-title"
        closeLabel={isVi ? 'Đóng' : 'Close'}
      >
        {contributingFund && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const amountMinor = parseFlexibleMoneyInput(fundContributeAmountText, 'VND');
              if (amountMinor <= 0) return;
              const liquidId = fundContributeWalletId || liquidAccounts[0]?.id;
              if (!liquidId) return;
              void budgetRepository
                .transferBetweenWalletAndFundAtomic({
                  fundAccountId: contributingFund.account.id,
                  liquidAccountId: liquidId,
                  amountMinor,
                  direction: 'contribute',
                  dateIso: todayIso,
                })
                .then(() => {
                  setContributingFund(null);
                  setFundContributeAmountText('');
                });
            }}
            className="space-y-3.5"
          >
            <div className="rounded-2xl bg-[#10B981]/10 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--ink-secondary)]">
                  {isVi ? 'Số dư tích lũy hiện tại:' : 'Current fund balance:'}
                </span>
                <strong className="font-extrabold text-[#059669] tabular-nums">
                  {formatMoney(contributingFund.accumulatedBalanceMinor, 'VND', {
                    hidden: hideBalances,
                  })}
                </strong>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-semibold text-[var(--ink-secondary)]">
                  {isVi ? 'Đã góp tháng này:' : 'Contributed this month:'}
                </span>
                <strong className="font-bold text-[var(--ink-primary)] tabular-nums">
                  {formatMoney(contributingFund.monthlyNetContributedMinor, 'VND', {
                    hidden: hideBalances,
                  })}{' '}
                  /{' '}
                  {formatMoney(
                    contributingFund.monthlyTargetMinor > 0
                      ? contributingFund.monthlyTargetMinor
                      : 2_000_000,
                    'VND',
                    { hidden: hideBalances },
                  )}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block truncate text-xs font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Số tiền góp (VND)' : 'Amount (VND)'}
                </label>
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  value={fundContributeAmountText}
                  onChange={(e) => setFundContributeAmountText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2.5 text-sm font-extrabold text-[var(--ink-primary)] tabular-nums"
                />
              </div>
              <div>
                <label className="block truncate text-xs font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Trích từ ví' : 'From Wallet'}
                </label>
                <select
                  value={fundContributeWalletId}
                  onChange={(e) => setFundContributeWalletId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2.5 text-sm font-semibold text-[var(--ink-primary)]"
                >
                  {liquidAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" variant="ink" size="md" fullWidth>
              <Check className="h-4 w-4" />
              <span>{isVi ? 'Xác nhận góp vào Quỹ' : 'Confirm Contribution'}</span>
            </Button>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}
