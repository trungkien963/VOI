import { useEffect, useState, type KeyboardEvent, type ReactElement } from 'react';
import { Sparkles, Users } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUiStore, type QuickAddFlowKind } from '../../app/ui-store';
import { DEFAULT_STARTER_POCKETS, localDb } from '../../db/dexie-schema';
import { debtRepository } from '../../db/repositories/debt-repository';
import { merchantAliasRepository } from '../../db/repositories/merchant-alias-repository';
import { tagRepository } from '../../db/repositories/tag-repository';
import { transactionRepository } from '../../db/repositories/transaction-repository';
import { DEFAULT_SYSTEM_CATEGORIES } from '../../domain/categories/default-categories';
import {
  computeImpliedFxRate,
  formatMoney,
  parseFlexibleMoneyInput,
  toMinorUnits,
  type CurrencyCode,
} from '../../domain/money/currency';
import { parseQuickInput } from '../../domain/quick-parser/parser';
import type { Category, CategoryKind } from '../../domain/types/entities';
import { getCategoryDisplayName, useTranslation } from '../../shared/i18n';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { CalculatorKeypad } from '../../shared/ui/CalculatorKeypad';
import { CategoryGridPicker } from '../../shared/ui/CategoryGridPicker';
import { VoiLogo } from '../../shared/ui/VoiLogo';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';

const SMART_CHIPS_EN = ['☕ Coffee 35k', '🍜 Lunch 55k', '🛵 Grab 40k', '🧋 Boba 45k'];
const SMART_CHIPS_VI = ['☕ Cafe 35k', '🍜 Ăn trưa 55k', '🛵 Grab 40k', '🧋 Trà sữa 45k'];

