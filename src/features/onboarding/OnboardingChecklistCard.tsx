import { useEffect, useState, type ReactElement } from 'react';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUiStore } from '../../app/ui-store';
import { localDb } from '../../db/dexie-schema';
import {
  createDefaultChecklistState,
  onboardingRepository,
  type ChecklistStepKey,
} from '../../db/repositories/onboarding-repository';
import { useTranslation } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { GeometricClusterIcon } from '../../shared/ui/GeometricClusterIcon';

interface StepMeta {
  key: ChecklistStepKey;
  titleEn: string;
  titleVi: string;
  descEn: string;
  descVi: string;
  actionTab: 'wallets' | 'debts' | 'quick_add';
}

const CHECKLIST_STEPS: ReadonlyArray<StepMeta> = [
  {
    key: 'created_main_account',
    titleEn: '1. Create main bank account',
    titleVi: '1. Tạo tài khoản chính',
    descEn: 'Your primary daily bank account is ready.',
    descVi: 'Tài khoản ngân hàng chính đã sẵn sàng.',
    actionTab: 'wallets',
  },
  {
    key: 'added_second_account_or_NA',
    titleEn: '2. Add e-wallet or cash wallet',
    titleVi: '2. Thêm ví điện tử hoặc tiền mặt',
    descEn: 'Track money smoothly across your bank, e-wallets, and cash.',
    descVi: 'Theo dõi đủ dòng tiền giữa ngân hàng, MoMo/ZaloPay và tiền mặt.',
    actionTab: 'wallets',
  },
  {
    key: 'added_credit_card_or_NA',
    titleEn: '3. Add credit card (if any)',
    titleVi: '3. Thêm thẻ tín dụng (nếu có)',
    descEn: 'Track statement dates, due dates, and avoid double-counting card payments.',
    descVi: 'Theo dõi ngày sao kê, hạn thanh toán và không bị tính trùng chi tiêu.',
    actionTab: 'wallets',
  },
  {
    key: 'logged_first_3_expenses',
    titleEn: '4. Who owes you? (Receivables)',
    titleVi: '4. Ai đang nợ bạn? (Khoản cần thu)',
    descEn: 'Log existing IOUs so the app remembers for you.',
    descVi: 'Ghi lại các khoản người khác đang nợ bạn để không quên.',
    actionTab: 'debts',
  },
  {
    key: 'added_income_or_recurring_or_NA',
    titleEn: '5. Who do you owe? (Payables)',
    titleVi: '5. Bạn đang nợ ai? (Khoản cần trả)',
    descEn: 'Keep track of what you need to pay back calmly.',
    descVi: 'Ghi lại các khoản cần trả để app nhắc nhẹ đúng hạn.',
    actionTab: 'debts',
  },
  {
    key: 'created_first_budget_or_goal',
    titleEn: '6. Running installments',
    titleVi: '6. Khoản trả góp đang chạy',
    descEn: 'Track remaining terms (e.g. Term 3/12) automatically.',
    descVi: 'Theo dõi số kỳ trả góp còn lại (VD: Kỳ 3/12).',
    actionTab: 'wallets',
  },
  {
    key: 'tried_3_second_quick_add',
    titleEn: '7. Monthly fixed bills & subscriptions',
    titleVi: '7. Khoản cố định hằng tháng (tiền nhà, điện nước, sub)',
    descEn: 'Confirm monthly bills in 1 tap when due.',
    descVi: 'Xác nhận hóa đơn cố định hằng tháng chỉ với 1 chạm khi đến hạn.',
    actionTab: 'wallets',
  },
];

