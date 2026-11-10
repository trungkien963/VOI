// Supabase Edge Function: push-dispatcher (invoked hourly via pg_cron)
// Enforces Section 9.3: Max 2 notifications/day, Quiet Hours (22:00-07:00), and Lock-Screen Privacy.

export interface PushDispatchJobSummary {
  evaluatedUsers: number;
  dispatchedCount: number;
  suppressedQuietHours: number;
}

export function buildLockScreenSafeEdgePayload(
  kind: 'daily_reminder' | 'credit_card_due' | 'recurring_due' | 'debt_due' | 'weekly_recap',
  locale: 'en' | 'vi' = 'vi',
): { title: string; body: string } {
  const isVi = locale === 'vi';
  switch (kind) {
    case 'daily_reminder':
      return {
        title: isVi ? 'Ghi nhanh 3 giây ☕' : '3-second daily check-in ☕',
        body: isVi
          ? 'Đến giờ ghi chi tiêu hôm nay rồi ☕'
          : 'Time to log today’s expenses or check in a zero-spend day ☕',
      };
    case 'credit_card_due':
      return {
        title: isVi ? 'Nhắc lịch thẻ tín dụng 💳' : 'Credit card reminder 💳',
        body: isVi
          ? 'Bạn có 1 khoản thẻ tín dụng sắp đến hạn thanh toán.'
          : 'You have a credit card statement approaching its payment due date.',
      };
    case 'recurring_due':
      return {
        title: isVi ? 'Khoản định kỳ đến hạn 📅' : 'Scheduled item due today 📅',
        body: isVi
          ? 'Bạn có khoản định kỳ đang chờ xác nhận hôm nay.'
          : 'You have a recurring bill awaiting your confirmation today.',
      };
    case 'debt_due':
      return {
        title: isVi ? 'Nhắc lịch Sổ nợ 🤝' : 'Debt book reminder 🤝',
        body: isVi
          ? 'Bạn có 1 khoản trong Sổ nợ sẽ đến hạn vào ngày mai.'
          : 'You have a debt book entry due tomorrow.',
      };
    case 'weekly_recap':
      return {
        title: isVi ? 'Weekly Recap tuần qua đã sẵn sàng ✨' : 'Your Weekly Recap is ready ✨',
        body: isVi
          ? 'Cùng điểm lại nhịp tài chính tuần qua nhẹ nhàng nhé!'
          : 'Take a calm 10-second peek at last week’s highlights!',
      };
  }
}

