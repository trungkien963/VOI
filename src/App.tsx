import { useEffect, type ReactElement } from 'react';
import { AppShell } from './app/AppShell';
import { ensureSeedData, requestPersistentStorage } from './db/dexie-schema';
import { PrivacyBlurAndLockOverlay } from './features/security/PrivacyBlurAndLockOverlay';

export function App(): ReactElement {
  useEffect(() => {
    void ensureSeedData();
    void requestPersistentStorage();
  }, []);

  return (
    <>
      <AppShell />
      <PrivacyBlurAndLockOverlay />
    </>
  );
}

export default App;
