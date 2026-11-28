import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '@/config/navigation';
import {
  DEFAULT_MOBILE_NAV_PATHS,
  getVisibleNavigation,
  resolveMobileNavigation,
  sanitizeMobileNavPaths,
} from './navigation';

describe('mobile navigation', () => {
  it('uses the four operational defaults when no owner layout exists', () => {
    expect(sanitizeMobileNavPaths(undefined)).toEqual(DEFAULT_MOBILE_NAV_PATHS);
  });

  it('drops duplicate and unknown paths, then fills empty slots', () => {
    expect(sanitizeMobileNavPaths(['/finance', '/finance', '/unknown'])).toEqual([
      '/finance',
      '/',
      '/services',
      '/pos',
    ]);
  });

  it('fills owner-only choices with safe destinations for staff', () => {
    const staffNavigation = getVisibleNavigation('karyawan');
    const resolved = resolveMobileNavigation(
      ['/reports', '/settings', '/services', '/pos'],
      staffNavigation,
    );

    // Kasir dan Pelanggan tertutup untuk Teknisi (P18.20), jadi slotnya terisi Tugas dan Absensi.
    expect(resolved.map(({ item }) => item.to)).toEqual(['/services', '/', '/tasks', '/attendance']);
  });

  it('tata letak lama berisi /inventory terisi ulang tanpa slot kosong', () => {
    // Inventori dilebur ke Kasir & Stok; slot yang menunjuknya jatuh ke default.
    expect(sanitizeMobileNavPaths(['/', '/services', '/pos', '/inventory'])).toEqual([
      '/',
      '/services',
      '/pos',
      '/customers',
    ]);
  });

  it('Kasir & Stok memakai label pendek di nav bawah', () => {
    const pos = NAV_ITEMS.find((item) => item.to === '/pos');
    expect(pos?.shortLabelKey).toBe('nav.posShort');
    expect(NAV_ITEMS.some((item) => item.to === '/inventory')).toBe(false);
  });

  it('owner bisa menaruh modul tim di nav bawah tanpa kunci paket', () => {
    const ownerNavigation = getVisibleNavigation('owner');
    const resolved = resolveMobileNavigation(['/attendance', '/suppliers'], ownerNavigation);

    expect(resolved.map(({ item }) => item.to).slice(0, 2)).toEqual(['/attendance', '/suppliers']);
  });
});

describe('grup rail', () => {
  // Sidebar menarik sambungan bertitik di tiap pergantian grup. Grup yang
  // muncul dua kali terpisah akan memecah satu grup menjadi dua sambungan.
  it('anggota satu grup berurutan', () => {
    const runs = NAV_ITEMS.map((item) => item.group).filter(
      (group, i, all) => i === 0 || all[i - 1] !== group,
    );
    expect(new Set(runs).size).toBe(runs.length);
  });

  it('karyawan tetap melihat dua grup: operasional dan kantor', () => {
    const groups = getVisibleNavigation('karyawan').map(({ item }) => item.group);
    expect([...new Set(groups)]).toEqual(['ops', 'office']);
  });
});

describe('menu per peran (P18.19, P18.20, P18.24)', () => {
  const paths = (role: Parameters<typeof getVisibleNavigation>[0]) =>
    getVisibleNavigation(role).map(({ item }) => item.to);

  it('Teknisi: Beranda, Servis, Tugas, Absensi', () => {
    expect(paths('karyawan')).toEqual(['/', '/services', '/tasks', '/attendance']);
  });

  it.each(['/calculator', '/pos', '/customers', '/suppliers', '/finance', '/reports', '/activity', '/settings'])(
    '%s tidak tampil untuk Teknisi',
    (to) => {
      expect(paths('karyawan')).not.toContain(to);
    },
  );

  it('Admin: menu aplikasi sekarang tanpa Laporan, Log Aktivitas, dan Pengaturan', () => {
    expect(paths('admin')).toEqual([
      '/',
      '/services',
      '/calculator',
      '/pos',
      '/customers',
      '/suppliers',
      '/finance',
      '/tasks',
      '/attendance',
    ]);
  });

  it('Pemilik melihat semua item', () => {
    expect(paths('owner')).toEqual(NAV_ITEMS.map((item) => item.to));
  });

  it('nav bawah Teknisi tetap empat slot walau tata letak Pemilik menunjuk halaman tertutup', () => {
    const resolved = resolveMobileNavigation(
      ['/pos', '/customers', '/suppliers', '/calculator'],
      getVisibleNavigation('karyawan'),
    );
    expect(resolved.map(({ item }) => item.to)).toEqual(['/', '/services', '/tasks', '/attendance']);
  });
});
