/**
 * Probe kontras DOM — mengukur warna teks yang BENAR-BENAR dirender, bukan
 * daftar token. Ini menangkap warna hasil racikan (`color-mix`, lapisan
 * semi-transparan, tumpukan latar) yang tak terlihat dari daftar token.
 *
 * Komposit yang tidak bisa dipastikan — latar bergambar, atau rantai induk
 * yang tetap transparan — DILEWATI dan dihitung terpisah, bukan ditebak.
 * Latar gradien diuji terhadap TIAP titik warnanya (kasus terburuk) dan
 * dilaporkan di daftar sendiri: titik terburuk belum tentu berada di bawah
 * teksnya, jadi ia diperiksa manual, tidak ikut menggagalkan gerbang.
 *
 * Butuh dev server jalan:
 *   BASE_URL=http://localhost:5173 node scripts/audit-contrast.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
// PW_CHROMIUM: jalur Chromium lain bila versi bawaan @playwright/test tidak terpasang (mis. container cloud).
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);

const scan = () => {
  // Tailwind 4 menulis warna beropasitas (`text-foreground/75`) sebagai
  // color-mix, yang dihitung browser menjadi `oklab(...)`/`color(srgb ...)`.
  // Format selain rgb() dibaca lewat canvas 1x1; tanpa ini teksnya dilewati
  // diam-diam (L-47: 11 label menu sidebar tidak pernah diperiksa).
  const ctx2d = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true });
  const parse = (c) => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    if (!c || c === 'transparent') return null;
    ctx2d.clearRect(0, 0, 1, 1);
    ctx2d.fillStyle = '#000';
    ctx2d.fillStyle = c;
    ctx2d.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx2d.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const lum = ([r, g, b]) => {
    const f = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (fg, bg) => {
    const a = fg[3];
    return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
  };

  /** Tumpuk lapisan semi-transparan (terdekat ke teks di indeks 0) di atas dasar. */
  const compose = (stack, base) => {
    let acc = base;
    for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc);
    return acc;
  };

  /**
   * Latar efektif sebuah elemen: { colors, gradient } atau null bila tidak bisa
   * dipastikan. Lebih dari satu warna = titik-titik sebuah gradien.
   */
  const bgOf = (el) => {
    const stack = [];
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      const img = s.backgroundImage;
      if (img && img !== 'none') {
        if (/url\(/.test(img) || !/gradient/.test(img)) return null; // gambar
        const stops = (img.match(/rgba?\([^)]*\)/g) || []).map(parse).filter(Boolean);
        if (!stops.length) return null;
        // Dasar gradien: warna latar elemen ini sendiri, lalu induknya.
        const own = parse(s.backgroundColor);
        const below = n.parentElement ? bgOf(n.parentElement) : null;
        let bases = below ? below.colors : [[255, 255, 255]];
        if (own && own[3] > 0) bases = bases.map((b) => over(own, b));
        const colors = [];
        for (const st of stops) for (const b of bases) colors.push(compose(stack, over(st, b)));
        return { colors, gradient: true };
      }
      const c = parse(s.backgroundColor);
      if (!c || c[3] === 0) continue;
      if (c[3] === 1) return { colors: [compose(stack, [c[0], c[1], c[2]])], gradient: false };
      stack.unshift(c);
    }
    return null;
  };

  const out = { fail: [], gradFail: [], skipped: 0, checked: 0 };
  for (const el of document.querySelectorAll('*')) {
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join('');
    if (!text) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (s.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue; // teks ber-gradien

    const fg = parse(s.color);
    const bg = bgOf(el);
    if (!fg || !bg) {
      out.skipped++;
      continue;
    }
    // Rasio terburuk di antara semua kemungkinan latar (satu, kecuali gradien).
    let ratio = Infinity;
    let worst = bg.colors[0];
    for (const b of bg.colors) {
      const f = fg[3] < 1 ? over(fg, b) : [fg[0], fg[1], fg[2]];
      const [hi, lo] = [lum(f), lum(b)].sort((x, y) => y - x);
      const r = (hi + 0.05) / (lo + 0.05);
      if (r < ratio) {
        ratio = r;
        worst = b;
      }
    }

    const px = parseFloat(s.fontSize);
    const bold = +s.fontWeight >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const min = large ? 3 : 4.5;
    out.checked++;
    if (ratio < min) {
      (bg.gradient ? out.gradFail : out.fail).push({
        ratio: +ratio.toFixed(2),
        min,
        px: +px.toFixed(1),
        fg: s.color,
        bg: `rgb(${worst.map((v) => Math.round(v)).join(', ')})`,
        text: text.slice(0, 45),
        cls: (el.className && el.className.baseVal !== undefined
          ? el.className.baseVal
          : String(el.className || '')
        ).slice(0, 55),
      });
    }
  }
  return out;
};

