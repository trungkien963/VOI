import type {
  CreditCardStatement,
  DebtItem,
  RecurringRule,
  SupportedLocale,
} from '../types/entities';

export type NotificationKind =
  | 'daily_reminder'
  | 'credit_card_due'
  | 'recurring_due'
  | 'debt_due'
  | 'weekly_recap'
  | 'combined_digest';

export interface NotificationPreferences {
  dailyReminderEnabled: boolean;
  dailyReminderHour: number; // 0..23, default 20
  creditCardDueEnabled: boolean;
  recurringDueEnabled: boolean;
  debtDueEnabled: boolean;
  weeklyRecapEnabled: boolean;
  quietHoursStart: number; // default 22 (22:00)
  quietHoursEnd: number; // default 7 (07:00)
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  dailyReminderEnabled: true,
  dailyReminderHour: 20,
  creditCardDueEnabled: true,
  recurringDueEnabled: true,
  debtDueEnabled: true,
  weeklyRecapEnabled: true,
  quietHoursStart: 22,
  quietHoursEnd: 7,
};

export interface LockScreenSafeNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  scheduledDateIso: string;
}

export interface NotificationEvaluationInput {
  todayIso: string; // YYYY-MM-DD
  currentHour: number; // 0..23
  locale: SupportedLocale;
  preferences: NotificationPreferences;
  hasLoggedOrCheckedInToday: boolean;
  statements: readonly CreditCardStatement[];
  recurringRules: readonly RecurringRule[];
  debts: readonly DebtItem[];
  alreadySentTodayCount?: number;
}

export interface NotificationEvaluationResult {
  suppressedByQuietHours: boolean;
  notificationsToSend: LockScreenSafeNotification[];
}

