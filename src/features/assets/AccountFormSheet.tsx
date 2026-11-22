import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUiStore } from '../../app/ui-store';
import { localDb } from '../../db/dexie-schema';
import { accountRepository } from '../../db/repositories/account-repository';
import { budgetRepository } from '../../db/repositories/budget-repository';
import { onboardingRepository } from '../../db/repositories/onboarding-repository';
import { pocketRepository } from '../../db/repositories/pocket-repository';
import { makeFundBudgetKey } from '../../domain/budgets/budget-calculator';
import {
  ALL_DATABASE_CURRENCIES,
  formatMoney,
  formatNumberInputLive,
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

export const CURRENCY_OPTIONS: ReadonlyArray<CurrencyCode> = ALL_DATABASE_CURRENCIES;

interface ExtraCurrencyDraft {
  currency: CurrencyCode;
  balanceText: string;
  existingPocketId?: string;
}

export function AccountFormSheet({
  open,
  editingAccount = null,
  defaultPocket = null,
  onClose,
}: AccountFormSheetProps): ReactElement {
  const { t, locale } = useTranslation();
  const { numberFormat, enabledCurrencies, addEnabledCurrency } = useUiStore();
  const isVi = locale === 'vi';
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('bank');
  const [currency, setCurrency] = useState<CurrencyCode>('VND');
  const [openingBalanceText, setOpeningBalanceText] = useState('0');
  const [monthlyTargetText, setMonthlyTargetText] = useState('3.000.000');
  const [goalTargetText, setGoalTargetText] = useState('50.000.000');
  const [extraCurrencies, setExtraCurrencies] = useState<ExtraCurrencyDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const visiblePillCurrencies: ReadonlyArray<CurrencyCode> = Array.from(
    new Set<CurrencyCode>([...(enabledCurrencies ?? ['VND', 'USD', 'TWD']), currency]),
  );

  const accountPockets = useLiveQuery(
    async () => {
      if (!editingAccount) return [];
      const rows = await localDb.pockets.where('account_id').equals(editingAccount.id).toArray();
      return rows.filter((p) => p.archived_at === null);
    },
    [editingAccount?.id, open],
    [],
  );

  useEffect(() => {
    if (editingAccount) {
      setName(editingAccount.name);
      setAccountType(editingAccount.type);
      const curr = (defaultPocket?.currency ?? editingAccount.currency ?? 'VND') as CurrencyCode;
      setCurrency(curr);
      const balMinor = defaultPocket?.cached_balance_minor ?? editingAccount.cached_balance_minor;
      setOpeningBalanceText(
        formatNumberInputLive(String(fromMinorUnits(balMinor, curr)), numberFormat),
      );

      const nonDefaultPockets = accountPockets.filter(
        (p) => !p.is_default && p.id !== defaultPocket?.id,
      );
      setExtraCurrencies(
        nonDefaultPockets.map((p) => {
          const pCurr = (p.currency ?? 'USD') as CurrencyCode;
          return {
            currency: pCurr,
            balanceText: formatNumberInputLive(
              String(fromMinorUnits(p.cached_balance_minor, pCurr)),
              numberFormat,
            ),
            existingPocketId: p.id,
          };
        }),
      );

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
      setExtraCurrencies([]);
    }
  }, [editingAccount, defaultPocket, open, accountPockets.length]);

  const usedCurrencies = new Set<CurrencyCode>([
    currency,
    ...extraCurrencies.map((item) => item.currency),
  ]);
  const availableExtraCurrencies = CURRENCY_OPTIONS.filter((c) => !usedCurrencies.has(c));

  const handleAddExtraCurrencyRow = (): void => {
    const nextCurr = availableExtraCurrencies[0];
    if (!nextCurr) return;
    setExtraCurrencies((prev) => [...prev, { currency: nextCurr, balanceText: '0' }]);
  };

  const handleRemoveExtraCurrencyRow = async (idx: number): Promise<void> => {
    const target = extraCurrencies[idx];
    if (target?.existingPocketId) {
      await pocketRepository.archivePocketAtomic(target.existingPocketId);
    }
    setExtraCurrencies((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    try {
      const rawTargetMinor = parseFlexibleMoneyInput(openingBalanceText, currency);
      const isLiabilityAccount = accountType === 'credit_card' || accountType === 'bnpl';
      const targetMinor =
        isLiabilityAccount && rawTargetMinor > 0 ? -Math.abs(rawTargetMinor) : rawTargetMinor;
      const monthKey = new Date().toISOString().slice(0, 7);

      let savedAccountId = editingAccount?.id ?? '';

      if (editingAccount) {
        await accountRepository.updateAccountAtomic({
          id: editingAccount.id,
          name: name.trim(),
          type: accountType,
          currency,
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
        const createdFund = await budgetRepository.createFundAtomic({
          name: name.trim(),
          monthlyContributionMinor: monthlyMinor > 0 ? monthlyMinor : 2_000_000,
          goalTargetMinor: goalMinor > 0 ? goalMinor : null,
          initialBalanceMinor: targetMinor,
          monthKey,
        });
        savedAccountId = createdFund.account.id;
        await onboardingRepository.markStepCompleted('added_second_account_or_NA');
      } else {
        const created = await accountRepository.createAccountWithOpeningBalance({
          name: name.trim(),
          type: accountType,
          currency,
          openingBalanceMinor: targetMinor,
        });
        savedAccountId = created.account.id;
        await onboardingRepository.markStepCompleted(
          accountType === 'credit_card' || accountType === 'bnpl'
            ? 'added_credit_card_or_NA'
            : 'added_second_account_or_NA',
        );
      }

      // Persist or reconcile any additional currency pockets on this account
      if (savedAccountId && extraCurrencies.length > 0) {
        for (const extra of extraCurrencies) {
          const extraMinor = parseFlexibleMoneyInput(extra.balanceText, extra.currency);
          if (extra.existingPocketId) {
            const existingP = accountPockets.find((p) => p.id === extra.existingPocketId);
            if (existingP) {
              if (existingP.currency !== extra.currency) {
                await localDb.pockets.update(existingP.id, {
                  currency: extra.currency,
                  name: `${name.trim()} (${extra.currency})`,
                });
              }
              if (existingP.cached_balance_minor !== extraMinor) {
                await pocketRepository.reconcilePocketBalanceAtomic(existingP.id, extraMinor);
              }
            }
          } else {
            await pocketRepository.createPocketWithOpeningBalance({
              accountId: savedAccountId,
              name: `${name.trim()} (${extra.currency})`,
              currency: extra.currency,
              openingBalanceMinor: extraMinor,
            });
          }
        }
      }

      setName('');
      setOpeningBalanceText('0');
      setExtraCurrencies([]);
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
              <option value="investment">
                {isVi ? 'Đầu tư (Chứng khoán / Vàng / Crypto)' : 'Investment'}
              </option>
              <option value="bnpl">
                {isVi ? 'Mua trước trả sau (SPayLater / Ví trả sau)' : 'Buy Now Pay Later (BNPL)'}
              </option>
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
              onChange={(e) => {
                const nextCurr = e.target.value as CurrencyCode;
                addEnabledCurrency(nextCurr);
                setCurrency(nextCurr);
              }}
              className="mt-1 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2.5 text-sm font-semibold text-[var(--ink-primary)]"
            >
              {CURRENCY_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Visual 1-Tap Currency Pill Bar (Shows only User's Enabled Currencies!) */}
        <div className="space-y-1">
          <span className="block text-[11px] font-bold text-[var(--ink-secondary)]">
            {isVi ? 'Chọn nhanh tiền tệ đã bật:' : 'Quick select enabled currency:'}
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {visiblePillCurrencies.map((code) => {
              const active = currency === code;
              return (
                <button
                  key={code}
                  type="button"
                  data-testid={`account-currency-pill-${code}`}
                  onClick={() => setCurrency(code)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-extrabold transition ${
                    active
                      ? 'border-[#191919] bg-[#191919] text-[#FAFAFA]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)] hover:border-[#191919] hover:text-[var(--ink-primary)]'
                  }`}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="account-opening-balance"
            className="block text-xs font-bold text-[var(--ink-secondary)]"
          >
            {accountType === 'credit_card' || accountType === 'bnpl'
              ? isVi
                ? `Dư nợ hiện tại (${currency})`
                : `Current Owed Balance (${currency})`
              : editingAccount
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
            onChange={(e) =>
              setOpeningBalanceText(formatNumberInputLive(e.target.value, numberFormat))
            }
            className="mt-1 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-sm font-bold text-[var(--ink-primary)] tabular-nums focus:border-[#18181B] focus:outline-none"
          />
        </div>

        {/* Multi-Currency Sub-Balances inside this same Account (e.g. Cash Wallet holding VND + USD + TWD) */}
        {accountType !== 'savings' && (
          <div className="space-y-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold text-[var(--ink-primary)]">
                  {isVi
                    ? 'Đa tiền tệ trong cùng ví (VND, USD, TWD...)'
                    : 'Multi-currency balances in this wallet'}
                </p>
                <p className="text-[11px] font-medium text-[var(--ink-secondary)]">
                  {isVi
                    ? '1 ví có thể chứa nhiều loại tiền tệ song song'
                    : 'Hold multiple currencies inside one account'}
                </p>
              </div>
              {availableExtraCurrencies.length > 0 && (
                <button
                  type="button"
                  data-testid="account-add-extra-currency-btn"
                  onClick={handleAddExtraCurrencyRow}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#191919] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--ink-primary)] transition hover:bg-[#191919] hover:text-[#FAFAFA]"
                >
                  <Plus className="h-3 w-3" />
                  <span>{isVi ? '+ Thêm ngoại tệ' : '+ Add Currency'}</span>
                </button>
              )}
            </div>

            {extraCurrencies.length > 0 && (
              <div className="space-y-2 pt-1">
                {extraCurrencies.map((item, idx) => (
                  <div
                    key={item.existingPocketId ?? `extra-curr-${idx}`}
                    className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] p-2"
                  >
                    <select
                      aria-label={
                        isVi ? `Loại tiền phụ ${idx + 1}` : `Secondary currency ${idx + 1}`
                      }
                      value={item.currency}
                      onChange={(e) => {
                        const nextVal = e.target.value as CurrencyCode;
                        setExtraCurrencies((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, currency: nextVal } : row)),
                        );
                      }}
                      className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-2 py-1.5 text-xs font-extrabold text-[var(--ink-primary)]"
                    >
                      {CURRENCY_OPTIONS.filter(
                        (c) => c === item.currency || !usedCurrencies.has(c),
                      ).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={isVi ? `Số dư ${item.currency}` : `${item.currency} balance`}
                      value={item.balanceText}
                      onChange={(e) => {
                        const val = formatNumberInputLive(e.target.value, numberFormat);
                        setExtraCurrencies((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, balanceText: val } : row)),
                        );
                      }}
                      placeholder={`0 ${item.currency}`}
                      className="min-w-0 flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs font-bold text-[var(--ink-primary)] tabular-nums focus:outline-none"
                    />

                    <span className="shrink-0 text-[11px] font-bold text-[var(--ink-secondary)] tabular-nums">
                      {formatMoney(
                        parseFlexibleMoneyInput(item.balanceText, item.currency),
                        item.currency,
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => void handleRemoveExtraCurrencyRow(idx)}
                      aria-label={isVi ? `Xoá ${item.currency}` : `Remove ${item.currency}`}
                      className="rounded-lg p-1 text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[#EF4444]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
                onChange={(e) =>
                  setMonthlyTargetText(formatNumberInputLive(e.target.value, numberFormat))
                }
                placeholder="3.000.000"
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
                onChange={(e) =>
                  setGoalTargetText(formatNumberInputLive(e.target.value, numberFormat))
                }
                placeholder="50.000.000"
                className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-extrabold text-[var(--ink-primary)] tabular-nums"
              />
            </div>
          </div>
        )}

        <div className="space-y-2 pt-1">
          <Button type="submit" variant="ink" size="lg" fullWidth disabled={submitting}>
            {editingAccount ? (isVi ? 'Lưu thay đổi' : 'Save Changes') : t.accounts.saveAccountBtn}
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
