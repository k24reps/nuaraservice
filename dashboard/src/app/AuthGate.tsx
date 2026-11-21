import { Suspense, useEffect, useState } from 'react';
import { lazyChunk } from '@/lib/lazyChunk';
import { useAuthStore } from '@/stores/auth';
import { AuthSplash } from './AuthSplash';
import { authIntentFromSearch } from '@/features/auth/auth-intent';

const AuthPage = lazyChunk(() =>
  import('@/features/auth/AuthPage').then((module) => ({ default: module.AuthPage })),
);
const WorkspaceGate = lazyChunk(() =>
  import('./WorkspaceGate').then((module) => ({ default: module.WorkspaceGate })),
);

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * Resolves the cloud-account gate first. The tenant repository, first-run
 * setup, PIN picker, and authenticated shell live behind WorkspaceGate.
 *
 * Nuara Dashboard tidak punya landing page: tamu langsung melihat form masuk.
 * Form daftar tetap ada karena staf bergabung lewat undangan email (0008):
 * staf mendaftar dengan email yang diundang, lalu claim_invite menautkannya.
 */
export function AuthGate({ children }: AuthGateProps) {
  const authStatus = useAuthStore((s) => s.status);
  const initAuth = useAuthStore((s) => s.init);

  // `?auth=signup` dari tautan undangan membuka form daftar; selain itu masuk.
  const [initialMode] = useState(() => {
    if (typeof window === 'undefined') return 'login' as const;
    return authIntentFromSearch(window.location.search)?.mode ?? 'login';
  });

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  if (authStatus === 'loading') {
    return <AuthSplash />;
  }

  if (authStatus === 'signed-out') {
    return (
      <Suspense fallback={<AuthSplash />}>
        <AuthPage initialMode={initialMode} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<AuthSplash />}>
      <WorkspaceGate>{children}</WorkspaceGate>
    </Suspense>
  );
}
