import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { appChildRoutes } from './appChildRoutes';
import { ManagerRoute } from './ManagerRoute';
import { OwnerRoute } from './OwnerRoute';

const guardOf = (path: string | undefined) => {
  const route = appChildRoutes.find((r) => (path === undefined ? r.index : r.path === path));
  expect(route, `rute ${path ?? 'index'} ada`).toBeTruthy();
  return (route?.element as ReactElement | undefined)?.type;
};

describe('rute per peran (P18.20)', () => {
  it.each(['calculator', 'pos', 'customers', 'suppliers', 'finance'])(
    '/%s dijaga ManagerRoute: Teknisi dialihkan ke Beranda',
    (path) => {
      expect(guardOf(path)).toBe(ManagerRoute);
    },
  );

  it.each(['reports', 'activity', 'settings'])('/%s tetap khusus Pemilik', (path) => {
    expect(guardOf(path)).toBe(OwnerRoute);
  });

  it.each([undefined, 'services', 'services/:id', 'tasks', 'attendance', 'istilah'])(
    'rute %s terbuka untuk semua peran',
    (path) => {
      const type = guardOf(path);
      expect(type).not.toBe(ManagerRoute);
      expect(type).not.toBe(OwnerRoute);
    },
  );

  it('/inventory dialihkan ke /pos, yang menutup bagi Teknisi', () => {
    const route = appChildRoutes.find((r) => r.path === 'inventory');
    expect(route).toBeTruthy();
    expect(guardOf('pos')).toBe(ManagerRoute);
  });
});
