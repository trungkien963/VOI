import { useEffect, useState, type ReactElement } from 'react';
import {
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
import { mergeSystemAndLiveCategories } from '../../domain/categories/default-categories';
import {
  computeNetWorth,
  computePeriodReportSummary,
} from '../../domain/ledger/balance-calculator';
import { summarizeTransactionGroup } from '../../domain/ledger/paid-for-others';
import { isRecurringRuleDue } from '../../domain/ledger/recurring-calculator';
import { formatMoney, parseFlexibleMoneyInput } from '../../domain/money/currency';
import { resolveEffectiveCategoryId } from '../../domain/quick-parser/parser';
import type { AccountType, BuddyMood, Category, Pocket } from '../../domain/types/entities';
import {
  getAccountDisplayName,
  getCategoryDisplayName,
  useTranslation,
  type TranslationDictionary,
} from '../../shared/i18n';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { GeometricBuddy, type VoiElephantPose } from '../../shared/ui/GeometricBuddy';
import { type ClusterMascotMood } from '../../shared/ui/GeometricClusterIcon';
import { VoiFlowIcon } from '../../shared/ui/VoiFlowIcon';
import { ReconcileSheet } from '../assets/ReconcileSheet';
import { BudgetAndFundsSection } from '../budgets/BudgetAndFundsSection';
import { OnboardingChecklistCard } from '../onboarding/OnboardingChecklistCard';
import { getAvatarPresetMeta } from '../onboarding/WelcomeOnboardingModal';

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
        bgClass: 'bg-[#BCDBEB]',
        textClass: 'text-[#2F5FD0]',
        icon: <Landmark className="h-4 w-4" />,
      };
    case 'cash':
      return {
        label: dict.accounts.cashType,
        bgClass: 'bg-[#F7F296]',
        textClass: 'text-[#A37A00]',
        icon: <Banknote className="h-4 w-4" />,
      };
    case 'e_wallet':
      return {
        label: dict.accounts.eWalletType,
        bgClass: 'bg-[#F5C2D7]',
        textClass: 'text-[#D13B7B]',
        icon: <Smartphone className="h-4 w-4" />,
      };
    case 'credit_card':
      return {
        label: dict.accounts.creditType,
        bgClass: 'bg-[#D7C3F8]',
        textClass: 'text-[#6E44A3]',
        icon: <CreditCard className="h-4 w-4" />,
      };
    case 'savings':
    default:
      return {
        label: dict.accounts.savingsType,
        bgClass: 'bg-[#B7EDB8]',
        textClass: 'text-[#1E7E3A]',
        icon: <PiggyBank className="h-4 w-4" />,
      };
  }
}

interface FlowShortcutItem {
  id: 'flow-cost' | 'flow-earn' | 'flow-debt' | 'flow-transfer';
  label: string;
  tileBgHex: string;
  tileBorderHex: string;
  haloBgHex: string;
  icon: ReactElement;
}

