import { useEffect, useState, type ReactElement } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Flame,
  Landmark,
  PiggyBank,
  Plus,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUiStore, type AvatarPresetId, type WelcomeStepId } from '../../app/ui-store';
import { DEFAULT_STARTER_ACCOUNTS, DEFAULT_STARTER_POCKETS, localDb } from '../../db/dexie-schema';
import { accountRepository } from '../../db/repositories/account-repository';
import { budgetRepository } from '../../db/repositories/budget-repository';
import { onboardingRepository } from '../../db/repositories/onboarding-repository';
import { transactionRepository } from '../../db/repositories/transaction-repository';
import { mergeSystemAndLiveCategories } from '../../domain/categories/default-categories';
import { getLedgerStrategy } from '../../domain/ledger/strategies';
import { formatMoney, parseFlexibleMoneyInput } from '../../domain/money/currency';
import type {
  AccountType,
  BuddyAccessory,
  Category,
  GeometricShape,
} from '../../domain/types/entities';
import { getCategoryDisplayName, useTranslation } from '../../shared/i18n';
import { CategoryIcon } from '../../shared/ui/CategoryIcon';
import { GeometricBuddy } from '../../shared/ui/GeometricBuddy';
import { VoiFlowIcon } from '../../shared/ui/VoiFlowIcon';
import { VoiLogo } from '../../shared/ui/VoiLogo';

export interface AvatarPresetMeta {
  id: AvatarPresetId;
  nameVi: string;
  nameEn: string;
  tagVi: string;
  tagEn: string;
  cardBgHex: string;
  characterFillHex: string;
  shape: GeometricShape;
  accessory: BuddyAccessory;
}

export const AVATAR_PRESETS: ReadonlyArray<AvatarPresetMeta> = [
  {
    id: 'sunny',
    nameVi: 'Quý Ông Voi',
    nameEn: 'Gentleman Voi',
    tagVi: 'Tiết kiệm lịch lãm',
    tagEn: 'Dapper Saver',
    cardBgHex: '#F2D147',
    characterFillHex: '#FF7A1A',
    shape: 'arch',
    accessory: 'cap',
  },
  {
    id: 'cobalt',
    nameVi: 'Voi Trí Nhớ',
    nameEn: 'Memory Voi',
    tagVi: 'Rõ ràng từng đồng',
    tagEn: 'Crystal Clear',
    cardBgHex: '#BCDBEB',
    characterFillHex: '#5E89ED',
    shape: 'hexagon',
    accessory: 'glasses',
  },
  {
    id: 'matcha',
    nameVi: 'Voi Tập Gym',
    nameEn: 'Gym Voi',
    tagVi: 'Giữ kỷ luật thép',
    tagEn: 'Iron Discipline',
    cardBgHex: '#B7EDB8',
    characterFillHex: '#52C470',
    shape: 'square',
    accessory: 'spiky-hair',
  },
  {
    id: 'flamingo',
    nameVi: 'Voi Tung Xu',
    nameEn: 'Coin-Toss Voi',
    tagVi: 'Tận hưởng thông minh',
    tagEn: 'Smart Spender',
    cardBgHex: '#D7C3F8',
    characterFillHex: '#BF9BDE',
    shape: 'circle',
    accessory: 'curly-hair',
  },
  {
    id: 'pop',
    nameVi: 'Siêu Voi',
    nameEn: 'Super Voi',
    tagVi: 'Ghi nhanh 3 giây',
    tagEn: '3-Second Logger',
    cardBgHex: '#F7D1C3',
    characterFillHex: '#FF7A1A',
    shape: 'triangle',
    accessory: 'headphones',
  },
  {
    id: 'rose',
    nameVi: 'Voi Yêu Thương',
    nameEn: 'Family Voi',
    tagVi: 'Không lo cuối tháng',
    tagEn: 'Zero Stress',
    cardBgHex: '#F5C2D7',
    characterFillHex: '#EF6EA5',
    shape: 'pentagon',
    accessory: 'cheering',
  },
];

export function getAvatarPresetMeta(avatarId: AvatarPresetId): AvatarPresetMeta {
  return AVATAR_PRESETS.find((item) => item.id === avatarId) ?? AVATAR_PRESETS[1]!;
}

const BALANCE_QUICK_CHIPS = [
  { labelVi: '500k', labelEn: '500k ₫', amountMinor: 500_000 },
  { labelVi: '1 triệu', labelEn: '1M ₫', amountMinor: 1_000_000 },
  { labelVi: '3 triệu', labelEn: '3M ₫', amountMinor: 3_000_000 },
  { labelVi: '5 triệu', labelEn: '5M ₫', amountMinor: 5_000_000 },
  { labelVi: '10 triệu', labelEn: '10M ₫', amountMinor: 10_000_000 },
  { labelVi: '20 triệu', labelEn: '20M ₫', amountMinor: 20_000_000 },
];

const INCOME_QUICK_CHIPS = [
  { labelVi: '8 triệu', labelEn: '8M ₫', amountMinor: 8_000_000 },
  { labelVi: '12 triệu', labelEn: '12M ₫', amountMinor: 12_000_000 },
  { labelVi: '15 triệu', labelEn: '15M ₫', amountMinor: 15_000_000 },
  { labelVi: '20 triệu', labelEn: '20M ₫', amountMinor: 20_000_000 },
  { labelVi: '30 triệu', labelEn: '30M ₫', amountMinor: 30_000_000 },
  { labelVi: 'Chưa cố định', labelEn: 'Variable', amountMinor: 0 },
];

const BUDGET_QUICK_CHIPS = [
  { labelVi: '3 triệu', labelEn: '3M ₫', amountMinor: 3_000_000 },
  { labelVi: '5 triệu', labelEn: '5M ₫', amountMinor: 5_000_000 },
  { labelVi: '6 triệu', labelEn: '6M ₫', amountMinor: 6_000_000 },
  { labelVi: '8 triệu', labelEn: '8M ₫', amountMinor: 8_000_000 },
  { labelVi: '10 triệu', labelEn: '10M ₫', amountMinor: 10_000_000 },
  { labelVi: '15 triệu', labelEn: '15M ₫', amountMinor: 15_000_000 },
];

export interface ExtraWalletDraft {
  id: string;
  name: string;
  type: AccountType;
  balanceText: string;
  creditLimitText: string;
}

const DEFAULT_CORE_CATEGORY_IDS = [
  '10000000-0000-4000-8000-000000000001', // Ăn uống
  '10000000-0000-4000-8000-000000000003', // Nhà ở & Hóa đơn
  '10000000-0000-4000-8000-000000000002', // Di chuyển
  '10000000-0000-4000-8000-000000000004', // Mua sắm
  '10000000-0000-4000-8000-000000000005', // Giải trí & Xã hội
];

function distributeTotalIntoCategoryCaps(
  totalMinor: number,
  categoryIds: ReadonlyArray<string>,
): Record<string, string> {
  const fmt = (n: number): string =>
    new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(n)));
  const round100k = (val: number): number => Math.max(200_000, Math.round(val / 100_000) * 100_000);

  if (categoryIds.length === 0 || totalMinor <= 0) return {};

  const weights: Record<string, number> = {
    '10000000-0000-4000-8000-000000000001': 0.35, // Ăn uống
    '10000000-0000-4000-8000-000000000003': 0.25, // Nhà ở & Hóa đơn
    '10000000-0000-4000-8000-000000000002': 0.12, // Di chuyển
    '10000000-0000-4000-8000-000000000004': 0.14, // Mua sắm
    '10000000-0000-4000-8000-000000000005': 0.14, // Giải trí & Xã hội
  };

  const result: Record<string, string> = {};
  let allocated = 0;
  const fallbackWeight = 1 / categoryIds.length;

  categoryIds.forEach((catId, idx) => {
    if (idx === categoryIds.length - 1) {
      const remainder = Math.max(100_000, totalMinor - allocated);
      result[catId] = fmt(remainder);
    } else {
      const w = weights[catId] ?? fallbackWeight;
      const amt = round100k(totalMinor * w);
      allocated += amt;
      result[catId] = fmt(amt);
    }
  });

  return result;
}

function getRemainingDaysInCurrentMonth(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.max(1, lastDay - now.getDate() + 1);
}

