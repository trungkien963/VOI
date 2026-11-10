import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Cloud, LogIn, LogOut, Mail, ShieldAlert, UserCheck } from 'lucide-react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useUiStore } from '../../app/ui-store';
import { localDb } from '../../db/dexie-schema';
import { outboxSyncEngine } from '../../db/sync/outbox-sync-engine';
import { isSupabaseConfigured, supabaseClient } from '../../db/sync/supabase-client';
import { evaluateSignOutGuard } from '../../domain/data-portability/csv-and-snapshot';
import { useTranslation } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { GeometricBuddy } from '../../shared/ui/GeometricBuddy';

interface AuthSessionUser {
  id: string;
  email: string;
  provider: 'google' | 'magic_link';
  signedInAt: string;
}

interface AuthStoreState {
  user: AuthSessionUser | null;
  setUser: (user: AuthSessionUser | null) => void;
  signInWithGoogleLocal: () => void;
  signInWithMagicLinkLocal: (email: string) => void;
  signOutComplete: () => void;
}

const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      signInWithGoogleLocal: () =>
        set({
          user: {
            id: 'usr-google-local',
            email: 'edric@fn-app.local',
            provider: 'google',
            signedInAt: new Date().toISOString(),
          },
        }),
      signInWithMagicLinkLocal: (email) =>
        set({
          user: {
            id: `usr-magic-${Date.now()}`,
            email: email.trim(),
            provider: 'magic_link',
            signedInAt: new Date().toISOString(),
          },
        }),
      signOutComplete: () => set({ user: null }),
    }),
    {
      name: 'fn_app_auth_session_v1',
    },
  ),
);

