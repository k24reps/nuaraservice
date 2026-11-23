import { describe, expect, it } from 'vitest';
import pageTsx from './FinancePage.tsx?raw';
import appCss from '@/styles/app.css?raw';

const modalSources = import.meta.glob(['./*Modal.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const cssModules = Object.keys(import.meta.glob('./*.module.css'));

/**
 * Mekanisme halaman Keuangan (L-52) dan lima modalnya (L-63) sejak pindah ke
 * dens-ui.
 */
describe('halaman Keuangan', () => {
  it('folder bertailwind: di @source utuh, tanpa CSS Module, satu data-nu di akar halaman', () => {
    expect(appCss).toContain('@source "../features/finance";');
    expect(appCss).not.toContain('@source "../features/finance/');
    expect(cssModules).toEqual([]);
    for (const src of [pageTsx, ...Object.values(modalSources)]) {
      expect(src).not.toContain('styles.');
      expect(src).not.toContain('.module.css');
      for (const [, names] of src.matchAll(/import \{([^}]*)\} from '@\/components\/ui';/g)) {
        for (const n of names.split(',').map((x) => x.trim()).filter(Boolean)) {
          expect(['LoadState', 'loadPending', 'Term']).toContain(n);
        }
      }
    }
    expect(pageTsx).toContain('<div data-nu className="@container/finance flex flex-col gap-4 bg-transparent phone:gap-3">');
    expect(pageTsx.match(/\bdata-nu\b/g)).toHaveLength(1);
  });

  it('lima modal: FormDialog, fokus awal lewat data-autofocus', () => {
    expect(Object.keys(modalSources)).toHaveLength(5);
    for (const [file, src] of Object.entries(modalSources)) {
      expect(src, file).toContain('<FormDialog');
      expect(src, file).not.toMatch(/\bautoFocus\b/);
      expect(src, file).toContain('data-autofocus');
    }
  });

  it('kategori catat tetap bergrup; readout hitung saldo turun jadi baris di jendela sempit', () => {
    expect(modalSources['./EntryModal.tsx']).toContain('groups={categoryGroups}');
    expect(modalSources['./CountModal.tsx']).toContain('<div className="@container/count">');
    expect(modalSources['./CountModal.tsx']).toContain('@max-[421px]/count:grid-cols-1');
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
