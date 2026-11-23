import { describe, expect, it } from 'vitest';
import pageTsx from './PosPage.tsx?raw';
import catalogTsx from './PosCatalog.tsx?raw';
import historyTsx from './PosHistory.tsx?raw';
import historyCss from './PosHistory.module.css?raw';
import appCss from '@/styles/app.css?raw';

// Halaman Kasir dipecah per bagian; aturannya berlaku untuk semuanya.
const tsx = [pageTsx, catalogTsx, historyTsx].join('\n');
// Sejak L-50 PosPage dan PosCatalog memakai kelas Tailwind; PosHistory masih
// CSS FixMaster sampai L-61.
const posModules = Object.keys(import.meta.glob('./*.module.css'));

/**
 * Mekanisme tata letak Kasir yang pernah rusak di ponsel. Piksel tak bisa
 * diukur di jsdom; ukuran sungguhan dicek lewat Playwright (lihat Decisions &
 * Bug Fixes, Kasir ponsel 9 Nov 2026). Tes ini menjaga agar mekanismenya tak
 * kembali diam-diam.
 */
describe('tata letak Kasir', () => {
  it('kelas Tailwind Kasir dibuat: berkasnya disebut @source, CSS module-nya hilang', () => {
    // Tanpa @source kelas di berkas ini tak pernah dibuat dan halaman tampil
    // tanpa gaya; folder pos belum bisa disebut utuh selama PosHistory lama.
    expect(appCss).toContain('@source "../features/pos/PosPage.tsx";');
    expect(appCss).toContain('@source "../features/pos/PosCatalog.tsx";');
    expect(posModules).toEqual(['./PosHistory.module.css']);
    expect(pageTsx).not.toContain('styles.');
    expect(catalogTsx).not.toContain('styles.');
  });

  it('kolom katalog boleh menyempit di bawah lebar baris chip kategori', () => {
    // 1fr polos punya minimum = isi terpanjang: 13 kategori melebarkan kolom
    // ke 1266px di layar 390px dan total keluar layar.
    expect(pageTsx).not.toMatch(/grid-cols-\[1fr_minmax\(320px/);
    expect(pageTsx).not.toMatch(/drawer:grid-cols-(1|\[1fr\])/);
    expect(pageTsx).toContain('grid-cols-[minmax(0,1fr)_minmax(320px,400px)]');
    expect(pageTsx).toContain('drawer:grid-cols-[minmax(0,1fr)]');
    // Akar halaman memegang kolom yang sama saat tata letak "dibuka".
    expect(pageTsx).toContain('min-[1025px]:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]');
    expect(pageTsx).toContain('min-[1025px]:contents');
  });

  it('register setinggi layar di desktop, bar Proses menempel di semua lebar', () => {
    expect(pageTsx).toContain('min-[1025px]:h-[calc(var(--app-vh)-var(--pos-register-top)-var(--space-4))]');
    expect(pageTsx).toContain('min-[1025px]:sticky min-[1025px]:bottom-0');
    // Kolom yang difokus saat seluruh register menggulir mendarat di antara
    // total (140–170px) dan bar Proses (84px), bukan di baliknya.
    expect(pageTsx).toContain('min-[1025px]:[scroll-padding-block:176px_88px]');
    // Kolom tunggal: overflow clip, bukan hidden/auto, supaya panel bukan wadah
    // gulir dan bar menempel ke layar, bukan ke panel.
    expect(pageTsx).toMatch(/'relative flex flex-col overflow-clip /);
    expect(pageTsx).toContain('drawer:sticky drawer:bottom-[env(safe-area-inset-bottom)]');
    expect(pageTsx).toContain('phone:bottom-[calc(var(--mobile-nav-height)+var(--space-2)+env(safe-area-inset-bottom))]');
  });

  it('dock membaca entri observer terakhir dan batasnya diukur', () => {
    // ([e]) => membaca entri pertama yang bisa basi; dock lalu menutupi Proses.
    expect(tsx).not.toMatch(/new IntersectionObserver\(\(\[e\]\)/);
    expect(tsx).toContain('entries[entries.length - 1]');
    expect(tsx).toContain('ref={measureDock}');
  });

  it('satu tampilan katalog: kartu, tanpa pemilih tampilan', () => {
    expect(tsx).not.toContain('ViewToggle');
    expect(tsx).not.toContain('usePersistedView');
    expect(catalogTsx).toContain('grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]');
  });

  it('satu kartu untuk jual dan stok: tanpa tombol bersarang, barang habis tetap tampil', () => {
    // Kartu = <article>; tombol tambah dan tuts kelola bersaudara.
    expect(catalogTsx).toContain('<article');
    expect(catalogTsx).toMatch(/<\/button>\s*\{canManage && \(\s*<div className="flex border-t/);
    // Tuts kelola hanya untuk yang boleh menulis stok; karyawan tidak.
    expect(catalogTsx).toContain("roleAllows(me.role, 'inventory.write')");
    // Dulu dipotong mati di 50 dan barang habis disembunyikan kecuali dicari.
    expect(catalogTsx).not.toContain('.slice(0, 50)');
    expect(catalogTsx).toContain('filterCatalog(');
    // Redup hanya isi area tambah, tuts + Stok tetap terang.
    expect(catalogTsx).toContain('[&:disabled>*]:opacity-55');
  });

  it('Semua Outlet: katalog boleh dijelajah, cabang dipilih saat barang pertama', () => {
    expect(pageTsx).toContain('onAdd={requestAdd}');
    expect(pageTsx).toContain('setCartOutlet(id)');
    // Pilihan cabang = tombol berstatus, bukan radio tanpa label.
    expect(pageTsx).toContain('aria-pressed={o.id === activeOutletId}');
  });

  it('bar Proses yang belum siap tetap bisa diketuk dan menuntun', () => {
    // disabled menelan ketukan tanpa penjelasan; kasir di ponsel tak tahu
    // kolom mana yang kurang karena status ada di balik bar. Hanya saat
    // memproses tombol benar-benar mati (cegah transaksi ganda).
    expect(tsx).not.toMatch(/disabled=\{!settle\.ok/);
    expect(pageTsx).toContain('disabled={busy}');
    expect(tsx).toContain('aria-disabled={!barReady || undefined}');
    expect(tsx).toContain('onClick={barReady ? checkout : guidePay}');
    // Kolom yang dituju mendarat di atas bar yang menempel, bukan di baliknya.
    expect(pageTsx).toContain("'drawer:[&_:is(input,button)]:scroll-mb-24 ");
    expect(pageTsx).toMatch(/<div className=\{cn\('grid gap-3 px-5 pt-4', clearOfBarInside\)\}>/);
    expect(pageTsx).toMatch(/id="pos-pay-status"\s*className=\{cn\(\s*'[^']*',\s*clearOfBar,/);
  });

  it('baris riwayat dua baris, tuts turun lewat container query', () => {
    // Satu baris flex menggencet info di 320px. Ambang menjaga muat/tidak
    // muat, jadi wajib @container (AGENTS.md §3), bukan @media.
    expect(historyCss).toMatch(/\.historyList \{[^}]*container-type: inline-size/);
    expect(historyCss).toMatch(/\.historyRow \{[^}]*display: grid/);
    expect(historyCss).toContain('@container (max-width: 432px)');
    expect(historyTsx).toContain('className={styles.historyActions}');
  });

  it('teks 320px: total pas lebar, nominal turun, live region sempit, tanpa literal', () => {
    // Total 9 digit dulu patah dua baris di 320px.
    expect(pageTsx).toContain("'--lcd-chars': totalText.length");
    expect(pageTsx).toContain('text-[length:min(2.35rem,calc(100cqi/(var(--lcd-chars,12)*0.62)))]');
    expect(pageTsx).toContain('@container/reg ');
    // Kolom nominal 94px memotong "3.450.000"; ambang diukur, wajib @container.
    // @max-[271px] = lebar < 271, sama dengan max-width: 270px dulu.
    expect(pageTsx).toContain('@container/pay ');
    expect(pageTsx).toContain('@max-[271px]/pay:grid-cols-[minmax(0,1fr)_auto]');
    expect(pageTsx).toContain('grid-cols-[90px_minmax(0,1fr)_auto]');
    // aria-live di seluruh register membacakan cabang & faktur tiap ubah qty.
    expect(pageTsx.match(/aria-live=/g)).toHaveLength(1);
    expect(pageTsx).toContain('<p className="sr-only" aria-live="polite" aria-atomic="true">');
    expect(tsx).toContain('role="combobox"');
    for (const lit of ['TOTAL · IDR', '>PUSAT<', '>LIVE<', 'Klik produk', '>stok {']) {
      expect(tsx).not.toContain(lit);
    }
  });

  it('Riwayat lama di luar lingkup dens: data-nu per bagian, bukan di akar halaman', () => {
    // Reset [data-nu] * (padding, border, font) mengecilkan tombol cetak/batal
    // PosHistory di ponsel. Akar halaman memegang tab Riwayat, jadi tanpa data-nu.
    expect(pageTsx).toMatch(/ {2}return \(\n {4}<div\n {6}className=\{cn\(/);
    expect(pageTsx.match(/^\s*(<div |<button\n\s*)?data-nu\b/gm)).toHaveLength(3);
  });

  it('motif bench FixMaster dibuang: tanpa digit hantu LCD', () => {
    // K-13: panel total navy menggantikan LCD (digit hantu, garis pindai, LED).
    expect(pageTsx).not.toContain('totalGhost');
    expect(pageTsx).not.toContain("replace(/[0-9]/g, '8')");
  });
});
