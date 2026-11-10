import type { ReactElement } from 'react';
import { Delete } from 'lucide-react';
import {
  applyKeypadInput,
  evaluateMoneyExpression,
  hasPendingOperator,
  type CalculatorKey,
} from '../../domain/money/calculator';
import { formatVnd, useTranslation } from '../i18n';

export interface CalculatorKeypadProps {
  expression: string;
  onChangeExpression: (nextExpr: string) => void;
  onSubmit: (amountMinor: number) => void;
  submitLabel: string;
}

const KEY_ROWS: ReadonlyArray<ReadonlyArray<CalculatorKey>> = [
  ['7', '8', '9', '÷'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '-'],
  ['000', '0', 'BACKSPACE', '+'],
];

export function CalculatorKeypad({
  expression,
  onChangeExpression,
  onSubmit,
  submitLabel,
}: CalculatorKeypadProps): ReactElement {
  const { t } = useTranslation();
  const evaluatedAmount = evaluateMoneyExpression(expression);
  const showEqualsFirst = hasPendingOperator(expression);

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
      {/* Live Expression & Evaluated Amount Bar */}
      <div className="flex items-center justify-between rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-1.5">
        <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
          <span className="truncate text-xs font-medium text-[var(--ink-secondary)] tabular-nums">
            {expression || '0'}
          </span>
          <p
            className="text-lg font-extrabold text-[var(--ink-primary)] tabular-nums"
            data-testid="calculator-evaluated-amount"
          >
            {formatVnd(evaluatedAmount)}
          </p>
        </div>
        {expression.length > 0 && (
          <button
            type="button"
            onClick={() => handleKeyPress('C')}
            className="ml-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
          >
            {t.calculator.clearBtn}
          </button>
        )}
      </div>

      {/* 4x4 Arithmetic Keypad Grid */}
      <div className="grid grid-cols-4 gap-1">
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
              className={`flex h-9 items-center justify-center rounded-xl border text-xs font-bold tabular-nums transition active:scale-95 ${
                isOp
                  ? 'border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--ink-primary)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-card)] text-[var(--ink-primary)] hover:border-[var(--border-strong)]'
              }`}
            >
              {key === 'BACKSPACE' ? <Delete className="h-3.5 w-3.5" /> : key}
            </button>
          );
        })}
      </div>

      {/* Submit or "=" Button */}
      <button
        type="button"
        onClick={handlePrimaryAction}
        className="flex w-full items-center justify-center rounded-full bg-[#141413] py-2.5 text-sm font-bold text-white transition hover:opacity-95 active:scale-[0.99]"
      >
        {showEqualsFirst ? t.calculator.computeEqualsBtn : submitLabel}
      </button>
    </div>
  );
}
