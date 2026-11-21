import { useEffect, useMemo, useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { appChildRoutes } from '@/app/appChildRoutes';
import { InMemoryAdapter } from '@/data/in-memory-adapter';
import { installRepository, resetRepository } from '@/data';
import { useDemoStore } from '@/stores/demo';
import { useSessionStore } from '@/stores/session';
import { useZoomStore } from '@/stores/zoom';
import { seedDemoWorkspace } from './seed';

/**
 * Harness data contoh di `/demo`, KHUSUS dev server (App.tsx memasangnya di
 * balik `import.meta.env.DEV`, jadi build produksi membuangnya).
 *
 * Pengganti demo publik FixMaster: skrip foto dan probe regresi
 * (`scripts/audit-*.mjs`, `scripts/shoot-*.mjs`) membuka `/demo` untuk
 * mendapat aplikasi lengkap berisi data tanpa Supabase. Repository diganti
 * InMemoryAdapter (RAM saja, tidak menyentuh IndexedDB), lalu aplikasi
 * berjalan di MemoryRouter sendiri dengan rute anak yang sama persis.
 */
export function DevSandbox() {
  const [ready, setReady] = useState(false);

  const router = useMemo(
    () =>
      createMemoryRouter([{ path: '/', element: <AppLayout />, children: appChildRoutes }], {
        initialEntries: ['/'],
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const endTransientView = useZoomStore.getState().beginTransientView();
    installRepository(new InMemoryAdapter());
    useDemoStore.getState().enter();
    void seedDemoWorkspace('Nuara Service').then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      endTransientView();
      useDemoStore.getState().exit();
      useSessionStore.getState().reset();
      resetRepository();
    };
  }, []);

  if (!ready) return null;
  return <RouterProvider router={router} />;
}
