import { useRef, useState, type ChangeEvent, type ReactElement } from 'react';
import { Download, FileJson, Lock, MessageSquareHeart, Trash2, Upload } from 'lucide-react';
import { useSecurityStore } from '../../app/security-store';
import { useUiStore } from '../../app/ui-store';
import { ensureSeedData, localDb } from '../../db/dexie-schema';
import { analyticsTracker } from '../../domain/analytics/analytics-tracker';
import {
  createFullDatabaseSnapshot,
  exportTransactionsToCsv,
  permanentlyDeleteAllUserData,
  restoreFullDatabaseSnapshot,
  type FullDatabaseSnapshot,
} from '../../domain/data-portability/csv-and-snapshot';
import { createSaltedPinRecord } from '../../domain/security/app-lock';
import { useTranslation } from '../../shared/i18n';
import { M6_COPY } from '../../shared/i18n/m6-copy';
import { Button } from '../../shared/ui/Button';
import { AuthAndAccountCard } from '../auth/AuthAndAccountCard';
import { CustomTagsAndCategoriesBox } from './CustomTagsAndCategoriesBox';

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

export function SecurityDataAndFeedbackSection(): ReactElement {
  const { locale } = useTranslation();
  const copy = M6_COPY[locale];
  const { thousandsInputMode, hideBalances, setThousandsInputMode, toggleHideBalances } =
    useUiStore();
  const { baseCurrency, saltedPinRecord, setBaseCurrency, setSaltedPinRecord, lockApp } =
    useSecurityStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pinDraft, setPinDraft] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [deleteStep1, setDeleteStep1] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');

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

  return (
    <div className="space-y-5" data-testid="m6-security-data-section">
      {/* 0. Cloud Login (Google / Email Magic Link) & Safe Sign-Out Guard */}
      <AuthAndAccountCard />

      {statusNotice && (
        <div
          data-testid="m6-status-notice"
          className="rounded-2xl bg-[#10B981]/12 px-3 py-2 text-xs font-bold text-[#065F46]"
        >
          {statusNotice}
        </div>
      )}

      {/* 1. Input & Display Preferences */}
      <div className="space-y-2 border-t border-[var(--border-hairline)] pt-4">
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

      {/* 2. Custom Categories & Tags */}
      <CustomTagsAndCategoriesBox />

      {/* 3. App Lock (Salted PBKDF2/SHA-256 PIN) */}
      <div className="space-y-2 border-t border-[var(--border-hairline)] pt-4">
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
            <Button variant="ink" size="xs" onClick={lockApp} data-testid="lock-now-btn">
              <Lock className="h-3.5 w-3.5" />
              <span>{copy.lockNowBtn}</span>
            </Button>
            <Button variant="outline" size="xs" onClick={() => setSaltedPinRecord(null)}>
              {copy.removePinBtn}
            </Button>
          </div>
        )}
      </div>

      {/* 4. CSV Export, Full JSON Backup & Restore */}
      <div className="space-y-2 border-t border-[var(--border-hairline)] pt-4">
        <h3 className="text-xs font-bold tracking-wider text-[var(--ink-secondary)] uppercase">
          {copy.dataPortabilityTitle}
        </h3>
        <p className="text-xs text-[var(--ink-secondary)]">{copy.dataPortabilitySubtitle}</p>
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

      {/* 5. Feedback & Privacy Policy */}
      <div className="space-y-2 border-t border-[var(--border-hairline)] pt-4">
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
        <p className="text-[11px] text-[var(--ink-muted)]">{copy.privacyPolicyNote}</p>
      </div>

      {/* 6. 2-Step Permanent Account Deletion */}
      <div className="space-y-2 rounded-2xl border border-[#EF4444]/30 bg-[#EF4444]/5 p-3">
        <p className="text-xs font-bold text-[#EF4444]">{copy.deleteAccountTitle}</p>
        <p className="text-[11px] text-[var(--ink-secondary)]">{copy.deleteAccountDesc}</p>
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
            <p className="text-xs font-bold text-[var(--ink-primary)]">{copy.deleteStep2Prompt}</p>
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
              <Button variant="subtle" size="xs" onClick={() => setDeleteStep1(false)}>
                {copy.cancelBtn}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
