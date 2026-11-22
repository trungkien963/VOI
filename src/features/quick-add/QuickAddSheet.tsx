import { useEffect, useState, type KeyboardEvent, type ReactElement } from 'react';
import {
  ArrowDown,
  ArrowDownUp,
  Banknote,
  Check,
  CreditCard,
  Landmark,
  PiggyBank,
  Plus,
  ShoppingBag,
  Smartphone,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUiStore, type QuickAddFlowKind } from '../../app/ui-store';
import { DEFAULT_STARTER_ACCOUNTS, DEFAULT_STARTER_POCKETS, localDb } from '../../db/dexie-schema';
import { debtRepository } from '../../db/repositories/debt-repository';
import { merchantAliasRepository } from '../../db/repositories/merchant-alias-repository';
import { pocketRepository } from '../../db/repositories/pocket-repository';
import { tagRepository } from '../../db/repositories/tag-repository';
import { transactionRepository } from '../../db/repositories/transaction-repository';
import {
  mergeSystemAndLiveCategories,
  SYSTEM_CATEGORY_IDS,
} from '../../domain/categories/default-categories';
import {
  applyKeypadInput,
  evaluateMoneyExpression,
  hasPendingOperator,
} from '../../domain/money/calculator';
import {
  ALL_DATABASE_CURRENCIES,
  computeImpliedFxRate,
  CURRENCY_METADATA,
  formatMoney,
  formatNumberInputLive,
  parseFlexibleMoneyInput,
  type CurrencyCode,
} from '../../domain/money/currency';
import { parseQuickInput } from '../../domain/quick-parser/parser';
import type {
  Account,
  AccountType,
  Category,
  CategoryKind,
  Pocket,
} from '../../domain/types/entities';
import { getAvatarPresetMeta } from '../onboarding/WelcomeOnboardingModal';
import { getAccountDisplayName, getCategoryDisplayName, useTranslation } from '../../shared/i18n';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { CalculatorKeypad } from '../../shared/ui/CalculatorKeypad';
import { CategoryGridPicker } from '../../shared/ui/CategoryGridPicker';
import { VoiLogo } from '../../shared/ui/VoiLogo';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';

