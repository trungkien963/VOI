import type { ReactElement } from 'react';
import { Delete } from 'lucide-react';
import { useUiStore } from '../../app/ui-store';
import {
  applyKeypadInput,
  evaluateMoneyExpression,
  hasPendingOperator,
  type CalculatorKey,
} from '../../domain/money/calculator';
import type { BuddyMood } from '../../domain/types/entities';
import { getAvatarPresetMeta } from '../../features/onboarding/WelcomeOnboardingModal';
import { formatVnd, useTranslation } from '../i18n';
import { GeometricBuddy } from './GeometricBuddy';
import { VoiFlowIcon } from './VoiFlowIcon';

export type KeypadFlowMascot = 'expense' | 'income' | 'transfer' | 'lend-borrow';

export interface CalculatorKeypadProps {
  expression: string;
  onChangeExpression: (nextExpr: string) => void;
  onSubmit: (amountMinor: number) => void;
  submitLabel: string;
  flowMascot?: KeypadFlowMascot;
}

const KEY_ROWS: ReadonlyArray<ReadonlyArray<CalculatorKey>> = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '-'],
  ['000', '0', 'BACKSPACE', '+'],
];

const FLOW_STAGE_META: Record<
  KeypadFlowMascot,
  {
    bgHex: string;
    borderHex: string;
    auraHex: string;
    labelVi: string;
    labelEn: string;
  }
> = {
  expense: {
    bgHex: '#F9F2FF',
    borderHex: '#C870EA',
    auraHex: '#E7A0FE',
    labelVi: 'Bé Cánh Tím đang ghi chi tiêu:',
    labelEn: 'Winged Buddy logging expense:',
  },
  income: {
    bgHex: '#F3FCE9',
    borderHex: '#72B636',
    auraHex: '#D0FFA3',
    labelVi: 'Bé Mầm Hoa đang đón thu nhập:',
    labelEn: 'Sprout Buddy logging income:',
  },
  transfer: {
    bgHex: '#EEFAFF',
    borderHex: '#26A6D1',
    auraHex: '#83E7FF',
    labelVi: 'Bé Runner đang chuyển khoản:',
    labelEn: 'Runner Buddy transferring:',
  },
  'lend-borrow': {
    bgHex: '#FFF2F6',
    borderHex: '#FF5C74',
    auraHex: '#FFA3C5',
    labelVi: 'Đôi Cherry đang chia bill:',
    labelEn: 'Twin Cherries splitting bill:',
  },
};

