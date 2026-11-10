import { useEffect, useState, type ReactElement } from 'react';
import {
  Eye,
  EyeOff,
  Flame,
  Home,
  PieChart,
  Plus,
  ReceiptText,
  Settings,
  Wallet,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localDb } from '../db/dexie-schema';
import { evaluateStreakAndFreeze } from '../domain/engagement/streak-and-themes';
import { InsightsView } from '../features/analytics/InsightsView';
import { AssetsAndDebtsView } from '../features/assets/AssetsAndDebtsView';
import { outboxSyncEngine } from '../db/sync/outbox-sync-engine';
import { HomeView } from '../features/home/HomeView';
import { PwaInstallAndEngagementCard } from '../features/pwa/PwaInstallAndEngagementCard';
import { QuickAddSheet } from '../features/quick-add/QuickAddSheet';
import { SettingsView } from '../features/settings/SettingsView';
import { TransactionsLedgerView } from '../features/transactions/TransactionsLedgerView';
import { useTranslation, type TranslationDictionary } from '../shared/i18n';
import { applyThemeToDom } from '../shared/theme/themes';
import { BottomSheet } from '../shared/ui/BottomSheet';
import { IconButton } from '../shared/ui/Button';
import { VoiLogo } from '../shared/ui/VoiLogo';
import { useUiStore, type NavTabId } from './ui-store';

function getGreetingText(dict: TranslationDictionary): string {
  const hour = new Date().getHours();
  if (hour < 12) return dict.greeting.morning;
  if (hour < 18) return dict.greeting.afternoon;
  return dict.greeting.evening;
}

