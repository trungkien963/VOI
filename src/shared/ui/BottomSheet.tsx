import { useEffect, type ReactElement, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  closeLabel: string;
  headerAccessory?: ReactNode;
  children: ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  titleId,
  closeLabel,
  headerAccessory,
  children,
}: BottomSheetProps): ReactElement | null {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="clean-card flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden p-4">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
          <div className="flex items-center gap-2.5">
            {headerAccessory}
            <h2 id={titleId} className="text-base font-bold text-[var(--ink-primary)]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--ink-primary)] transition hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 -mx-1 -my-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-1">
          {children}
        </div>
      </div>
    </div>
  );
}
