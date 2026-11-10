import { formatMoney } from '../money/currency';
import type { Category, SupportedLocale, Transaction, TransactionLine } from '../types/entities';
import { computeCategoryDonutBreakdown, type CategoryBreakdownSlice } from './report-aggregator';

export interface WeeklyRecapSummary {
  weekStartIso: string;
  weekEndIso: string;
  totalExpenseBaseMinor: number;
  previousWeekExpenseBaseMinor: number;
  deltaPercentage: number | null;
  topCategories: CategoryBreakdownSlice[];
  streakDays: number;
  quoteEn: string;
  quoteVi: string;
}

/**
 * Section 8.10: Rule-based Weekly Recap generator (total spent, top 3 categories,
 * comparison vs. previous week, streak, and a cheerful non-judgmental template quote).
 */
export function generateWeeklyRecap(params: {
  transactions: ReadonlyArray<Transaction>;
  lines: ReadonlyArray<TransactionLine>;
  categories: ReadonlyArray<Category>;
  referenceDateIso?: string;
  streakDays?: number;
}): WeeklyRecapSummary {
  const refIso = params.referenceDateIso ?? new Date().toISOString().slice(0, 10);
  const parts = refIso.slice(0, 10).split('-').map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;

  const refUtc = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = refUtc.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekStartUtc = new Date(Date.UTC(year, month - 1, day + mondayOffset));
  const weekEndUtc = new Date(weekStartUtc);
  weekEndUtc.setUTCDate(weekStartUtc.getUTCDate() + 6);

  const prevWeekStartUtc = new Date(weekStartUtc);
  prevWeekStartUtc.setUTCDate(weekStartUtc.getUTCDate() - 7);
  const prevWeekEndUtc = new Date(weekStartUtc);
  prevWeekEndUtc.setUTCDate(weekStartUtc.getUTCDate() - 1);

  const weekStartIso = weekStartUtc.toISOString().slice(0, 10);
  const weekEndIso = weekEndUtc.toISOString().slice(0, 10);
  const prevStartIso = prevWeekStartUtc.toISOString().slice(0, 10);
  const prevEndIso = prevWeekEndUtc.toISOString().slice(0, 10);

  const currentWeek = computeCategoryDonutBreakdown(
    params.transactions,
    params.lines,
    params.categories,
    weekStartIso,
    weekEndIso,
  );
  const previousWeek = computeCategoryDonutBreakdown(
    params.transactions,
    params.lines,
    params.categories,
    prevStartIso,
    prevEndIso,
  );

  const deltaMinor = currentWeek.totalExpenseBaseMinor - previousWeek.totalExpenseBaseMinor;
  const deltaPercentage =
    previousWeek.totalExpenseBaseMinor > 0
      ? Number(((deltaMinor / previousWeek.totalExpenseBaseMinor) * 100).toFixed(1))
      : null;

  const topCategories = currentWeek.slices.slice(0, 3);
  const topSlug = topCategories[0]?.slug ?? 'food-dining';

  let quoteEn =
    'Awareness is 80% of the game — you knew exactly where your money went this week! ✨';
  let quoteVi = 'Biết tiền đi đâu đã là thắng 80% rồi — tuần này bạn nắm nhịp chi tiêu rất rõ! ✨';

  if (deltaPercentage !== null && deltaPercentage < -5) {
    quoteEn = `Nice breeze! You spent ${Math.abs(deltaPercentage)}% less than last week without any stress. 🌿`;
    quoteVi = `Nhẹ nhàng ghê! Tuần này bạn chi ít hơn tuần trước ${Math.abs(deltaPercentage)}% mà vẫn thoải mái. 🌿`;
  } else if (topSlug === 'coffee-tea' || topSlug === 'eating-out' || topSlug === 'food-dining') {
    quoteEn = 'Good food & cozy drinks fueled your week — happy tummy, steady mind! ☕🍜';
    quoteVi = 'Một tuần nạp đầy năng lượng từ đồ ăn ngon & trà sữa — bụng vui là tâm an! ☕🍜';
  }

  return {
    weekStartIso,
    weekEndIso,
    totalExpenseBaseMinor: currentWeek.totalExpenseBaseMinor,
    previousWeekExpenseBaseMinor: previousWeek.totalExpenseBaseMinor,
    deltaPercentage,
    topCategories,
    streakDays: params.streakDays ?? 1,
    quoteEn,
    quoteVi,
  };
}

/**
 * Section 8.10: Generates a shareable Story image (SVG Data URL) in 80/10/10 Warm Editorial Pop style.
 * When `hideExactAmounts = true`, exact currency numbers are masked (`•••.•••đ`) so only percentages & categories show.
 */
export function buildWeeklyRecapStorySvgDataUrl(
  recap: WeeklyRecapSummary,
  options: { hideExactAmounts?: boolean; locale?: SupportedLocale } = {},
): string {
  const hideAmounts = options.hideExactAmounts ?? false;
  const locale = options.locale ?? 'en';
  const totalDisplay = formatMoney(recap.totalExpenseBaseMinor, 'VND', { hidden: hideAmounts });
  const quote = locale === 'vi' ? recap.quoteVi : recap.quoteEn;
  const heading = locale === 'vi' ? 'TỔNG KẾT TUẦN · VOI' : 'WEEKLY RECAP · VOI';

  const topRowsSvg = recap.topCategories
    .map((cat, idx) => {
      const y = 300 + idx * 54;
      const amt = hideAmounts
        ? `${cat.percentage}%`
        : `${formatMoney(cat.amountBaseMinor, 'VND')} (${cat.percentage}%)`;
      return `
        <rect x="40" y="${y}" width="460" height="42" rx="14" fill="#F0ECE1" />
        <circle cx="64" cy="${y + 21}" r="10" fill="${cat.colorHex}" />
        <text x="84" y="${y + 26}" font-family="sans-serif" font-size="14" font-weight="700" fill="#18181B">${cat.name}</text>
        <text x="480" y="${y + 26}" text-anchor="end" font-family="sans-serif" font-size="14" font-weight="800" fill="#18181B">${amt}</text>
      `;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 680" width="540" height="680">
    <rect width="540" height="680" rx="32" fill="#F7F4EB" />
    <rect x="20" y="20" width="500" height="640" rx="28" fill="#FFFFFF" stroke="#E8E3D5" stroke-width="2" />
    <text x="40" y="64" font-family="sans-serif" font-size="12" font-weight="800" fill="#57554F">${heading}</text>
    <text x="40" y="90" font-family="sans-serif" font-size="13" font-weight="600" fill="#8C887F">${recap.weekStartIso} → ${recap.weekEndIso}</text>
    <rect x="410" y="46" width="90" height="32" rx="16" fill="#FFB703" />
    <text x="455" y="67" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="800" fill="#18181B">🔥 ${recap.streakDays}d</text>
    <text x="40" y="160" font-family="sans-serif" font-size="40" font-weight="900" fill="#18181B">${totalDisplay}</text>
    <text x="40" y="205" font-family="sans-serif" font-size="13" font-weight="600" fill="#57554F">${quote.slice(0, 68)}</text>
    <text x="40" y="280" font-family="sans-serif" font-size="12" font-weight="800" fill="#57554F">TOP 3 CATEGORIES</text>
    ${topRowsSvg}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
