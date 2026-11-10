import { useEffect, useState, type ReactElement } from 'react';
import { Lock, Shield } from 'lucide-react';
import { useSecurityStore } from '../../app/security-store';
import { useUiStore } from '../../app/ui-store';
import {
  shouldShowPrivacyBlurOverlay,
  verifyPinAgainstRecord,
} from '../../domain/security/app-lock';
import { useTranslation } from '../../shared/i18n';
import { M6_COPY } from '../../shared/i18n/m6-copy';
import { Button } from '../../shared/ui/Button';
import { GeometricBuddy } from '../../shared/ui/GeometricBuddy';

export function PrivacyBlurAndLockOverlay(): ReactElement | null {
  const { locale } = useTranslation();
  const copy = M6_COPY[locale];
  const { hideBalances } = useUiStore();
  const { saltedPinRecord, isAppLocked, lockApp, unlockApp } = useSecurityStore();

  const [isDocumentHidden, setIsDocumentHidden] = useState(false);
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const appLockEnabled = saltedPinRecord !== null;

  useEffect(() => {
    const handleVisibility = (): void => {
      const hidden = document.visibilityState === 'hidden';
      setIsDocumentHidden(hidden);
      if (hidden && appLockEnabled) {
        lockApp();
      }
    };
    const handleBlur = (): void => setIsWindowBlurred(true);
    const handleFocus = (): void => setIsWindowBlurred(false);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [appLockEnabled, lockApp]);

  const showBlurOnly = shouldShowPrivacyBlurOverlay({
    appLockEnabled,
    hideBalances,
    isDocumentHidden,
    isWindowBlurred,
  });

  const handleUnlock = async (): Promise<void> => {
    if (!saltedPinRecord) {
      unlockApp();
      return;
    }
    const ok = await verifyPinAgainstRecord(pinInput, saltedPinRecord);
    if (ok) {
      setPinInput('');
      setErrorMsg(null);
      unlockApp();
    } else {
      setErrorMsg(copy.unlockErrorMsg);
    }
  };

  if (isAppLocked && saltedPinRecord) {
    return (
      <div
        data-testid="app-lock-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-canvas)]/95 p-4 backdrop-blur-xl"
      >
        <div className="w-full max-w-xs space-y-4 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-card)] p-6 text-center shadow-lg">
          <div className="flex justify-center">
            <GeometricBuddy shape="hexagon" colorHex="#3B82F6" mood="happy" size={56} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-[var(--ink-primary)]">
              {copy.unlockTitle}
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-secondary)]">{copy.unlockSubtitle}</p>
          </div>
          <input
            type="password"
            inputMode="numeric"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder={copy.pinPlaceholder}
            aria-label={copy.pinPlaceholder}
            data-testid="app-lock-pin-input"
            className="w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-2.5 text-center text-lg font-extrabold tracking-widest text-[var(--ink-primary)]"
          />
          {errorMsg && <p className="text-xs font-semibold text-[#EF4444]">{errorMsg}</p>}
          <Button
            variant="ink"
            size="md"
            fullWidth
            onClick={() => void handleUnlock()}
            data-testid="app-lock-unlock-btn"
          >
            <Lock className="h-4 w-4" />
            <span>{copy.unlockBtn}</span>
          </Button>
        </div>
      </div>
    );
  }

  if (showBlurOnly) {
    return (
      <div
        data-testid="privacy-blur-overlay"
        className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-[var(--bg-canvas)]/80 backdrop-blur-md"
      >
        <Shield className="h-8 w-8 text-[#10B981]" />
        <p className="text-sm font-bold text-[var(--ink-primary)]">{copy.privacyBlurTitle}</p>
        <p className="text-xs text-[var(--ink-secondary)]">{copy.privacyBlurDesc}</p>
      </div>
    );
  }

  return null;
}

