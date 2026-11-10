import { type ReactElement } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUiStore } from '../../app/ui-store';
import { localDb } from '../../db/dexie-schema';
import { outboxSyncEngine } from '../../db/sync/outbox-sync-engine';
import { useTranslation } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { SecurityDataAndFeedbackSection } from './SecurityDataAndFeedbackSection';

export function NotificationsAndSyncSection(): ReactElement {
  const { t } = useTranslation();
  const { notificationPrefs, updateNotificationPrefs, setSyncStatus } = useUiStore();

  const outboxItems = useLiveQuery(() => localDb.sync_outbox.toArray(), [], []);
  const pendingCount = outboxItems.filter((i) => (i.status ?? 'pending') === 'pending').length;
  const failedCount = outboxItems.filter((i) => i.status === 'dead_letter').length;

  const handleSyncNow = async (): Promise<void> => {
    setSyncStatus('syncing');
    const summary = await outboxSyncEngine.flushOutbox();
    setSyncStatus(summary.failedCount > 0 ? 'error' : 'synced');
  };

  const handleRetryFailed = async (): Promise<void> => {
    await outboxSyncEngine.retryFailedItems();
    await handleSyncNow();
  };

  const toggleItems: Array<{
    key:
      | 'dailyReminderEnabled'
      | 'creditCardDueEnabled'
      | 'recurringDueEnabled'
      | 'debtDueEnabled'
      | 'weeklyRecapEnabled';
    label: string;
  }> = [
    { key: 'dailyReminderEnabled', label: t.m5.notifDailyReminder },
    { key: 'creditCardDueEnabled', label: t.m5.notifCreditCardDue },
    { key: 'recurringDueEnabled', label: t.m5.notifRecurringDue },
    { key: 'debtDueEnabled', label: t.m5.notifDebtDue },
    { key: 'weeklyRecapEnabled', label: t.m5.notifWeeklyRecap },
  ];

  return (
    <div className="space-y-5">
      {/* Section 9.3: Notification Toggles & Quiet Hours */}
      <div className="space-y-2.5 border-t border-[var(--border-hairline)] pt-4">
        <div>
          <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
            {t.m5.notificationsTitle}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--ink-secondary)]">{t.m5.notificationsSubtitle}</p>
        </div>

        <div className="space-y-2">
          {toggleItems.map((item) => {
            const checked = notificationPrefs[item.key];
            return (
              <label
                key={item.key}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2.5 text-xs font-semibold text-[var(--ink-primary)]"
              >
                <span>{item.label}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => updateNotificationPrefs({ [item.key]: e.target.checked })}
                  className="h-4 w-4 accent-[#141413]"
                />
              </label>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-2.5">
            <label
              htmlFor="daily-reminder-hour"
              className="block text-[11px] font-semibold text-[var(--ink-secondary)]"
            >
              {t.m5.reminderHourLabel}
            </label>
            <select
              id="daily-reminder-hour"
              value={notificationPrefs.dailyReminderHour}
              onChange={(e) =>
                updateNotificationPrefs({ dailyReminderHour: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2 py-1 text-xs font-bold text-[var(--ink-primary)]"
            >
              {[18, 19, 20, 21].map((hr) => (
                <option key={hr} value={hr}>
                  {String(hr).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-2.5">
            <span className="block text-[11px] font-semibold text-[var(--ink-secondary)]">
              {t.m5.quietHoursLabel}
            </span>
            <p className="mt-1.5 text-xs font-bold text-[var(--ink-primary)] tabular-nums">
              {String(notificationPrefs.quietHoursStart).padStart(2, '0')}:00 –{' '}
              {String(notificationPrefs.quietHoursEnd).padStart(2, '0')}:00
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-[#10B981]/10 px-3 py-2 text-[11px] font-semibold text-[#065F46]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#10B981]" />
          <span>{t.m5.lockScreenPrivacyNote}</span>
        </div>
      </div>

      {/* Section 10: Offline Outbox & Dead-Letter Queue */}
      <div
        className="space-y-2.5 border-t border-[var(--border-hairline)] pt-4"
        data-testid="outbox-sync-panel"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
            {t.m5.outboxSyncTitle}
          </h3>
          <div className="flex items-center gap-1.5">
            {failedCount > 0 && (
              <Button variant="outline" size="xs" onClick={() => void handleRetryFailed()}>
                {t.m5.retryFailedBtn} ({failedCount})
              </Button>
            )}
            <Button
              variant="outline"
              size="xs"
              onClick={() => void handleSyncNow()}
              data-testid="sync-now-btn"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t.m5.syncNowBtn}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-2.5">
            <span className="text-[11px] text-[var(--ink-secondary)]">
              {t.m5.outboxPendingLabel}
            </span>
            <p
              className="mt-0.5 text-sm font-extrabold text-[var(--ink-primary)] tabular-nums"
              data-testid="outbox-pending-count"
            >
              {pendingCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-2.5">
            <span className="text-[11px] text-[var(--ink-secondary)]">
              {t.m5.outboxFailedLabel}
            </span>
            <p
              className="mt-0.5 text-sm font-extrabold text-[var(--ink-primary)] tabular-nums"
              data-testid="outbox-failed-count"
            >
              {failedCount}
            </p>
          </div>
        </div>
      </div>

      {/* Milestone 6: App Lock, Data Portability (CSV/JSON), Sign-Out Guard, 2-Step Delete & Feedback */}
      <SecurityDataAndFeedbackSection />
    </div>
  );
}