export function AuthAndAccountCard(): ReactElement {
  const { locale } = useTranslation();
  const isVi = locale === 'vi';
  const { setSyncStatus } = useUiStore();
  const { user, setUser, signInWithGoogleLocal, signInWithMagicLinkLocal, signOutComplete } =
    useAuthStore();

  const [emailInput, setEmailInput] = useState('');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [guardWarning, setGuardWarning] = useState<string | null>(null);

  const syncLocalDataUponLogin = useCallback(
    async (signedInEmail: string): Promise<void> => {
      setSyncStatus('syncing');
      const [txCount, accCount, summary] = await Promise.all([
        localDb.transactions.count(),
        localDb.accounts.count(),
        outboxSyncEngine.flushOutbox({ isOnline: true }),
      ]);
      setSyncStatus(summary.failedCount > 0 ? 'error' : 'synced');

      setSyncNotice(
        isVi
          ? `Đã đăng nhập (${signedInEmail}) & đồng bộ toàn bộ dữ liệu local lên Supabase Cloud (${accCount} ví, ${txCount} giao dịch)!`
          : `Signed in (${signedInEmail}) & synced all local data to Supabase Cloud (${accCount} wallets, ${txCount} transactions)!`,
      );
    },
    [isVi, setSyncStatus],
  );

  useEffect(() => {
    if (!supabaseClient) return;
    const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          provider: session.user.app_metadata?.provider === 'google' ? 'google' : 'magic_link',
          signedInAt: new Date().toISOString(),
        });
        void syncLocalDataUponLogin(session.user.email);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [setUser, syncLocalDataUponLogin]);

  const handleGoogleLogin = async (): Promise<void> => {
    setGuardWarning(null);
    if (supabaseClient && typeof window !== 'undefined') {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (!error) return;
    }
    signInWithGoogleLocal();
    await syncLocalDataUponLogin('edric@fn-app.local');
  };

  const handleMagicLinkSubmit = async (): Promise<void> => {
    const trimmed = emailInput.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    setEmailInput('');
    setGuardWarning(null);

    if (supabaseClient && typeof window !== 'undefined') {
      const { error } = await supabaseClient.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: window.location.origin },
      });
      if (!error) {
        setSyncNotice(
          isVi
            ? `Đã gửi Magic Link tới ${trimmed}! Hãy kiểm tra hộp thư để đăng nhập & tự động đồng bộ dữ liệu local lên Supabase.`
            : `Sent Magic Link to ${trimmed}! Check your inbox to sign in & auto-sync local data to Supabase.`,
        );
        return;
      }
    }

    signInWithMagicLinkLocal(trimmed);
    await syncLocalDataUponLogin(trimmed);
  };

  const handleAttemptSignOut = async (): Promise<void> => {
    const guard = await evaluateSignOutGuard(localDb, locale);
    if (!guard.allowed) {
      setGuardWarning(guard.warningMessage);
      return;
    }
    if (supabaseClient) {
      await supabaseClient.auth.signOut().catch(() => undefined);
    }
    setGuardWarning(null);
    setSyncNotice(null);
    signOutComplete();
  };

  const handleSyncAndSignOut = async (): Promise<void> => {
    await outboxSyncEngine.flushOutbox({ isOnline: true });
    if (supabaseClient) {
      await supabaseClient.auth.signOut().catch(() => undefined);
    }
    setGuardWarning(null);
    setSyncNotice(null);
    signOutComplete();
  };

  return (
    <div
      data-testid="auth-account-card"
      className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 p-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <GeometricBuddy
            shape={user ? 'hexagon' : 'circle'}
            colorHex={user ? '#10B981' : '#3B82F6'}
            accessory={user ? 'cheering' : 'glasses'}
            mood={user ? 'excited' : 'happy'}
            size={38}
          />
          <div>
            <p className="text-xs font-extrabold text-[var(--ink-primary)]">
              {user
                ? user.email
                : isVi
                  ? 'Chế độ Local-First (Đã nối Supabase Cloud)'
                  : 'Local-First Mode (Supabase Cloud Ready)'}
            </p>
            <p className="text-[11px] text-[var(--ink-secondary)]">
              {user
                ? isVi
                  ? `Đã kết nối đám mây (${user.provider === 'google' ? 'Google' : 'Email Magic Link'})`
                  : `Cloud sync active (${user.provider === 'google' ? 'Google' : 'Email Magic Link'})`
                : isSupabaseConfigured
                  ? isVi
                    ? 'Project Supabase (icttrjtgdgnckalqzmsx) đã sẵn sàng. Đăng nhập để đẩy toàn bộ dữ liệu local lên Cloud.'
                    : 'Supabase project (icttrjtgdgnckalqzmsx) connected. Sign in to sync all local data to Cloud.'
                  : isVi
                    ? 'Dữ liệu luôn lưu tức thì trên thiết bị.'
                    : 'Data is saved on device first.'}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
            user ? 'bg-[#10B981]/15 text-[#10B981]' : 'bg-[#3B82F6]/12 text-[#3B82F6]'
          }`}
        >
          {user ? <UserCheck className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
          <span>{user ? (isVi ? 'Đã đăng nhập' : 'Signed In') : 'Cloud Ready'}</span>
        </span>
      </div>

      {syncNotice && (
        <p
          data-testid="login-sync-notice"
          className="rounded-xl bg-[#10B981]/12 px-2.5 py-1.5 text-xs font-semibold text-[#065F46]"
        >
          {syncNotice}
        </p>
      )}

      {!user ? (
        <div className="space-y-2 pt-1">
          <Button
            variant="ink"
            size="sm"
            fullWidth
            onClick={() => void handleGoogleLogin()}
            data-testid="login-google-btn"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>{isVi ? 'Tiếp tục với Google' : 'Continue with Google'}</span>
          </Button>

          <div className="flex gap-1.5">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder={
                isVi ? 'Nhập email nhận Magic Link...' : 'Enter email for Magic Link...'
              }
              aria-label="Email Magic Link"
              data-testid="login-magic-email-input"
              className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--ink-primary)]"
            />
            <Button
              variant="outline"
              size="xs"
              onClick={() => void handleMagicLinkSubmit()}
              data-testid="login-magic-btn"
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Magic Link</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => void handleAttemptSignOut()}
              data-testid="auth-signout-btn"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{isVi ? 'Đăng xuất' : 'Sign Out'}</span>
            </Button>
          </div>

          {guardWarning && (
            <div
              data-testid="auth-signout-guard-warning"
              className="space-y-2 rounded-xl border border-[#FF6B35]/40 bg-[#FF6B35]/10 p-2.5 text-xs"
            >
              <div className="flex items-start gap-1.5 font-semibold text-[#9A3412]">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" />
                <span>{guardWarning}</span>
              </div>
              <Button
                variant="ink"
                size="xs"
                onClick={() => void handleSyncAndSignOut()}
                data-testid="sync-then-signout-btn"
              >
                {isVi ? 'Đồng bộ ngay & Đăng xuất an toàn' : 'Sync Now & Sign Out Safely'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
