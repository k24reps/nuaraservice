import { describe, expect, it } from 'vitest';
import pageTsx from './FinancePage.tsx?raw';
import modulesCss from './FinancePage.module.css?raw';
import appCss from '@/styles/app.css?raw';

const modalSources = import.meta.glob(['./*Modal.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/**
 * Mekanisme halaman Keuangan sejak pindah ke dens-ui (L-52). Lima modal masih
 * FixMaster sampai L-63 dan memakai sisa FinancePage.module.css.
 */
describe('halaman Keuangan', () => {
  it('halaman bertailwind: berkasnya di @source, tanpa CSS Module, satu data-nu di akar', () => {
    expect(appCss).toContain('@source "../features/finance/FinancePage.tsx";');
    expect(appCss).not.toContain('@source "../features/finance";');
    expect(pageTsx).not.toContain('styles.');
    expect(pageTsx).not.toContain('.module.css');
    expect(pageTsx).toContain('<div data-nu className="@container/finance flex flex-col gap-4 bg-transparent phone:gap-3">');
    expect(pageTsx.match(/\bdata-nu\b/g)).toHaveLength(1);
  });

  it('sisa CSS Module hanya memuat kelas yang dipakai modal', () => {
    const classes = new Set([...modulesCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]));
    const used = new Set(Object.values(modalSources).flatMap((src) => [...src.matchAll(/styles\.(\w+)/g)].map((m) => m[1])));
    for (const c of classes) expect(used, `kelas .${c} tak dipakai modal mana pun`).toContain(c);
    for (const c of used) expect(classes, `modal memakai .${c} yang hilang`).toContain(c);
  });

  it('pita buku kas: kolom aksi tetap dua tombol, baris turun dua tingkat lewat container query', () => {
    // Kolom aksi tetap supaya tepi kanan nominal tak melompat antarbaris.
    expect(pageTsx).toContain("grid-cols-[minmax(0,1fr)_auto_var(--tape-btns)] [grid-template-areas:'body_amount_btns']");
    expect(pageTsx).toContain('[--tape-btns:82px] pointer-coarse:[--tape-btns:90px]');
    expect(pageTsx).toContain("@max-[561px]/finance:[grid-template-areas:'body_body'_'amount_btns']");
    // Arus bersih per hari sejajar kolom nominal.
    expect(pageTsx).toContain('pr-[calc(1.25rem+var(--tape-btns)+0.75rem)]');
  });

  it('strip wallet, ringkasan, dan aksi menyesuaikan lebar wadah, bukan layar', () => {
    expect(pageTsx).toContain('@max-[561px]/finance:grid-cols-2');
    expect(pageTsx).toContain('@max-[561px]/finance:grid-cols-3');
    expect(pageTsx).toContain('@max-[361px]/finance:[&_svg]:hidden');
    // Hitung saldo pindah ke sel Total di wadah sempit.
    expect(pageTsx).toContain('hidden h-7 px-3 text-xs shadow-none @max-[561px]/finance:inline-flex');
    expect(pageTsx).toContain('className="@max-[561px]/finance:hidden" onClick={() => setCountOpen(true)}');
    expect(pageTsx).not.toMatch(/[\s'"](narrow|compact):/);
  });

  it('filter kategori tetap bergrup (Radix Select tak menerima value kosong)', () => {
    expect(pageTsx).toContain("const ALL_CATEGORIES = '__semua__';");
    expect(pageTsx).toContain('<SelectGroup key={g.key}>');
    expect(pageTsx).toContain('setCategoryFilter(v === ALL_CATEGORIES ? null : v);');
  });

  it('konfirmasi batal transfer dan hapus catatan mati selama diproses', () => {
    expect(pageTsx).toContain('loading={voiding}');
    expect(pageTsx).toContain('loading={deleting}');
  });
});
