import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '../domain/notifications/notification-scheduler';
import type { ColorMode, SupportedLocale, SyncStatus, ThemeId } from '../domain/types/entities';
import { applyThemeToDom } from '../shared/theme/themes';

export type NavTabId = 'home' | 'transactions' | 'wallets' | 'insights' | 'settings';
export type WalletSubTabId = 'wallets' | 'debts' | 'recurring';
export type QuickAddFlowKind = 'expense' | 'income' | 'transfer';
export type AvatarPresetId = 'pop' | 'cobalt' | 'matcha' | 'flamingo' | 'sunny' | 'rose';
export type WelcomeStepId = 'cover' | 'avatar' | 'wallet' | 'congrats';

export type CelebrationKind =
  | 'first_transaction'
  | 'transaction_saved'
  | 'no_spend_checkin'
  | 'reconcile_done'
  | 'salary_confirmed';

export type CelebrationFlowMascot =
  'expense' | 'income' | 'transfer' | 'lend-borrow' | 'lend' | 'borrow';

export interface CelebrationState {
  id: string;
  kind: CelebrationKind;
  title: string;
  subtitle: string;
  amountText?: string;
  badgeText?: string;
  variant?: 'modal' | 'toast';
  flowMascot?: CelebrationFlowMascot;
}

export interface OpenQuickAddOptions {
  kind?: QuickAddFlowKind;
  dateIso?: string | null;
  splitMode?: boolean;
  presetText?: string | null;
}

function applyLocaleToDom(locale: SupportedLocale): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

interface UiState {
  activeTab: NavTabId;
  walletSubTab: WalletSubTabId;
  isQuickAddOpen: boolean;
  quickAddDefaultKind: QuickAddFlowKind;
  quickAddDefaultDateIso: string | null;
  quickAddDefaultSplitMode: boolean;
  quickAddPresetText: string | null;
  editingTransactionId: string | null;
  thousandsInputMode: boolean;
  hideBalances: boolean;
  locale: SupportedLocale;
  themeId: ThemeId;
  colorMode: ColorMode;
  syncStatus: SyncStatus;
  userName: string;
  avatarId: AvatarPresetId;
  hasCompletedWelcome: boolean;
  isWelcomeOpen: boolean;
  welcomeInitialStep: WelcomeStepId;
  celebration: CelebrationState | null;
  checkedInNoSpendToday: boolean;
  noSpendDates: string[];
  streakDays: number;
  maxStreakDays: number;
  weeklyFreezeAvailable: boolean;
  pwaInstalled: boolean;
  pushEnabled: boolean;
  notificationPrefs: NotificationPreferences;
  setActiveTab: (tab: NavTabId) => void;
  setWalletSubTab: (subTab: WalletSubTabId) => void;
  openQuickAdd: (options?: OpenQuickAddOptions | unknown) => void;
  openEditTransaction: (transactionId: string) => void;
  closeQuickAdd: () => void;
  setThousandsInputMode: (enabled: boolean) => void;
  toggleHideBalances: () => void;
  setLocale: (locale: SupportedLocale) => void;
  toggleLocale: () => void;
  setThemeId: (themeId: ThemeId) => void;
  setColorMode: (colorMode: ColorMode) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setUserName: (userName: string) => void;
  setAvatarId: (avatarId: AvatarPresetId) => void;
  openWelcomeModal: (step?: WelcomeStepId) => void;
  closeWelcomeModal: () => void;
  completeWelcomeOnboarding: (params?: { userName?: string; avatarId?: AvatarPresetId }) => void;
  triggerCelebration: (payload: Omit<CelebrationState, 'id'>) => void;
  dismissCelebration: () => void;
  checkInNoSpendToday: () => void;
  clearNoSpendDate: (dateIso?: string) => void;
  setStreakDays: (days: number) => void;
  setPwaInstalled: (installed: boolean) => void;
  setPushEnabled: (enabled: boolean) => void;
  updateNotificationPrefs: (patch: Partial<NotificationPreferences>) => void;
}