// Nuara Dashboard: landing FixMaster sudah dibuang (L-43). `/` di dev server
// tanpa Supabase merender wizard toko; /dev/komponen = katalog dens-ui (L-46);
// /dev/layar = layar masuk, daftar, PIN, dan password baru (L-58), yang di
// mode lokal tidak pernah tampil.
const routes = [
  ['/demo', 'demo-dashboard'],
  ['/', 'wizard'],
  ['/dev/komponen', 'komponen-dens'],
  ['/dev/layar?layar=masuk', 'layar-masuk'],
  ['/dev/layar?layar=daftar', 'layar-daftar'],
  ['/dev/layar?layar=pin', 'layar-pin'],
  ['/dev/layar?layar=reset-form', 'layar-password-baru'],
  // Halaman lacak (L-56): dunia nota berwarna (kertas putih, rangkap teal dan
  // amber, cap merah, nomor oranye), tiket selesai bergaransi, tiket tanpa
  // garansi, dan kartu "tidak ditemukan".
  ['/dev/lacak?no=FM-0007', 'lacak-selesai'],
  ['/dev/lacak?no=FM-0004', 'lacak-konfirmasi'],
  ['/dev/lacak?no=ZZ-9999', 'lacak-tidak-ditemukan'],
];

let total = 0;
let gradTotal = 0;
const report = async (page, label) => {
  const r = await page.evaluate(scan);
  total += r.fail.length;
  console.log(`\n${label} — diperiksa ${r.checked}, dilewati ${r.skipped}, gagal ${r.fail.length}`);
  for (const f of r.fail.slice(0, 12)) {
    console.log(`  ${f.ratio}:1 (min ${f.min}) ${f.px}px  "${f.text}"
       fg ${f.fg}  bg ${f.bg}  .${f.cls}`);
  }
  gradTotal += r.gradFail.length;
  for (const f of r.gradFail.slice(0, 6)) {
    console.log(`  [gradien, periksa manual] ${f.ratio}:1 (min ${f.min}) ${f.px}px  "${f.text}"
       fg ${f.fg}  titik terburuk ${f.bg}  .${f.cls}`);
  }
};
// Nuara hanya punya tema terang sejak L-47 (P14.1).
for (const theme of ['light']) {
  for (const [path, name] of routes) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.evaluate((t) => {
      localStorage.setItem('fixmaster-theme', t);
      document.documentElement.setAttribute('data-theme', t);
    }, theme);
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    // Demo baru merender dashboard setelah seed selesai; tanpa menunggu ini
    // tema terang hanya memeriksa 1 elemen (terukur 27 Sep 2026).
    if (path === '/demo') await page.locator('a[href="/services"]').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2500);
    await report(page, `${name} / ${theme}`);
    await page.close();
  }
}