export function CalculatorKeypad({
  expression,
  onChangeExpression,
  onSubmit,
  submitLabel,
  flowMascot,
}: CalculatorKeypadProps): ReactElement {
  const { t, locale } = useTranslation();
  const avatarId = useUiStore((s) => s.avatarId);
  const activeBuddy = getAvatarPresetMeta(avatarId);
  const isVi = locale === 'vi';
  const evaluatedAmount = evaluateMoneyExpression(expression);
  const showEqualsFirst = hasPendingOperator(expression);
  const hasOperatorInExpr = /[+\-×÷*/]/.test(expression);

  const keypadBuddyMood: BuddyMood =
    evaluatedAmount >= 2_000_000
      ? 'surprised'
      : evaluatedAmount >= 500_000
        ? 'excited'
        : evaluatedAmount > 0
          ? 'wink'
          : 'happy';

  const flowMeta = flowMascot ? FLOW_STAGE_META[flowMascot] : null;
  const stageBgHex = flowMeta ? flowMeta.bgHex : activeBuddy.cardBgHex;
  const stageBorderHex = flowMeta ? flowMeta.borderHex : '#19191926';
  const stageAuraHex = flowMeta ? flowMeta.auraHex : activeBuddy.characterFillHex;

  const statusText = hasOperatorInExpr
    ? `${expression} =`
    : evaluatedAmount >= 2_000_000
      ? isVi
        ? '😮 Khoản lớn nè!'
        : '😮 Big amount!'
      : flowMeta
        ? isVi
          ? flowMeta.labelVi
          : flowMeta.labelEn
        : isVi
          ? `${activeBuddy.nameVi} đang ghi:`
          : `${activeBuddy.nameEn} logging:`;

  const handleKeyPress = (key: CalculatorKey): void => {
    onChangeExpression(applyKeypadInput(expression, key));
  };

  const handlePrimaryAction = (): void => {
    if (showEqualsFirst) {
      onChangeExpression(applyKeypadInput(expression, '='));
      return;
    }
    onSubmit(evaluatedAmount);
  };

  return (
    <div className="space-y-2" aria-label={t.calculator.ariaLabel}>
      {/* Spacious 2-Tier Live Expression & Evaluated Amount Stage with Contextual Flow Mascot */}
      <div
        style={{
          backgroundColor: stageBgHex,
          borderColor: stageBorderHex,
        }}
        className="relative overflow-hidden rounded-[24px] border-2 px-4 py-3 pr-22 text-[#191919] transition-colors"
      >
        {/* Crisp White Contrast Pedestal Halo behind Mascot so Character Pops Vividly */}
        <div
          style={{ borderColor: `${stageAuraHex}80` }}
          className="pointer-events-none absolute -right-4 -bottom-5 h-24 w-24 rounded-full border-2 bg-[#FFFFFF]/95 shadow-xs"
        />

        <div className="relative z-10 flex flex-col gap-1.5">
          {/* Tier 1: Status / Expression Label + Quick Stepper Pills */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="truncate text-[11px] font-extrabold text-[#191919]/80 tabular-nums">
              {statusText}
            </span>

            <div className="flex items-center gap-1">
              {[
                { label: '+10k', addMinor: 10_000 },
                { label: '+50k', addMinor: 50_000 },
              ].map((stepItem) => (
                <button
                  key={stepItem.label}
                  type="button"
                  onClick={() =>
                    onChangeExpression(String(Math.max(0, evaluatedAmount) + stepItem.addMinor))
                  }
                  className="rounded-full border border-[#191919]/15 bg-[#FFFFFF] px-2.5 py-0.5 text-[10px] font-black text-[#191919] shadow-2xs transition hover:bg-[#FAFAFA] active:scale-95"
                >
                  {stepItem.label}
                </button>
              ))}
              {expression.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleKeyPress('C')}
                  className="rounded-full border border-[#191919]/20 bg-[#191919] px-2.5 py-0.5 text-[10px] font-black text-[#FAFAFA] transition active:scale-95"
                >
                  {t.calculator.clearBtn}
                </button>
              )}
            </div>
          </div>

          {/* Tier 2: Dedicated Full-Width Hero Amount Line (Never collides with pills or mascot!) */}
          <p
            className="truncate text-2xl leading-tight font-black tracking-tight text-[#191919] sm:text-3xl tabular-nums"
            data-testid="calculator-evaluated-amount"
          >
            {formatVnd(evaluatedAmount)}
          </p>
        </div>

        {/* Corner-Peeking Mascot Switching Dynamically by Active Flow & Reacting Live to Typed Amount */}
        <div
          data-testid="calculator-flow-mascot"
          data-flow-mascot={flowMascot ?? 'default'}
          className="pointer-events-none absolute -right-1.5 -bottom-2.5 z-10 transition-transform duration-200"
        >
          {flowMascot ? (
            <VoiFlowIcon variant={flowMascot} mood={keypadBuddyMood} size={76} />
          ) : (
            <GeometricBuddy
              shape={activeBuddy.shape}
              colorHex={activeBuddy.characterFillHex}
              accessory={activeBuddy.accessory}
              blush
              mood={keypadBuddyMood}
              size={78}
            />
          )}
        </div>
      </div>

      {/* 4x4 Arithmetic Keypad Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {KEY_ROWS.flat().map((key) => {
          const isOp = key === '+' || key === '-' || key === '×' || key === '÷';
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleKeyPress(key)}
              aria-label={
                key === 'BACKSPACE'
                  ? t.calculator.backspaceAria
                  : `${t.calculator.keyPrefixAria} ${key}`
              }
              className={`flex h-11 items-center justify-center rounded-2xl border text-sm font-black tabular-nums transition active:scale-95 ${
                isOp
                  ? 'border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--ink-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-primary)] hover:border-[var(--border-strong)]'
              }`}
            >
              {key === 'BACKSPACE' ? <Delete className="h-4 w-4" /> : key}
            </button>
          );
        })}
      </div>

      {/* Submit or "=" Button */}
      <button
        type="button"
        onClick={handlePrimaryAction}
        className="flex w-full items-center justify-center rounded-2xl bg-[#191919] py-3.5 text-base font-black text-[#FAFAFA] shadow-sm transition hover:opacity-95 active:scale-[0.99]"
      >
        {showEqualsFirst ? t.calculator.computeEqualsBtn : submitLabel}
      </button>
    </div>
  );
}
