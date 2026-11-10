import type { ReactElement } from 'react';
import type { BarBucketItem } from '../../domain/analytics/report-aggregator';
import { formatMoney } from '../../domain/money/currency';
import { useTranslation } from '../../shared/i18n';
import { Card } from '../../shared/ui/Card';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';

export type BarChartMode = 'last_8_weeks' | 'daily_in_month';

export interface BarTrendChartCardProps {
  mode: BarChartMode;
  onChangeMode: (mode: BarChartMode) => void;
  buckets: ReadonlyArray<BarBucketItem>;
  selectedBucketId: string | null;
  hideBalances: boolean;
  onSelectBucket: (bucket: BarBucketItem | null) => void;
}

function formatCompactBarAmount(amountMinor: number): string {
  const abs = Math.abs(amountMinor);
  if (abs >= 1_000_000) {
    return `${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (abs >= 1_000) {
    return `${Math.round(abs / 1_000)}k`;
  }
  return String(abs);
}

export function BarTrendChartCard({
  mode,
  onChangeMode,
  buckets,
  selectedBucketId,
  hideBalances,
  onSelectBucket,
}: BarTrendChartCardProps): ReactElement {
  const { t } = useTranslation();
  const maxExpense = Math.max(1, ...buckets.map((b) => b.expenseBaseMinor));
  const visibleBuckets = mode === 'daily_in_month' ? buckets.slice(-14) : buckets;

  return (
    <Card>
      <Card.Header bordered>
        <h3 className="text-sm font-bold text-[var(--ink-primary)]">{t.m4.barTitle}</h3>
        <SegmentedControl<BarChartMode>
          ariaLabel={t.m4.barTitle}
          size="sm"
          value={mode}
          onChange={onChangeMode}
          options={[
            { id: 'last_8_weeks', label: t.m4.barMode8Weeks },
            { id: 'daily_in_month', label: t.m4.barModeDailyMonth },
          ]}
        />
      </Card.Header>

      <Card.Body className="mt-3">
        <div className="flex h-36 items-end gap-1.5 pt-4">
          {visibleBuckets.map((bucket) => {
            const heightPct =
              bucket.expenseBaseMinor > 0
                ? Math.max(12, Math.round((bucket.expenseBaseMinor / maxExpense) * 100))
                : 4;
            const isSelected = bucket.id === selectedBucketId;

            return (
              <button
                key={bucket.id}
                type="button"
                data-testid={`bar-bucket-${bucket.label}`}
                onClick={() => onSelectBucket(isSelected ? null : bucket)}
                title={`${bucket.label}: ${formatMoney(bucket.expenseBaseMinor, 'VND', { hidden: hideBalances })}`}
                className="group flex flex-1 flex-col items-center gap-1"
              >
                <div className="flex h-28 w-full flex-col items-center justify-end gap-1">
                  {bucket.expenseBaseMinor > 0 && (
                    <span className="text-[9px] font-extrabold text-[var(--ink-secondary)] tabular-nums">
                      {hideBalances ? '•••' : formatCompactBarAmount(bucket.expenseBaseMinor)}
                    </span>
                  )}
                  <div
                    className={`w-full max-w-7 rounded-t-xl transition-all ${
                      isSelected
                        ? 'border-2 border-[#18181B] bg-[#FF6B35]'
                        : bucket.expenseBaseMinor > 0
                          ? 'bg-[#3B82F6] group-hover:bg-[#FF6B35]'
                          : 'bg-[var(--bg-subtle)]'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span
                  className={`text-[10px] font-bold tabular-nums ${
                    isSelected ? 'text-[var(--ink-primary)] underline' : 'text-[var(--ink-muted)]'
                  }`}
                >
                  {bucket.label}
                </span>
              </button>
            );
          })}
        </div>
      </Card.Body>
    </Card>
  );
}

