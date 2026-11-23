# AGENTS.md: Panduan untuk AI Agent (Nuara Dashboard)

> Aturan untuk agent AI yang bekerja di folder `dashboard/` repo `nuaraservice`.
> Berkas ini ikut git, jadi tetap berlaku walau akun atau mesin berganti.
> Aturan repo induk (`../CLAUDE.md`) juga berlaku; bila bertentangan, aturan induk menang.

---

## 1. Apa ini, dan dari mana asalnya

**Nuara Dashboard** = aplikasi web internal **Nuara Service**, satu workshop reparasi
laptop/PC, HP, dan elektronik rumah tangga di Cimahi. Dipakai Pemilik, Admin konter, dan
Teknisi. Pelanggan tidak punya akun; mereka hanya membuka link lacak per tiket.

> [!] BUKAN bengkel kendaraan. "Servis" = perbaikan perangkat elektronik.

Kode di folder ini adalah **salinan sekali-jalan dari FixMaster** (`k24reps/fixmaster`,
commit `0175e8d`, 21 Nov 2026). Tidak ada sinkronisasi otomatis dari FixMaster. Perbaikan
di sana boleh disalin manual bila cocok, tetapi folder ini berkembang sendiri.

Yang sengaja dibuang saat menyalin (bagian SaaS FixMaster): landing page, harga dan saldo
unit, panel operator vendor, demo publik dan gerbang lead, halaman legal, hapus akun
permanen, skrip deploy dan self-host milik infrastruktur FixMaster. Fitur toko tetap utuh.
Migrasi `0105_nuara_single_shop.sql` mematikan pemotongan saldo unit, membatasi database ke
**satu toko**, dan menutup RPC lead demo.

## 2. Sumber kebenaran

| Pertanyaan | Baca |
|---|---|
| Fitur apa yang diminta Pemilik, istilah, peran | `../docs/PRD.md` |
| Rencana kerja dan langkah berikutnya | `../docs/IPD.md` |
| Stack, struktur, env, perintah | `../docs/TRD.md` |
| Layar dan teks pesan target | `../docs/AFD.md` |
| Warna, font, komponen (token Nuara) | `../docs/DBD.md` |
| Cara kode ini bekerja (data layer, RLS, keputusan lama) | `docs/obsidian-vault/` |

Selama aplikasi masih berperilaku seperti FixMaster, selisihnya dengan PRD dicatat sebagai
daftar selisih di IPD dan diputuskan Pemilik satu per satu. Jangan menyesuaikan perilaku ke
PRD diam-diam di luar langkah IPD yang aktif.

## 3. Aturan baca vault (hemat token tapi akurat)

Vault `docs/obsidian-vault/` adalah warisan FixMaster: isinya tentang **kode ini**, jadi
tetap relevan, tetapi bagian merek, harga, dan infrastruktur FixMaster tidak berlaku.

- Tugas non-trivial: baca `00 - FixMaster MOC.md` dan `Conventions.md`, lalu ikuti
  `[[wikilink]]` yang relevan saja (mis. Data Layer).
- Tugas trivial (typo, satu baris, jalankan perintah): lewati vault.
- Jangan memuat seluruh vault sekaligus.

## 4. Konvensi

- **Warna**: jangan hardcode hex. Halaman lama: `var(--token)` dari `src/styles/tokens.css`
  (palet FixMaster). Komponen dens-ui dan halaman yang dipindah: kelas Tailwind bertema
  (`bg-card`, `text-muted-foreground`, `bg-highlight`, ...) yang dipetakan ke `--nu-*` di
  `src/styles/nuara-theme.css` (warna DBD). Jangan baca `--nu-*` langsung kecuali di CSS tema.
- **UI baru dan halaman yang dipindah (Fase B)**: komponen dens-ui di `src/components/dens/`
  (dens-ui v0.2.0, MIT, model shadcn, lihat README di folder itu) di atas Tailwind v4.
  `cn()` dari `@/lib/utils`. Satu halaman dipindah utuh, lalu CSS Module lamanya dihapus.
  Halaman yang belum dipindah tetap memakai CSS Modules.
- **Tiga syarat halaman yang dipindah** (tanpa ini kelas Tailwind tidak terbentuk atau gaya
  lama merembes): (1) elemen akarnya diberi atribut `data-nu`; (2) foldernya ditambah ke daftar
  `@source` di `src/styles/app.css`, atau berkasnya saja bila folder itu masih memuat halaman
  FixMaster (seperti `features/services` selama L-48 s.d. L-60, `features/pos` selama L-50 s.d. L-61); (3) foto per piksel halaman lain + probe
  `audit-*` sama dengan sebelum langkah.
