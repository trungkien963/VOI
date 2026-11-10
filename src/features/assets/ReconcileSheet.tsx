import { useState, type FormEvent, type ReactElement } from 'react';
import { pocketRepository } from '../../db/repositories/pocket-repository';
import { formatMoney, parseFlexibleMoneyInput } from '../../domain/money/currency';
import type { Pocket } from '../../domain/types/entities';
import { useTranslation } from '../../shared/i18n';
import { BottomSheet } from '../../shared/ui/BottomSheet';
import { Button } from '../../shared/ui/Button';
import { GeometricBuddy } from '../../shared/ui/GeometricBuddy';

export interface ReconcileSheetProps {
  pocket: Pocket | null;
  onClose: () => void;
  onReconciled: (message: string) => void;
}

export function ReconcileSheet({
  pocket,
  onClose,
  onReconciled,
}: ReconcileSheetProps): ReactElement | null {
  const { t } = useTranslation();
  const [actualMajorText, setActualMajorText] = useState('');

  if (!pocket) return null;

  const currency = pocket.currency ?? 'VND';

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const actualMinor = parseFlexibleMoneyInput(actualMajorText, currency);
    const res = await pocketRepository.reconcilePocketBalanceAtomic(pocket.id, actualMinor);

    const feedback =
      res.kind === 'matched'
        ? t.m3.reconcileMatchedMsg
        : res.kind === 'deficit'
          ? t.m3.reconcileDeficitMsg
          : t.m3.reconcileSurplusMsg;

    setActualMajorText('');
    onReconciled(feedback);
    onClose();
  };

  return (
    <BottomSheet
      open={Boolean(pocket)}
      onClose={onClose}
      title={`${t.m3.reconcileTitle} · ${pocket.name}`}
      titleId="reconcile-sheet-title"
      closeLabel={t.quickAddModal.closeBtn}
      headerAccessory={
        <GeometricBuddy
          shape={pocket.icon_name}
          colorHex={pocket.color_hex}
          accessory="glasses"
          mood="happy"
          size={34}
        />
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-3">
          <p className="text-xs font-semibold text-[var(--ink-secondary)]">
            {t.m3.appBalanceLabel}
          </p>
          <p className="mt-0.5 text-lg font-extrabold text-[var(--ink-primary)] tabular-nums">
            {formatMoney(pocket.cached_balance_minor, currency)}
          </p>
        </div>

        <div>
          <label
            htmlFor="reconcile-actual-input"
            className="block text-xs font-bold text-[var(--ink-secondary)]"
          >
            {t.m3.actualBalanceLabel} ({currency})
          </label>
          <input
            id="reconcile-actual-input"
            type="text"
            inputMode="decimal"
            value={actualMajorText}
            onChange={(e) => setActualMajorText(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-3 py-2.5 text-sm font-bold text-[var(--ink-primary)] tabular-nums"
          />
        </div>

        <Button type="submit" variant="pop" size="lg" fullWidth>
          {t.m3.reconcileBtn}
        </Button>
      </form>
    </BottomSheet>
  );
}
