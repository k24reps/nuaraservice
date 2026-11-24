import { describe, expect, it } from 'vitest';
import pageTsx from './TrackingPage.tsx?raw';
import previewTsx from '@/dev/TrackingPreview.tsx?raw';
import appTsx from '@/App.tsx?raw';
import appCss from '@/styles/app.css?raw';
import themeCss from '@/styles/nuara-theme.css?raw';
import { id } from '@/i18n/id';

/**
 * Halaman lacak (S-07, L-56): dunia "Nota Servis Rangkap". Tes ini mengunci
 * kontrak tata letak dari teks sumber, seperti halaman lain yang sudah dipindah.
 */
describe('Halaman lacak (L-56)', () => {
  it('folder dipindai Tailwind, tanpa CSS Module dan tanpa komponen FixMaster', () => {
    expect(appCss).toContain('@source "../features/tracking";');
    expect(Object.keys(import.meta.glob('./*.module.css'))).toEqual([]);
    expect(pageTsx).not.toContain('styles.');
    expect(pageTsx).not.toMatch(/from '@\/components\/ui/);
    expect(pageTsx).not.toMatch(/\bautoFocus\b/);
  });

  it('akar: data-nu + kait data-nota-page + wadah nota; meja navy tanpa gulir samping', () => {
    expect(pageTsx).toContain('data-nu\n      data-nota-page');
    expect(pageTsx).toContain('@container/nota min-h-dvh overflow-x-clip bg-counter font-print text-on-counter');
    expect(pageTsx.match(/\bdata-nu\b/g)).toHaveLength(1);
    // Aturan <html> (latar karet gulir, bilah gulir amber) memakai kait atribut, bukan kelas.
    expect(appCss).toContain('html:has([data-nota-page])');
    expect(pageTsx).toContain('max-w-[560px]');
  });

  it('kelas Tailwind ditulis utuh: tak ada awalan varian yang dirangkai dari konstanta', () => {
    expect(pageTsx).not.toMatch(/\$\{\w+\}:[a-z[-]/);
  });

  it('Archivo variabel di-host sendiri lewat paket, bukan permintaan ke pihak ketiga', () => {
    expect(pageTsx).toContain("import '@fontsource-variable/archivo/wdth.css';");
    expect(themeCss).toContain('--nu-font-print: "Archivo Variable"');
    expect(themeCss).toContain('--font-print: var(--nu-font-print);');
    expect(pageTsx).not.toMatch(/Kalam/);
  });

  it('satu cap bulat per halaman, mendarat sekali, dan diam bila gerak dikurangi', () => {
    expect(pageTsx.match(/(?<![-\w])nota-stamp(?![-\w])/g)).toHaveLength(1);
    expect(pageTsx).toContain('motion-safe:animate-nota-stamp');
    expect(pageTsx).not.toMatch(/[\s'"`]animate-nota-stamp/);
    // Hanya `scale` yang bergerak: cap tampak sejak awal dan miringnya tak ikut berubah.
    const keyframes = themeCss.match(/@keyframes nota-stamp \{([\s\S]*?)\n {2}\}/)?.[1] ?? '';
    expect(keyframes).toContain('scale: 1.1;');
    expect(keyframes).not.toMatch(/opacity|transform|rotate/);
    // Pemutar hanya berputar bila gerak tak dikurangi.
    expect(pageTsx).not.toMatch(/[\s'"`]animate-spin/);
  });

  it('rangkap amber dan teal di bawah nota; alur servis di lembar teal; garansi di lembar pelanggan amber', () => {
    expect(pageTsx).toContain('rotate-[2.2deg] rounded-[3px] bg-teal');
    expect(pageTsx).toContain('-rotate-[1.4deg] rounded-[3px] bg-amber');
    expect(pageTsx).toContain('nota-holes');
    expect(pageTsx).toContain('aria-labelledby="flow-title"');
    expect(pageTsx).toContain('aria-labelledby="stub-title"');
    expect(pageTsx).toContain("aria-current={i === 0 ? 'step' : undefined}");
  });

  it('isian pengguna dan toko membungkus kata panjang di dalam lembarnya', () => {
    // Nama toko, alamat, perangkat, jenis, catatan toko, catatan riwayat, alamat kontak, dan nomor yang dicari.
    expect(pageTsx.match(/\[overflow-wrap:anywhere\]/g)!.length).toBeGreaterThanOrEqual(9);
  });

  it('target sentuh: tautan, tombol, isian, dan ringkasan S&K setinggi >= 44px', () => {
    expect(pageTsx).toContain('inline-flex min-h-11 items-center gap-2 self-start');
    expect(pageTsx).toContain('inline-flex h-12 shrink-0 items-center justify-center gap-2');
    expect(pageTsx).toContain('inline-flex min-h-12 items-center gap-2 rounded-lg bg-amber');
    expect(pageTsx).toContain('flex min-h-11 cursor-pointer list-none items-center');
    expect(pageTsx).toContain('inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink');
    expect(pageTsx).toContain('h-11 min-w-0 flex-1');
  });

  it('S&K tertutup bawaan; nomor telepon berupa teks yang bisa disalin', () => {
    expect(pageTsx).toMatch(/<details className=\{cn\('group'/);
    expect(pageTsx).not.toMatch(/<details[^>]*\bopen\b/);
    expect(pageTsx).toContain('select-all');
  });

  it('logika dan teks tak tertanam: pesan batas laju dan kode salah lewat kunci i18n', () => {
    expect(pageTsx).toContain("t('tracking.rateLimited')");
    expect(pageTsx).toContain("t('tracking.rateLimitedHint')");
    expect(pageTsx).toContain("t('tracking.codeInvalid')");
    expect(pageTsx).not.toContain('Terlalu banyak permintaan');
    expect(pageTsx).not.toContain('Kode lacak terdiri');
  });

  it('teks lacak menyapa "kamu", tanpa "Anda" (AFD F-04)', () => {
    const own = Object.entries(id).filter(([k]) => k.startsWith('tracking.'));
    expect(own.length).toBeGreaterThan(40);
    for (const [k, v] of own) expect(v, k).not.toMatch(/\bAnda\b/);
  });

  it('harness /dev/lacak hanya ada di dev server', () => {
    expect(appTsx).toContain('const TrackingPreview = import.meta.env.DEV');
    expect(appTsx).toContain("path === '/dev/lacak'");
    expect(previewTsx).toContain('FailingAdapter');
  });
});