export function AppShell(): ReactElement {
  const {
    activeTab,
    hideBalances,
    themeId,
    colorMode,
    syncStatus,
    streakDays,
    maxStreakDays,
    noSpendDates,
    weeklyFreezeAvailable,
    setActiveTab,
    openQuickAdd,
    toggleHideBalances,
    setSyncStatus,
    setStreakDays,
  } = useUiStore();
  const { t, locale, toggleLocale } = useTranslation();
  const [isStreakSheetOpen, setIsStreakSheetOpen] = useState(false);

  const liveTransactions = useLiveQuery(() => localDb.transactions.toArray(), [], []);

  useEffect(() => {
    const activeCount = liveTransactions.filter(
      (tx) => tx.voided_at === null && tx.status !== 'void',
    ).length;
    if (activeCount === 0 && noSpendDates.length === 0) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    const evalResult = evaluateStreakAndFreeze({
      transactions: liveTransactions,
      noSpendDates,
      todayIso,
      weeklyFreezeAvailable,
      previousMaxStreak: maxStreakDays,
    });
    const computedStreak = Math.max(1, evalResult.streakDays);
    if (computedStreak !== streakDays) {
      setStreakDays(computedStreak);
    }
  }, [liveTransactions, noSpendDates, weeklyFreezeAvailable, maxStreakDays, streakDays, setStreakDays]);

  useEffect(() => {
    applyThemeToDom(themeId, colorMode);
  }, [themeId, colorMode]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const handleOnline = (): void => {
      setSyncStatus('syncing');
      void outboxSyncEngine.flushOutbox({ isOnline: true }).then((res) => {
        setSyncStatus(res.failedCount > 0 ? 'error' : 'synced');
      });
    };
    const handleOffline = (): void => {
      setSyncStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setSyncStatus]);

  // Section 6.1: Desktop keyboard shortcuts ('/' or 'n') to open Quick Add immediately (<50ms)
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }
      if ((event.key === '/' || event.key === 'n') && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        openQuickAdd();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [openQuickAdd]);

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--ink-primary)] pb-28">
      <div className="mx-auto max-w-md px-4 pt-4">
        {/* Brand-Forward Top Header */}
        <header className="mb-4 flex items-center justify-between gap-2.5 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3.5 py-2.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <VoiLogo variant="cobalt" size={40} className="rounded-2xl shadow-2xs" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tracking-tight text-[var(--ink-primary)]">
                  {t.app.name}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/12 px-2 py-0.5 text-[10px] font-bold text-[#10B981]">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-[#10B981]"
                    aria-hidden="true"
                  />
                  <span>{t.sync[syncStatus]}</span>
                </span>
              </div>
              <h1 className="truncate text-xs font-semibold text-[var(--ink-secondary)]">
                {getGreetingText(t)} ✨
              </h1>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-1">
            {/* Multi-Language Quick Pill (EN default / VI) */}
            <button
              type="button"
              onClick={toggleLocale}
              aria-label={t.nav.languageToggleAria}
              data-testid="language-toggle-btn"
              className="flex h-8 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 text-[11px] font-extrabold tracking-wider text-[var(--ink-primary)] uppercase transition hover:border-[var(--border-strong)]"
            >
              {locale.toUpperCase()}
            </button>

            <button
              type="button"
              onClick={() => setIsStreakSheetOpen(true)}
              data-testid="header-streak-btn"
              className="flex h-8 items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 text-xs font-extrabold text-[var(--ink-primary)] transition hover:border-[var(--border-strong)]"
              title={`${streakDays} ${t.hero.streakBadge}`}
            >
              <Flame className="h-3.5 w-3.5 fill-[#FF6B35] text-[#FF6B35]" aria-hidden="true" />
              <span className="tabular-nums">{streakDays}</span>
            </button>

            <IconButton label={t.hero.hideBalanceAria} onClick={toggleHideBalances}>
              {hideBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </IconButton>

            <IconButton
              label={t.nav.settings}
              active={activeTab === 'settings'}
              onClick={() => setActiveTab(activeTab === 'settings' ? 'home' : 'settings')}
            >
              <Settings className="h-4 w-4" />
            </IconButton>
          </div>
        </header>

        {/* Active Feature Viewport */}
        <main>
          {activeTab === 'home' && <HomeView />}
          {activeTab === 'transactions' && <TransactionsLedgerView />}
          {activeTab === 'wallets' && <AssetsAndDebtsView />}
          {activeTab === 'insights' && <InsightsView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Symmetrical 5-Slot Floating Ink Dock (#141413) */}
      <nav
        aria-label={t.nav.mainNavAria}
        className="fixed inset-x-0 bottom-4 z-30 mx-auto max-w-md px-4"
      >
        <div
          className="grid grid-cols-5 items-center rounded-full border border-[#2A2A28] bg-[#141413] px-2 py-2"
          style={{ boxShadow: 'var(--shadow-dock)' }}
        >
          <DockTabButton
            id="home"
            label={t.nav.home}
            activeTab={activeTab}
            onSelect={setActiveTab}
            icon={<Home className="h-4 w-4" />}
          />

          <DockTabButton
            id="transactions"
            label={t.nav.transactions}
            activeTab={activeTab}
            onSelect={setActiveTab}
            icon={<ReceiptText className="h-4 w-4" />}
          />

          <div className="flex justify-center">
            <button
              type="button"
              onClick={openQuickAdd}
              aria-label={t.nav.quickAdd}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#141413] transition hover:scale-105 active:scale-95"
              style={{
                backgroundColor: 'var(--accent-pop)',
                color: 'var(--accent-pop-fg)',
              }}
            >
              <Plus className="h-6 w-6 stroke-[2.6]" />
            </button>
          </div>

          <DockTabButton
            id="wallets"
            label={t.nav.walletsAndDebts}
            activeTab={activeTab}
            onSelect={setActiveTab}
            icon={<Wallet className="h-4 w-4" />}
          />

          <DockTabButton
            id="insights"
            label={t.nav.insights}
            activeTab={activeTab}
            onSelect={setActiveTab}
            icon={<PieChart className="h-4 w-4" />}
          />
        </div>
      </nav>

      {/* Hybrid Money+ Quick-Add Sheet */}
      <QuickAddSheet />

      {/* Daily Momentum, Streak Freeze & PWA Sheet */}
      <BottomSheet
        open={isStreakSheetOpen}
        onClose={() => setIsStreakSheetOpen(false)}
        title={t.m5.streakTitle}
        titleId="header-streak-sheet-title"
        closeLabel={locale === 'vi' ? 'Đóng' : 'Close'}
      >
        <PwaInstallAndEngagementCard />
      </BottomSheet>
    </div>
  );
}

interface DockTabButtonProps {
  id: NavTabId;
  label: string;
  activeTab: NavTabId;
  onSelect: (id: NavTabId) => void;
  icon: ReactElement;
}

function DockTabButton({ id, label, activeTab, onSelect, icon }: DockTabButtonProps): ReactElement {
  const isActive = activeTab === id;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-current={isActive ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-semibold transition ${
        isActive ? 'text-white' : 'text-[#A3A19A] hover:text-white'
      }`}
    >
      <span
        className={`flex h-7 w-10 items-center justify-center rounded-full transition ${
          isActive ? 'bg-white/15 text-white' : ''
        }`}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
