import { useEffect, useState, type ReactElement } from 'react';
import { Bell, Download, Flame, Snowflake, Sparkles } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUiStore } from '../../app/ui-store';
import { localDb, requestPersistentStorage } from '../../db/dexie-schema';
import { onboardingRepository } from '../../db/repositories/onboarding-repository';
import { evaluateStreakAndFreeze } from '../../domain/engagement/streak-and-themes';
import { useTranslation } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallAndEngagementCard(): ReactElement {
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';
  const {
    noSpendDates,
    maxStreakDays,
    weeklyFreezeAvailable,
    pwaInstalled,
    pushEnabled,
    openQuickAdd,
    setActiveTab,
    setWalletSubTab,
    setPwaInstalled,
    setPushEnabled,
  } = useUiStore();

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const transactions = useLiveQuery(() => localDb.transactions.toArray(), [], []);
  const todayIso = new Date().toISOString().slice(0, 10);

  const streakEval = evaluateStreakAndFreeze({
    transactions,
    noSpendDates,
    todayIso,
    weeklyFreezeAvailable,
    previousMaxStreak: maxStreakDays,
  });

  // Build 7-day activity dots for current week (Mon -> Sun)
  const activeDatesSet = new Set<string>([
    ...noSpendDates,
    ...transactions
      .filter((tx) => tx.voided_at === null && tx.status !== 'void')
      .map((tx) => tx.txn_date),
  ]);
  const now = new Date();
  const currentDay = now.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const weekLabels = [
    t.weekStrip.mon,
    t.weekStrip.tue,
    t.weekStrip.wed,
    t.weekStrip.thu,
    t.weekStrip.fri,
    t.weekStrip.sat,
    t.weekStrip.sun,
  ];
  const weekMomentum = weekLabels.map((label, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const iso = d.toISOString().slice(0, 10);
    return {
      label,
      iso,
      isToday: iso === todayIso,
      isActive: activeDatesSet.has(iso),
      isFrozen: streakEval.freezeUsedOnDate === iso,
    };
  });

  useEffect(() => {
    const handler = (e: Event): void => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPwa = async (): Promise<void> => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
    await requestPersistentStorage();
    setPwaInstalled(true);
    await onboardingRepository.markStepCompleted('tried_3_second_quick_add');
  };

  const handleEnablePush = async (): Promise<void> => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted' && 'serviceWorker' in navigator) {
          const swUrl = `${import.meta.env.BASE_URL ?? '/'}sw.js`;
          await navigator.serviceWorker.register(swUrl).catch(() => undefined);
        }
      } catch {
        // Ignore in headless/test environments
      }
    }
    await requestPersistentStorage();
    setPushEnabled(true);
  };

  return (
    <Card className="space-y-3.5" data-testid="engagement-pwa-card">
      {/* Top Header: Streak Counter + Freeze Shield */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FF6B35]/14 text-[#FF6B35]">
            <Flame className="h-5 w-5 fill-[#FF6B35]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate text-sm font-extrabold text-[var(--ink-primary)]">
                {t.m5.streakTitle}
              </h2>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-[#FF6B35]/14 px-2 py-0.5 text-[11px] font-extrabold text-[#FF6B35] tabular-nums">
                {streakEval.streakDays}{' '}
                {isVi ? 'ngày' : streakEval.streakDays === 1 ? 'day' : 'days'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-[var(--ink-secondary)]">
              {streakEval.freezeUsedOnDate ? t.m5.freezeUsedBadge : t.m5.freezeReadyBadge}
            </p>
          </div>
        </div>

        <span
          data-testid="freeze-badge"
          className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-[#3B82F6]/25 bg-[#3B82F6]/10 px-2.5 py-1 text-xs font-extrabold text-[#2563EB]"
        >
          <Snowflake className="h-3.5 w-3.5" />
          <span>{streakEval.remainingFreezesThisWeek}/1</span>
        </span>
      </div>

      {/* 7-Day Visual Momentum Tracker */}
      <div className="grid grid-cols-7 gap-1.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 p-2.5">
        {weekMomentum.map((day) => (
          <div key={day.iso} className="flex flex-col items-center gap-1">
            <span
              className={`text-[10px] font-bold uppercase ${
                day.isToday ? 'text-[var(--ink-primary)]' : 'text-[var(--ink-muted)]'
              }`}
            >
              {day.label}
            </span>
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold transition ${
                day.isFrozen
                  ? 'bg-[#3B82F6]/20 text-[#3B82F6]'
                  : day.isActive
                    ? 'bg-[#FF6B35] text-white'
                    : day.isToday
                      ? 'border-2 border-[#FF6B35] bg-[var(--bg-card)] text-[#FF6B35]'
                      : 'border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-muted)]'
              }`}
            >
              {day.isFrozen ? (
                <Snowflake className="h-3.5 w-3.5" />
              ) : day.isActive ? (
                <Flame className="h-3.5 w-3.5 fill-current" />
              ) : (
                '·'
              )}
            </div>
          </div>
        ))}
      </div>

      {streakEval.showWelcomeBack && (
        <div
          data-testid="welcome-back-banner"
          className="flex items-center gap-2 rounded-2xl bg-[#10B981]/12 px-3 py-2 text-xs font-semibold text-[#065F46]"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-[#10B981]" />
          <span>{t.m5.welcomeBackMsg}</span>
        </div>
      )}

      {streakEval.showQuickCatchUpPrompt && (
        <div
          data-testid="catch-up-banner"
          className="space-y-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-3"
        >
          <p className="text-xs font-bold text-[var(--ink-primary)]">{t.m5.catchUpPromptTitle}</p>
          <p className="text-[11px] text-[var(--ink-secondary)]">{t.m5.catchUpPromptDesc}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ink" size="xs" onClick={openQuickAdd}>
              {t.m5.catchUpQuickBtn}
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setWalletSubTab('wallets');
                setActiveTab('wallets');
              }}
            >
              {t.m5.catchUpReconcileBtn}
            </Button>
          </div>
        </div>
      )}

      {/* Compact 2-Column PWA & Gentle Reminders Row */}
      <div className="space-y-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/50 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-bold text-[var(--ink-primary)]">
            {t.m5.pwaCardTitle}
          </p>
          <span className="shrink-0 text-[10px] font-semibold text-[var(--ink-muted)]">
            {isVi ? 'Offline <1.5s' : 'Offline-ready'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={pwaInstalled ? 'subtle' : 'outline'}
            size="xs"
            fullWidth
            onClick={() => void handleInstallPwa()}
            data-testid="install-pwa-btn"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {pwaInstalled ? t.m5.pwaInstalledBadge : t.m5.pwaInstallBtn}
            </span>
          </Button>
          <Button
            variant={pushEnabled ? 'subtle' : 'ink'}
            size="xs"
            fullWidth
            onClick={() => void handleEnablePush()}
            data-testid="enable-push-btn"
          >
            <Bell className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {pushEnabled ? t.m5.pushEnabledBadge : t.m5.enablePushBtn}
            </span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
