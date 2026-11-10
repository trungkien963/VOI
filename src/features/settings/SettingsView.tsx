import { useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileJson,
  Lock,
  MessageSquareHeart,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSecurityStore } from '../../app/security-store';
import { useUiStore } from '../../app/ui-store';
import { ensureSeedData, localDb } from '../../db/dexie-schema';
import { onboardingRepository } from '../../db/repositories/onboarding-repository';
import { outboxSyncEngine } from '../../db/sync/outbox-sync-engine';
import { analyticsTracker } from '../../domain/analytics/analytics-tracker';
import {
  createFullDatabaseSnapshot,
  exportTransactionsToCsv,
  permanentlyDeleteAllUserData,
  restoreFullDatabaseSnapshot,
  type FullDatabaseSnapshot,
} from '../../domain/data-portability/csv-and-snapshot';
import {
  evaluateThemeUnlocks,
  type ThemeUnlockRequirement,
} from '../../domain/engagement/streak-and-themes';
import { createSaltedPinRecord } from '../../domain/security/app-lock';
import type {
  ColorMode,
  GeometricShape,
  SupportedLocale,
  ThemeId,
} from '../../domain/types/entities';
import { useTranslation, type TranslationDictionary } from '../../shared/i18n';
import { M6_COPY } from '../../shared/i18n/m6-copy';
import { THEME_LIST } from '../../shared/theme/themes';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { GeometricBuddy } from '../../shared/ui/GeometricBuddy';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';
import { AuthAndAccountCard } from '../auth/AuthAndAccountCard';
import { CustomTagsAndCategoriesBox } from './CustomTagsAndCategoriesBox';

type SettingsSectionId =
  'account_sync' | 'appearance' | 'categories_prefs' | 'notifications' | 'security_data';

function triggerBrowserDownload(filename: string, content: string, mimeType: string): void {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') return;
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // Ignore in headless test environments
  }
}

function getThemeCopy(
  themeId: ThemeId,
  dict: TranslationDictionary,
): { name: string; description: string } {
  switch (themeId) {
    case 'pop':
      return { name: dict.themes.popName, description: dict.themes.popDesc };
    case 'cobalt':
      return { name: dict.themes.cobaltName, description: dict.themes.cobaltDesc };
    case 'matcha':
      return { name: dict.themes.matchaName, description: dict.themes.matchaDesc };
    case 'flamingo':
      return { name: dict.themes.flamingoName, description: dict.themes.flamingoDesc };
    case 'sunny':
      return { name: dict.themes.sunnyName, description: dict.themes.sunnyDesc };
  }
}

function getUnlockRequirementLabel(
  req: ThemeUnlockRequirement,
  dict: TranslationDictionary,
): string {
  switch (req) {
    case 'default':
      return dict.m5.themeUnlockDefault;
    case 'streak_3':
      return dict.m5.themeUnlockStreak3;
    case 'streak_7':
      return dict.m5.themeUnlockStreak7;
    case 'streak_30_or_checklist':
      return dict.m5.themeUnlockStreak30OrChecklist;
  }
}