export function QuickAddSheet(): ReactElement {
  const {
    isQuickAddOpen,
    quickAddDefaultKind,
    quickAddDefaultDateIso,
    quickAddDefaultSplitMode,
    editingTransactionId,
    thousandsInputMode,
    closeQuickAdd,
    clearNoSpendDate,
  } = useUiStore();
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';
  const todayIso = new Date().toISOString().slice(0, 10);

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

  const liveDebts = useLiveQuery(() => localDb.debt_items.toArray(), [], []);
  const knownFriendNames = Array.from(
    new Set(liveDebts.map((d) => (d.counterparty_name ?? '').trim()).filter(Boolean)),
  ).slice(0, 8);

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

  const expenseCategories = allCategories.filter(
    (c) => c.kind === 'expense' && c.slug !== 'unknown-expense' && !c.archived_at,
  );
  const incomeCategories = allCategories.filter(
    (c) => c.kind === 'income' && c.slug !== 'unknown-income' && !c.archived_at,
  );

  const learnedAliases = useLiveQuery(() => merchantAliasRepository.listTopAliases(), [], []);
  const pockets = livePockets.length > 0 ? livePockets : DEFAULT_STARTER_POCKETS;

  const [kind, setKind] = useState<QuickAddFlowKind>('expense');
  const [txnDateIso, setTxnDateIso] = useState<string>(todayIso);
  const [quickInputText, setQuickInputText] = useState('');
  const [expression, setExpression] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    expenseCategories[0]?.id ?? null,
  );
  const [sourcePocketId, setSourcePocketId] = useState<string>(
    DEFAULT_STARTER_POCKETS[0]?.id ?? '',
  );
  const [destPocketId, setDestPocketId] = useState<string>(DEFAULT_STARTER_POCKETS[1]?.id ?? '');
  const [receivedMajorText, setReceivedMajorText] = useState('');
  const [feeMajorText, setFeeMajorText] = useState('');

  // 1-Tap Inline Split Bill state
  const [isSplitBill, setIsSplitBill] = useState(false);
  const [splitFriendsText, setSplitFriendsText] = useState('');
  const [splitOwnShareText, setSplitOwnShareText] = useState('');

  // Sync default flow kind, split mode & selected date when opening QuickAdd (create mode)
  useEffect(() => {
    if (!isQuickAddOpen || editingTransactionId) return;
    setKind(quickAddDefaultKind);
    setIsSplitBill(Boolean(quickAddDefaultSplitMode && quickAddDefaultKind === 'expense'));
    setTxnDateIso(quickAddDefaultDateIso ?? new Date().toISOString().slice(0, 10));
    const defaultCats = quickAddDefaultKind === 'income' ? incomeCategories : expenseCategories;
    if (defaultCats[0]) {
      setSelectedCategoryId(defaultCats[0].id);
    }
  }, [
    isQuickAddOpen,
    editingTransactionId,
    quickAddDefaultKind,
    quickAddDefaultDateIso,
    quickAddDefaultSplitMode,
  ]);

  // Load transaction + lines when editing an existing transaction
  useEffect(() => {
    if (!editingTransactionId) return;
    setIsSplitBill(false);
    void Promise.all([
      localDb.transactions.get(editingTransactionId),
      localDb.transaction_lines.where('transaction_id').equals(editingTransactionId).toArray(),
    ]).then(([tx, lines]) => {
      if (!tx) return;
      const mappedKind: QuickAddFlowKind =
        tx.type === 'income' ? 'income' : tx.type === 'transfer' ? 'transfer' : 'expense';
      setKind(mappedKind);
      setTxnDateIso(tx.txn_date || todayIso);
      setQuickInputText(tx.note ?? '');
      setExpression(String(tx.amount_minor));
      if (tx.category_id) setSelectedCategoryId(tx.category_id);

      const activeLines = lines.filter((l) => !l.deleted_at);
      if (mappedKind === 'transfer') {
        const outLine = activeLines.find((l) => l.signed_amount_minor < 0 && !l.is_fee);
        const inLine = activeLines.find((l) => l.signed_amount_minor > 0);
        if (outLine?.pocket_id) setSourcePocketId(outLine.pocket_id);
        if (inLine?.pocket_id) setDestPocketId(inLine.pocket_id);
      } else {
        const firstLine = activeLines[0];
        if (firstLine?.pocket_id) setSourcePocketId(firstLine.pocket_id);
      }
    });
  }, [editingTransactionId, todayIso]);

  const parsedPreview = quickInputText.trim()
    ? parseQuickInput(quickInputText, { thousandsInputMode, learnedAliases })
    : null;

  const handleQuickInputChange = (val: string): void => {
    setQuickInputText(val);
    if (!val.trim()) return;
    const parsed = parseQuickInput(val, { thousandsInputMode, learnedAliases });
    if (parsed.amountMinor !== null && parsed.amountMinor > 0) {
      setExpression(String(parsed.amountMinor));
    }
    if (parsed.type === 'income' || parsed.type === 'transfer' || parsed.type === 'expense') {
      setKind(parsed.type);
    }
    if (parsed.categoryId) {
      setSelectedCategoryId(parsed.categoryId);
    }
  };

  const splitFriendNames = splitFriendsText
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const toggleFriendInQuickSplit = (friendName: string): void => {
    const exists = splitFriendNames.some((f) => f.toLowerCase() === friendName.toLowerCase());
    const nextList = exists
      ? splitFriendNames.filter((f) => f.toLowerCase() !== friendName.toLowerCase())
      : [...splitFriendNames, friendName];
    setSplitFriendsText(nextList.join(', '));
  };

  const visibleCategories =
    kind === ('income' as CategoryKind) ? incomeCategories : expenseCategories;
  const sourcePocket =
    pockets.find((p) => p.id === sourcePocketId) ??
    pockets.find((p) => p.is_default && (p.currency ?? 'VND') === 'VND') ??
    pockets[0];
  const destPocket =
    pockets.find((p) => p.id === destPocketId && p.id !== sourcePocket?.id) ??
    pockets.find((p) => p.id !== sourcePocket?.id) ??
    pockets[0];

  const srcCurrency: CurrencyCode = (sourcePocket?.currency as CurrencyCode | undefined) ?? 'VND';
  const dstCurrency: CurrencyCode = (destPocket?.currency as CurrencyCode | undefined) ?? 'VND';
  const isCrossCurrency = kind === 'transfer' && srcCurrency !== dstCurrency;

  const currentEvaluatedMinor =
    Number(expression) > 0 ? Number(expression) : (parsedPreview?.amountMinor ?? 0);
  const autoSplitTotalPeople = splitFriendNames.length + 1;
  const defaultOwnShareMinor =
    currentEvaluatedMinor > 0 && splitFriendNames.length > 0
      ? Math.round(currentEvaluatedMinor / autoSplitTotalPeople)
      : 0;
  const customOwnShareMinor = splitOwnShareText.trim()
    ? parseFlexibleMoneyInput(splitOwnShareText, srcCurrency)
    : defaultOwnShareMinor;
  const previewLentTotalMinor = Math.max(0, currentEvaluatedMinor - customOwnShareMinor);
  const previewPerFriendMinor =
    splitFriendNames.length > 0 ? Math.round(previewLentTotalMinor / splitFriendNames.length) : 0;

  const handleClose = (): void => {
    setQuickInputText('');
    setExpression('');
    setReceivedMajorText('');
    setFeeMajorText('');
    setIsSplitBill(false);
    setSplitFriendsText('');
    setSplitOwnShareText('');
    closeQuickAdd();
  };

  const handleKindChange = (nextKind: QuickAddFlowKind): void => {
    setKind(nextKind);
    if (nextKind !== 'expense') {
      setIsSplitBill(false);
    }
    if (nextKind === 'income') {
      setSelectedCategoryId(incomeCategories[0]?.id ?? null);
    } else if (nextKind === 'expense') {
      setSelectedCategoryId(expenseCategories[0]?.id ?? null);
    }
  };

  const handleSaveTransaction = async (evaluatedMinor: number): Promise<void> => {
    const finalMinor = evaluatedMinor > 0 ? evaluatedMinor : (parsedPreview?.amountMinor ?? 0);
    if (finalMinor <= 0 || !sourcePocket) {
      handleClose();
      return;
    }

    const cleanNote = parsedPreview?.note ?? (quickInputText.trim() || null);
    const currentTodayIso = new Date().toISOString().slice(0, 10);
    const chosenDateIso = txnDateIso || currentTodayIso;
    const occurredAt =
      chosenDateIso === currentTodayIso
        ? new Date().toISOString()
        : `${chosenDateIso}T12:00:00.000Z`;

    // Fast 1-Tap Split Bill execution directly from QuickAddSheet!
    if (!editingTransactionId && kind === 'expense' && isSplitBill && splitFriendNames.length > 0) {
      const totalPeople = splitFriendNames.length + 1;
      const ownMinor = splitOwnShareText.trim()
        ? parseFlexibleMoneyInput(splitOwnShareText, srcCurrency)
        : Math.round(finalMinor / totalPeople);
      const remainingLent = Math.max(0, finalMinor - ownMinor);
      const perFriend = Math.floor(remainingLent / splitFriendNames.length);
      const nowMs = Date.now();
      const shares = splitFriendNames.map((name, idx) => {
        const isLast = idx === splitFriendNames.length - 1;
        const shareAmt = isLast
          ? remainingLent - perFriend * (splitFriendNames.length - 1)
          : perFriend;
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
        sourceAccountId: sourcePocket.account_id,
        sourcePocketId: sourcePocket.id,
        currency: srcCurrency,
        totalPaidMinor: finalMinor,
        ownExpenseMinor: ownMinor,
        categoryId: selectedCategoryId ?? 'cat-eating-out',
        note: cleanNote ?? (isVi ? 'Chia hoá đơn nhóm' : 'Group bill split'),
        occurredAt,
        shares,
      });

      clearNoSpendDate(chosenDateIso);
      handleClose();
      return;
    }

    const dstAmountMinor =
      isCrossCurrency && receivedMajorText.trim()
        ? parseFlexibleMoneyInput(receivedMajorText, dstCurrency)
        : finalMinor;
    const feeMinor =
      kind === 'transfer' && feeMajorText.trim()
        ? parseFlexibleMoneyInput(feeMajorText, srcCurrency)
        : 0;
    const txId =
      editingTransactionId ?? `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const payload = {
      transactionId: txId,
      userId: 'local-user',
      type: kind,
      amountMinor: finalMinor,
      currency: srcCurrency,
      sourceAccountId: sourcePocket.account_id,
      sourcePocketId: sourcePocket.id,
      destinationAccountId: kind === 'transfer' ? destPocket?.account_id : undefined,
      destinationPocketId: kind === 'transfer' ? (destPocket?.id ?? null) : null,
      destinationAmountMinor: kind === 'transfer' ? dstAmountMinor : undefined,
      destinationCurrency: kind === 'transfer' ? dstCurrency : undefined,
      transferFeeMinor: feeMinor,
      categoryId: kind === 'transfer' ? null : selectedCategoryId,
      note: cleanNote,
      occurredAt,
    };

    if (editingTransactionId) {
      await transactionRepository.updateTransactionAtomic(payload);
    } else {
      await transactionRepository.createFromInputAtomic(payload);
    }

    if (kind === 'expense') {
      clearNoSpendDate(chosenDateIso);
    }

    if (parsedPreview && parsedPreview.tags.length > 0) {
      await tagRepository.attachTagsToTransactionAtomic(txId, parsedPreview.tags);
    }
    if (cleanNote && selectedCategoryId && kind !== 'transfer') {
      await merchantAliasRepository.learnAliasAtomic({
        rawKeyword: cleanNote,
        categoryId: selectedCategoryId,
        accountId: sourcePocket.account_id,
      });
    }
    handleClose();
  };

  // Modern Web Guidance `ime-safe-enter-submit`: guard against IME composition (`isComposing` or `keyCode === 229`)
  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
        return;
      }
      const amountToSave = Number(expression) || parsedPreview?.amountMinor || 0;
      if (amountToSave > 0) {
        void handleSaveTransaction(amountToSave);
      }
    }
  };

  const previewImpliedFx =
    isCrossCurrency && Number(expression) > 0 && Number(receivedMajorText) > 0
      ? computeImpliedFxRate(
          toMinorUnits(Number(expression), srcCurrency),
          srcCurrency,
          toMinorUnits(Number(receivedMajorText), dstCurrency),
          dstCurrency,
        )
      : null;

  const smartChips = locale === 'vi' ? SMART_CHIPS_VI : SMART_CHIPS_EN;
  const matchedCat = allCategories.find((c) => c.id === selectedCategoryId);

  return (
    <BottomSheet
      open={isQuickAddOpen}
      onClose={handleClose}
      title={editingTransactionId ? t.quickAddModal.editTitle : t.quickAddModal.title}
      titleId="quick-add-modal-title"
      closeLabel={t.quickAddModal.closeBtn}
      headerAccessory={<VoiLogo variant="cobalt" size={30} className="rounded-xl" />}
    >
      <div className="space-y-2">
        <SegmentedControl<QuickAddFlowKind>
          ariaLabel={t.quickAddModal.typeAria}
          size="sm"
          value={kind}
          onChange={handleKindChange}
          className="w-full"
          options={[
            { id: 'expense', label: t.quickAddModal.tabExpense },
            { id: 'income', label: t.quickAddModal.tabIncome },
            { id: 'transfer', label: t.quickAddModal.tabTransfer },
          ]}
        />

        {/* Compact Single-Row Toolbar: Pocket + Date (or Dest Pocket) + 1-Tap Split Bill */}
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <label htmlFor="quick-add-source-pocket" className="sr-only">
              {t.quickAddModal.sourcePocketLabel}
            </label>
            <select
              id="quick-add-source-pocket"
              value={sourcePocket?.id ?? ''}
              onChange={(e) => setSourcePocketId(e.target.value)}
              className="w-full truncate rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2 py-1.5 text-xs font-semibold text-[var(--ink-primary)]"
            >
              {pockets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {kind === 'transfer' ? (
            <div className="min-w-0 flex-1">
              <label htmlFor="quick-add-dest-pocket" className="sr-only">
                {t.quickAddModal.destPocketLabel}
              </label>
              <select
                id="quick-add-dest-pocket"
                value={destPocket?.id ?? ''}
                onChange={(e) => setDestPocketId(e.target.value)}
                className="w-full truncate rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2 py-1.5 text-xs font-semibold text-[var(--ink-primary)]"
              >
                {pockets
                  .filter((p) => p.id !== sourcePocket?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <div className="w-[122px] shrink-0">
              <label htmlFor="quick-add-txn-date" className="sr-only">
                {isVi ? 'Ngày giao dịch' : 'Date'}
              </label>
              <input
                id="quick-add-txn-date"
                type="date"
                value={txnDateIso}
                onChange={(e) => setTxnDateIso(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2 py-1.5 text-[11px] font-semibold text-[var(--ink-primary)] tabular-nums"
              />
            </div>
          )}

          {!editingTransactionId && kind === 'expense' && (
            <button
              type="button"
              data-testid="quick-add-split-toggle"
              onClick={() => setIsSplitBill((prev) => !prev)}
              className={`flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition ${
                isSplitBill
                  ? 'border-[#141413] bg-[#141413] text-white'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--ink-primary)] hover:border-[var(--border-strong)]'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>{isVi ? 'Chia bill' : 'Split'}</span>
            </button>
          )}
        </div>

        {/* Expanded Split Bill Panel (Only when toggled ON) */}
        {!editingTransactionId && kind === 'expense' && isSplitBill && (
          <div className="space-y-1.5 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] p-2.5">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block truncate text-[10px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Bạn bè cùng chia (phẩy)' : 'Friends (comma-separated)'}
                </label>
                <input
                  type="text"
                  data-testid="quick-add-split-friends-input"
                  value={splitFriendsText}
                  onChange={(e) => setSplitFriendsText(e.target.value)}
                  placeholder={isVi ? 'VD: Thế, Quân' : 'e.g. Alex, Sam'}
                  className="mt-0.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2 py-1 text-xs font-semibold text-[var(--ink-primary)]"
                />
              </div>
              <div>
                <label className="block truncate text-[10px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Phần riêng bạn (Tự chia đều)' : 'Your share (Auto-even)'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={splitOwnShareText}
                  onChange={(e) => setSplitOwnShareText(e.target.value)}
                  placeholder={
                    defaultOwnShareMinor > 0 ? String(defaultOwnShareMinor) : isVi ? 'Tự chia đều' : 'Auto'
                  }
                  className="mt-0.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2 py-1 text-xs font-bold text-[var(--ink-primary)] tabular-nums"
                />
              </div>
            </div>

            {knownFriendNames.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Chọn nhanh:' : 'Quick pick:'}
                </span>
                {knownFriendNames.map((name) => {
                  const active = splitFriendNames.some(
                    (f) => f.toLowerCase() === name.toLowerCase(),
                  );
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleFriendInQuickSplit(name)}
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

            {currentEvaluatedMinor > 0 && splitFriendNames.length > 0 && (
              <div className="rounded-xl bg-[var(--bg-card)] px-2.5 py-1 text-[11px] font-bold tabular-nums">
                <span className="text-[var(--ink-secondary)]">
                  {isVi ? 'Tổng: ' : 'Total: '}
                </span>
                <strong className="text-[var(--ink-primary)]">
                  {formatMoney(currentEvaluatedMinor, srcCurrency)}
                </strong>
                {' → '}
                <span className="text-[#FF6B35]">
                  {isVi ? 'Phần bạn: ' : 'Yours: '}
                  {formatMoney(customOwnShareMinor, srcCurrency)}
                </span>
                {' · '}
                <span className="text-[#059669]">
                  {isVi ? 'Ghi nợ bạn: ' : 'Owed: '}
                  {formatMoney(previewLentTotalMinor, srcCurrency)} (
                  {formatMoney(previewPerFriendMinor, srcCurrency)}/{isVi ? 'người' : 'ea'})
                </span>
              </div>
            )}
          </div>
        )}

        {kind === 'transfer' && (
          <div className="grid grid-cols-2 gap-2">
            {isCrossCurrency && (
              <div>
                <label
                  htmlFor="quick-add-received-amount"
                  className="block text-[10px] font-bold text-[var(--ink-secondary)]"
                >
                  {t.quickAddModal.receivedAmountLabel} ({dstCurrency})
                </label>
                <input
                  id="quick-add-received-amount"
                  type="text"
                  inputMode="decimal"
                  value={receivedMajorText}
                  onChange={(e) => setReceivedMajorText(e.target.value)}
                  placeholder="0"
                  className="mt-0.5 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2 py-1 text-xs font-bold text-[var(--ink-primary)] tabular-nums"
                />
                {previewImpliedFx !== null && (
                  <p className="mt-0.5 text-[10px] font-semibold text-[#0D9488]">
                    {t.quickAddModal.impliedFxPrefix}: 1 {srcCurrency} = {previewImpliedFx}{' '}
                    {dstCurrency}
                  </p>
                )}
              </div>
            )}
            <div className={isCrossCurrency ? '' : 'col-span-2'}>
              <label
                htmlFor="quick-add-transfer-fee"
                className="block text-[10px] font-bold text-[var(--ink-secondary)]"
              >
                {t.quickAddModal.transferFeeLabel} ({srcCurrency})
              </label>
              <input
                id="quick-add-transfer-fee"
                type="text"
                inputMode="decimal"
                value={feeMajorText}
                onChange={(e) => setFeeMajorText(e.target.value)}
                placeholder="0"
                className="mt-0.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2 py-1 text-xs font-semibold text-[var(--ink-primary)] tabular-nums"
              />
            </div>
          </div>
        )}

        <div>
          <input
            type="text"
            value={quickInputText}
            onChange={(e) => handleQuickInputChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t.quickAddModal.placeholder}
            className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-medium text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[#141413] focus:outline-none"
          />

          {!quickInputText.trim() ? (
            <div className="mt-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap">
              {smartChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleQuickInputChange(chip.replace(/^[^\p{L}\p{N}]+\s*/u, ''))}
                  className="shrink-0 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
                >
                  {chip}
                </button>
              ))}
            </div>
          ) : (
            parsedPreview && (
              <div
                data-testid="quick-input-live-preview"
                className="mt-1 flex flex-wrap items-center gap-1.5 rounded-xl bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-primary)]"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#FF6B35]" />
                <span>{t.quickAddModal.parsedPreviewLabel}:</span>
                {parsedPreview.amountMinor !== null && (
                  <strong className="font-extrabold text-[#FF6B35] tabular-nums">
                    = {formatMoney(parsedPreview.amountMinor, parsedPreview.currency)}
                  </strong>
                )}
                {matchedCat && (
                  <span className="rounded-full bg-[var(--bg-card)] px-2 py-0.5">
                    {getCategoryDisplayName(matchedCat, t)}
                  </span>
                )}
                {parsedPreview.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#3B82F6]/12 px-2 py-0.5 text-[#3B82F6]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )
          )}
        </div>

        {kind !== 'transfer' && (
          <CategoryGridPicker
            categories={visibleCategories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
          />
        )}

        <CalculatorKeypad
          expression={expression}
          onChangeExpression={setExpression}
          onSubmit={(amountMinor) => void handleSaveTransaction(amountMinor)}
          submitLabel={
            !editingTransactionId && kind === 'expense' && isSplitBill && splitFriendNames.length > 0
              ? isVi
                ? `Lưu & Chia bill (${splitFriendNames.length + 1} người)`
                : `Save & Split (${splitFriendNames.length + 1} ways)`
              : t.quickAddModal.submitBtn
          }
        />
      </div>
    </BottomSheet>
  );
}