function diffDaysIso(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const utc1 = Date.UTC(y1 ?? 2026, (m1 ?? 1) - 1, d1 ?? 1);
  const utc2 = Date.UTC(y2 ?? 2026, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

export function isWithinQuietHours(
  currentHour: number,
  quietStart = 22,
  quietEnd = 7,
): boolean {
  if (quietStart === quietEnd) return false;
  if (quietStart > quietEnd) {
    // Spans midnight (e.g. 22:00 -> 07:00)
    return currentHour >= quietStart || currentHour < quietEnd;
  }
  return currentHour >= quietStart && currentHour < quietEnd;
}

/**
 * Enforces Section 9.3 & Section 10 Lock-Screen Privacy:
 * Ensures Web Push payloads never leak currency symbols, large numbers, or counterparty names.
 */
export function isLockScreenSafePayload(
  notification: LockScreenSafeNotification,
  forbiddenNames: readonly string[] = [],
): boolean {
  const combined = `${notification.title} ${notification.body}`;
  // Disallow currency markers or formatted money amounts (e.g., 45.000đ, $100, VND)
  if (/(\d{1,3}([.,]\d{3})+|\d\s*[₫đ]|VND|USD|\$\d)/i.test(combined)) {
    return false;
  }
  for (const name of forbiddenNames) {
    const trimmed = name.trim();
    if (trimmed.length >= 2 && combined.toLowerCase().includes(trimmed.toLowerCase())) {
      return false;
    }
  }
  return true;
}

/**
 * Pure scheduler for Section 9.3:
 * - Respects quiet hours (default 22:00 - 07:00)
 * - Caps at max 2 notifications/day (coalescing overflow into a friendly combined notice)
 * - Generates 100% lock-screen safe messages (no exact amounts, no debtor names)
 */
export function evaluateDueNotifications(
  input: NotificationEvaluationInput,
): NotificationEvaluationResult {
  const { preferences, todayIso, currentHour, locale } = input;
  const isVi = locale === 'vi';

  if (
    isWithinQuietHours(currentHour, preferences.quietHoursStart, preferences.quietHoursEnd)
  ) {
    return { suppressedByQuietHours: true, notificationsToSend: [] };
  }

  const remainingQuota = Math.max(0, 2 - (input.alreadySentTodayCount ?? 0));
  if (remainingQuota === 0) {
    return { suppressedByQuietHours: false, notificationsToSend: [] };
  }

  const candidates: LockScreenSafeNotification[] = [];

  // 1. Credit card due: 5 days before or 1 day before due_date
  if (preferences.creditCardDueEnabled) {
    const dueStatements = input.statements.filter((st) => {
      if (st.status === 'paid') return false;
      const daysUntilDue = diffDaysIso(todayIso, st.due_date);
      return daysUntilDue === 5 || daysUntilDue === 1;
    });
    if (dueStatements.length > 0) {
      candidates.push({
        id: `notif-cc-${todayIso}`,
        kind: 'credit_card_due',
        title: isVi ? 'Nhắc lịch thẻ tín dụng 💳' : 'Credit card reminder 💳',
        body: isVi
          ? 'Bạn có 1 khoản thẻ tín dụng sắp đến hạn thanh toán.'
          : 'You have a credit card statement approaching its payment due date.',
        scheduledDateIso: todayIso,
      });
    }
  }

  // 2. Recurring rule due: exact day (next_run_date === todayIso)
  if (preferences.recurringDueEnabled) {
    const dueRules = input.recurringRules.filter(
      (r) => r.is_active && r.next_run_date === todayIso,
    );
    if (dueRules.length > 0) {
      candidates.push({
        id: `notif-rec-${todayIso}`,
        kind: 'recurring_due',
        title: isVi ? 'Khoản định kỳ đến hạn 📅' : 'Scheduled item due today 📅',
        body: isVi
          ? 'Bạn có khoản định kỳ đang chờ xác nhận hôm nay.'
          : 'You have a recurring bill awaiting your confirmation today.',
        scheduledDateIso: todayIso,
      });
    }
  }

  // 3. Debt due: 1 day before due_date
  if (preferences.debtDueEnabled) {
    const dueDebts = input.debts.filter((d) => {
      if (d.status === 'settled' || !d.due_date) return false;
      return diffDaysIso(todayIso, d.due_date) === 1;
    });
    if (dueDebts.length > 0) {
      candidates.push({
        id: `notif-debt-${todayIso}`,
        kind: 'debt_due',
        title: isVi ? 'Nhắc lịch Sổ nợ 🤝' : 'Debt book reminder 🤝',
        body: isVi
          ? 'Bạn có 1 khoản trong Sổ nợ sẽ đến hạn vào ngày mai.'
          : 'You have a debt book entry due tomorrow.',
        scheduledDateIso: todayIso,
      });
    }
  }

  // 4. Weekly recap: Monday morning (day of week === 1, between quietEnd and 12:00)
  const [y, m, d] = todayIso.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  if (preferences.weeklyRecapEnabled && dayOfWeek === 1 && currentHour < 12) {
    candidates.push({
      id: `notif-recap-${todayIso}`,
      kind: 'weekly_recap',
      title: isVi ? 'Weekly Recap tuần qua đã sẵn sàng ✨' : 'Your Weekly Recap is ready ✨',
      body: isVi
        ? 'Cùng điểm lại nhịp tài chính tuần qua nhẹ nhàng nhé!'
        : 'Take a calm 10-second peek at last week’s highlights!',
      scheduledDateIso: todayIso,
    });
  }

  // 5. Daily reminder: At/after chosen hour, ONLY if nothing logged/checked-in today
  if (
    preferences.dailyReminderEnabled &&
    !input.hasLoggedOrCheckedInToday &&
    currentHour >= preferences.dailyReminderHour
  ) {
    candidates.push({
      id: `notif-daily-${todayIso}`,
      kind: 'daily_reminder',
      title: isVi ? 'Ghi nhanh 3 giây ☕' : '3-second daily check-in ☕',
      body: isVi
        ? 'Đến giờ ghi chi tiêu hôm nay rồi ☕'
        : 'Time to log today’s expenses or check in a zero-spend day ☕',
      scheduledDateIso: todayIso,
    });
  }

  if (candidates.length <= remainingQuota) {
    return { suppressedByQuietHours: false, notificationsToSend: candidates };
  }

  if (remainingQuota === 1) {
    return {
      suppressedByQuietHours: false,
      notificationsToSend: [
        {
          id: `notif-digest-${todayIso}`,
          kind: 'combined_digest',
          title: isVi ? 'Tóm tắt nhắc việc hôm nay ✨' : 'Today’s friendly reminders ✨',
          body: isVi
            ? 'Bạn có một vài lời nhắc tài chính đang chờ xem trong ứng dụng.'
            : 'You have a couple of friendly finance reminders waiting in the app.',
          scheduledDateIso: todayIso,
        },
      ],
    };
  }

  // remainingQuota === 2 and candidates.length > 2: keep first, coalesce the rest into second
  const first = candidates[0]!;
  return {
    suppressedByQuietHours: false,
    notificationsToSend: [
      first,
      {
        id: `notif-digest-${todayIso}`,
        kind: 'combined_digest',
        title: isVi ? 'Các lời nhắc khác hôm nay ✨' : 'Other reminders today ✨',
        body: isVi
          ? 'Bạn có thêm lời nhắc định kỳ và chi tiêu đang chờ xem trong ứng dụng.'
          : 'You have additional reminders waiting for you in the app.',
        scheduledDateIso: todayIso,
      },
    ],
  };
}