export function SettingsView(): ReactElement {
  const {
    themeId,
    colorMode,
    streakDays,
    maxStreakDays,
    thousandsInputMode,
    hideBalances,
    notificationPrefs,
    setThemeId,
    setColorMode,
    setActiveTab,
    setThousandsInputMode,
    toggleHideBalances,
    updateNotificationPrefs,
    setSyncStatus,
  } = useUiStore();
  const { baseCurrency, saltedPinRecord, setBaseCurrency, setSaltedPinRecord, lockApp } =
    useSecurityStore();
  const { t, locale, setLocale } = useTranslation();
  const isVi = locale === 'vi';
  const copy = M6_COPY[locale];

  const [openSection, setOpenSection] = useState<SettingsSectionId | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pinDraft, setPinDraft] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [deleteStep1, setDeleteStep1] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');

  const categoryCount = useLiveQuery(() => localDb.categories.count(), [], 0);
  const checklistState = useLiveQuery(() => onboardingRepository.getStateReadOnly(), [], null);
  const outboxItems = useLiveQuery(() => localDb.sync_outbox.toArray(), [], []);
  const pendingCount = outboxItems.filter((i) => (i.status ?? 'pending') === 'pending').length;
  const failedCount = outboxItems.filter((i) => i.status === 'dead_letter').length;

  const themeUnlocks = evaluateThemeUnlocks({
    streakDays,
    maxStreakDays,
    checklistCompleted: Boolean(checklistState?.completed_at),
  });

  const toggleSection = (id: SettingsSectionId): void => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  const handleSyncNow = async (): Promise<void> => {
    setSyncStatus('syncing');
    const summary = await outboxSyncEngine.flushOutbox();
    setSyncStatus(summary.failedCount > 0 ? 'error' : 'synced');
  };

  const handleRetryFailed = async (): Promise<void> => {
    await outboxSyncEngine.retryFailedItems();
    await handleSyncNow();
  };

  const handleSetPin = async (): Promise<void> => {
    if (!/^\d{4,8}$/.test(pinDraft.trim())) return;
    const record = await createSaltedPinRecord(pinDraft.trim());
    setSaltedPinRecord(record);
    setPinDraft('');
    setStatusNotice(copy.pinSetSuccess);
  };

  const handleExportCsv = async (): Promise<void> => {
    const [transactions, lines, accounts, categories, tags, transactionTags] = await Promise.all([
      localDb.transactions.toArray(),
      localDb.transaction_lines.toArray(),
      localDb.accounts.toArray(),
      localDb.categories.toArray(),
      localDb.tags.toArray(),
      localDb.transaction_tags.toArray(),
    ]);
    const csv = exportTransactionsToCsv({
      transactions,
      lines,
      accounts,
      categories,
      tags,
      transactionTags,
    });
    triggerBrowserDownload(
      `fn-app-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      'text/csv;charset=utf-8;',
    );
    setStatusNotice(copy.exportSuccessMsg);
  };

  const handleExportJson = async (): Promise<void> => {
    const snapshot = await createFullDatabaseSnapshot(localDb);
    triggerBrowserDownload(
      `fn-app-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(snapshot, null, 2),
      'application/json',
    );
    setStatusNotice(copy.exportSuccessMsg);
  };

  const handleImportJsonFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as FullDatabaseSnapshot;
      await restoreFullDatabaseSnapshot(localDb, parsed);
      setStatusNotice(copy.restoreSuccessMsg);
    } catch {
      setStatusNotice('Invalid JSON snapshot file');
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmDeleteAccount = async (): Promise<void> => {
    const res = await permanentlyDeleteAllUserData(localDb, deleteStep1, deleteConfirmText);
    if (res.deleted) {
      await ensureSeedData(localDb);
      setDeleteStep1(false);
      setDeleteConfirmText('');
      setStatusNotice(copy.accountDeletedMsg);
    }
  };

  const handleSendFeedback = (): void => {
    if (!feedbackText.trim()) return;
    analyticsTracker.track('feedback_submitted', {
      length_bucket: feedbackText.length > 50 ? 'long' : 'short',
    });
    setFeedbackText('');
    setStatusNotice(copy.feedbackThanksMsg);
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

  const categoriesMenu: Array<{
    id: SettingsSectionId;
    title: string;
    subtitle: string;
    badge?: string;
    shape: GeometricShape;
    colorHex: string;
  }> = [
    {
      id: 'account_sync',
      title: isVi ? 'Tài khoản & Đồng bộ Đám mây' : 'Account & Cloud Sync',
      subtitle: isVi
        ? 'Đăng nhập Google / Magic Link & đẩy dữ liệu lên Supabase'
        : 'Sign in with Google / Magic Link & sync to Supabase Cloud',
      badge: pendingCount > 0 ? `${pendingCount} pending` : 'Synced',
      shape: 'hexagon',
      colorHex: '#3B82F6',
    },
    {
      id: 'appearance',
      title: isVi ? 'Giao diện, Chủ đề & Ngôn ngữ' : 'Appearance, Theme & Language',
      subtitle: isVi
        ? 'Tiếng Việt / English, Chế độ Sáng / Tối & 5 màu Geometric Pop'
        : 'Language, Light / Dark mode & 5 Geometric Pop accents',
      badge: locale.toUpperCase(),
      shape: 'triangle',
      colorHex: '#FF6B35',
    },
    {
      id: 'categories_prefs',
      title: isVi ? 'Danh mục, Nhãn & Tuỳ chọn Nhập' : 'Categories, Tags & Input Mode',
      subtitle: isVi
        ? 'Tạo danh mục riêng, #tag, phím tắt .000đ & tiền tệ gốc'
        : 'Custom categories, #tags, .000 shortcut & base currency',
      badge: `${categoryCount} ${t.settings.categoriesCountSuffix}`,
      shape: 'square',
      colorHex: '#10B981',
    },
    {
      id: 'notifications',
      title: isVi ? 'Thông báo & Giờ yên tĩnh' : 'Gentle Reminders & Quiet Hours',
      subtitle: isVi
        ? 'Nhắc ghi chi tiêu buổi tối, hạn thẻ tín dụng & hoá đơn định kỳ'
        : 'Daily evening reminder, credit card due & recurring bill alerts',
      badge: `${String(notificationPrefs.dailyReminderHour).padStart(2, '0')}:00`,
      shape: 'pentagon',
      colorHex: '#F472B6',
    },
    {
      id: 'security_data',
      title: isVi ? 'Bảo mật, Sao lưu CSV/JSON & Dữ liệu' : 'Security, Backup & Data Reset',
      subtitle: isVi
        ? 'Khoá ứng dụng bằng PIN, Xuất CSV / Backup JSON & Xoá dữ liệu'
        : 'App Lock PIN, Export CSV / JSON Snapshot & Reset data',
      badge: saltedPinRecord ? (isVi ? 'Đã bật PIN' : 'PIN Active') : undefined,
      shape: 'circle',
      colorHex: '#8B5CF6',
    },
  ];

  return (
    <div className="space-y-3" aria-labelledby="settings-heading">
      <Card>
        <Card.Header>
          <div>
            <h2 id="settings-heading" className="text-base font-bold text-[var(--ink-primary)]">
              {t.settings.title}
            </h2>
            <p className="text-xs text-[var(--ink-secondary)]">
              {isVi
                ? 'Chọn từng danh mục bên dưới để mở cài đặt chi tiết.'
                : 'Tap any category below to expand its settings.'}
            </p>
          </div>
          <Button variant="outline" size="xs" onClick={() => setActiveTab('home')}>
            {t.settings.backHomeBtn}
          </Button>
        </Card.Header>
      </Card>

      {statusNotice && (
        <div
          data-testid="m6-status-notice"
          className="rounded-2xl bg-[#10B981]/12 px-3.5 py-2.5 text-xs font-bold text-[#065F46]"
        >
          {statusNotice}
        </div>
      )}

      {/* 5 Collapsible Category Cards */}
      {categoriesMenu.map((cat) => {
        const isOpen = openSection === cat.id;
        return (
          <Card key={cat.id} className="overflow-hidden">
            <button
              type="button"
              data-testid={`settings-category-${cat.id}`}
              aria-expanded={isOpen}
              onClick={() => toggleSection(cat.id)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="flex min-w-0 items-center gap-3">
                <GeometricBuddy
                  shape={cat.shape}
                  colorHex={cat.colorHex}
                  mood={isOpen ? 'excited' : 'happy'}
                  size={40}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-extrabold text-[var(--ink-primary)]">
                      {cat.title}
                    </span>
                    {cat.badge && (
                      <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-secondary)]">
                        {cat.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink-secondary)]">
                    {cat.subtitle}
                  </p>
                </div>
              </div>

              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--ink-primary)]">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
            </button>

            {isOpen && (
              <div className="mt-4 space-y-4 border-t border-[var(--border-hairline)] pt-4">
                {/* 1. ACCOUNT & CLOUD SYNC */}
                {cat.id === 'account_sync' && (
                  <>
                    <AuthAndAccountCard />

                    <div className="space-y-2.5" data-testid="outbox-sync-panel">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
                          {t.m5.outboxSyncTitle}
                        </h3>
                        <div className="flex items-center gap-1.5">
                          {failedCount > 0 && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => void handleRetryFailed()}
                            >
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
                  </>
                )}

                {/* 2. APPEARANCE, THEME & LANGUAGE */}
                {cat.id === 'appearance' && (
                  <>
                    <div>
                      <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
                        {t.settings.languageTitle}
                      </h3>
                      <SegmentedControl<SupportedLocale>
                        ariaLabel={t.settings.languageTitle}
                        value={locale}
                        onChange={setLocale}
                        className="mt-2 w-full"
                        options={[
                          { id: 'en', label: t.settings.langEn },
                          { id: 'vi', label: t.settings.langVi },
                        ]}
                      />
                    </div>

                    <div>
                      <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
                        {t.settings.colorModeTitle}
                      </h3>
                      <SegmentedControl<ColorMode>
                        ariaLabel={t.settings.colorModeTitle}
                        value={colorMode}
                        onChange={setColorMode}
                        className="mt-2 w-full"
                        options={[
                          { id: 'light', label: t.settings.modeLight },
                          { id: 'dark', label: t.settings.modeDark },
                          { id: 'system', label: t.settings.modeSystem },
                        ]}
                      />
                    </div>

                    <div>
                      <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
                        {t.settings.themePresetTitle}
                      </h3>
                      <div className="mt-2.5 space-y-2">
                        {THEME_LIST.map((preset) => {
                          const isSelected = themeId === preset.id;
                          const themeCopy = getThemeCopy(preset.id, t);
                          const unlockInfo = themeUnlocks[preset.id];
                          const isUnlocked = unlockInfo.unlocked;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              disabled={!isUnlocked}
                              data-testid={`theme-preset-${preset.id}`}
                              onClick={() => {
                                if (isUnlocked) {
                                  setThemeId(preset.id as ThemeId);
                                }
                              }}
                              className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left transition ${
                                isSelected
                                  ? 'border-[#141413] bg-[var(--bg-subtle)]'
                                  : isUnlocked
                                    ? 'border-[var(--border-hairline)] bg-[var(--bg-card)] hover:border-[var(--border-strong)]'
                                    : 'cursor-not-allowed border-[var(--border-hairline)] bg-[var(--bg-subtle)]/40 opacity-70'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <GeometricBuddy
                                  shape={preset.buddyShape}
                                  colorHex={preset.accentHex}
                                  mood={isSelected ? 'excited' : 'happy'}
                                  size={40}
                                />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-bold text-[var(--ink-primary)]">
                                      {themeCopy.name}
                                    </p>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        isUnlocked
                                          ? 'bg-[#10B981]/12 text-[#10B981]'
                                          : 'bg-[#71717A]/15 text-[var(--ink-secondary)]'
                                      }`}
                                    >
                                      {isUnlocked ? t.m5.themeUnlockedBadge : t.m5.themeLockedBadge}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[var(--ink-secondary)]">
                                    {themeCopy.description}
                                  </p>
                                  <p className="mt-0.5 text-[11px] font-medium text-[var(--ink-muted)]">
                                    {getUnlockRequirementLabel(unlockInfo.requirement, t)}
                                  </p>
                                </div>
                              </div>
                              {isSelected ? (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#141413] text-white">
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              ) : !isUnlocked ? (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--ink-secondary)]">
                                  <Lock className="h-3.5 w-3.5" />
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* 3. CATEGORIES, TAGS & INPUT PREFERENCES */}
                {cat.id === 'categories_prefs' && (
                  <>
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
                        {copy.preferencesTitle}
                      </h3>
                      <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2.5 text-xs font-semibold text-[var(--ink-primary)]">
                        <span>{copy.thousandsModeLabel}</span>
                        <input
                          type="checkbox"
                          checked={thousandsInputMode}
                          onChange={(e) => setThousandsInputMode(e.target.checked)}
                          className="h-4 w-4 accent-[#141413]"
                        />
                      </label>
                      <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2.5 text-xs font-semibold text-[var(--ink-primary)]">
                        <span>{copy.hideBalancesDefaultLabel}</span>
                        <input
                          type="checkbox"
                          checked={hideBalances}
                          onChange={toggleHideBalances}
                          className="h-4 w-4 accent-[#141413]"
                        />
                      </label>
                      <div className="flex items-center justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--ink-primary)]">
                        <span>{copy.baseCurrencyLabel}</span>
                        <select
                          aria-label={copy.baseCurrencyLabel}
                          value={baseCurrency}
                          onChange={(e) => setBaseCurrency(e.target.value as 'VND' | 'USD')}
                          className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-bold"
                        >
                          <option value="VND">VND (₫)</option>
                          <option value="USD">USD ($)</option>
                        </select>
                      </div>
                    </div>

                    <CustomTagsAndCategoriesBox />
                  </>
                )}

                {/* 4. NOTIFICATIONS & QUIET HOURS */}
                {cat.id === 'notifications' && (
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--ink-secondary)]">
                      {t.m5.notificationsSubtitle}
                    </p>
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
                              onChange={(e) =>
                                updateNotificationPrefs({ [item.key]: e.target.checked })
                              }
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
                )}

                {/* 5. SECURITY, BACKUP & DATA */}
                {cat.id === 'security_data' && (
                  <div className="space-y-4" data-testid="m6-security-data-section">
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
                        {copy.appLockTitle}
                      </h3>
                      <p className="text-xs text-[var(--ink-secondary)]">{copy.appLockSubtitle}</p>
                      {!saltedPinRecord ? (
                        <div className="flex gap-2">
                          <input
                            type="password"
                            inputMode="numeric"
                            value={pinDraft}
                            onChange={(e) => setPinDraft(e.target.value)}
                            placeholder={copy.pinPlaceholder}
                            aria-label={copy.pinPlaceholder}
                            data-testid="setup-pin-input"
                            className="flex-1 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-bold"
                          />
                          <Button
                            variant="ink"
                            size="xs"
                            onClick={() => void handleSetPin()}
                            data-testid="setup-pin-btn"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            <span>{copy.setPinBtn}</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="ink"
                            size="xs"
                            onClick={lockApp}
                            data-testid="lock-now-btn"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            <span>{copy.lockNowBtn}</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setSaltedPinRecord(null)}
                          >
                            {copy.removePinBtn}
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
                      <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
                        {copy.dataPortabilityTitle}
                      </h3>
                      <p className="text-xs text-[var(--ink-secondary)]">
                        {copy.dataPortabilitySubtitle}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ink"
                          size="xs"
                          onClick={() => void handleExportCsv()}
                          data-testid="export-csv-btn"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>{copy.exportCsvBtn}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => void handleExportJson()}
                          data-testid="export-json-btn"
                        >
                          <FileJson className="h-3.5 w-3.5" />
                          <span>{copy.exportJsonBtn}</span>
                        </Button>
                        <Button
                          variant="subtle"
                          size="xs"
                          onClick={() => fileInputRef.current?.click()}
                          data-testid="restore-json-btn"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>{copy.importJsonLabel}</span>
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json,application/json"
                          onChange={(e) => void handleImportJsonFile(e)}
                          className="hidden"
                          data-testid="restore-json-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-[var(--border-hairline)] pt-3">
                      <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
                        {copy.feedbackTitle}
                      </h3>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder={copy.feedbackPlaceholder}
                          aria-label={copy.feedbackPlaceholder}
                          data-testid="feedback-input"
                          className="flex-1 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs"
                        />
                        <Button
                          variant="ink"
                          size="xs"
                          onClick={handleSendFeedback}
                          data-testid="send-feedback-btn"
                        >
                          <MessageSquareHeart className="h-3.5 w-3.5" />
                          <span>{copy.sendFeedbackBtn}</span>
                        </Button>
                      </div>
                      <p className="text-[11px] text-[var(--ink-muted)]">
                        {copy.privacyPolicyNote}
                      </p>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/5 p-3">
                      <p className="text-xs font-bold text-[#EF4444]">{copy.deleteAccountTitle}</p>
                      <p className="text-[11px] text-[var(--ink-secondary)]">
                        {copy.deleteAccountDesc}
                      </p>
                      {!deleteStep1 ? (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setDeleteStep1(true)}
                          data-testid="delete-account-step1-btn"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-[#EF4444]" />
                          <span className="text-[#EF4444]">{copy.deleteStep1Btn}</span>
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-[var(--ink-primary)]">
                            {copy.deleteStep2Prompt}
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={deleteConfirmText}
                              onChange={(e) => setDeleteConfirmText(e.target.value)}
                              placeholder="DELETE"
                              aria-label="DELETE confirmation"
                              data-testid="delete-account-confirm-input"
                              className="w-32 rounded-xl border border-[#EF4444] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-bold"
                            />
                            <Button
                              variant="ink"
                              size="xs"
                              onClick={() => void handleConfirmDeleteAccount()}
                              data-testid="delete-account-confirm-btn"
                            >
                              {copy.deleteConfirmBtn}
                            </Button>
                            <Button
                              variant="subtle"
                              size="xs"
                              onClick={() => setDeleteStep1(false)}
                            >
                              {copy.cancelBtn}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
