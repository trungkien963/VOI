import type { ReactElement, ReactNode } from 'react';
import { useUiStore } from '../../app/ui-store';
import { getAvatarPresetMeta } from '../../features/onboarding/WelcomeOnboardingModal';
import { Card } from './Card';
import { GeometricBuddy } from './GeometricBuddy';
import { type ClusterIconVariant } from './GeometricClusterIcon';

export interface EmptyStateCardProps {
  clusterVariant: ClusterIconVariant;
  title: string;
  subtitle?: string;
  emptyTitle?: string;
  emptyDesc?: string;
  action?: ReactNode;
}

export function EmptyStateCard({
  title,
  subtitle,
  emptyTitle,
  emptyDesc,
  action,
}: EmptyStateCardProps): ReactElement {
  const avatarId = useUiStore((s) => s.avatarId);
  const activeBuddy = getAvatarPresetMeta(avatarId);

  return (
    <Card padding="lg" className="relative overflow-hidden text-left">
      {/* Tinted Companion Stage Header with Oversized Corner-Peeking Mascot */}
      <div
        style={{ backgroundColor: activeBuddy.cardBgHex }}
        className="relative overflow-hidden rounded-3xl border border-[#191919]/10 p-5 pr-28 text-[#191919]"
      >
        <div
          style={{ backgroundColor: activeBuddy.characterFillHex }}
          className="pointer-events-none absolute -right-8 -bottom-8 h-36 w-36 rounded-full opacity-20"
        />
        <h2 className="relative z-10 text-base font-black text-[#191919]">{title}</h2>
        {subtitle && (
          <p className="relative z-10 mt-1 text-xs leading-relaxed font-semibold text-[#191919]/80">
            {subtitle}
          </p>
        )}

        {/* Oversized Corner-Peeking Buddy (BAEMIN / Plopp Style) */}
        <div className="pointer-events-none absolute -right-3 -bottom-4">
          <GeometricBuddy
            shape={activeBuddy.shape}
            colorHex={activeBuddy.characterFillHex}
            accessory={activeBuddy.accessory}
            blush
            mood="happy"
            size={120}
          />
        </div>
      </div>

      {emptyTitle && (
        <div className="mt-3 rounded-2xl border border-dashed border-[var(--border-strong)] p-4 text-center">
          <p className="text-sm font-bold text-[var(--ink-primary)]">{emptyTitle}</p>
          {emptyDesc && <p className="mt-1 text-xs text-[var(--ink-secondary)]">{emptyDesc}</p>}
        </div>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}
