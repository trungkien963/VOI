import { beforeEach, describe, expect, it } from 'vitest';
import { ensureSeedData, FnAppLocalDB } from '../../src/db/dexie-schema';
import { TransactionRepository } from '../../src/db/repositories/transaction-repository';
import { OutboxSyncEngine } from '../../src/db/sync/outbox-sync-engine';
import {
  evaluateStreakAndFreeze,
  evaluateThemeUnlocks,
} from '../../src/domain/engagement/streak-and-themes';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  evaluateDueNotifications,
  isLockScreenSafePayload,
  isWithinQuietHours,
} from '../../src/domain/notifications/notification-scheduler';
import type {
  CreditCardStatement,
  DebtItem,
  RecurringRule,
  Transaction,
} from '../../src/domain/types/entities';

describe('Milestone 5: PWA, Offline Outbox Sync, Notifications & Engagement', () => {
  let db: FnAppLocalDB;
  let txRepo: TransactionRepository;
  let syncEngine: OutboxSyncEngine;

  beforeEach(async () => {
    db = new FnAppLocalDB(`test_m5_${Math.random().toString(36).slice(2, 9)}`);
    await ensureSeedData(db);
    txRepo = new TransactionRepository(db);
    syncEngine = new OutboxSyncEngine(db, 3);
  });

  it('records transactions offline, syncs atomic bundles when back online without duplicates, and isolates Dead-Letter failures', async () => {
    // 1. Offline: User creates 2 expenses while offline
    const [b1] = await txRepo.createFromInputAtomic({
      transactionId: 'tx-offline-1',
      userId: 'local-user',
      type: 'expense',
      amountMinor: 45_000,
      currency: 'VND',
      sourceAccountId: 'acc-default-cash',
      sourcePocketId: 'pocket-acc-default-cash-vnd',
      categoryId: 'cat-exp-food',
      note: 'Coffee offline',
      occurredAt: '2026-05-10T10:00:00.000Z',
    });

    const [b2] = await txRepo.createFromInputAtomic({
      transactionId: 'tx-offline-2',
      userId: 'local-user',
      type: 'expense',
      amountMinor: 120_000,
      currency: 'VND',
      sourceAccountId: 'acc-default-bank',
      sourcePocketId: 'pocket-acc-default-bank-vnd',
      categoryId: 'cat-exp-shopping',
      note: 'Shirt offline',
      occurredAt: '2026-05-10T11:00:00.000Z',
    });

    const tx1 = b1!.transaction;
    const tx2 = b2!.transaction;

    // Attempt flush while offline -> 0 processed, 2 remain pending
    const offlineSummary = await syncEngine.flushOutbox({ isOnline: false });
    expect(offlineSummary.processedCount).toBe(0);
    expect(offlineSummary.remainingPendingCount).toBe(2);

    const healthBefore = await syncEngine.getHealthStatus();
    expect(healthBefore.safeToSignOut).toBe(false);
    expect(healthBefore.pendingCount).toBe(2);

    // 2. Online: Capture atomic bundles sent to transport
    const syncedBundles: string[] = [];
    const onlineSummary = await syncEngine.flushOutbox({
      isOnline: true,
      transport: async (item, bundle) => {
        if (bundle) {
          expect(bundle.transaction.id).toBe(item.entity_id);
          expect(bundle.lines.length).toBeGreaterThanOrEqual(1);
          syncedBundles.push(bundle.transaction.id);
        }
        return { ok: true };
      },
    });

    expect(onlineSummary.syncedCount).toBe(2);
    expect(onlineSummary.remainingPendingCount).toBe(0);
    expect(syncedBundles).toEqual([tx1.id, tx2.id]);

    // 3. Re-enqueuing an identical client_mutation_id is deduplicated (no duplicate sync)
    await db.sync_outbox.add({
      client_mutation_id: 'dup-mutation-id-1',
      entity_table: 'transactions',
      operation: 'upsert',
      entity_id: tx1.id,
      payload: {},
      created_at: Date.now(),
      retry_count: 0,
      status: 'pending',
      last_error: null,
    });
    await syncEngine.flushOutbox({ isOnline: true });

    await db.sync_outbox.add({
      client_mutation_id: 'dup-mutation-id-1',
      entity_table: 'transactions',
      operation: 'upsert',
      entity_id: tx1.id,
      payload: {},
      created_at: Date.now(),
      retry_count: 0,
      status: 'pending',
      last_error: null,
    });
    const dedupSummary = await syncEngine.flushOutbox({ isOnline: true });
    expect(dedupSummary.deduplicatedCount).toBe(1);
    expect(dedupSummary.syncedCount).toBe(0);

    // 4. Dead-Letter Queue: Permanent 4xx failure marks item 'dead_letter' without blocking subsequent item
    await db.sync_outbox.add({
      client_mutation_id: 'bad-item-400',
      entity_table: 'transactions',
      operation: 'upsert',
      entity_id: tx1.id,
      payload: {},
      created_at: Date.now(),
      retry_count: 0,
      status: 'pending',
      last_error: null,
    });
    await db.sync_outbox.add({
      client_mutation_id: 'good-item-after-bad',
      entity_table: 'transactions',
      operation: 'upsert',
      entity_id: tx2.id,
      payload: {},
      created_at: Date.now() + 1,
      retry_count: 0,
      status: 'pending',
      last_error: null,
    });

    const dlqSummary = await syncEngine.flushOutbox({
      isOnline: true,
      transport: async (item) => {
        if (item.client_mutation_id === 'bad-item-400') {
          return { ok: false, permanentFailure: true, errorMessage: '400 Constraint Violation' };
        }
        return { ok: true };
      },
    });

    expect(dlqSummary.failedCount).toBe(1);
    expect(dlqSummary.syncedCount).toBe(1);
    expect(dlqSummary.remainingPendingCount).toBe(0);

    const retried = await syncEngine.retryFailedItems();
    expect(retried).toBe(1);
  });

  it('enforces Notification schedule, Quiet Hours (22:00-07:00), max 2 notifications/day cap, and Lock-Screen Privacy', () => {
    expect(isWithinQuietHours(23, 22, 7)).toBe(true);
    expect(isWithinQuietHours(6, 22, 7)).toBe(true);
    expect(isWithinQuietHours(9, 22, 7)).toBe(false);

    const sampleStatement: CreditCardStatement = {
      id: 'st-1',
      user_id: 'local-user',
      account_id: 'acc-cc',
      period_start: '2026-04-01',
      period_end: '2026-04-30',
      statement_date: '2026-04-30',
      due_date: '2026-05-12', // 1 day after 2026-05-11 (Monday)
      status: 'open',
      opening_balance_minor: 0,
      new_charges_minor: 5_000_000,
      refunds_and_credits_minor: 0,
      fees_and_interest_minor: 0,
      statement_balance_minor: 5_000_000,
      minimum_due_minor: 250_000,
      paid_amount_minor: 0,
      closed_at: null,
      paid_at: null,
      created_at: '2026-04-30T00:00:00Z',
      updated_at: '2026-04-30T00:00:00Z',
    };

    const sampleRecurring: RecurringRule = {
      id: 'rec-1',
      user_id: 'local-user',
      title: 'Netflix',
      template_type: 'expense',
      frequency: 'monthly',
      interval_count: 1,
      day_of_month: 11,
      day_of_week: null,
      next_run_date: '2026-05-11', // Due today
      last_run_date: null,
      auto_post: false,
      remind_days_before: 1,
      amount_minor: 260_000,
      account_id: 'acc-default-bank',
      to_account_id: null,
      pocket_id: 'pocket-acc-default-bank-vnd',
      category_id: 'cat-exp-lifestyle',
      counterparty_id: null,
      note: null,
      is_active: true,
      created_at: '2026-01-11T00:00:00Z',
      updated_at: '2026-01-11T00:00:00Z',
    };

    const sampleDebt: DebtItem = {
      id: 'debt-1',
      user_id: 'local-user',
      counterparty_id: 'cp-minh',
      direction: 'i_owe',
      status: 'open',
      title: 'Minh Nguyen',
      principal_minor: 1_500_000,
      remaining_minor: 1_500_000,
      currency: 'VND',
      opened_date: '2026-05-01',
      due_date: '2026-05-12', // 1 day after 2026-05-11
      origin_transaction_id: null,
      note: 'Dinner split',
      settled_at: null,
      created_at: '2026-05-01T00:00:00Z',
      updated_at: '2026-05-01T00:00:00Z',
    };

    // During quiet hours (23:00): suppressed
    const quietResult = evaluateDueNotifications({
      todayIso: '2026-05-11', // Monday
      currentHour: 23,
      locale: 'vi',
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      hasLoggedOrCheckedInToday: false,
      statements: [sampleStatement],
      recurringRules: [sampleRecurring],
      debts: [sampleDebt],
    });
    expect(quietResult.suppressedByQuietHours).toBe(true);
    expect(quietResult.notificationsToSend).toHaveLength(0);

    // At 09:00 Monday morning: 4 triggers match (credit card 1d before, recurring due today, debt 1d before, weekly recap)
    // Must be capped at MAX 2 notifications/day and pass lock-screen privacy check!
    const activeResult = evaluateDueNotifications({
      todayIso: '2026-05-11', // Monday
      currentHour: 9,
      locale: 'vi',
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
      hasLoggedOrCheckedInToday: false,
      statements: [sampleStatement],
      recurringRules: [sampleRecurring],
      debts: [sampleDebt],
    });

    expect(activeResult.suppressedByQuietHours).toBe(false);
    expect(activeResult.notificationsToSend).toHaveLength(2);
    expect(activeResult.notificationsToSend[0]?.kind).toBe('credit_card_due');
    expect(activeResult.notificationsToSend[1]?.kind).toBe('combined_digest');

    for (const notif of activeResult.notificationsToSend) {
      expect(isLockScreenSafePayload(notif, ['Minh Nguyen', 'Netflix'])).toBe(true);
    }
  });

  it('evaluates Streak, automatic Weekly Freeze on 1-day gap, Welcome Back on multi-day gap, and Theme Unlocks', () => {
    const makeTx = (dateIso: string): Transaction => ({
      id: `tx-${dateIso}`,
      client_id: `c-${dateIso}`,
      user_id: 'local-user',
      type: 'expense',
      status: 'posted',
      source: 'quick_add',
      txn_date: dateIso,
      occurred_at: `${dateIso}T12:00:00.000Z`,
      currency: 'VND',
      amount_minor: 50_000,
      category_id: 'cat-exp-food',
      counterparty_id: null,
      merchant_name: null,
      note: 'Lunch',
      raw_input_text: null,
      is_reimbursable: false,
      linked_transaction_id: null,
      recurring_rule_id: null,
      created_at: `${dateIso}T12:00:00.000Z`,
      updated_at: `${dateIso}T12:00:00.000Z`,
      voided_at: null,
    });

    // User logged on May 10 and May 8, missed May 9 (1-day gap), and checked in No-Spend on May 7
    const evalWithFreeze = evaluateStreakAndFreeze({
      transactions: [makeTx('2026-05-10'), makeTx('2026-05-08')],
      noSpendDates: ['2026-05-07'],
      todayIso: '2026-05-10',
      weeklyFreezeAvailable: true,
    });

    // May 10 (tx) + May 9 (frozen!) + May 8 (tx) + May 7 (no-spend check-in) = 4-day streak!
    expect(evalWithFreeze.streakDays).toBe(4);
    expect(evalWithFreeze.freezeUsedOnDate).toBe('2026-05-09');
    expect(evalWithFreeze.remainingFreezesThisWeek).toBe(0);

    // Multi-day gap (missed 3 days): shows judgment-free Welcome Back + Quick Catch-Up prompt
    const evalAfterGap = evaluateStreakAndFreeze({
      transactions: [makeTx('2026-05-05')],
      noSpendDates: [],
      todayIso: '2026-05-10',
      weeklyFreezeAvailable: true,
    });
    expect(evalAfterGap.streakDays).toBe(0);
    expect(evalAfterGap.showWelcomeBack).toBe(true);
    expect(evalAfterGap.showQuickCatchUpPrompt).toBe(true);

    // Theme Unlocks based on streak & checklist completion
    const locksAt4Days = evaluateThemeUnlocks({
      streakDays: 4,
      maxStreakDays: 4,
      checklistCompleted: false,
    });
    expect(locksAt4Days.pop.unlocked).toBe(true);
    expect(locksAt4Days.cobalt.unlocked).toBe(true);
    expect(locksAt4Days.matcha.unlocked).toBe(true); // >= 3 days
    expect(locksAt4Days.flamingo.unlocked).toBe(false); // needs 7 days
    expect(locksAt4Days.sunny.unlocked).toBe(false); // needs 30 days or checklist

    const locksWithChecklist = evaluateThemeUnlocks({
      streakDays: 4,
      maxStreakDays: 4,
      checklistCompleted: true,
    });
    expect(locksWithChecklist.sunny.unlocked).toBe(true);
  });
});
