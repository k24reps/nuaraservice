import { describe, expect, it } from 'vitest';
import pageTsx from './ReportsPage.tsx?raw';
import chartTsx from './TrendChart.tsx?raw';
import appCss from '@/styles/app.css?raw';

const cssModules = Object.keys(import.meta.glob('./*.module.css'));

/**
 * Mekanisme halaman Laporan sejak pindah ke dens-ui (L-64). Ukuran sungguhan
 * dicek lewat Playwright dengan teks terburuk; tes ini menjaga mekanismenya.
 */
describe('halaman Laporan', () => {
  it('folder bertailwind: di @source utuh, tanpa CSS Module, satu data-nu di akar halaman', () => {
    expect(appCss).toContain('@source "../features/reports";');
    expect(appCss).not.toContain('@source "../features/reports/');
    expect(cssModules).toEqual([]);
    for (const src of [pageTsx, chartTsx]) {
      expect(src).not.toContain('styles.');
      expect(src).not.toContain('.module.css');
      expect(src).not.toMatch(/<Icon\b/);
      for (const [, names] of src.matchAll(/import \{([^}]*)\} from '@\/components\/ui';/g)) {
        for (const n of names.split(',').map((x) => x.trim()).filter(Boolean)) {
          expect(['LoadState', 'loadPending', 'Term']).toContain(n);
        }
      }
    }
    expect(pageTsx).toContain('<div data-nu className="@container/laporan flex flex-col gap-5 bg-transparent">');
    expect(pageTsx.match(/\bdata-nu\b/g)).toHaveLength(1);
  });

  it('ambang membaca wadah, bukan layar: zoom aplikasi dan sidebar tak menggeser media query', () => {
    expect(pageTsx).not.toMatch(/[\s'"`](drawer|narrow|phone|compact|max-lg|max-md|max-sm):/);
    // Kartu metrik: sebaris → ikon di atas → dua kolom sebaris → ikon di atas.
    expect(pageTsx).toContain('@max-[1063px]/laporan:flex-col');
    expect(pageTsx).toContain('@max-[871px]/laporan:grid-cols-2');
    expect(pageTsx).toContain('@max-[871px]/laporan:flex-row');
    expect(pageTsx).toContain('@max-[510px]/laporan:flex-col');
    expect(pageTsx).toContain('@max-[721px]/laporan:text-[length:clamp(0.875rem,calc(6.4cqi_-_4.2px),1.25rem)]');
    // Tab 6 → 3 → 2 kolom; dua kartu berdampingan → satu kolom; readout 4 → 2.
    expect(pageTsx).toContain('grid-cols-6 gap-2 @max-[922px]/laporan:grid-cols-3 @max-[457px]/laporan:grid-cols-2');
    expect(pageTsx).toContain("const GRID = 'grid grid-cols-2 gap-4 @max-[1025px]/laporan:grid-cols-1';");
    expect(pageTsx).toContain('@max-[767px]/laporan:grid-cols-2');
    // Laba Rugi dua kolom hanya bila tiap kolom >= 392px.
    expect(pageTsx).toContain('<div className="@container/laba">');
    expect(pageTsx).toContain('@min-[52rem]/laba:grid-cols-2');
  });

  it('tab bagian: WAI-ARIA lengkap, panel tersembunyi tak dikalahkan display flex', () => {
    expect(pageTsx).toContain('role="tab"');
    expect(pageTsx).toContain('id={`lap-tab-${it.id}`}');
    expect(pageTsx).toContain('aria-controls={`lap-panel-${it.id}`}');
    expect(pageTsx).toContain('tabIndex={tab === it.id ? 0 : -1}');
    expect(pageTsx).toContain('role="tabpanel"');
    expect(pageTsx).toContain('className="flex flex-col gap-5 [&[hidden]]:hidden"');
  });

  it('tabel bertumpuk lewat container query; hanya kolom angka pertama didorong ke kanan', () => {
    expect(pageTsx).toContain("const TABLE_SCROLL = '@container/tabel w-full overflow-x-auto';");
    expect(pageTsx).toContain('@max-[779px]/tabel:[&_thead]:hidden');
    expect(pageTsx).toContain('@max-[779px]/tabel:[&_tr]:flex @max-[779px]/tabel:[&_tr]:flex-wrap');
    expect(pageTsx).toContain('const NUM_PUSH = `${NUM} @max-[779px]/tabel:ml-auto`;');
    expect(pageTsx).toContain('@max-[779px]/tabel:order-1 @max-[779px]/tabel:max-w-none @max-[779px]/tabel:basis-full');
    // Piutang: Sisa didorong, Umur (kolom angka kedua) tidak.
    expect(pageTsx).toContain('<td className={cn(NUM_PUSH, MONO, TEXT.exp)}>{fmtRp(r.outstanding)}</td>');
    expect(pageTsx).toMatch(/<td className=\{NUM\}>\s*<Badge variant=\{AGE_BADGE\[r\.bucket\]\}>/);
    // Judul kolom angka rata kanan (dulu kalah oleh text-align kiri milik th).
    expect(pageTsx).toContain('[&_th[data-num]]:text-right');
    expect(pageTsx.match(/<th scope="col" data-num="">/g)).toHaveLength(4);
    // Tabel tanpa thead tetap berjudul bagi pembaca layar.
    expect(pageTsx.match(/<caption className="sr-only">/g)).toHaveLength(3);
  });

  it('tombol ekspor berpindah baris bersama dan tak meluber di 320px', () => {
    expect(pageTsx).toContain(
      '<span className="inline-flex shrink-0 gap-2 @max-[721px]/laporan:w-full @max-[721px]/laporan:flex-wrap @max-[721px]/laporan:[&>*]:flex-auto">',
    );
  });

  it('tautan kategori di baris rincian: area klik selebar baris, di atas batang', () => {
    expect(pageTsx).toContain('const CAT_LINK_ROW = `${LINK_BASE} after:inset-0 after:z-[1]`;');
    expect(pageTsx).toContain('className={inRow ? CAT_LINK_ROW : CAT_LINK}');
    expect(pageTsx.match(/financeLink\(cat, true\)/g)).toHaveLength(2);
    expect(pageTsx).toContain('pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-4');
    // Baris rincian = pembungkus posisi bagi ::after itu.
    expect(pageTsx).toContain('<li className={`relative flex flex-col gap-1.5');
  });

  it('nada: pengeluaran netral, negatif jingga, kritis merah; vonis di panel navy', () => {
    expect(pageTsx).toContain("exp: 'text-foreground',");
    expect(pageTsx).toContain("neg: 'text-warning-foreground',");
    expect(pageTsx).toContain("crit: 'text-destructive',");
    expect(pageTsx).toContain('rounded-2xl bg-primary px-6 py-5 text-primary-foreground');
    expect(pageTsx).not.toMatch(/readout-|scanline|accent=/);
  });

  it('grafik tren memakai token Nuara, pengeluaran tetap garis putus', () => {
    expect(chartTsx).toContain('strokeDasharray="4 3" className="stroke-muted-foreground"');
    expect(chartTsx).toContain('className="stroke-success-foreground"');
    expect(chartTsx).toContain("const AXIS_LABEL = 'fill-muted-foreground font-mono text-xs';");
  });
});