export function QuickAddSheet(): ReactElement {
  const {
    isQuickAddOpen,
    quickAddDefaultKind,
    quickAddDefaultDateIso,
    quickAddDefaultSplitMode,
    quickAddPresetText,
    editingTransactionId,
    thousandsInputMode,
    numberFormat,
    enabledCurrencies,
    addEnabledCurrency,
    toggleEnabledCurrency,
    avatarId,
    closeQuickAdd,
    clearNoSpendDate,
    triggerCelebration,
  } = useUiStore();
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';
  const activeBuddy = getAvatarPresetMeta(avatarId);
  const todayIso = new Date().toISOString().slice(0, 10);

  const liveAccounts = useLiveQuery(() => localDb.accounts.toArray(), [], []);
  const accounts: ReadonlyArray<Account> =
    liveAccounts.length > 0
      ? liveAccounts.filter((a) => a.archived_at === null)
      : DEFAULT_STARTER_ACCOUNTS;

  const livePockets = useLiveQuery(
    async () => {
      const [accs, allPockets] = await Promise.all([
        localDb.accounts.toArray(),
        localDb.pockets.toArray(),
      ]);
      const activeAccIds = new Set(accs.filter((a) => a.archived_at === null).map((a) => a.id));
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
  const allCategories: ReadonlyArray<Category> = mergeSystemAndLiveCategories(liveCategories);

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

  // Separate Account and Currency selection states!
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    DEFAULT_STARTER_ACCOUNTS[0]?.id ?? 'acc-default-bank',
  );
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('VND');
  const [destAccountId, setDestAccountId] = useState<string>(
    DEFAULT_STARTER_ACCOUNTS[1]?.id ?? 'acc-default-cash',
  );
  const [destCurrency, setDestCurrency] = useState<CurrencyCode>('VND');
  const [isAddCurrencyOpen, setIsAddCurrencyOpen] = useState(false);

  const [receivedMajorText, setReceivedMajorText] = useState('');
  const [feeMajorText, setFeeMajorText] = useState('');
  const [showTransferFeeInput, setShowTransferFeeInput] = useState(false);

  // 1-Tap Inline Split Bill state
  const [isSplitBill, setIsSplitBill] = useState(false);
  const [splitFriendsText, setSplitFriendsText] = useState('');
  const [splitOwnShareText, setSplitOwnShareText] = useState('');

  // Active currencies shown in the UI: only those enabled by the user (plus any currently in use by pockets)
  const visibleCurrencies: ReadonlyArray<CurrencyCode> = Array.from(
    new Set<CurrencyCode>([
      ...(enabledCurrencies && enabledCurrencies.length > 0
        ? enabledCurrencies
        : (['VND'] as CurrencyCode[])),
      ...pockets.map((p) => (p.currency ?? 'VND').toUpperCase() as CurrencyCode),
      selectedCurrency,
    ]),
  ).filter((code) => Boolean(CURRENCY_METADATA[code]));

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
    if (accounts[0]) {
      setSelectedAccountId(accounts[0].id);
      const firstCurr = (accounts[0].currency ?? 'VND').toUpperCase() as CurrencyCode;
      setSelectedCurrency(firstCurr);
    }
    if (accounts[1]) {
      setDestAccountId(accounts[1].id);
      setDestCurrency((accounts[1].currency ?? 'VND').toUpperCase() as CurrencyCode);
    }
    if (quickAddPresetText) {
      setQuickInputText(quickAddPresetText);
      const parsed = parseQuickInput(quickAddPresetText, { thousandsInputMode, learnedAliases });
      if (parsed.amountMinor !== null && parsed.amountMinor > 0) {
        setExpression(String(parsed.amountMinor));
      }
      if (parsed.currency) {
        setSelectedCurrency(parsed.currency);
      }
      if (parsed.categoryId) {
        setSelectedCategoryId(parsed.categoryId);
      }
    }
  }, [
    isQuickAddOpen,
    editingTransactionId,
    quickAddDefaultKind,
    quickAddDefaultDateIso,
    quickAddDefaultSplitMode,
    quickAddPresetText,
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
      setSelectedCurrency((tx.currency || 'VND').toUpperCase() as CurrencyCode);
      if (tx.category_id) setSelectedCategoryId(tx.category_id);

      const activeLines = lines.filter((l) => !l.deleted_at);
      if (mappedKind === 'transfer') {
        const outLine = activeLines.find((l) => l.signed_amount_minor < 0 && !l.is_fee);
        const inLine = activeLines.find((l) => l.signed_amount_minor > 0);
        if (outLine?.account_id) setSelectedAccountId(outLine.account_id);
        if (outLine?.currency) setSelectedCurrency(outLine.currency.toUpperCase() as CurrencyCode);
        if (inLine?.account_id) setDestAccountId(inLine.account_id);
        if (inLine?.currency) setDestCurrency(inLine.currency.toUpperCase() as CurrencyCode);
      } else {
        const firstLine = activeLines[0];
        if (firstLine?.account_id) setSelectedAccountId(firstLine.account_id);
        if (firstLine?.currency)
          setSelectedCurrency(firstLine.currency.toUpperCase() as CurrencyCode);
      }
    });
  }, [editingTransactionId, todayIso]);

  const parsedPreview = quickInputText.trim()
    ? parseQuickInput(quickInputText, {
        thousandsInputMode,
        defaultCurrency: selectedCurrency,
        learnedAliases,
        categories: allCategories,
        preferredKind: kind,
      })
    : null;

  const handleQuickInputChange = (rawVal: string): void => {
    const val = rawVal.slice(0, 250);
    setQuickInputText(val);
    const trimmed = val.trim();
    if (!trimmed) return;
    const parsed = parseQuickInput(val, {
      thousandsInputMode,
      defaultCurrency: selectedCurrency,
      learnedAliases,
      categories: allCategories,
      preferredKind: kind,
    });
    if (parsed.amountMinor !== null && parsed.amountMinor > 0) {
      setExpression(String(parsed.amountMinor));
    }
    if (parsed.currency && parsed.currency !== selectedCurrency) {
      addEnabledCurrency(parsed.currency);
      setSelectedCurrency(parsed.currency);
    }
    if (kind === 'expense' && parsed.type === 'income') {
      setKind('income');
      setIsSplitBill(false);
      if (parsed.categoryId && parsed.categoryMatchedByKeyword) {
        setSelectedCategoryId(parsed.categoryId);
      } else if (incomeCategories[0]) {
        setSelectedCategoryId(incomeCategories[0].id);
      }
      return;
    }
    if (kind === 'income' && trimmed.startsWith('-')) {
      setKind('expense');
      if (parsed.categoryId && parsed.categoryMatchedByKeyword) {
        setSelectedCategoryId(parsed.categoryId);
      } else if (expenseCategories[0]) {
        setSelectedCategoryId(expenseCategories[0].id);
      }
      return;
    }
    if (parsed.categoryId && parsed.categoryMatchedByKeyword) {
      const matchedCategoryObj = allCategories.find((c) => c.id === parsed.categoryId);
      if (matchedCategoryObj && (kind === 'expense' || kind === 'income')) {
        if (matchedCategoryObj.kind === 'income' && kind !== 'income') {
          setKind('income');
          setIsSplitBill(false);
        } else if (
          matchedCategoryObj.kind === 'expense' &&
          kind !== 'expense' &&
          !trimmed.startsWith('+')
        ) {
          setKind('expense');
        }
      }
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

  const sourceAccount =
    accounts.find((a) => a.id === selectedAccountId) ?? accounts[0] ?? DEFAULT_STARTER_ACCOUNTS[0]!;
  const destAccount =
    accounts.find((a) => a.id === destAccountId && a.id !== sourceAccount.id) ??
    accounts.find((a) => a.id !== sourceAccount.id) ??
    sourceAccount;

  const sourcePocket =
    pockets.find(
      (p) =>
        p.account_id === sourceAccount.id &&
        (p.currency ?? 'VND').toUpperCase() === selectedCurrency,
    ) ??
    pockets.find((p) => p.account_id === sourceAccount.id) ??
    pockets[0];

  const destPocket =
    pockets.find(
      (p) =>
        p.account_id === destAccount.id &&
        (p.currency ?? 'VND').toUpperCase() === destCurrency &&
        (p.account_id !== sourceAccount.id ||
          (p.currency ?? 'VND').toUpperCase() !== selectedCurrency),
    ) ??
    pockets.find((p) => p.account_id === destAccount.id && p.id !== sourcePocket?.id) ??
    pockets.find((p) => p.id !== sourcePocket?.id) ??
    pockets[0];

  const srcCurrency: CurrencyCode = selectedCurrency;
  const dstCurrency: CurrencyCode = kind === 'transfer' ? destCurrency : selectedCurrency;
  const isCrossCurrency = kind === 'transfer' && srcCurrency !== dstCurrency;

  const evaluatedKeypadMinor = evaluateMoneyExpression(expression);
  const currentEvaluatedMinor =
    evaluatedKeypadMinor > 0 ? evaluatedKeypadMinor : (parsedPreview?.amountMinor ?? 0);
  const showEqualsFirst = hasPendingOperator(expression);

  // Strict Save Requirement:
  // For Expense/Income, allow saving ONLY when Note + Category + Amount (> 0) are ALL filled
  // (or if the user entered a positive amount via calculator keypad while a category is selected —
  // wait: let's check both user note requirement AND existing unit tests!).
  // Wait: in `tests/unit/m0-schema-and-shell.test.tsx`, the test only checks `calculator-evaluated-amount` and closes the modal.
  // What about other tests? No other test clicks submit on QuickAddSheet without a note!
  // So requiring `hasNote && hasCategory && hasAmount` for expense/income matches the user's exact specification:
  // "chỉ khi đã điền note + category + số tiền thì mới cho lưu giao dịch"!
  const hasNote = quickInputText.trim().length > 0;
  const hasCategory = kind === 'transfer' ? true : Boolean(selectedCategoryId);
  const hasAmount = currentEvaluatedMinor > 0;
  const canSaveTransaction =
    kind === 'transfer'
      ? hasAmount && Boolean(sourceAccount && destAccount)
      : hasNote && hasCategory && hasAmount;

  const missingFieldsHints: string[] = [];
  if (kind !== 'transfer' && !hasNote) {
    missingFieldsHints.push(isVi ? 'Ghi chú' : 'Note');
  }
  if (kind !== 'transfer' && !hasCategory) {
    missingFieldsHints.push(isVi ? 'Danh mục' : 'Category');
  }
  if (!hasAmount) {
    missingFieldsHints.push(isVi ? 'Số tiền' : 'Amount');
  }

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
    setShowTransferFeeInput(false);
    setIsAddCurrencyOpen(false);
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

  const resolveOrCreatePocketForAccountAndCurrency = async (
    account: Account,
    currencyCode: CurrencyCode,
  ): Promise<Pocket> => {
    const existing = pockets.find(
      (p) =>
        p.account_id === account.id &&
        (p.currency ?? 'VND').toUpperCase() === currencyCode.toUpperCase(),
    );
    if (existing) return existing;
    return await pocketRepository.createPocketWithOpeningBalance({
      accountId: account.id,
      name: `${account.name} (${currencyCode})`,
      currency: currencyCode,
      openingBalanceMinor: 0,
      colorHex: account.color_hex,
      iconName: account.icon_name,
    });
  };

  const handleSaveTransaction = async (evaluatedMinor: number): Promise<void> => {
    const finalMinor = evaluatedMinor > 0 ? evaluatedMinor : currentEvaluatedMinor;
    if (finalMinor <= 0) return;
    if (kind !== 'transfer' && (!quickInputText.trim() || !selectedCategoryId)) {
      return;
    }

    const resolvedSourcePocket = await resolveOrCreatePocketForAccountAndCurrency(
      sourceAccount,
      srcCurrency,
    );
    const resolvedDestPocket =
      kind === 'transfer'
        ? await resolveOrCreatePocketForAccountAndCurrency(destAccount, dstCurrency)
        : null;

    const cleanNote = parsedPreview?.note?.trim()
      ? parsedPreview.note.trim()
      : quickInputText.trim() || null;
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
        sourceAccountId: resolvedSourcePocket.account_id,
        sourcePocketId: resolvedSourcePocket.id,
        currency: srcCurrency,
        totalPaidMinor: finalMinor,
        ownExpenseMinor: ownMinor,
        categoryId: selectedCategoryId ?? SYSTEM_CATEGORY_IDS.foodDining,
        note: cleanNote ?? (isVi ? 'Chia hoá đơn nhóm' : 'Group bill split'),
        occurredAt,
        shares,
      });

      const splitFormatted = formatMoney(finalMinor, srcCurrency);
      triggerCelebration({
        kind: 'transaction_saved',
        variant: 'toast',
        flowMascot: 'lend-borrow',
        title: isVi
          ? `Đã chia bill ${splitFormatted} (${splitFriendNames.length + 1} người)`
          : `Split bill ${splitFormatted} (${splitFriendNames.length + 1} ways)`,
        subtitle: isVi
          ? `Phần bạn: ${formatMoney(ownMinor, srcCurrency)} · Ứng bạn bè: ${formatMoney(remainingLent, srcCurrency)}`
          : `Yours: ${formatMoney(ownMinor, srcCurrency)} · Lent: ${formatMoney(remainingLent, srcCurrency)}`,
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
      sourceAccountId: resolvedSourcePocket.account_id,
      sourcePocketId: resolvedSourcePocket.id,
      destinationAccountId: kind === 'transfer' ? resolvedDestPocket?.account_id : undefined,
      destinationPocketId: kind === 'transfer' ? (resolvedDestPocket?.id ?? null) : null,
      destinationAmountMinor: kind === 'transfer' ? dstAmountMinor : undefined,
      destinationCurrency: kind === 'transfer' ? dstCurrency : undefined,
      transferFeeMinor: feeMinor,
      categoryId: kind === 'transfer' ? null : selectedCategoryId,
      note: cleanNote,
      occurredAt,
    };

    const existingRealTxsCount = editingTransactionId
      ? 1
      : (await localDb.transactions.toArray()).filter(
          (tx) => tx.type !== 'opening_balance' && tx.voided_at === null && tx.status !== 'void',
        ).length;

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
        accountId: resolvedSourcePocket.account_id,
      });
    }

    const formattedAmt = formatMoney(finalMinor, srcCurrency);
    const chosenCat = allCategories.find((c) => c.id === selectedCategoryId);
    const labelText =
      cleanNote || (chosenCat ? getCategoryDisplayName(chosenCat, t) : t.flows.cost);
    const accountDisplayName = `${getAccountDisplayName(sourceAccount, locale)} · ${srcCurrency}`;

    const savedFlowMascot =
      kind === 'income' ? 'income' : kind === 'transfer' ? 'transfer' : 'expense';

    if (!editingTransactionId && existingRealTxsCount === 0) {
      triggerCelebration({
        kind: 'first_transaction',
        variant: 'modal',
        flowMascot: savedFlowMascot,
        amountText: `${kind === 'income' ? '+' : '-'}${formattedAmt} · ${labelText}`,
        title: isVi ? 'Chúc mừng giao dịch đầu tiên! 🎉' : 'Congrats on your first log! 🎉',
        subtitle: isVi
          ? `Đã ghi nhận vào ${accountDisplayName}. Bạn vừa mở khóa Chuỗi kỷ luật 🔥 Ngày 1!`
          : `Saved to ${accountDisplayName}. You just unlocked your 🔥 Day 1 Streak!`,
      });
    } else {
      triggerCelebration({
        kind: 'transaction_saved',
        variant: 'toast',
        flowMascot: savedFlowMascot,
        title: isVi
          ? `Đã lưu ${kind === 'income' ? '+' : kind === 'expense' ? '-' : ''}${formattedAmt} (${labelText})`
          : `Saved ${kind === 'income' ? '+' : kind === 'expense' ? '-' : ''}${formattedAmt} (${labelText})`,
        subtitle: isVi ? `Tài khoản: ${accountDisplayName}` : `Wallet: ${accountDisplayName}`,
      });
    }

    handleClose();
  };

  // Modern Web Guidance `ime-safe-enter-submit`: guard against IME composition (`isComposing` or `keyCode === 229`)
  const handleInputKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
        return;
      }
      if (canSaveTransaction && currentEvaluatedMinor > 0) {
        void handleSaveTransaction(currentEvaluatedMinor);
      }
    }
  };

  const renderAccountTypeGlyph = (type?: AccountType): ReactElement => {
    switch (type) {
      case 'bank':
        return <Landmark className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" />;
      case 'cash':
        return <Banknote className="h-3.5 w-3.5 shrink-0 text-[#D97706]" />;
      case 'e_wallet':
        return <Smartphone className="h-3.5 w-3.5 shrink-0 text-[#DB2777]" />;
      case 'credit_card':
        return <CreditCard className="h-3.5 w-3.5 shrink-0 text-[#7C3AED]" />;
      case 'investment':
        return <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[#0D9488]" />;
      case 'bnpl':
        return <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-[#DB2777]" />;
      case 'savings':
      default:
        return <PiggyBank className="h-3.5 w-3.5 shrink-0 text-[#059669]" />;
    }
  };

  const previewImpliedFx =
    isCrossCurrency &&
    currentEvaluatedMinor > 0 &&
    parseFlexibleMoneyInput(receivedMajorText, dstCurrency) > 0
      ? computeImpliedFxRate(
          currentEvaluatedMinor,
          srcCurrency,
          parseFlexibleMoneyInput(receivedMajorText, dstCurrency),
          dstCurrency,
        )
      : null;

  const smartInputPlaceholder =
    kind === 'income'
      ? isVi
        ? 'VD: Lương tháng 15tr, Thưởng dự án 2tr, Freelance...'
        : 'e.g. Monthly salary 15m, Project bonus 2m, Freelance...'
      : kind === 'transfer'
        ? isVi
          ? 'Ghi chú chuyển khoản (VD: Rút tiền mặt 2tr, Nạp ví...)'
          : 'Transfer note (e.g. Withdraw ATM 2m, Top up wallet...)'
        : t.quickAddModal.placeholder;

  const activeFlowMascot =
    kind === 'income'
      ? 'income'
      : kind === 'transfer'
        ? 'transfer'
        : isSplitBill
          ? 'lend-borrow'
          : 'expense';

  const submitButtonLabel =
    !editingTransactionId && kind === 'expense' && isSplitBill && splitFriendNames.length > 0
      ? isVi
        ? `Lưu & Chia bill (${splitFriendNames.length + 1} người)`
        : `Save & Split (${splitFriendNames.length + 1} ways)`
      : t.quickAddModal.submitBtn;

  const handleFooterPrimarySubmit = (): void => {
    if (showEqualsFirst) {
      setExpression(applyKeypadInput(expression, '='));
      return;
    }
    if (!canSaveTransaction) return;
    void handleSaveTransaction(currentEvaluatedMinor);
  };

  return (
    <BottomSheet
      open={isQuickAddOpen}
      onClose={handleClose}
      title={editingTransactionId ? t.quickAddModal.editTitle : t.quickAddModal.title}
      titleId="quick-add-modal-title"
      closeLabel={t.quickAddModal.closeBtn}
      headerAccessory={<VoiLogo variant="cobalt" size={30} className="rounded-xl" />}
      footer={
        <div className="space-y-1">
          {!showEqualsFirst && !canSaveTransaction && missingFieldsHints.length > 0 && (
            <p
              data-testid="quick-add-missing-fields-hint"
              className="text-center text-[11px] font-bold text-[var(--ink-secondary)]"
            >
              {isVi
                ? `Điền đủ để lưu: ${missingFieldsHints.join(' + ')}`
                : `Required to save: ${missingFieldsHints.join(' + ')}`}
            </p>
          )}
          <button
            type="button"
            data-testid="quick-add-sticky-submit-btn"
            disabled={!showEqualsFirst && !canSaveTransaction}
            onClick={handleFooterPrimarySubmit}
            className={`flex w-full items-center justify-center rounded-2xl py-3.5 text-base font-black shadow-sm transition ${
              showEqualsFirst || canSaveTransaction
                ? 'bg-[#191919] text-[#FAFAFA] hover:opacity-95 active:scale-[0.99]'
                : 'cursor-not-allowed bg-[var(--bg-subtle)] text-[var(--ink-muted)] opacity-75'
            }`}
          >
            {showEqualsFirst ? t.calculator.computeEqualsBtn : submitButtonLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-2.5">
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

        {/* Hidden accessible <select> elements kept in sync for screen readers */}
        <label htmlFor="quick-add-source-pocket" className="sr-only">
          {t.quickAddModal.sourcePocketLabel}
        </label>
        <select
          id="quick-add-source-pocket"
          value={sourcePocket?.id ?? ''}
          onChange={(e) => {
            const p = pockets.find((item) => item.id === e.target.value);
            if (p) {
              setSelectedAccountId(p.account_id);
              setSelectedCurrency((p.currency ?? 'VND').toUpperCase() as CurrencyCode);
            }
          }}
          className="sr-only"
        >
          {pockets.map((p) => (
            <option key={p.id} value={p.id}>
              {getAccountDisplayName(p, locale)}
            </option>
          ))}
        </select>

        {kind === 'transfer' && (
          <>
            <label htmlFor="quick-add-dest-pocket" className="sr-only">
              {t.quickAddModal.destPocketLabel}
            </label>
            <select
              id="quick-add-dest-pocket"
              value={destPocket?.id ?? ''}
              onChange={(e) => {
                const p = pockets.find((item) => item.id === e.target.value);
                if (p) {
                  setDestAccountId(p.account_id);
                  setDestCurrency((p.currency ?? 'VND').toUpperCase() as CurrencyCode);
                }
              }}
              className="sr-only"
            >
              {pockets
                .filter((p) => p.id !== sourcePocket?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {getAccountDisplayName(p, locale)}
                  </option>
                ))}
            </select>
          </>
        )}

        {/* 1. BOX INPUT (MAX 250 CHARS, NO SUGGESTION CHIPS, COUNTER BELOW TEXT SO ZERO OVERLAY!) */}
        <div className="space-y-1.5">
          <div className="overflow-hidden rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--bg-subtle)] transition-colors focus-within:border-[#191919] focus-within:bg-[var(--bg-card)]">
            <textarea
              id="quick-add-smart-note-input"
              data-testid="quick-add-smart-note-input"
              rows={quickInputText.length > 48 || quickInputText.includes('\n') ? 3 : 2}
              maxLength={250}
              value={quickInputText}
              onChange={(e) => handleQuickInputChange(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={smartInputPlaceholder}
              className="block w-full resize-none bg-transparent px-3.5 pt-2.5 pb-1 text-sm leading-snug font-extrabold text-[var(--ink-primary)] placeholder:text-xs placeholder:font-semibold placeholder:text-[var(--ink-muted)] focus:outline-none"
            />
            {/* Dedicated bottom bar inside the input box so the 0/250 counter NEVER overlaps typed text */}
            <div className="flex items-center justify-between px-3 pb-1.5 text-[10px]">
              <div className="flex min-w-0 items-center gap-1.5">
                {parsedPreview && parsedPreview.amountMinor !== null && (
                  <span
                    data-testid="quick-input-live-preview"
                    className="inline-flex items-center gap-1 font-extrabold text-[var(--ink-primary)] tabular-nums"
                  >
                    <Sparkles
                      className="h-3 w-3 shrink-0"
                      style={{ color: activeBuddy.characterFillHex }}
                    />
                    <span>= {formatMoney(parsedPreview.amountMinor, parsedPreview.currency)}</span>
                  </span>
                )}
                {parsedPreview?.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#191919] px-1.5 py-0.5 text-[9px] font-bold text-[#FAFAFA]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  data-testid="quick-input-char-limit"
                  className="font-bold text-[var(--ink-muted)] tabular-nums"
                >
                  {quickInputText.length}/250
                </span>
                {quickInputText.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuickInputText('')}
                    aria-label={isVi ? 'Xoá nội dung' : 'Clear note'}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. CATEGORY SELECTION PANEL (Right below Box Input!) */}
        {kind !== 'transfer' && (
          <CategoryGridPicker
            categories={visibleCategories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
          />
        )}

        {/* 3. ACCOUNT SCROLL ROW & 4. SEPARATE CURRENCY SCROLL ROW */}
        {kind !== 'transfer' ? (
          <div className="space-y-1.5">
            {/* Row 3: Separate Account Horizontal Scroll */}
            <div
              data-testid="quick-add-account-scroll"
              className="flex items-center gap-1.5 overflow-x-auto py-0.5"
            >
              {accounts.map((acc) => {
                const isSelected = acc.id === sourceAccount.id;
                const walletName = getAccountDisplayName(acc, locale);
                return (
                  <button
                    key={acc.id}
                    type="button"
                    data-testid={`quick-add-account-pill-${acc.id}`}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition ${
                      isSelected
                        ? 'border-2 border-[#191919] bg-[#191919] font-extrabold text-[#FAFAFA] shadow-2xs'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)] font-bold text-[var(--ink-primary)] hover:border-[#191919]'
                    }`}
                  >
                    {renderAccountTypeGlyph(acc.type)}
                    <span className="max-w-[140px] truncate">{walletName}</span>
                  </button>
                );
              })}
            </div>

            {/* Row 4: Separate Currency Horizontal Scroll (Only User's Enabled Currencies + Quick Add Currency Button) */}
            <div
              data-testid="quick-add-currency-scroll"
              className="flex items-center gap-1.5 overflow-x-auto py-0.5"
            >
              {visibleCurrencies.map((code) => {
                const isSelected = code === selectedCurrency;
                const meta = CURRENCY_METADATA[code];
                return (
                  <button
                    key={code}
                    type="button"
                    data-testid={`quick-add-currency-pill-${code}`}
                    onClick={() => setSelectedCurrency(code)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-extrabold tabular-nums transition ${
                      isSelected
                        ? 'border-2 border-[#191919] bg-[#191919] text-[#FAFAFA] shadow-2xs'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)] hover:border-[#191919] hover:text-[var(--ink-primary)]'
                    }`}
                  >
                    <span>{code}</span>
                    {meta && (
                      <span
                        className={`text-[10px] ${
                          isSelected ? 'text-[#FAFAFA]/80' : 'text-[var(--ink-muted)]'
                        }`}
                      >
                        ({meta.symbol})
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                data-testid="quick-add-more-currencies-btn"
                onClick={() => setIsAddCurrencyOpen((v) => !v)}
                className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold transition ${
                  isAddCurrencyOpen
                    ? 'border-[#191919] bg-[#191919] text-[#FAFAFA]'
                    : 'border-dashed border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--ink-secondary)] hover:border-[#191919] hover:text-[var(--ink-primary)]'
                }`}
              >
                <Plus className="h-3 w-3" />
                <span>{isVi ? 'Ngoại tệ' : 'Currency'}</span>
              </button>
            </div>

            {/* Inline Drawer to Enable/Disable Currencies from the 20-Currency Database Catalog */}
            {isAddCurrencyOpen && (
              <div
                data-testid="quick-add-currency-catalog-drawer"
                className="space-y-1.5 rounded-2xl border border-[#191919] bg-[var(--bg-subtle)] p-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-[var(--ink-primary)]">
                    {isVi
                      ? 'Chọn ngoại tệ muốn hiển thị (20 loại tiền trong DB)'
                      : 'Select active currencies to display'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddCurrencyOpen(false)}
                    className="rounded-full p-0.5 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto py-0.5">
                  {ALL_DATABASE_CURRENCIES.map((code) => {
                    const meta = CURRENCY_METADATA[code];
                    const isEnabled = (enabledCurrencies ?? ['VND']).includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        data-testid={`catalog-currency-toggle-${code}`}
                        onClick={() => {
                          toggleEnabledCurrency(code);
                          if (!isEnabled) {
                            setSelectedCurrency(code);
                          }
                        }}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                          isEnabled
                            ? 'border-[#191919] bg-[#191919] text-[#FAFAFA]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-secondary)] hover:border-[#191919]'
                        }`}
                      >
                        {isEnabled && <Check className="h-3 w-3" />}
                        <span>
                          {code} ({meta.symbol})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Transfer Route Card with Separate Account & Currency Rows */
          <div className="space-y-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/75 p-2.5">
            {/* Step 1: Source Wallet + Source Currency */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] font-black tracking-wide text-[var(--ink-secondary)] uppercase">
                  {isVi ? '1. Từ ví nguồn (Chuyển đi)' : '1. From Wallet (Source)'}
                </span>
                <span className="text-[10px] font-extrabold text-[var(--ink-primary)]">
                  {getAccountDisplayName(sourceAccount, locale)} · {srcCurrency}
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                {accounts.map((acc) => {
                  const isSelected = acc.id === sourceAccount.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setSelectedAccountId(acc.id)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition ${
                        isSelected
                          ? 'border-2 border-[#191919] bg-[#191919] font-extrabold text-[#FAFAFA] shadow-2xs'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-card)] font-bold text-[var(--ink-primary)] hover:border-[#191919]'
                      }`}
                    >
                      {renderAccountTypeGlyph(acc.type)}
                      <span className="max-w-[125px] truncate">
                        {getAccountDisplayName(acc, locale)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                {visibleCurrencies.map((code) => {
                  const isSelected = code === selectedCurrency;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setSelectedCurrency(code)}
                      className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] font-extrabold transition ${
                        isSelected
                          ? 'border-[#191919] bg-[#191919] text-[#FAFAFA]'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-secondary)]'
                      }`}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Middle Route Connector */}
            <div className="flex items-center justify-between border-y border-[var(--border-hairline)] py-1.5">
              <div className="inline-flex items-center gap-1 text-[10px] font-black text-[#2563EB]">
                <ArrowDown className="h-3.5 w-3.5 stroke-[2.6]" />
                <span>{isVi ? '2. Đến ví nhận' : '2. To Destination Wallet'}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const prevAcc = sourceAccount.id;
                    const prevCurr = selectedCurrency;
                    setSelectedAccountId(destAccount.id);
                    setSelectedCurrency(destCurrency);
                    setDestAccountId(prevAcc);
                    setDestCurrency(prevCurr);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--ink-primary)] transition hover:border-[#191919]"
                >
                  <ArrowDownUp className="h-2.5 w-2.5" />
                  <span>{isVi ? 'Đảo chiều' : 'Swap'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTransferFeeInput((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold transition ${
                    showTransferFeeInput || feeMajorText.trim().length > 0
                      ? 'border-[#191919] bg-[#191919] text-[#FAFAFA]'
                      : 'border-dashed border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  <Plus className="h-2.5 w-2.5" />
                  <span>{isVi ? 'Phí chuyển' : 'Fee'}</span>
                </button>
              </div>
            </div>

            {/* Step 2: Destination Wallet + Destination Currency */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                {accounts.map((acc) => {
                  const isSelected = acc.id === destAccount.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setDestAccountId(acc.id)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition ${
                        isSelected
                          ? 'border-2 border-[#2563EB] bg-[#2563EB] font-extrabold text-white shadow-2xs'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-card)] font-bold text-[var(--ink-primary)] hover:border-[#2563EB]'
                      }`}
                    >
                      {renderAccountTypeGlyph(acc.type)}
                      <span className="max-w-[125px] truncate">
                        {getAccountDisplayName(acc, locale)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                {visibleCurrencies.map((code) => {
                  const isSelected = code === destCurrency;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setDestCurrency(code)}
                      className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] font-extrabold transition ${
                        isSelected
                          ? 'border-[#2563EB] bg-[#2563EB] text-white'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-secondary)]'
                      }`}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Collapsible Cross-Currency & Optional Fee Row (Formatted with Thousand Separators Live!) */}
            {(isCrossCurrency || showTransferFeeInput || feeMajorText.trim().length > 0) && (
              <div className="grid grid-cols-1 gap-2 border-t border-[var(--border-hairline)] pt-2 sm:grid-cols-2">
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
                      onChange={(e) =>
                        setReceivedMajorText(formatNumberInputLive(e.target.value, numberFormat))
                      }
                      placeholder="0"
                      className="mt-0.5 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-bold text-[var(--ink-primary)] tabular-nums"
                    />
                    {previewImpliedFx !== null && (
                      <p className="mt-0.5 text-[10px] font-semibold text-[#0D9488]">
                        {t.quickAddModal.impliedFxPrefix}: 1 {srcCurrency} = {previewImpliedFx}{' '}
                        {dstCurrency}
                      </p>
                    )}
                  </div>
                )}

                {(showTransferFeeInput || feeMajorText.trim().length > 0) && (
                  <div className={isCrossCurrency ? '' : 'sm:col-span-2'}>
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
                      onChange={(e) =>
                        setFeeMajorText(formatNumberInputLive(e.target.value, numberFormat))
                      }
                      placeholder="0"
                      className="mt-0.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-primary)] tabular-nums"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Expanded Split Bill Panel (Only when opened via Split Bill shortcut) */}
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
                  onChange={(e) =>
                    setSplitOwnShareText(formatNumberInputLive(e.target.value, numberFormat))
                  }
                  placeholder={
                    defaultOwnShareMinor > 0
                      ? formatNumberInputLive(String(defaultOwnShareMinor), numberFormat)
                      : isVi
                        ? 'Tự chia đều'
                        : 'Auto'
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
                <span className="text-[var(--ink-secondary)]">{isVi ? 'Tổng: ' : 'Total: '}</span>
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

        {/* 5. Ô BÉ CÁNH TÍM ĐANG HIỆN CHI TIÊU (Click to expand Calculator Keypad; Save button frozen in footer below!) */}
        <CalculatorKeypad
          expression={expression}
          onChangeExpression={setExpression}
          onSubmit={(amountMinor) => void handleSaveTransaction(amountMinor)}
          flowMascot={activeFlowMascot}
          currency={srcCurrency}
          defaultKeypadOpen={false}
          hideSubmitButton={true}
          submitLabel={submitButtonLabel}
        />
      </div>
    </BottomSheet>
  );
}
