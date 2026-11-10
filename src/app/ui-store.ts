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

export interface OpenQuickAddOptions {
  kind?: QuickAddFlowKind;
  dateIso?: string | null;
  splitMode?: boolean;
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
  editingTransactionId: string | null;
  thousandsInputMode: boolean;
  hideBalances: boolean;
  locale: SupportedLocale;
  themeId: ThemeId;
  colorMode: ColorMode;
  syncStatus: SyncStatus;
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
  checkInNoSpendToday: () => void;
  clearNoSpendDate: (dateIso?: string) => void;
  setStreakDays: (days: number) => void;
  setPwaInstalled: (installed: boolean) => void;
  setPushEnabled: (enabled: boolean) => void;
  updateNotificationPrefs: (patch: Partial<NotificationPreferences>) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      activeTab: 'home',
      walletSubTab: 'wallets',
      isQuickAddOpen: false,
      quickAddDefaultKind: 'expense',
      quickAddDefaultDateIso: null,
      quickAddDefaultSplitMode: false,
      editingTransactionId: null,
      thousandsInputMode: true,
      hideBalances: false,
      locale: 'en',
      themeId: 'pop',
      colorMode: 'light',
      syncStatus: 'synced',
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
          ('kind' in options || 'dateIso' in options || 'splitMode' in options);
        const typedOpts = isOpts ? (options as OpenQuickAddOptions) : undefined;
        set({
          isQuickAddOpen: true,
          editingTransactionId: null,
          quickAddDefaultKind: typedOpts?.kind ?? 'expense',
          quickAddDefaultDateIso: typedOpts?.dateIso ?? null,
          quickAddDefaultSplitMode: Boolean(typedOpts?.splitMode),
        });
      },
      openEditTransaction: (transactionId) =>
        set({
          isQuickAddOpen: true,
          editingTransactionId: transactionId,
          quickAddDefaultSplitMode: false,
        }),
      closeQuickAdd: () =>
        set({
          isQuickAddOpen: false,
          editingTransactionId: null,
          quickAddDefaultKind: 'expense',
          quickAddDefaultDateIso: null,
          quickAddDefaultSplitMode: false,
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
      checkInNoSpendToday: () => {
        const today = new Date().toISOString().slice(0, 10);
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
          applyThemeToDom(state.themeId, state.colorMode);
          applyLocaleToDom(state.locale);
        }
      },
    },
  ),
);
