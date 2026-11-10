import type { ReactElement } from 'react';
import type { CategoryDonutReport } from '../../domain/analytics/report-aggregator';
import { DEFAULT_SYSTEM_CATEGORIES } from '../../domain/categories/default-categories';
import { formatMoney } from '../../domain/money/currency';
import { getCategoryDisplayName, useTranslation } from '../../shared/i18n';
import { Card } from '../../shared/ui/Card';
import { CategoryIcon } from '../../shared/ui/CategoryIcon';

export interface DonutChartCardProps {
  report: CategoryDonutReport;
  selectedCategoryId: string | null;
  hideBalances: boolean;
  onSelectCategory: (categoryId: string | null) => void;
}

export function DonutChartCard({
  report,
  selectedCategoryId,
  hideBalances,
  onSelectCategory,
}: DonutChartCardProps): ReactElement {
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;
  const activeSlice =
    report.slices.find((s) => s.categoryId === selectedCategoryId) ?? report.slices[0];

  return (
    <Card>
      <Card.Header bordered>
        <div>
          <h3 className="text-sm font-bold text-[var(--ink-primary)]">{t.m4.donutTitle}</h3>
          <p className="text-[11px] text-[var(--ink-secondary)]">{t.m4.donutSubtitle}</p>
        </div>
        <span
          data-testid="donut-total-expense"
          className="text-base font-extrabold text-[var(--ink-primary)] tabular-nums"
        >
          {formatMoney(report.totalExpenseBaseMinor, 'VND', { hidden: hideBalances })}
        </span>
      </Card.Header>

      <Card.Body className="mt-3">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {/* Interactive SVG Donut Chart */}
          <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
            <svg viewBox="0 0 140 140" className="h-36 w-36 -rotate-90">
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="var(--bg-subtle)"
                strokeWidth="20"
              />
              {report.slices.map((slice) => {
                const dash = (slice.percentage / 100) * circumference;
                const offset = -(cumulativePercent / 100) * circumference;
                cumulativePercent += slice.percentage;
                const isSelected = selectedCategoryId === slice.categoryId;

                return (
                  <circle
                    key={slice.categoryId}
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    stroke={slice.colorHex}
                    strokeWidth={isSelected ? '24' : '20'}
                    strokeDasharray={`${dash} ${circumference}`}
                    strokeDashoffset={offset}
                    className="cursor-pointer transition-all"
                    onClick={() => onSelectCategory(isSelected ? null : slice.categoryId)}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
              <span className="text-base font-extrabold text-[var(--ink-primary)] tabular-nums">
                {activeSlice ? `${activeSlice.percentage}%` : '0%'}
              </span>
              <span className="text-[10px] font-semibold text-[var(--ink-secondary)]">
                {report.slices.length}{' '}
                {isVi
                  ? 'danh mục'
                  : report.slices.length === 1
                    ? 'category'
                    : 'categories'}
              </span>
            </div>
          </div>

          {/* Interactive Category Legend & Drill-Down Triggers */}
          <div className="w-full flex-1 space-y-1.5">
            {report.slices.map((slice) => {
              const cat = DEFAULT_SYSTEM_CATEGORIES.find((c) => c.id === slice.categoryId);
              const displayName = cat ? getCategoryDisplayName(cat, t) : slice.name;
              const isSelected = selectedCategoryId === slice.categoryId;

              return (
                <button
                  key={slice.categoryId}
                  type="button"
                  data-testid={`donut-slice-${slice.slug}`}
                  onClick={() => onSelectCategory(isSelected ? null : slice.categoryId)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-2.5 py-1.5 text-left transition ${
                    isSelected
                      ? 'border-2 border-[#18181B] bg-[var(--accent-pop-soft)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <CategoryIcon slug={slice.slug} colorHex={slice.colorHex} size="sm" />
                    <span className="text-xs font-bold text-[var(--ink-primary)]">
                      {displayName}
                    </span>
                  </div>
                  <div className="text-right tabular-nums">
                    <span className="text-xs font-extrabold text-[var(--ink-primary)]">
                      {formatMoney(slice.amountBaseMinor, 'VND', { hidden: hideBalances })}
                    </span>
                    <span className="ml-1.5 rounded-full bg-[var(--bg-card)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ink-secondary)]">
                      {slice.percentage}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {report.unaccountedExpenseBaseMinor > 0 && (
          <p className="mt-3 rounded-xl bg-[var(--bg-subtle)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink-secondary)]">
            {t.m4.unaccountedNoticePrefix}:{' '}
            <strong>
              {formatMoney(report.unaccountedExpenseBaseMinor, 'VND', { hidden: hideBalances })}
            </strong>
          </p>
        )}
      </Card.Body>
    </Card>
  );
}
