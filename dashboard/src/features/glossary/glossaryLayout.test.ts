import { describe, expect, it } from 'vitest';
import pageTsx from './GlossaryPage.tsx?raw';
import appCss from '@/styles/app.css?raw';

const cssModules = Object.keys(import.meta.glob('./*.module.css'));

/** Mekanisme Kamus Istilah sejak pindah ke dens-ui (L-65). */
describe('Kamus Istilah', () => {
  it('folder bertailwind: di @source utuh, tanpa CSS Module, satu data-nu di akar', () => {
    expect(appCss).toContain('@source "../features/glossary";');
    expect(cssModules).toEqual([]);
    expect(pageTsx).not.toContain('styles.');
    expect(pageTsx).not.toMatch(/from '@\/components\/ui'/);
    expect(pageTsx).toContain('<div data-nu className="@container/glossary flex max-w-[64rem] flex-col gap-4 bg-transparent">');
    expect(pageTsx.match(/\bdata-nu\b/g)).toHaveLength(1);
  });

  it('indeks berkolom 17rem; di wadah <54rem jadi satu baris geser yang memudar di tepi', () => {
    expect(pageTsx).toContain("'columns-[17rem] gap-x-5");
    expect(pageTsx).toContain('@max-[54rem]/glossary:flex @max-[54rem]/glossary:columns-auto');
    expect(pageTsx).toContain('@max-[54rem]/glossary:overflow-x-auto');
    expect(pageTsx).toContain('@max-[54rem]/glossary:scroll-fade-x');
  });

  it('chip aktif tetap menyala di baris geser (varian container datang sesudah aria-*)', () => {
    expect(pageTsx).toContain("aria-current={active === g.id ? 'location' : undefined}");
    expect(pageTsx).toContain('@max-[54rem]/glossary:aria-[current=location]:bg-primary');
    expect(pageTsx).toContain('@max-[54rem]/glossary:pointer-coarse:h-11');
  });

  it('lembar istilah: kisi auto-fill tak pernah lebih lebar dari wadah, anchor tak tertutup topbar', () => {
    expect(pageTsx).toContain('grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))]');
    expect(pageTsx).toContain('scroll-mt-36');
    expect(pageTsx).toContain("active === g.id && 'ring-2 ring-primary'");
  });
});
