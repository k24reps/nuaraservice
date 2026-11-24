import { describe, expect, it } from 'vitest';
import pageTsx from './CalculatorPage.tsx?raw';
import appCss from '@/styles/app.css?raw';

const cssModules = Object.keys(import.meta.glob('./*.module.css'));

/** Mekanisme Kalkulator Biaya sejak pindah ke dens-ui (L-65). */
describe('Kalkulator Biaya', () => {
  it('folder bertailwind: di @source utuh, tanpa CSS Module, satu data-nu di akar', () => {
    expect(appCss).toContain('@source "../features/calculator";');
    expect(cssModules).toEqual([]);
    expect(pageTsx).not.toContain('styles.');
    expect(pageTsx).not.toMatch(/from '@\/components\/ui'/);
    expect(pageTsx).toContain('<div data-nu data-calc-page className="@container/calc bg-transparent">');
    expect(pageTsx.match(/\bdata-nu\b/g)).toHaveLength(1);
  });

  it('scroll-padding <html> pindah ke app.css, dikaitkan data-calc-page', () => {
    // Kedua aturan (bawaan dan <=720px) memakai kait yang sama dengan halaman.
    expect(appCss.match(/html:has\(\[data-calc-page\]\) \{/g)).toHaveLength(2);
    // Kait selalu atribut data-*, tak pernah nama kelas (Tarif, L-67: data-save-bar; Lacak, L-56: data-nota-page).
    expect(appCss).not.toMatch(/html:has\((?!\[data-(calc-page|save-bar|nota-page)\b)/);
    expect(appCss).toContain('scroll-padding-bottom: calc(var(--space-3) + 6.5rem);');
    expect(appCss).toContain('scroll-padding-bottom: calc(var(--mobile-nav-height) + var(--space-2) + env(safe-area-inset-bottom) + 6.5rem);');
  });

  it('dua kolom di 49rem dan chip di samping kotak di 34rem, lewat container query', () => {
    expect(pageTsx).toContain('@min-[49rem]/calc:grid @min-[49rem]/calc:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]');
    expect(pageTsx).toContain('<ol className="@container/fields">');
    expect(pageTsx).toContain('@min-[34rem]/fields:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)]');
    expect(pageTsx).toContain("const SIDE = 'min-w-0 @min-[34rem]/fields:pt-5';");
  });

  it('sempit: wadah harga display:contents, register menempel di atas menu bawah', () => {
    expect(pageTsx).toMatch(/const QUOTE = \[\n\s+'contents',/);
    expect(pageTsx).toContain('@container/register sticky bottom-3 z-[calc(var(--z-sticky)-1)]');
    expect(pageTsx).toContain('phone:bottom-[calc(var(--mobile-nav-height)+var(--space-2)+env(safe-area-inset-bottom))]');
    expect(pageTsx).toContain('@min-[49rem]/calc:relative @min-[49rem]/calc:bottom-auto');
    // Tombol lompat ke struk hanya di satu kolom.
    expect(pageTsx).toContain('focus-visible:ring-inset @min-[49rem]/calc:hidden');
  });

  it('register navy tanpa layar LCD; angka harga tetap sebaris mengikuti jumlah karakter', () => {
    expect(pageTsx).toContain('bg-primary px-4 py-3 text-primary-foreground');
    expect(pageTsx).toContain('text-[length:min(2.35rem,100cqi_/_(var(--lcd-chars,12)_*_0.62))]');
    expect(pageTsx).toContain("style={{ '--lcd-chars': priceText.length } as CSSProperties}");
    expect(pageTsx).not.toMatch(/readout-|text-shadow|scanline/);
  });

  it('chip tarif: tombol toggle aria-pressed, 44px di layar sentuh', () => {
    expect(pageTsx).toContain('aria-pressed={on}');
    expect(pageTsx).toContain('h-10 items-center');
    expect(pageTsx).toContain('pointer-coarse:h-11');
  });
});
