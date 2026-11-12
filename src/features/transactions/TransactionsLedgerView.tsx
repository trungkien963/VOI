import { useState, type ReactElement } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUiStore } from '../../app/ui-store';
import { localDb } from '../../db/dexie-schema';
import { tagRepository } from '../../db/repositories/tag-repository';
import { transactionRepository } from '../../db/repositories/transaction-repository';
import { DEFAULT_SYSTEM_CATEGORIES } from '../../domain/categories/default-categories';
import { summarizeTransactionGroup } from '../../domain/ledger/paid-for-others';
import { formatMoney } from '../../domain/money/currency';
import { normalizeVietnamese } from '../../domain/quick-parser/amount-extractor';
import { resolveEffectiveCategoryId } from '../../domain/quick-parser/parser';
import type { Category, Transaction } from '../../domain/types/entities';
import { getCategoryDisplayName, useTranslation } from '../../shared/i18n';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyStateCard } from '../../shared/ui/EmptyStateCard';
import { CategoryIcon } from '../../shared/ui/CategoryIcon';
import { GeometricBuddy } from '../../shared/ui/GeometricBuddy';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';
import { getAvatarPresetMeta } from '../onboarding/WelcomeOnboardingModal';

type LedgerMode = 'list' | 'calendar';
type TypeFilter = 'all' | 'expense' | 'income' | 'transfer';

function formatCompactVnd(amountMinor: number): string {
  const abs = Math.abs(amountMinor);
  const sign = amountMinor < 0 ? '-' : amountMinor > 0 ? '+' : '';
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}tr`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}k`;
  }
  return `${sign}${abs}`;
}

function shiftYearMonth(ym: string, deltaMonths: number): string {
  const [yStr, mStr] = ym.split('-');
  const year = Number(yStr) || 2026;
  const monthZero = (Number(mStr) || 1) - 1 + deltaMonths;
  const d = new Date(Date.UTC(year, monthZero, 1));
  return d.toISOString().slice(0, 7);
}

