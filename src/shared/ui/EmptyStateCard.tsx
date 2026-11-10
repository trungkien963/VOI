import type { ReactElement, ReactNode } from 'react';
import { Card } from './Card';
import { GeometricClusterIcon, type ClusterIconVariant } from './GeometricClusterIcon';

export interface EmptyStateCardProps {
  clusterVariant: ClusterIconVariant;
  title: string;
  subtitle?: string;
  emptyTitle?: string;
  emptyDesc?: string;
  action?: ReactNode;
}

export function EmptyStateCard({
  clusterVariant,
  title,
  subtitle,
  emptyTitle,
  emptyDesc,
  action,
}: EmptyStateCardProps): ReactElement {
  return (
    <Card padding="lg" className="text-center">
      <div className="mx-auto flex justify-center">
        <GeometricClusterIcon variant={clusterVariant} size={96} />
      </div>
      <h2 className="mt-3 text-base font-bold text-[var(--ink-primary)]">{title}</h2>
      {subtitle && (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">{subtitle}</p>
      )}
      {emptyTitle && (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-strong)] p-4">
          <p className="text-sm font-semibold text-[var(--ink-primary)]">{emptyTitle}</p>
          {emptyDesc && <p className="mt-1 text-xs text-[var(--ink-secondary)]">{emptyDesc}</p>}
        </div>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}
