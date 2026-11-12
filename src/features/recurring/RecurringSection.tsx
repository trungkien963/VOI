import { useState, type FormEvent, type ReactElement } from 'react';
import {
  Banknote,
  CalendarClock,
  Check,
  ChevronRight,
  CreditCard,
  FastForward,
  Home,
  Plus,
  SkipForward,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { SYSTEM_CATEGORY_IDS } from '../../domain/categories/default-categories';
import { useLiveQuery } from 'dexie-react-hooks';
import { useUiStore } from '../../app/ui-store';
import { DEFAULT_STARTER_POCKETS, localDb } from '../../db/dexie-schema';
import { onboardingRepository } from '../../db/repositories/onboarding-repository';
import { recurringRepository } from '../../db/repositories/recurring-repository';
import {
  formatInstallmentProgress,
  isRecurringRuleDue,
} from '../../domain/ledger/recurring-calculator';
import { formatMoney, parseFlexibleMoneyInput } from '../../domain/money/currency';
import type { RecurrenceFrequency, RecurringRule } from '../../domain/types/entities';
import { getAccountDisplayName, useTranslation } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { GeometricBuddy } from '../../shared/ui/GeometricBuddy';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';
import { getAvatarPresetMeta } from '../onboarding/WelcomeOnboardingModal';

type RuleKindMode = 'salary' | 'bill' | 'installment';

export function RecurringSection(): ReactElement {
  const { t, locale } = useTranslation();
  const triggerCelebration = useUiStore((s) => s.triggerCelebration);
  const avatarId = useUiStore((s) => s.avatarId);
  const activeBuddy = getAvatarPresetMeta(avatarId);
  const isVi = locale === 'vi';
  const [showAdd, setShowAdd] = useState(false);
  const [ruleKind, setRuleKind] = useState<RuleKindMode>('bill');
  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [termsText, setTermsText] = useState('3');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('monthly');
  const [selectedPocketId, setSelectedPocketId] = useState<string>('');
  const [nextRunDate, setNextRunDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payingRuleId, setPayingRuleId] = useState<string | null>(null);
  const [customPayAmountText, setCustomPayAmountText] = useState('');
  const [confirmingEarlyRuleId, setConfirmingEarlyRuleId] = useState<string | null>(null);
  const [processingRuleId, setProcessingRuleId] = useState<string | null>(null);

  const livePockets = useLiveQuery(
    async () => {
      const [accounts, allPockets] = await Promise.all([
        localDb.accounts.toArray(),
        localDb.pockets.toArray(),
      ]);
      const activeAccIds = new Set(accounts.filter((a) => a.archived_at === null).map((a) => a.id));
      return allPockets
        .filter((p) => p.archived_at === null && activeAccIds.has(p.account_id))
        .sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)));
    },
    [],
    [],
  );
  const pockets = livePockets.length > 0 ? livePockets : DEFAULT_STARTER_POCKETS;
  const activePocket =
    pockets.find((p) => p.id === selectedPocketId) ??
    pockets.find((p) => p.is_default && (p.currency ?? 'VND') === 'VND') ??
    pockets[0];

  const rules = useLiveQuery(
    () => recurringRepository.listActiveRules(),
    [],
    [] as RecurringRule[],
  );
  const todayIso = new Date().toISOString().slice(0, 10);

  const applyQuickPreset = (preset: {
    kind: RuleKindMode;
    title: string;
    amount: string;
    terms?: string;
  }): void => {
    setRuleKind(preset.kind);
    setTitle(preset.title);
    setAmountText(preset.amount);
    if (preset.terms) setTermsText(preset.terms);
    setShowAdd(true);
  };

  const handleAddRule = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!title.trim() || !activePocket) return;
    const amountMinor = parseFlexibleMoneyInput(amountText, 'VND');
    if (amountMinor <= 0) return;
    const totalOccurrences =
      ruleKind === 'installment' ? Math.max(1, Number(termsText) || 3) : null;

    await recurringRepository.createRuleAtomic({
      title,
      templateType: ruleKind === 'salary' ? 'income' : 'expense',
      categoryId: ruleKind === 'salary' ? SYSTEM_CATEGORY_IDS.salary : null,
      amountMinor,
      frequency: ruleKind === 'installment' || ruleKind === 'salary' ? 'monthly' : frequency,
      nextRunDate,
      accountId: activePocket.account_id,
      pocketId: activePocket.id,
      totalOccurrences,
    });

    await onboardingRepository.markStepCompleted(
      ruleKind === 'installment' ? 'created_first_budget_or_goal' : 'tried_3_second_quick_add',
    );

    setTitle('');
    setAmountText('');
    setTermsText('3');
    setShowAdd(false);
  };

  const handleConfirmRule = async (
    rule: RecurringRule,
    overrideAmountMinor?: number,
  ): Promise<void> => {
    if (processingRuleId === rule.id) return;
    setProcessingRuleId(rule.id);
    try {
      const finalMinor =
        overrideAmountMinor !== undefined && overrideAmountMinor > 0
          ? overrideAmountMinor
          : rule.amount_minor;
      const updatedRule = await recurringRepository.confirmDueRuleAtomic(rule.id, finalMinor);
      const targetPocket =
        pockets.find((p) => p.id === rule.pocket_id || p.account_id === rule.account_id) ??
        activePocket;
      const walletLabel = targetPocket ? getAccountDisplayName(targetPocket, locale) : '';
      const formattedAmt = formatMoney(finalMinor, 'VND');

      if (rule.template_type === 'income') {
        triggerCelebration({
          kind: 'salary_confirmed',
          variant: 'modal',
          flowMascot: 'income',
          amountText: `+${formattedAmt} · ${rule.title}`,
          title: isVi ? 'Đã xác nhận khoản thu định kỳ! 🎉' : 'Recurring Income Confirmed! 🎉',
          subtitle: isVi
            ? `Đã cộng +${formattedAmt} vào ${walletLabel}. Kỳ kế tiếp đã chuyển sang ngày ${updatedRule.next_run_date}.`
            : `Added +${formattedAmt} to ${walletLabel}. Next cycle is scheduled for ${updatedRule.next_run_date}.`,
        });
      } else {
        triggerCelebration({
          kind: 'transaction_saved',
          variant: 'toast',
          flowMascot: 'expense',
          title: isVi
            ? `Đã ghi nhận -${formattedAmt} (${rule.title})`
            : `Confirmed -${formattedAmt} (${rule.title})`,
          subtitle: isVi
            ? `Kỳ kế tiếp: ${updatedRule.next_run_date}`
            : `Next due: ${updatedRule.next_run_date}`,
        });
      }
      setPayingRuleId(null);
      setCustomPayAmountText('');
      setConfirmingEarlyRuleId(null);
    } finally {
      setProcessingRuleId(null);
    }
  };

  const handleConfirmWithCustomAmount = async (rule: RecurringRule): Promise<void> => {
    const parsedMinor = parseFlexibleMoneyInput(customPayAmountText, 'VND');
    const actualMinor =
      customPayAmountText.trim() && parsedMinor > 0 ? parsedMinor : rule.amount_minor;
    await handleConfirmRule(rule, actualMinor);
  };

  const previewAmountMinor = parseFlexibleMoneyInput(amountText, 'VND');
  const previewTerms = Math.max(1, Number(termsText) || 3);

  return (
    <Card className="space-y-3.5">
      {/* Companion Hero Stage with Oversized Corner-Peeking Memory VOI (07-voi-tri-nho) */}
      <div
        style={{ backgroundColor: activeBuddy.cardBgHex }}
        className="relative overflow-hidden rounded-[24px] border border-[#191919]/12 p-4 pr-24 text-[#191919]"
      >
        <div className="pointer-events-none absolute -right-7 -bottom-7 h-32 w-32 rounded-full border-2 border-[#FFFFFF] bg-[#FFFFFF]/75" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-[#191919]">{t.m3.recurringTitle}</h3>
            <p className="mt-0.5 text-xs font-semibold text-[#191919]/75">
              {isVi
                ? 'Hoá đơn cố định (nhà, điện, nước) & trả góp theo kỳ.'
                : 'Monthly bills (rent, utilities) & N-term installments.'}
            </p>
          </div>
          <Button
            variant={showAdd ? 'outline' : 'ink'}
            size="xs"
            onClick={() => setShowAdd((v) => !v)}
            className="shrink-0"
          >
            {showAdd ? (
              <>
                <X className="h-3.5 w-3.5" />
                <span>{isVi ? 'Đóng' : 'Close'}</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                <span>{isVi ? 'Thêm lịch' : 'Add New'}</span>
              </>
            )}
          </Button>
        </div>

        <div className="pointer-events-none absolute -right-2 -bottom-3 z-10">
          <GeometricBuddy shape="hexagon" pose="memory" mood="happy" size={104} />
        </div>
      </div>

      {/* 1-Tap Quick Templates (Only shown when adding or empty) */}
      {showAdd && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-[var(--ink-muted)]">
            {isVi ? 'Mẫu nhanh:' : 'Presets:'}
          </span>
          <button
            type="button"
            onClick={() =>
              applyQuickPreset({
                kind: 'salary',
                title: isVi ? 'Lương hàng tháng' : 'Monthly Salary',
                amount: '18000000',
              })
            }
            className="inline-flex items-center gap-1 rounded-full border border-[#10B981]/35 bg-[#10B981]/12 px-2.5 py-1 text-[11px] font-bold text-[#059669] transition hover:bg-[#10B981]/20"
          >
            <Banknote className="h-3 w-3 text-[#059669]" />
            <span>{isVi ? 'Lương tháng' : 'Salary'}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              applyQuickPreset({
                kind: 'bill',
                title: isVi ? 'Tiền thuê nhà' : 'Monthly Rent',
                amount: '4500000',
              })
            }
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-primary)] transition hover:border-[var(--border-strong)]"
          >
            <Home className="h-3 w-3 text-[#2563EB]" />
            <span>{isVi ? 'Tiền nhà' : 'Rent'}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              applyQuickPreset({
                kind: 'bill',
                title: isVi ? 'Tiền điện & nước' : 'Electricity & Water',
                amount: '850000',
              })
            }
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-primary)] transition hover:border-[var(--border-strong)]"
          >
            <Zap className="h-3 w-3 text-[#F59E0B]" />
            <span>{isVi ? 'Điện / Nước' : 'Utilities'}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              applyQuickPreset({
                kind: 'installment',
                title: isVi ? 'Trả góp 3 tháng' : '3-Month Installment',
                amount: '1500000',
                terms: '3',
              })
            }
            className="inline-flex items-center gap-1 rounded-full border border-[#EC4899]/30 bg-[#EC4899]/10 px-2.5 py-1 text-[11px] font-bold text-[#DB2777] transition hover:bg-[#EC4899]/18"
          >
            <CreditCard className="h-3 w-3 text-[#DB2777]" />
            <span>{isVi ? 'Trả góp 3 kỳ' : '3-Term Plan'}</span>
          </button>
        </div>
      )}

      {showAdd && (
        <form
          onSubmit={(e) => void handleAddRule(e)}
          className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 p-3.5"
        >
          {/* Concise 1-Line Segmented Tabs */}
          <SegmentedControl<RuleKindMode>
            ariaLabel="Rule Type"
            size="sm"
            value={ruleKind}
            onChange={setRuleKind}
            className="w-full"
            options={[
              {
                id: 'salary',
                label: isVi ? 'Lương tháng' : 'Salary',
              },
              {
                id: 'bill',
                label: isVi ? 'Hoá đơn' : 'Bills',
              },
              {
                id: 'installment',
                label: isVi ? 'Trả góp' : 'Installment',
              },
            ]}
          />

          {/* Row 1: Full-width Name Input */}
          <div>
            <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
              {ruleKind === 'installment'
                ? isVi
                  ? 'Tên khoản trả góp'
                  : 'Installment Item Name'
                : isVi
                  ? 'Tên hoá đơn cố định'
                  : 'Bill / Subscription Name'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                ruleKind === 'installment'
                  ? isVi
                    ? 'VD: Mua iPhone, Tai nghe, Laptop...'
                    : 'e.g. MacBook Air, AirPods...'
                  : isVi
                    ? 'VD: Tiền thuê nhà, Điện nước, Netflix...'
                    : 'e.g. Monthly Rent, Electricity, Internet...'
              }
              className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--ink-primary)]"
            />
          </div>

          {/* Row 2: Amount per cycle + Pay from Wallet (strictly aligned 1-line labels) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                {ruleKind === 'installment'
                  ? isVi
                    ? 'Số tiền mỗi kỳ (VND)'
                    : 'Amount / Term (VND)'
                  : isVi
                    ? 'Số tiền dự kiến (VND)'
                    : 'Expected Amount (VND)'}
              </label>
              <input
                type="text"
                required
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="850000"
                className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-2 text-xs font-extrabold text-[var(--ink-primary)] tabular-nums"
              />
            </div>

            <div>
              <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                {isVi ? 'Ví thanh toán' : 'Pay from Wallet'}
              </label>
              <select
                value={activePocket?.id ?? ''}
                onChange={(e) => setSelectedPocketId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)]"
              >
                {pockets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Next Due Date + Cycle OR Number of Terms (strictly aligned 1-line labels) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                {isVi ? 'Ngày đến hạn kế tiếp' : 'Next Due Date'}
              </label>
              <input
                type="date"
                value={nextRunDate}
                onChange={(e) => setNextRunDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)]"
              />
            </div>

            {ruleKind === 'installment' ? (
              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Tổng số kỳ (Tháng)' : 'Total Terms (Months)'}
                </label>
                <div className="mt-1 flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={termsText}
                    onChange={(e) => setTermsText(e.target.value)}
                    placeholder={t.m3.installmentTermsLabel}
                    className="w-14 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2 py-2 text-center text-xs font-extrabold text-[var(--ink-primary)] tabular-nums"
                  />
                  {[3, 6, 12].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTermsText(String(n))}
                      className={
                        'flex-1 rounded-lg py-1.5 text-[11px] font-extrabold transition ' +
                        (Number(termsText) === n
                          ? 'bg-[#141413] text-white'
                          : 'border border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-secondary)]')
                      }
                    >
                      {n}m
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="block truncate text-[11px] font-bold text-[var(--ink-secondary)]">
                  {isVi ? 'Chu kỳ lặp lại' : 'Billing Cycle'}
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-2 text-xs font-semibold text-[var(--ink-primary)]"
                >
                  <option value="monthly">{isVi ? 'Hàng tháng' : 'Monthly'}</option>
                  <option value="weekly">{isVi ? 'Hàng tuần' : 'Weekly'}</option>
                  <option value="yearly">{isVi ? 'Hàng năm' : 'Yearly'}</option>
                </select>
              </div>
            )}
          </div>

          {/* Live Calculation Preview Banner */}
          {previewAmountMinor > 0 && (
            <div className="rounded-xl bg-[var(--bg-card)] px-3 py-2 text-[11px] font-semibold text-[var(--ink-secondary)]">
              {ruleKind === 'installment' ? (
                <span>
                  {isVi
                    ? `Trả góp ${previewTerms} kỳ × ${formatMoney(previewAmountMinor, 'VND')} = Tổng cộng `
                    : `${previewTerms} terms × ${formatMoney(previewAmountMinor, 'VND')} = Total `}
                  <strong className="font-extrabold text-[var(--ink-primary)]">
                    {formatMoney(previewAmountMinor * previewTerms, 'VND')}
                  </strong>
                </span>
              ) : (
                <span>
                  {isVi
                    ? `Dự kiến ${formatMoney(previewAmountMinor, 'VND')} / kỳ (khi thanh toán thực tế bạn có thể sửa lại số tiền điện/nước).`
                    : `Expected ${formatMoney(previewAmountMinor, 'VND')} / cycle (you can adjust actual utility amount when paying).`}
                </span>
              )}
            </div>
          )}

          <Button type="submit" variant="pop" size="md" fullWidth>
            {ruleKind === 'installment'
              ? isVi
                ? 'Lưu khoản trả góp'
                : 'Save Installment Plan'
              : isVi
                ? 'Lưu hoá đơn định kỳ'
                : 'Save Recurring Bill'}
          </Button>
        </form>
      )}

      {rules.length === 0 ? (
        <div className="space-y-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/45 p-3">
          <p className="text-[11px] font-bold text-[var(--ink-secondary)]">
            {isVi
              ? 'Chưa có lịch định kỳ đang chạy — Chọn mẫu bên dưới để tạo trong 2 giây:'
              : 'No active recurring items yet — Tap a starter template below to set up in 2 seconds:'}
          </p>
          <div className="divide-y divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3">
            {[
              {
                kind: 'bill' as RuleKindMode,
                title: isVi ? 'Tiền thuê nhà' : 'Monthly Rent',
                sub: isVi ? 'Hoá đơn cố định hàng tháng' : 'Fixed monthly housing bill',
                amount: '4500000',
                badge: '4.500.000đ/mo',
                icon: <Home className="h-4 w-4" />,
                bgCls: 'bg-[#3B82F6]/12 text-[#2563EB]',
              },
              {
                kind: 'bill' as RuleKindMode,
                title: isVi ? 'Tiền điện & nước' : 'Electricity & Water',
                sub: isVi
                  ? 'Cho phép chỉnh số tiền thực tế mỗi kỳ'
                  : 'Variable utility bill (editable when due)',
                amount: '850000',
                badge: '~850.000đ/mo',
                icon: <Zap className="h-4 w-4" />,
                bgCls: 'bg-[#F59E0B]/14 text-[#D97706]',
              },
              {
                kind: 'installment' as RuleKindMode,
                title: isVi ? 'Trả góp 3 tháng' : '3-Month Installment',
                sub: isVi
                  ? 'Tự đếm số kỳ (1/3 → 3/3) và số dư còn lại'
                  : 'Auto-tracks remaining terms (1/3 → 3/3)',
                amount: '1500000',
                terms: '3',
                badge: '1.500.000đ × 3',
                icon: <CreditCard className="h-4 w-4" />,
                bgCls: 'bg-[#EC4899]/12 text-[#DB2777]',
              },
            ].map((tpl) => (
              <button
                key={tpl.title}
                type="button"
                onClick={() =>
                  applyQuickPreset({
                    kind: tpl.kind,
                    title: tpl.title,
                    amount: tpl.amount,
                    terms: tpl.terms,
                  })
                }
                className="flex w-full items-center justify-between gap-2.5 py-2.5 text-left transition hover:opacity-85"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${tpl.bgCls}`}
                  >
                    {tpl.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-[var(--ink-primary)]">
                      {tpl.title}
                    </p>
                    <p className="truncate text-[11px] text-[var(--ink-secondary)]">{tpl.sub}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded-lg bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-primary)] tabular-nums">
                    {tpl.badge}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Card.Body className="space-y-2.5">
          {rules.map((rule) => {
            const isDue = isRecurringRuleDue(rule, todayIso);
            const installmentBadge = formatInstallmentProgress(rule, locale);
            const isInstallment = Boolean(rule.total_occurrences && rule.total_occurrences > 0);
            const isSalary = rule.template_type === 'income';
            const totalTerms = rule.total_occurrences ?? 0;
            const doneTerms = rule.occurrences_done ?? 0;
            const remainingTerms = Math.max(0, totalTerms - doneTerms);
            const remainingPayoffMinor = remainingTerms * rule.amount_minor;
            const progressPct =
              totalTerms > 0 ? Math.min(100, Math.round((doneTerms / totalTerms) * 100)) : 0;
            const isAdjustingPay = payingRuleId === rule.id;

            return (
              <div
                key={rule.id}
                className="space-y-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                        isSalary
                          ? 'bg-[#10B981]/14 text-[#059669]'
                          : isInstallment
                            ? 'bg-[#EC4899]/12 text-[#DB2777]'
                            : 'bg-[#3B82F6]/12 text-[#2563EB]'
                      }`}
                      aria-hidden="true"
                    >
                      {isSalary ? (
                        <Banknote className="h-[18px] w-[18px]" strokeWidth={2.2} />
                      ) : isInstallment ? (
                        <CreditCard className="h-[18px] w-[18px]" strokeWidth={2.2} />
                      ) : (
                        <CalendarClock className="h-[18px] w-[18px]" strokeWidth={2.2} />
                      )}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-extrabold text-[var(--ink-primary)]">
                          {rule.title}
                        </p>
                        {isSalary ? (
                          <span className="rounded-full bg-[#10B981]/14 px-2 py-0.5 text-[10px] font-bold text-[#059669]">
                            {isVi ? 'Thu nhập định kỳ' : 'Monthly Salary'}
                          </span>
                        ) : installmentBadge ? (
                          <span className="rounded-full bg-[#F472B6]/15 px-2 py-0.5 text-[10px] font-bold text-[#DB2777]">
                            {installmentBadge}
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#3B82F6]/12 px-2 py-0.5 text-[10px] font-bold text-[#2563EB]">
                            {isVi ? 'Hoá đơn hàng tháng' : 'Monthly Bill'}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[var(--ink-secondary)]">
                        {isDue ? (
                          <span className="font-bold text-[#FF6B35]">{t.m3.dueConfirmBadge}</span>
                        ) : (
                          <span>
                            {isVi ? 'Kỳ kế tiếp:' : 'Next due:'} {rule.next_run_date}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-extrabold text-[var(--ink-primary)] tabular-nums">
                      {formatMoney(rule.amount_minor, 'VND')}
                    </span>
                    <p className="text-[10px] font-semibold text-[var(--ink-muted)]">
                      {isVi ? '/ kỳ' : '/ cycle'}
                    </p>
                  </div>
                </div>

                {/* Installment Progress Bar & Remaining Payoff Info */}
                {isInstallment && (
                  <div className="space-y-1 rounded-xl bg-[var(--bg-card)] p-2.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-[var(--ink-secondary)]">
                        {isVi
                          ? `Đã trả ${doneTerms}/${totalTerms} kỳ (${progressPct}%)`
                          : `Paid ${doneTerms}/${totalTerms} terms (${progressPct}%)`}
                      </span>
                      <span className="text-[var(--ink-primary)] tabular-nums">
                        {isVi ? 'Còn lại:' : 'Remaining:'}{' '}
                        {formatMoney(remainingPayoffMinor, 'VND')}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                      <div
                        className="h-full rounded-full bg-[#F472B6] transition-all"
                        style={{ width: `${Math.max(8, progressPct)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Variable Amount Pay Box (for Electricity/Water bills or custom amount) */}
                {isAdjustingPay && (
                  <div className="flex items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] p-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customPayAmountText}
                      onChange={(e) => setCustomPayAmountText(e.target.value)}
                      placeholder={
                        isVi ? 'Nhập số tiền thực tế kỳ này...' : 'Actual amount this cycle...'
                      }
                      className="flex-1 rounded-lg bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs font-bold text-[var(--ink-primary)] tabular-nums"
                    />
                    <Button
                      variant="pop"
                      size="xs"
                      onClick={() => void handleConfirmWithCustomAmount(rule)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{isVi ? 'Ghi sổ' : 'Post'}</span>
                    </Button>
                  </div>
                )}

                {/* 2-Step Confirmation Guard When Recording a Future Cycle Early (Prevents Accidental Double-Clicks!) */}
                {!isDue && confirmingEarlyRuleId === rule.id && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#191919] bg-[#F7F296]/70 px-3 py-2 text-xs text-[#191919]">
                    <span className="font-bold">
                      {isVi
                        ? `Kỳ này đã xong! Bạn muốn ghi sớm kỳ kế tiếp (${rule.next_run_date})?`
                        : `Already confirmed! Record next cycle (${rule.next_run_date}) early?`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={processingRuleId === rule.id}
                        onClick={() => void handleConfirmRule(rule)}
                        className="rounded-lg bg-[#191919] px-2.5 py-1 text-[11px] font-black text-[#FAFAFA] disabled:opacity-50"
                      >
                        {isVi ? 'Đồng ý ghi sớm' : 'Yes, post early'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingEarlyRuleId(null)}
                        className="rounded-lg border border-[#191919]/20 bg-[#FAFAFA] px-2 py-1 text-[11px] font-bold text-[#191919]"
                      >
                        {isVi ? 'Huỷ' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Clean 1-Row Action Footer */}
                <div className="flex items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isDue ? (
                      <Button
                        variant="ink"
                        size="xs"
                        disabled={processingRuleId === rule.id}
                        onClick={() => void handleConfirmRule(rule)}
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{t.m3.confirmBtn}</span>
                      </Button>
                    ) : (
                      <>
                        {/* Clear Confirmed Badge so user knows this cycle is already done */}
                        <span
                          data-testid={`recurring-confirmed-badge-${rule.id}`}
                          className="inline-flex items-center gap-1 rounded-full border border-[#191919]/15 bg-[#B7EDB8] px-2.5 py-1 text-[11px] font-extrabold text-[#191919]"
                        >
                          <Check className="h-3.5 w-3.5 stroke-[2.8]" />
                          <span>{isVi ? 'Đã xác nhận kỳ này' : 'Confirmed this cycle'}</span>
                        </span>

                        {confirmingEarlyRuleId !== rule.id && (
                          <button
                            type="button"
                            onClick={() => setConfirmingEarlyRuleId(rule.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-secondary)] transition hover:border-[#191919] hover:text-[var(--ink-primary)]"
                          >
                            <span>
                              {isInstallment
                                ? isVi
                                  ? `Trả sớm kỳ ${doneTerms + 1}/${totalTerms}`
                                  : `Pay Term ${doneTerms + 1}/${totalTerms} early`
                                : isVi
                                  ? 'Ghi sớm kỳ tới'
                                  : 'Log next cycle early'}
                            </span>
                          </button>
                        )}
                      </>
                    )}

                    {!isInstallment && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayingRuleId(isAdjustingPay ? null : rule.id);
                          setCustomPayAmountText(String(rule.amount_minor));
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
                      >
                        <span>{isVi ? 'Sửa số tiền' : 'Edit amount'}</span>
                      </button>
                    )}

                    {isInstallment && remainingTerms > 1 && (
                      <button
                        type="button"
                        data-testid={`early-payoff-btn-${rule.id}`}
                        onClick={() =>
                          void recurringRepository.settleInstallmentEarlyAtomic(rule.id)
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-[#10B981]/35 bg-[#10B981]/12 px-2.5 py-1 text-[11px] font-bold text-[#065F46] hover:bg-[#10B981]/20"
                      >
                        <FastForward className="h-3 w-3 text-[#10B981]" />
                        <span>{isVi ? 'Tất toán sớm' : 'Early Payoff'}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title={t.m3.skipCycleBtn}
                      onClick={() => void recurringRepository.skipDueRuleAtomic(rule.id)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-[var(--ink-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--ink-primary)]"
                    >
                      <SkipForward className="h-3 w-3" />
                      <span>{isVi ? 'Bỏ qua' : 'Skip'}</span>
                    </button>

                    <button
                      type="button"
                      title={isVi ? 'Xoá' : 'Remove'}
                      aria-label={isVi ? 'Xoá' : 'Remove'}
                      onClick={() => void recurringRepository.deleteRuleAtomic(rule.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </Card.Body>
      )}
    </Card>
  );
}
