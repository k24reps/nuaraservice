import { Suspense } from 'react';
import { lazyChunk } from '@/lib/lazyChunk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { ToastContainer } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { sanitizeAnalyticsEvent } from './lib/analytics';

const queryClient = new QueryClient({
  defaultOptions: {
    // refetchOnReconnect: when the browser regains connectivity (the `online`
    // event), refetch active queries. This is the safety net for the case where
    // the realtime channel died silently while offline/asleep — see
    // subscribeOrgTables auto-reconnect. 'always' refetches even if data is
    // still within staleTime, since "we were offline" implies possibly-stale.
    //
    // staleTime 5 min (was 30 s): freshness here does NOT depend on this timer
    // — useCollection invalidates on realtime change events, and realtime
    // egress is negligible (KB) next to PostgREST (MB). A 30 s timer just made
    // navigating back to a page re-pull whole tables for data that had not
    // changed. refetchOnReconnect stays the safety net for a dead channel.
    queries: { staleTime: 5 * 60_000, refetchOnWindowFocus: false, refetchOnReconnect: 'always' },
  },
});

// Harness data contoh untuk skrip foto dan probe regresi; hanya di dev server.
// Di build produksi kondisi ini konstan false, jadi chunk-nya ikut terbuang.
const DevSandbox = import.meta.env.DEV
  ? lazyChunk(() => import('./dev/DevSandbox').then((m) => ({ default: m.DevSandbox })))
  : null;
// Katalog komponen dens-ui bertema Nuara (L-46); juga hanya di dev server.
const ComponentShowcase = import.meta.env.DEV
  ? lazyChunk(() => import('./dev/ComponentShowcase').then((m) => ({ default: m.ComponentShowcase })))
  : null;

export function App() {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const sandbox = DevSandbox !== null && path === '/demo';
  const showcase = ComponentShowcase !== null && path === '/dev/komponen';

  return (
    <ErrorBoundary root>
      <QueryClientProvider client={queryClient}>
        {showcase && ComponentShowcase ? (
          <Suspense fallback={null}>
            <ComponentShowcase />
          </Suspense>
        ) : sandbox && DevSandbox ? (
          <Suspense fallback={null}>
            <DevSandbox />
          </Suspense>
        ) : (
          <RouterProvider router={router} />
        )}
        <ToastContainer />
        <Analytics beforeSend={sanitizeAnalyticsEvent} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
