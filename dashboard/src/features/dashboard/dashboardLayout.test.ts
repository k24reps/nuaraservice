import { describe, expect, it } from 'vitest';
import pageTsx from './DashboardPage.tsx?raw';
import appCss from '@/styles/app.css?raw';

const cssModules = Object.keys(import.meta.glob('./*.module.css'));

/**
 * Mekanisme Dashboard sejak pindah ke dens-ui (L-53). Ukuran sungguhan dicek
 * lewat Playwright; tes ini menjaga mekanismenya tak hilang diam-diam.
 */
describe('Dashboard', () => {
  it('bertailwind: folder di @source, tanpa CSS Module, satu data-nu di akar', () => {
    expect(appCss).toContain('@source "../features/dashboard";');
    expect(cssModules).toEqual([]);
    expect(pageTsx).not.toContain('styles.');
    expect(pageTsx).toContain('<div data-nu className="@container/dashboard flex flex-col gap-4 bg-transparent"');
    expect(pageTsx.match(/\bdata-nu\b/g)).toHaveLength(1);
  });

  it('maskot VOLT dan layar LCD FixMaster dibuang (K-17)', () => {
    expect(pageTsx).not.toContain('Mascot');
    expect(pageTsx).not.toMatch(/heroScan|scanline|readout-surface/);
    expect(pageTsx).toContain('rounded-2xl bg-primary px-6 py-5 text-primary-foreground');
  });

  it('ambang muat/tidak muat lewat container query dashboard, bukan media query', () => {
    // Konsol, strip, dan baris Servis Terbaru turun bentuk di wadah <=560px;
    // kisi terbaru + target satu kolom di <=900px.
    expect(pageTsx).toContain('@max-[561px]/dashboard:grid @max-[561px]/dashboard:grid-cols-[minmax(0,1fr)_auto]');
    expect(pageTsx).toContain("@max-[561px]/dashboard:[grid-template-areas:'no_detail_arrow'_'._badge_arrow']");
    expect(pageTsx).toContain('@max-[901px]/dashboard:grid-cols-1');
    expect(pageTsx).toContain('@max-[561px]/dashboard:grid-cols-2 @max-[561px]/dashboard:[&>:last-child:nth-child(odd)]:col-span-full');
    // Rupiah mono tak boleh mendorong kisi panel laba melewati layar 320px.
    expect(pageTsx).toContain('@max-[561px]/dashboard:grid-cols-2 @max-[561px]/dashboard:gap-x-4');
  });

  it('status tiket = lencana STATUS_BADGE; Servis Baru di dok zona jempol, salinan konsol disembunyikan di ponsel', () => {
    expect(pageTsx).toContain('<Badge variant={STATUS_BADGE[service.status]}>');
    expect(pageTsx).not.toContain('STATUS_TONE');
    expect(pageTsx).toContain('<ThumbDock>');
    expect(pageTsx).toContain("cn(primaryLink, 'phone:hidden')");
  });

  it('tautan aksi setinggi 44px di layar sentuh (aturan global hanya untuk <button>)', () => {
    expect(pageTsx).toMatch(/const linkBtn =\s*'[^']*pointer-coarse:h-11/);
    expect(pageTsx).toMatch(/const viewAll =\s*'[^']*pointer-coarse:h-11/);
  });
});
