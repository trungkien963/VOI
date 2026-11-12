import { useState, type FormEvent, type ReactElement } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  CreditCard,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  RotateCcw,
  Scale,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUiStore, type WalletSubTabId } from '../../app/ui-store';
import { localDb } from '../../db/dexie-schema';
import { accountRepository } from '../../db/repositories/account-repository';
import { budgetRepository } from '../../db/repositories/budget-repository';
import { pocketRepository } from '../../db/repositories/pocket-repository';
import {
  computeThreeTierFinancialOverview,
  type FundProgressItem,
} from '../../domain/budgets/budget-calculator';
import { mergeSystemAndLiveCategories } from '../../domain/categories/default-categories';
import { computeNetWorth } from '../../domain/ledger/balance-calculator';
import { computeCreditCardSummary } from '../../domain/ledger/credit-card-calculator';
import { formatMoney, parseFlexibleMoneyInput } from '../../domain/money/currency';
import type { Account, AccountType, Pocket } from '../../domain/types/entities';
import { useTranslation, type TranslationDictionary } from '../../shared/i18n';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { EmptyStateCard } from '../../shared/ui/EmptyStateCard';
import { GeometricBuddy } from '../../shared/ui/GeometricBuddy';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';
import { DebtBookSection } from '../debts/DebtBookSection';
import { getAvatarPresetMeta } from '../onboarding/WelcomeOnboardingModal';
import { RecurringSection } from '../recurring/RecurringSection';
import { AccountFormSheet } from './AccountFormSheet';
import { ReconcileSheet } from './ReconcileSheet';