export function OnboardingChecklistCard(): ReactElement | null {
  const { t, locale } = useTranslation();
  const isVi = locale === 'vi';
  const { setActiveTab, setWalletSubTab, openQuickAdd } = useUiStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllSteps, setShowAllSteps] = useState(false);

  const rawState = useLiveQuery(
    () => onboardingRepository.getStateReadOnly(),
    [],
    createDefaultChecklistState(),
  );
  const liveAccounts = useLiveQuery(() => localDb.accounts.toArray(), [], []);
  const liveDebts = useLiveQuery(() => localDb.debt_items.toArray(), [], []);
  const liveRecurring = useLiveQuery(() => localDb.recurring_rules.toArray(), [], []);
  const liveTransactions = useLiveQuery(() => localDb.transactions.toArray(), [], []);

  const state = rawState ?? createDefaultChecklistState();

  // Smart State Sync: Automatically mark steps completed when real data already exists in localDb
  useEffect(() => {
    const hasRealActivity =
      liveTransactions.some((tx) => tx.type !== 'opening_balance' && !tx.voided_at) ||
      liveDebts.length > 0 ||
      liveRecurring.length > 0;
    if (!hasRealActivity) return;

    const activeAccounts = liveAccounts.filter((a) => !a.archived_at);
    const autoDone: ChecklistStepKey[] = [];

    if (
      !state.created_main_account &&
      activeAccounts.some((a) => a.type === 'bank')
    ) {
      autoDone.push('created_main_account');
    }
    if (
      !state.added_second_account_or_NA &&
      activeAccounts.some((a) => a.type === 'cash' || a.type === 'e_wallet')
    ) {
      autoDone.push('added_second_account_or_NA');
    }
    if (
      !state.added_credit_card_or_NA &&
      activeAccounts.some((a) => a.type === 'credit_card')
    ) {
      autoDone.push('added_credit_card_or_NA');
    }
    if (
      !state.logged_first_3_expenses &&
      liveDebts.some((d) => !d.deleted_at && d.direction === 'they_owe')
    ) {
      autoDone.push('logged_first_3_expenses');
    }
    if (
      !state.added_income_or_recurring_or_NA &&
      liveDebts.some((d) => !d.deleted_at && d.direction === 'i_owe')
    ) {
      autoDone.push('added_income_or_recurring_or_NA');
    }
    if (
      !state.created_first_budget_or_goal &&
      liveRecurring.some((r) => r.is_active && r.total_occurrences && r.total_occurrences > 0)
    ) {
      autoDone.push('created_first_budget_or_goal');
    }
    if (
      !state.tried_3_second_quick_add &&
      liveRecurring.some(
        (r) => r.is_active && (!r.total_occurrences || r.total_occurrences === 0),
      )
    ) {
      autoDone.push('tried_3_second_quick_add');
    }

    if (autoDone.length > 0) {
      void (async () => {
        for (const stepKey of autoDone) {
          await onboardingRepository.markStepCompleted(stepKey);
        }
      })();
    }
  }, [liveAccounts, liveDebts, liveRecurring, liveTransactions, state]);

  if (state.dismissed_at) return null;

  const completedCount = CHECKLIST_STEPS.filter((s) => Boolean(state[s.key])).length;
  const nextStep = CHECKLIST_STEPS.find((s) => !state[s.key]) ?? null;
  const pct = Math.round((completedCount / CHECKLIST_STEPS.length) * 100);

  const handleAction = (step: StepMeta): void => {
    void onboardingRepository.markStepCompleted(step.key);
    if (step.actionTab === 'quick_add') {
      openQuickAdd();
    } else if (step.actionTab === 'debts') {
      setWalletSubTab('debts');
      setActiveTab('wallets');
    } else if (
      step.key === 'created_first_budget_or_goal' ||
      step.key === 'tried_3_second_quick_add'
    ) {
      setWalletSubTab('recurring');
      setActiveTab('wallets');
    } else {
      setWalletSubTab('wallets');
      setActiveTab('wallets');
    }
  };

  return (
    <Card className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <GeometricClusterIcon variant="calendar-check" size={36} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-xs font-extrabold text-[var(--ink-primary)]">
                {t.checklist.title}
              </h2>
              <span className="shrink-0 rounded-full bg-[#10B981]/14 px-2 py-0.5 text-[10px] font-extrabold text-[#059669] tabular-nums">
                {completedCount}/7
              </span>
            </div>
            <p className="truncate text-[11px] font-medium text-[var(--ink-secondary)]">
              {nextStep
                ? isVi
                  ? `Tiếp theo: ${nextStep.titleVi}`
                  : `Next: ${nextStep.titleEn}`
                : isVi
                  ? 'Đã hoàn tất 7/7 bước thiết lập!'
                  : 'All 7/7 setup steps completed!'}
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => void onboardingRepository.dismissChecklist()}
          aria-label="Dismiss checklist"
          className="shrink-0 rounded-full p-1 text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]"
        role="progressbar"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={7}
        aria-label={t.checklist.progressPrefix}
      >
        <div
          className="h-full rounded-full bg-[#10B981] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {isExpanded && (
        <>
          {nextStep ? (
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[var(--ink-primary)]">
                    {isVi ? nextStep.titleVi : nextStep.titleEn}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--ink-secondary)]">
                    {isVi ? nextStep.descVi : nextStep.descEn}
                  </p>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="ink" size="xs" onClick={() => handleAction(nextStep)}>
                    {t.checklist.actionAdd}
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => void onboardingRepository.markStepCompleted(nextStep.key)}
                  >
                    {t.checklist.actionSkipNA}
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAllSteps((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                >
                  <span>{isVi ? 'Xem đủ 7 bước' : 'All 7 steps'}</span>
                  {showAllSteps ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl bg-[#10B981]/12 px-3 py-2 text-xs font-bold text-[#065F46]">
              <span>
                {isVi
                  ? 'Tuyệt vời! Bạn đã hoàn tất 7/7 bước thiết lập.'
                  : 'All 7/7 setup steps completed.'}
              </span>
              <button
                type="button"
                onClick={() => void onboardingRepository.dismissChecklist()}
                className="underline"
              >
                {isVi ? 'Ẩn thẻ' : 'Dismiss'}
              </button>
            </div>
          )}

          {showAllSteps && (
            <ul className="space-y-1.5 border-t border-[var(--border-hairline)] pt-2.5">
              {CHECKLIST_STEPS.map((s) => {
                const done = Boolean(state[s.key]);
                return (
                  <li
                    key={s.key}
                    className="flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-subtle)]/50 px-2.5 py-1.5 text-xs"
                  >
                    <span
                      className={`truncate font-semibold ${
                        done ? 'line-through text-[var(--ink-muted)]' : 'text-[var(--ink-primary)]'
                      }`}
                    >
                      {isVi ? s.titleVi : s.titleEn}
                    </span>
                    {done ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#10B981]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAction(s)}
                        className="shrink-0 rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-primary)] hover:underline"
                      >
                        {t.checklist.actionAdd}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
