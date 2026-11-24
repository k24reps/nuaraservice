import { describe, expect, it } from 'vitest';
import appCss from '@/styles/app.css?raw';
import viteConfig from '../../vite.config.ts?raw';
import termTsx from './ui/Term.tsx?raw';
import loadStateTsx from './ui/LoadState.tsx?raw';
import emptyValueTsx from './ui/EmptyValue.tsx?raw';
import thumbDockTsx from './layout/ThumbDock.tsx?raw';
import displayTsx from './layout/DisplayControls.tsx?raw';
import errorTsx from './ErrorBoundary.tsx?raw';
import notFoundTsx from './NotFoundPage.tsx?raw';
import sidebarTsx from './layout/Sidebar.tsx?raw';
import topbarTsx from './layout/Topbar.tsx?raw';
import navSignalTsx from './layout/navSignal.tsx?raw';
import bottomNavTsx from './layout/MobileBottomNav.tsx?raw';
import densSidebarTsx from './dens/sidebar.tsx?raw';

/**
 * Bersih-bersih komponen FixMaster (L-68): tak ada CSS Module, komponen
 * FixMaster yang mati tidak kembali, dan komponen kerangka yang tersisa
 * ditulis dengan dens/Tailwind.
 */
describe('Bersih-bersih komponen (L-68)', () => {
  it('tak ada CSS Module di src/, dan components/ utuh dipindai Tailwind', () => {
    expect(Object.keys(import.meta.glob('/src/**/*.module.css'))).toEqual([]);
    expect(appCss).toContain('@source "../components";');
    expect(appCss).not.toContain('@source "../components/dens";');
  });

  it('components/ui hanya memuat helper dan komponen yang masih dipakai', () => {
    const files = Object.keys(import.meta.glob('./ui/*')).map((f) => f.replace('./ui/', '')).sort();
    expect(files).toEqual([
      'EmptyValue.tsx',
      'LoadState.test.tsx',
      'LoadState.tsx',
      'Term.tsx',
      'catalogView.test.ts',
      'catalogView.ts',
      'index.ts',
      'loadPending.ts',
    ]);
  });

  it('komponen yang ditulis ulang tak membawa kelas atau komponen FixMaster', () => {
    for (const src of [termTsx, loadStateTsx, emptyValueTsx, thumbDockTsx, displayTsx, errorTsx, notFoundTsx]) {
      expect(src).not.toContain('styles.');
      expect(src).not.toMatch(/from '@\/components\/ui(\/|')/);
      expect(src).not.toContain('fm-visually-hidden');
    }
    expect(loadStateTsx).toContain("from '@/components/dens/empty-state'");
    expect(loadStateTsx).toContain('motion-safe:animate-spin');
  });

  it('tautan Term: area ketuk 44px di layar sentuh, bukan 30px', () => {
    // Satu baris teks ~17px + 2 x 14px (inset-y-3.5) = 45px.
    expect(termTsx).toContain('pointer-coarse:after:-inset-y-3.5');
    expect(termTsx).toContain('pointer-coarse:after:absolute');
  });

  it('ThumbDock terikat kehadiran menu bawah lewat varian phone', () => {
    expect(thumbDockTsx).toContain('hidden phone:fixed phone:right-4');
    expect(thumbDockTsx).toContain('phone:bottom-[calc(var(--mobile-nav-height)+var(--space-4)+env(safe-area-inset-bottom))]');
    expect(thumbDockTsx).toContain('hidden h-11 flex-none phone:block');
  });

  it('layar galat dan 404: kartu dens yang muat di 320px, tombol boleh membungkus', () => {
    expect(errorTsx).toContain('data-nu');
    expect(errorTsx).toContain("root ? 'min-h-dvh'");
    expect(errorTsx).toContain('role="alert"');
    expect(errorTsx.match(/whitespace-normal/g)!.length).toBeGreaterThanOrEqual(3);
    expect(notFoundTsx).toContain('whitespace-normal');
    // Baut sudut, LED, dan kode FAULT dibuang (K-27).
    expect(errorTsx + notFoundTsx).not.toMatch(/FAULT|FX-SYS|OPEN CIRCUIT|ROUTE DIAGNOSTIC/);
  });

  it('kontrol tampilan: pilihan zoom dan kerapatan tetap radiogroup beraria, Padat terkunci lewat aria-disabled', () => {
    expect(displayTsx).toContain('role="radiogroup"');
    expect(displayTsx).toContain('aria-disabled={!enabled || undefined}');
    expect(displayTsx).toContain('grid-cols-[repeat(5,minmax(44px,1fr))]');
    expect(displayTsx.match(/min-h-11/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it('K-01: teks kerangka tak lebih kecil dari 12px', () => {
    for (const src of [sidebarTsx, topbarTsx, navSignalTsx, bottomNavTsx, densSidebarTsx]) {
      expect(src).not.toMatch(/text-\[(9|10|10\.5|11)(\.5)?px\]/);
    }
  });

  it('react-router di chunk sendiri; batas peringatan 600 kB tak dinaikkan', () => {
    expect(viteConfig).toContain("return 'router-vendor'");
    expect(viteConfig).toContain('chunkSizeWarningLimit: 600');
  });
});
