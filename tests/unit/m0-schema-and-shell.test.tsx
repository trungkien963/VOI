import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppShell } from '../../src/app/AppShell';
import { useUiStore } from '../../src/app/ui-store';
import { ensureSeedData, FnAppLocalDB } from '../../src/db/dexie-schema';
import { AccountRepository } from '../../src/db/repositories/account-repository';
import { CategoryRepository } from '../../src/db/repositories/category-repository';
import { getLedgerStrategy } from '../../src/domain/ledger/strategies';
import { applyKeypadInput, evaluateMoneyExpression } from '../../src/domain/money/calculator';
import { en, vi } from '../../src/shared/i18n';

describe('Milestone 0: Clean Architecture, Multi-Language (EN Default + VI) & Money+ UI Kit', () => {
  beforeEach(() => {
    useUiStore.setState({
      activeTab: 'home',
      walletSubTab: 'wallets',
      isQuickAddOpen: false,
      hideBalances: false,
      locale: 'en',
      themeId: 'pop',
      colorMode: 'light',
      syncStatus: 'synced',
      checkedInNoSpendToday: false,
      streakDays: 1,
    });
  });

  it('declares explicit @source directives in tokens.css so Tailwind v4 scans all src/ components in dev mode', () => {
    const tokensCss = readFileSync(
      resolve(__dirname, '../../src/shared/theme/tokens.css'),
      'utf-8',
    );
    expect(tokensCss).toContain("@import 'tailwindcss';");
    expect(tokensCss).toContain("@source '../../';");
  });

  it('seeds all 33 default categories and queries them via CategoryRepository (extends BaseRepository)', async () => {
    const testDb = new FnAppLocalDB('test_fn_app_m0');
    await testDb.delete();
    await testDb.open();

    await ensureSeedData(testDb);
    const catRepo = new CategoryRepository(testDb);
    const allCount = await catRepo.count();
    expect(allCount).toBe(33);

    const expenseCats = await catRepo.listByKind('expense');
    expect(expenseCats.length).toBeGreaterThan(15);

    const coffeeCat = await catRepo.findBySlug('coffee-tea');
    expect(coffeeCat?.name).toBe('Cà phê & Trà sữa');
    expect(coffeeCat?.icon_name).toBe('arch');

    // Verify BaseRepository atomic upsert + sync_outbox enqueue
    const accRepo = new AccountRepository(testDb);
    const nowIso = new Date().toISOString();
    await accRepo.upsertAtomic({
      id: 'acc-test-1',
      user_id: 'user-1',
      name: 'Ví VCB',
      type: 'bank',
      currency: 'VND',
      institution_name: 'VCB',
      color_hex: '#3B82F6',
      icon_name: 'hexagon',
      include_in_net_worth: true,
      is_default_spend: true,
      cached_balance_minor: 500000,
      credit_limit_minor: null,
      statement_day: null,
      payment_due_day: null,
      grace_period_days: null,
      apr_bps: null,
      sort_order: 1,
      archived_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    });

    const activeAccounts = await accRepo.listActiveAccounts();
    expect(activeAccounts).toHaveLength(4);
    const outboxCount = await testDb.sync_outbox.count();
    expect(outboxCount).toBe(1);

    await testDb.close();
  });

  it('evaluates Money+ arithmetic expressions (+, -, ×, ÷, 000) and enforces BaseLedgerStrategy invariants', () => {
    expect(evaluateMoneyExpression('360000÷3')).toBe(120000);
    expect(evaluateMoneyExpression('45000+25000×2')).toBe(95000);

    let expr = '';
    expr = applyKeypadInput(expr, '4');
    expr = applyKeypadInput(expr, '5');
    expr = applyKeypadInput(expr, '000');
    expect(expr).toBe('45000');

    // Verify Expense, Income, and Transfer strategies
    const expenseBundle = getLedgerStrategy('expense').buildBundle({
      transactionId: 'tx-1',
      userId: 'u-1',
      type: 'expense',
      amountMinor: 45000,
      currency: 'VND',
      sourceAccountId: 'acc-1',
      sourcePocketId: null,
      note: 'Morning coffee',
    });
    expect(expenseBundle.lines).toHaveLength(1);
    expect(expenseBundle.lines[0]?.signed_amount_minor).toBe(-45000);
    expect(expenseBundle.accountBalanceDeltas['acc-1']).toBe(-45000);

    const transferBundle = getLedgerStrategy('transfer').buildBundle({
      transactionId: 'tx-2',
      userId: 'u-1',
      type: 'transfer',
      amountMinor: 200000,
      currency: 'VND',
      sourceAccountId: 'acc-bank',
      sourcePocketId: null,
      destinationAccountId: 'acc-momo',
      destinationPocketId: null,
    });
    expect(transferBundle.lines).toHaveLength(2);
    expect(transferBundle.accountBalanceDeltas['acc-bank']).toBe(-200000);
    expect(transferBundle.accountBalanceDeltas['acc-momo']).toBe(200000);
  });

  it('renders in English by default, switches to Vietnamese reactively, and operates Money+ CalculatorKeypad', () => {
    render(<AppShell />);

    // 1. Default language is English ('en')
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByText(en.hero.todaySpentLabel)).toBeInTheDocument();
    expect(screen.getByText(en.flows.cost)).toBeInTheDocument();
    expect(screen.getByText(en.flows.earn)).toBeInTheDocument();
    expect(screen.getByText(en.flows.borrowLend)).toBeInTheDocument();
    expect(screen.getByText(en.flows.transfer)).toBeInTheDocument();
    expect(screen.getByTestId('today-spent-amount')).toHaveTextContent('0đ');
    expect(screen.getByText(en.accounts.sectionTitle)).toBeInTheDocument();
    expect(screen.getByText('1/7')).toBeInTheDocument();

    // 2. Open Money+ QuickAddSheet in English & calculate 360000 ÷ 3 = 120.000đ
    fireEvent.click(screen.getByRole('button', { name: en.nav.quickAdd }));
    expect(screen.getByText(en.quickAddModal.title)).toBeInTheDocument();
    expect(screen.getByText('Food & Dining')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Key 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Key 6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Key 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Key 000' }));
    fireEvent.click(screen.getByRole('button', { name: 'Key ÷' }));
    fireEvent.click(screen.getByRole('button', { name: 'Key 3' }));
    expect(screen.getByTestId('calculator-evaluated-amount')).toHaveTextContent('120.000đ');
    fireEvent.click(screen.getByRole('button', { name: en.quickAddModal.closeBtn }));

    // 3. Switch language from EN -> VI inside Settings -> Appearance
    fireEvent.click(screen.getByRole('button', { name: en.nav.settings }));
    fireEvent.click(screen.getByTestId('settings-category-appearance'));
    fireEvent.click(screen.getByRole('tab', { name: en.settings.langVi }));
    expect(document.documentElement.lang).toBe('vi');

    // Return to Home and verify Vietnamese labels
    fireEvent.click(screen.getByRole('button', { name: vi.nav.home }));
    expect(screen.getByText(vi.hero.todaySpentLabel)).toBeInTheDocument();
    expect(screen.getByText(vi.flows.cost)).toBeInTheDocument();
    expect(screen.getByText(vi.flows.earn)).toBeInTheDocument();
    expect(screen.getByText(vi.flows.borrowLend)).toBeInTheDocument();
    expect(screen.getByText(vi.flows.transfer)).toBeInTheDocument();

    // 4. Mask balances, navigate tabs, and switch theme in Settings
    fireEvent.click(screen.getByRole('button', { name: vi.hero.hideBalanceAria }));
    expect(screen.getByTestId('today-spent-amount')).toHaveTextContent('••••••đ');

    fireEvent.click(screen.getByRole('button', { name: vi.nav.walletsAndDebts }));
    expect(screen.getByText(vi.walletsTab.walletsEmptyTitle)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: vi.walletsTab.segmentDebts }));
    expect(screen.getByText(vi.walletsTab.debtsEmptyTitle)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: vi.nav.settings }));
    fireEvent.click(screen.getByTestId('settings-category-appearance'));
    fireEvent.click(screen.getByText('Electric Cobalt'));
    expect(document.documentElement.dataset.theme).toBe('cobalt');
  });
});