function getWalletTypeMeta(
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

export function AssetsAndDebtsView(): ReactElement {
  const { walletSubTab, setWalletSubTab, hideBalances, avatarId } = useUiStore();
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';
  const activeBuddy = getAvatarPresetMeta(avatarId);
  const todayIso = new Date().toISOString().slice(0, 10);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [confirmArchiveAccountId, setConfirmArchiveAccountId] = useState<string | null>(null);
  const [reconcilingPocket, setReconcilingPocket] = useState<Pocket | null>(null);
  const [reconcileNotice, setReconcileNotice] = useState<string | null>(null);

  // --- Savings & Goal Funds State ---
  const [showAddFund, setShowAddFund] = useState(false);
  const [fundName, setFundName] = useState('');
  const [fundMonthlyTargetText, setFundMonthlyTargetText] = useState('');
  const [fundGoalTargetText, setFundGoalTargetText] = useState('');
  const [fundInitialBalanceText, setFundInitialBalanceText] = useState('');
  const [activeFundTransfer, setActiveFundTransfer] = useState<{
    fund: FundProgressItem;
    direction: 'contribute' | 'withdraw';
  } | null>(null);
  const [fundTransferAmountText, setFundTransferAmountText] = useState('');
  const [fundTransferWalletId, setFundTransferWalletId] = useState('');

  const allAccounts = useLiveQuery(
    async () => {
      const list = await localDb.accounts.toArray();
      return list.sort((a, b) => a.sort_order - b.sort_order);
    },
    [],
    [],
  );

  const accounts = allAccounts.filter((a) => a.archived_at === null);
  const dailyWallets = accounts.filter((a) => a.type !== 'savings');
  const liquidAccounts = accounts.filter(
    (a) => a.type === 'bank' || a.type === 'cash' || a.type === 'e_wallet',
  );
  const archivedAccounts = allAccounts.filter((a) => a.archived_at !== null);
  const activeAccountIds = new Set(accounts.map((a) => a.id));

  const allPockets = useLiveQuery(() => localDb.pockets.toArray(), [], []);
  const pockets = allPockets
    .filter((p) => p.archived_at === null && activeAccountIds.has(p.account_id))
    .sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)));

  const allLines = useLiveQuery(() => localDb.transaction_lines.toArray(), [], []);
  const allTransactions = useLiveQuery(() => localDb.transactions.toArray(), [], []);
  const budgets = useLiveQuery(() => localDb.budgets.toArray(), [], []);
  const debts = useLiveQuery(() => localDb.debt_items.toArray(), [], []);
  const liveCategories = useLiveQuery(() => localDb.categories.toArray(), [], []);
  const allCategories = mergeSystemAndLiveCategories(liveCategories);

  const netWorthMinor = computeNetWorth({ pockets, debts });
  const walletsOnlyMinor = computeNetWorth({ pockets, debts: [] });
  const netDebtMinor = netWorthMinor - walletsOnlyMinor;
  const openReceivableMinor = debts
    .filter((d) => !d.deleted_at && d.status === 'open' && d.direction === 'they_owe')
    .reduce((acc, d) => acc + d.remaining_minor, 0);
  const openPayableMinor = debts
    .filter((d) => !d.deleted_at && d.status === 'open' && d.direction === 'i_owe')
    .reduce((acc, d) => acc + d.remaining_minor, 0);

  const overview = computeThreeTierFinancialOverview({
    accounts,
    pockets,
    categories: allCategories,
    transactions: allTransactions,
    lines: allLines,
    budgets,
    netFriendIouMinor: netDebtMinor,
    totalNetWorthMinor: netWorthMinor,
    referenceDateIso: todayIso,
  });

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;
  const selectedAccountPockets = selectedAccount
    ? pockets.filter((p) => p.account_id === selectedAccount.id)
    : [];
  const selectedDefaultPocket = selectedAccountPockets[0] ?? null;

  const selectedAccountTxIds = new Set(
    selectedAccount
      ? allLines
          .filter((l) => !l.deleted_at && l.account_id === selectedAccount.id)
          .map((l) => l.transaction_id)
      : [],
  );
  const selectedAccountRecentTxs = allTransactions
    .filter(
      (tx) => tx.voided_at === null && tx.status !== 'void' && selectedAccountTxIds.has(tx.id),
    )
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, 5);

  const handleAddUsdPocket = async (accountId: string, accountName: string): Promise<void> => {
    await pocketRepository.createPocketWithOpeningBalance({
      accountId,
      name: `${accountName} (USD)`,
      currency: 'USD',
      openingBalanceMinor: 0,
      colorHex: '#10B981',
      iconName: 'square',
    });
  };

  const handleConfirmArchive = async (acc: Account): Promise<void> => {
    await accountRepository.archiveAccountAtomic(acc.id);
    setConfirmArchiveAccountId(null);
    setSelectedAccountId(null);
    setReconcileNotice(
      isVi
        ? `Đã lưu trữ ví "${acc.name}". Số dư của ví không còn tính vào Tổng Tài Sản Ròng (bạn có thể khôi phục ở bên dưới).`
        : `Archived "${acc.name}". Its balance is now excluded from Total Net Worth (you can restore it below).`,
    );
    setTimeout(() => setReconcileNotice(null), 5000);
  };

  const handleRestoreAccount = async (acc: Account): Promise<void> => {
    await accountRepository.restoreAccountAtomic(acc.id);
    setReconcileNotice(isVi ? `Đã khôi phục ví "${acc.name}"!` : `Restored wallet "${acc.name}"!`);
    setTimeout(() => setReconcileNotice(null), 4000);
  };

  const handleCreateFund = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!fundName.trim()) return;
    const monthlyMinor = parseFlexibleMoneyInput(fundMonthlyTargetText, 'VND');
    const goalMinor = parseFlexibleMoneyInput(fundGoalTargetText, 'VND');
    const initialMinor = parseFlexibleMoneyInput(fundInitialBalanceText, 'VND');

    await budgetRepository.createFundAtomic({
      name: fundName,
      monthlyContributionMinor: monthlyMinor > 0 ? monthlyMinor : 2_000_000,
      goalTargetMinor: goalMinor > 0 ? goalMinor : null,
      initialBalanceMinor: initialMinor > 0 ? initialMinor : 0,
      monthKey: overview.monthKey,
    });

    setFundName('');
    setFundMonthlyTargetText('');
    setFundGoalTargetText('');
    setFundInitialBalanceText('');
    setShowAddFund(false);
  };

  const handleFundTransferSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!activeFundTransfer) return;
    const amountMinor = parseFlexibleMoneyInput(fundTransferAmountText, 'VND');
    if (amountMinor <= 0) return;
    const liquidId = fundTransferWalletId || liquidAccounts[0]?.id;
    if (!liquidId) return;

    await budgetRepository.transferBetweenWalletAndFundAtomic({
      fundAccountId: activeFundTransfer.fund.account.id,
      liquidAccountId: liquidId,
      amountMinor,
      direction: activeFundTransfer.direction,
      dateIso: todayIso,
    });

    setActiveFundTransfer(null);
    setFundTransferAmountText('');
  };

  const editingAccountDefaultPocket = editingAccount
    ? (pockets.find((p) => p.account_id === editingAccount.id) ?? null)
    : null;

  return (
    <section className="space-y-4">
      {/* 3 Clean Top Sub-Tabs: Wallets | Debts | Recurring */}
      <SegmentedControl<WalletSubTabId>
        ariaLabel={t.nav.walletsAndDebts}
        value={walletSubTab}
        onChange={setWalletSubTab}
        className="w-full"
        options={[
          { id: 'wallets', label: t.walletsTab.segmentWallets },
          { id: 'debts', label: t.walletsTab.segmentDebts },
          { id: 'recurring', label: isVi ? 'Định kỳ & Trả góp' : 'Recurring' },
        ]}
      />

      {reconcileNotice && (
        <div
          role="status"
          className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-xs font-bold text-[var(--ink-primary)]"
        >
          {reconcileNotice}
        </div>
      )}

      {walletSubTab === 'wallets' ? (
        <div className="space-y-4">
          {/* CARD 1: LIQUID WALLETS, CREDIT CARDS & NET WORTH WITH OVERSIZED CORNER-PEEKING MASCOT */}
          <Card>
            <div
              style={{ backgroundColor: activeBuddy.cardBgHex }}
              className="relative mb-2 overflow-hidden rounded-[24px] border border-[#191919]/12 p-4 pr-24 text-[#191919]"
            >
              <div className="pointer-events-none absolute -right-8 -bottom-8 h-36 w-36 rounded-full border-2 border-[#FFFFFF] bg-[#FFFFFF]/75" />
              <div className="relative z-10 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-black text-[#191919]">{t.accounts.sectionTitle}</h2>
                    <p className="text-[11px] font-bold text-[#191919]/70">
                      {t.accounts.netWorthLabel}
                    </p>
                  </div>
                  <Button
                    variant="ink"
                    size="xs"
                    className="shrink-0 whitespace-nowrap"
                    onClick={() => {
                      setEditingAccount(null);
                      setIsAddOpen(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{t.accounts.addAccountBtn}</span>
                  </Button>
                </div>

                <div className="flex flex-wrap items-baseline gap-2 pt-0.5">
                  <p
                    className="text-2xl font-black tracking-tight text-[#191919] sm:text-3xl tabular-nums"
                    data-testid="assets-net-worth"
                  >
                    {formatMoney(netWorthMinor, 'VND', { hidden: hideBalances })}
                  </p>
                  {(overview.savingsFundsMinor > 0 || netDebtMinor !== 0) && (
                    <span className="rounded-full bg-[#FAFAFA]/85 px-2.5 py-0.5 text-[11px] font-bold text-[#191919] tabular-nums">
                      {isVi ? 'Ví tiêu: ' : 'Liquid: '}
                      {formatMoney(overview.liquidWalletsMinor, 'VND', { hidden: hideBalances })}
                      {overview.savingsFundsMinor > 0 && (
                        <>
                          {' · '}
                          <span className="text-[#1E7E3A]">
                            {isVi ? 'Quỹ: ' : 'Funds: '}
                            {formatMoney(overview.savingsFundsMinor, 'VND', {
                              hidden: hideBalances,
                            })}
                          </span>
                        </>
                      )}
                      {netDebtMinor !== 0 && (
                        <>
                          {' · '}
                          {isVi ? 'Công nợ: ' : 'IOUs: '}
                          {formatMoney(netDebtMinor, 'VND', {
                            hidden: hideBalances,
                            showPlusSign: netDebtMinor > 0,
                          })}
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Oversized Corner-Peeking Buddy (BAEMIN / Plopp Style) */}
              <div className="pointer-events-none absolute -right-3 -bottom-4">
                <GeometricBuddy
                  shape={activeBuddy.shape}
                  colorHex={activeBuddy.characterFillHex}
                  accessory={activeBuddy.accessory}
                  blush
                  mood="happy"
                  size={112}
                />
              </div>
            </div>

            {dailyWallets.length === 0 ? (
              <div className="mt-3">
                <EmptyStateCard
                  clusterVariant="wallet-stack"
                  title={t.walletsTab.walletsEmptyTitle}
                  subtitle={t.walletsTab.walletsEmptyDesc}
                />
              </div>
            ) : (
              <Card.Body className="divide-y divide-[var(--border-hairline)]">
                {dailyWallets.map((acc) => {
                  const accPockets = pockets.filter((p) => p.account_id === acc.id);
                  const hasUsd = accPockets.some((p) => (p.currency ?? 'VND') === 'USD');
                  const typeMeta = getWalletTypeMeta(acc.type, t);

                  return (
                    <button
                      key={acc.id}
                      type="button"
                      data-testid={`wallet-card-${acc.id}`}
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setConfirmArchiveAccountId(null);
                      }}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-[var(--bg-subtle)]/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${typeMeta.bgClass} ${typeMeta.textClass}`}
                        >
                          {typeMeta.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-extrabold text-[var(--ink-primary)]">
                              {acc.name}
                            </p>
                            {hasUsd && (
                              <span className="rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--ink-secondary)]">
                                +USD
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-medium text-[var(--ink-secondary)]">
                            {typeMeta.label}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <p className="text-sm font-extrabold text-[var(--ink-primary)] tabular-nums">
                          {formatMoney(acc.cached_balance_minor, 'VND', { hidden: hideBalances })}
                        </p>
                        <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" />
                      </div>
                    </button>
                  );
                })}

                {(openReceivableMinor > 0 || openPayableMinor > 0) && (
                  <button
                    type="button"
                    onClick={() => setWalletSubTab('debts')}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-[var(--bg-subtle)]/50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#8B5CF6]/12 text-[#7C3AED]">
                        <Users className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-[var(--ink-primary)]">
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
                    <div className="flex shrink-0 items-center gap-2">
                      <p
                        className={`text-sm font-extrabold tabular-nums ${
                          netDebtMinor >= 0 ? 'text-[#059669]' : 'text-[var(--ink-primary)]'
                        }`}
                      >
                        {formatMoney(netDebtMinor, 'VND', {
                          hidden: hideBalances,
                          showPlusSign: netDebtMinor > 0,
                        })}
                      </p>
                      <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" />
                    </div>
                  </button>
                )}
              </Card.Body>
            )}

            {/* Archived Wallets Recovery Section */}
            {archivedAccounts.length > 0 && (
              <div className="mt-3 border-t border-[var(--border-hairline)] pt-3">
                <p className="text-xs font-bold text-[var(--ink-secondary)]">
                  {isVi
                    ? `Ví đã lưu trữ (${archivedAccounts.length}) — Không tính vào Net Worth`
                    : `Archived Wallets (${archivedAccounts.length}) — Excluded from Net Worth`}
                </p>
                <div className="mt-2 space-y-2">
                  {archivedAccounts.map((arch) => (
                    <div
                      key={arch.id}
                      className="flex items-center justify-between rounded-xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-subtle)]/40 px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-[var(--ink-primary)]">{arch.name}</span>
                        <span className="ml-2 text-[11px] text-[var(--ink-secondary)] tabular-nums">
                          ({formatMoney(arch.cached_balance_minor, 'VND', { hidden: hideBalances })}
                          )
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => void handleRestoreAccount(arch)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>{isVi ? 'Khôi phục ví' : 'Restore'}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* CARD 2: SAVINGS & GOAL FUNDS (2-Tier Tracking: Monthly Contribution + Accumulated Balance) */}
          <Card className="space-y-3.5" data-testid="assets-savings-funds-section">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#191919]/10 bg-[#FFFFFF] shadow-2xs">
                  <GeometricBuddy shape="pentagon" pose="family" mood="happy" size={34} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink-primary)]">
                    {isVi ? 'Hũ Tiết Kiệm & Quỹ Mục Tiêu' : 'Savings & Goal Funds'}
                  </h3>
                  <p className="text-[11px] text-[var(--ink-secondary)]">
                    {isVi
                      ? 'Tiền trong Quỹ vẫn thuộc Tổng Tài Sản Ròng của bạn.'
                      : 'Money in Funds stays part of your Total Net Worth.'}
                  </p>
                </div>
              </div>

              <Button
                variant={showAddFund ? 'outline' : 'ink'}
                size="xs"
                className="shrink-0"
                onClick={() => setShowAddFund((v) => !v)}
              >
                {showAddFund ? (
                  <>
                    <X className="h-3.5 w-3.5" />
                    <span>{isVi ? 'Đóng' : 'Close'}</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>{isVi ? 'Tạo Quỹ' : 'New Fund'}</span>
                  </>
                )}
              </Button>
            </div>

            {overview.totalFundSurplusMinor > 0 && (
              <div className="flex items-center gap-2 rounded-2xl bg-[#10B981]/12 px-3 py-2 text-xs font-bold text-[#059669]">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>
                  {isVi
                    ? `Tuyệt vời! Bạn đã góp vượt mục tiêu tháng +${formatMoney(overview.totalFundSurplusMinor, 'VND', { hidden: hideBalances })} ✨`
                    : `Awesome! You beat your monthly savings target by +${formatMoney(overview.totalFundSurplusMinor, 'VND', { hidden: hideBalances })} ✨`}
                </span>
              </div>
            )}

            {showAddFund ? (
              <form
                onSubmit={(e) => void handleCreateFund(e)}
                className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 p-3.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    {
                      name: isVi ? 'Quỹ Khẩn Cấp' : 'Emergency Fund',
                      monthly: '3000000',
                      goal: '50000000',
                    },
                    {
                      name: isVi ? 'Quỹ Du Lịch' : 'Travel Fund',
                      monthly: '1500000',
                      goal: '15000000',
                    },
                    {
                      name: isVi ? 'Quỹ Đầu Tư' : 'Investment Fund',
                      monthly: '5000000',
                      goal: '100000000',
                    },
                  ].map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => {
                        setFundName(tpl.name);
                        setFundMonthlyTargetText(tpl.monthly);
                        setFundGoalTargetText(tpl.goal);
                      }}
                      className="rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-primary)] hover:border-[var(--border-strong)]"
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                    {isVi ? 'Tên Quỹ' : 'Fund Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={fundName}
                    onChange={(e) => setFundName(e.target.value)}
                    placeholder={isVi ? 'VD: Quỹ Khẩn Cấp...' : 'e.g. Emergency Fund...'}
                    className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--ink-primary)]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                      {isVi ? 'Góp / tháng' : 'Monthly'}
                    </label>
                    <input
                      type="text"
                      required
                      inputMode="decimal"
                      value={fundMonthlyTargetText}
                      onChange={(e) => setFundMonthlyTargetText(e.target.value)}
                      placeholder="3000000"
                      className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2 text-xs font-extrabold text-[var(--ink-primary)] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                      {isVi ? 'Mục tiêu tổng' : 'Goal Target'}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={fundGoalTargetText}
                      onChange={(e) => setFundGoalTargetText(e.target.value)}
                      placeholder="50000000"
                      className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2 text-xs font-extrabold text-[var(--ink-primary)] tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                      {isVi ? 'Đã có sẵn' : 'Initial'}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={fundInitialBalanceText}
                      onChange={(e) => setFundInitialBalanceText(e.target.value)}
                      placeholder="0"
                      className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2 text-xs font-extrabold text-[var(--ink-primary)] tabular-nums"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="ink"
                  size="sm"
                  fullWidth
                  data-testid="create-fund-submit"
                >
                  {isVi ? 'Lưu Quỹ tiết kiệm' : 'Create Fund'}
                </Button>
              </form>
            ) : overview.funds.length === 0 ? (
              <div className="rounded-2xl bg-[var(--bg-subtle)]/55 p-4 text-center">
                <p className="text-xs font-bold text-[var(--ink-primary)]">
                  {isVi ? 'Chưa có Quỹ tiết kiệm nào' : 'No Savings Funds yet'}
                </p>
                <p className="mt-1 text-[11px] text-[var(--ink-secondary)]">
                  {isVi
                    ? 'Tạo hũ tiết kiệm riêng để tách tiền tích lũy khỏi tiền tiêu vặt hằng ngày:'
                    : 'Create a savings pot to separate your goals from daily spending cash:'}
                </p>
                <div className="mt-3 flex justify-center">
                  <Button
                    variant="ink"
                    size="sm"
                    data-testid="quick-create-emergency-fund-btn"
                    onClick={() =>
                      void budgetRepository.createFundAtomic({
                        name: isVi ? 'Quỹ Dự Phòng Khẩn Cấp' : 'Emergency Fund',
                        monthlyContributionMinor: 3_000_000,
                        goalTargetMinor: 50_000_000,
                        initialBalanceMinor: 0,
                        monthKey: overview.monthKey,
                      })
                    }
                  >
                    <PiggyBank className="h-3.5 w-3.5" />
                    <span>
                      {isVi
                        ? 'Tạo nhanh Quỹ Khẩn Cấp (3tr/tháng)'
                        : 'Create Emergency Fund (3M/mo)'}
                    </span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeFundTransfer && (
                  <form
                    onSubmit={(e) => void handleFundTransferSubmit(e)}
                    className="space-y-2.5 rounded-2xl border border-[#10B981]/40 bg-[#10B981]/8 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-extrabold text-[var(--ink-primary)]">
                        {activeFundTransfer.direction === 'contribute'
                          ? isVi
                            ? `Góp thêm vào "${activeFundTransfer.fund.account.name}"`
                            : `Add to "${activeFundTransfer.fund.account.name}"`
                          : isVi
                            ? `Rút từ "${activeFundTransfer.fund.account.name}" về ví`
                            : `Withdraw from "${activeFundTransfer.fund.account.name}"`}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveFundTransfer(null)}
                        className="text-xs font-bold text-[var(--ink-secondary)]"
                      >
                        {isVi ? 'Đóng' : 'Close'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        inputMode="decimal"
                        value={fundTransferAmountText}
                        onChange={(e) => setFundTransferAmountText(e.target.value)}
                        placeholder="1000000"
                        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-extrabold text-[var(--ink-primary)] tabular-nums"
                      />
                      <select
                        value={fundTransferWalletId}
                        onChange={(e) => setFundTransferWalletId(e.target.value)}
                        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)]"
                      >
                        {liquidAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button type="submit" variant="ink" size="xs" fullWidth>
                      {activeFundTransfer.direction === 'contribute'
                        ? isVi
                          ? 'Xác nhận góp vào Quỹ'
                          : 'Confirm Contribution'
                        : isVi
                          ? 'Xác nhận rút về Ví'
                          : 'Confirm Withdrawal'}
                    </Button>
                  </form>
                )}

                {overview.funds.map((fund) => {
                  const isSurplus = fund.monthlyStatus === 'surplus';
                  const monthlyBarPct = Math.min(100, Math.max(4, fund.monthlyPct));

                  return (
                    <div
                      key={fund.account.id}
                      data-testid={`fund-card-${fund.account.id}`}
                      className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/50 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAccountId(fund.account.id);
                            setConfirmArchiveAccountId(null);
                          }}
                          className="min-w-0 text-left"
                        >
                          <div className="flex items-center gap-1.5">
                            <h4 className="truncate text-sm font-extrabold text-[var(--ink-primary)] hover:underline">
                              {fund.account.name}
                            </h4>
                            {isSurplus && (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#10B981]/16 px-2 py-0.5 text-[10px] font-extrabold text-[#059669]">
                                <Sparkles className="h-2.5 w-2.5" />
                                <span>
                                  +
                                  {formatMoney(fund.monthlySurplusMinor, 'VND', {
                                    hidden: hideBalances,
                                  })}
                                </span>
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-[var(--ink-secondary)] tabular-nums">
                            {isVi ? 'Số dư tích lũy: ' : 'Total saved: '}
                            <strong className="font-extrabold text-[#059669]">
                              {formatMoney(fund.accumulatedBalanceMinor, 'VND', {
                                hidden: hideBalances,
                              })}
                            </strong>
                            {fund.goalTargetMinor
                              ? ` / ${formatMoney(fund.goalTargetMinor, 'VND', { hidden: hideBalances })} (${fund.goalPct}%)`
                              : ''}
                          </p>
                        </button>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ink"
                            size="xs"
                            onClick={() => {
                              setActiveFundTransfer({ fund, direction: 'contribute' });
                              const remainingToTarget = Math.max(
                                500_000,
                                fund.monthlyTargetMinor - fund.monthlyNetContributedMinor,
                              );
                              setFundTransferAmountText(String(remainingToTarget));
                              setFundTransferWalletId(liquidAccounts[0]?.id ?? '');
                            }}
                          >
                            <ArrowUpRight className="h-3 w-3" />
                            <span>{isVi ? 'Góp' : 'Add'}</span>
                          </Button>
                          {fund.accumulatedBalanceMinor > 0 && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                setActiveFundTransfer({ fund, direction: 'withdraw' });
                                setFundTransferAmountText(
                                  String(
                                    fund.monthlySurplusMinor > 0
                                      ? fund.monthlySurplusMinor
                                      : Math.min(1_000_000, fund.accumulatedBalanceMinor),
                                  ),
                                );
                                setFundTransferWalletId(liquidAccounts[0]?.id ?? '');
                              }}
                            >
                              <ArrowDownLeft className="h-3 w-3" />
                              <span>{isVi ? 'Rút' : 'Withdraw'}</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-2.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-[var(--ink-secondary)]">
                            {isVi ? 'Đã góp tháng này' : 'Contributed this month'}
                          </span>
                          <span className="font-bold text-[var(--ink-primary)] tabular-nums">
                            {formatMoney(fund.monthlyNetContributedMinor, 'VND', {
                              hidden: hideBalances,
                            })}
                            {fund.monthlyTargetMinor > 0
                              ? ` / ${formatMoney(fund.monthlyTargetMinor, 'VND', { hidden: hideBalances })} (${fund.monthlyPct}%)`
                              : ''}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-card)]">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isSurplus
                                ? 'bg-gradient-to-r from-[#10B981] to-[#FFB703]'
                                : 'bg-[#10B981]'
                            }`}
                            style={{ width: `${monthlyBarPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      ) : walletSubTab === 'debts' ? (
        <DebtBookSection />
      ) : (
        <RecurringSection />
      )}

      {/* DETAIL SHEET: Wallet Details, Recent Activity & Actions */}
      <BottomSheet
        open={Boolean(selectedAccount)}
        onClose={() => {
          setSelectedAccountId(null);
          setConfirmArchiveAccountId(null);
        }}
        title={selectedAccount ? selectedAccount.name : ''}
        titleId="wallet-detail-sheet-title"
        closeLabel={isVi ? 'Đóng' : 'Close'}
        headerAccessory={
          selectedAccount
            ? (() => {
                const meta = getWalletTypeMeta(selectedAccount.type, t);
                return (
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${meta.bgClass} ${meta.textClass}`}
                  >
                    {meta.icon}
                  </span>
                );
              })()
            : undefined
        }
      >
        {selectedAccount && (
          <div className="space-y-3.5">
            {/* Balance & Pockets Summary */}
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--ink-secondary)]">
                  {getWalletTypeMeta(selectedAccount.type, t).label}
                </span>
                <span className="text-xl font-extrabold text-[var(--ink-primary)] tabular-nums">
                  {formatMoney(selectedAccount.cached_balance_minor, 'VND', {
                    hidden: hideBalances,
                  })}
                </span>
              </div>

              {selectedAccount.type === 'credit_card' && selectedDefaultPocket && (
                <div className="mt-2 border-t border-[var(--border-hairline)] pt-2 text-xs text-[var(--ink-secondary)]">
                  {(() => {
                    const cc = computeCreditCardSummary(selectedAccount, selectedDefaultPocket);
                    return (
                      <div className="flex flex-wrap gap-2">
                        <span>
                          {t.m3.currentDebtLabel}:{' '}
                          <strong>{formatMoney(cc.currentDebtMinor, 'VND')}</strong>
                        </span>
                        {cc.remainingLimitMinor !== null && (
                          <span>
                            · {t.m3.remainingLimitLabel}:{' '}
                            <strong>{formatMoney(cc.remainingLimitMinor, 'VND')}</strong>
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {selectedAccountPockets.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {selectedAccountPockets.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ink-primary)] tabular-nums"
                    >
                      <span>{p.currency ?? 'VND'}:</span>
                      <strong>
                        {formatMoney(p.cached_balance_minor, p.currency ?? 'VND', {
                          hidden: hideBalances,
                        })}
                      </strong>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Transactions of this Wallet */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-[var(--ink-secondary)]">
                {isVi ? 'Giao dịch gần đây của ví này' : 'Recent activity in this wallet'}
              </p>
              {selectedAccountRecentTxs.length === 0 ? (
                <p className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] p-3 text-center text-xs text-[var(--ink-muted)]">
                  {isVi
                    ? 'Chưa có giao dịch nào trên ví này.'
                    : 'No transactions in this wallet yet.'}
                </p>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3">
                  {selectedAccountRecentTxs.map((tx) => {
                    const line = allLines.find(
                      (l) =>
                        !l.deleted_at &&
                        l.transaction_id === tx.id &&
                        l.account_id === selectedAccount.id,
                    );
                    const signedAmt = line ? line.signed_amount_minor : -Math.abs(tx.amount_minor);
                    return (
                      <div key={tx.id} className="flex items-center justify-between py-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[var(--ink-primary)]">
                            {tx.note || tx.type}
                          </p>
                          <p className="text-[10px] text-[var(--ink-muted)] tabular-nums">
                            {tx.txn_date}
                          </p>
                        </div>
                        <span
                          className={`font-extrabold tabular-nums ${
                            signedAmt > 0 ? 'text-[#059669]' : 'text-[var(--ink-primary)]'
                          }`}
                        >
                          {formatMoney(signedAmt, tx.currency, {
                            hidden: hideBalances,
                            showPlusSign: signedAmt > 0,
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Grid inside Detail Sheet */}
            <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-hairline)] pt-3">
              {selectedDefaultPocket && (
                <Button
                  variant="ink"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setSelectedAccountId(null);
                    setReconcilingPocket(selectedDefaultPocket);
                  }}
                >
                  <Scale className="h-3.5 w-3.5" />
                  <span>{t.m3.reconcileBtn}</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={() => {
                  const target = selectedAccount;
                  setSelectedAccountId(null);
                  setEditingAccount(target);
                  setIsAddOpen(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>{isVi ? 'Sửa thông tin ví' : 'Edit Wallet'}</span>
              </Button>

              {!selectedAccountPockets.some((p) => (p.currency ?? 'VND') === 'USD') && (
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  onClick={() => void handleAddUsdPocket(selectedAccount.id, selectedAccount.name)}
                >
                  <span>{t.accounts.addPocketBtn} (USD)</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={() =>
                  setConfirmArchiveAccountId(
                    confirmArchiveAccountId === selectedAccount.id ? null : selectedAccount.id,
                  )
                }
              >
                <Trash2 className="h-3.5 w-3.5 text-[#E11D48]" />
                <span className="text-[#E11D48]">{t.accounts.archiveBtn}</span>
              </Button>
            </div>

            {confirmArchiveAccountId === selectedAccount.id && (
              <div
                data-testid={`confirm-archive-${selectedAccount.id}`}
                className="space-y-2 rounded-2xl border border-[#EF4444]/35 bg-[#EF4444]/8 p-3 text-xs"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-[var(--ink-primary)]">
                      {isVi
                        ? `Xác nhận lưu trữ ví "${selectedAccount.name}"?`
                        : `Confirm archiving "${selectedAccount.name}"?`}
                    </p>
                    <p className="text-[11px] leading-relaxed text-[var(--ink-secondary)]">
                      {isVi
                        ? 'Số dư của ví sẽ ngừng tính vào Tổng Tài Sản Ròng. Giao dịch cũ vẫn giữ nguyên trong Sổ cái.'
                        : 'Its balance will be excluded from Net Worth. Past transactions remain intact.'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setConfirmArchiveAccountId(null)}
                  >
                    {isVi ? 'Huỷ' : 'Cancel'}
                  </Button>
                  <Button
                    variant="ink"
                    size="xs"
                    onClick={() => void handleConfirmArchive(selectedAccount)}
                  >
                    {isVi ? 'Xác nhận Lưu trữ' : 'Confirm Archive'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      <AccountFormSheet
        open={isAddOpen}
        editingAccount={editingAccount}
        defaultPocket={editingAccountDefaultPocket}
        onClose={() => {
          setIsAddOpen(false);
          setEditingAccount(null);
        }}
      />
      <ReconcileSheet
        pocket={reconcilingPocket}
        onClose={() => setReconcilingPocket(null)}
        onReconciled={(msg) => {
          setReconcileNotice(msg);
          setTimeout(() => setReconcileNotice(null), 4000);
        }}
      />
    </section>
  );
}
