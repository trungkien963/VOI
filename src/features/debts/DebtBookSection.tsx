import { useState, type FormEvent, type ReactElement } from 'react';
import { ArrowLeftRight, Check, ChevronRight, Copy, HandCoins, Users, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_STARTER_POCKETS, localDb } from '../../db/dexie-schema';
import { debtRepository } from '../../db/repositories/debt-repository';
import { onboardingRepository } from '../../db/repositories/onboarding-repository';
import {
  DEFAULT_SYSTEM_CATEGORIES,
  SYSTEM_CATEGORY_IDS,
} from '../../domain/categories/default-categories';
import { buildPoliteDebtReminderText } from '../../domain/ledger/debt-calculator';
import { formatMoney, parseFlexibleMoneyInput } from '../../domain/money/currency';
import { parseQuickInput } from '../../domain/quick-parser/parser';
import type { Category, DebtDirection, DebtItem } from '../../domain/types/entities';
import { getCategoryDisplayName, useTranslation } from '../../shared/i18n';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyStateCard } from '../../shared/ui/EmptyStateCard';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';

function renderPersonAvatar(displayName: string, isPositive: boolean): ReactElement {
  const initial = (displayName.trim()[0] ?? '?').toUpperCase();
  return (
    <span
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-extrabold ${
        isPositive ? 'bg-[#10B981]/14 text-[#059669]' : 'bg-[#141413]/10 text-[#141413]'
      }`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

type DebtActionMode = 'none' | 'iou' | 'split_bill';
type DebtFilterTab = 'people' | 'they_owe' | 'i_owe';

interface PersonDebtGroup {
  key: string;
  displayName: string;
  items: DebtItem[];
  theyOweMinor: number;
  iOweMinor: number;
  netMinor: number; // positive = they owe me net; negative = I owe them net
}

export function DebtBookSection(): ReactElement {
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';
  const [filterTab, setFilterTab] = useState<DebtFilterTab>('people');
  const [direction, setDirection] = useState<DebtDirection>('they_owe');
  const [actionMode, setActionMode] = useState<DebtActionMode>('none');
  const [selectedPersonKey, setSelectedPersonKey] = useState<string | null>(null);

  // Single IOU Form state
  const [counterpartyName, setCounterpartyName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [debtCategoryId, setDebtCategoryId] = useState<string>(SYSTEM_CATEGORY_IDS.foodDining);
  const [isOpeningDebt, setIsOpeningDebt] = useState(false);
  const [selectedPocketId, setSelectedPocketId] = useState<string>('');

  // Split Bill ("Trả hộ nhóm bạn") Form state
  const [splitTotalText, setSplitTotalText] = useState('');
  const [splitFriendsText, setSplitFriendsText] = useState('');
  const [splitOwnText, setSplitOwnText] = useState('');
  const [splitNote, setSplitNote] = useState('');
  const [splitCategoryId, setSplitCategoryId] = useState<string>(SYSTEM_CATEGORY_IDS.foodDining);

  // Repayment & Notice state
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [partialRepayOpenId, setPartialRepayOpenId] = useState<string | null>(null);
  const [repayAmountById, setRepayAmountById] = useState<Record<string, string>>({});

  const livePockets = useLiveQuery(
    async () => {
      const [accounts, allPockets] = await Promise.all([
        localDb.accounts.toArray(),
        localDb.pockets.toArray(),
      ]);
      const activeAccIds = new Set(accounts.filter((a) => a.archived_at === null).map((a) => a.id));
      return allPockets
        .filter((p) => p.archived_at === null && activeAccIds.has(p.account_id))
        .sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)));
    },
    [],
    [],
  );
  const pockets = livePockets.length > 0 ? livePockets : DEFAULT_STARTER_POCKETS;
  const activePocket =
    pockets.find((p) => p.id === selectedPocketId) ??
    pockets.find((p) => p.is_default && (p.currency ?? 'VND') === 'VND') ??
    pockets[0];

  const allDebts = useLiveQuery(() => debtRepository.listActiveDebts(), [], [] as DebtItem[]);

  const liveCategories = useLiveQuery(() => localDb.categories.toArray(), [], []);
  const expenseCategories: ReadonlyArray<Category> = (
    liveCategories.length > 0
      ? [
          ...DEFAULT_SYSTEM_CATEGORIES,
          ...liveCategories.filter(
            (c) => !DEFAULT_SYSTEM_CATEGORIES.some((sys) => sys.id === c.id),
          ),
        ]
      : DEFAULT_SYSTEM_CATEGORIES
  ).filter((c) => c.kind === 'expense' && c.slug !== 'unknown-expense' && !c.archived_at);

  const openDebts = allDebts.filter((d) => d.status === 'open' && d.remaining_minor > 0);

  const knownFriendNames = Array.from(
    new Set(
      allDebts.map((d) => (d.counterparty_name ?? '').trim()).filter((name) => name.length > 0),
    ),
  );

  // Build Person-Centric Groups (with 2-way netting)
  const personGroupsMap = new Map<string, PersonDebtGroup>();
  for (const debt of openDebts) {
    const rawName = (debt.counterparty_name ?? debt.title ?? 'Khác').trim();
    const key = rawName.toLowerCase();
    let grp = personGroupsMap.get(key);
    if (!grp) {
      grp = {
        key,
        displayName: rawName,
        items: [],
        theyOweMinor: 0,
        iOweMinor: 0,
        netMinor: 0,
      };
      personGroupsMap.set(key, grp);
    }
    grp.items.push(debt);
    if (debt.direction === 'they_owe') {
      grp.theyOweMinor += debt.remaining_minor;
      grp.netMinor += debt.remaining_minor;
    } else {
      grp.iOweMinor += debt.remaining_minor;
      grp.netMinor -= debt.remaining_minor;
    }
  }
  const personGroups = Array.from(personGroupsMap.values()).sort(
    (a, b) => Math.abs(b.netMinor) - Math.abs(a.netMinor),
  );

  const selectedPersonGroup = selectedPersonKey
    ? (personGroupsMap.get(selectedPersonKey) ?? null)
    : null;

  const totalTheyOweMinor = openDebts
    .filter((d) => d.direction === 'they_owe')
    .reduce((sum, d) => sum + d.remaining_minor, 0);

  const totalIOweMinor = openDebts
    .filter((d) => d.direction === 'i_owe')
    .reduce((sum, d) => sum + d.remaining_minor, 0);

  const netPositionMinor = totalTheyOweMinor - totalIOweMinor;

  const filteredFlatDebts = openDebts.filter((d) =>
    filterTab === 'i_owe' ? d.direction === 'i_owe' : d.direction === 'they_owe',
  );

  const handleNoteChangeWithAutoCat = (val: string, target: 'iou' | 'split'): void => {
    if (target === 'iou') {
      setNote(val);
    } else {
      setSplitNote(val);
    }
    if (val.trim()) {
      const parsed = parseQuickInput(val);
      if (parsed.categoryId) {
        if (target === 'iou') setDebtCategoryId(parsed.categoryId);
        else setSplitCategoryId(parsed.categoryId);
      }
    }
  };

  const toggleFriendInSplitList = (friendName: string): void => {
    const current = splitFriendsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = current.some((n) => n.toLowerCase() === friendName.toLowerCase());
    const next = exists
      ? current.filter((n) => n.toLowerCase() !== friendName.toLowerCase())
      : [...current, friendName];
    setSplitFriendsText(next.join(', '));
  };

  const handleCreateDebt = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const principalMinor = parseFlexibleMoneyInput(amountText, 'VND');
    if (!counterpartyName.trim() || principalMinor <= 0) return;

    if (isOpeningDebt || !activePocket) {
      await debtRepository.createOpeningDebtAtomic({
        counterpartyName,
        direction,
        principalMinor,
        note: note.trim() || null,
        categoryId: debtCategoryId,
      });
    } else {
      await debtRepository.createLendOrBorrowAtomic({
        counterpartyName,
        direction,
        principalMinor,
        note: note.trim() || null,
        categoryId: debtCategoryId,
        sourceAccountId: activePocket.account_id,
        sourcePocketId: activePocket.id,
      });
    }

    await onboardingRepository.markStepCompleted(
      direction === 'they_owe' ? 'logged_first_3_expenses' : 'added_income_or_recurring_or_NA',
    );

    setCounterpartyName('');
    setAmountText('');
    setNote('');
    setActionMode('none');
  };

  // Split Bill calculation preview
  const splitTotalMinor = parseFlexibleMoneyInput(splitTotalText, 'VND');
  const friendNames = splitFriendsText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const totalParticipants = friendNames.length + 1;
  const defaultOwnMinor =
    totalParticipants > 1 ? Math.round(splitTotalMinor / totalParticipants) : splitTotalMinor;
  const ownExpenseMinor = splitOwnText.trim()
    ? parseFlexibleMoneyInput(splitOwnText, 'VND')
    : defaultOwnMinor;
  const totalLentMinor = Math.max(0, splitTotalMinor - ownExpenseMinor);
  const perFriendMinor =
    friendNames.length > 0 ? Math.floor(totalLentMinor / friendNames.length) : 0;

  const handleCreateSplitBill = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!activePocket || splitTotalMinor <= 0 || friendNames.length === 0 || totalLentMinor <= 0) {
      return;
    }

    const nowMs = Date.now();
    const shares = friendNames.map((name, idx) => {
      const isLast = idx === friendNames.length - 1;
      const shareAmt = isLast
        ? totalLentMinor - perFriendMinor * (friendNames.length - 1)
        : perFriendMinor;
      return {
        debtId: `debt-split-${nowMs}-${idx}`,
        transactionId: `tx-split-lend-${nowMs}-${idx}`,
        counterpartyId: `cp-${name.toLowerCase().replace(/\s+/g, '-')}`,
        counterpartyName: name,
        amountMinor: shareAmt,
      };
    });

    await debtRepository.createPaidForOthersAtomic({
      groupId: `grp-split-${nowMs}`,
      expenseTransactionId: `tx-split-own-${nowMs}`,
      userId: 'local-user',
      sourceAccountId: activePocket.account_id,
      sourcePocketId: activePocket.id,
      currency: 'VND',
      totalPaidMinor: splitTotalMinor,
      ownExpenseMinor,
      categoryId: splitCategoryId || SYSTEM_CATEGORY_IDS.foodDining,
      note: splitNote.trim() || (isVi ? 'Chia hoá đơn nhóm' : 'Group bill split'),
      shares,
    });

    await onboardingRepository.markStepCompleted('logged_first_3_expenses');

    setSplitTotalText('');
    setSplitFriendsText('');
    setSplitOwnText('');
    setSplitNote('');
    setActionMode('none');
  };

  const handleSettleFull = async (debt: DebtItem): Promise<void> => {
    if (!activePocket || debt.remaining_minor <= 0) return;
    await debtRepository.recordRepaymentAtomic({
      debtId: debt.id,
      amountMinor: debt.remaining_minor,
      accountId: activePocket.account_id,
      pocketId: activePocket.id,
    });
  };

  const handleSettlePersonAll = async (group: PersonDebtGroup): Promise<void> => {
    if (!activePocket) return;
    for (const item of group.items) {
      if (item.remaining_minor > 0 && item.status === 'open') {
        await debtRepository.recordRepaymentAtomic({
          debtId: item.id,
          amountMinor: item.remaining_minor,
          accountId: activePocket.account_id,
          pocketId: activePocket.id,
        });
      }
    }
    setSelectedPersonKey(null);
  };

  const handleNetOffTwoWayPerson = async (group: PersonDebtGroup): Promise<void> => {
    if (!activePocket || group.theyOweMinor <= 0 || group.iOweMinor <= 0) return;
    const offsetAmount = Math.min(group.theyOweMinor, group.iOweMinor);

    let remainingToOffsetTheyOwe = offsetAmount;
    for (const item of group.items.filter((i) => i.direction === 'they_owe')) {
      if (remainingToOffsetTheyOwe <= 0) break;
      const deduct = Math.min(item.remaining_minor, remainingToOffsetTheyOwe);
      if (deduct > 0) {
        await debtRepository.recordRepaymentAtomic({
          debtId: item.id,
          amountMinor: deduct,
          accountId: activePocket.account_id,
          pocketId: activePocket.id,
          note: isVi
            ? `Cấn trừ nợ 2 chiều với ${group.displayName}`
            : `Netted off with ${group.displayName}`,
        });
        remainingToOffsetTheyOwe -= deduct;
      }
    }

    let remainingToOffsetIOwe = offsetAmount;
    for (const item of group.items.filter((i) => i.direction === 'i_owe')) {
      if (remainingToOffsetIOwe <= 0) break;
      const deduct = Math.min(item.remaining_minor, remainingToOffsetIOwe);
      if (deduct > 0) {
        await debtRepository.recordRepaymentAtomic({
          debtId: item.id,
          amountMinor: deduct,
          accountId: activePocket.account_id,
          pocketId: activePocket.id,
          note: isVi
            ? `Cấn trừ nợ 2 chiều với ${group.displayName}`
            : `Netted off with ${group.displayName}`,
        });
        remainingToOffsetIOwe -= deduct;
      }
    }
  };

  const handlePartialRepay = async (debt: DebtItem): Promise<void> => {
    if (!activePocket) return;
    const rawVal = repayAmountById[debt.id];
    const repayMinor = rawVal
      ? parseFlexibleMoneyInput(rawVal, debt.currency)
      : debt.remaining_minor;
    if (repayMinor <= 0) return;

    await debtRepository.recordRepaymentAtomic({
      debtId: debt.id,
      amountMinor: repayMinor,
      accountId: activePocket.account_id,
      pocketId: activePocket.id,
    });
    setRepayAmountById((prev) => ({ ...prev, [debt.id]: '' }));
    setPartialRepayOpenId(null);
  };

  const handlePersonPoliteReminder = (group: PersonDebtGroup): void => {
    const notesSummary = group.items
      .map((i) => i.note)
      .filter(Boolean)
      .join(', ');
    const msg = buildPoliteDebtReminderText({
      counterpartyName: group.displayName,
      remainingMinor: Math.abs(group.netMinor),
      currency: 'VND',
      note: notesSummary || null,
      locale,
    });
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(msg);
    }
    setCopiedNotice(msg);
    setTimeout(() => setCopiedNotice(null), 4500);
  };

  return (
    <div className="space-y-3.5">
      {/* Top 3-Column Calm Summary Strip */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setFilterTab('people')}
          className={`rounded-2xl border p-3 text-left transition ${
            filterTab === 'people'
              ? 'border-[#141413] bg-[var(--bg-card)] shadow-2xs'
              : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 opacity-85 hover:opacity-100'
          }`}
        >
          <span className="block truncate text-[10px] font-bold text-[var(--ink-secondary)] uppercase">
            {isVi ? 'Công nợ ròng' : 'Net Balance'}
          </span>
          <p
            className={`mt-1 text-base font-extrabold tabular-nums ${
              netPositionMinor > 0
                ? 'text-[#059669]'
                : netPositionMinor < 0
                  ? 'text-[#E11D48]'
                  : 'text-[var(--ink-primary)]'
            }`}
          >
            {netPositionMinor > 0 ? '+' : ''}
            {formatMoney(netPositionMinor, 'VND')}
          </p>
          <span className="block truncate text-[10px] font-medium text-[var(--ink-muted)]">
            {isVi ? `${personGroups.length} người bạn` : `${personGroups.length} people`}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilterTab('they_owe');
            setDirection('they_owe');
          }}
          className={`rounded-2xl border p-3 text-left transition ${
            filterTab === 'they_owe'
              ? 'border-[#141413] bg-[var(--bg-card)] shadow-2xs'
              : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 opacity-85 hover:opacity-100'
          }`}
        >
          <span className="block truncate text-[10px] font-bold text-[var(--ink-secondary)] uppercase">
            {t.m3.receivableTab}
          </span>
          <p className="mt-1 text-base font-extrabold text-[#059669] tabular-nums">
            +{formatMoney(totalTheyOweMinor, 'VND')}
          </p>
          <span className="block truncate text-[10px] font-medium text-[var(--ink-muted)]">
            {isVi ? 'Họ cần trả bạn' : 'Owed to you'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilterTab('i_owe');
            setDirection('i_owe');
          }}
          className={`rounded-2xl border p-3 text-left transition ${
            filterTab === 'i_owe'
              ? 'border-[#141413] bg-[var(--bg-card)] shadow-2xs'
              : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 opacity-85 hover:opacity-100'
          }`}
        >
          <span className="block truncate text-[10px] font-bold text-[var(--ink-secondary)] uppercase">
            {t.m3.payableTab}
          </span>
          <p className="mt-1 text-base font-extrabold text-[var(--ink-primary)] tabular-nums">
            -{formatMoney(totalIOweMinor, 'VND')}
          </p>
          <span className="block truncate text-[10px] font-medium text-[var(--ink-muted)]">
            {isVi ? 'Bạn cần trả họ' : 'You owe'}
          </span>
        </button>
      </div>

      <Card className="space-y-3">
        {/* Clean Single-Row Action Header (Top 3 KPI Cards already serve as filter tabs) */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-[var(--ink-primary)]">
              {filterTab === 'people'
                ? isVi
                  ? `Hồ sơ theo người (${personGroups.length})`
                  : `By Person (${personGroups.length})`
                : filterTab === 'they_owe'
                  ? t.m3.receivableTab
                  : t.m3.payableTab}
            </h3>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant={actionMode === 'split_bill' ? 'ink' : 'outline'}
              size="xs"
              onClick={() => setActionMode((m) => (m === 'split_bill' ? 'none' : 'split_bill'))}
            >
              <Users className="h-3.5 w-3.5" />
              <span>{isVi ? 'Chia bill' : 'Split Bill'}</span>
            </Button>

            <Button
              variant={actionMode === 'iou' ? 'outline' : 'ink'}
              size="xs"
              onClick={() => setActionMode((m) => (m === 'iou' ? 'none' : 'iou'))}
            >
              {actionMode === 'iou' ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  <span>{isVi ? 'Đóng' : 'Close'}</span>
                </>
              ) : (
                <span>{t.m3.addDebtBtn}</span>
              )}
            </Button>
          </div>
        </div>

        {copiedNotice && (
          <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--ink-primary)]">
            <p className="font-bold">{t.m3.copiedReminderMsg}</p>
            <p className="mt-0.5 text-[11px] text-[var(--ink-secondary)]">{copiedNotice}</p>
          </div>
        )}

        {/* FORM A: Single Debt / IOU */}
        {actionMode === 'iou' && (
          <form
            onSubmit={(e) => void handleCreateDebt(e)}
            className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold text-[var(--ink-primary)]">
                {direction === 'they_owe'
                  ? isVi
                    ? 'Ghi khoản Cho vay'
                    : 'Record Lending'
                  : isVi
                    ? 'Ghi khoản Đi vay'
                    : 'Record Borrowing'}
              </p>
              <SegmentedControl<DebtDirection>
                ariaLabel="Direction"
                size="sm"
                value={direction}
                onChange={setDirection}
                options={[
                  { id: 'they_owe', label: t.m3.receivableTab },
                  { id: 'i_owe', label: t.m3.payableTab },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {t.m3.counterpartyLabel}
                </label>
                <input
                  type="text"
                  required
                  value={counterpartyName}
                  onChange={(e) => setCounterpartyName(e.target.value)}
                  placeholder={isVi ? 'VD: Thế, Quân...' : 'e.g. Alex, Minh...'}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--ink-primary)]"
                />
                {knownFriendNames.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {knownFriendNames.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setCounterpartyName(name)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                          counterpartyName.trim().toLowerCase() === name.toLowerCase()
                            ? 'bg-[#141413] text-white'
                            : 'bg-[var(--bg-card)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {t.m3.principalLabel} (VND)
                </label>
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  placeholder={isVi ? 'VD: 500k' : 'e.g. 500k'}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-extrabold text-[var(--ink-primary)] tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Ghi chú' : 'Note'}
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => handleNoteChangeWithAutoCat(e.target.value, 'iou')}
                  placeholder={isVi ? 'VD: tiền concert...' : 'e.g. Concert...'}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--ink-primary)]"
                />
              </div>

              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Danh mục' : 'Category'}
                </label>
                <select
                  value={debtCategoryId}
                  onChange={(e) => setDebtCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)]"
                >
                  {expenseCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {getCategoryDisplayName(cat, t)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Ví' : 'Wallet'}
                </label>
                <select
                  value={activePocket?.id ?? ''}
                  disabled={isOpeningDebt}
                  onChange={(e) => setSelectedPocketId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)] disabled:opacity-50"
                >
                  {pockets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--ink-secondary)]">
              <input
                type="checkbox"
                checked={isOpeningDebt}
                onChange={(e) => setIsOpeningDebt(e.target.checked)}
                className="h-4 w-4 accent-[#141413]"
              />
              <span>
                {isVi
                  ? 'Khoản nợ cũ (Chỉ ghi sổ theo dõi, KHÔNG trừ/cộng tiền ví hiện tại)'
                  : 'Existing old debt (Track IOU only, do NOT change wallet balance)'}
              </span>
            </label>

            <Button type="submit" variant="ink" size="md" fullWidth>
              {t.m3.addDebtBtn}
            </Button>
          </form>
        )}

        {/* FORM B: Split Bill */}
        {actionMode === 'split_bill' && (
          <form
            onSubmit={(e) => void handleCreateSplitBill(e)}
            className="space-y-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)]/70 p-3.5"
          >
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Tổng bill đã trả (VND)' : 'Total Bill Paid (VND)'}
                </label>
                <input
                  type="text"
                  required
                  inputMode="decimal"
                  value={splitTotalText}
                  onChange={(e) => setSplitTotalText(e.target.value)}
                  placeholder="600000"
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-extrabold text-[var(--ink-primary)] tabular-nums"
                />
              </div>

              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Trả bằng ví' : 'Paid from Wallet'}
                </label>
                <select
                  value={activePocket?.id ?? ''}
                  onChange={(e) => setSelectedPocketId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)]"
                >
                  {pockets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Bạn bè cùng chia (phẩy)' : 'Friends (comma-separated)'}
                </label>
                <input
                  type="text"
                  required
                  value={splitFriendsText}
                  onChange={(e) => setSplitFriendsText(e.target.value)}
                  placeholder={isVi ? 'VD: Thế, Quân' : 'Minh, Lan'}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--ink-primary)]"
                />
                {knownFriendNames.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {knownFriendNames.map((name) => {
                      const active = friendNames.some(
                        (f) => f.toLowerCase() === name.toLowerCase(),
                      );
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleFriendInSplitList(name)}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                            active
                              ? 'bg-[#141413] text-white'
                              : 'bg-[var(--bg-card)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                          }`}
                        >
                          {active ? `✓ ${name}` : `+ ${name}`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Phần riêng bạn (Tự chia đều)' : 'Your Share (Auto-even)'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={splitOwnText}
                  onChange={(e) => setSplitOwnText(e.target.value)}
                  placeholder={String(defaultOwnMinor)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-bold text-[var(--ink-primary)] tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Ghi chú' : 'Note'}
                </label>
                <input
                  type="text"
                  value={splitNote}
                  onChange={(e) => handleNoteChangeWithAutoCat(e.target.value, 'split')}
                  placeholder={isVi ? 'VD: Lẩu Haidilao...' : 'e.g. Friday dinner...'}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--ink-primary)]"
                />
              </div>

              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Danh mục' : 'Category'}
                </label>
                <select
                  value={splitCategoryId}
                  onChange={(e) => setSplitCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)]"
                >
                  {expenseCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {getCategoryDisplayName(cat, t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" variant="ink" size="md" fullWidth>
              {isVi ? 'Lưu Chia bill & Cộng vào hồ sơ bạn bè' : 'Save Split Bill'}
            </Button>
          </form>
        )}

        {/* MASTER LIST: Clean 1-Row Cards (Tap to open Detail Sheet) */}
        {filterTab === 'people' ? (
          personGroups.length === 0 ? (
            <div className="pt-1">
              <EmptyStateCard
                clusterVariant="handshake-debt"
                title={t.walletsTab.debtsEmptyTitle}
                subtitle={t.walletsTab.debtsEmptyDesc}
              />
            </div>
          ) : (
            <Card.Body className="divide-y divide-[var(--border-hairline)]">
              {personGroups.map((group) => {
                const isTwoWay = group.theyOweMinor > 0 && group.iOweMinor > 0;
                const notesPreview = group.items
                  .map((i) => i.note || (i.direction === 'they_owe' ? 'Cho vay' : 'Đi vay'))
                  .join(' · ');

                return (
                  <button
                    key={group.key}
                    type="button"
                    data-testid={`person-debt-card-${group.key}`}
                    onClick={() => setSelectedPersonKey(group.key)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-[var(--bg-subtle)]/50"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      {renderPersonAvatar(group.displayName, group.netMinor >= 0)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-extrabold text-[var(--ink-primary)]">
                            {group.displayName}
                          </span>
                          <span className="rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ink-secondary)]">
                            {isVi ? `${group.items.length} khoản` : `${group.items.length} items`}
                          </span>
                          {isTwoWay && (
                            <span className="rounded-md bg-[#F59E0B]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#B45309]">
                              {isVi ? 'Nợ 2 chiều' : '2-way'}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[var(--ink-secondary)]">
                          {notesPreview}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p
                          className={`text-sm font-extrabold tabular-nums ${
                            group.netMinor > 0
                              ? 'text-[#059669]'
                              : group.netMinor < 0
                                ? 'text-[#E11D48]'
                                : 'text-[var(--ink-primary)]'
                          }`}
                        >
                          {group.netMinor > 0
                            ? `+${formatMoney(group.netMinor, 'VND')}`
                            : group.netMinor < 0
                              ? `-${formatMoney(Math.abs(group.netMinor), 'VND')}`
                              : '0đ'}
                        </p>
                        <span className="text-[10px] font-semibold text-[var(--ink-muted)]">
                          {group.netMinor > 0
                            ? isVi
                              ? 'Cần thu về'
                              : 'Owed to you'
                            : group.netMinor < 0
                              ? isVi
                                ? 'Cần trả thêm'
                                : 'You owe net'
                              : isVi
                                ? 'Cân bằng'
                                : 'Even'}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" />
                    </div>
                  </button>
                );
              })}
            </Card.Body>
          )
        ) : filteredFlatDebts.length === 0 ? (
          <div className="pt-1">
            <EmptyStateCard
              clusterVariant="handshake-debt"
              title={t.walletsTab.debtsEmptyTitle}
              subtitle={t.walletsTab.debtsEmptyDesc}
            />
          </div>
        ) : (
          <Card.Body className="divide-y divide-[var(--border-hairline)]">
            {filteredFlatDebts.map((debt) => {
              const personKey = (debt.counterparty_name ?? debt.title ?? 'Khác')
                .trim()
                .toLowerCase();
              return (
                <button
                  key={debt.id}
                  type="button"
                  onClick={() => setSelectedPersonKey(personKey)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-[var(--bg-subtle)]/50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {renderPersonAvatar(
                      debt.counterparty_name ?? debt.title,
                      debt.direction === 'they_owe',
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-[var(--ink-primary)]">
                        {debt.counterparty_name ?? debt.title}
                      </p>
                      <p className="truncate text-xs text-[var(--ink-secondary)]">
                        {debt.note || t.m3.principalLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`text-sm font-extrabold tabular-nums ${
                        debt.direction === 'they_owe'
                          ? 'text-[#059669]'
                          : 'text-[var(--ink-primary)]'
                      }`}
                    >
                      {debt.direction === 'they_owe' ? '+' : '-'}
                      {formatMoney(debt.remaining_minor, debt.currency)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" />
                  </div>
                </button>
              );
            })}
          </Card.Body>
        )}
      </Card>

      {/* DETAIL SHEET: Person Debt Breakdown & Settlement Actions */}
      <BottomSheet
        open={Boolean(selectedPersonGroup)}
        onClose={() => {
          setSelectedPersonKey(null);
          setPartialRepayOpenId(null);
        }}
        title={
          selectedPersonGroup
            ? isVi
              ? `Hồ sơ công nợ · ${selectedPersonGroup.displayName}`
              : `Debt Profile · ${selectedPersonGroup.displayName}`
            : ''
        }
        titleId="person-debt-detail-title"
        closeLabel={isVi ? 'Đóng' : 'Close'}
        headerAccessory={
          selectedPersonGroup
            ? renderPersonAvatar(selectedPersonGroup.displayName, selectedPersonGroup.netMinor >= 0)
            : undefined
        }
      >
        {selectedPersonGroup && (
          <div className="space-y-3.5">
            {/* Net Summary Banner inside Detail Sheet */}
            <div className="grid grid-cols-3 divide-x divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 py-2.5 text-center">
              <div className="px-2">
                <span className="block text-[10px] font-semibold text-[var(--ink-secondary)]">
                  {isVi ? 'Họ nợ bạn' : 'Owes You'}
                </span>
                <strong className="mt-0.5 block text-xs font-extrabold text-[#059669] tabular-nums">
                  +{formatMoney(selectedPersonGroup.theyOweMinor, 'VND')}
                </strong>
              </div>
              <div className="px-2">
                <span className="block text-[10px] font-semibold text-[var(--ink-secondary)]">
                  {isVi ? 'Bạn nợ họ' : 'You Owe'}
                </span>
                <strong className="mt-0.5 block text-xs font-extrabold text-[var(--ink-primary)] tabular-nums">
                  -{formatMoney(selectedPersonGroup.iOweMinor, 'VND')}
                </strong>
              </div>
              <div className="px-2">
                <span className="block text-[10px] font-semibold text-[var(--ink-secondary)]">
                  {isVi ? 'Số dư ròng' : 'Net'}
                </span>
                <strong
                  className={`mt-0.5 block text-xs font-extrabold tabular-nums ${
                    selectedPersonGroup.netMinor >= 0 ? 'text-[#059669]' : 'text-[#E11D48]'
                  }`}
                >
                  {selectedPersonGroup.netMinor > 0 ? '+' : ''}
                  {formatMoney(selectedPersonGroup.netMinor, 'VND')}
                </strong>
              </div>
            </div>

            {/* Individual Items List */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-[var(--ink-secondary)]">
                {isVi
                  ? `Chi tiết các khoản đang mở (${selectedPersonGroup.items.length})`
                  : `Open items (${selectedPersonGroup.items.length})`}
              </p>
              <div className="divide-y divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3">
                {selectedPersonGroup.items.map((item) => {
                  const isPartialOpen = partialRepayOpenId === item.id;
                  return (
                    <div key={item.id} className="space-y-2 py-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-[var(--ink-primary)]">
                            {item.note ||
                              (item.direction === 'they_owe'
                                ? isVi
                                  ? 'Khoản cho vay'
                                  : 'Lent'
                                : isVi
                                  ? 'Khoản đi vay'
                                  : 'Borrowed')}
                          </p>
                          <p className="text-[11px] text-[var(--ink-secondary)]">
                            {item.direction === 'they_owe'
                              ? isVi
                                ? `${selectedPersonGroup.displayName} nợ bạn`
                                : `${selectedPersonGroup.displayName} owes you`
                              : isVi
                                ? `Bạn nợ ${selectedPersonGroup.displayName}`
                                : `You owe ${selectedPersonGroup.displayName}`}{' '}
                            · {t.m3.principalLabel}:{' '}
                            {formatMoney(item.principal_minor, item.currency)}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`font-extrabold tabular-nums ${
                              item.direction === 'they_owe'
                                ? 'text-[#059669]'
                                : 'text-[var(--ink-primary)]'
                            }`}
                          >
                            {item.direction === 'they_owe' ? '+' : '-'}
                            {formatMoney(item.remaining_minor, item.currency)}
                          </span>

                          <button
                            type="button"
                            onClick={() => setPartialRepayOpenId(isPartialOpen ? null : item.id)}
                            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-1.5 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                            title={isVi ? 'Thu/Trả 1 phần' : 'Partial Pay'}
                          >
                            <HandCoins className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleSettleFull(item)}
                            className="rounded-lg bg-[#141413] px-2.5 py-1 text-[10px] font-bold text-white hover:opacity-90"
                          >
                            {item.direction === 'they_owe'
                              ? isVi
                                ? 'Đã thu'
                                : 'Settle'
                              : isVi
                                ? 'Đã trả'
                                : 'Pay'}
                          </button>
                        </div>
                      </div>

                      {isPartialOpen && (
                        <div className="flex items-center gap-2 rounded-xl bg-[var(--bg-subtle)] p-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={repayAmountById[item.id] ?? ''}
                            onChange={(e) =>
                              setRepayAmountById((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            placeholder={String(item.remaining_minor)}
                            className="flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-bold text-[var(--ink-primary)] tabular-nums"
                          />
                          <Button
                            variant="ink"
                            size="xs"
                            onClick={() => void handlePartialRepay(item)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>{t.m3.recordRepayBtn}</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Primary Person-Level Actions */}
            <div className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
              {selectedPersonGroup.theyOweMinor > 0 && selectedPersonGroup.iOweMinor > 0 && (
                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  onClick={() => void handleNetOffTwoWayPerson(selectedPersonGroup)}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>
                    {isVi
                      ? `Cấn trừ nợ 2 chiều (${formatMoney(
                          Math.min(selectedPersonGroup.theyOweMinor, selectedPersonGroup.iOweMinor),
                          'VND',
                        )})`
                      : 'Net Off 2-Way Balance'}
                  </span>
                </Button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ink"
                  size="md"
                  fullWidth
                  onClick={() => void handleSettlePersonAll(selectedPersonGroup)}
                >
                  <Check className="h-4 w-4" />
                  <span>
                    {isVi
                      ? `Tất toán hết (${selectedPersonGroup.displayName})`
                      : `Settle All (${selectedPersonGroup.displayName})`}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  onClick={() => handlePersonPoliteReminder(selectedPersonGroup)}
                >
                  <Copy className="h-4 w-4" />
                  <span>{t.m3.politeRemindBtn}</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