async function applyFirstRunWalletAndBudgetSetup(params: {
  mainBankName: string;
  openingBalanceMinor: number;
  cashBalanceMinor: number;
  eWalletName: string;
  eWalletBalanceMinor: number;
  removedStarterIds: ReadonlyArray<'bank' | 'cash' | 'momo'>;
  extraWallets: ReadonlyArray<ExtraWalletDraft>;
  monthlyIncomeMinor: number;
  paydayDay: number;
  salaryTargetKey: 'bank' | 'cash' | 'momo';
  salaryCycleMode: 'included_in_balance' | 'pending_this_month';
  categoryAllocations: ReadonlyArray<{ categoryId: string; limitMinor: number }>;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const todayIso = nowIso.slice(0, 10);
  const monthKey = nowIso.slice(0, 7);

  // Ensure default accounts and pockets exist
  const existingAccCount = await localDb.accounts.count();
  if (existingAccCount === 0) {
    await localDb.accounts.bulkPut(DEFAULT_STARTER_ACCOUNTS);
    await localDb.pockets.bulkPut(DEFAULT_STARTER_POCKETS);
  }

  const setOrArchiveStarterAccount = async (
    key: 'bank' | 'cash' | 'momo',
    accountId: string,
    pocketId: string,
    targetBalanceMinor: number,
    customName?: string,
  ): Promise<void> => {
    const acc = await localDb.accounts.get(accountId);
    const pocket = await localDb.pockets.get(pocketId);
    if (!acc || !pocket) return;

    if (params.removedStarterIds.includes(key)) {
      await localDb.accounts.put({ ...acc, archived_at: nowIso, updated_at: nowIso });
      await localDb.pockets.put({ ...pocket, archived_at: nowIso, updated_at: nowIso });
      return;
    }

    const cleanName = customName?.trim() || acc.name;
    await localDb.accounts.put({
      ...acc,
      name: cleanName,
      institution_name: null,
      archived_at: null,
      updated_at: nowIso,
    });
    await localDb.pockets.put({
      ...pocket,
      name: `${cleanName} (${pocket.currency ?? 'VND'})`,
      archived_at: null,
      updated_at: nowIso,
    });

    const latestPocket = (await localDb.pockets.get(pocketId)) ?? pocket;
    const deltaMinor = targetBalanceMinor - latestPocket.cached_balance_minor;
    if (deltaMinor !== 0) {
      const obBundle = getLedgerStrategy('opening_balance').buildBundle({
        transactionId: `tx-ob-welcome-${accountId}-${Date.now()}`,
        userId: 'local-user',
        type: 'opening_balance',
        amountMinor: deltaMinor,
        currency: 'VND',
        sourceAccountId: acc.id,
        sourcePocketId: latestPocket.id,
        note: 'Số dư khởi tạo ban đầu',
        occurredAt: nowIso,
      });
      await transactionRepository.saveBundlesAtomic([obBundle]);
    }
  };

  await setOrArchiveStarterAccount(
    'bank',
    'acc-default-bank',
    'pocket-acc-default-bank-vnd',
    params.openingBalanceMinor,
    params.mainBankName,
  );
  await setOrArchiveStarterAccount(
    'cash',
    'acc-default-cash',
    'pocket-acc-default-cash-vnd',
    params.cashBalanceMinor,
    'Ví tiền mặt',
  );
  await setOrArchiveStarterAccount(
    'momo',
    'acc-default-momo',
    'pocket-acc-default-momo-vnd',
    params.eWalletBalanceMinor,
    params.eWalletName,
  );

  // Create any extra Wallets / Credit Cards / Payment Methods added by the user
  for (const extra of params.extraWallets) {
    if (!extra.name.trim()) continue;
    const rawBal = parseFlexibleMoneyInput(extra.balanceText, 'VND');
    const signedBal = extra.type === 'credit_card' && rawBal > 0 ? -Math.abs(rawBal) : rawBal;
    const creditLimit =
      extra.type === 'credit_card'
        ? Math.max(5_000_000, parseFlexibleMoneyInput(extra.creditLimitText, 'VND'))
        : null;

    await accountRepository.createAccountWithOpeningBalance({
      name: extra.name.trim(),
      type: extra.type,
      currency: 'VND',
      openingBalanceMinor: signedBal,
      creditLimitMinor: creditLimit,
    });
  }

  await onboardingRepository.markStepCompleted('created_main_account');

  // Save Monthly Salary / Income rule (if > 0)
  if (params.monthlyIncomeMinor > 0) {
    const resolvedKey: 'bank' | 'cash' | 'momo' = !params.removedStarterIds.includes(
      params.salaryTargetKey,
    )
      ? params.salaryTargetKey
      : !params.removedStarterIds.includes('bank')
        ? 'bank'
        : !params.removedStarterIds.includes('cash')
          ? 'cash'
          : 'momo';

    const activeStarterAccId =
      resolvedKey === 'bank'
        ? 'acc-default-bank'
        : resolvedKey === 'cash'
          ? 'acc-default-cash'
          : 'acc-default-momo';
    const activeStarterPocketId =
      resolvedKey === 'bank'
        ? 'pocket-acc-default-bank-vnd'
        : resolvedKey === 'cash'
          ? 'pocket-acc-default-cash-vnd'
          : 'pocket-acc-default-momo-vnd';

    await budgetRepository.setupOrConfirmMonthlySalaryAtomic({
      amountMinor: params.monthlyIncomeMinor,
      paydayDayOfMonth: params.paydayDay,
      accountId: activeStarterAccId,
      pocketId: activeStarterPocketId,
      referenceDateIso: todayIso,
      confirmForCurrentMonth: false,
      alreadyIncludedInOpeningBalance: params.salaryCycleMode === 'included_in_balance',
      title: 'Lương / Thu nhập hàng tháng',
    });
  }

  // Save Per-Category Spending Caps
  for (const item of params.categoryAllocations) {
    if (item.limitMinor > 0) {
      await budgetRepository.upsertMonthlyBudgetAtomic({
        monthKey,
        categoryId: item.categoryId,
        limitMinor: item.limitMinor,
        alertThresholdPct: 80,
      });
    }
  }
  if (params.categoryAllocations.some((i) => i.limitMinor > 0)) {
    await onboardingRepository.markStepCompleted('created_first_budget_or_goal');
  }
}

export function WelcomeOnboardingModal(): ReactElement | null {
  const {
    isWelcomeOpen,
    welcomeInitialStep,
    userName,
    avatarId,
    locale,
    setLocale,
    setAvatarId,
    closeWelcomeModal,
    completeWelcomeOnboarding,
    openQuickAdd,
  } = useUiStore();
  const { t } = useTranslation();
  const isVi = locale === 'vi';

  const liveCategoriesRaw = useLiveQuery(() => localDb.categories.toArray(), []);
  const allCategories = mergeSystemAndLiveCategories(liveCategoriesRaw ?? []);
  const expenseParents = allCategories.filter(
    (c) => c.kind === 'expense' && c.parent_id === null && c.archived_at === null,
  );

  const [step, setStep] = useState<WelcomeStepId>(welcomeInitialStep);
  const [draftName, setDraftName] = useState(userName);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarPresetId>(avatarId);

  // 1. Wallets, Cards & Payment Methods state (No hardcoded VCB, every wallet is deletable!)
  const [activeSetupSection, setActiveSetupSection] = useState<'wallets' | 'income' | 'budget'>(
    'wallets',
  );
  const [mainBankName, setMainBankName] = useState(isVi ? 'Tài khoản Ngân hàng' : 'Bank Account');
  const [openingBalanceText, setOpeningBalanceText] = useState('5.000.000');
  const [cashBalanceText, setCashBalanceText] = useState('0');
  const [eWalletName, setEWalletName] = useState(isVi ? 'Ví điện tử' : 'E-Wallet');
  const [eWalletBalanceText, setEWalletBalanceText] = useState('0');
  const [removedStarterIds, setRemovedStarterIds] = useState<Array<'bank' | 'cash' | 'momo'>>([]);
  const [activeWalletTarget, setActiveWalletTarget] = useState<'bank' | 'cash' | 'momo' | null>(
    null,
  );
  const [extraWallets, setExtraWallets] = useState<ExtraWalletDraft[]>([]);
  const [showAddWalletForm, setShowAddWalletForm] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletType, setNewWalletType] = useState<AccountType>('credit_card');
  const [newWalletBalanceText, setNewWalletBalanceText] = useState('0');
  const [newWalletCreditLimitText, setNewWalletCreditLimitText] = useState('20.000.000');

  // 2. Monthly Income / Salary state
  const [monthlyIncomeText, setMonthlyIncomeText] = useState('15.000.000');
  const [paydayDay, setPaydayDay] = useState<number>(5);
  const [salaryTargetKey, setSalaryTargetKey] = useState<'bank' | 'cash' | 'momo'>('bank');
  const [salaryCycleMode, setSalaryCycleMode] = useState<
    'included_in_balance' | 'pending_this_month'
  >('included_in_balance');

  // 3. Per-Category Spending Caps & Subcategory Customization state
  const [activeCapCatIds, setActiveCapCatIds] = useState<string[]>(DEFAULT_CORE_CATEGORY_IDS);
  const [categoryCapTexts, setCategoryCapTexts] = useState<Record<string, string>>(() =>
    distributeTotalIntoCategoryCaps(6_000_000, DEFAULT_CORE_CATEGORY_IDS),
  );
  const [monthlyBudgetText, setMonthlyBudgetText] = useState('6.000.000');
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);
  const [addingSubcatParentId, setAddingSubcatParentId] = useState<string | null>(null);
  const [newSubcatName, setNewSubcatName] = useState('');
  const [showAddParentCatForm, setShowAddParentCatForm] = useState(false);
  const [newParentCatName, setNewParentCatName] = useState('');
  const [newParentCatCapText, setNewParentCatCapText] = useState('1.000.000');

  // Sync default untouched wallet labels when user switches VI <-> EN
  useEffect(() => {
    setMainBankName((prev) => {
      if (prev === 'Tài khoản Ngân hàng' && !isVi) return 'Bank Account';
      if (prev === 'Bank Account' && isVi) return 'Tài khoản Ngân hàng';
      return prev;
    });
    setEWalletName((prev) => {
      if (prev === 'Ví điện tử' && !isVi) return 'E-Wallet';
      if (prev === 'E-Wallet' && isVi) return 'Ví điện tử';
      return prev;
    });
  }, [isVi]);

  const [isSaving, setIsSaving] = useState(false);

  const formatVndDigitsInput = (raw: string): string => {
    const cleaned = raw.trim();
    if (!cleaned) return '';
    if (/[a-zA-Z]/.test(cleaned)) return raw;
    const digits = cleaned.replace(/[^\d]/g, '');
    if (!digits) return '';
    return new Intl.NumberFormat('vi-VN').format(Number(digits));
  };

  useEffect(() => {
    if (isWelcomeOpen) {
      setStep(welcomeInitialStep);
      setDraftName(useUiStore.getState().userName);
      setSelectedAvatar(useUiStore.getState().avatarId);
    }
  }, [isWelcomeOpen, welcomeInitialStep]);

  if (!isWelcomeOpen) return null;

  const activePreset = getAvatarPresetMeta(selectedAvatar);
  const parsedBalanceMinor = removedStarterIds.includes('bank')
    ? 0
    : Math.max(0, parseFlexibleMoneyInput(openingBalanceText, 'VND'));
  const parsedCashMinor = removedStarterIds.includes('cash')
    ? 0
    : Math.max(0, parseFlexibleMoneyInput(cashBalanceText, 'VND'));
  const parsedEWalletMinor = removedStarterIds.includes('momo')
    ? 0
    : Math.max(0, parseFlexibleMoneyInput(eWalletBalanceText, 'VND'));
  const extraPositiveMinor = extraWallets.reduce((sum, w) => {
    if (w.type === 'credit_card') return sum;
    return sum + Math.max(0, parseFlexibleMoneyInput(w.balanceText, 'VND'));
  }, 0);
  const totalLiquidBalanceMinor =
    parsedBalanceMinor + parsedCashMinor + parsedEWalletMinor + extraPositiveMinor;

  const parsedIncomeMinor = Math.max(0, parseFlexibleMoneyInput(monthlyIncomeText, 'VND'));
  const parsedBudgetMinor = Math.max(0, parseFlexibleMoneyInput(monthlyBudgetText, 'VND'));
  const remainingDays = getRemainingDaysInCurrentMonth();
  const dailyBudgetSafePreviewMinor =
    parsedBudgetMinor > 0 ? Math.floor(parsedBudgetMinor / remainingDays) : 0;
  const dailyLiquidSafePreviewMinor =
    totalLiquidBalanceMinor > 0 ? Math.floor(totalLiquidBalanceMinor / remainingDays) : 0;
  const isPreviewLiquidConstrained =
    parsedBudgetMinor > 0 &&
    totalLiquidBalanceMinor > 0 &&
    totalLiquidBalanceMinor < parsedBudgetMinor;
  const dailySafePreviewMinor =
    parsedBudgetMinor > 0
      ? isPreviewLiquidConstrained
        ? Math.min(dailyBudgetSafePreviewMinor, dailyLiquidSafePreviewMinor)
        : dailyBudgetSafePreviewMinor
      : dailyLiquidSafePreviewMinor;

  const effectiveSalaryTargetKey: 'bank' | 'cash' | 'momo' = !removedStarterIds.includes(
    salaryTargetKey,
  )
    ? salaryTargetKey
    : !removedStarterIds.includes('bank')
      ? 'bank'
      : !removedStarterIds.includes('cash')
        ? 'cash'
        : 'momo';

  const salaryTargetWalletDisplayName =
    effectiveSalaryTargetKey === 'bank'
      ? mainBankName || (isVi ? 'Tài khoản Ngân hàng' : 'Bank Account')
      : effectiveSalaryTargetKey === 'cash'
        ? isVi
          ? 'Ví tiền mặt'
          : 'Cash Wallet'
        : eWalletName || (isVi ? 'Ví điện tử' : 'E-Wallet');

  const displayName = draftName.trim() || (isVi ? 'bạn' : 'friend');

  const handleSelectAvatarCard = (presetId: AvatarPresetId): void => {
    setSelectedAvatar(presetId);
    setAvatarId(presetId);
  };

  const applyTotalToCategoryCaps = (targetTotalMinor: number, catIds = activeCapCatIds): void => {
    const formattedTotal =
      targetTotalMinor > 0 ? new Intl.NumberFormat('vi-VN').format(targetTotalMinor) : '0';
    setMonthlyBudgetText(formattedTotal);
    setCategoryCapTexts(distributeTotalIntoCategoryCaps(targetTotalMinor, catIds));
  };

  const handleSingleCategoryCapChange = (categoryId: string, rawVal: string): void => {
    const formatted = formatVndDigitsInput(rawVal);
    const nextMap = { ...categoryCapTexts, [categoryId]: formatted };
    setCategoryCapTexts(nextMap);
    const nextSum = activeCapCatIds.reduce(
      (sum, id) => sum + Math.max(0, parseFlexibleMoneyInput(nextMap[id] ?? '0', 'VND')),
      0,
    );
    setMonthlyBudgetText(nextSum > 0 ? new Intl.NumberFormat('vi-VN').format(nextSum) : '0');
  };

  const handleToggleCategoryInCapList = (categoryId: string): void => {
    if (activeCapCatIds.includes(categoryId)) {
      if (activeCapCatIds.length <= 1) return;
      const nextIds = activeCapCatIds.filter((id) => id !== categoryId);
      setActiveCapCatIds(nextIds);
      const nextSum = nextIds.reduce(
        (sum, id) => sum + Math.max(0, parseFlexibleMoneyInput(categoryCapTexts[id] ?? '0', 'VND')),
        0,
      );
      setMonthlyBudgetText(nextSum > 0 ? new Intl.NumberFormat('vi-VN').format(nextSum) : '0');
    } else {
      const nextIds = [...activeCapCatIds, categoryId];
      const defaultCap = '500.000';
      const nextMap = {
        ...categoryCapTexts,
        [categoryId]: categoryCapTexts[categoryId] || defaultCap,
      };
      setActiveCapCatIds(nextIds);
      setCategoryCapTexts(nextMap);
      const nextSum = nextIds.reduce(
        (sum, id) => sum + Math.max(0, parseFlexibleMoneyInput(nextMap[id] ?? '0', 'VND')),
        0,
      );
      setMonthlyBudgetText(nextSum > 0 ? new Intl.NumberFormat('vi-VN').format(nextSum) : '0');
    }
  };

  const handleAddExtraWallet = (): void => {
    const cleanName = newWalletName.trim();
    if (!cleanName) return;
    setExtraWallets((prev) => [
      ...prev,
      {
        id: `extra-wallet-${Date.now()}`,
        name: cleanName,
        type: newWalletType,
        balanceText: newWalletBalanceText || '0',
        creditLimitText: newWalletCreditLimitText || '20.000.000',
      },
    ]);
    setNewWalletName('');
    setNewWalletBalanceText('0');
    setShowAddWalletForm(false);
  };

  const handleRemoveExtraWallet = (id: string): void => {
    setExtraWallets((prev) => prev.filter((w) => w.id !== id));
  };

  const handleCreateSubcategoryInline = async (parentCat: Category): Promise<void> => {
    const clean = newSubcatName.trim();
    if (!clean) return;
    const nowIso = new Date().toISOString();
    const slug = clean
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
    const subcat: Category = {
      id: `cat-sub-welcome-${Date.now()}`,
      user_id: 'local-user',
      parent_id: parentCat.id,
      name: clean,
      slug,
      kind: parentCat.kind,
      icon_name: parentCat.icon_name,
      color_hex: parentCat.color_hex,
      keywords: [clean.toLowerCase()],
      is_essential: parentCat.is_essential,
      is_system: false,
      archived_at: null,
      sort_order: 99,
      created_at: nowIso,
      updated_at: nowIso,
    };
    await localDb.categories.put(subcat);
    setNewSubcatName('');
  };

  const handleDeleteSubcategoryInline = async (subcat: Category): Promise<void> => {
    const nowIso = new Date().toISOString();
    if (subcat.is_system) {
      await localDb.categories.put({
        ...subcat,
        archived_at: nowIso,
        updated_at: nowIso,
      });
    } else {
      await localDb.categories.delete(subcat.id);
    }
  };

  const handleCreateCustomParentCategory = async (): Promise<void> => {
    const clean = newParentCatName.trim();
    if (!clean) return;
    const nowIso = new Date().toISOString();
    const newId = `cat-parent-welcome-${Date.now()}`;
    const slug = clean
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
    const newCat: Category = {
      id: newId,
      user_id: 'local-user',
      parent_id: null,
      name: clean,
      slug,
      kind: 'expense',
      icon_name: 'circle',
      color_hex: '#BF9BDE',
      keywords: [clean.toLowerCase()],
      is_essential: false,
      is_system: false,
      archived_at: null,
      sort_order: 90,
      created_at: nowIso,
      updated_at: nowIso,
    };
    await localDb.categories.put(newCat);
    const capFormatted = formatVndDigitsInput(newParentCatCapText) || '500.000';
    const nextIds = [...activeCapCatIds, newId];
    const nextMap = { ...categoryCapTexts, [newId]: capFormatted };
    setActiveCapCatIds(nextIds);
    setCategoryCapTexts(nextMap);
    const nextSum = nextIds.reduce(
      (sum, id) => sum + Math.max(0, parseFlexibleMoneyInput(nextMap[id] ?? '0', 'VND')),
      0,
    );
    setMonthlyBudgetText(nextSum > 0 ? new Intl.NumberFormat('vi-VN').format(nextSum) : '0');
    setNewParentCatName('');
    setShowAddParentCatForm(false);
  };

  const handleSaveWalletStep = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const allocations = activeCapCatIds.map((categoryId) => ({
        categoryId,
        limitMinor: Math.max(
          0,
          parseFlexibleMoneyInput(categoryCapTexts[categoryId] ?? '0', 'VND'),
        ),
      }));
      // Fallback: if user typed directly into total budget input and all category caps were 0
      const sumAllocations = allocations.reduce((s, a) => s + a.limitMinor, 0);
      const finalAllocations =
        sumAllocations > 0
          ? allocations
          : parsedBudgetMinor > 0
            ? [
                {
                  categoryId: '10000000-0000-4000-8000-000000000001',
                  limitMinor: parsedBudgetMinor,
                },
              ]
            : [];

      await applyFirstRunWalletAndBudgetSetup({
        mainBankName,
        openingBalanceMinor: parsedBalanceMinor,
        cashBalanceMinor: parsedCashMinor,
        eWalletName,
        eWalletBalanceMinor: parsedEWalletMinor,
        removedStarterIds,
        extraWallets,
        monthlyIncomeMinor: parsedIncomeMinor,
        paydayDay,
        salaryTargetKey: effectiveSalaryTargetKey,
        salaryCycleMode,
        categoryAllocations: finalAllocations,
      });
      setStep('congrats');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishAndTryQuickAdd = (): void => {
    completeWelcomeOnboarding({
      userName: draftName,
      avatarId: selectedAvatar,
    });
    openQuickAdd({
      kind: 'expense',
      presetText: isVi ? 'Cafe 35k' : 'Coffee 35k',
    });
  };

  const handleFinishToHome = (): void => {
    completeWelcomeOnboarding({
      userName: draftName,
      avatarId: selectedAvatar,
    });
  };

  const handleRemoveStarterWallet = (key: 'bank' | 'cash' | 'momo'): void => {
    setRemovedStarterIds((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const handleRestoreStarterWallet = (key: 'bank' | 'cash' | 'momo'): void => {
    setRemovedStarterIds((prev) => prev.filter((item) => item !== key));
    setActiveWalletTarget(key);
  };

  const handleApplyQuickWalletChip = (amountMinor: number): void => {
    const formatted = amountMinor > 0 ? new Intl.NumberFormat('vi-VN').format(amountMinor) : '0';
    if (activeWalletTarget === 'bank') {
      setOpeningBalanceText(formatted);
    } else if (activeWalletTarget === 'cash') {
      setCashBalanceText(formatted);
    } else {
      setEWalletBalanceText(formatted);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isVi ? 'Chào mừng đến với VOI' : 'Welcome to VOI'}
      data-testid="welcome-onboarding-modal"
      style={
        step === 'congrats'
          ? {
              background: `linear-gradient(180deg, ${activePreset.cardBgHex} 0%, ${activePreset.characterFillHex}45 50%, ${activePreset.cardBgHex} 100%)`,
              backgroundColor: activePreset.cardBgHex,
            }
          : undefined
      }
      className={`fixed inset-0 z-50 flex h-dvh w-screen flex-col overflow-hidden ${
        step === 'congrats' ? '' : 'bg-[var(--bg-canvas)]'
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-lg flex-col overflow-hidden">
        {/* Top Brand, Progress & Language Bar (Visible across Cover, Avatar & Wallet steps) */}
        {step !== 'congrats' && (
          <div className="relative z-20 flex items-center justify-between px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              {step !== 'cover' && (
                <button
                  type="button"
                  onClick={() => setStep(step === 'wallet' ? 'avatar' : 'cover')}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-primary)] transition hover:border-[var(--border-strong)]"
                  aria-label={isVi ? 'Quay lại' : 'Back'}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}

              {/* Always-Visible VOI Brand Identity Pill */}
              <div
                data-testid="welcome-top-brand-badge"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] py-1 pr-3 pl-1.5 shadow-2xs"
              >
                <VoiLogo variant="cobalt" size={22} className="rounded-lg" />
                <span className="text-xs font-black tracking-tight text-[var(--ink-primary)]">
                  VOI
                </span>
              </div>
            </div>

            {/* Step Indicator Pills */}
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {(['cover', 'avatar', 'wallet'] as const).map((s) => (
                <span
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    step === s ? 'w-6 bg-[#141413]' : 'w-2 bg-[var(--border-strong)]'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLocale(isVi ? 'en' : 'vi')}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--ink-primary)] transition hover:border-[var(--border-strong)]"
              >
                <span>{isVi ? '🇻🇳 VI' : '🇬🇧 EN'}</span>
              </button>

              <button
                type="button"
                onClick={closeWelcomeModal}
                data-testid="welcome-skip-btn"
                className="rounded-full px-2 py-1 text-xs font-bold text-[var(--ink-secondary)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
              >
                {isVi ? 'Bỏ qua' : 'Skip'}
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 1: WELCOME COVER (Clean Editorial Header + 2 Benefit Cards + Full-Bleed Peeking VOI) */}
        {step === 'cover' && (
          <div className="flex flex-1 flex-col justify-between overflow-hidden pt-2 pb-0">
            <div className="px-6 pt-1">
              <div className="space-y-3.5">
                {/* Clean Single Trust & Speed Pill (Replaces cluttered duplicate card & blobs) */}
                <div
                  data-testid="welcome-voi-hero-lockup"
                  className="inline-flex items-center gap-2 rounded-full border border-[#191919]/10 bg-[var(--bg-card)] px-3 py-1.5 shadow-2xs"
                >
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#B7EDB8] px-2 py-0.5 text-[10px] font-black text-[#191919]">
                    <ShieldCheck className="h-3 w-3 text-[#1E7E3A]" />
                    <span>{isVi ? '100% Trên máy' : '100% On-device'}</span>
                  </span>
                  <span className="text-xs font-extrabold text-[var(--ink-primary)]">
                    {isVi ? 'Sổ Thu Chi 3 Giây' : '3s Money Buddy'}
                  </span>
                </div>

                <h2 className="text-[32px] leading-[1.08] font-black tracking-tight text-[#191919] sm:text-4xl">
                  {isVi ? (
                    <>
                      Tạm biệt nỗi sợ
                      <br />
                      <span className="text-[#FF7A1A]">nhìn số dư cuối tháng!</span>
                    </>
                  ) : (
                    <>
                      Say goodbye to
                      <br />
                      <span className="text-[#FF7A1A]">month-end money stress!</span>
                    </>
                  )}
                </h2>

                <p className="text-xs leading-relaxed font-semibold text-[var(--ink-secondary)] sm:text-sm">
                  {t.greeting.subtitle}
                </p>

                {/* 2 Prominent Benefit Cards (Larger & punchier with VOI Scalloped Icons on Crisp White Badges) */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center gap-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] p-3.5 shadow-xs">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#191919]/10 bg-[#FFFFFF] shadow-2xs">
                      <VoiFlowIcon variant="expense" size={38} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[var(--ink-primary)]">
                        {isVi ? 'Ghi chi tiêu trong 3 giây' : 'Log expenses in 3 seconds'}
                      </p>
                      <p className="text-xs font-medium text-[var(--ink-secondary)]">
                        {isVi
                          ? 'Chạm gợi ý (☕ Cafe 35k) hoặc bấm bàn phím số'
                          : 'Tap 1-click chips or use the smart calculator'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] p-3.5 shadow-xs">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#191919]/10 bg-[#FFFFFF] shadow-2xs">
                      <VoiFlowIcon variant="income" size={38} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[var(--ink-primary)]">
                        {isVi
                          ? 'Biết ngay hôm nay được tiêu bao nhiêu'
                          : 'Know your Daily Safe-to-Spend'}
                      </p>
                      <p className="text-xs font-medium text-[var(--ink-secondary)]">
                        {isVi
                          ? 'VOI tự chia ngân sách theo số ngày còn lại trong tháng'
                          : 'Auto-calculates your safe daily allowance'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Primary CTA Button Directly Below Benefits */}
                <div className="pt-2">
                  <button
                    type="button"
                    data-testid="welcome-start-btn"
                    onClick={() => setStep('avatar')}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#191919] px-5 py-4 text-base font-black text-[#FAFAFA] shadow-lg transition hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span>{isVi ? 'Bắt đầu thiết lập (15 giây)' : 'Start 15-Second Setup'}</span>
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Giant Full-Bleed Peeking VOI Stage (01-voi-lo-dau.svg) Anchored 100% Flush to Bottom Edge */}
            <div className="relative mt-auto flex w-full flex-1 flex-col justify-end overflow-hidden leading-none">
              <div className="relative z-10 -mb-2 flex w-[116%] max-w-none shrink-0 items-end justify-center self-center leading-none">
                <GeometricBuddy
                  shape="diamond"
                  pose="peeking"
                  mood="happy"
                  size={560}
                  className="block h-auto w-full align-bottom"
                  label={isVi ? 'Voi ló đầu chào bạn' : 'Peeking VOI'}
                />
              </div>
              {/* Solid brand-blue bottom bleed guard so zero cream gap ever shows at the bottom edge */}
              <div className="h-3 w-full shrink-0 bg-[#2E8FCB]" aria-hidden="true" />
            </div>
          </div>
        )}

        {/* SCREEN 2: SELECT AN AVATAR & NAME (Prominent Name Input Card + Tall Portrait Avatar Grid Filling Viewport) */}
        {step === 'avatar' && (
          <div className="flex flex-1 flex-col justify-between overflow-y-auto px-5 pt-2 pb-5">
            <div className="flex flex-1 flex-col space-y-3.5">
              <div className="text-center">
                <h2 className="text-2xl font-black tracking-tight text-[var(--ink-primary)]">
                  {isVi ? 'Chọn nhân vật đồng hành' : 'Select an avatar'}
                </h2>
                <p className="mt-1 text-xs font-semibold text-[var(--ink-secondary)]">
                  {isVi
                    ? 'Nhân vật này sẽ đồng hành trên Trang chủ của bạn (có thể đổi lại sau)'
                    : 'This will be your default avatar but you can change this later'}
                </p>
              </div>

              {/* Prominent Name Input Card with Live Selected Buddy Greeting (Larger & easier to tap!) */}
              <div className="rounded-3xl border-2 border-[#191919]/15 bg-[var(--bg-card)] p-4 shadow-xs">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#191919]/15"
                      style={{ backgroundColor: activePreset.cardBgHex }}
                    >
                      <GeometricBuddy
                        shape={activePreset.shape}
                        colorHex={activePreset.characterFillHex}
                        accessory={activePreset.accessory}
                        blush
                        mood="happy"
                        size={36}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="welcome-user-name-input"
                        className="block text-xs font-black tracking-wide text-[var(--ink-primary)] uppercase"
                      >
                        {isVi ? 'VOI nên gọi bạn là gì?' : "What's your name or nickname?"}
                      </label>
                      <p className="text-[11px] font-semibold text-[var(--ink-secondary)]">
                        {isVi
                          ? `${activePreset.nameVi} · ${activePreset.tagVi}`
                          : `${activePreset.nameEn} · ${activePreset.tagEn}`}
                      </p>
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-[#191919]"
                    style={{ backgroundColor: activePreset.cardBgHex }}
                  >
                    {isVi ? activePreset.tagVi : activePreset.tagEn}
                  </span>
                </div>

                <input
                  id="welcome-user-name-input"
                  data-testid="welcome-name-input"
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder={
                    isVi
                      ? 'Nhập tên của bạn (VD: Minh, Linh, Edric...)'
                      : 'Enter your name (e.g. Alex, Minh...)'
                  }
                  className="w-full rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--bg-subtle)] px-4 py-3.5 text-base font-black text-[var(--ink-primary)] placeholder:text-sm placeholder:font-semibold placeholder:text-[var(--ink-muted)] focus:border-[#191919] focus:bg-[var(--bg-card)] focus:outline-none"
                />
              </div>

              {/* 2x3 Tall Portrait Avatar Cards Grid (Fills vertical space like Image 1 "Select an avatar") */}
              <div className="grid flex-1 grid-cols-3 gap-3">
                {AVATAR_PRESETS.map((preset) => {
                  const isSelected = preset.id === selectedAvatar;
                  const titleText = isVi ? preset.nameVi : preset.nameEn;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-testid={`avatar-card-${preset.id}`}
                      aria-label={titleText}
                      onClick={() => handleSelectAvatarCard(preset.id)}
                      style={{ backgroundColor: preset.cardBgHex }}
                      className={`group relative flex min-h-[148px] flex-col justify-between overflow-hidden rounded-[28px] p-3 text-left transition-all ${
                        isSelected
                          ? 'scale-[1.02] shadow-md ring-3 ring-[#191919]'
                          : 'opacity-92 hover:scale-[1.01] hover:opacity-100'
                      }`}
                    >
                      <div className="relative z-10 space-y-1">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition ${
                            isSelected
                              ? 'bg-[#191919] text-[#FAFAFA]'
                              : 'bg-[#FAFAFA]/85 text-[#191919]'
                          }`}
                        >
                          {isSelected ? (
                            <Check className="h-4 w-4 stroke-[3]" />
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                        </span>
                        <p className="pt-0.5 text-[11px] leading-tight font-black text-[#191919]">
                          {titleText}
                        </p>
                      </div>

                      {/* Large Peeking VOI in Bottom-Right Corner */}
                      <div className="pointer-events-none absolute -right-1.5 -bottom-2 transition-transform group-hover:scale-105">
                        <GeometricBuddy
                          shape={preset.shape}
                          colorHex={preset.characterFillHex}
                          accessory={preset.accessory}
                          blush={isSelected}
                          mood={isSelected ? 'excited' : 'happy'}
                          size={96}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 pt-3.5">
              <button
                type="button"
                data-testid="welcome-avatar-continue-btn"
                onClick={() => setStep('wallet')}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#191919] px-5 py-4 text-base font-black text-[#FAFAFA] shadow-md transition hover:scale-[1.01]"
              >
                <span>{isVi ? 'Tiếp tục thiết lập ví →' : 'Continue to Wallet Setup →'}</span>
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 3: ONE-ACTIVE-CARD STEP ACCORDION + COMPANION HERO STAGE */}
        {step === 'wallet' && (
          <div className="flex flex-1 flex-col justify-between overflow-hidden">
            {/* Scrollable Setup Accordion Cards */}
            <div className="flex-1 space-y-2.5 overflow-y-auto px-5 pt-1 pb-3">
              {/* Clean Editorial Title */}
              <div className="px-0.5 pb-0.5">
                <h2 className="text-xl leading-tight font-black tracking-tight text-[var(--ink-primary)] sm:text-2xl">
                  {isVi
                    ? `Chào ${displayName}! Thiết lập ngân sách nhé`
                    : `Hi ${displayName}! Quick budget setup`}
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-[var(--ink-secondary)]">
                  {isVi
                    ? 'Chạm vào mục bất kỳ để chỉnh — ước chừng thôi cũng được!'
                    : 'Tap any card below to adjust — rough estimates are fine!'}
                </p>
              </div>

              {/* =====================================================================
                  CARD 1: WALLETS & BALANCES (Accordion Card 1)
                 ===================================================================== */}
              <div
                onClick={() => {
                  if (activeSetupSection !== 'wallets') setActiveSetupSection('wallets');
                }}
                className={`rounded-2xl border bg-[var(--bg-card)] transition-all ${
                  activeSetupSection === 'wallets'
                    ? 'border-[#191919] p-3.5 shadow-xs'
                    : 'cursor-pointer border-[var(--border-hairline)] px-3.5 py-3 hover:border-[var(--border-strong)]'
                }`}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSetupSection(activeSetupSection === 'wallets' ? 'income' : 'wallets');
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{
                        backgroundColor:
                          activeSetupSection === 'wallets' ? '#191919' : activePreset.cardBgHex,
                        color: activeSetupSection === 'wallets' ? '#FAFAFA' : '#191919',
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
                    >
                      1
                    </span>
                    <div>
                      <p className="text-xs font-black text-[var(--ink-primary)] sm:text-sm">
                        {isVi ? 'Ví & Số dư hiện có' : 'Wallets & Balances'}
                      </p>
                      {activeSetupSection !== 'wallets' && (
                        <p className="text-[11px] font-semibold text-[var(--ink-secondary)]">
                          {isVi
                            ? `${3 - removedStarterIds.length + extraWallets.length} ví đang bật · Chạm để sửa`
                            : `${3 - removedStarterIds.length + extraWallets.length} active wallets · Tap to edit`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      data-testid="welcome-total-wallet-badge"
                      style={{ backgroundColor: activePreset.cardBgHex }}
                      className="rounded-xl border border-[#191919]/15 px-2.5 py-1 text-xs font-black text-[#191919] tabular-nums"
                    >
                      {formatMoney(totalLiquidBalanceMinor, 'VND')}
                    </span>
                    {activeSetupSection === 'wallets' ? (
                      <ChevronUp className="h-4 w-4 text-[var(--ink-secondary)]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[var(--ink-secondary)]" />
                    )}
                  </div>
                </div>

                {activeSetupSection === 'wallets' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 space-y-2 border-t border-[var(--border-hairline)] pt-2.5"
                  >
                    <div className="divide-y divide-[var(--border-hairline)] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/65">
                      {/* Row A: Bank Account */}
                      {!removedStarterIds.includes('bank') && (
                        <div
                          onClick={() =>
                            setActiveWalletTarget(activeWalletTarget === 'bank' ? null : 'bank')
                          }
                          className="px-3 py-2 transition hover:bg-[var(--bg-subtle)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#BCDBEB] text-[#191919]">
                                <Landmark className="h-3.5 w-3.5" />
                              </span>
                              <input
                                type="text"
                                data-testid="welcome-main-bank-name-input"
                                value={mainBankName}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setMainBankName(e.target.value)}
                                onFocus={() => setActiveWalletTarget('bank')}
                                aria-label={isVi ? 'Tên tài khoản ngân hàng' : 'Bank account name'}
                                className="min-w-0 flex-1 bg-transparent text-xs font-extrabold text-[var(--ink-primary)] focus:underline focus:outline-none"
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="flex w-28 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1"
                              >
                                <input
                                  id="welcome-opening-balance-input"
                                  data-testid="welcome-balance-input"
                                  type="text"
                                  inputMode="decimal"
                                  value={openingBalanceText}
                                  onFocus={() => setActiveWalletTarget('bank')}
                                  onChange={(e) =>
                                    setOpeningBalanceText(formatVndDigitsInput(e.target.value))
                                  }
                                  placeholder="5.000.000"
                                  className="min-w-0 flex-1 bg-transparent text-right text-xs font-black text-[var(--ink-primary)] tabular-nums focus:outline-none"
                                />
                                <span className="text-[10px] font-bold text-[var(--ink-secondary)]">
                                  đ
                                </span>
                              </div>
                              <button
                                type="button"
                                data-testid="welcome-remove-wallet-bank"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveStarterWallet('bank');
                                }}
                                title={isVi ? 'Xoá ví này' : 'Remove wallet'}
                                aria-label={
                                  isVi ? 'Xoá tài khoản ngân hàng' : 'Remove bank account'
                                }
                                className="rounded-lg p-1 text-[var(--ink-secondary)]/60 hover:bg-[var(--bg-card)] hover:text-[#D93829]"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {activeWalletTarget === 'bank' && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2 flex flex-wrap items-center gap-1 pt-1"
                            >
                              {[
                                { labelVi: '0đ', labelEn: '0₫', amountMinor: 0 },
                                ...BALANCE_QUICK_CHIPS,
                              ].map((chip) => (
                                <button
                                  key={chip.amountMinor}
                                  type="button"
                                  onClick={() => handleApplyQuickWalletChip(chip.amountMinor)}
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold transition ${
                                    parsedBalanceMinor === chip.amountMinor
                                      ? 'bg-[#191919] text-[#FAFAFA]'
                                      : 'border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-primary)] hover:border-[#191919]'
                                  }`}
                                >
                                  {isVi ? chip.labelVi : chip.labelEn}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Row B: Cash Wallet */}
                      {!removedStarterIds.includes('cash') && (
                        <div
                          onClick={() =>
                            setActiveWalletTarget(activeWalletTarget === 'cash' ? null : 'cash')
                          }
                          className="px-3 py-2 transition hover:bg-[var(--bg-subtle)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#B7EDB8] text-[#191919]">
                                <Banknote className="h-3.5 w-3.5" />
                              </span>
                              <span className="truncate text-xs font-extrabold text-[var(--ink-primary)]">
                                {isVi ? 'Ví tiền mặt' : 'Cash Wallet'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="flex w-28 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1"
                              >
                                <input
                                  data-testid="welcome-cash-balance-input"
                                  type="text"
                                  inputMode="decimal"
                                  value={cashBalanceText}
                                  onFocus={() => setActiveWalletTarget('cash')}
                                  onChange={(e) =>
                                    setCashBalanceText(formatVndDigitsInput(e.target.value))
                                  }
                                  placeholder="0"
                                  aria-label={isVi ? 'Số dư Ví tiền mặt' : 'Cash balance'}
                                  className="min-w-0 flex-1 bg-transparent text-right text-xs font-black text-[var(--ink-primary)] tabular-nums focus:outline-none"
                                />
                                <span className="text-[10px] font-bold text-[var(--ink-secondary)]">
                                  đ
                                </span>
                              </div>
                              <button
                                type="button"
                                data-testid="welcome-remove-wallet-cash"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveStarterWallet('cash');
                                }}
                                title={isVi ? 'Xoá ví này' : 'Remove wallet'}
                                aria-label={isVi ? 'Xoá Ví tiền mặt' : 'Remove Cash Wallet'}
                                className="rounded-lg p-1 text-[var(--ink-secondary)]/60 hover:bg-[var(--bg-card)] hover:text-[#D93829]"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {activeWalletTarget === 'cash' && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2 flex flex-wrap items-center gap-1 pt-1"
                            >
                              {[
                                { labelVi: '0đ', labelEn: '0₫', amountMinor: 0 },
                                ...BALANCE_QUICK_CHIPS,
                              ].map((chip) => (
                                <button
                                  key={chip.amountMinor}
                                  type="button"
                                  onClick={() => handleApplyQuickWalletChip(chip.amountMinor)}
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold transition ${
                                    parsedCashMinor === chip.amountMinor
                                      ? 'bg-[#191919] text-[#FAFAFA]'
                                      : 'border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-primary)] hover:border-[#191919]'
                                  }`}
                                >
                                  {isVi ? chip.labelVi : chip.labelEn}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Row C: E-Wallet */}
                      {!removedStarterIds.includes('momo') && (
                        <div
                          onClick={() =>
                            setActiveWalletTarget(activeWalletTarget === 'momo' ? null : 'momo')
                          }
                          className="px-3 py-2 transition hover:bg-[var(--bg-subtle)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F5C2D7] text-[#191919]">
                                <Smartphone className="h-3.5 w-3.5" />
                              </span>
                              <input
                                type="text"
                                value={eWalletName}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={() => setActiveWalletTarget('momo')}
                                onChange={(e) => setEWalletName(e.target.value)}
                                aria-label={isVi ? 'Tên ví điện tử' : 'E-Wallet name'}
                                className="min-w-0 flex-1 bg-transparent text-xs font-extrabold text-[var(--ink-primary)] focus:underline focus:outline-none"
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="flex w-28 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1"
                              >
                                <input
                                  data-testid="welcome-ewallet-balance-input"
                                  type="text"
                                  inputMode="decimal"
                                  value={eWalletBalanceText}
                                  onFocus={() => setActiveWalletTarget('momo')}
                                  onChange={(e) =>
                                    setEWalletBalanceText(formatVndDigitsInput(e.target.value))
                                  }
                                  placeholder="0"
                                  aria-label={isVi ? 'Số dư Ví điện tử' : 'E-Wallet balance'}
                                  className="min-w-0 flex-1 bg-transparent text-right text-xs font-black text-[var(--ink-primary)] tabular-nums focus:outline-none"
                                />
                                <span className="text-[10px] font-bold text-[var(--ink-secondary)]">
                                  đ
                                </span>
                              </div>
                              <button
                                type="button"
                                data-testid="welcome-remove-wallet-momo"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveStarterWallet('momo');
                                }}
                                title={isVi ? 'Xoá ví này' : 'Remove wallet'}
                                aria-label={isVi ? 'Xoá Ví điện tử' : 'Remove E-Wallet'}
                                className="rounded-lg p-1 text-[var(--ink-secondary)]/60 hover:bg-[var(--bg-card)] hover:text-[#D93829]"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {activeWalletTarget === 'momo' && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-2 flex flex-wrap items-center gap-1 pt-1"
                            >
                              {[
                                { labelVi: '0đ', labelEn: '0₫', amountMinor: 0 },
                                ...BALANCE_QUICK_CHIPS,
                              ].map((chip) => (
                                <button
                                  key={chip.amountMinor}
                                  type="button"
                                  onClick={() => handleApplyQuickWalletChip(chip.amountMinor)}
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold transition ${
                                    parsedEWalletMinor === chip.amountMinor
                                      ? 'bg-[#191919] text-[#FAFAFA]'
                                      : 'border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-primary)] hover:border-[#191919]'
                                  }`}
                                >
                                  {isVi ? chip.labelVi : chip.labelEn}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Extra Added Wallets / Credit Cards List */}
                      {extraWallets.map((w) => {
                        const amt = parseFlexibleMoneyInput(w.balanceText, 'VND');
                        const isCredit = w.type === 'credit_card';
                        return (
                          <div
                            key={w.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#D7C3F8] text-[#191919]">
                                {isCredit ? (
                                  <CreditCard className="h-3.5 w-3.5" />
                                ) : w.type === 'savings' ? (
                                  <PiggyBank className="h-3.5 w-3.5" />
                                ) : (
                                  <Wallet className="h-3.5 w-3.5" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-extrabold text-[var(--ink-primary)]">
                                  {w.name}
                                </p>
                                <p className="text-[10px] text-[var(--ink-secondary)]">
                                  {isCredit
                                    ? isVi
                                      ? `Thẻ tín dụng · Hạn mức ${formatMoney(parseFlexibleMoneyInput(w.creditLimitText, 'VND'), 'VND')}`
                                      : `Credit Card · Limit ${formatMoney(parseFlexibleMoneyInput(w.creditLimitText, 'VND'), 'VND')}`
                                    : isVi
                                      ? 'Ví / Tài khoản phụ'
                                      : 'Secondary Account'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-[var(--ink-primary)] tabular-nums">
                                {isCredit && amt > 0
                                  ? `-${formatMoney(amt, 'VND')}`
                                  : formatMoney(amt, 'VND')}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveExtraWallet(w.id)}
                                aria-label={isVi ? `Xoá ${w.name}` : `Remove ${w.name}`}
                                className="rounded-lg p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-card)] hover:text-[#D93829]"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Compact Footer Row: Restore Removed Wallets + Add Secondary Wallet/Card Link */}
                    {!showAddWalletForm ? (
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {removedStarterIds.map((key) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleRestoreStarterWallet(key)}
                              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                            >
                              <Plus className="h-2.5 w-2.5" />
                              <span>
                                {key === 'bank'
                                  ? isVi
                                    ? 'Ngân hàng'
                                    : 'Bank'
                                  : key === 'cash'
                                    ? isVi
                                      ? 'Tiền mặt'
                                      : 'Cash'
                                    : isVi
                                      ? 'Ví điện tử'
                                      : 'E-Wallet'}
                              </span>
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          data-testid="welcome-add-wallet-toggle"
                          onClick={() => setShowAddWalletForm(true)}
                          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[var(--ink-secondary)] underline-offset-2 transition hover:text-[var(--ink-primary)] hover:underline"
                        >
                          <Plus className="h-3 w-3" />
                          <span>
                            {isVi
                              ? 'Thêm Thẻ tín dụng / Ví khác'
                              : 'Add Credit Card / Extra Wallet'}
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-xl border border-[#191919] bg-[var(--bg-subtle)] p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-[var(--ink-primary)]">
                            {isVi
                              ? 'Thêm Ví / Thẻ / Hình thức thanh toán'
                              : 'Add Wallet / Card / Payment Method'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowAddWalletForm(false)}
                            className="rounded-full p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-card)]"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                          {(
                            [
                              {
                                id: 'credit_card',
                                labelVi: '💳 Thẻ tín dụng',
                                labelEn: '💳 Credit Card',
                              },
                              { id: 'bank', labelVi: '🏦 Ngân hàng', labelEn: '🏦 Bank' },
                              { id: 'e_wallet', labelVi: '📱 Ví điện tử', labelEn: '📱 E-Wallet' },
                              { id: 'savings', labelVi: '🐷 Tiết kiệm', labelEn: '🐷 Savings' },
                            ] as const
                          ).map((tItem) => (
                            <button
                              key={tItem.id}
                              type="button"
                              onClick={() => setNewWalletType(tItem.id)}
                              className={`rounded-lg px-2 py-1.5 text-[10px] font-extrabold transition ${
                                newWalletType === tItem.id
                                  ? 'bg-[#191919] text-[#FAFAFA]'
                                  : 'border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-primary)]'
                              }`}
                            >
                              {isVi ? tItem.labelVi : tItem.labelEn}
                            </button>
                          ))}
                        </div>

                        <input
                          type="text"
                          data-testid="welcome-extra-wallet-name-input"
                          value={newWalletName}
                          onChange={(e) => setNewWalletName(e.target.value)}
                          placeholder={
                            newWalletType === 'credit_card'
                              ? isVi
                                ? 'VD: Thẻ tín dụng VIB / VPBank / HSBC...'
                                : 'e.g. Visa Platinum Card...'
                              : isVi
                                ? 'VD: Techcombank / ZaloPay / ShopeePay...'
                                : 'e.g. Secondary Bank / Apple Pay...'
                          }
                          className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-bold text-[var(--ink-primary)] focus:outline-none"
                        />

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1.5">
                            <span className="text-[10px] font-bold text-[var(--ink-secondary)]">
                              {newWalletType === 'credit_card'
                                ? isVi
                                  ? 'Dư nợ đã tiêu:'
                                  : 'Used debt:'
                                : isVi
                                  ? 'Số dư:'
                                  : 'Balance:'}
                            </span>
                            <input
                              type="text"
                              data-testid="welcome-extra-wallet-balance-input"
                              inputMode="decimal"
                              value={newWalletBalanceText}
                              onChange={(e) =>
                                setNewWalletBalanceText(formatVndDigitsInput(e.target.value))
                              }
                              placeholder="0"
                              className="min-w-0 flex-1 bg-transparent text-right text-xs font-black text-[var(--ink-primary)] tabular-nums focus:outline-none"
                            />
                            <span className="text-[10px] font-bold text-[var(--ink-secondary)]">
                              đ
                            </span>
                          </div>

                          {newWalletType === 'credit_card' && (
                            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1.5">
                              <span className="text-[10px] font-bold text-[var(--ink-secondary)]">
                                {isVi ? 'Hạn mức thẻ:' : 'Card limit:'}
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={newWalletCreditLimitText}
                                onChange={(e) =>
                                  setNewWalletCreditLimitText(formatVndDigitsInput(e.target.value))
                                }
                                placeholder="20.000.000"
                                className="min-w-0 flex-1 bg-transparent text-right text-xs font-black text-[var(--ink-primary)] tabular-nums focus:outline-none"
                              />
                              <span className="text-[10px] font-bold text-[var(--ink-secondary)]">
                                đ
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          data-testid="welcome-extra-wallet-save-btn"
                          onClick={handleAddExtraWallet}
                          className="w-full rounded-lg bg-[#191919] py-1.5 text-xs font-black text-[#FAFAFA]"
                        >
                          {isVi ? '+ Lưu Ví / Thẻ này' : '+ Save Wallet / Card'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* =====================================================================
                  CARD 2: MONTHLY INCOME / SALARY (Accordion Card 2)
                 ===================================================================== */}
              <div
                onClick={() => {
                  if (activeSetupSection !== 'income') setActiveSetupSection('income');
                }}
                className={`rounded-2xl border bg-[var(--bg-card)] transition-all ${
                  activeSetupSection === 'income'
                    ? 'border-[#191919] p-3.5 shadow-xs'
                    : 'cursor-pointer border-[var(--border-hairline)] px-3.5 py-3 hover:border-[var(--border-strong)]'
                }`}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSetupSection(activeSetupSection === 'income' ? 'budget' : 'income');
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{
                        backgroundColor:
                          activeSetupSection === 'income' ? '#191919' : activePreset.cardBgHex,
                        color: activeSetupSection === 'income' ? '#FAFAFA' : '#191919',
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
                    >
                      2
                    </span>
                    <div>
                      <label
                        htmlFor="welcome-monthly-income-input"
                        className="cursor-pointer text-xs font-black text-[var(--ink-primary)] sm:text-sm"
                      >
                        {isVi ? 'Lương & Thu nhập cố định' : 'Monthly Salary & Income'}
                      </label>
                      {activeSetupSection !== 'income' && (
                        <p className="text-[11px] font-semibold text-[var(--ink-secondary)]">
                          {parsedIncomeMinor > 0
                            ? isVi
                              ? `Vào ${salaryTargetWalletDisplayName} · Ngày ${paydayDay}`
                              : `Into ${salaryTargetWalletDisplayName} · Day ${paydayDay}`
                            : isVi
                              ? 'Thu nhập linh hoạt · Chạm để sửa'
                              : 'Variable income · Tap to edit'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
                    <div
                      style={{ backgroundColor: activePreset.cardBgHex }}
                      className="flex w-32 items-center gap-1 rounded-xl border border-[#191919]/15 px-2.5 py-1"
                    >
                      <input
                        id="welcome-monthly-income-input"
                        data-testid="welcome-income-input"
                        type="text"
                        inputMode="decimal"
                        value={monthlyIncomeText}
                        onFocus={() => setActiveSetupSection('income')}
                        onChange={(e) => setMonthlyIncomeText(formatVndDigitsInput(e.target.value))}
                        placeholder="15.000.000"
                        className="min-w-0 flex-1 bg-transparent text-right text-xs font-black text-[#191919] tabular-nums focus:outline-none"
                      />
                      <span className="text-[10px] font-black text-[#191919]">đ</span>
                    </div>
                    {activeSetupSection === 'income' ? (
                      <ChevronUp
                        onClick={() => setActiveSetupSection('budget')}
                        className="h-4 w-4 cursor-pointer text-[var(--ink-secondary)]"
                      />
                    ) : (
                      <ChevronDown
                        onClick={() => setActiveSetupSection('income')}
                        className="h-4 w-4 cursor-pointer text-[var(--ink-secondary)]"
                      />
                    )}
                  </div>
                </div>

                {activeSetupSection === 'income' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 space-y-2.5 border-t border-[var(--border-hairline)] pt-2.5"
                  >
                    <p className="text-[11px] font-medium text-[var(--ink-secondary)]">
                      {isVi
                        ? '💡 Thiết lập lịch nhắc nhận lương hàng tháng & cân đối hạn mức chi tiêu.'
                        : '💡 Schedules your monthly payday reminder & balances spending caps.'}
                    </p>

                    {/* Row 1: Deposit Wallet + Payday Selector */}
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      <div className="flex items-center justify-between gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 py-1.5">
                        <span className="text-[11px] font-bold text-[var(--ink-secondary)]">
                          {isVi ? 'Nhận vào:' : 'Deposit to:'}
                        </span>
                        <select
                          data-testid="welcome-salary-wallet-select"
                          value={effectiveSalaryTargetKey}
                          onChange={(e) =>
                            setSalaryTargetKey(e.target.value as 'bank' | 'cash' | 'momo')
                          }
                          aria-label={isVi ? 'Ví nhận lương' : 'Salary destination wallet'}
                          className="max-w-[140px] truncate bg-transparent text-right text-xs font-black text-[var(--ink-primary)] focus:outline-none"
                        >
                          {!removedStarterIds.includes('bank') && (
                            <option value="bank">
                              🏦 {mainBankName || (isVi ? 'Ngân hàng' : 'Bank Account')}
                            </option>
                          )}
                          {!removedStarterIds.includes('cash') && (
                            <option value="cash">💵 {isVi ? 'Ví tiền mặt' : 'Cash Wallet'}</option>
                          )}
                          {!removedStarterIds.includes('momo') && (
                            <option value="momo">
                              📱 {eWalletName || (isVi ? 'Ví điện tử' : 'E-Wallet')}
                            </option>
                          )}
                        </select>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 py-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--ink-secondary)]">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{isVi ? 'Ngày lương:' : 'Payday:'}</span>
                        </span>
                        <select
                          data-testid="welcome-payday-select"
                          value={paydayDay}
                          onChange={(e) => setPaydayDay(Number(e.target.value))}
                          aria-label={isVi ? 'Ngày nhận lương' : 'Payday of month'}
                          className="bg-transparent text-right text-xs font-black text-[var(--ink-primary)] focus:outline-none"
                        >
                          {[1, 5, 10, 15, 20, 25, 28, 30].map((d) => (
                            <option key={d} value={d}>
                              {isVi ? `Ngày ${d} hàng tháng` : `Day ${d} of month`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Quick Income Presets */}
                    <div className="flex flex-wrap gap-1.5">
                      {INCOME_QUICK_CHIPS.map((chip) => {
                        const active = parsedIncomeMinor === chip.amountMinor;
                        return (
                          <button
                            key={chip.amountMinor}
                            type="button"
                            onClick={() =>
                              setMonthlyIncomeText(
                                chip.amountMinor > 0
                                  ? new Intl.NumberFormat('vi-VN').format(chip.amountMinor)
                                  : '0',
                              )
                            }
                            style={active ? { backgroundColor: activePreset.cardBgHex } : undefined}
                            className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
                              active
                                ? 'border border-[#191919] text-[#191919]'
                                : 'border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--ink-primary)] hover:border-[var(--border-strong)]'
                            }`}
                          >
                            {isVi ? chip.labelVi : chip.labelEn}
                          </button>
                        );
                      })}
                    </div>

                    {/* Row 3: Anti-Double-Count Guardrail for Current Month's Cycle */}
                    {parsedIncomeMinor > 0 && (
                      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-2">
                        <p className="mb-1.5 text-[10px] font-extrabold text-[var(--ink-secondary)]">
                          {isVi
                            ? 'Kỳ lương tháng này (tránh cộng trùng số dư Mục 1):'
                            : "This month's salary cycle (prevents double-counting Step 1):"}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            data-testid="welcome-salary-cycle-included"
                            onClick={() => setSalaryCycleMode('included_in_balance')}
                            className={`rounded-lg px-2 py-1.5 text-[10px] font-extrabold transition ${
                              salaryCycleMode === 'included_in_balance'
                                ? 'bg-[#191919] text-[#FAFAFA]'
                                : 'border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-primary)]'
                            }`}
                          >
                            {isVi
                              ? '✓ Đã tính trong ví Mục 1 (Nhắc từ tháng sau)'
                              : '✓ Already in Step 1 balance (Remind next mo)'}
                          </button>
                          <button
                            type="button"
                            data-testid="welcome-salary-cycle-pending"
                            onClick={() => setSalaryCycleMode('pending_this_month')}
                            className={`rounded-lg px-2 py-1.5 text-[10px] font-extrabold transition ${
                              salaryCycleMode === 'pending_this_month'
                                ? 'bg-[#191919] text-[#FAFAFA]'
                                : 'border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-primary)]'
                            }`}
                          >
                            {isVi
                              ? '⏳ Chưa nhận (Nhắc bấm nhận tháng này)'
                              : '⏳ Not received yet (Remind this month)'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* =====================================================================
                  CARD 3: MONTHLY SPENDING CAP & CATEGORIES (Accordion Card 3)
                 ===================================================================== */}
              <div
                onClick={() => {
                  if (activeSetupSection !== 'budget') setActiveSetupSection('budget');
                }}
                className={`rounded-2xl border bg-[var(--bg-card)] transition-all ${
                  activeSetupSection === 'budget'
                    ? 'border-[#191919] p-3.5 shadow-xs'
                    : 'cursor-pointer border-[var(--border-hairline)] px-3.5 py-3 hover:border-[var(--border-strong)]'
                }`}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSetupSection(activeSetupSection === 'budget' ? 'wallets' : 'budget');
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{
                        backgroundColor:
                          activeSetupSection === 'budget' ? '#191919' : activePreset.cardBgHex,
                        color: activeSetupSection === 'budget' ? '#FAFAFA' : '#191919',
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
                    >
                      3
                    </span>
                    <div>
                      <label
                        htmlFor="welcome-monthly-budget-input"
                        className="cursor-pointer text-xs font-black text-[var(--ink-primary)] sm:text-sm"
                      >
                        {isVi ? 'Định mức chi tiêu tháng' : 'Monthly Spending Cap'}
                      </label>
                      {activeSetupSection !== 'budget' && (
                        <p className="text-[11px] font-semibold text-[var(--ink-secondary)]">
                          {isVi
                            ? `Tự chia cho ${activeCapCatIds.length} danh mục · Chạm để sửa`
                            : `Split across ${activeCapCatIds.length} categories · Tap to edit`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
                    <div
                      style={{ backgroundColor: activePreset.cardBgHex }}
                      className="flex w-32 items-center gap-1 rounded-xl border border-[#191919]/15 px-2.5 py-1"
                    >
                      <input
                        id="welcome-monthly-budget-input"
                        data-testid="welcome-budget-input"
                        type="text"
                        inputMode="decimal"
                        value={monthlyBudgetText}
                        onFocus={() => setActiveSetupSection('budget')}
                        onChange={(e) => {
                          const formatted = formatVndDigitsInput(e.target.value);
                          setMonthlyBudgetText(formatted);
                          const nextTotal = Math.max(0, parseFlexibleMoneyInput(formatted, 'VND'));
                          if (nextTotal > 0) {
                            setCategoryCapTexts(
                              distributeTotalIntoCategoryCaps(nextTotal, activeCapCatIds),
                            );
                          }
                        }}
                        placeholder="6.000.000"
                        className="min-w-0 flex-1 bg-transparent text-right text-xs font-black text-[#191919] tabular-nums focus:outline-none"
                      />
                      <span className="text-[10px] font-black text-[#191919]">đ</span>
                    </div>
                    {activeSetupSection === 'budget' ? (
                      <ChevronUp
                        onClick={() => setActiveSetupSection('wallets')}
                        className="h-4 w-4 cursor-pointer text-[var(--ink-secondary)]"
                      />
                    ) : (
                      <ChevronDown
                        onClick={() => setActiveSetupSection('budget')}
                        className="h-4 w-4 cursor-pointer text-[var(--ink-secondary)]"
                      />
                    )}
                  </div>
                </div>

                {activeSetupSection === 'budget' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 space-y-2.5 border-t border-[var(--border-hairline)] pt-2.5"
                  >
                    {/* Quick Total Presets + Auto-Distribute by 50% Income */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {BUDGET_QUICK_CHIPS.map((chip) => {
                        const active = parsedBudgetMinor === chip.amountMinor;
                        return (
                          <button
                            key={chip.amountMinor}
                            type="button"
                            onClick={() => applyTotalToCategoryCaps(chip.amountMinor)}
                            style={active ? { backgroundColor: activePreset.cardBgHex } : undefined}
                            className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
                              active
                                ? 'border border-[#191919] text-[#191919]'
                                : 'border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--ink-primary)] hover:border-[var(--border-strong)]'
                            }`}
                          >
                            {isVi ? chip.labelVi : chip.labelEn}
                          </button>
                        );
                      })}

                      {parsedIncomeMinor > 0 && (
                        <button
                          type="button"
                          data-testid="welcome-auto-distribute-income-btn"
                          onClick={() =>
                            applyTotalToCategoryCaps(Math.round(parsedIncomeMinor * 0.5))
                          }
                          style={{ backgroundColor: activePreset.cardBgHex }}
                          className="rounded-full border border-[#191919]/20 px-3 py-1 text-xs font-black text-[#191919] transition hover:opacity-90"
                        >
                          {isVi
                            ? `⚡ 50% Lương (${formatMoney(Math.round(parsedIncomeMinor * 0.5), 'VND')})`
                            : `⚡ 50% Income (${formatMoney(Math.round(parsedIncomeMinor * 0.5), 'VND')})`}
                        </button>
                      )}
                    </div>

                    {/* Clean Toggle Link for Per-Category Breakdown */}
                    <button
                      type="button"
                      data-testid="welcome-toggle-category-breakdown-btn"
                      onClick={() => setShowCategoryBreakdown((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-2 text-left transition hover:border-[var(--border-strong)]"
                    >
                      <span className="text-xs font-extrabold text-[var(--ink-primary)]">
                        {isVi
                          ? `Tùy chỉnh từng danh mục (${activeCapCatIds.length} mục)`
                          : `Customize individual categories (${activeCapCatIds.length})`}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black text-[var(--ink-secondary)]">
                        <span>
                          {showCategoryBreakdown
                            ? isVi
                              ? 'Thu gọn'
                              : 'Hide'
                            : isVi
                              ? 'Chi tiết'
                              : 'Details'}
                        </span>
                        {showCategoryBreakdown ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </span>
                    </button>

                    {/* Collapsible Per-Category Cap Cards + Subcategory Customizer */}
                    {showCategoryBreakdown && (
                      <div className="space-y-1.5 pt-1">
                        {activeCapCatIds.map((catId) => {
                          const cat = expenseParents.find((c) => c.id === catId);
                          if (!cat) return null;
                          const subcats = allCategories.filter(
                            (c) => c.parent_id === cat.id && c.archived_at === null,
                          );
                          const capValText = categoryCapTexts[cat.id] ?? '0';
                          const isSubcatOpen = addingSubcatParentId === cat.id;

                          return (
                            <div
                              key={cat.id}
                              data-testid={`welcome-category-cap-row-${cat.slug}`}
                              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 py-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <CategoryIcon
                                    slug={cat.slug}
                                    colorHex={cat.color_hex}
                                    size="sm"
                                  />
                                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                    <span className="truncate text-xs font-extrabold text-[var(--ink-primary)]">
                                      {getCategoryDisplayName(cat, t)}
                                    </span>
                                    <button
                                      type="button"
                                      data-testid={`welcome-add-subcat-btn-${cat.slug}`}
                                      onClick={() => {
                                        setAddingSubcatParentId(isSubcatOpen ? null : cat.id);
                                        setNewSubcatName('');
                                      }}
                                      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold transition ${
                                        isSubcatOpen
                                          ? 'bg-[#191919] text-[#FAFAFA]'
                                          : 'border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-secondary)] hover:border-[#191919] hover:text-[var(--ink-primary)]'
                                      }`}
                                    >
                                      <span>
                                        {isVi
                                          ? `${subcats.length} mục con ▾`
                                          : `${subcats.length} sub ▾`}
                                      </span>
                                    </button>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <div className="flex w-28 items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2 py-1">
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      data-testid={`welcome-cat-cap-${cat.slug}`}
                                      value={capValText}
                                      onChange={(e) =>
                                        handleSingleCategoryCapChange(cat.id, e.target.value)
                                      }
                                      aria-label={`Mức trần ${getCategoryDisplayName(cat, t)}`}
                                      className="min-w-0 flex-1 bg-transparent text-right text-xs font-black text-[var(--ink-primary)] tabular-nums focus:outline-none"
                                    />
                                    <span className="text-[10px] font-bold text-[var(--ink-secondary)]">
                                      đ
                                    </span>
                                  </div>
                                  {activeCapCatIds.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleCategoryInCapList(cat.id)}
                                      title={isVi ? 'Bỏ trần mục này' : 'Remove cap'}
                                      className="rounded-lg p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-card)] hover:text-[#D93829]"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Collapsible Subcategories Drawer */}
                              {isSubcatOpen && (
                                <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-[var(--border-hairline)] pt-2">
                                  {subcats.map((sub) => (
                                    <span
                                      key={sub.id}
                                      className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-primary)]"
                                    >
                                      <span>{getCategoryDisplayName(sub, t)}</span>
                                      <button
                                        type="button"
                                        onClick={() => void handleDeleteSubcategoryInline(sub)}
                                        aria-label={`Xoá mục con ${sub.name}`}
                                        className="text-[var(--ink-secondary)] hover:text-[#D93829]"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}

                                  <div className="inline-flex items-center gap-1">
                                    <input
                                      type="text"
                                      data-testid={`welcome-new-subcat-input-${cat.slug}`}
                                      value={newSubcatName}
                                      onChange={(e) => setNewSubcatName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          void handleCreateSubcategoryInline(cat);
                                        }
                                      }}
                                      placeholder={isVi ? '+ Thêm mục con...' : '+ Add sub...'}
                                      className="w-28 rounded-full border border-[#191919] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-primary)] focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      data-testid={`welcome-save-subcat-btn-${cat.slug}`}
                                      onClick={() => void handleCreateSubcategoryInline(cat)}
                                      className="rounded-full bg-[#191919] px-2 py-0.5 text-[10px] font-black text-[#FAFAFA]"
                                    >
                                      {isVi ? 'Lưu' : 'Add'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Inactive Categories Pills + Create Custom Parent Category */}
                        <div className="space-y-2 pt-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {expenseParents
                              .filter((c) => !activeCapCatIds.includes(c.id))
                              .map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => handleToggleCategoryInCapList(c.id)}
                                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--ink-primary)] hover:border-[#191919]"
                                >
                                  <Plus className="h-3 w-3" />
                                  <span>{getCategoryDisplayName(c, t)}</span>
                                </button>
                              ))}

                            <button
                              type="button"
                              data-testid="welcome-add-parent-cat-toggle"
                              onClick={() => setShowAddParentCatForm((v) => !v)}
                              style={{ backgroundColor: activePreset.cardBgHex }}
                              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#191919] px-2.5 py-1 text-[10px] font-black text-[#191919]"
                            >
                              <Plus className="h-3 w-3" />
                              <span>{isVi ? 'Tạo danh mục mới' : 'New Custom Category'}</span>
                            </button>
                          </div>

                          {showAddParentCatForm && (
                            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#191919] bg-[var(--bg-subtle)] p-2">
                              <input
                                type="text"
                                data-testid="welcome-new-parent-cat-name"
                                value={newParentCatName}
                                onChange={(e) => setNewParentCatName(e.target.value)}
                                placeholder={
                                  isVi
                                    ? 'Tên danh mục (VD: Thú cưng, Thể thao...)'
                                    : 'Category name...'
                                }
                                className="min-w-0 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1 text-xs font-bold text-[var(--ink-primary)] focus:outline-none"
                              />
                              <input
                                type="text"
                                inputMode="decimal"
                                value={newParentCatCapText}
                                onChange={(e) =>
                                  setNewParentCatCapText(formatVndDigitsInput(e.target.value))
                                }
                                placeholder="1.000.000"
                                className="w-24 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2 py-1 text-right text-xs font-black text-[var(--ink-primary)] tabular-nums focus:outline-none"
                              />
                              <button
                                type="button"
                                data-testid="welcome-new-parent-cat-save"
                                onClick={() => void handleCreateCustomParentCategory()}
                                className="rounded-lg bg-[#191919] px-3 py-1 text-xs font-black text-[#FAFAFA]"
                              >
                                {isVi ? 'Thêm' : 'Add'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* BOTTOM HERO SAFE-TO-SPEND CARD + COMPLETE SETUP BUTTON (With Corner-Peeking VOI Companion!) */}
            <div className="shrink-0 space-y-2.5 border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-5 pt-3 pb-4">
              <div
                style={{ backgroundColor: activePreset.cardBgHex }}
                className="relative overflow-hidden rounded-[24px] border border-[#191919]/15 p-4 shadow-xs"
              >
                <div className="relative z-10 pr-24">
                  <div className="inline-flex items-center gap-1 rounded-full bg-[#FAFAFA]/85 px-2.5 py-0.5 text-[10px] font-black text-[#191919]">
                    <Sparkles
                      className="h-3 w-3 shrink-0"
                      style={{ color: activePreset.characterFillHex }}
                    />
                    <span>{isVi ? 'Định mức an toàn mỗi ngày' : 'Your Safe-to-Spend / day'}</span>
                  </div>

                  <p className="mt-1.5 text-2xl leading-none font-black tracking-tight text-[#191919] tabular-nums sm:text-3xl">
                    <strong data-testid="welcome-daily-safe-preview">
                      {formatMoney(dailySafePreviewMinor, 'VND')}
                      {isVi ? '/ngày' : '/day'}
                    </strong>
                  </p>

                  {isPreviewLiquidConstrained ? (
                    <p className="mt-1 text-[11px] font-bold text-[#191919]/80">
                      {isVi
                        ? `🛡️ Bảo vệ theo số dư ví (${formatMoney(totalLiquidBalanceMinor, 'VND')} / ${remainingDays} ngày)`
                        : `🛡️ Protected by wallet cash (${formatMoney(totalLiquidBalanceMinor, 'VND')} / ${remainingDays}d)`}
                    </p>
                  ) : parsedIncomeMinor > 0 ? (
                    <p className="mt-1.5 text-[11px] font-bold text-[#191919]/80">
                      {parsedIncomeMinor >= parsedBudgetMinor
                        ? isVi
                          ? `💰 Dự kiến tích lũy: ${formatMoney(parsedIncomeMinor - parsedBudgetMinor, 'VND')}/tháng`
                          : `💰 Projected savings: ${formatMoney(parsedIncomeMinor - parsedBudgetMinor, 'VND')}/mo`
                        : isVi
                          ? `⚠️ Định mức chi đang vượt thu nhập tháng`
                          : `⚠️ Spending cap exceeds monthly income`}
                    </p>
                  ) : null}
                </div>

                {/* Big Corner-Peeking VOI Companion on the Safe-to-Spend Stage */}
                <div className="pointer-events-none absolute -right-2 -bottom-3 z-10">
                  <GeometricBuddy
                    shape={activePreset.shape}
                    colorHex={activePreset.characterFillHex}
                    accessory={activePreset.accessory}
                    blush
                    mood="excited"
                    size={96}
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={isSaving}
                data-testid="welcome-save-wallet-btn"
                onClick={() => void handleSaveWalletStep()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#191919] px-5 py-4 text-base font-black text-[#FAFAFA] shadow-md transition hover:scale-[1.01] disabled:opacity-50"
              >
                <span>{isVi ? 'Hoàn tất thiết lập 🎉' : 'Complete Setup 🎉'}</span>
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 4: COMPANION-THEMED CELEBRATION "CONGRATS!" (Fully synced to chosen character's Pantone palette!) */}
        {step === 'congrats' && (
          <div
            data-testid="welcome-congrats-screen"
            style={{
              background: `linear-gradient(180deg, ${activePreset.cardBgHex} 0%, ${activePreset.characterFillHex}40 50%, ${activePreset.cardBgHex} 100%)`,
              backgroundColor: activePreset.cardBgHex,
            }}
            className="relative flex flex-1 flex-col justify-between overflow-y-auto px-6 py-6 text-center text-[#191919]"
          >
            {/* Ambient Glowing Halo & Floating Celebration Stars */}
            <div className="pointer-events-none absolute top-10 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-[#FAFAFA]/45 blur-2xl" />
            <Sparkles className="pointer-events-none absolute top-8 left-10 h-7 w-7 fill-[#FAFAFA] text-[#FAFAFA]" />
            <Sparkles
              className="pointer-events-none absolute top-14 right-10 h-6 w-6"
              style={{
                color: activePreset.characterFillHex,
                fill: activePreset.characterFillHex,
              }}
            />
            <Sparkles className="pointer-events-none absolute top-48 left-12 h-5 w-5 fill-[#FAFAFA] text-[#FAFAFA]" />
            <Sparkles
              className="pointer-events-none absolute top-44 right-12 h-5 w-5"
              style={{
                color: activePreset.characterFillHex,
                fill: activePreset.characterFillHex,
              }}
            />

            {/* Top Hero Mascot Stage (Free-standing Giant Mascot + VOI Brand Pill!) */}
            <div className="relative z-10 flex flex-col items-center pt-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#FAFAFA]/95 py-1 pr-3.5 pl-1.5 text-xs font-black text-[#191919] shadow-2xs">
                <VoiLogo variant="cobalt" size={22} className="rounded-lg" />
                <span>VOI</span>
                <span className="text-[#191919]/30">·</span>
                <Sparkles
                  className="h-3.5 w-3.5"
                  style={{ color: activePreset.characterFillHex }}
                />
                <span>{isVi ? 'Thiết lập hoàn tất 100%' : '100% Setup Complete'}</span>
              </span>

              {/* Giant Expressive Mascot on Soft Glowing Cushion */}
              <div className="relative mt-3 flex h-44 w-44 items-center justify-center">
                <div
                  className="absolute inset-2 rounded-[48px] border-2 bg-[#FAFAFA]/90 shadow-xl"
                  style={{ borderColor: activePreset.characterFillHex }}
                />
                <div className="relative z-10">
                  <GeometricBuddy
                    shape={activePreset.shape}
                    colorHex={activePreset.characterFillHex}
                    accessory={activePreset.accessory}
                    blush
                    mood="excited"
                    size={142}
                  />
                </div>
              </div>

              <h2 className="mt-3 text-3xl leading-[1.12] font-black tracking-tight text-[#191919] sm:text-4xl">
                {isVi ? (
                  <>
                    Chúc mừng {displayName}!
                    <br />
                    Ví của bạn đã sẵn sàng 🎉
                  </>
                ) : (
                  <>
                    Congrats, {displayName}!
                    <br />
                    Your wallet is ready 🎉
                  </>
                )}
              </h2>
              <p className="mt-2 max-w-sm text-xs leading-relaxed font-bold text-[#191919]/80 sm:text-sm">
                {isVi
                  ? 'Mỗi khi tiêu tiền, bạn chỉ mất 3 giây để ghi lại và biết ngay hôm nay còn tiêu được bao nhiêu.'
                  : 'Now logging takes just 3 seconds, and VOI always shows how much you can safely spend today.'}
              </p>
            </div>

            {/* Middle: 3 Tall Companion-Themed Stat Squircles + Setup Summary */}
            <div className="relative z-10 my-3 w-full space-y-3">
              <div className="grid w-full grid-cols-3 gap-2.5">
                {/* Stat 1: Total Balance Squircle */}
                <div
                  style={{ borderColor: `${activePreset.characterFillHex}45` }}
                  className="flex flex-col items-center rounded-[28px] border-2 bg-[#FAFAFA]/92 p-3.5 shadow-sm"
                >
                  <span
                    style={{ backgroundColor: activePreset.cardBgHex }}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-2xs"
                  >
                    <Wallet className="h-5 w-5" style={{ color: activePreset.characterFillHex }} />
                  </span>
                  <p className="mt-2.5 w-full truncate text-xs font-black text-[#191919] tabular-nums sm:text-sm">
                    {totalLiquidBalanceMinor > 0
                      ? formatMoney(totalLiquidBalanceMinor, 'VND')
                      : formatMoney(
                          parsedBudgetMinor > 0 ? parsedBudgetMinor : parsedIncomeMinor,
                          'VND',
                        )}
                  </p>
                  <p className="mt-0.5 text-[10px] font-extrabold text-[#191919]/75">
                    {totalLiquidBalanceMinor > 0
                      ? isVi
                        ? 'Số dư hiện có'
                        : 'Total Balance'
                      : isVi
                        ? 'Ngân sách tháng'
                        : 'Monthly Cap'}
                  </p>
                </div>

                {/* Stat 2: Daily Safe-to-Spend Squircle */}
                <div
                  style={{ borderColor: `${activePreset.characterFillHex}45` }}
                  className="flex flex-col items-center rounded-[28px] border-2 bg-[#FAFAFA]/92 p-3.5 shadow-sm"
                >
                  <span
                    style={{ backgroundColor: activePreset.cardBgHex }}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-2xs"
                  >
                    <Sparkles
                      className="h-5 w-5"
                      style={{ color: activePreset.characterFillHex }}
                    />
                  </span>
                  <p className="mt-2.5 w-full truncate text-xs font-black text-[#191919] tabular-nums sm:text-sm">
                    {formatMoney(dailySafePreviewMinor, 'VND')}
                  </p>
                  <p className="mt-0.5 text-[10px] font-extrabold text-[#191919]/75">
                    {isVi ? 'An toàn / ngày' : 'Safe / day'}
                  </p>
                </div>

                {/* Stat 3: Streak Squircle */}
                <div
                  style={{ borderColor: `${activePreset.characterFillHex}45` }}
                  className="flex flex-col items-center rounded-[28px] border-2 bg-[#FAFAFA]/92 p-3.5 shadow-sm"
                >
                  <span
                    style={{ backgroundColor: activePreset.cardBgHex }}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-2xs"
                  >
                    <Flame
                      className="h-5 w-5"
                      style={{
                        color: activePreset.characterFillHex,
                        fill: activePreset.characterFillHex,
                      }}
                    />
                  </span>
                  <p className="mt-2.5 text-xs font-black text-[#191919] sm:text-sm">
                    {isVi ? 'Ngày 1' : 'Day 1'}
                  </p>
                  <p className="mt-0.5 text-[10px] font-extrabold text-[#191919]/75">
                    {isVi ? 'Chuỗi kỷ luật' : 'Momentum'}
                  </p>
                </div>
              </div>

              {/* Frosted Setup Readiness Summary Card (Synced with Companion Color!) */}
              <div
                style={{ borderColor: `${activePreset.characterFillHex}45` }}
                className="flex items-center justify-between rounded-2xl border-2 bg-[#FAFAFA]/92 px-4 py-3 text-left shadow-xs backdrop-blur-xs"
              >
                <div className="min-w-0">
                  <p className="text-xs font-black text-[#191919]">
                    {isVi
                      ? `Người đồng hành: ${activePreset.nameVi}`
                      : `Companion: ${activePreset.nameEn}`}
                  </p>
                  <p className="truncate text-[11px] font-semibold text-[#191919]/70">
                    {isVi
                      ? `Đã bật trần ${activeCapCatIds.length} hạng mục · Tổng ${formatMoney(parsedBudgetMinor, 'VND')}/tháng`
                      : `${activeCapCatIds.length} category caps active · ${formatMoney(parsedBudgetMinor, 'VND')}/mo`}
                  </p>
                </div>
                <span
                  style={{ backgroundColor: activePreset.cardBgHex }}
                  className="shrink-0 rounded-xl border border-[#191919]/15 px-2.5 py-1 text-[11px] font-black text-[#191919]"
                >
                  {isVi ? 'Sẵn sàng' : 'Ready'}
                </span>
              </div>
            </div>

            {/* Bottom Thumb-Zone Action Squircles */}
            <div className="relative z-10 w-full shrink-0 space-y-2.5 pt-1">
              <button
                type="button"
                data-testid="welcome-try-first-expense-btn"
                onClick={handleFinishAndTryQuickAdd}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#191919] px-5 py-4 text-base font-black text-[#FAFAFA] shadow-lg transition hover:scale-[1.01]"
              >
                <span>
                  {isVi
                    ? '☕ Thử ghi khoản chi đầu tiên (3 giây)'
                    : '☕ Try logging your first expense (3s)'}
                </span>
                <ArrowRight className="h-5 w-5" />
              </button>

              <button
                type="button"
                data-testid="welcome-go-home-btn"
                onClick={handleFinishToHome}
                className="w-full rounded-2xl bg-[#FAFAFA]/90 px-4 py-3 text-xs font-black text-[#191919] shadow-2xs transition hover:bg-[#FAFAFA]"
              >
                {isVi ? 'Vào Trang chủ khám phá' : 'Go to Home Dashboard'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
