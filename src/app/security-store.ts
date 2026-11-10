import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SaltedPinRecord } from '../domain/security/app-lock';

interface SecurityState {
  baseCurrency: 'VND' | 'USD';
  saltedPinRecord: SaltedPinRecord | null;
  isAppLocked: boolean;
  setBaseCurrency: (currency: 'VND' | 'USD') => void;
  setSaltedPinRecord: (record: SaltedPinRecord | null) => void;
  lockApp: () => void;
  unlockApp: () => void;
}

export const useSecurityStore = create<SecurityState>()(
  persist(
    (set) => ({
      baseCurrency: 'VND',
      saltedPinRecord: null,
      isAppLocked: false,
      setBaseCurrency: (baseCurrency) => set({ baseCurrency }),
      setSaltedPinRecord: (saltedPinRecord) =>
        set({ saltedPinRecord, isAppLocked: false }),
      lockApp: () => set({ isAppLocked: true }),
      unlockApp: () => set({ isAppLocked: false }),
    }),
    {
      name: 'fn_app_security_prefs_v1',
    },
  ),
);