- **Pengganti komponen FixMaster** sudah ada di `src/components/dens/` dengan API yang sama
  (`SummaryStrip`, `FilterChips`, `TextInput`, `SelectBox`, `FormDialog`, `ConfirmDialog`,
  `EmptyState`, `Field`/`FormMessage`; daftar di README folder itu). Pakai itu sebelum membuat
  yang baru. Fokus awal jendela lewat `data-autofocus`, bukan `autoFocus` (lihat form-dialog.tsx).
  Komponen dens yang juga dipakai di dalam halaman/modal FixMaster: akarnya `data-nu bg-transparent`
  (tanpa `data-nu` reset dens tidak berlaku; `[data-nu]` sendiri memberi latar halaman).
  Sebaliknya, bila halaman yang dipindah masih merender komponen FixMaster inline (bukan lewat
  portal), pasang `data-nu` per bagian, bukan di akar: reset `[data-nu] *` mengubah komponen lama
  (Kasir L-50: tombol `PosHistory` mengecil).
- **Arsitektur CSS Fase B** (`src/styles/app.css`): layer `theme` < `legacy` (global.css) <
  `nu-base` (reset dens-ui) < `utilities`; CSS Module tidak berlayer dan selalu menang.
  Preflight Tailwind sengaja TIDAK global (`dens-base.css`, terbatas ke `[data-slot]`/`[data-nu]`):
  versi global terukur mengubah halaman lama. Aturan `!important` di global.css yang mengenai
  elemen dens-ui harus mengecualikan lingkup itu (`:not(:where([data-slot], [data-nu], ...))`),
  seperti aturan target sentuh 44px: `!important` tidak bisa dikalahkan utilitas. Nama variabel
  tema Tailwind yang juga dipakai tokens.css (`--text-sm`, `--radius-lg`, ...) ditulis langsung di
  `@theme inline`; tambahkan di sana bila menemukan bentrokan baru.
- **Breakpoint kerangka**: varian kustom `drawer:` (<=1024px), `narrow:` (<=768px), `phone:`
  (<=720px), `compact:` (<=640px), kuerinya sama persis dengan media query CSS lama. Jangan
  memakai `max-lg:` dan sejenisnya untuk breakpoint yang harus sejalan dengan halaman lama
  (Tailwind memakai `width < x`, bukan `max-width: x`).
- **Target sentuh**: kontrol dens-ui baru wajib `pointer-coarse:` ke 44px (tombol/isian/item menu:
  `pointer-coarse:min-h-11`; kontrol kecil: area `::after` 44px). Di perangkat bermouse 40px boleh.
- **Toast**: selalu lewat `toast.success/error/warning/info` dari `@/stores/toast` (sonner di
  baliknya), jangan impor sonner langsung.
- **Portal dan `#root`**: `#root` memakai `isolation: isolate`, jadi lapisan yang harus tampil di
  atas dialog atau laci (toast) dirender lewat portal ke `body`.
- Motif visual FixMaster ("Precision Electronics Bench", maskot VOLT, rail diagnostik) **tidak**
  dipakai untuk UI baru dan hilang dengan sendirinya saat halaman dipindah.
- **Teks UI baru**: lewat `useT()` + translation key, Bahasa Indonesia, kalimat netral tanpa
  sapaan (tanpa "kamu", "Anda", "-mu"). Halaman lacak pelanggan boleh menyapa "kamu". Teks
  FixMaster lama yang masih menyapa "Anda" termasuk daftar selisih, bukan untuk diubah sambil lalu.
- **Data**: baca via `useCollection('<koleksi>')`, mutasi via `repository` (`src/data/`).
- **Logika domain**: murni dan testable di `src/lib/business/`, dipanggil dari UI.
- **Ikon**: halaman lama lewat komponen `Icon` (`src/components/ui/Icon.tsx`, Phosphor).
  Komponen dens-ui dan halaman yang dipindah memakai `lucide-react`.
- **Hanya tema terang** (DBD P9.5, P14.1). Varian `dark:` di komponen dens-ui tidak pernah aktif.
- **Font**: Figtree untuk teks, JetBrains Mono (`font-mono tabular-nums`) untuk nomor tiket,
  Rupiah, dan ID.
- **Import alias**: `@/` ke `src/`.
- **Breakpoint yang menjaga dari overflow wajib `@container`, bukan `@media`** (zoom aplikasi
  dan sidebar mengubah ruang konten tanpa menggeser media query). Detail di vault,
  `Decisions & Bug Fixes.md`.
- **Uang integer rupiah; data uang dan stok tidak diedit atau dihapus, hanya dibatalkan.**
- **Data pribadi pelanggan** (nomor WA, password/pola unit) tidak boleh masuk log atau URL.

## 5. Verifikasi (default setelah perubahan)

Semua perintah dari folder `dashboard/`.

```bash
npm run build   # type-check + build
npm run test    # vitest unit, offline (jumlah terkini di vault Testing & Security.md)
npm run lint    # eslint
npm run test:integration  # RLS/RPC ke staging (butuh .env.test.local)
```

> [!warning] Tes integrasi membuat dan menghapus pengguna sungguhan
> `.env.test.local` harus menunjuk proyek Supabase **staging milik Nuara**. Jangan pernah
> memakai kredensial staging atau produksi FixMaster yang tercatat di vault.

