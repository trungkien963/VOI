import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { Trash2 } from 'lucide-react';
import { localDb } from '../../db/dexie-schema';
import { accountRepository } from '../../db/repositories/account-repository';
import { budgetRepository } from '../../db/repositories/budget-repository';
import { onboardingRepository } from '../../db/repositories/onboarding-repository';
import { pocketRepository } from '../../db/repositories/pocket-repository';
import { makeFundBudgetKey } from '../../domain/budgets/budget-calculator';
import {
  fromMinorUnits,
  parseFlexibleMoneyInput,
  type CurrencyCode,
} from '../../domain/money/currency';
import type { Account, AccountType, Pocket } from '../../domain/types/entities';
import { useTranslation } from '../../shared/i18n';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
import { GeometricBuddy } from '../../shared/ui/GeometricBuddy';

export interface AccountFormSheetProps {
  open: boolean;
  editingAccount?: Account | null;
  defaultPocket?: Pocket | null;
  onClose: () => void;
}

const CURRENCY_OPTIONS: ReadonlyArray<CurrencyCode> = ['VND', 'USD', 'EUR', 'JPY', 'SGD'];

export function AccountFormSheet({
  open,
  editingAccount = null,
  defaultPocket = null,
  onClose,
}: AccountFormSheetProps): ReactElement {
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('bank');
  const [currency, setCurrency] = useState<CurrencyCode>('VND');
  const [openingBalanceText, setOpeningBalanceText] = useState('0');
  const [monthlyTargetText, setMonthlyTargetText] = useState('3000000');
  const [goalTargetText, setGoalTargetText] = useState('50000000');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingAccount) {
      setName(editingAccount.name);
      setAccountType(editingAccount.type);
      const curr = (defaultPocket?.currency ?? editingAccount.currency ?? 'VND') as CurrencyCode;
      setCurrency(curr);
      const balMinor = defaultPocket?.cached_balance_minor ?? editingAccount.cached_balance_minor;
      setOpeningBalanceText(String(fromMinorUnits(balMinor, curr)));
      if (editingAccount.type === 'savings') {
        const goalMinor = defaultPocket?.target_amount_minor ?? 0;
        setGoalTargetText(goalMinor > 0 ? String(fromMinorUnits(goalMinor, curr)) : '');
        void localDb.budgets
          .where('category_id')
          .equals(makeFundBudgetKey(editingAccount.id))
          .toArray()
          .then((rows) => {
            const latest = rows.sort((a, b) => b.month_key.localeCompare(a.month_key))[0];
            setMonthlyTargetText(
              latest && latest.limit_minor > 0
                ? String(fromMinorUnits(latest.limit_minor, curr))
                : '3000000',
            );
          });
      }
    } else {
      setName('');
      setAccountType('bank');
      setCurrency('VND');
      setOpeningBalanceText('0');
      setMonthlyTargetText('3000000');
      setGoalTargetText('50000000');
    }
  }, [editingAccount, defaultPocket, open]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    try {
      const targetMinor = parseFlexibleMoneyInput(openingBalanceText, currency);
      const monthKey = new Date().toISOString().slice(0, 7);

      if (editingAccount) {
        await accountRepository.updateAccountAtomic({
          id: editingAccount.id,
          name: name.trim(),
          type: accountType,
        });
        if (defaultPocket && defaultPocket.cached_balance_minor !== targetMinor) {
          await pocketRepository.reconcilePocketBalanceAtomic(defaultPocket.id, targetMinor);
        }
        if (accountType === 'savings') {
          const monthlyMinor = parseFlexibleMoneyInput(monthlyTargetText, currency);
          const goalMinor = parseFlexibleMoneyInput(goalTargetText, currency);
          await budgetRepository.updateFundTargetsAtomic({
            fundAccountId: editingAccount.id,
            monthKey,
            monthlyContributionMinor: monthlyMinor > 0 ? monthlyMinor : 2_000_000,
            goalTargetMinor: goalMinor > 0 ? goalMinor : null,
          });
        }
      } else if (accountType === 'savings') {
        const monthlyMinor = parseFlexibleMoneyInput(monthlyTargetText, currency);
        const goalMinor = parseFlexibleMoneyInput(goalTargetText, currency);
        await budgetRepository.createFundAtomic({
          name: name.trim(),
          monthlyContributionMinor: monthlyMinor > 0 ? monthlyMinor : 2_000_000,
          goalTargetMinor: goalMinor > 0 ? goalMinor : null,
          initialBalanceMinor: targetMinor,
          monthKey,
        });
        await onboardingRepository.markStepCompleted('added_second_account_or_NA');
      } else {
        await accountRepository.createAccountWithOpeningBalance({
          name: name.trim(),
          type: accountType,
          currency,
          openingBalanceMinor: targetMinor,
        });
        await onboardingRepository.markStepCompleted(
          accountType === 'credit_card'
            ? 'added_credit_card_or_NA'
            : 'added_second_account_or_NA',
        );
      }

      setName('');
      setOpeningBalanceText('0');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (): Promise<void> => {
    if (!editingAccount || submitting) return;
    setSubmitting(true);
    try {
      await accountRepository.archiveAccountAtomic(editingAccount.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        editingAccount
          ? isVi
            ? 'Sửa ví / Tài khoản'
            : 'Edit Wallet / Account'
          : t.accounts.addAccountBtn
      }
      titleId="add-account-sheet-title"
      closeLabel={t.quickAddModal.closeBtn}
      headerAccessory={
        <GeometricBuddy
          shape="hexagon"
          colorHex="#3B82F6"
          accessory="bag-handle"
          mood="happy"
          size={36}
        />
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
        <div>
          <label
            htmlFor="account-name-input"
            className="block text-xs font-bold text-[var(--ink-secondary)]"
          >
            {t.accounts.accountNameLabel}
          </label>
          <input
            id="account-name-input"
            name="accountName"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Techcombank, Wise USD..."
            className="mt-1 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-medium text-[var(--ink-primary)] focus:border-[#18181B] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label
              htmlFor="account-type-select"
              className="block text-xs font-bold text-[var(--ink-secondary)]"
            >
              {t.accounts.accountTypeLabel}
            </label>
            <select
              id="account-type-select"
              name="accountType"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              className="mt-1 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2.5 text-sm font-semibold text-[var(--ink-primary)]"
            >
              <option value="bank">{t.accounts.bankType}</option>
              <option value="cash">{t.accounts.cashType}</option>
              <option value="e_wallet">{t.accounts.eWalletType}</option>
              <option value="savings">{t.accounts.savingsType}</option>
              <option value="credit_card">{t.accounts.creditType}</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="account-currency-select"
              className="block text-xs font-bold text-[var(--ink-secondary)]"
            >
              {t.accounts.currencyLabel}
            </label>
            <select
              id="account-currency-select"
              name="currency"
              value={currency}
              disabled={Boolean(editingAccount)}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="mt-1 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2.5 text-sm font-semibold text-[var(--ink-primary)] disabled:opacity-60"
            >
              {CURRENCY_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="account-opening-balance"
            className="block text-xs font-bold text-[var(--ink-secondary)]"
          >
            {editingAccount
              ? isVi
                ? `Số dư hiện tại (${currency})`
                : `Current Balance (${currency})`
              : `${t.accounts.openingBalanceLabel} (${currency})`}
          </label>
          <input
            id="account-opening-balance"
            name="openingBalance"
            type="text"
            inputMode="decimal"
            value={openingBalanceText}
            onChange={(e) => setOpeningBalanceText(e.target.value)}
            className="mt-1 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--ink-primary)] tabular-nums focus:border-[#18181B] focus:outline-none"
          />
        </div>

        {accountType === 'savings' && (
          <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-[#10B981]/30 bg-[#10B981]/8 p-3">
            <div>
              <label className="block truncate text-xs font-bold text-[var(--ink-secondary)]">
                {isVi ? `Mục tiêu góp / tháng (${currency})` : `Monthly Target (${currency})`}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={monthlyTargetText}
                onChange={(e) => setMonthlyTargetText(e.target.value)}
                placeholder="3000000"
                className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-extrabold text-[var(--ink-primary)] tabular-nums"
              />
            </div>
            <div>
              <label className="block truncate text-xs font-bold text-[var(--ink-secondary)]">
                {isVi ? `Mục tiêu tổng Quỹ (${currency})` : `Goal Target (${currency})`}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={goalTargetText}
                onChange={(e) => setGoalTargetText(e.target.value)}
                placeholder="50000000"
                className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-extrabold text-[var(--ink-primary)] tabular-nums"
              />
            </div>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <Button type="submit" variant="ink" size="lg" fullWidth disabled={submitting}>
            {editingAccount
              ? isVi
                ? 'Lưu thay đổi'
                : 'Save Changes'
              : t.accounts.saveAccountBtn}
          </Button>

          {editingAccount && (
            <Button
              type="button"
              variant="outline"
              size="md"
              fullWidth
              disabled={submitting}
              onClick={() => void handleDeleteAccount()}
            >
              <Trash2 className="h-3.5 w-3.5 text-[#EF4444]" />
              <span className="text-[#EF4444]">
                {isVi ? 'Xoá / Lưu trữ ví này' : 'Delete / Archive Wallet'}
              </span>
            </Button>
          )}
        </div>
      </form>
    </BottomSheet>
  );
}
