import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/App';
import { useUiStore } from '../../src/app/ui-store';
import { localDb } from '../../src/db/dexie-schema';

describe('Milestone 8: First-Time User Experience (4-Step Welcome, Avatar Picker, 1-Tap Wallet Setup & Celebrations)', () => {
  beforeEach(async () => {
    await localDb.transactions.clear();
    await localDb.transaction_lines.clear();
    await localDb.accounts.clear();
    await localDb.pockets.clear();
    await localDb.budgets.clear();
    await localDb.recurring_rules.clear();
    await localDb.categories.clear();
    await localDb.onboarding_checklist_state.clear();

    useUiStore.setState({
      activeTab: 'home',
      walletSubTab: 'wallets',
      isQuickAddOpen: false,
      quickAddPresetText: null,
      hideBalances: false,
      locale: 'en',
      themeId: 'pop',
      colorMode: 'light',
      userName: '',
      avatarId: 'cobalt',
      hasCompletedWelcome: false,
      isWelcomeOpen: false,
      welcomeInitialStep: 'cover',
      celebration: null,
      checkedInNoSpendToday: false,
      streakDays: 1,
    });
  });

  it('guides a first-time user from Welcome Cover -> Avatar & Name -> 1-Tap Wallet Setup -> Congrats -> First Expense Celebration', async () => {
    render(<App />);

    // 1. Automatically switches to Vietnamese and opens Screen 1 (Welcome Cover)
    await waitFor(() => {
      expect(screen.getByTestId('welcome-onboarding-modal')).toBeInTheDocument();
    });
    expect(useUiStore.getState().locale).toBe('vi');

    // 2. Advance from Cover -> Avatar & Name Picker (Screen 2)
    fireEvent.click(screen.getByTestId('welcome-start-btn'));
    const nameInput = screen.getByTestId('welcome-name-input');
    fireEvent.change(nameInput, { target: { value: 'Minh' } });

    // Select 'matcha' avatar card -> immediately updates theme to 'matcha'
    fireEvent.click(screen.getByTestId('avatar-card-matcha'));
    expect(document.documentElement.dataset.theme).toBe('matcha');

    // 3. Advance from Avatar -> 1-Tap Wallet & Budget Setup (Screen 3)
    fireEvent.click(screen.getByTestId('welcome-avatar-continue-btn'));
    expect(screen.getByTestId('welcome-balance-input')).toHaveValue('5.000.000');
    expect(screen.getByTestId('welcome-budget-input')).toHaveValue('6.000.000');

    // Save Wallet & Budget Setup -> transitions to Screen 4 (Congrats!)
    fireEvent.click(screen.getByTestId('welcome-save-wallet-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('welcome-congrats-screen')).toBeInTheDocument();
    });

    // Verify Main Bank now has +5,000,000 VND opening balance (prevents negative first-expense shock!)
    const mainPocket = await localDb.pockets.get('pocket-acc-default-bank-vnd');
    expect(mainPocket?.cached_balance_minor).toBe(5_000_000);

    // 4. Click "Thử ghi khoản chi đầu tiên (3 giây)" on Congrats screen
    fireEvent.click(screen.getByTestId('welcome-try-first-expense-btn'));

    // Welcome modal closes, Header greets "Minh", and QuickAddSheet opens pre-filled with "Cafe 35k" (35.000đ)
    expect(screen.queryByTestId('welcome-onboarding-modal')).not.toBeInTheDocument();
    expect(useUiStore.getState().userName).toBe('Minh');
    expect(screen.getByTestId('calculator-evaluated-amount')).toHaveTextContent('35.000đ');
  });

  it('supports multi-wallet balances, credit card creation, monthly income, per-category caps, and inline subcategory customization', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('welcome-onboarding-modal')).toBeInTheDocument();
    });

    // Navigate to Step 3 (Wallet, Income & Category Caps Setup)
    fireEvent.click(screen.getByTestId('welcome-start-btn'));
    fireEvent.click(screen.getByTestId('welcome-avatar-continue-btn'));

    // 1. Set Cash & E-Wallet balances + Add a Credit Card
    fireEvent.change(screen.getByTestId('welcome-cash-balance-input'), {
      target: { value: '1.000.000' },
    });
    fireEvent.change(screen.getByTestId('welcome-ewallet-balance-input'), {
      target: { value: '500.000' },
    });

    fireEvent.click(screen.getByTestId('welcome-add-wallet-toggle'));
    fireEvent.change(screen.getByTestId('welcome-extra-wallet-name-input'), {
      target: { value: 'Thẻ tín dụng VIB' },
    });
    fireEvent.change(screen.getByTestId('welcome-extra-wallet-balance-input'), {
      target: { value: '2.000.000' },
    });
    fireEvent.click(screen.getByTestId('welcome-extra-wallet-save-btn'));

    // Total liquid balance = 5M (Main Bank) + 1M (Cash) + 500k (E-Wallet) = 6.500.000đ
    expect(screen.getByTestId('welcome-total-wallet-badge')).toHaveTextContent('6.500.000');

    // 2. Set Monthly Income to 20.000.000 and auto-distribute 50% (10.000.000) across category caps
    fireEvent.focus(screen.getByTestId('welcome-income-input'));
    fireEvent.change(screen.getByTestId('welcome-income-input'), {
      target: { value: '20.000.000' },
    });
    expect(screen.getByTestId('welcome-salary-wallet-select')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-salary-cycle-included')).toBeInTheDocument();

    // Expand Card 3 (Monthly Spending Cap) in the step accordion
    fireEvent.focus(screen.getByTestId('welcome-budget-input'));
    fireEvent.click(screen.getByTestId('welcome-auto-distribute-income-btn'));
    expect(screen.getByTestId('welcome-budget-input')).toHaveValue('10.000.000');

    // 3. Customize an individual category cap (Ăn uống -> 4.000.000)
    fireEvent.click(screen.getByTestId('welcome-toggle-category-breakdown-btn'));
    const foodCapInput = screen.getByTestId('welcome-cat-cap-food-dining');
    fireEvent.change(foodCapInput, { target: { value: '4.000.000' } });
    // Previous food cap was 3.5M (35% of 10M), so changing to 4M updates total to 10.500.000
    expect(screen.getByTestId('welcome-budget-input')).toHaveValue('10.500.000');

    // 4. Add a custom Subcategory ("Bún bò sáng") right under Ăn uống
    fireEvent.click(screen.getByTestId('welcome-add-subcat-btn-food-dining'));
    fireEvent.change(screen.getByTestId('welcome-new-subcat-input-food-dining'), {
      target: { value: 'Bún bò sáng' },
    });
    fireEvent.click(screen.getByTestId('welcome-save-subcat-btn-food-dining'));

    await waitFor(async () => {
      const customCats = await localDb.categories.toArray();
      expect(customCats.some((c) => c.name === 'Bún bò sáng')).toBe(true);
    });

    // Save setup and verify DB records
    fireEvent.click(screen.getByTestId('welcome-save-wallet-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('welcome-congrats-screen')).toBeInTheDocument();
    });

    const cashPocket = await localDb.pockets.get('pocket-acc-default-cash-vnd');
    const momoPocket = await localDb.pockets.get('pocket-acc-default-momo-vnd');
    expect(cashPocket?.cached_balance_minor).toBe(1_000_000);
    expect(momoPocket?.cached_balance_minor).toBe(500_000);

    const allAccounts = await localDb.accounts.toArray();
    const vibCard = allAccounts.find((a) => a.name === 'Thẻ tín dụng VIB');
    expect(vibCard?.type).toBe('credit_card');
    expect(vibCard?.cached_balance_minor).toBe(-2_000_000);

    const allBudgets = await localDb.budgets.toArray();
    expect(allBudgets.length).toBeGreaterThanOrEqual(5);
    const foodBudget = allBudgets.find(
      (b) => b.category_id === '10000000-0000-4000-8000-000000000001',
    );
    expect(foodBudget?.limit_minor).toBe(4_000_000);

    const salaryRules = await localDb.recurring_rules.toArray();
    expect(salaryRules.some((r) => r.amount_minor === 20_000_000)).toBe(true);
  });
});