const AVATAR_TO_THEME: Record<AvatarPresetId, ThemeId> = {
  pop: 'pop',
  cobalt: 'cobalt',
  matcha: 'matcha',
  flamingo: 'flamingo',
  sunny: 'sunny',
  rose: 'rose',
};

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      activeTab: 'home',
      walletSubTab: 'wallets',
      isQuickAddOpen: false,
      quickAddDefaultKind: 'expense',
      quickAddDefaultDateIso: null,
      quickAddDefaultSplitMode: false,
      quickAddPresetText: null,
      editingTransactionId: null,
      thousandsInputMode: true,
      hideBalances: false,
      locale: 'en',
      themeId: 'pop',
      colorMode: 'light',
      syncStatus: 'synced',
      userName: '',
      avatarId: 'cobalt',
      hasCompletedWelcome: false,
      isWelcomeOpen: false,
      welcomeInitialStep: 'cover',
      celebration: null,
      checkedInNoSpendToday: false,
      noSpendDates: [],
      streakDays: 1,
      maxStreakDays: 1,
      weeklyFreezeAvailable: true,
      pwaInstalled: false,
      pushEnabled: false,
      notificationPrefs: DEFAULT_NOTIFICATION_PREFERENCES,

      setActiveTab: (activeTab) => set({ activeTab }),
      setWalletSubTab: (walletSubTab) => set({ walletSubTab }),
      openQuickAdd: (options) => {
        const isOpts =
          typeof options === 'object' &&
          options !== null &&
          ('kind' in options ||
            'dateIso' in options ||
            'splitMode' in options ||
            'presetText' in options);
        const typedOpts = isOpts ? (options as OpenQuickAddOptions) : undefined;
        set({
          isQuickAddOpen: true,
          editingTransactionId: null,
          quickAddDefaultKind: typedOpts?.kind ?? 'expense',
          quickAddDefaultDateIso: typedOpts?.dateIso ?? null,
          quickAddDefaultSplitMode: Boolean(typedOpts?.splitMode),
          quickAddPresetText: typedOpts?.presetText ?? null,
        });
      },
      openEditTransaction: (transactionId) =>
        set({
          isQuickAddOpen: true,
          editingTransactionId: transactionId,
          quickAddDefaultSplitMode: false,
          quickAddPresetText: null,
        }),
      closeQuickAdd: () =>
        set({
          isQuickAddOpen: false,
          editingTransactionId: null,
          quickAddDefaultKind: 'expense',
          quickAddDefaultDateIso: null,
          quickAddDefaultSplitMode: false,
          quickAddPresetText: null,
        }),
      setThousandsInputMode: (thousandsInputMode) => set({ thousandsInputMode }),
      toggleHideBalances: () => set((state) => ({ hideBalances: !state.hideBalances })),
      setLocale: (locale) => {
        applyLocaleToDom(locale);
        set({ locale });
      },
      toggleLocale: () => {
        const nextLocale: SupportedLocale = get().locale === 'en' ? 'vi' : 'en';
        applyLocaleToDom(nextLocale);
        set({ locale: nextLocale });
      },
      setThemeId: (themeId) => {
        applyThemeToDom(themeId, get().colorMode);
        set({ themeId });
      },
      setColorMode: (colorMode) => {
        applyThemeToDom(get().themeId, colorMode);
        set({ colorMode });
      },
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setUserName: (userName) => set({ userName: userName.trim() }),
      setAvatarId: (avatarId) => {
        const mappedTheme = AVATAR_TO_THEME[avatarId] ?? 'pop';
        applyThemeToDom(mappedTheme, get().colorMode);
        set({ avatarId, themeId: mappedTheme });
      },
      openWelcomeModal: (step = 'cover') =>
        set({
          isWelcomeOpen: true,
          welcomeInitialStep: step,
        }),
      closeWelcomeModal: () =>
        set({
          isWelcomeOpen: false,
          hasCompletedWelcome: true,
        }),
      completeWelcomeOnboarding: (params) => {
        const nextAvatar = params?.avatarId ?? get().avatarId;
        const mappedTheme = AVATAR_TO_THEME[nextAvatar] ?? get().themeId;
        applyThemeToDom(mappedTheme, get().colorMode);
        set((state) => ({
          userName: params?.userName !== undefined ? params.userName.trim() : state.userName,
          avatarId: nextAvatar,
          themeId: mappedTheme,
          hasCompletedWelcome: true,
          isWelcomeOpen: false,
        }));
      },
      triggerCelebration: (payload) =>
        set({
          celebration: {
            ...payload,
            id: `cel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          },
        }),
      dismissCelebration: () => set({ celebration: null }),
      checkInNoSpendToday: () => {
        const today = new Date().toISOString().slice(0, 10);
        const isVi = get().locale === 'vi';
        set((state) => {
          const nextDates = state.noSpendDates.includes(today)
            ? state.noSpendDates
            : [...state.noSpendDates, today];
          const nextStreak = state.checkedInNoSpendToday ? state.streakDays : state.streakDays + 1;
          return {
            checkedInNoSpendToday: true,
            noSpendDates: nextDates,
            streakDays: nextStreak,
            maxStreakDays: Math.max(state.maxStreakDays, nextStreak),
            celebration: {
              id: `cel-nospend-${Date.now()}`,
              kind: 'no_spend_checkin',
              variant: 'modal',
              title: isVi ? 'Không tiêu tiền hôm nay! ✨' : 'Zero-Spend Day Checked In! ✨',
              subtitle: isVi
                ? `Bạn đã giữ vững kỷ luật ${nextStreak} ngày liên tiếp. Ví của bạn đang mỉm cười đấy!`
                : `You kept your momentum for ${nextStreak} day(s) in a row. Your wallet is smiling!`,
              badgeText: `🔥 ${nextStreak} ${isVi ? 'ngày liên tiếp' : 'day streak'}`,
            },
          };
        });
      },
      clearNoSpendDate: (dateIso) => {
        const today = new Date().toISOString().slice(0, 10);
        const target = dateIso ?? today;
        set((state) => ({
          checkedInNoSpendToday: target === today ? false : state.checkedInNoSpendToday,
          noSpendDates: state.noSpendDates.filter((d) => d !== target),
        }));
      },
      setStreakDays: (days) =>
        set((state) => ({
          streakDays: Math.max(1, days),
          maxStreakDays: Math.max(state.maxStreakDays, days),
        })),
      setPwaInstalled: (pwaInstalled) => set({ pwaInstalled }),
      setPushEnabled: (pushEnabled) => set({ pushEnabled }),
      updateNotificationPrefs: (patch) =>
        set((state) => ({
          notificationPrefs: { ...state.notificationPrefs, ...patch },
        })),
    }),
    {
      name: 'fn_app_ui_prefs_v3',
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.avatarId === 'rose' && state.themeId === 'pop') {
            state.themeId = 'rose';
          }
          applyThemeToDom(state.themeId, state.colorMode);
          applyLocaleToDom(state.locale);
        }
      },
    },
  ),
);