export function HomeView(): ReactElement {
  const {
    hideBalances,
    avatarId,
    userName,
    checkedInNoSpendToday,
    openQuickAdd,
    openEditTransaction,
    checkInNoSpendToday,
    clearNoSpendDate,
    triggerCelebration,
    setActiveTab,
    setWalletSubTab,
    setAvatarId,
  } = useUiStore();
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';
  const activeBuddy = getAvatarPresetMeta(avatarId);
  const [buddyTapCount, setBuddyTapCount] = useState(0);

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
  const allCategories: ReadonlyArray<Category> = mergeSystemAndLiveCategories(liveCategories);

  const liveTransactions = useLiveQuery(() => localDb.transactions.toArray(), [], []);
  const liveLines = useLiveQuery(() => localDb.transaction_lines.toArray(), [], []);
  const liveDebts = useLiveQuery(() => localDb.debt_items.toArray(), [], []);
  const liveRecurring = useLiveQuery(() => localDb.recurring_rules.toArray(), [], []);
  const liveBudgets = useLiveQuery(() => localDb.budgets.toArray(), [], []);

  const monthStartIso = `${todayIso.slice(0, 7)}-01`;

  const activeTxs = liveTransactions.filter((tx) => tx.voided_at === null && tx.status !== 'void');
  const activeDatesSet = new Set(activeTxs.map((tx) => tx.txn_date));
  const selectedDayTransactions = activeTxs.filter((tx) => tx.txn_date === selectedDateIso);

  const todayReport = computePeriodReportSummary(liveTransactions, liveLines, todayIso, todayIso);
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

  const effectiveBuddyMood: BuddyMood =
    buddyTapCount % 3 === 1
      ? 'wink'
      : buddyTapCount % 3 === 2
        ? 'excited'
        : mascotMood === 'danger'
          ? 'worried'
          : mascotMood === 'warning'
            ? 'surprised'
            : mascotMood === 'payday' || mascotMood === 'surplus'
              ? 'excited'
              : 'happy';

  const heroElephantPose: VoiElephantPose | undefined =
    buddyTapCount % 3 === 1
      ? 'peeking'
      : buddyTapCount % 3 === 2
        ? 'super'
        : mascotMood === 'danger'
          ? 'slide'
          : mascotMood === 'warning'
            ? 'gym'
            : checkedInNoSpendToday && selectedDayReport.totalExpenseBaseMinor === 0
              ? 'sleep'
              : undefined;

  const buddyDisplayName = isVi ? activeBuddy.nameVi : activeBuddy.nameEn;
  const buddyTrait = isVi ? activeBuddy.tagVi : activeBuddy.tagEn;
  const userCallName = userName.trim() || (isVi ? 'bạn' : 'friend');

  const interactiveQuote =
    buddyTapCount % 3 === 1
      ? isVi
        ? `💬 ${buddyDisplayName}: "${userCallName} cứ ghi thật nhanh 3 giây, mọi con số để mình canh cho!"`
        : `💬 ${buddyDisplayName}: "Log in 3 seconds, ${userCallName} — I've got your numbers covered!"`
      : buddyTapCount % 3 === 2
        ? isVi
          ? `✨ Phong cách "${buddyTrait}" đang bật! Chạm tên mình nếu muốn đổi linh vật nhé.`
          : `✨ "${buddyTrait}" mode active! Tap my name badge anytime to switch buddies.`
        : null;

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
      tileBgHex: '#F3E8FF',
      tileBorderHex: '#D8B4FE',
      haloBgHex: '#FFFFFF',
      icon: <VoiFlowIcon variant="expense" size={44} />,
    },
    {
      id: 'flow-earn',
      label: t.flows.earn,
      tileBgHex: '#DCFCE7',
      tileBorderHex: '#86EFAC',
      haloBgHex: '#FFFFFF',
      icon: <VoiFlowIcon variant="income" size={44} />,
    },
    {
      id: 'flow-debt',
      label: t.flows.borrowLend,
      tileBgHex: '#FFE4E6',
      tileBorderHex: '#FDA4AF',
      haloBgHex: '#FFFFFF',
      icon: <VoiFlowIcon variant="lend-borrow" size={44} />,
    },
    {
      id: 'flow-transfer',
      label: t.flows.transfer,
      tileBgHex: '#E0F2FE',
      tileBorderHex: '#7DD3FC',
      haloBgHex: '#FFFFFF',
      icon: <VoiFlowIcon variant="transfer" size={44} />,
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
                style={
                  day.isToday && !isSelected ? { color: activeBuddy.characterFillHex } : undefined
                }
                className={`text-[11px] font-bold ${
                  isSelected
                    ? 'text-[var(--ink-primary)]'
                    : day.isToday
                      ? ''
                      : 'text-[var(--ink-muted)]'
                }`}
              >
                {day.label}
              </span>
              <div
                style={
                  isSelected
                    ? {
                        backgroundColor: activeBuddy.cardBgHex,
                        borderColor: '#191919',
                      }
                    : undefined
                }
                className={`relative flex h-10 w-10 items-center justify-center rounded-full text-xs font-extrabold tabular-nums transition ${
                  isSelected
                    ? 'border-2 text-[#191919] shadow-xs'
                    : day.isToday
                      ? 'border-2 border-[#141413] bg-[var(--bg-card)] text-[var(--ink-primary)]'
                      : 'border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-primary)] group-hover:border-[var(--border-strong)]'
                }`}
              >
                {day.dayNumber}
                {hasActivity && (
                  <span
                    style={
                      isSelected ? { backgroundColor: activeBuddy.characterFillHex } : undefined
                    }
                    className={`absolute -bottom-0.5 h-1.5 w-1.5 rounded-full ${
                      isSelected ? '' : 'bg-[#141413]'
                    }`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </section>

      {/* CARD 1: FOCUSED HERO SUMMARY WITH OVERSIZED CORNER-PEEKING COMPANION (BAEMIN / Plopp Style) */}
      <Card aria-labelledby="hero-today-heading">
        {/* Companion Pastel Stage Banner with Oversized Corner-Peeking Mascot */}
        <div
          style={{ backgroundColor: activeBuddy.cardBgHex }}
          className="relative overflow-hidden rounded-[26px] border border-[#191919]/12 p-4 text-[#191919] transition-colors"
        >
          {/* Luminous White Contrast Halo behind the Mascot so it Pops Vividly */}
          <div className="pointer-events-none absolute -right-8 -bottom-8 h-40 w-40 rounded-full border-2 border-[#FFFFFF] bg-[#FFFFFF]/75 shadow-sm" />
          <div className="pointer-events-none absolute -top-6 right-16 h-16 w-16 rounded-full bg-[#FAFAFA]/45" />

          {/* Left Hero Data & Live Speech Bubble (padded right so text never collides with oversized mascot) */}
          <div className="relative z-10 min-w-0 pr-24 sm:pr-28">
            {/* Companion Identity & 1-Tap Theme Switcher Pill (Cycles companion/theme directly without restarting Onboarding!) */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const order = ['pop', 'cobalt', 'matcha', 'flamingo', 'sunny', 'rose'] as const;
                  const idx = order.indexOf(avatarId);
                  const nextId = order[(idx + 1) % order.length] ?? 'cobalt';
                  setAvatarId(nextId);
                }}
                data-testid="hero-companion-badge"
                title={isVi ? 'Chạm để đổi màu nhân vật' : 'Tap to switch companion theme'}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#191919]/15 bg-[#FAFAFA]/90 px-2.5 py-0.5 text-[10px] font-black text-[#191919] shadow-2xs transition hover:bg-[#FAFAFA]"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: activeBuddy.characterFillHex }}
                />
                <span>{buddyDisplayName}</span>
                <span className="text-[#191919]/40">·</span>
                <span className="text-[#191919]/75">{buddyTrait}</span>
              </button>

              {selectedDateIso !== todayIso && (
                <button
                  type="button"
                  onClick={() => setSelectedDateIso(todayIso)}
                  className="rounded-full bg-[#191919] px-2.5 py-0.5 text-[10px] font-bold text-[#FAFAFA]"
                >
                  {isVi ? 'Về Hôm nay' : 'Back to Today'}
                </button>
              )}
            </div>

            <p
              id="hero-today-heading"
              className="text-[11px] font-extrabold tracking-wider text-[#191919]/70 uppercase"
            >
              {selectedDateIso === todayIso
                ? t.hero.todaySpentLabel
                : isVi
                  ? `CHI TIÊU NGÀY ${selectedDateIso}`
                  : `SPENT ON ${selectedDateIso}`}
            </p>

            {/* Hero Number: Your True Personal Spending */}
            <p
              className="mt-0.5 text-3xl font-black tracking-tight text-[#191919] sm:text-4xl tabular-nums"
              data-testid="today-spent-amount"
            >
              {formatMoney(selectedDayReport.totalExpenseBaseMinor, 'VND', {
                hidden: hideBalances,
              })}
            </p>

            {/* Single Compact Metadata Line */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FAFAFA]/85 px-2.5 py-1 text-[11px] font-bold text-[#191919]/80 shadow-2xs">
                <span>{t.hero.monthSpentLabel}:</span>
                <strong
                  className="font-black text-[#191919] tabular-nums"
                  data-testid="month-spent-amount"
                >
                  {formatMoney(monthReport.totalExpenseBaseMinor, 'VND', { hidden: hideBalances })}
                </strong>
                {momComparison.deltaPercentage !== null && (
                  <span className="text-[10px] font-extrabold text-[#191919]/65">
                    (
                    {momComparison.deltaPercentage > 0
                      ? `+${momComparison.deltaPercentage}%`
                      : `${momComparison.deltaPercentage}%`}
                    )
                  </span>
                )}
              </span>

              {selectedDayLentMinor > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#191919] px-2.5 py-1 text-[11px] font-bold text-[#FAFAFA] tabular-nums">
                  <Users className="h-3 w-3 shrink-0" />
                  <span className="whitespace-nowrap">
                    {isVi ? 'Ứng hộ: ' : 'Advanced: '}+
                    {formatMoney(selectedDayLentMinor, 'VND', { hidden: hideBalances })}
                  </span>
                </span>
              )}
            </div>

            {/* Live Companion Speech Bubble */}
            <button
              type="button"
              onClick={() => openBudgetSheet('caps')}
              className="mt-2.5 inline-flex max-w-full items-center gap-1.5 rounded-2xl border border-[#191919]/10 bg-[#FAFAFA]/92 px-3 py-1.5 text-left text-[11px] leading-snug font-extrabold text-[#191919] shadow-2xs transition hover:bg-[#FAFAFA]"
            >
              <span className="line-clamp-2">{interactiveQuote ?? coachBubbleText}</span>
            </button>
          </div>

          {/* OVERSIZED CORNER-PEEKING MASCOT (BAEMIN / Grab / Plopp Style — 138px peeking from bottom-right!) */}
          <button
            type="button"
            onClick={() => setBuddyTapCount((c) => c + 1)}
            data-testid="hero-mascot-stage"
            className="group absolute -right-4 -bottom-5 z-10 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
            aria-label={coachBubbleText}
            title={isVi ? 'Chạm vào linh vật để trò chuyện!' : 'Tap your buddy to interact!'}
          >
            <GeometricBuddy
              shape={activeBuddy.shape}
              colorHex={activeBuddy.characterFillHex}
              accessory={activeBuddy.accessory}
              blush
              mood={effectiveBuddyMood}
              pose={heroElephantPose}
              size={138}
              label={buddyDisplayName}
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
            style={{ backgroundColor: `${activeBuddy.cardBgHex}40` }}
            className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border-hairline)] px-3 py-2.5 text-left transition hover:border-[var(--border-strong)]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Được tiêu / ngày' : 'Safe to spend / day'}
                </span>
                {overview.exceededCategories.length > 0 ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#EF4444]" />
                ) : overview.warningCategories.length > 0 ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#F59E0B]" />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#52C470]" />
                )}
              </div>
              <p
                className="mt-0.5 truncate text-xs font-black text-[var(--ink-primary)] tabular-nums"
                data-testid="home-daily-safe-amount"
              >
                {formatMoney(overview.effectiveDailySafeMinor, 'VND', { hidden: hideBalances })}
                {overview.effectiveDailySafeMinor === 0 && (
                  <span className="ml-1.5 text-[10px] font-bold text-[#FF7A1A]">
                    {isVi ? '· Chạm đặt hạn mức →' : '· Tap to set cap →'}
                  </span>
                )}
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

        {/* 4 Pastel-Tinted Mascot Flow Shortcut Tiles (Rich color-coded pastel stages!) */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {coreFlowShortcuts.map((flow) => (
            <button
              key={flow.id}
              type="button"
              data-testid={`home-shortcut-${flow.id}`}
              onClick={() => handleFlowShortcutClick(flow.id)}
              style={{
                backgroundColor: flow.tileBgHex,
                borderColor: flow.tileBorderHex,
              }}
              className="group relative flex flex-col items-center justify-between gap-1.5 overflow-hidden rounded-2xl border px-1.5 pt-2.5 pb-2 shadow-2xs transition hover:-translate-y-0.5 hover:border-[#191919] hover:shadow-xs active:scale-95"
            >
              <span className="relative flex h-12 w-12 items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <span
                  style={{ backgroundColor: flow.haloBgHex }}
                  className="pointer-events-none absolute inset-0.5 rounded-full opacity-80 shadow-2xs"
                />
                <span className="relative z-10">{flow.icon}</span>
              </span>
              <span className="relative z-10 text-[11px] font-black text-[#191919]">
                {flow.label}
              </span>
            </button>
          ))}
        </div>

        {(activeTxs.length === 0 ||
          (selectedDateIso === todayIso && todayReport.totalExpenseBaseMinor === 0)) && (
          <Card.Footer className="flex flex-col gap-2">
            {activeTxs.length === 0 && (
              <>
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/75 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-extrabold text-[var(--ink-primary)]">
                      {isVi
                        ? '⚡ Chạm thử 1 món bên dưới để ghi trong 3 giây:'
                        : '⚡ Tap a sample below to log in 3 seconds:'}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(isVi
                      ? [
                          { label: '☕ Cafe 35k', preset: 'Cafe 35k' },
                          { label: '🍜 Ăn trưa 55k', preset: 'Ăn trưa 55k' },
                          { label: '🛵 Grab 40k', preset: 'Grab 40k' },
                          { label: '🧋 Trà sữa 45k', preset: 'Trà sữa 45k' },
                        ]
                      : [
                          { label: '☕ Coffee 35k', preset: 'Coffee 35k' },
                          { label: '🍜 Lunch 55k', preset: 'Lunch 55k' },
                          { label: '🛵 Grab 40k', preset: 'Grab 40k' },
                          { label: '🧋 Boba 45k', preset: 'Boba 45k' },
                        ]
                    ).map((sample) => (
                      <button
                        key={sample.preset}
                        type="button"
                        onClick={() =>
                          openQuickAdd({
                            kind: 'expense',
                            dateIso: selectedDateIso,
                            presetText: sample.preset,
                          })
                        }
                        className="rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-primary)] shadow-2xs transition hover:border-[#141413] hover:scale-[1.02]"
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                </div>

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
              </>
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
                      void budgetRepository
                        .setupOrConfirmMonthlySalaryAtomic({
                          amountMinor: salaryStatus.suggestedAmountMinor,
                          paydayDayOfMonth: salaryStatus.paydayDayOfMonth,
                          accountId: targetAccId,
                          pocketId: salaryStatus.defaultPocketId,
                          referenceDateIso: todayIso,
                          confirmForCurrentMonth: true,
                          title: isVi ? 'Lương hàng tháng' : 'Monthly Salary',
                        })
                        .then(() => {
                          const formattedSalary = formatMoney(
                            salaryStatus.suggestedAmountMinor,
                            'VND',
                          );
                          useUiStore.getState().triggerCelebration({
                            kind: 'salary_confirmed',
                            variant: 'modal',
                            flowMascot: 'income',
                            amountText: `+${formattedSalary}`,
                            title: isVi
                              ? `Đã nhận lương tháng ${overview.monthKey}! 🎉`
                              : `${overview.monthKey} Salary Confirmed! 🎉`,
                            subtitle: isVi
                              ? `Đã cộng +${formattedSalary} vào ví của bạn.`
                              : `Added +${formattedSalary} to your wallet.`,
                          });
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
            <div className="flex items-center gap-1.5">
              {netWorthMinor > 0 ? (
                <span className="inline-block rounded-full bg-[#10B981]/12 px-2 py-0.5 text-[10px] font-bold text-[#059669]">
                  {t.accounts.spendableBadge}
                </span>
              ) : (
                defaultReconcilePocket && (
                  <button
                    type="button"
                    data-testid="home-set-opening-balance-btn"
                    onClick={() => setReconcilingPocket(defaultReconcilePocket)}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--ink-primary)] transition hover:bg-[#141413] hover:text-white"
                  >
                    <Scale className="h-3 w-3" />
                    <span>{isVi ? 'Nhập số dư thực tế →' : 'Set opening balance →'}</span>
                  </button>
                )
              )}
            </div>
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
                const matchingPocket =
                  displayPockets.find(
                    (p) => p.account_id === acc.id && (p.currency ?? 'VND') === 'VND',
                  ) ??
                  displayPockets.find((p) => p.account_id === acc.id) ??
                  null;

                return (
                  <li key={acc.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (acc.cached_balance_minor === 0 && matchingPocket) {
                          setReconcilingPocket(matchingPocket);
                          return;
                        }
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
                          <p className="text-sm font-bold text-[var(--ink-primary)]">
                            {getAccountDisplayName(acc, locale)}
                          </p>
                          <p className="text-[11px] font-medium text-[var(--ink-secondary)]">
                            {typeMeta.label}
                            {acc.cached_balance_minor === 0 && (
                              <span className="ml-1.5 font-bold text-[#2F5FD0]">
                                {isVi ? '· Chạm nhập số dư' : '· Tap to set balance'}
                              </span>
                            )}
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
                              +
                              {formatMoney(overview.totalFundSurplusMinor, 'VND', {
                                hidden: hideBalances,
                              })}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] font-medium text-[var(--ink-secondary)] tabular-nums">
                        {isVi ? 'Đã góp tháng này: ' : 'Contributed this month: '}
                        <span className="font-semibold text-[#059669]">
                          +
                          {formatMoney(overview.monthlyNetFundContributionMinor, 'VND', {
                            hidden: hideBalances,
                          })}
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
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFA3C5]/25 text-[#D9475C]">
                      <VoiFlowIcon variant="lend-borrow" size={26} />
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
        onReconciled={(feedbackMsg) => {
          triggerCelebration({
            kind: 'reconcile_done',
            variant: 'toast',
            title: isVi ? 'Đã cập nhật số dư thực tế! ✨' : 'Balance updated! ✨',
            subtitle: feedbackMsg,
          });
          setReconcilingPocket(null);
        }}
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
