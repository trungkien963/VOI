/**
 * FN-APP Phase 1 — Privacy-Safe Analytics Adapter (Section 10 & Section 11)
 *
 * Enforces Zero PII / Financial Leak:
 * Never logs or dispatches money amounts, notes, counterparty names, or personal identifiers.
 */

export type AnalyticsEventName =
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'pwa_installed'
  | 'notification_permission_result'
  | 'transaction_created'
  | 'quick_input_parse_failed'
  | 'transaction_edited'
  | 'transaction_deleted'
  | 'reconcile_done'
  | 'checklist_item_completed'
  | 'streak_updated'
  | 'streak_broken'
  | 'recap_opened'
  | 'recap_shared'
  | 'theme_changed'
  | 'feedback_submitted';

export interface AnalyticsEventRecord {
  event: AnalyticsEventName;
  metadata: Record<string, string | number | boolean | null>;
  timestampIso: string;
}

const FORBIDDEN_SENSITIVE_KEYS = new Set([
  'amount',
  'amount_minor',
  'base_amount_minor',
  'actual_balance',
  'actual_balance_minor',
  'app_balance_minor',
  'delta_minor',
  'note',
  'raw_input_text',
  'counterparty',
  'counterparty_name',
  'name',
  'title',
  'phone',
  'email',
  'pin',
]);

/**
 * Strips any sensitive financial or PII fields before recording an analytics event.
 */
export function sanitizeAnalyticsMetadata(
  raw?: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  if (!raw) return {};
  const clean: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();
    if (
      FORBIDDEN_SENSITIVE_KEYS.has(lowerKey) ||
      lowerKey.includes('amount') ||
      lowerKey.includes('balance') ||
      lowerKey.includes('note') ||
      lowerKey.includes('name')
    ) {
      continue;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      clean[key] = value;
    }
  }

  return clean;
}

export class PrivacySafeAnalyticsTracker {
  private readonly history: AnalyticsEventRecord[] = [];

  public track(
    event: AnalyticsEventName,
    rawMetadata?: Record<string, unknown>,
  ): AnalyticsEventRecord {
    const record: AnalyticsEventRecord = {
      event,
      metadata: sanitizeAnalyticsMetadata(rawMetadata),
      timestampIso: new Date().toISOString(),
    };
    this.history.push(record);
    return record;
  }

  /**
   * Section 11: `reconcile_done` sends percentage difference (`delta_pct`), NEVER exact money amounts.
   */
  public trackReconcileDone(params: {
    appBalanceMinor: number;
    actualBalanceMinor: number;
  }): AnalyticsEventRecord {
    const denominator = Math.max(1, Math.abs(params.appBalanceMinor));
    const deltaMinor = params.actualBalanceMinor - params.appBalanceMinor;
    const deltaPct = Math.round((Math.abs(deltaMinor) / denominator) * 10000) / 100;

    return this.track('reconcile_done', {
      delta_pct: deltaPct,
      direction: deltaMinor === 0 ? 'exact' : deltaMinor > 0 ? 'surplus' : 'deficit',
    });
  }

  public getEvents(): readonly AnalyticsEventRecord[] {
    return this.history;
  }

  public clearEvents(): void {
    this.history.length = 0;
  }
}

export const analyticsTracker = new PrivacySafeAnalyticsTracker();
