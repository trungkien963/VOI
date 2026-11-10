import { SYSTEM_CATEGORY_IDS } from '../categories/default-categories';
import { clampDayOfMonth, formatIsoDateUtc } from '../ledger/credit-card-calculator';
import type { Category, GeometricShape, Transaction, TransactionLine } from '../types/entities';

export interface CategoryBreakdownSlice {
  categoryId: string;
  slug: string;
  name: string;
  iconName: GeometricShape;
  colorHex: string;
  amountBaseMinor: number;
  percentage: number;
  transactionIds: string[];
}

export interface CategoryDonutReport {
  totalExpenseBaseMinor: number;
  totalIncomeBaseMinor: number;
  unaccountedExpenseBaseMinor: number;
  unaccountedIncomeBaseMinor: number;
  slices: CategoryBreakdownSlice[];
}

export interface BarBucketItem {
  id: string;
  label: string;
  startDateIso: string;
  endDateIso: string;
  expenseBaseMinor: number;
  incomeBaseMinor: number;
  transactionIds: string[];
}

export interface MonthComparisonSummary {
  currentMonthToDateMinor: number;
  previousMonthSamePeriodMinor: number;
  deltaMinor: number;
  deltaPercentage: number | null;
  trend: 'lower' | 'higher' | 'same';
}

function getLineBaseAbs(line: TransactionLine): number {
  return Math.abs(line.amount_base_minor ?? line.signed_amount_minor);
}

/**
 * Section 5.1, 5.7 & 8.9: Computes Donut chart breakdown by category for a date range.
 * - Uses historical `amount_base_minor` on `transaction_lines`.
 * - Excludes `opening_balance`, `transfer`, `credit_card_payment`, `debt_*`.
 * - Tracks `adjustment` ("Không nhớ rõ" / "Thu nhập không rõ") separately while including it in totals.
 */
export function computeCategoryDonutBreakdown(
  transactions: ReadonlyArray<Transaction>,
  lines: ReadonlyArray<TransactionLine>,
  categories: ReadonlyArray<Category>,
  startDateIso: string,
  endDateIso: string,
): CategoryDonutReport {
  const validTxs = transactions.filter(
    (tx) =>
      tx.voided_at === null &&
      tx.status !== 'void' &&
      tx.txn_date >= startDateIso &&
      tx.txn_date <= endDateIso,
  );

  const txById = new Map<string, Transaction>(validTxs.map((t) => [t.id, t]));
  const catById = new Map<string, Category>(categories.map((c) => [c.id, c]));

  let totalExpenseBaseMinor = 0;
  let totalIncomeBaseMinor = 0;
  let unaccountedExpenseBaseMinor = 0;
  let unaccountedIncomeBaseMinor = 0;

  const bucketMap = new Map<
    string,
    { amountBaseMinor: number; txIds: Set<string>; category: Category | null }
  >();

  for (const line of lines) {
    if (line.deleted_at) continue;
    const tx = txById.get(line.transaction_id);
    if (!tx) continue;

    const absBase = getLineBaseAbs(line);

    const isExpense =
      tx.type === 'expense' ||
      tx.type === 'credit_card_spend' ||
      (tx.type === 'adjustment' && line.signed_amount_minor < 0);

    const isIncome =
      tx.type === 'income' ||
      tx.type === 'credit_card_refund' ||
      (tx.type === 'adjustment' && line.signed_amount_minor > 0);

    if (isIncome) {
      totalIncomeBaseMinor += absBase;
      if (tx.type === 'adjustment') {
        unaccountedIncomeBaseMinor += absBase;
      }
      continue;
    }

    if (!isExpense) continue;

    totalExpenseBaseMinor += absBase;
    if (tx.type === 'adjustment') {
      unaccountedExpenseBaseMinor += absBase;
    }

    const fallbackCatId =
      tx.type === 'adjustment'
        ? SYSTEM_CATEGORY_IDS.unknownExpense
        : SYSTEM_CATEGORY_IDS.foodDining;
    const catId = tx.category_id ?? fallbackCatId;
    const cat = catById.get(catId) ?? null;

    const existing = bucketMap.get(catId);
    if (existing) {
      existing.amountBaseMinor += absBase;
      existing.txIds.add(tx.id);
    } else {
      bucketMap.set(catId, {
        amountBaseMinor: absBase,
        txIds: new Set([tx.id]),
        category: cat,
      });
    }
  }

  const slices: CategoryBreakdownSlice[] = Array.from(bucketMap.entries())
    .map(([categoryId, data]) => {
      const cat = data.category;
      const pct =
        totalExpenseBaseMinor > 0
          ? Number(((data.amountBaseMinor / totalExpenseBaseMinor) * 100).toFixed(1))
          : 0;
      return {
        categoryId,
        slug: cat?.slug ?? 'food-dining',
        name: cat?.name ?? 'Other',
        iconName: cat?.icon_name ?? 'triangle',
        colorHex: cat?.color_hex ?? '#FF6B35',
        amountBaseMinor: data.amountBaseMinor,
        percentage: pct,
        transactionIds: Array.from(data.txIds),
      };
    })
    .sort((a, b) => b.amountBaseMinor - a.amountBaseMinor);

  return {
    totalExpenseBaseMinor,
    totalIncomeBaseMinor,
    unaccountedExpenseBaseMinor,
    unaccountedIncomeBaseMinor,
    slices,
  };
}

