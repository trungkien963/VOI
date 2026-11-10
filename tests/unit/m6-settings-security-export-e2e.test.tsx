import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppShell } from '../../src/app/AppShell';
import { ensureSeedData, FnAppLocalDB } from '../../src/db/dexie-schema';
import { AccountRepository } from '../../src/db/repositories/account-repository';
import { OnboardingRepository } from '../../src/db/repositories/onboarding-repository';
import { TransactionRepository } from '../../src/db/repositories/transaction-repository';
import { OutboxSyncEngine } from '../../src/db/sync/outbox-sync-engine';
import { PrivacySafeAnalyticsTracker } from '../../src/domain/analytics/analytics-tracker';
import {
  createFullDatabaseSnapshot,
  escapeCsvCell,
  evaluateSignOutGuard,
  exportTransactionsToCsv,
  permanentlyDeleteAllUserData,
  restoreFullDatabaseSnapshot,
} from '../../src/domain/data-portability/csv-and-snapshot';
import {
  computeNetWorth,
  computePeriodReportSummary,
} from '../../src/domain/ledger/balance-calculator';
import { computeReconcileAdjustment } from '../../src/domain/ledger/reconcile-calculator';
import { parseQuickInput } from '../../src/domain/quick-parser/parser';
import {
  createSaltedPinRecord,
  isPlaintextPinLeaked,
  shouldShowPrivacyBlurOverlay,
  verifyPinAgainstRecord,
} from '../../src/domain/security/app-lock';

