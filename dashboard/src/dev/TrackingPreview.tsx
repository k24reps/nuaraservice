import { useEffect, useMemo, useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { TrackingPage } from '@/features/tracking/TrackingPage';
import { InMemoryAdapter } from '@/data/in-memory-adapter';
import { installRepository, repository, resetRepository } from '@/data';
import { useDemoStore } from '@/stores/demo';
import { useSessionStore } from '@/stores/session';
import { seedDemoWorkspace } from './seed';

/**
 * Pratinjau halaman lacak di `/dev/lacak`, KHUSUS dev server (App.tsx memasangnya
 * di balik `import.meta.env.DEV`). Rute `/track` publik tak ada di MemoryRouter
 * `/demo`, dan tanpa Supabase halamannya tak punya data, jadi ini memasang data
 * contoh lalu merender TrackingPage di MemoryRouter sendiri.
 *
 * Parameter: `no` = nomor tiket contoh (FM-0001 ... FM-0008), `kode` = mode kode
 * (mode lokal tak punya kode, jadi hasilnya "tidak ditemukan"), `gagal=1` = baca
 * data selalu gagal, `terburuk=1` = toko dan tiket bernama sangat panjang.
 */
class FailingAdapter extends InMemoryAdapter {
  async getSingleton(): Promise<never> {
    throw new Error('gagal dimuat (pratinjau)');
  }
}

const LONG_WORD = 'Wk'.repeat(40);

export function TrackingPreview() {
  const q = new URLSearchParams(window.location.search);
  const no = q.get('no') ?? 'FM-0001';
  const kode = q.get('kode');
  const gagal = q.get('gagal') === '1';
  const terburuk = q.get('terburuk') === '1';
  const [ready, setReady] = useState(false);

  const router = useMemo(
    () =>
      createMemoryRouter(
        [
          { path: '/track', element: <TrackingPage /> },
          { path: '/t/:code', element: <TrackingPage /> },
        ],
        { initialEntries: [kode ? `/t/${kode}` : `/track?no=${no}`] },
      ),
    [kode, no],
  );

  useEffect(() => {
    let cancelled = false;
    installRepository(new InMemoryAdapter());
    useDemoStore.getState().enter();
    void (async () => {
      await seedDemoWorkspace('Nuara Service');
      if (terburuk) {
        const org = await repository.getSingleton('organization');
        if (org) {
          await repository.setSingleton('organization', {
            ...org,
            name: `Nuara Service ${LONG_WORD}`,
            phone: '0821-1821-8747',
            address: `Jl. Ibu Ganirah No. 115, Cibeber, Cimahi Selatan ${LONG_WORD}`,
            settings: {
              ...(org.settings ?? {}),
              publicNote: `Senin sampai Kamis 09.00-21.00.\nJumat 13.00-21.00.\nBawa nota ini saat mengambil unit. ${LONG_WORD}`,
            },
          });
        }
        for (const s of await repository.list('services')) {
          await repository.patch('services', s.id, {
            device: `Laptop ${LONG_WORD}`,
            category: `Kategori ${LONG_WORD}`,
            history: (s.history ?? []).map((h) => ({ ...h, note: `${h.note} ${LONG_WORD}` })),
          });
        }
      }
      if (gagal) installRepository(new FailingAdapter());
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      useDemoStore.getState().exit();
      useSessionStore.getState().reset();
      resetRepository();
    };
  }, [gagal, terburuk]);

  if (!ready) return null;
  return <RouterProvider router={router} />;
}