/**
 * Section 8.9: Computes Bar Chart series for either `'last_8_weeks'` or `'daily_in_month'`.
 */
export function computeBarChartSeries(
  transactions: ReadonlyArray<Transaction>,
  lines: ReadonlyArray<TransactionLine>,
  mode: 'last_8_weeks' | 'daily_in_month',
  referenceDateIso: string = new Date().toISOString().slice(0, 10),
): BarBucketItem[] {
  const buckets: BarBucketItem[] = [];
  const parts = referenceDateIso.slice(0, 10).split('-').map(Number);
  const refYear = parts[0] ?? 2026;
  const refMonth = parts[1] ?? 1;
  const refDay = parts[2] ?? 1;

  if (mode === 'daily_in_month') {
    const daysInMonth = clampDayOfMonth(refYear, refMonth, 31);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateIso = formatIsoDateUtc(refYear, refMonth, d);
      buckets.push({
        id: dateIso,
        label: String(d).padStart(2, '0'),
        startDateIso: dateIso,
        endDateIso: dateIso,
        expenseBaseMinor: 0,
        incomeBaseMinor: 0,
        transactionIds: [],
      });
    }
  } else {
    const refUtc = new Date(Date.UTC(refYear, refMonth - 1, refDay));
    const dayOfWeek = refUtc.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const currentMondayUtc = new Date(Date.UTC(refYear, refMonth - 1, refDay + mondayOffset));

    for (let w = 7; w >= 0; w--) {
      const wkStart = new Date(currentMondayUtc);
      wkStart.setUTCDate(currentMondayUtc.getUTCDate() - w * 7);
      const wkEnd = new Date(wkStart);
      wkEnd.setUTCDate(wkStart.getUTCDate() + 6);

      const startIso = wkStart.toISOString().slice(0, 10);
      const endIso = wkEnd.toISOString().slice(0, 10);
      const label = `${startIso.slice(8, 10)}/${startIso.slice(5, 7)}`;
      buckets.push({
        id: `${startIso}..${endIso}`,
        label,
        startDateIso: startIso,
        endDateIso: endIso,
        expenseBaseMinor: 0,
        incomeBaseMinor: 0,
        transactionIds: [],
      });
    }
  }

  const validTxs = transactions.filter((tx) => tx.voided_at === null && tx.status !== 'void');
  const txById = new Map<string, Transaction>(validTxs.map((t) => [t.id, t]));

  for (const line of lines) {
    if (line.deleted_at) continue;
    const tx = txById.get(line.transaction_id);
    if (!tx) continue;

    const bucket = buckets.find(
      (b) => tx.txn_date >= b.startDateIso && tx.txn_date <= b.endDateIso,
    );
    if (!bucket) continue;

    const absBase = getLineBaseAbs(line);
    const isExpense =
      tx.type === 'expense' ||
      tx.type === 'credit_card_spend' ||
      (tx.type === 'adjustment' && line.signed_amount_minor < 0);
    const isIncome =
      tx.type === 'income' ||
      tx.type === 'credit_card_refund' ||
      (tx.type === 'adjustment' && line.signed_amount_minor > 0);

    if (isExpense) {
      bucket.expenseBaseMinor += absBase;
      if (!bucket.transactionIds.includes(tx.id)) {
        bucket.transactionIds.push(tx.id);
      }
    } else if (isIncome) {
      bucket.incomeBaseMinor += absBase;
    }
  }

  return buckets;
}

/**
 * Section 8.3: Gentle Month-over-Month comparison for the same day range (1..dayOfMonth).
 */
export function computeMonthOverMonthComparison(
  transactions: ReadonlyArray<Transaction>,
  lines: ReadonlyArray<TransactionLine>,
  categories: ReadonlyArray<Category>,
  todayIso: string = new Date().toISOString().slice(0, 10),
): MonthComparisonSummary {
  const parts = todayIso.slice(0, 10).split('-').map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;

  const curStart = formatIsoDateUtc(year, month, 1);
  const curEnd = formatIsoDateUtc(year, month, day);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevStart = formatIsoDateUtc(prevYear, prevMonth, 1);
  const prevEnd = formatIsoDateUtc(prevYear, prevMonth, clampDayOfMonth(prevYear, prevMonth, day));

  const curReport = computeCategoryDonutBreakdown(
    transactions,
    lines,
    categories,
    curStart,
    curEnd,
  );
  const prevReport = computeCategoryDonutBreakdown(
    transactions,
    lines,
    categories,
    prevStart,
    prevEnd,
  );

  const currentMonthToDateMinor = curReport.totalExpenseBaseMinor;
  const previousMonthSamePeriodMinor = prevReport.totalExpenseBaseMinor;
  const deltaMinor = currentMonthToDateMinor - previousMonthSamePeriodMinor;

  const deltaPercentage =
    previousMonthSamePeriodMinor > 0
      ? Number(((deltaMinor / previousMonthSamePeriodMinor) * 100).toFixed(1))
      : null;

  const trend = deltaMinor < 0 ? 'lower' : deltaMinor > 0 ? 'higher' : 'same';

  return {
    currentMonthToDateMinor,
    previousMonthSamePeriodMinor,
    deltaMinor,
    deltaPercentage,
    trend,
  };
}