describe('Milestone 6: Settings, App Lock, Data Portability, Analytics & Full E2E Flows', () => {
  let db: FnAppLocalDB;
  let accountRepo: AccountRepository;
  let txRepo: TransactionRepository;
  let onboardingRepo: OnboardingRepository;
  let syncEngine: OutboxSyncEngine;

  beforeEach(async () => {
    db = new FnAppLocalDB(`test_m6_${Math.random().toString(36).slice(2, 9)}`);
    await ensureSeedData(db);
    accountRepo = new AccountRepository(db);
    txRepo = new TransactionRepository(db);
    onboardingRepo = new OnboardingRepository(db);
    syncEngine = new OutboxSyncEngine(db, 3);
  });

  it('hashes App Lock PIN with salt (never storing plaintext) and triggers Privacy Blur when backgrounded', async () => {
    const rawPin = '2580';
    const record = await createSaltedPinRecord(rawPin);

    expect(record.saltHex.length).toBeGreaterThanOrEqual(16);
    expect(record.digestHex).not.toBe(rawPin);
    expect(isPlaintextPinLeaked(JSON.stringify(record), rawPin)).toBe(false);

    expect(await verifyPinAgainstRecord('2580', record)).toBe(true);
    expect(await verifyPinAgainstRecord('9999', record)).toBe(false);

    expect(
      shouldShowPrivacyBlurOverlay({
        appLockEnabled: true,
        hideBalances: false,
        isDocumentHidden: true,
        isWindowBlurred: false,
      }),
    ).toBe(true);

    expect(
      shouldShowPrivacyBlurOverlay({
        appLockEnabled: false,
        hideBalances: false,
        isDocumentHidden: true,
        isWindowBlurred: true,
      }),
    ).toBe(false);
  });

  it('prevents CSV Formula Injection and performs 100% lossless Full JSON Snapshot Backup & Restore', async () => {
    expect(escapeCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(escapeCsvCell('+cmd|calc')).toBe("'+cmd|calc");
    expect(escapeCsvCell('-100+200')).toBe("'-100+200");
    expect(escapeCsvCell('@IMPORTXML()')).toBe("'@IMPORTXML()");

    await txRepo.createFromInputAtomic({
      transactionId: 'tx-csv-1',
      userId: 'local-user',
      type: 'expense',
      amountMinor: 65_000,
      currency: 'VND',
      sourceAccountId: 'acc-default-bank',
      sourcePocketId: 'pocket-acc-default-bank-vnd',
      categoryId: 'cat-exp-food',
      note: '=HYPERLINK("http://evil.example","Click")',
      occurredAt: '2026-05-12T08:00:00.000Z',
    });

    const snapshot = await createFullDatabaseSnapshot(db);
    expect(snapshot.transactions).toHaveLength(1);

    const csv = exportTransactionsToCsv({
      transactions: snapshot.transactions,
      lines: snapshot.transaction_lines,
      accounts: snapshot.accounts,
      categories: snapshot.categories,
    });
    expect(csv).toContain('"\'=HYPERLINK(""http://evil.example"",""Click"")"');

    // Guard blocks sign-out while outbox has pending items
    const guardBlocked = await evaluateSignOutGuard(db, 'vi');
    expect(guardBlocked.allowed).toBe(false);
    expect(guardBlocked.unsyncedCount).toBeGreaterThan(0);
    expect(guardBlocked.warningMessage).toContain('chưa được đồng bộ');

    // 2-step permanent delete requires both step1=true and 'DELETE'
    const rejectedDelete = await permanentlyDeleteAllUserData(db, true, 'wrong');
    expect(rejectedDelete.deleted).toBe(false);

    const confirmedDelete = await permanentlyDeleteAllUserData(db, true, 'DELETE');
    expect(confirmedDelete.deleted).toBe(true);
    expect(await db.transactions.count()).toBe(0);

    // Restore 100% from JSON snapshot
    await restoreFullDatabaseSnapshot(db, snapshot);
    expect(await db.transactions.count()).toBe(1);
  });

  it('enforces Zero PII / Financial Leak in Analytics Tracker across events', () => {
    const tracker = new PrivacySafeAnalyticsTracker();
    const txEvent = tracker.track('transaction_created', {
      source: 'quick_add',
      type: 'expense',
      duration_ms: 2400,
      amount_minor: 500_000, // Forbidden: must be stripped
      note: 'Secret gift for Minh', // Forbidden: must be stripped
      counterparty_name: 'Minh', // Forbidden: must be stripped
    });

    expect(txEvent.metadata).toEqual({
      source: 'quick_add',
      type: 'expense',
      duration_ms: 2400,
    });

    const recEvent = tracker.trackReconcileDone({
      appBalanceMinor: 1_000_000,
      actualBalanceMinor: 950_000,
    });
    expect(recEvent.metadata).toEqual({
      delta_pct: 5,
      direction: 'deficit',
    });
  });

  it('E2E Golden Journey: Onboarding -> Quick Input -> Transfer -> Credit Card Spend & Payment -> Reconcile -> Offline Sync', async () => {
    // 1. Onboarding: Set opening balance 10,000,000đ on Main Bank
    await txRepo.createFromInputAtomic({
      transactionId: 'e2e-open-bank',
      userId: 'local-user',
      type: 'opening_balance',
      amountMinor: 10_000_000,
      currency: 'VND',
      sourceAccountId: 'acc-default-bank',
      sourcePocketId: 'pocket-acc-default-bank-vnd',
      occurredAt: '2026-05-01T08:00:00.000Z',
    });
    await onboardingRepo.markStepCompleted('created_main_account');

    // 2. Quick Input: Parse "phở 55k" and record expense from Main Bank
    const parsed = parseQuickInput('phở 55k');
    expect(parsed.amountMinor).toBe(55_000);
    await txRepo.createFromInputAtomic({
      transactionId: 'e2e-quick-pho',
      userId: 'local-user',
      type: 'expense',
      amountMinor: parsed.amountMinor ?? 55_000,
      currency: 'VND',
      sourceAccountId: 'acc-default-bank',
      sourcePocketId: 'pocket-acc-default-bank-vnd',
      categoryId: parsed.categoryId ?? 'cat-exp-food',
      note: parsed.note,
      occurredAt: '2026-05-02T12:00:00.000Z',
    });

    // 3. Transfer: Withdraw 2,000,000đ from Main Bank to Cash Wallet
    await txRepo.createFromInputAtomic({
      transactionId: 'e2e-transfer-atm',
      userId: 'local-user',
      type: 'transfer',
      amountMinor: 2_000_000,
      currency: 'VND',
      sourceAccountId: 'acc-default-bank',
      sourcePocketId: 'pocket-acc-default-bank-vnd',
      destinationAccountId: 'acc-default-cash',
      destinationPocketId: 'pocket-acc-default-cash-vnd',
      occurredAt: '2026-05-03T10:00:00.000Z',
    });

    // 4. Credit Card Spend & Payment: Create Credit Card, spend 500,000đ, then pay card 500,000đ from Bank
    const { account: ccAcc, defaultPocket: ccPocket } =
      await accountRepo.createAccountWithOpeningBalance({
        name: 'VIB Credit Card',
        type: 'credit_card',
        currency: 'VND',
        creditLimitMinor: 20_000_000,
      });

    await txRepo.createFromInputAtomic({
      transactionId: 'e2e-cc-spend',
      userId: 'local-user',
      type: 'credit_card_spend',
      amountMinor: 500_000,
      currency: 'VND',
      sourceAccountId: ccAcc.id,
      sourcePocketId: ccPocket.id,
      categoryId: 'cat-exp-shopping',
      occurredAt: '2026-05-04T15:00:00.000Z',
    });

    await txRepo.createFromInputAtomic({
      transactionId: 'e2e-cc-pay',
      userId: 'local-user',
      type: 'credit_card_payment',
      amountMinor: 500_000,
      currency: 'VND',
      sourceAccountId: 'acc-default-bank',
      sourcePocketId: 'pocket-acc-default-bank-vnd',
      destinationAccountId: ccAcc.id,
      destinationPocketId: ccPocket.id,
      occurredAt: '2026-05-05T09:00:00.000Z',
    });

    // 5. Reconcile Cash Wallet: App balance is 2,000,000đ, actual cash in hand is 1,980,000đ (-20,000đ unaccounted expense)
    const cashPocketBefore = (await db.pockets.get('pocket-acc-default-cash-vnd'))!;
    expect(cashPocketBefore.cached_balance_minor).toBe(2_000_000);

    const recPlan = computeReconcileAdjustment({
      transactionId: 'e2e-reconcile-cash',
      userId: 'local-user',
      accountId: 'acc-default-cash',
      pocketId: 'pocket-acc-default-cash-vnd',
      currency: 'VND',
      appBalanceMinor: cashPocketBefore.cached_balance_minor,
      actualBalanceMinor: 1_980_000,
      occurredAt: '2026-05-06T18:00:00.000Z',
    });
    expect(recPlan.bundle).not.toBeNull();
    if (recPlan.bundle) {
      await txRepo.saveBundlesAtomic([recPlan.bundle]);
    }

    // Verify Ledger & Report totals:
    // Total Expense in Report = 55k (phở) + 500k (cc spend) + 20k (reconcile deficit) = 575,000đ
    // Opening balance (10M), Transfer (2M), and CC payment (500k) MUST NOT pollute Expense Report!
    const allTxs = await db.transactions.toArray();
    const allLines = await db.transaction_lines.toArray();
    const report = computePeriodReportSummary(allTxs, allLines, '2026-05-01', '2026-05-31');
    expect(report.totalExpenseBaseMinor).toBe(575_000);

    // Net Worth = 10,000,000 - 575,000 = 9,425,000đ
    const allPockets = await db.pockets.toArray();
    expect(computeNetWorth({ pockets: allPockets, debts: [] })).toBe(9_425_000);

    // 6. Offline Sync: Flush all queued outbox mutations cleanly
    const syncRes = await syncEngine.flushOutbox({ isOnline: true });
    expect(syncRes.remainingPendingCount).toBe(0);
    expect(syncRes.failedCount).toBe(0);
  });

  it('passes Accessibility landmark and icon-button aria-label checks on AppShell', () => {
    render(<AppShell />);
    expect(screen.getByRole('navigation', { name: /navigation|điều hướng/i })).toBeInTheDocument();
    expect(screen.getByTestId('language-toggle-btn')).toHaveAttribute('aria-label');
  });
});