// Menu lain di dalam demo. Demo memakai MemoryRouter — tak terjangkau lewat URL —
// jadi sidebar diklik. Sebelum ini hanya dashboard + landing yang diperiksa, dan
// 58 teks tema terang di bawah ambang (primitif terang tema gelap dipakai sebagai
// warna teks) tersembunyi di 9 halaman lain sampai 24 Sep 2026.
// 'Kasir' cocok dengan "Kasir & Stok" (Inventori dilebur ke sana 10 Nov 2026).
const MENUS = ['Servis', 'Kalkulator Biaya', 'Kasir', 'Pelanggan', 'Supplier', 'Keuangan',
  'Tugas', 'Absensi', 'Laporan', 'Log Aktivitas', 'Pengaturan'];
for (const theme of ['light']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(BASE + '/demo', { waitUntil: 'networkidle' });
  await page.evaluate((t) => localStorage.setItem('fixmaster-theme', t), theme);
  await page.goto(BASE + '/demo', { waitUntil: 'networkidle' });
  await page.locator('a[href="/services"]').first().waitFor({ timeout: 20000 });
  for (const menu of MENUS) {
    try {
      await page.getByRole('link', { name: new RegExp('^' + menu) }).first().click();
    } catch {
      console.log(`\ndemo-${menu} / ${theme} — navigasi gagal (tautan tak ditemukan)`);
      total++;
      continue;
    }
    await page.waitForTimeout(1300);
    await report(page, `demo-${menu} / ${theme}`);
  }

  // Jendela & detail tiket Servis. Gerbang ini dulu hanya memindai halaman yang
  // terbuka tanpa interaksi, sehingga teks petunjuk StatusModal (.dp, 1,9:1 di
  // tema terang) dan "Lunas" di panel biaya detail (3,1:1) lolos sampai critique
  // 27 Sep 2026 menemukannya.
  const steps = [
    ['Servis-UpdateStatus', async () => {
      await page.getByRole('link', { name: /^Servis/ }).first().click();
      await page.waitForTimeout(900);
      // Lencana status di daftar (dens-ui sejak L-48): tombol "Ubah status <no>: <status>".
      await page.locator('button[aria-label^="Ubah status"]', { hasNotText: /lunas|dibatalkan/i }).first().click();
    }],
    ['Servis-UpdateStatus-Selesai', () => page.getByRole('radio', { name: 'Selesai', exact: true }).click()],
    ['Servis-UpdateStatus-Batal', () => page.getByRole('radio', { name: 'Dibatalkan', exact: true }).click()],
    ['Servis-Baru', async () => {
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /Servis Baru/ }).first().click();
    }],
    // Modal dens-ui yang dibuka dari daftar (L-60): pemilih sparepart dan kirim WA.
    ['Servis-Sparepart', async () => {
      await page.keyboard.press('Escape');
      await page.locator('button[aria-label="Tambah sparepart"]').first().click();
    }],
    ['Servis-Notifikasi', async () => {
      await page.keyboard.press('Escape');
      await page.locator('button[aria-label="Notifikasi & nota"]').first().click();
    }],
    ['Servis-Detail', async () => {
      await page.keyboard.press('Escape');
      await page.locator('a[href^="/services/"]').first().click();
    }],
    // Kasir dengan keranjang terisi. Menu Kasir di atas hanya memindai keranjang
    // kosong, sehingga status pembayaran (1,5:1 di tema terang) lolos sampai
    // critique Kasir 27 Sep 2026.
    // Sejak 10 Nov 2026 katalog tampil di Semua Outlet; cabang baru ditanya
    // lewat dialog saat barang pertama ditambahkan, dan tombol jual adalah
    // area tambah di dalam kartu (kartunya sendiri <article>).
    ['Kasir-Keranjang', async () => {
      await page.getByRole('link', { name: /^Kasir/ }).first().click();
      await page.waitForTimeout(900);
      await page.locator('main article > button:not([disabled])').first().click();
      const opt = page.locator('[role="dialog"] button[aria-pressed]').first();
      if (await opt.isVisible({ timeout: 1500 }).catch(() => false)) {
        await opt.click();
        await page.waitForTimeout(600);
        if ((await page.locator('#pos-cart li').count()) === 0) {
          await page.locator('main article > button:not([disabled])').first().click();
        }
      }
    }],
    ['Kasir-Kurang', async () => {
      await page.locator('#pos-tender-keys button').first().click();
      await page.locator('#pos-cart input[inputmode="numeric"]').last().fill('1000');
    }],
    ['Kasir-Kembalian', () => page.locator('#pos-quick-cash button').last().click()],
    ['Kasir-Lunas', () => page.getByRole('button', { name: /^Proses/ }).click()],
    // Riwayat, jendela batal, dan form barang stok pindah ke dens-ui di L-61.
    ['Kasir-Riwayat', async () => {
      await page.locator('#pos-tab-history').click();
      await page.waitForTimeout(500);
    }],
    ['Kasir-Batal', async () => {
      await page.locator('#pos-panel button[aria-label^="Batalkan"]').first().click();
      await page.waitForTimeout(400);
    }],
    ['Stok-Ubah', async () => {
      await page.keyboard.press('Escape');
      await page.locator('#pos-tab-register').click();
      await page.waitForTimeout(500);
      await page.locator('main article button[aria-label^="Ubah"]').first().click();
      await page.waitForTimeout(400);
    }],
    ['Stok-Beli', async () => {
      await page.locator('[role="dialog"] input[type="number"]').first().fill('99');
      await page.locator('[role="dialog"] [role="radio"]').first().click();
      await page.waitForTimeout(300);
    }],
    // Pelanggan pindah ke dens-ui di L-51: menu di atas hanya memindai tampilan
    // kartu (bawaan), jadi daftar, ringkas, laci riwayat, dan form diperiksa sendiri.
    ['Pelanggan-Daftar', async () => {
      await page.keyboard.press('Escape');
      await page.getByRole('link', { name: /^Pelanggan/ }).first().click();
      await page.waitForTimeout(900);
      await page.locator('[data-slot="view-toggle"] button').nth(1).click();
      await page.waitForTimeout(300);
    }],
    ['Pelanggan-Ringkas', async () => {
      await page.locator('[data-slot="view-toggle"] button').nth(2).click();
      await page.waitForTimeout(300);
    }],
    ['Pelanggan-Riwayat', async () => {
      await page.locator('[data-slot="view-toggle"] button').nth(0).click();
      await page.locator('main [role="button"][title]').first().click();
      await page.waitForTimeout(600);
    }],
    ['Pelanggan-Ubah', async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.locator('main [role="button"][title] button[aria-label="Ubah"]').first().click();
      await page.waitForTimeout(400);
    }],
    // Keuangan pindah ke dens-ui di L-52: sel wallet terpilih (filter buku kas).
    ['Keuangan-Wallet', async () => {
      await page.keyboard.press('Escape');
      await page.getByRole('link', { name: /^Keuangan/ }).first().click();
      await page.waitForTimeout(900);
      await page.locator('main button[aria-pressed]').filter({ hasText: /Rp/ }).first().click();
      await page.waitForTimeout(300);
    }],
    // Modal Keuangan pindah ke dens-ui di L-63.
    ['Keuangan-Catat', async () => {
      await page.locator('main button:visible', { hasText: /^Pengeluaran$/ }).first().click();
      await page.waitForTimeout(400);
    }],
    ['Keuangan-Hitung', async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.locator('main button:visible', { hasText: /^Hitung/ }).first().click();
      await page.waitForTimeout(300);
      await page.locator('[role="dialog"] input[inputmode="numeric"]').first().fill('1.000');
      await page.waitForTimeout(200);
    }],
    ['Keuangan-Transfer', async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.locator('main button:visible', { hasText: /^Transfer$/ }).first().click();
      await page.waitForTimeout(400);
    }],
    ['Supplier-Vendor', async () => {
      await page.keyboard.press('Escape');
      await page.getByRole('link', { name: /^Supplier/ }).first().click();
      await page.waitForTimeout(900);
      await page.locator('main [role="group"] button[aria-pressed]').nth(1).click();
      await page.waitForTimeout(300);
    }],
    ['Supplier-PO', async () => {
      await page.locator('main [role="group"] button[aria-pressed]').nth(0).click();
      await page.getByRole('button', { name: /^PO Baru/ }).click();
      await page.waitForTimeout(400);
      await page.locator('[role="dialog"] [role="combobox"]').nth(1).click();
      await page.locator('[role="option"]').first().click();
      await page.waitForTimeout(300);
    }],
    ['Supplier-Terima', async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: /Terima$/ }).first().click();
      await page.waitForTimeout(400);
    }],
    // Laporan pindah ke dens-ui di L-64. Menu Laporan di atas hanya memeriksa tab
    // Ringkasan; lima tab lain (rincian, tabel, lencana umur) perlu langkah sendiri.
    ['Laporan-Uang', async () => {
      await page.keyboard.press('Escape');
      await page.getByRole('link', { name: /^Laporan/ }).first().click();
      await page.waitForTimeout(900);
      await page.locator('#lap-tab-uang').click();
      await page.waitForTimeout(300);
    }],
    ...['servis', 'stok', 'pelanggan', 'piutang'].map((tab) => [
      `Laporan-${tab[0].toUpperCase()}${tab.slice(1)}`,
      async () => {
        await page.locator(`#lap-tab-${tab}`).click();
        await page.waitForTimeout(300);
      },
    ]),
    // Absensi dan Tugas pindah ke dens-ui di L-54: jendela absen manual, tab
    // Template, dan jendela template baru (hari mingguan terpilih).
    ['Absensi-Absenkan', async () => {
      await page.keyboard.press('Escape');
      await page.getByRole('link', { name: /^Absensi/ }).first().click();
      await page.waitForTimeout(900);
      await page.locator('main button', { hasText: /^Absenkan/ }).first().click();
      await page.waitForTimeout(400);
    }],
    ['Tugas-Template', async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.getByRole('link', { name: /^Tugas/ }).first().click();
      await page.waitForTimeout(900);
      await page.locator('main button', { hasText: /^Template [(]/ }).first().click();
      await page.waitForTimeout(300);
    }],
    ['Tugas-TemplateBaru', async () => {
      await page.locator('main button', { hasText: /^Template Baru/ }).first().click();
      await page.waitForTimeout(400);
      await page.locator('[role="dialog"] [role="combobox"]').first().click();
      await page.locator('[role="option"]', { hasText: 'Mingguan' }).click();
      await page.waitForTimeout(200);
      await page.locator('[role="dialog"] button[aria-pressed]').first().click();
      await page.waitForTimeout(200);
    }],
    // L-65: Kamus Istilah tidak di menu (dibuka dari Laporan), dengan satu istilah
    // dituju; Kalkulator dengan chip tarif menyala.
    ['Glosarium', async () => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await page.getByRole('link', { name: /^Laporan/ }).first().click();
      await page.waitForTimeout(900);
      await page.locator('main a[href="/istilah"]').first().click();
      await page.waitForTimeout(600);
      await page.locator('main nav a').nth(2).click();
      await page.waitForTimeout(400);
    }],
    ['Kalkulator-Chip', async () => {
      await page.getByRole('link', { name: /^Kalkulator Biaya/ }).first().click();
      await page.waitForTimeout(900);
      await page.locator('main button[aria-pressed]').first().click();
      await page.waitForTimeout(300);
    }],
    // L-55: tab Operasional Pengaturan (chip templat, kolom tabel bercentang).
    ['Pengaturan-Operasional', async () => {
      await page.getByRole('link', { name: /^Pengaturan/ }).first().click();
      await page.waitForTimeout(900);
      await page.locator('main [role="group"] button', { hasText: 'Operasional' }).first().click();
      await page.waitForTimeout(400);
    }],
    // L-66: tab Tim, Wallet, Outlet (editor geofence terbuka), dan Navigasi Pengaturan.
    // Dengan BASE_URL ke dev server berenv Supabase palsu, kartu undangan dan kontrol
    // anggota (mode cloud) ikut diperiksa.
    ...['Tim', 'Wallet', 'Outlet', 'Navigasi'].map((tab) => [
      `Pengaturan-${tab}`,
      async () => {
        await page.getByRole('link', { name: /^Pengaturan/ }).first().click();
        await page.waitForTimeout(700);
        await page.locator('main [role="group"] button', { hasText: new RegExp(`^${tab}$`) }).first().click();
        await page.waitForTimeout(400);
        if (tab === 'Outlet') {
          await page.locator('main button', { hasText: /^Geofence$/ }).first().click();
          await page.waitForTimeout(300);
        }
      },
    ]),
    // L-67: Nota & Struk dengan teks diketik (catatan "belum tersimpan", hitam-putih
    // menyala, S&K tak sah) dan Tarif dengan draf berubah (bar simpan menempel) plus
    // galat tampil (nilai kosong).
    ['Pengaturan-Nota', async () => {
      await page.getByRole('link', { name: /^Pengaturan/ }).first().click();
      await page.waitForTimeout(700);
      await page.locator('main [role="group"] button', { hasText: /^Nota & Struk$/ }).first().click();
      await page.waitForTimeout(400);
      await page.locator('#receipt-header').fill('Buka setiap hari 09.00 sampai 20.00');
      await page.getByRole('switch', { name: /1-bit/i }).click();
      await page.locator('main input[inputmode="numeric"]').first().fill('');
      await page.locator('main button', { hasText: /Simpan/ }).last().click();
    }],
    ['Pengaturan-Tarif', async () => {
      await page.getByRole('link', { name: /^Pengaturan/ }).first().click();
      await page.waitForTimeout(700);
      await page.locator('main [role="group"] button', { hasText: /^Tarif$/ }).first().click();
      await page.waitForTimeout(400);
      await page.locator('main button', { hasText: /^Tambah template/ }).first().click();
      await page.locator('main button', { hasText: /^Simpan template$/ }).click();
      await page.waitForTimeout(300);
    }],
    // Kartu Tampilan (Pengaturan › Sistem) dan chip pembesaran Topbar di ketiga
    // rona LED: nominal 100%, aksen 110% + Padat, jingga 90%. Tab Sistem tidak
    // terbuka oleh menu Pengaturan di atas, jadi kartu ini perlu langkah sendiri.
    ['Tampilan-100', async () => {
      await page.keyboard.press('Escape');
      await page.getByRole('link', { name: /^Pengaturan/ }).first().click();
      await page.waitForTimeout(900);
      await page.getByRole('button', { name: /^Sistem/ }).first().click();
    }],
    ['Tampilan-110-Padat', async () => {
      await page.getByRole('radio', { name: '110%' }).click();
      await page.getByRole('radio', { name: /Padat/ }).click();
    }],
    ['Tampilan-90', () => page.getByRole('radio', { name: '90%' }).click()],
  ];
  for (const [label, act] of steps) {
    try {
      await act();
    } catch {
      console.log(`\ndemo-${label} / ${theme} — langkah gagal (elemen tak ditemukan)`);
      total++;
      continue;
    }
    await page.waitForTimeout(900);
    await report(page, `demo-${label} / ${theme}`);
  }
  await page.close();
}

await browser.close();
console.log(`\n${total === 0 ? 'BERSIH' : 'ADA TEMUAN'} — ${total} elemen di bawah ambang`);
if (gradTotal) console.log(`Di atas gradien (kasus terburuk, periksa manual): ${gradTotal}`);
