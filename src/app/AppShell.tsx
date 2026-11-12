import { useEffect, useState, type ReactElement } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  Flame,
  Home,
  PieChart,
  Plus,
  ReceiptText,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { localDb } from '../db/dexie-schema';
import { evaluateStreakAndFreeze } from '../domain/engagement/streak-and-themes';
import { InsightsView } from '../features/analytics/InsightsView';
import { AssetsAndDebtsView } from '../features/assets/AssetsAndDebtsView';
import { outboxSyncEngine } from '../db/sync/outbox-sync-engine';
import { HomeView } from '../features/home/HomeView';
import { CelebrationOverlay } from '../features/onboarding/CelebrationOverlay';
import {
  AVATAR_PRESETS,
  getAvatarPresetMeta,
  WelcomeOnboardingModal,
} from '../features/onboarding/WelcomeOnboardingModal';
import { PwaInstallAndEngagementCard } from '../features/pwa/PwaInstallAndEngagementCard';
import { QuickAddSheet } from '../features/quick-add/QuickAddSheet';
import { SettingsView } from '../features/settings/SettingsView';
import { TransactionsLedgerView } from '../features/transactions/TransactionsLedgerView';
import { useTranslation } from '../shared/i18n';
import { applyThemeToDom } from '../shared/theme/themes';
import { BottomSheet } from '../shared/ui/BottomSheet';
import { IconButton } from '../shared/ui/Button';
import { GeometricBuddy } from '../shared/ui/GeometricBuddy';
import { VoiLogo } from '../shared/ui/VoiLogo';
import { useUiStore, type NavTabId } from './ui-store';

export function AppShell(): ReactElement {
  const {
    activeTab,
    hideBalances,
    themeId,
    colorMode,
    userName,
    avatarId,
    streakDays,
    maxStreakDays,
    noSpendDates,
    weeklyFreezeAvailable,
    setActiveTab,
    openQuickAdd,
    toggleHideBalances,
    setSyncStatus,
    setStreakDays,
    setAvatarId,
    setUserName,
  } = useUiStore();
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';
  const [isStreakSheetOpen, setIsStreakSheetOpen] = useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const avatarPreset = getAvatarPresetMeta(avatarId);

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
  }, [
    liveTransactions,
    noSpendDates,
    weeklyFreezeAvailable,
    maxStreakDays,
    streakDays,
    setStreakDays,
  ]);

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
        {/* Minimal Brand-Forward Top Header (No greeting truncation, no Synced clutter, Language in Settings, Quick Companion & Theme Sheet) */}
        <header className="mb-3.5 flex items-center justify-between gap-2 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3.5 py-2 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex min-w-0 items-center gap-2.5 text-left"
          >
            <VoiLogo variant="cobalt" size={36} className="rounded-xl shadow-2xs" />
            <div className="min-w-0">
              <span className="block text-base leading-tight font-black tracking-tight text-[var(--ink-primary)]">
                {t.app.name}
              </span>
              {userName && (
                <span className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {userName}
                </span>
              )}
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Companion & Theme Quick Switcher Pill (Opens standalone BottomSheet — NEVER restarts Onboarding!) */}
            <button
              type="button"
              onClick={() => setIsAvatarPickerOpen(true)}
              data-testid="header-avatar-btn"
              aria-label={isVi ? 'Đổi nhân vật & chủ đề màu' : 'Change companion & color theme'}
              title={isVi ? 'Đổi nhân vật & chủ đề màu' : 'Change companion & color theme'}
              style={{ backgroundColor: avatarPreset.cardBgHex }}
              className="flex h-8 items-center gap-1.5 rounded-full border border-[#191919]/15 py-0.5 pr-2.5 pl-1 text-xs font-extrabold text-[#191919] shadow-2xs transition hover:scale-[1.02]"
            >
              <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-[#FAFAFA]/80">
                <GeometricBuddy
                  shape={avatarPreset.shape}
                  colorHex={avatarPreset.characterFillHex}
                  accessory={avatarPreset.accessory}
                  mood="happy"
                  size={22}
                />
              </span>
              <span className="hidden text-[11px] font-black sm:inline">
                {isVi ? avatarPreset.nameVi : avatarPreset.nameEn}
              </span>
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

      {/* Welcome & Personalization Onboarding Flow + Celebration/Confirmation Overlays */}
      <WelcomeOnboardingModal />
      <CelebrationOverlay />

      {/* Daily Momentum, Streak Freeze & PWA Sheet */}
      <BottomSheet
        open={isStreakSheetOpen}
        onClose={() => setIsStreakSheetOpen(false)}
        title={t.m5.streakTitle}
        titleId="header-streak-sheet-title"
        closeLabel={isVi ? 'Đóng' : 'Close'}
      >
        <PwaInstallAndEngagementCard />
      </BottomSheet>

      {/* Standalone Quick Companion & Theme Switcher Sheet (Changes Theme & Avatar in 1 tap without restarting Onboarding!) */}
      <BottomSheet
        open={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
        title={isVi ? 'Chọn Nhân vật & Chủ đề màu' : 'Companion & Color Theme'}
        titleId="header-avatar-picker-title"
        closeLabel={isVi ? 'Xong' : 'Done'}
      >
        <div className="space-y-3.5">
          <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-2">
            <Sparkles
              className="h-4 w-4 shrink-0"
              style={{ color: avatarPreset.characterFillHex }}
            />
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={isVi ? 'Tên gọi của bạn...' : 'Your nickname...'}
              aria-label={isVi ? 'Tên gọi của bạn' : 'Your nickname'}
              className="min-w-0 flex-1 bg-transparent text-xs font-black text-[var(--ink-primary)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {AVATAR_PRESETS.map((preset) => {
              const isSelected = preset.id === avatarId;
              const titleText = isVi ? preset.nameVi : preset.nameEn;
              const tagText = isVi ? preset.tagVi : preset.tagEn;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`quick-avatar-option-${preset.id}`}
                  onClick={() => {
                    setAvatarId(preset.id);
                    setIsAvatarPickerOpen(false);
                  }}
                  style={{ backgroundColor: preset.cardBgHex }}
                  className={`relative flex min-h-[126px] flex-col justify-between overflow-hidden rounded-[22px] p-2.5 text-left transition-all ${
                    isSelected
                      ? 'scale-[1.02] shadow-sm ring-2 ring-[#191919]'
                      : 'opacity-90 hover:opacity-100'
                  }`}
                >
                  <div className="relative z-10 space-y-0.5">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                        isSelected
                          ? 'bg-[#191919] text-[#FAFAFA]'
                          : 'bg-[#FAFAFA]/80 text-[#191919]'
                      }`}
                    >
                      {isSelected ? <Check className="h-3 w-3 stroke-[3]" /> : '•'}
                    </span>
                    <p className="text-[11px] leading-tight font-black text-[#191919]">
                      {titleText}
                    </p>
                    <p className="text-[9px] font-bold text-[#191919]/75">{tagText}</p>
                  </div>

                  <div className="pointer-events-none absolute -right-1.5 -bottom-2">
                    <GeometricBuddy
                      shape={preset.shape}
                      colorHex={preset.characterFillHex}
                      accessory={preset.accessory}
                      blush={isSelected}
                      mood={isSelected ? 'excited' : 'happy'}
                      size={78}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
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
