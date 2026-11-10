import type { ThemeId, Transaction } from '../types/entities';

export type ThemeUnlockRequirement = 'default' | 'streak_3' | 'streak_7' | 'streak_30_or_checklist';

export interface ThemeUnlockStatus {
  themeId: ThemeId;
  unlocked: boolean;
  requirement: ThemeUnlockRequirement;
  requiredStreakDays: number;
}

export interface StreakEvaluationInput {
  transactions: readonly Transaction[];
  noSpendDates: readonly string[];
  todayIso: string;
  weeklyFreezeAvailable?: boolean;
  previousMaxStreak?: number;
}

export interface StreakEvaluationResult {
  streakDays: number;
  maxStreakDays: number;
  isActiveToday: boolean;
  freezeUsedOnDate: string | null;
  remainingFreezesThisWeek: number;
  missedDaysCount: number;
  showWelcomeBack: boolean;
  showQuickCatchUpPrompt: boolean;
}

function addDaysIso(dateIso: string, deltaDays: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function diffDaysIso(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const utc1 = Date.UTC(y1 ?? 2026, (m1 ?? 1) - 1, d1 ?? 1);
  const utc2 = Date.UTC(y2 ?? 2026, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Pure domain evaluator for Section 9.1:
 * - A day counts if user logs >=1 active transaction OR checks in "No spend today".
 * - 1 automatic Streak Freeze per week saves a 1-day gap automatically.
 * - Judgment-free welcome back when streak resets, plus quick catch-up prompt when >=2 days missed.
 */
export function evaluateStreakAndFreeze(input: StreakEvaluationInput): StreakEvaluationResult {
  const freezeAvailable = input.weeklyFreezeAvailable ?? true;

  const activeDates = new Set<string>();
  for (const d of input.noSpendDates) {
    if (d <= input.todayIso) activeDates.add(d);
  }
  for (const tx of input.transactions) {
    if (tx.status !== 'void' && tx.voided_at === null && tx.txn_date <= input.todayIso) {
      activeDates.add(tx.txn_date);
    }
  }

  const isActiveToday = activeDates.has(input.todayIso);

  if (activeDates.size === 0) {
    return {
      streakDays: 0,
      maxStreakDays: input.previousMaxStreak ?? 0,
      isActiveToday: false,
      freezeUsedOnDate: null,
      remainingFreezesThisWeek: freezeAvailable ? 1 : 0,
      missedDaysCount: 0,
      showWelcomeBack: false,
      showQuickCatchUpPrompt: false,
    };
  }

  const sortedDatesDesc = Array.from(activeDates).sort((a, b) => b.localeCompare(a));
  const latestActiveDate = sortedDatesDesc[0] ?? input.todayIso;
  const daysSinceLatest = diffDaysIso(latestActiveDate, input.todayIso);

  let streakDays = 0;
  let freezeUsedOnDate: string | null = null;
  let freezeLeft = freezeAvailable ? 1 : 0;

  // Start scanning backwards from today (if active today) or yesterday
  let cursorIso = isActiveToday ? input.todayIso : addDaysIso(input.todayIso, -1);

  for (let i = 0; i < 365; i++) {
    if (activeDates.has(cursorIso)) {
      streakDays += 1;
      cursorIso = addDaysIso(cursorIso, -1);
      continue;
    }

    // Check if there is an active day right before this single missed day and we have a freeze
    const prevDayIso = addDaysIso(cursorIso, -1);
    if (freezeLeft > 0 && activeDates.has(prevDayIso)) {
      freezeUsedOnDate = cursorIso;
      freezeLeft -= 1;
      streakDays += 1; // Count the frozen day toward keeping the streak alive
      cursorIso = prevDayIso;
      continue;
    }

    break;
  }

  const missedDaysCount = isActiveToday ? 0 : daysSinceLatest;
  const showWelcomeBack =
    activeDates.size > 0 &&
    streakDays <= 1 &&
    (daysSinceLatest >= 2 ||
      (isActiveToday &&
        sortedDatesDesc.length >= 2 &&
        diffDaysIso(sortedDatesDesc[1]!, input.todayIso) > 2));
  const showQuickCatchUpPrompt = daysSinceLatest >= 2;
  const maxStreakDays = Math.max(streakDays, input.previousMaxStreak ?? 0);

  return {
    streakDays,
    maxStreakDays,
    isActiveToday,
    freezeUsedOnDate,
    remainingFreezesThisWeek: freezeLeft,
    missedDaysCount,
    showWelcomeBack,
    showQuickCatchUpPrompt,
  };
}

/**
 * Pure domain evaluator for Section 9.2:
 * - 2 themes unlocked by default ('pop', 'cobalt')
 * - Other 3 themes unlock by milestone: streak 3 days ('matcha'), streak 7 days ('flamingo'),
 *   streak 30 days OR completed 7-step onboarding checklist ('sunny').
 */
export function evaluateThemeUnlocks(params: {
  streakDays: number;
  maxStreakDays?: number;
  checklistCompleted: boolean;
}): Record<ThemeId, ThemeUnlockStatus> {
  const bestStreak = Math.max(params.streakDays, params.maxStreakDays ?? 0);

  return {
    pop: {
      themeId: 'pop',
      unlocked: true,
      requirement: 'default',
      requiredStreakDays: 0,
    },
    cobalt: {
      themeId: 'cobalt',
      unlocked: true,
      requirement: 'default',
      requiredStreakDays: 0,
    },
    matcha: {
      themeId: 'matcha',
      unlocked: bestStreak >= 3,
      requirement: 'streak_3',
      requiredStreakDays: 3,
    },
    flamingo: {
      themeId: 'flamingo',
      unlocked: bestStreak >= 7,
      requirement: 'streak_7',
      requiredStreakDays: 7,
    },
    sunny: {
      themeId: 'sunny',
      unlocked: bestStreak >= 30 || params.checklistCompleted,
      requirement: 'streak_30_or_checklist',
      requiredStreakDays: 30,
    },
  };
}
