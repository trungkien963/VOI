import { useState, type ReactElement } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUiStore } from '../../app/ui-store';
import { localDb } from '../../db/dexie-schema';
import {
  computeBarChartSeries,
  computeCategoryDonutBreakdown,
  type BarBucketItem,
} from '../../domain/analytics/report-aggregator';
import { generateWeeklyRecap } from '../../domain/analytics/weekly-recap';
import { DEFAULT_SYSTEM_CATEGORIES } from '../../domain/categories/default-categories';
import { formatMoney } from '../../domain/money/currency';
import type { Category } from '../../domain/types/entities';
import { getCategoryDisplayName, useTranslation } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { CategoryIcon } from '../../shared/ui/CategoryIcon';
import { EmptyStateCard } from '../../shared/ui/EmptyStateCard';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';
import { BudgetAndFundsSection } from '../budgets/BudgetAndFundsSection';
import { BarTrendChartCard, type BarChartMode } from './BarTrendChartCard';
import { DonutChartCard } from './DonutChartCard';
import { WeeklyRecapCard } from './WeeklyRecapCard';

type ReportPeriod = 'week' | 'month' | 'all';

export function InsightsView(): ReactElement {
  const { t } = useTranslation();
  const { hideBalances, streakDays } = useUiStore();

  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [barMode, setBarMode] = useState<BarChartMode>('last_8_weeks');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<BarBucketItem | null>(null);

  const transactions = useLiveQuery(() => localDb.transactions.toArray(), [], []);
  const lines = useLiveQuery(() => localDb.transaction_lines.toArray(), [], []);
  const liveCategories = useLiveQuery(() => localDb.categories.toArray(), [], []);
  const allCategories: ReadonlyArray<Category> =
    liveCategories.length > 0
      ? [
          ...DEFAULT_SYSTEM_CATEGORIES,
          ...liveCategories.filter(
            (c) => !DEFAULT_SYSTEM_CATEGORIES.some((sys) => sys.id === c.id),
          ),
        ]
      : DEFAULT_SYSTEM_CATEGORIES;

  const todayIso = new Date().toISOString().slice(0, 10);
  const monthStartIso = `${todayIso.slice(0, 7)}-01`;

  const now = new Date();
  const currentDay = now.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  const weekStartIso = monday.toISOString().slice(0, 10);

  const startDateIso =
    period === 'week' ? weekStartIso : period === 'month' ? monthStartIso : '2000-01-01';
  const endDateIso = '2099-12-31';

  const donutReport = computeCategoryDonutBreakdown(
    transactions,
    lines,
    allCategories,
    startDateIso,
    endDateIso,
  );

  const barBuckets = computeBarChartSeries(transactions, lines, barMode, todayIso);
  const weeklyRecap = generateWeeklyRecap({
    transactions,
    lines,
    categories: allCategories,
    referenceDateIso: todayIso,
    streakDays,
  });

  // Interactive Drill-down transactions (from either Donut slice or Bar bucket)
  const activeSlice = donutReport.slices.find((s) => s.categoryId === selectedCategoryId) ?? null;
  const drillDownIds = new Set<string>(
    selectedBucket ? selectedBucket.transactionIds : activeSlice ? activeSlice.transactionIds : [],
  );
  const drillDownTransactions = transactions.filter((tx) => drillDownIds.has(tx.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[var(--ink-primary)]">{t.insightsTab.title}</h2>
        <SegmentedControl<ReportPeriod>
          ariaLabel={t.insightsTab.title}
          size="sm"
          value={period}
          onChange={(p) => {
            setPeriod(p);
            setSelectedCategoryId(null);
            setSelectedBucket(null);
          }}
          options={[
            { id: 'week', label: t.m4.periodWeek },
            { id: 'month', label: t.m4.periodMonth },
            { id: 'all', label: t.m4.periodAll },
          ]}
        />
      </div>

      <BudgetAndFundsSection referenceDateIso={todayIso} hideBalances={hideBalances} />

      {donutReport.slices.length === 0 ? (
        <EmptyStateCard
          clusterVariant="chart-recap"
          title={t.insightsTab.title}
          subtitle={t.insightsTab.subtitle}
          emptyTitle={t.insightsTab.emptyTitle}
          emptyDesc={t.insightsTab.emptyDesc}
        />
      ) : (
        <>
          <DonutChartCard
            report={donutReport}
            selectedCategoryId={selectedCategoryId}
            hideBalances={hideBalances}
            onSelectCategory={(catId) => {
              setSelectedBucket(null);
              setSelectedCategoryId(catId);
            }}
          />

          <BarTrendChartCard
            mode={barMode}
            onChangeMode={setBarMode}
            buckets={barBuckets}
            selectedBucketId={selectedBucket?.id ?? null}
            hideBalances={hideBalances}
            onSelectBucket={(b) => {
              setSelectedCategoryId(null);
              setSelectedBucket(b);
            }}
          />

          {drillDownTransactions.length > 0 && (
            <Card>
              <Card.Header bordered>
                <h3 className="text-sm font-bold text-[var(--ink-primary)]">
                  {t.m4.drillDownTitle} ({drillDownTransactions.length})
                </h3>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setSelectedCategoryId(null);
                    setSelectedBucket(null);
                  }}
                >
                  {t.m4.clearDrillDownBtn}
                </Button>
              </Card.Header>
              <Card.Body className="mt-2 divide-y divide-[var(--border-hairline)]">
                {drillDownTransactions.map((tx) => {
                  const cat = allCategories.find((c) => c.id === tx.category_id);
                  const catName = cat ? getCategoryDisplayName(cat, t) : (tx.note ?? tx.type);
                  return (
                    <div
                      key={tx.id}
                      data-testid="drilldown-tx-row"
                      className="flex items-center justify-between py-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <CategoryIcon
                          slug={cat?.slug}
                          colorHex={cat?.color_hex ?? '#FF6B35'}
                          txType={tx.type}
                          size="sm"
                        />
                        <div>
                          <p className="text-xs font-bold text-[var(--ink-primary)]">{catName}</p>
                          <p className="text-[11px] text-[var(--ink-secondary)]">
                            {tx.txn_date}
                            {tx.note ? ` · ${tx.note}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-[var(--ink-primary)] tabular-nums">
                        {formatMoney(-Math.abs(tx.amount_minor), tx.currency, {
                          hidden: hideBalances,
                        })}
                      </span>
                    </div>
                  );
                })}
              </Card.Body>
            </Card>
          )}
        </>
      )}

      {period === 'week' && <WeeklyRecapCard recap={weeklyRecap} />}
    </div>
  );
}
