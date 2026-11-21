import { Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AuthGate } from './AuthGate';
import { AuthSplash } from './AuthSplash';
import { appChildRoutes } from './appChildRoutes';
import { RouteError } from './RouteError';
import { lazyChunk } from '@/lib/lazyChunk';

// Route pages and the authenticated shell are code-split. Signed-out visitors
// do not download AppLayout.
const AppLayout = lazyChunk(() =>
  import('@/components/layout/AppLayout').then((module) => ({ default: module.AppLayout })),
);
const TrackingPage = lazyChunk(() =>
  import('@/features/tracking/TrackingPage').then((m) => ({ default: m.TrackingPage })),
);
const ResetPasswordPage = lazyChunk(() =>
  import('@/features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);

export const router = createBrowserRouter([
  {
    // Public, no-login service tracking.
    path: '/track',
    errorElement: <RouteError />,
    element: (
      <Suspense fallback={null}>
        <TrackingPage />
      </Suspense>
    ),
  },
  {
    // Alamat pendek di QR nota: kode lacak acak per tiket (migrasi 0100).
    path: '/t/:code',
    errorElement: <RouteError />,
    element: (
      <Suspense fallback={null}>
        <TrackingPage />
      </Suspense>
    ),
  },
  {
    // Password recovery landing (email link target). Public — outside AuthGate
    // — so supabase-js can parse the recovery token and authorize the update.
    path: '/reset-password',
    errorElement: <RouteError />,
    element: (
      <Suspense fallback={null}>
        <ResetPasswordPage />
      </Suspense>
    ),
  },
  {
    path: '/',
    errorElement: <RouteError />,
    element: (
      <AuthGate>
        <Suspense fallback={<AuthSplash />}>
          <AppLayout />
        </Suspense>
      </AuthGate>
    ),
    children: appChildRoutes,
  },
]);