> [!warning] `tests/` tidak ikut type-check
> `tsc -b` hanya mencakup `src`. Periksa berkas tes baru dengan tsconfig sementara:
> `extends` app, `include: ["tests","src"]`, `types: ["node","vite/client"]`.

Untuk perubahan UI: foto render asli via Playwright, jangan menebak. Di **dev server** ada tiga
harness (tidak ada di build produksi): `/demo` = aplikasi berisi data contoh
(`src/dev/DevSandbox.tsx`, dipakai skrip `scripts/shoot-*.mjs` dan probe di bawah),
`/dev/komponen` = katalog komponen dens-ui (`src/dev/ComponentShowcase.tsx`), dan
`/dev/layar?layar=masuk|daftar|lupa|pin|reset|reset-form|wizard` = layar sebelum aplikasi
(`src/dev/AuthPreview.tsx`), yang di mode lokal tidak pernah tampil.
Di emulasi ponsel, ukur DOM **sebelum** `screenshot({ fullPage: true })`: sesudahnya media
`pointer: coarse` hilang sampai navigasi berikutnya dan target sentuh terbaca 40px.
Di container cloud, versi browser bawaan `@playwright/test` tidak terpasang: jalankan skrip
audit dengan `PW_CHROMIUM=/opt/pw-browsers/chromium`. Folder `scripts/shots/` di-gitignore;
buat dulu bila belum ada.

```bash
BASE_URL=http://localhost:5173 node scripts/audit-mobile.mjs   # 5 lebar ponsel x 13 halaman
BASE_URL=http://localhost:5173 node scripts/audit-zoom.mjs     # 11 lebar desktop x 13 halaman
node scripts/audit-tokens.mjs                                  # gerbang token FixMaster
BASE_URL=http://localhost:5173 node scripts/audit-contrast.mjs  # kontras DOM: /demo, wizard, /dev/komponen, /dev/layar
```

Kontras tema Nuara diuji `src/styles/nuaraTheme.test.ts` (ikut `npm run test`): tambahkan
pasangan baru di sana saat komponen memakai kombinasi warna baru.

Langkah Fase B juga wajib membuktikan halaman lain tidak berubah dengan **foto per piksel**:
foto halaman lama sebelum dan sesudah (sama viewport, tema, dan `reducedMotion`), bandingkan
dengan `compare -metric AE -fuzz 2%` (ImageMagick), dan ukur derau dengan dua foto sebelum.
Selisih yang tersisa harus bisa dijelaskan (jam, kursor berkedip). Bila "sebelum" diambil dari
`git worktree` dengan `node_modules` di-symlink, beri vite.config worktree `cacheDir` sendiri dan
`server.fs.allow` ke `node_modules` asli; tanpa itu React jadi ganda dan font gagal dimuat
(vault, Decisions L-58).

Laporan ditulis ke `scripts/shots/{zoom,mobile}-report.json`. Saring empat positif palsu
sebelum menyimpulkan: `caption._srOnly`, `span.fm-visually-hidden`, `.sr-only` (teks khusus
pembaca layar di halaman dens-ui), dan elemen `text.` di dalam SVG. **Ukur DOM rect, jangan
membaca screenshot terkompresi.**

## 6. Pemeliharaan dokumen (bagian dari "selesai")

Perubahan signifikan (fitur, entity/`types.ts`, alur, keputusan desain, bug fix penting)
dianggap selesai bila kode **dan** dokumennya ada di commit yang sama:

1. Langkah IPD dicentang di `../docs/IPD.md` hanya setelah lolos verifikasi.
2. Perubahan spesifikasi ditulis ke dokumen `../docs/` yang relevan.
3. Perubahan cara kerja kode ditulis ke catatan vault yang relevan (Data Layer, Decisions).
4. Jumlah tes hanya dicatat di vault `Testing & Security.md`, bertanggal.

Pengecualian trivial: typo, satu baris, jalankan perintah, pertanyaan cepat.

## 7. Efisiensi biaya dan pilihan model

Agent tidak bisa mengganti model sendiri; sarankan di awal tugas.
- Tugas mekanis (memindah halaman ke dens-ui mengikuti pola yang sudah ada, build/test/lint,
  update dokumen rutin): sarankan model murah.
- Tugas berat (keputusan arsitektur, debugging rumit, selisih PRD yang ambigu): sarankan model kuat.
- Hindari loop "lanjutkan" beruntun; untuk tugas panjang sarankan `/goal`.

## 8. Skill proyek (`.claude/skills/`)

| Skill | Wewenang |
|---|---|
| `impeccable` (v0.1.5) | Semua yang visual dan UX, termasuk teks di dalam UI |
| `antislop-code` | Kebersihan komentar kode |
| `antislop-copywriting` | Prosa di luar UI: dokumen, commit, laporan |

Biner mesin impeccable (`.claude/skills/impeccable/scripts/bin/`) di-gitignore dan diunduh
ulang oleh peluncurnya saat pertama dipakai.
