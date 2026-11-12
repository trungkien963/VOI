import { useEffect, type ReactElement } from 'react';
import { AppShell } from './app/AppShell';
import { useUiStore } from './app/ui-store';
import { ensureSeedData, requestPersistentStorage } from './db/dexie-schema';
import { PrivacyBlurAndLockOverlay } from './features/security/PrivacyBlurAndLockOverlay';

export function App(): ReactElement {
  useEffect(() => {
    void ensureSeedData();
    void requestPersistentStorage();

    const state = useUiStore.getState();
    if (!state.hasCompletedWelcome) {
      state.setLocale('vi');
      state.openWelcomeModal('cover');
    }
  }, []);

  return (
    <>
      <AppShell />
      <PrivacyBlurAndLockOverlay />
    </>
  );
}

export default App;