export function TransactionsLedgerView(): ReactElement {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<LedgerMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [lastDeletedTxId, setLastDeletedTxId] = useState<string | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<string>(() => todayIso.slice(0, 7));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayIso);
  const { hideBalances, avatarId, openEditTransaction, openQuickAdd } = useUiStore();
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';
  const activeBuddy = getAvatarPresetMeta(avatarId);

  const transactions = useLiveQuery(
    async () => {
      const all = await localDb.transactions.toArray();
      return all
        .filter((tx) => tx.voided_at === null && tx.status !== 'void')
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    },
    [],
    [],
  );

  const liveDebts = useLiveQuery(() => localDb.debt_items.toArray(), [], []);

  const tagsByTxId = useLiveQuery(
    () => tagRepository.getTagsByTransactionIdMap(),
    [],
    {} as Record<string, string[]>,
  );

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

  const normQuery = normalizeVietnamese(searchQuery.replace(/^#/, ''));
  const filteredTransactions = transactions.filter((tx) => {
    if (typeFilter === 'expense') {
      if (
        tx.type !== 'expense' &&
        tx.type !== 'credit_card_spend' &&
        tx.type !== 'debt_lend' &&
        tx.type !== 'debt_borrow' &&
        tx.type !== 'debt_repay'
      ) {
        return false;
      }
    } else if (typeFilter === 'income') {
      if (tx.type !== 'income' && tx.type !== 'debt_collect') return false;
    } else if (typeFilter !== 'all' && tx.type !== typeFilter) {
      return false;
    }
    if (!normQuery) return true;
    const effectiveCatId = resolveEffectiveCategoryId(tx);
    const cat = allCategories.find((c) => c.id === effectiveCatId);
    const catName = cat ? normalizeVietnamese(getCategoryDisplayName(cat, t)) : '';
    const noteNorm = normalizeVietnamese(tx.note ?? '');
    const txTags = tagsByTxId[tx.id] ?? [];
    const hasTagMatch = txTags.some((tag) => normalizeVietnamese(tag).includes(normQuery));
    return noteNorm.includes(normQuery) || catName.includes(normQuery) || hasTagMatch;
  });

  // Consolidate companion debt_lend rows into their parent Split Bill expense row
  const splitExpenseGroupIds = new Set(
    filteredTransactions
      .filter((tx) => tx.type === 'expense' && tx.group_id)
      .map((tx) => tx.group_id as string),
  );

  // Group filtered transactions by txn_date (Section 8.4)
  const groupedByDate: Array<{
    date: string;
    items: Transaction[];
    dayNetMinor: number;
    dayOwnExpenseMinor: number;
    dayLentMinor: number;
  }> = [];
  const groupMapByDate = new Map<
    string,
    {
      date: string;
      items: Transaction[];
      dayNetMinor: number;
      dayOwnExpenseMinor: number;
      dayLentMinor: number;
    }
  >();

  for (const tx of filteredTransactions) {
    let group = groupMapByDate.get(tx.txn_date);
    if (!group) {
      group = {
        date: tx.txn_date,
        items: [],
        dayNetMinor: 0,
        dayOwnExpenseMinor: 0,
        dayLentMinor: 0,
      };
      groupedByDate.push(group);
      groupMapByDate.set(tx.txn_date, group);
    }

    if (tx.type === 'expense' || tx.type === 'credit_card_spend') {
      group.dayNetMinor -= Math.abs(tx.amount_minor);
      group.dayOwnExpenseMinor += Math.abs(tx.amount_minor);
    } else if (tx.type === 'debt_lend') {
      group.dayNetMinor -= Math.abs(tx.amount_minor);
      group.dayLentMinor += Math.abs(tx.amount_minor);
    } else if (tx.type === 'debt_repay') {
      group.dayNetMinor -= Math.abs(tx.amount_minor);
    } else if (tx.type === 'income' || tx.type === 'debt_collect') {
      group.dayNetMinor += Math.abs(tx.amount_minor);
    }

    const isCompanionSplitLend =
      tx.type === 'debt_lend' && Boolean(tx.group_id && splitExpenseGroupIds.has(tx.group_id));
    if (!isCompanionSplitLend) {
      group.items.push(tx);
    }
  }

  // Build Calendar Grid for `calendarMonth`
  const [calYearStr, calMonthStr] = calendarMonth.split('-');
  const calYear = Number(calYearStr) || 2026;
  const calMonthOne = Number(calMonthStr) || 1;
  const daysInMonth = new Date(Date.UTC(calYear, calMonthOne, 0)).getUTCDate();
  const firstDayDow = new Date(Date.UTC(calYear, calMonthOne - 1, 1)).getUTCDay();
  const leadingEmptySlots = firstDayDow === 0 ? 6 : firstDayDow - 1; // Monday-first

  const monthExpenseMinor = filteredTransactions
    .filter(
      (tx) =>
        tx.txn_date.startsWith(calendarMonth) &&
        (tx.type === 'expense' || tx.type === 'credit_card_spend'),
    )
    .reduce((acc, tx) => acc + Math.abs(tx.amount_minor), 0);
  const monthLentMinor = filteredTransactions
    .filter((tx) => tx.txn_date.startsWith(calendarMonth) && tx.type === 'debt_lend')
    .reduce((acc, tx) => acc + Math.abs(tx.amount_minor), 0);
  const monthIncomeMinor = filteredTransactions
    .filter(
      (tx) =>
        tx.txn_date.startsWith(calendarMonth) &&
        (tx.type === 'income' || tx.type === 'credit_card_refund'),
    )
    .reduce((acc, tx) => acc + Math.abs(tx.amount_minor), 0);

  const selectedDayGroup = groupMapByDate.get(selectedCalendarDate) ?? {
    date: selectedCalendarDate,
    items: [],
    dayNetMinor: 0,
    dayOwnExpenseMinor: 0,
    dayLentMinor: 0,
  };

  const handleDelete = async (txId: string): Promise<void> => {
    await transactionRepository.softDeleteTransactionAtomic(txId);
    setLastDeletedTxId(txId);
  };

  const handleUndo = async (): Promise<void> => {
    if (!lastDeletedTxId) return;
    await transactionRepository.restoreTransactionAtomic(lastDeletedTxId);
    setLastDeletedTxId(null);
  };

  const selectedTx = selectedTxId
    ? (transactions.find((tx) => tx.id === selectedTxId) ?? null)
    : null;

  // Master Row: Compact 2-line scannable row. Tapping opens Digital Receipt BottomSheet.
  const renderTransactionRow = (tx: Transaction): ReactElement => {
    const effectiveCatId = resolveEffectiveCategoryId(tx);
    const cat = allCategories.find((c) => c.id === effectiveCatId);
    const isDebtTx =
      tx.type === 'debt_lend' ||
      tx.type === 'debt_borrow' ||
      tx.type === 'debt_repay' ||
      tx.type === 'debt_collect';
    const linkedDebt = tx.debt_id ? liveDebts.find((d) => d.id === tx.debt_id) : undefined;

    const catDisplayName = cat ? getCategoryDisplayName(cat, t) : null;
    const counterpartySuffix = linkedDebt
      ? tx.type === 'debt_borrow'
        ? isVi
          ? `Nợ ${linkedDebt.counterparty_name}`
          : `Owe ${linkedDebt.counterparty_name}`
        : tx.type === 'debt_lend'
          ? isVi
            ? `Cho ${linkedDebt.counterparty_name} vay`
            : `Lent to ${linkedDebt.counterparty_name}`
          : tx.type === 'debt_repay'
            ? isVi
              ? `Trả nợ ${linkedDebt.counterparty_name}`
              : `Repaid ${linkedDebt.counterparty_name}`
            : isVi
              ? `Thu nợ ${linkedDebt.counterparty_name}`
              : `Collected from ${linkedDebt.counterparty_name}`
      : null;

    const groupSummary =
      tx.group_id && tx.type === 'expense'
        ? summarizeTransactionGroup(tx.group_id, transactions)
        : null;

    const companionFriendNames =
      groupSummary && groupSummary.lentMinor > 0 && tx.group_id
        ? transactions
            .filter((item) => item.group_id === tx.group_id && item.type === 'debt_lend')
            .map((item) => {
              const d = item.debt_id ? liveDebts.find((debt) => debt.id === item.debt_id) : null;
              return d?.counterparty_name ?? null;
            })
            .filter((n): n is string => Boolean(n))
        : [];

    const categoryTitle = catDisplayName
      ? catDisplayName
      : tx.type === 'transfer'
        ? t.flows.transfer
        : (tx.note ?? tx.type);

    const primaryLabel = tx.note && tx.note.trim() ? tx.note : categoryTitle;

    const metaBadge =
      isDebtTx && counterpartySuffix
        ? counterpartySuffix
        : groupSummary && groupSummary.lentMinor > 0
          ? isVi
            ? `Chia bill${companionFriendNames.length > 0 ? ` · ${companionFriendNames.join(', ')}` : ''}`
            : `Split${companionFriendNames.length > 0 ? ` · ${companionFriendNames.join(', ')}` : ''}`
          : null;

    const primaryAmountMinor =
      groupSummary && groupSummary.lentMinor > 0
        ? -Math.abs(groupSummary.totalPaidMinor)
        : tx.type === 'expense' ||
            tx.type === 'credit_card_spend' ||
            tx.type === 'debt_lend' ||
            tx.type === 'debt_repay'
          ? -Math.abs(tx.amount_minor)
          : Math.abs(tx.amount_minor);

    const txTags = tagsByTxId[tx.id] ?? [];

    return (
      <div
        key={tx.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedTxId(tx.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelectedTxId(tx.id);
          }
        }}
        className="flex cursor-pointer items-center justify-between gap-3 py-2.5 transition hover:opacity-85"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="shrink-0">
            <CategoryIcon slug={cat?.slug} colorHex={cat?.color_hex} txType={tx.type} size="md" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--ink-primary)]">{primaryLabel}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[var(--ink-secondary)]">
              <span className="truncate">{categoryTitle}</span>
              {metaBadge && (
                <span className="rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ink-secondary)]">
                  {metaBadge}
                </span>
              )}
              {txTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ink-secondary)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
            {groupSummary && groupSummary.lentMinor > 0 && (
              <span data-testid="group-cluster-summary" className="sr-only">
                {t.m3.groupSummaryPrefix}: {formatMoney(groupSummary.totalPaidMinor, tx.currency)} ·{' '}
                {t.m3.yourExpensePrefix}: {formatMoney(groupSummary.ownExpenseMinor, tx.currency)} ·{' '}
                {t.m3.lentToOthersPrefix}: {formatMoney(groupSummary.lentMinor, tx.currency)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <span
              className={`block text-sm font-extrabold tabular-nums ${
                tx.type === 'income' || tx.type === 'debt_collect'
                  ? 'text-[#059669]'
                  : tx.type === 'debt_borrow'
                    ? 'text-[var(--ink-secondary)]'
                    : 'text-[var(--ink-primary)]'
              }`}
            >
              {tx.type === 'debt_borrow'
                ? `${isVi ? 'Nợ ' : 'IOU '}${formatMoney(Math.abs(tx.amount_minor), tx.currency, {
                    hidden: hideBalances,
                  })}`
                : formatMoney(primaryAmountMinor, tx.currency, {
                    hidden: hideBalances,
                    showPlusSign: tx.type === 'income' || tx.type === 'debt_collect',
                  })}
            </span>
            {groupSummary && groupSummary.lentMinor > 0 && (
              <span className="block text-[10px] font-semibold text-[var(--ink-muted)] tabular-nums">
                {isVi ? 'Phần bạn: ' : 'Yours: '}
                {formatMoney(-Math.abs(groupSummary.ownExpenseMinor), tx.currency, {
                  hidden: hideBalances,
                })}
              </span>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3.5">
      {/* Companion Hero Banner for Transactions Screen with Oversized Corner-Peeking VOI */}
      <div
        style={{ backgroundColor: activeBuddy.cardBgHex }}
        className="relative overflow-hidden rounded-[26px] border border-[#191919]/12 p-4 pr-24 text-[#191919] shadow-2xs"
      >
        <div className="pointer-events-none absolute -right-7 -bottom-7 h-32 w-32 rounded-full border-2 border-[#FFFFFF] bg-[#FFFFFF]/75" />
        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-black text-[#191919]">{t.transactionsTab.title}</h2>
              <p className="text-[11px] font-bold text-[#191919]/75">
                {isVi
                  ? `Tháng ${calendarMonth} · ${filteredTransactions.length} giao dịch`
                  : `${calendarMonth} · ${filteredTransactions.length} transactions`}
              </p>
            </div>
            <SegmentedControl<LedgerMode>
              ariaLabel={t.transactionsTab.viewModeAria}
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { id: 'list', label: t.ledgerView.modeList },
                { id: 'calendar', label: t.ledgerView.modeCalendar },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFFFF]/90 px-2.5 py-0.5 text-[11px] font-extrabold text-[#191919] tabular-nums shadow-2xs">
              <span>{isVi ? 'Chi:' : 'Out:'}</span>
              <strong>-{formatMoney(monthExpenseMinor, 'VND', { hidden: hideBalances })}</strong>
            </span>
            {monthLentMinor > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#191919] px-2.5 py-0.5 text-[11px] font-extrabold text-[#FAFAFA] tabular-nums shadow-2xs">
                <span>{isVi ? 'Ứng hộ:' : 'Lent:'}</span>
                <strong>+{formatMoney(monthLentMinor, 'VND', { hidden: hideBalances })}</strong>
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFFFF]/90 px-2.5 py-0.5 text-[11px] font-extrabold text-[#059669] tabular-nums shadow-2xs">
              <span>{isVi ? 'Thu:' : 'In:'}</span>
              <strong>+{formatMoney(monthIncomeMinor, 'VND', { hidden: hideBalances })}</strong>
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute -right-2 -bottom-3 z-10">
          <GeometricBuddy
            shape={activeBuddy.shape}
            pose={
              typeFilter === 'income'
                ? 'coin-toss'
                : typeFilter === 'expense'
                  ? 'memory'
                  : typeFilter === 'transfer'
                    ? 'super'
                    : undefined
            }
            mood="happy"
            size={108}
          />
        </div>
      </div>

      {/* Instant Search & Type Filter Bar (Section 8.4) */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[var(--ink-muted)]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.transactionsTab.searchPlaceholder}
            aria-label={t.transactionsTab.searchPlaceholder}
            className="w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] py-2 pr-3 pl-9 text-xs font-medium text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[#18181B] focus:outline-none"
          />
        </div>

        <SegmentedControl<TypeFilter>
          ariaLabel={t.quickAddModal.typeAria}
          size="sm"
          value={typeFilter}
          onChange={setTypeFilter}
          className="w-full"
          options={[
            { id: 'all', label: t.transactionsTab.filterAll },
            { id: 'expense', label: t.quickAddModal.tabExpense },
            { id: 'income', label: t.quickAddModal.tabIncome },
            { id: 'transfer', label: t.quickAddModal.tabTransfer },
          ]}
        />
      </div>

      {lastDeletedTxId && (
        <div
          role="status"
          className="flex items-center justify-between rounded-2xl border border-[#18181B] bg-[#18181B] px-3.5 py-2.5 text-xs font-semibold text-white"
        >
          <span>{t.transactionsTab.undoToastPrefix}</span>
          <Button variant="pop" size="xs" onClick={() => void handleUndo()}>
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t.transactionsTab.undoBtn}</span>
          </Button>
        </div>
      )}

      {mode === 'list' ? (
        groupedByDate.length === 0 ? (
          <EmptyStateCard
            clusterVariant="calendar-check"
            title={t.transactionsTab.title}
            subtitle={t.transactionsTab.subtitle}
            emptyTitle={t.transactionsTab.emptyTitle}
            emptyDesc={t.transactionsTab.emptyDesc}
          />
        ) : (
          <div className="space-y-3">
            {groupedByDate.map((group) => (
              <Card key={group.date}>
                <Card.Header bordered>
                  <div>
                    <span className="text-xs font-bold text-[var(--ink-primary)] tabular-nums">
                      {group.date}
                    </span>
                    {group.dayLentMinor > 0 && (
                      <p className="text-[11px] font-medium text-[var(--ink-secondary)] tabular-nums">
                        {isVi ? 'Chi riêng: ' : 'Own: '}
                        {formatMoney(-group.dayOwnExpenseMinor, 'VND', {
                          hidden: hideBalances,
                        })}{' '}
                        · {isVi ? 'Trả hộ: ' : 'Lent: '}
                        {formatMoney(-group.dayLentMinor, 'VND', { hidden: hideBalances })}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-extrabold text-[var(--ink-primary)] tabular-nums">
                    {formatMoney(group.dayNetMinor, 'VND', {
                      hidden: hideBalances,
                      showPlusSign: group.dayNetMinor > 0,
                    })}
                  </span>
                </Card.Header>
                <Card.Body className="divide-y divide-[var(--border-hairline)]">
                  {group.items.map((tx) => renderTransactionRow(tx))}
                </Card.Body>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <Card>
            {/* Calendar Month Navigation & Monthly Summary */}
            <Card.Header bordered>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => {
                    const nextYm = shiftYearMonth(calendarMonth, -1);
                    setCalendarMonth(nextYm);
                    setSelectedCalendarDate(`${nextYm}-01`);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--ink-primary)] hover:border-[var(--border-strong)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-1 text-sm font-extrabold text-[var(--ink-primary)] tabular-nums">
                  {calendarMonth}
                </span>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => {
                    const nextYm = shiftYearMonth(calendarMonth, 1);
                    setCalendarMonth(nextYm);
                    setSelectedCalendarDate(`${nextYm}-01`);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--ink-primary)] hover:border-[var(--border-strong)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-bold tabular-nums">
                <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[var(--ink-primary)]">
                  -{formatMoney(monthExpenseMinor, 'VND', { hidden: hideBalances })}
                </span>
                {monthIncomeMinor > 0 && (
                  <span className="rounded-full bg-[#10B981]/12 px-2 py-0.5 text-[#059669]">
                    +{formatMoney(monthIncomeMinor, 'VND', { hidden: hideBalances })}
                  </span>
                )}
              </div>
            </Card.Header>

            {/* Weekday Labels */}
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[var(--ink-muted)] uppercase">
              {[
                t.weekStrip.mon,
                t.weekStrip.tue,
                t.weekStrip.wed,
                t.weekStrip.thu,
                t.weekStrip.fri,
                t.weekStrip.sat,
                t.weekStrip.sun,
              ].map((dLabel) => (
                <span key={dLabel}>{dLabel}</span>
              ))}
            </div>

            {/* Interactive Calendar Days with Daily Net Badge */}
            <Card.Body className="mt-1.5 grid grid-cols-7 gap-1.5 text-center">
              {Array.from({ length: leadingEmptySlots }, (_, i) => (
                <div key={`empty-${i}`} className="h-12" />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((dayNum) => {
                const dayStr = String(dayNum).padStart(2, '0');
                const iso = `${calendarMonth}-${dayStr}`;
                const dayGroup = groupMapByDate.get(iso);
                const isSelected = iso === selectedCalendarDate;
                const isToday = iso === todayIso;
                const hasItems = Boolean(dayGroup && dayGroup.items.length > 0);

                return (
                  <button
                    key={iso}
                    type="button"
                    data-testid={`calendar-day-${iso}`}
                    onClick={() => setSelectedCalendarDate(iso)}
                    className={`flex h-12 flex-col items-center justify-center rounded-xl border px-0.5 transition ${
                      isSelected
                        ? 'border-[#141413] bg-[#141413] text-white shadow-xs'
                        : isToday
                          ? 'border-2 border-[#141413] bg-[var(--bg-card)] text-[var(--ink-primary)]'
                          : hasItems
                            ? 'border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--ink-primary)]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 text-[var(--ink-secondary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <span className="text-xs font-extrabold tabular-nums">{dayStr}</span>
                    {hasItems && dayGroup ? (
                      <span
                        className={`mt-0.5 max-w-full truncate text-[9px] font-extrabold tabular-nums ${
                          isSelected
                            ? 'text-white/90'
                            : dayGroup.dayNetMinor > 0
                              ? 'text-[#059669]'
                              : 'text-[var(--ink-secondary)]'
                        }`}
                      >
                        {hideBalances ? '•••' : formatCompactVnd(dayGroup.dayNetMinor)}
                      </span>
                    ) : (
                      <span className="mt-0.5 text-[9px] opacity-30">·</span>
                    )}
                  </button>
                );
              })}
            </Card.Body>
          </Card>

          {/* Selected Date Detailed Transactions Card */}
          <Card data-testid="calendar-selected-day-card">
            <Card.Header bordered>
              <div>
                <p className="text-xs font-extrabold text-[var(--ink-primary)] tabular-nums">
                  {isVi ? `Ngày ${selectedCalendarDate}` : `Date: ${selectedCalendarDate}`}
                </p>
                <p className="text-[11px] text-[var(--ink-secondary)]">
                  {selectedDayGroup.items.length}{' '}
                  {isVi ? 'giao dịch trong ngày' : 'transaction(s) on this date'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-[var(--ink-primary)] tabular-nums">
                  {formatMoney(selectedDayGroup.dayNetMinor, 'VND', {
                    hidden: hideBalances,
                    showPlusSign: selectedDayGroup.dayNetMinor > 0,
                  })}
                </span>
                <Button
                  variant="ink"
                  size="xs"
                  onClick={() => openQuickAdd({ dateIso: selectedCalendarDate })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isVi ? 'Ghi thêm' : 'Add'}</span>
                </Button>
              </div>
            </Card.Header>

            {selectedDayGroup.items.length === 0 ? (
              <div className="py-5 text-center text-xs font-medium text-[var(--ink-secondary)]">
                {isVi
                  ? 'Không có giao dịch nào trong ngày này. Bấm "+ Ghi thêm" để tạo mới!'
                  : 'No transactions on this date. Tap "+ Add" to log one!'}
              </div>
            ) : (
              <Card.Body className="divide-y divide-[var(--border-hairline)]">
                {selectedDayGroup.items.map((tx) => renderTransactionRow(tx))}
              </Card.Body>
            )}
          </Card>
        </div>
      )}

      {/* Detail Sheet: Digital Receipt for Selected Transaction */}
      <BottomSheet
        open={Boolean(selectedTx)}
        onClose={() => setSelectedTxId(null)}
        title={isVi ? 'Chi tiết giao dịch' : 'Transaction Details'}
        titleId="tx-detail-sheet-title"
        closeLabel={isVi ? 'Đóng' : 'Close'}
      >
        {selectedTx &&
          (() => {
            const effectiveCatId = resolveEffectiveCategoryId(selectedTx);
            const cat = allCategories.find((c) => c.id === effectiveCatId);
            const catDisplayName = cat
              ? getCategoryDisplayName(cat, t)
              : selectedTx.type === 'transfer'
                ? t.flows.transfer
                : selectedTx.type;
            const groupSummary =
              selectedTx.group_id && selectedTx.type === 'expense'
                ? summarizeTransactionGroup(selectedTx.group_id, transactions)
                : null;
            const companionLends =
              groupSummary && groupSummary.lentMinor > 0 && selectedTx.group_id
                ? transactions.filter(
                    (item) => item.group_id === selectedTx.group_id && item.type === 'debt_lend',
                  )
                : [];
            const linkedDebt = selectedTx.debt_id
              ? liveDebts.find((d) => d.id === selectedTx.debt_id)
              : undefined;
            const primaryAmountMinor =
              groupSummary && groupSummary.lentMinor > 0
                ? -Math.abs(groupSummary.totalPaidMinor)
                : selectedTx.type === 'expense' ||
                    selectedTx.type === 'credit_card_spend' ||
                    selectedTx.type === 'debt_lend' ||
                    selectedTx.type === 'debt_repay'
                  ? -Math.abs(selectedTx.amount_minor)
                  : Math.abs(selectedTx.amount_minor);
            const txTags = tagsByTxId[selectedTx.id] ?? [];

            return (
              <div className="space-y-3.5">
                {/* Digital Receipt Hero Header */}
                <div className="flex flex-col items-center rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 text-center">
                  <CategoryIcon
                    slug={cat?.slug}
                    colorHex={cat?.color_hex}
                    txType={selectedTx.type}
                    size="lg"
                  />
                  <p className="mt-2 text-xs font-bold text-[var(--ink-secondary)]">
                    {catDisplayName} · {selectedTx.txn_date}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-[var(--ink-primary)] tabular-nums">
                    {selectedTx.type === 'debt_borrow'
                      ? `${isVi ? 'Nợ ' : 'IOU '}${formatMoney(
                          Math.abs(selectedTx.amount_minor),
                          selectedTx.currency,
                          { hidden: hideBalances },
                        )}`
                      : formatMoney(primaryAmountMinor, selectedTx.currency, {
                          hidden: hideBalances,
                          showPlusSign:
                            selectedTx.type === 'income' || selectedTx.type === 'debt_collect',
                        })}
                  </p>
                  {selectedTx.note && (
                    <p className="mt-1.5 text-sm font-semibold text-[var(--ink-primary)]">
                      “{selectedTx.note}”
                    </p>
                  )}
                  {txTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap justify-center gap-1">
                      {txTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[var(--bg-card)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--ink-secondary)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Split Bill Digital Receipt Breakdown */}
                {groupSummary && groupSummary.lentMinor > 0 && (
                  <div className="space-y-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] p-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--ink-primary)]">
                      <Users className="h-4 w-4 text-[var(--ink-secondary)]" />
                      <span>
                        {isVi ? 'Chi tiết chia hoá đơn nhóm' : 'Group Bill Split Breakdown'}
                      </span>
                    </div>
                    <div className="space-y-1.5 border-t border-[var(--border-hairline)] pt-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--ink-secondary)]">
                          {t.m3.groupSummaryPrefix}
                        </span>
                        <strong className="font-extrabold text-[var(--ink-primary)] tabular-nums">
                          {formatMoney(groupSummary.totalPaidMinor, selectedTx.currency, {
                            hidden: hideBalances,
                          })}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--ink-secondary)]">
                          {t.m3.yourExpensePrefix}
                        </span>
                        <strong className="font-extrabold text-[var(--ink-primary)] tabular-nums">
                          {formatMoney(groupSummary.ownExpenseMinor, selectedTx.currency, {
                            hidden: hideBalances,
                          })}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--ink-secondary)]">
                          {t.m3.lentToOthersPrefix}
                        </span>
                        <strong className="font-extrabold text-[#059669] tabular-nums">
                          +
                          {formatMoney(groupSummary.lentMinor, selectedTx.currency, {
                            hidden: hideBalances,
                          })}
                        </strong>
                      </div>
                    </div>

                    {companionLends.length > 0 && (
                      <div className="space-y-1 border-t border-[var(--border-hairline)] pt-2">
                        <p className="text-[10px] font-bold text-[var(--ink-muted)] uppercase">
                          {isVi ? 'Phần bạn bè cần trả lại bạn' : 'Friends Owe You'}
                        </p>
                        {companionLends.map((comp) => {
                          const debt = comp.debt_id
                            ? liveDebts.find((d) => d.id === comp.debt_id)
                            : null;
                          return (
                            <div
                              key={comp.id}
                              className="flex items-center justify-between rounded-xl bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs"
                            >
                              <span className="font-bold text-[var(--ink-primary)]">
                                {debt?.counterparty_name ?? comp.note ?? 'Friend'}
                              </span>
                              <span className="font-extrabold text-[#059669] tabular-nums">
                                +
                                {formatMoney(Math.abs(comp.amount_minor), comp.currency, {
                                  hidden: hideBalances,
                                })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Linked Debt Info (if single IOU row) */}
                {linkedDebt && (
                  <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--ink-secondary)]">
                        {isVi ? 'Người liên quan' : 'Counterparty'}
                      </span>
                      <strong className="font-extrabold text-[var(--ink-primary)]">
                        {linkedDebt.counterparty_name}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Action Footer: Edit & Delete */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="md"
                    aria-label={t.transactionsTab.editBtn}
                    onClick={() => {
                      const idToEdit = selectedTx.id;
                      setSelectedTxId(null);
                      openEditTransaction(idToEdit);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    <span>{t.transactionsTab.editBtn}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    aria-label={t.transactionsTab.deleteBtn}
                    onClick={() => {
                      const idToDelete = selectedTx.id;
                      setSelectedTxId(null);
                      void handleDelete(idToDelete);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-[#FF6B35]" />
                    <span className="text-[#FF6B35]">{t.transactionsTab.deleteBtn}</span>
                  </Button>
                </div>
              </div>
            );
          })()}
      </BottomSheet>
    </div>
  );
}
