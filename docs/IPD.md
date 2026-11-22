# IPD (Implementation Plan Document) - Nuara Dashboard

> Versi: 0.8 | Diperbarui: 2026-11-22 | Merujuk: PRD, TRD, AFD, DBD, `dashboard/AGENTS.md`
<!-- Versi 0.2 (42 langkah Next.js dari nol) dibatalkan 2026-11-21 (wawancara P13). Langkahnya disimpan di bagian Arsip dengan tanda [DIBATALKAN]; rujukan kriteria F-xx di sana tetap berguna untuk daftar selisih. -->

## Cara memakai
- Kerjakan **satu langkah per sesi**, dari atas ke bawah.
- Status: `[ ]` belum, `[~]` sedang dikerjakan atau terputus, `[x]` selesai (kriteria "Selesai jika" terbukti lolos).
- ID `L-xx` tidak pernah dinomori ulang. Langkah baru memakai nomor berikutnya (mulai L-43) dan disisipkan di posisi yang tepat.
- Langkah yang tidak jadi dikerjakan: tulis `[DIBATALKAN]` di depan namanya, jangan dihapus.
- Jangan mengerjakan fitur di luar langkah yang aktif. Selisih PRD hanya dikerjakan lewat langkah Fase C setelah diputuskan Pemilik.
- Semua perintah dijalankan dari folder `dashboard/` (TRD bagian 7). Langkah UI memakai skill impeccable untuk eksekusi visual.
- Fakta bisnis (nama staf, akun kas, saldo, durasi garansi, S&K, link ulasan, lokasi) ditanyakan ke Pemilik, tidak dikarang.
- Hal yang belum diputuskan Pemilik dicatat di bagian "Keputusan Menunggu Pemilik" (G-xx dan K-xx), termasuk rekomendasi yang dipakai sementara agar pekerjaan bisa lanjut. Butir yang sudah dijawab dipindah ke log wawancara dan ditandai "diputuskan" di sini.

## Ringkasan Fase
| Fase | Tujuan | Langkah |
|---|---|---|
| A | Salinan FixMaster jalan sebagai Nuara Dashboard | L-43, L-44, L-45 |
| B | UI dipindah ke dens-ui dengan warna Nuara, per halaman | L-46, L-47, L-58, L-48, L-49, L-59, L-60, L-50 s.d. L-56 |
| C | Selisih PRD yang diputuskan Pemilik | ditentukan dari L-45 |
| D | Rilis dan berhenti memakai FixMaster | L-57 |

Target: belum ada tenggat (P0.3). Estimasi jam ditulis saat langkah dimulai, karena ukurannya bergantung pada halaman FixMaster yang dipindah.

## Fase A - Salinan FixMaster

- [x] **L-43 Salin FixMaster ke `dashboard/`, buang bagian SaaS**
  - Rujukan: wawancara P13, TRD 1-3
  - Kerjakan: salin berkas ter-track FixMaster commit `0175e8d`; buang landing, harga dan saldo unit, operator, demo publik dan gerbang lead, halaman legal, hapus akun permanen, Edge Function `lead-notify`/`delete-account`, skrip deploy dan self-host FixMaster; migrasi `0105_nuara_single_shop.sql`; merek, ikon (dari `assets/logo.jpg`), manifest, `index.html` noindex; `/demo` jadi harness khusus dev; tes integrasi membuat toko lewat service_role; CI `dashboard-ci.yml`; `.vercelignore` root mengecualikan `dashboard`.
  - Selesai jika: build, lint, dan tes unit lolos; `/` dan `/demo` tampil tanpa error JS dan tanpa luberan horizontal; landing page di root tidak berubah.
  - Hasil 2026-11-21: build + lint hijau, 1090 tes / 82 berkas lolos, foto wizard, dashboard, servis, dan ponsel 390px bersih.

- [ ] **L-44 Supabase, Vercel, domain, akun Pemilik**
  - Rujukan: TRD 5-6
  - Kerjakan: dipandu AI, Pemilik membuat proyek Supabase tes milik Nuara (region Singapura); `supabase link` + `supabase db push` (0001 s.d. 0105); secret Vault `project_url` dan `backup_cron_secret`; deploy Edge Function `auto-backup`, `backup-email`, `health` dan secret-nya; Auth: pendaftaran tetap aktif (undangan staf), panjang minimum password 8; proyek Vercel kedua (Hobby, Root Directory `dashboard/`), env `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`; DNS `app.nuaraservice.my.id`. Pemilik mendaftar, menyelesaikan wizard (nama toko "Nuara Service", inisial `NS`), mengundang satu akun uji.
  - Selesai jika: login di URL Vercel berhasil; toko kedua ditolak (`single_shop`); satu tiket uji dibuat, link `/t/<kode>` terbuka tanpa login; `npm run test:integration` lolos ke proyek tes Nuara (sesuaikan tes yang memang menguji perilaku SaaS yang sudah dibuang, catat di Catatan).

- [ ] **L-45 Lengkapi daftar selisih PRD vs FixMaster**
  - Rujukan: PRD 4-5 (F-01 s.d. F-17 + kriteria), AFD, Arsip langkah lama, bagian "Daftar Selisih" di bawah
  - Kerjakan: bandingkan setiap kriteria F-xx.n dengan perilaku aplikasi sekarang (kode + uji di `/demo`); lengkapi tabel Daftar Selisih (G-xx) tanpa mengubah kode. Keputusan per butir (ikuti PRD / pertahankan FixMaster / sembunyikan / tunda) diambil Pemilik setelah Fase B, sesuai P13.6.
  - Selesai jika: setiap F-xx punya status "sama", "selisih G-xx", atau "tidak ada"; tabel diperiksa Pemilik.

## Fase B - UI ke dens-ui

Aturan bersama: satu langkah = satu kelompok halaman dipindah utuh, CSS Module lamanya dihapus, akar halamannya diberi atribut `data-nu` dan foldernya ditambah ke `@source` di `src/styles/app.css`, probe `audit-mobile` dan `audit-zoom` bersih sebelum dan sesudah, foto Playwright tema terang (dan gelap untuk halaman lama sampai L-47). Teks yang tampil tidak diubah di Fase B kecuali yang memang ikut komponen baru; perbaikan teks masuk daftar selisih.

- [x] **L-46 Fondasi dens-ui + token Nuara**
  - Rujukan: DBD 2-3, `https://github.com/dendense/dens-ui` (README, DESIGN.md), wawancara P14
  - Keputusan pra-langkah (P14): hanya tema terang, tema gelap dimatikan di L-47 (P14.1); Figtree + JetBrains Mono (P14.2); CSS lama ke cascade layer di bawah utilitas (P14.3); sonner, vaul, cmdk dipasang sekarang (P14.4).
  - Kerjakan: Tailwind v4 (`@tailwindcss/vite`) + dependensi dens-ui; tema `src/styles/nuara-theme.css` (token DBD sebagai `--nu-*`, bentuk dan bayangan dens-ui); komponen dens-ui di `src/components/dens/` (folder terpisah dari `components/ui/` karena `Button.tsx` vs `button.tsx` bentrok di Windows/macOS); popover, sheet, drawer (vaul), command (cmdk), combobox, sonner; katalog dev `/dev/komponen`; gerbang kontras `nuaraTheme.test.ts`.
  - Selesai jika: satu halaman uji di dev memakai komponen dens-ui; `audit-tokens` dan `audit-contrast` lolos; probe `audit-*` di halaman lama sama dengan sebelum langkah.
  - Hasil 2026-11-21: `/dev/komponen` tampil di 1280px dan 390px tanpa error JS dan tanpa luberan; `audit-tokens` lolos; `audit-contrast` 0 gagal (katalog 94 elemen); laporan `audit-mobile` dan `audit-zoom` identik dengan baseline; foto per piksel 8 halaman lama x 2 tema sama dengan baseline (sisa selisih hanya jam dan kursor berkedip); 1125 tes / 83 berkas, lint, build lolos.
- [x] **L-47 Kerangka aplikasi**
  - Rujukan: DBD 2-5, wawancara P15
  - Keputusan pra-langkah (P15): L-47 dipecah, layar masuk/PIN/wizard pindah ke L-58 (P15.1); toast memakai sonner lewat helper `toast.*` yang sama (P15.2); target sentuh 44px hanya di pointer kasar (P15.3); lonceng palsu disembunyikan, menjadi selisih G-11 (P15.4).
  - Kerjakan: Sidebar (rail lipat, laci tablet, lencana jumlah, pemilih cabang `DropdownMenu`), Topbar (menu akun `DropdownMenu`, status sinkron, chip zoom; tombol tema dan lonceng dicopot), navigasi bawah + menu Lainnya (laci vaul), splash, stepper zoom; tema gelap dimatikan untuk seluruh aplikasi (store tema dihapus, `data-theme="light"`); toast sonner (`AppToaster`, portal ke body); target sentuh 44px di komponen dens-ui (`pointer-coarse:`); varian breakpoint `drawer`/`narrow`/`phone`/`compact` di app.css dengan kueri sama persis CSS lama; ikon menu lucide (`navIcons.ts`). Ukuran kerangka (`--sidebar-width`, `--topbar-height`, `--mobile-nav-height`) dan breakpoint lama dipertahankan.
  - Selesai jika: kerangka tampil di desktop, tablet, ponsel tanpa error JS dan tanpa luberan; laci `inert` saat tertutup; Esc di menu cabang tidak menutup laci; target sentuh >= 44px di layar sentuh; probe `audit-*` dan `audit-contrast` bersih; tes, lint, build lolos.
  - Hasil 2026-11-21: lihat Catatan L-47.
- [x] **L-58 Layar masuk, daftar, reset password, PIN karyawan, wizard toko**
  - Dipecah dari L-47 (P15.1). Termasuk membuang maskot VOLT, rail diagnostik, dan teks "Precision Electronics Bench" dari halaman masuk; menyesuaikan teks yang ikut komponen baru.
  - Rujukan: DBD 3, 5; wawancara P16
  - Keputusan pra-langkah (P16): satu kartu di tengah dengan logo dan "Nuara Service", tanpa teks promosi baru (P16.1); kalimat persetujuan yang menautkan /terms dan /privacy dibuang (P16.2).
  - Kerjakan: `AuthPage` (masuk, daftar, lupa password), `ResetPasswordPage`, `PinLogin`, `Wizard` ditulis ulang dengan dens-ui di bingkai `AuthShell`; komponen `Field`/`FormMessage`, `PasswordInput`, `PasswordStrength` di `components/dens/`; CSS Module ketiganya dan `components/ui/PasswordStrength` dihapus; pratinjau dev `/dev/layar`. Logika auth, PIN, dan wizard tidak berubah.
  - Selesai jika: semua layar tampil di desktop dan ponsel tanpa error JS dan tanpa luberan; kontrol >= 44px di layar sentuh; `audit-contrast` bersih termasuk layar masuk; halaman lain sama per piksel; probe `audit-*` sama dengan L-47; tes, lint, build lolos.
  - Hasil 2026-11-21: lihat Catatan L-58.
- [x] **L-48 Servis: daftar tiket + form Servis Baru/Ubah**
  - Rujukan: DBD 3-5, AFD S-04/S-05, wawancara P17
  - Keputusan pra-langkah (P17): form Servis Baru/Ubah tiket ikut L-48, modal lain tetap L-49 (P17.1); Lunas hijau seperti Selesai (P17.2); daftar tiket jadi kartu di <=1024px sesuai DBD 4 (P17.3).
  - Kerjakan: `ServicesPage` dan `ServiceModal` ditulis ulang dengan dens-ui, CSS Module keduanya dihapus; mekanisme daftar baris (container query, ambang tabel dari lantai lajur, lajur aksi 44px di layar sentuh) dipertahankan sebagai kelas Tailwind; komponen pengganti FixMaster di `components/dens/` (`SummaryStrip`, `FilterChips`, `TextInput`, `SelectBox`, `FormDialog`, `ConfirmDialog`, `EmptyState`); `@source` per berkas karena folder Servis masih memuat halaman FixMaster; `servicesTableWidth.test.ts` ditulis ulang. Logika daftar dan form tidak berubah.
  - Selesai jika: daftar dan form tampil di desktop, tablet, ponsel tanpa error JS dan tanpa luberan; judul kolom tampil hanya bila semua lajur muat; kontrol >= 44px di layar sentuh; fokus kembali ke pemicu saat form ditutup; probe `audit-*` (bawaan, pita tablet, zoom 1,25, Padat) tanpa temuan baru selain yang dijelaskan; `audit-contrast` bersih; halaman lain sama per piksel; tes, lint, build lolos.
  - Hasil 2026-11-21: lihat Catatan L-48.
- [x] **L-49 Servis: detail tiket**
  - Dipecah 2026-11-22 (K-08): modal Servis pindah ke L-59 dan L-60. Cakupan: `ServiceDetailPage` (kepala tiket, tahap, pelanggan + QR lacak, penerimaan unit, sparepart + modal dadakan, biaya, log, bar aksi + panel "Lainnya", konfirmasi ambil/hapus) dan `ScreenLockReadout`. Tata letak FixMaster dipertahankan (K-09); label "REPAIR TICKET" dan cap status diganti lencana status (K-10).
  - Selesai jika: detail tampil di desktop, tablet, ponsel tanpa error JS dan tanpa luberan; kontrol >= 44px di layar sentuh; bar aksi selebar isi halaman (juga saat sidebar dilipat); probe `audit-*` dan `audit-contrast` bersih; halaman lain sama per piksel; tes, lint, build lolos.
  - Hasil 2026-11-22: lihat Catatan L-49.
- [x] **L-59 Servis: modal Ubah Status dan Tiket Jadi** (`StatusModal`, `TicketDoneModal`; estimasi, biaya final, pembayaran, garansi, batal + refund)
  - Ikut dipindah: `PartWarrantyFields` + `WarrantyPresets` (K-11), karena dipakai di dalam modal Ubah Status. Logika simpan, pembayaran terbagi, DP, koreksi biaya, refund, dan serah unit tidak berubah.
  - Selesai jika: modal tampil di desktop dan ponsel tanpa luberan dalam semua keadaan (target status, Selesai, Dibatalkan, DP, serah unit), kontrol >= 44px di layar sentuh, `audit-contrast` bersih, halaman dan modal lain sama per piksel, tes, lint, build lolos.
  - Hasil 2026-11-22: lihat Catatan L-59.
- [x] **L-60 Servis: modal kirim WA/nota, pemilih sparepart, garansi sparepart, klaim garansi** (`NotifyModal`, `SparepartPickerModal`, `PartWarrantyModal`, `WarrantyClaimModal`; `PartWarrantyFields` sudah di L-59)
  - Sesudah langkah ini seluruh folder `features/services` memakai dens-ui: tak ada CSS Module tersisa, dan `@source` memindai folder utuh.
  - Hasil 2026-11-22: lihat Catatan L-60.; sesudahnya seluruh folder `features/services` masuk `@source`
- [ ] **L-50 Kasir & Stok**
- [ ] **L-51 Pelanggan dan Supplier**
- [ ] **L-52 Keuangan**
- [ ] **L-53 Dashboard dan Laporan**
- [ ] **L-54 Absensi, Tugas, Log Aktivitas, Glosarium, Kalkulator Biaya**
- [ ] **L-55 Pengaturan**
- [ ] **L-56 Halaman lacak pelanggan + bersih-bersih**: lacak pelanggan memakai dunia "Nota Servis Rangkap" (DBD bagian 1, S-07); hapus token, maskot VOLT, dan CSS Modules FixMaster yang tersisa.

## Fase C - Selisih PRD
Langkah dibuat dari keputusan Pemilik atas Daftar Selisih (L-45), mulai nomor berikutnya yang kosong.

## Fase D - Rilis

- [ ] **L-57 Rilis & peralihan dari FixMaster**
  - Kerjakan: proyek Supabase produksi (pengaturan sama dengan L-44), migrasi, Edge Function, env production Vercel; Pemilik mendaftar dan mengisi Pengaturan (akun kas + saldo awal, garansi, S&K, link ulasan, titik lokasi, printer); undang staf final; uji satu tiket nyata dari diterima sampai diambil; tentukan hari mulai; catat tanggal target berhenti FixMaster (<= 1 bulan, PRD 3).

## Daftar Selisih (PRD vs perilaku FixMaster)
Awal, dari pemeriksaan kode 2026-11-21; dilengkapi di L-45. Kolom Keputusan diisi Pemilik.

| ID | PRD | Sekarang (FixMaster) | Keputusan |
|---|---|---|---|
| G-01 | Nomor tiket NS-00001, lima digit, urut tanpa reset (F-01) | Inisial dari wizard + nomor minimal empat digit (`NS-0001`), dibuat server (migrasi 0061) | |
| G-02 | Login username tanpa email; akun dibuat Pemilik; tanpa pendaftaran mandiri (F-08) | Login email + password; staf diundang lewat email lalu mendaftar sendiri; ada login PIN karyawan | |
| G-03 | Tahap: Diterima, Diagnosa, Konfirmasi biaya, Tunggu part, Pengerjaan, Selesai, Diambil; Dibatalkan lalu Dikembalikan; lunas dihitung dari pembayaran (BSD 4) | Status: diterima, diagnosa, konfirmasi, tunggu, pengerjaan, selesai, lunas, batal; "diambil" adalah penanda terpisah (`pickedUp`) | |
| G-04 | Tiket Express: pelanggan menunggu, persetujuan lisan, langsung Pengerjaan (F-01, F-03) | "Express" berarti langsung lunas dan diambil dari Selesai; konsep PRD belum ada (perlu dicek) | |
| G-05 | Tracking di host `lacak.nuaraservice.my.id` dengan tampilan nota Nuara (F-04, DBD S-07) | `/t/<kode>` di host yang sama dengan dashboard, tampilan FixMaster | |
| G-06 | Pesan minta ulasan Google saat Diambil (F-05) | Tidak ditemukan di modul notifikasi (perlu dicek) | |
| G-07 | Teks dashboard netral tanpa sapaan; hanya tracking menyapa "kamu" (CLAUDE.md 12) | Banyak teks menyapa "Anda" | |
| G-08 | Fitur di luar PRD: tidak ada | Ada Supplier, Tugas, Kalkulator Biaya, Log Aktivitas, Glosarium, login PIN, penggajian (PRD 6: penggajian di luar scope) | |
| G-09 | Satu workshop (P3.3) | Pemilih cabang/outlet tampil di sidebar | |
| G-10 | Absensi: radius tetap 100 m, di luar radius ditolak, GPS ditolak tetap boleh dengan tanda (F-10) | Geofence per outlet, radius diatur Pemilik (perilaku GPS ditolak perlu dicek) | |
| G-11 | Lonceng notifikasi di header dan layar Notifikasi S-20 (AFD bagian 1; kejadian dari F-02, F-03, F-07) | Lonceng FixMaster tanpa fungsi dengan titik merah tetap; disembunyikan sejak L-47 (P15.4) | |
| G-12 | Navigasi (AFD 2, DBD 3-4): sidebar 240px di >=1024px; di bawahnya 4 tab bawah (Beranda, Tiket, Absen, Lainnya); menu per peran (Admin: Beranda, Tiket, Pelanggan, Stok, Jual, Kas, Absensi; Teknisi: Beranda, Tiket, Absensi) | Kerangka FixMaster dipertahankan di L-47: sidebar 278px di >1024px, laci (tanpa tab bawah) di 721-1024px, 5 tab bawah di <=720px (Beranda, Servis, Kasir, Pelanggan, Lainnya); akses menu per peran mengikuti FixMaster (perlu dicek di L-45) | |
| G-13 | Isi template ditulis Pemilik (F-16.1): teks pesan WA Diterima, Selesai, Diambil; daftar keluhan per jenis perangkat; kelengkapan; S&K; teks pemberitahuan privasi | Isi bawaan FixMaster yang belum dikonfirmasi Pemilik: 6 template WA (diterima, konfirmasi, tunggu, selesai, diambil, batal) yang menyapa "Anda"; satu daftar keluhan untuk semua perangkat; S&K bawaan dengan batas pengambilan 60 hari | |

## Keputusan Menunggu Pemilik
Dikumpulkan 2026-11-22 dari log wawancara, catatan IPD, dan langkah L-43 s.d. L-48. Butir di sini belum dijawab Pemilik; kolom "Sementara" adalah yang berlaku sampai ada jawaban. Saat dijawab, catat jawabannya di log wawancara, lalu tulis "diputuskan YYYY-MM-DD (Pxx)" di kolom Sementara.

**Selisih PRD (G-01 s.d. G-13, tabel di atas).** Belum ada yang diputuskan. Sesuai P13.6 diputuskan setelah Fase B, sesudah L-45 melengkapi daftarnya. Sampai itu aplikasi berperilaku seperti FixMaster.

**Keputusan lain (K-xx).**

| ID | Hal | Asal | Sementara | Rekomendasi | Dibutuhkan sebelum |
|---|---|---|---|---|---|
| K-01 | Teks kerangka 10-11px (label "Dashboard" sidebar, chip zoom, angka lencana menu, label menu bawah) membuat gerbang lantai 12px `audit-zoom` gagal di semua halaman | Regresi L-47, ditemukan di L-48 | Dibiarkan | Langkah kecil tersendiri: naikkan ke 12px, ukur menu bawah di layar 320px | L-56 (paling lambat) |
| K-02 | Koneksi langsung Supabase hanya IPv6, bisa gagal dari jaringan tanpa IPv6 (audit S1, "skip dulu") | Wawancara 2026-11-04 (A4); langkah tujuannya (L-03, L-32) ikut batal di P13 | Belum dicek | Cek saat L-44 dari mesin Pemilik; pakai session pooler bila gagal. Backup FixMaster berjalan lewat Edge Function `auto-backup`, bukan GitHub Actions, jadi risikonya lebih kecil dari rencana lama | L-44 |
| K-03 | RawBT versi gratis dilaporkan menambah catatan di hasil cetak (audit S9, "skip dulu") | Wawancara 2026-11-04 (A12); langkah tujuannya (L-17) batal di P13 | Belum diuji | Uji dengan printer asli; bila ada catatan, putuskan bayar RawBT atau terima | L-57 |
| K-04 | Template email Supabase Auth (undangan staf, reset password) | L-43: template FixMaster dibuang | Template bawaan Supabase (bahasa Inggris) | Tulis teks Indonesia di AFD lalu pasang di dashboard Supabase | L-44 |
| K-05 | Nilai bisnis yang belum diberikan (PRD 9): nama akun staf, akun kas + saldo awal, garansi awal jasa dan sparepart, S&K, teks pemberitahuan privasi, link ulasan Google, titik lokasi workshop, toleransi terlambat, ukuran printer | PRD 9, sejak 2026-11-02 | Kosong; tidak dikarang | Diisi Pemilik di Pengaturan | L-57 |
| K-06 | Hari mulai memakai Nuara Dashboard dan tanggal berhenti FixMaster (PRD 3: paling lama 1 bulan) | PRD 3 | Belum ditentukan | Tentukan setelah uji satu tiket nyata | L-57 |
| K-07 | Kunci penyimpanan browser `fixmaster-*` dan penanda backup `app: 'fixmaster'` tidak diganti nama | Keputusan agen di L-43 (tidak tampil ke pengguna; dipakai tes dan skrip) | Tetap `fixmaster-*` | Biarkan; mengganti hanya menghapus pengaturan tampilan yang tersimpan di tiap perangkat sekali | Tidak mendesak |
| K-08 | Pemecahan L-49 (detail tiket + 7 modal, sekitar 3.600 baris kode + 1.960 baris CSS, tiga kali L-48) | Rencana L-49, 2026-11-22 | Dipecah: L-49 detail tiket, L-59 Ubah Status + Tiket Jadi, L-60 modal lain | Dipecah; IPD sudah mengizinkan pemecahan dengan nomor baru (Risiko Jadwal) | Sudah berlaku |
| K-09 | Tata letak detail tiket: DBD 4 menulis dua kolom (info + aksi di kiri, riwayat di kanan) | L-49 | Susunan FixMaster: kepala tiket, tahap, kisi kartu (pelanggan, penerimaan, sparepart, biaya, log), bar aksi menempel di bawah | Pertahankan FixMaster sampai Fase C; isinya sama, hanya urutan | Fase C |
| K-10 | Label "REPAIR TICKET" (bahasa Inggris) dan cap status miring di kepala tiket (motif FixMaster) | L-49 | Dibuang; status tampil sebagai lencana tahap seperti di daftar | Buang | Sudah berlaku |
| K-11 | `PartWarrantyFields` (isian garansi per part) dipindah di L-59, bukan L-60 | L-59: dipakai di dalam modal Ubah Status; versi FixMaster akan kena reset gaya dens di dalam dialog dens | Dipindah di L-59; modal Garansi part (FixMaster, L-60) sudah memakai isian baru | Dipindah | Sudah berlaku |

**Menunggu tindakan Pemilik (bukan keputusan).** L-44: membuat proyek Supabase tes milik Nuara (region Singapura), proyek Vercel kedua, dan DNS `app.nuaraservice.my.id`; mendaftar sebagai Pemilik dan mengundang satu akun uji. Tes integrasi belum pernah dijalankan sampai proyek itu ada.

## Definition of Done (berlaku untuk tiap langkah)
- Sesuai spesifikasi di dokumen yang dirujuk
- Tes relevan ditulis dan lolos; lint & build lolos; tidak ada tes yang dilemahkan, dilewati, atau dihapus agar lolos (tes milik fitur yang sengaja dibuang ikut dihapus bersama fiturnya, dicatat)
- Langkah UI: foto Playwright + probe `audit-*` bersih
- Tidak ada secret di kode; tidak ada log debug tertinggal; tidak ada data pribadi di log atau URL
- Landing page di root tidak berubah
- Teks UI baru tanpa em dash dan tanpa fakta bisnis karangan; teks dashboard baru netral tanpa sapaan
- Dokumen (`docs/` dan vault `dashboard/docs/obsidian-vault/`) diperbarui di commit yang sama bila ada keputusan atau perubahan cara kerja

## Risiko Jadwal & Eksekusi
| Risiko | Dampak | Mitigasi |
|---|---|---|
| L-44 butuh akun Supabase, Vercel, dan DNS milik Pemilik | Fase A tertunda | Dipandu langkah demi langkah; Fase B bisa jalan di dev server dengan `/demo` |
| Tailwind mengubah halaman CSS Modules lama | Halaman lama rusak selama Fase B | L-46: preflight dibatasi ke komponen dens-ui, CSS lama di layer bawah utilitas, utilitas hanya dari folder `@source`; dibuktikan foto per piksel + probe `audit-*`. Ulangi pengukuran yang sama di tiap langkah |
| Halaman Servis FixMaster besar (detail + 8 modal) | L-48/L-49 molor | Dipecah dua langkah; boleh dipecah lagi dengan nomor baru |
| Selisih PRD lebih banyak dari dugaan | Rilis mundur | Pemilik memilih per butir: ikuti PRD, pertahankan, sembunyikan, atau tunda setelah rilis |
| Migrasi dijalankan ke proyek Supabase yang salah | Data FixMaster atau Nuara rusak | Skrip deploy FixMaster tidak disalin; cek ref proyek sebelum `db push` |

## Catatan & Utang Teknis
<!-- Satu baris per catatan, terbaru di bawah: YYYY-MM-DD - L-xx - catatan/keputusan -->
- 2026-11-02 - (perencanaan) - Dokumen dibuat dari wawancara vibe-docs (188 pertanyaan). Rencana Pemilik setelah rilis: pindah ke Supabase self-host (Docker) di VPS; di luar scope versi ini.
- 2026-11-04 - (audit) - Keputusan Pemilik: Better Auth diganti Supabase Auth (T1); tetap Vercel Hobby (T2); tiket Dibatalkan dilanjutkan ke Dikembalikan (T3); S2-S8, S10, S11 diperbaiki; R1-R23 dikerjakan. Langkah baru: L-37 (F-01.9) serta L-38, L-39, L-40, L-41, L-42 (hasil memecah L-12, L-18, L-10, L-11, L-31 yang terlalu padat).
- 2026-11-04 - (audit S1) - Ditunda atas permintaan Pemilik: koneksi langsung Supabase hanya IPv6, sehingga tidak bisa dipakai dari GitHub Actions dan bisa gagal dari jaringan tanpa IPv6. Dicek saat L-03 dan L-32; session pooler sebagai cadangan.
- 2026-11-04 - (audit S9) - Ditunda atas permintaan Pemilik: klaim "semua gratis" untuk RawBT belum diverifikasi (versi gratis dilaporkan menambah catatan di hasil cetak). Diuji dengan printer asli di L-17.
- 2026-11-04 - (audit T2) - Vercel Hobby dipertahankan oleh Pemilik walau ketentuan Vercel membatasi Hobby untuk pemakaian non-komersial (https://vercel.com/docs/limits/fair-use-guidelines). Risiko: akun atau proyek bisa dijeda atau ditutup; pantau email dari Vercel; rencana pindah VPS.
- 2026-11-04 - (audit S6) - Proyek Supabase produksi baru dibuat di L-36; sebelum itu app.nuaraservice.my.id memakai proyek tes (staging) supaya proyek produksi tidak menganggur dan dijeda.
- 2026-11-21 - (wawancara P13) - Rencana Next.js dari nol dibatalkan. Dasar kode = salinan FixMaster di `dashboard/` (P13.1, P13.2), bagian SaaS dibuang (P13.4), skema multi-organisasi dipertahankan dengan penjaga satu toko 0105 (P13.5), perilaku FixMaster dulu dan selisih PRD dicatat (P13.6), UI ke dens-ui dengan warna Nuara per halaman (P13.3, P13.7). L-01 s.d. L-42 ditandai [DIBATALKAN] di Arsip.
- 2026-11-21 - L-43 - Tes integrasi belum dijalankan (belum ada proyek Supabase Nuara); helper-nya kini membuat toko lewat service_role (`createOrgAs`). Lima berkas tes integrasi fitur SaaS (admin platform, operator, saldo unit, batas bulanan, lead demo) ikut dihapus.
- 2026-11-21 - L-43 - Kunci `localStorage` `fixmaster-*` dan penanda backup `app: 'fixmaster'` sengaja tidak diganti (tidak tampil ke pengguna, dipakai tes dan skrip). Template email Auth FixMaster dibuang; Supabase memakai template bawaan sampai Pemilik memutuskan lain.
- 2026-11-21 - L-43 - Teks merek yang terlihat diganti ke Nuara (login, sidebar, wizard, lacak, nota, glosarium), tetapi tampilan halaman masuk masih membawa maskot VOLT dan teks "Precision Electronics Bench" sampai L-47.

- 2026-11-21 - L-46 - Preflight Tailwind dipasang di bawah CSS lama (pilihan P14.3) ternyata tetap mengubah halaman lama: `line-height` tombol/input dan warna placeholder berubah, kartu saldo Keuangan memanjang (222 ribu piksel berbeda). Penjaga `all: revert` juga gagal karena membatalkan atribut presentasi SVG/img (ikon Phosphor). Akhirnya preflight disalin ke `src/styles/dens-base.css` dan dibatasi ke `[data-slot]`/`[data-nu]`, di layer `nu-base` di atas `legacy`, sekaligus jadi perisai dari aturan elemen global.css (font judul, warna tautan). Halaman lama: 0 piksel berbeda.
- 2026-11-21 - L-46 - global.css memaksa `min-height`/`min-width` 44px `!important` pada tombol di layar sentuh; checkbox/switch Radix ikut membesar. Dicegah layer `nu-shield` (sebelum legacy). Target sentuh komponen dens-ui diatur di L-47.
- 2026-11-21 - L-46 - 19 variabel tema Tailwind bentrok dengan tokens.css FixMaster (`--text-sm`, `--radius-lg`, `--shadow-md`, `--font-sans`, ...). Ditulis langsung di `@theme inline` agar utilitas dens-ui tidak membaca angka FixMaster.
- 2026-11-21 - L-46 - Skrip audit dan foto menunggu teks "MODE DEMO" dari demo publik yang dibuang di L-43; diganti menunggu tautan menu Servis. `audit-contrast` memeriksa `/` (wizard) dan `/dev/komponen` alih-alih landing. Skrip audit menerima `PW_CHROMIUM` (Chromium container cloud).
- 2026-11-21 - L-46 - Wizard toko dipertahankan; dikonfirmasi Pemilik (A17).
- 2026-11-21 - L-47 - Hasil: foto desktop 1440px (normal, rail terlipat, menu akun, menu cabang), tablet 834px (laci terbuka), ponsel iPhone 13 (navigasi bawah, laci Lainnya, toast) tanpa error JS dan tanpa luberan; laci `inert` saat tertutup dan tidak saat terbuka; Esc pertama menutup menu cabang saja, Esc kedua menutup laci dan fokus kembali ke tombol Menu (juga dikunci `drawerMenuEscape.test.tsx`, diuji dengan mutasi); semua tautan dan tombol kerangka >= 44px di layar sentuh; detektor impeccable 0 temuan.
- 2026-11-21 - L-47 - Koreksi L-46: layer `nu-shield` (min-height 0 !important) ternyata juga mengalahkan `pointer-coarse:min-h-11` komponen dens-ui, sehingga tombol tetap 40px di ponsel. Diganti: aturan target sentuh `!important` di global.css kini mengecualikan lingkup dens-ui (`:not(:where([data-slot], [data-nu], ...))`), dan layer `nu-shield` dihapus.
- 2026-11-21 - L-47 - Toast sonner awalnya tertutup laci vaul: `#root` memakai `isolation: isolate`, sedangkan laci dan dialog Radix berada di portal body. `AppToaster` dirender lewat portal ke body, sama seperti toast FixMaster dulu.
- 2026-11-21 - L-47 - Putaran verifikasi menemukan tiga hal yang langsung diperbaiki: (1) gerbang `audit-contrast` diam-diam melewati teks berwarna `oklab()` dari opasitas Tailwind (11 label menu sidebar); pengurai warnanya kini lewat canvas, hasil 0 dilewati, 0 gagal; (2) tautan "Lewati ke isi halaman" 36px, kini 44px; (3) area sentuh checkbox/radio 42px karena `::after` diukur dari padding box, kini 44px. Probe `audit-zoom` sama dengan L-46 setelah positif palsu disaring; `audit-mobile` hanya berbeda di temuan tautan lewati tersebut (daftar temuan kecil dipotong 6 entri, jadi "Sewa" di Laporan sempat tergeser, bukan hilang).
- 2026-11-21 - L-47 - Isi halaman yang belum dipindah sengaja tetap FixMaster (font Inter/Space Grotesk, kartu lama) di atas latar Nuara; hanya kerangka yang memakai `data-nu`. Label "Panel navigasi" di atas judul menu Lainnya dibuang (impeccable: tanpa label kecil di atas judul).
- 2026-11-21 - L-58 - Hasil: foto 1280px dan iPhone 13 (masuk, daftar, lupa password, PIN, tautan reset tidak valid, form password baru, wizard 6 langkah) tanpa error JS dan tanpa luberan; semua tombol, isian, dan tautan >= 44px di layar sentuh; `audit-contrast` 0 gagal termasuk empat layar baru di `/dev/layar`; 8 halaman lama sama per piksel dengan L-47 (selisih tidak melebihi derau jam); log `audit-mobile` dan `audit-zoom` identik dengan L-47; detektor impeccable 0 temuan; 1136 tes / 85 berkas, lint, build lolos.
- 2026-11-21 - L-58 - Putaran verifikasi menemukan dua hal yang langsung diperbaiki: garis stepper wizard tergambar di atas lingkaran langkah aktif (lingkaran kini `z-[1]`), dan tautan "Daftar"/"Masuk" hanya 40px lebarnya di layar sentuh (kini min 44px). Juga terukur jebakan alat: foto `fullPage` di emulasi ponsel mematikan `pointer: coarse` sampai navigasi berikutnya, jadi target sentuh harus diukur sebelum foto (dicatat di `dashboard/AGENTS.md` 5).
- 2026-11-21 - L-58 - Ikut dibuang dari layar masuk: panel merek, maskot VOLT, rail diagnostik, tab mode, tombol kembali ke landing, pencatatan funnel daftar (bagian SaaS), dan 26 kunci i18n yang tidak terpakai lagi. Teks yang tampil selain itu tidak berubah; teks yang menyapa "Anda" (mis. "Pengaturan awal toko Anda", "Masukkan password baru untuk akun Anda") tetap, masuk G-07. Masuk tetap email + password dan daftar lewat undangan (G-02).
- 2026-11-21 - L-58 - `ResetPasswordPage` mendapat prop `initialPhase` yang hanya dipakai pratinjau `/dev/layar` (tidak ada tautan reset di dev server). `audit-contrast.mjs` kini memeriksa layar masuk, daftar, PIN, dan password baru.
- 2026-11-21 - L-58 - Utang lama, bukan dari L-58: build mencetak peringatan chunk `react-vendor` 601,8 kB (batas 600 kB di `vite.config.ts`). Ukurannya sama persis di commit L-47 (diukur dengan build worktree). Ditangani saat bersih-bersih L-56 atau bila batasnya perlu disesuaikan.
- 2026-11-21 - L-48 - Hasil: daftar Servis diukur di 12 ukuran (1920 sampai 1025 desktop, tablet sentuh 1366/1024/834/744, iPhone 13, 320px) tanpa luberan, tanpa elemen keluar dari barisnya, nomor tiket dan nomor HP tidak terpotong, lencana status di dalam lajurnya, kontrol >= 44px di layar sentuh; judul kolom tampil di 1920 dan 1440 (wadah 1082px, empat segmen), tersembunyi di 1366 ke bawah, sama dengan FixMaster. Form Servis Baru: galat di puncak + kolom ditandai, saran pelanggan dengan panah + Enter, draf tersimpan saat ditutup, fokus kembali ke tombol pembuka, lembar dari bawah di ponsel. Konfirmasi "Unit belum lunas", pintasan "N", dan klik baris tetap berfungsi. `audit-contrast` bersih (termasuk form dan modal status); detektor impeccable 0 temuan; probe dibandingkan dengan L-58 di versi lama yang berjalan berdampingan: `audit-zoom` bawaan, zoom 1,25, dan Padat identik, `audit-mobile` hanya berbeda di panjang geser baris chip status (baris yang memang bisa digeser), pita tablet kehilangan satu temuan lama (chip status di 1025px tak perlu digeser lagi); 11 halaman lain + detail tiket sama per piksel (selisih hanya di wilayah derau jam/animasi), modal status, kirim WA, dan pemilih sparepart yang dibuka dari daftar sama per piksel di dalam panelnya; 1142 tes / 86 berkas, lint, build lolos.
- 2026-11-21 - L-48 - Putaran verifikasi menemukan dua hal yang langsung diperbaiki: (1) setelah form ditutup fokus jatuh ke body, karena Radix hanya mengembalikan fokus ke `DialogTrigger`; `DialogContent` kini mencatat elemen yang fokus saat jendela dibuka dan mengembalikan fokus ke sana (dikunci `dialog.test.tsx`, diuji dengan mutasi); (2) judul kolom dan angka di tombol filter 11px, di bawah gerbang lantai 12px `audit-zoom`, kini 12px. `audit-contrast.mjs` mencari tombol status lewat nama aksesibelnya, bukan kelas CSS Module lama.
- 2026-11-21 - L-48 - Utang dari L-47 (K-01), belum diperbaiki (di luar L-48, mengubah kerangka di semua halaman): gerbang lantai 12px `audit-zoom` gagal di semua halaman sejak L-47. Kerangka dens-ui memakai teks 10-11px (label "Dashboard" sidebar 10,5px, chip zoom topbar, angka lencana menu, label dan angka menu bawah ponsel), padahal FixMaster memakai 12px di tempat yang sama. Probe hanya melaporkan teks terkecil per halaman, jadi yang terlihat hanya label 10,5px (143 baris di zoom 100%). Catatan L-47 yang menyebut probe zoom "sama dengan L-46" keliru untuk gerbang ini.
- 2026-11-21 - L-48 - Spine warna di tepi baris dan kartu tiket (motif FixMaster) tidak dibawa; warna status hanya di lencana (`STATUS_BADGE`). Modal yang dibuka dari daftar (status, kirim WA/nota, tiket jadi, pemilih sparepart) masih FixMaster sampai L-49; isi panelnya sama per piksel dengan sebelum L-48 (yang berbeda hanya latar halaman di luar sudut panel).
- 2026-11-22 - L-49 - Hasil: detail tiket diukur di 12 ukuran (1920 sampai 1025, tablet sentuh 1024/834, iPhone 13, 320px) x 8 tiket demo tanpa luberan, tanpa isi keluar dari panelnya, kontrol >= 44px di layar sentuh, bilah aksi satu baris dan selebar kolom isi (juga saat sidebar dilipat). Konfirmasi hapus tiket, panel "Lainnya", dan form modal dadakan berfungsi; fokus kembali ke pemicunya. `audit-contrast` bersih; log `audit-mobile` dan `audit-zoom` identik dengan L-48; 12 halaman lain (termasuk daftar Servis) sama per piksel dengan L-48 (selisih hanya di wilayah derau, plus 3 piksel anti-alias ikon menu aktif); modal status, kirim WA, dan pemilih sparepart yang dibuka dari detail identik di dalam panelnya; impeccable 0 temuan; 1147 tes / 86 berkas, lint, build lolos.
- 2026-11-22 - L-49 - Bilah aksi detail tiket dulu `fixed` dengan tepi kiri selebar sidebar dan bergeser lewat kelas `.collapsed` yang tidak lagi dipasang kerangka sejak L-47, jadi salah tempat saat sidebar dilipat (regresi L-47 yang belum tercatat). Kini `sticky` di dalam kolom isi. Ambang lipat aksi sekunder ke "Lainnya" ikut jumlah aksi (52/56/64rem), karena satu ambang 760px membuat bilah dua baris di tablet dan di tiket Selesai yang belum diambil.
- 2026-11-22 - L-59 - Hasil: modal Ubah Status diukur di 1440px dan iPhone 13 dalam lima keadaan (awal, target Selesai, Dibatalkan, tab DP, serah unit dengan pembayaran) tanpa luberan dan tanpa isi keluar dari jendela, kontrol >= 44px di layar sentuh; serah unit berakhir di panel Tiket Jadi. `audit-contrast` bersih (langkah Ubah Status, Selesai, Batal memakai modal baru); log `audit-mobile` dan `audit-zoom` identik dengan L-49; 13 halaman (termasuk daftar dan detail tiket) sama per piksel dengan L-49 dalam batas derau; modal kirim WA dan pemilih sparepart identik; impeccable 0 temuan; 1153 tes / 86 berkas, lint, build lolos.
- 2026-11-22 - L-59 - Cap miring di Tiket Jadi diganti lencana dengan teks yang sama (pola K-10). Komponen dens yang dipakai di dalam modal FixMaster (isian garansi part) diberi akar `data-nu` + `bg-transparent`: tanpa `data-nu` tombolnya mewarisi gaya tombol lama, dan `[data-nu]` sendiri memberi latar halaman abu-abu.
- 2026-11-22 - L-60 - Hasil: empat modal diukur di 1440px dan iPhone 13 (pemilih sparepart: daftar stok, hasil kosong, tab pembelian luar; kirim WA; garansi part; klaim garansi dengan kerugian) tanpa luberan dan tanpa isi keluar dari jendela, kontrol >= 44px di layar sentuh, fokus awal di kolom cari/keluhan, fokus kembali ke tombol pemicu. `audit-contrast` bersih dan kini ikut memeriksa pemilih sparepart dan kirim WA; log `audit-mobile` dan `audit-zoom` identik dengan L-59; 13 halaman sama per piksel dengan L-59 (selisih hanya di wilayah derau dan 1 piksel anti-alias ikon sidebar); impeccable 0 temuan; 1157 tes / 86 berkas, lint, build lolos.
- 2026-11-22 - L-60 - Spine warna status di strip tiket pemilih sparepart diganti lencana `STATUS_BADGE` (pola K-10). Kotak centang klaim garansi memakai `Checkbox` dens di dalam label sebaris, jadi seluruh baris bisa diketuk.

## Arsip: rencana Next.js (dibatalkan 2026-11-21)
Langkah di bawah tidak dikerjakan. Disimpan karena rujukan kriteria F-xx dan keputusan di dalamnya dipakai untuk L-45.

### Fase 1 - Fondasi

- [ ] **[DIBATALKAN] L-01 Setup proyek dashboard** (est. 2,5 jam)
  - Rujukan: TRD bagian 1, 3, 4, 6, 7
  - Kerjakan: cek versi mayor terbaru (Next.js, Tailwind, shadcn/ui, `@supabase/supabase-js` dan `@supabase/ssr`, Drizzle) di dokumentasi resmi dan catat di Catatan; buat `dashboard/` (Next.js + TypeScript strict + Tailwind + shadcn/ui), ESLint + Prettier, Vitest, Playwright, skrip npm sesuai TRD bagian 7, `dashboard/.env.example`, `.gitignore`; tambah `dashboard` dan `.github` ke `.vercelignore` root (`docs` sudah ada); `.github/workflows/dashboard-ci.yml`; commit pertama. Landing page di root tidak diubah.
  - Selesai jika: `npm run dev` menampilkan halaman awal; `npm run lint`, `npm run typecheck`, `npm test` (1 tes contoh), `npm run build` lolos; `.env.example` berisi semua variabel TRD bagian 6; `.vercelignore` memuat `dashboard`, `docs`, `.github`; `git diff` tidak menyentuh index.html, style.css, script.js, assets/.

- [ ] **[DIBATALKAN] L-02 Supabase, Vercel, domain, deploy awal** (est. 2,5 jam)
  - Rujukan: TRD bagian 1, 2, 5, 6
  - Kerjakan: dipandu AI, Pemilik membuat **satu** proyek Supabase untuk pengembangan dan tes (region Singapura; proyek produksi dibuat di L-36), mematikan Data API, mengatur Auth (pendaftaran baru dimatikan, panjang minimum password 8), membiarkan Realtime "Allow public access" aktif, membuat proyek Vercel kedua (paket Hobby, Root Directory `dashboard/`, region `sin1`), mengisi env, dan menambah DNS `app.` dan `lacak.` untuk nuaraservice.my.id. AI membuat `src/proxy.ts`: rewrite host `lacak.` ke `/lacak/[kode]`, host `lacak.` menolak semua rute selain `/<kode>` dan aset, host `app.` menolak `/lacak/*`; cek apakah proyek memakai JWT signing keys asimetris dan masa berlaku JWT, catat di Catatan.
  - Selesai jika: https://app.nuaraservice.my.id dan https://lacak.nuaraservice.my.id/tes terbuka dengan HTTPS; https://lacak.nuaraservice.my.id/masuk dan https://app.nuaraservice.my.id/lacak/tes menghasilkan 404; landing page di nuaraservice.my.id tetap tampil seperti sebelumnya; CI hijau di GitHub; env production Vercel menunjuk proyek Supabase tes (staging, TRD bagian 6).

- [ ] **[DIBATALKAN] L-03 Skema database inti + data contoh** (est. 3 jam)
  - Rujukan: BSD bagian 2-4, 7, 8
  - Kerjakan: skema Drizzle (postgres.js `prepare: false`, drizzle-kit hanya schema `public`) + migrasi tabel L-03 (BSD bagian 7) termasuk `profiles` yang merujuk `auth.users`, RLS aktif tanpa policy, `counters`, enum; `db:seed:dev` membuat akun contoh lewat Auth Admin API dan data contoh untuk proyek tes; `db:seed:prod` kerangka (pengaturan bawaan, daftar keluhan dari nota landing page; baru dijalankan di L-36). Bila koneksi langsung (IPv6) gagal untuk `db:migrate`, pakai session pooler dan catat di Catatan (audit S1 ditunda).
  - Selesai jika: `npm run db:migrate` berjalan dari database kosong di proyek tes; `npm run db:seed:dev` mengisi 30 tiket, 10 pelanggan, 4 akun yang bisa login; tes unit pembuat nomor (`counters`) dan kode tracking lolos; query dengan publishable key ke tabel mana pun ditolak.

- [ ] **[DIBATALKAN] L-04 Autentikasi** (est. 3 jam)
  - Rujukan: S-01, S-02, TRD bagian 5, BSD `profiles`, `login_attempts`, BSD bagian 5, F-08.4
  - Kerjakan: klien Supabase (server, browser, admin) dengan `cookieOptions.maxAge` 30 hari (cek opsi di dokumentasi `@supabase/ssr`); `proxy.ts` menyegarkan sesi (hanya host `app.`); `requireSession` dan `requireRole` (`getClaims()` + `profiles`: peran, `is_active`, `must_change_password`; tanpa pemeriksaan database di proxy); Server Action `signIn` dengan kunci 5x per 15 menit per (username, IP) dan batas 20 kegagalan per 15 menit per IP; S-01; S-02 (verifikasi password lama lewat `signInWithPassword`, ganti lewat Admin API); uji `createUser` dengan email sintetis `@staf.nuaraservice.my.id` di proyek tes (jika ditolak, ganti domain sintetis sebelum akun produksi dibuat).
  - Selesai jika: login benar masuk; salah 5x terkunci 15 menit untuk pasangan itu sementara IP lain tidak terkunci (tes unit + manual); rute staf tanpa sesi diarahkan ke S-01 lalu kembali; akun baru dipaksa ke S-02 (F-08.4, bagian ganti password); akun `is_active = false` ditolak pada permintaan berikutnya meski JWT masih berlaku (tes); JWT tidak memuat peran; `createUser` dengan email sintetis berhasil di proyek tes; akun contoh bisa login di app.nuaraservice.my.id.

- [ ] **[DIBATALKAN] L-05 Arah visual dashboard & tracking (impeccable)** (est. 2,5 jam)
  - Rujukan: DBD bagian 1-2, 6-7, DESIGN.md, `.impeccable/surfaces/`
  - Kerjakan: surface brief `.impeccable/surfaces/dashboard.md` dan `lacak.md`; token DBD bagian 2 ke tema Tailwind/shadcn; font Archivo via `next/font`; logo ke `public/`, ikon PWA 192/512 + maskable; mock satu layar (S-04) disetujui Pemilik.
  - Selesai jika: Pemilik menyetujui mock S-04; token di kode sama persis dengan DBD bagian 2 (dicek per hex); `npm run build` lolos.

- [ ] **[DIBATALKAN] L-06 Kerangka aplikasi** (est. 3 jam)
  - Rujukan: AFD bagian 2, 5, S-21, S-03, DBD komponen Navigasi, Pita offline, Halaman pesan, Toast, TRD bagian 1 (PWA), TRD bagian 5 (header keamanan)
  - Kerjakan: layout staf (sidebar >= 1024px, tab bawah < 1024px, menu per peran, header + lonceng kosong), pita offline, toast, S-21 (404 dan tanpa akses), S-03 versi kerangka (nama, peran, tombol keluar) sebagai tujuan setelah login sampai S-04 dan F-13 ada, `manifest.ts` + service worker minimal, header keamanan dasar (CSP yang menyisakan Next.js, Google Fonts, dan WebSocket Realtime; frame-ancestors none; nosniff).
  - Selesai jika: Teknisi hanya melihat menu Beranda, Tiket, Absensi; membuka `/laporan` sebagai Admin menampilkan "Halaman ini khusus Pemilik."; aplikasi bisa dipasang dari Chrome Android; mematikan jaringan memunculkan pita "Tidak ada koneksi"; header keamanan terkirim (dicek di respons); setelah login membuka S-03 kerangka; lebar 375px tanpa scroll horizontal.

### Fase 2 - Alur Inti (fitur P0)

- [ ] **[DIBATALKAN] L-07 Form buat tiket + pelanggan** (est. 3 jam)
  - Rujukan: F-01.1-F-01.5, F-01.10-F-01.12, S-05, AFD F-01, BSD `customers`, `tickets`, `ticket_events`
  - Kerjakan: S-05 dengan template keluhan per jenis perangkat, kelengkapan (draf daftar kelengkapan disetujui Pemilik di pertanyaan pra-langkah), dan kondisi fisik; normalisasi dan validasi nomor WA (F-01.3); saran data pelanggan lama (F-01.4); `client_request_id`; `createTicket` (tanpa DP, password/pola, Express; ditambah di L-08); draf form di browser tanpa password/pola (F-01.12); setelah simpan membuka S-06 sementara (halaman kerangka berisi nomor tiket) yang dilengkapi di L-09.
  - Selesai jika: F-01.1, F-01.3, F-01.4, F-01.5, F-01.10, F-01.11, F-01.12 terpenuhi, dan F-01.2 untuk kelengkapan dan kondisi fisik; tes unit normalisasi nomor WA (08xx 10-13 digit, 628xx 11-14 digit, +628xx, spasi/titik/tanda hubung/kurung diabaikan, nomor non-seluler ditolak) dan nomor NS- tanpa lompatan lolos; menekan Simpan dua kali dengan koneksi diputus lalu disambung hanya membuat satu tiket; draf isian pulih setelah sesi dihabiskan; tiket contoh tersimpan <= 2 menit saat diuji manual.

- [ ] **[DIBATALKAN] L-08 DP, Express, password unit** (est. 2,5 jam)
  - Rujukan: F-01.2, F-01.6, F-01.7, BSD `cash_accounts`, `payments`, `cash_entries`, TRD bagian 5 (enkripsi)
  - Kerjakan: DP split ke akun kas (akun kas contoh dari seed dev; akun kas asli diisi Pemilik di L-27 atau L-36); centang Express (estimasi wajib, persetujuan lisan, langsung Pengerjaan); enkripsi AES-256-GCM password/pola + `revealUnlockSecret` dengan audit; fungsi saldo akun kas (saldo awal + mutasi).
  - Selesai jika: F-01.2 (bagian password/pola, DP, Express), F-01.6, F-01.7 terpenuhi; tes unit enkripsi/dekripsi dan saldo (saldo awal + mutasi) lolos; password tidak terbaca di database (kolom berisi ciphertext); pembukaan tercatat di `audit_logs`.

- [ ] **[DIBATALKAN] L-09 Daftar tiket + detail tiket** (est. 3 jam)
  - Rujukan: S-04, S-06, F-03.6 (tampilan penanda; aturan di L-11 dan L-41), F-05.4, F-09.8, BSD bagian 5-6 (pagination), DBD Tabel/daftar, Badge
  - Kerjakan: S-04 (25 per halaman, cari nomor/nama/WA, filter tahap/teknisi/"perlu tindakan", badge Express/Link belum dikirim/Perlu ditindaklanjuti, filter "Tiket saya" untuk Teknisi); S-06 tampilan baca dengan aksi per peran (aksi diisi di langkah berikutnya, ubah data di L-37); nomor WA disembunyikan untuk Teknisi.
  - Selesai jika: pencarian "NS-00012", nama, dan "0812..." menemukan tiket yang benar di data contoh; Teknisi tidak melihat nomor WA di S-04/S-06 (dicek di HTML respons); setelah buat tiket S-06 terbuka dengan notifikasi "Tiket NS-xxxxx dibuat."; daftar 30 tiket contoh tampil < 3 detik.

- [ ] **[DIBATALKAN] L-37 Ubah data tiket** (est. 2 jam)
  - Rujukan: F-01.9, F-01.3, S-06, S-05, AFD F-01 (nomor sudah dipakai), BSD `tickets`, `customers`, `audit_logs`
  - Kerjakan: form ubah data tiket di S-06 memakai komponen form L-07 (unit, keluhan, kelengkapan, kondisi fisik, password/pola, nama dan nomor WA pelanggan) untuk Admin/Pemilik; `updateTicket`; penolakan nomor yang dipakai pelanggan lain; perubahan tercatat di riwayat perubahan.
  - Selesai jika: F-01.9 terpenuhi; mengubah nomor WA ke nomor pelanggan lain ditolak dengan pesan AFD; tes unit `updateTicket` (izin per peran, tiket tidak bisa dihapus); Teknisi tidak melihat tombol ubah.

- [ ] **[DIBATALKAN] L-10 Tahap dan penugasan** (est. 2,5 jam)
  - Rujukan: F-02.1-F-02.3, F-02.9, BSD bagian 4 (`ticket_stage`), `ticket_events`, `notifications` (tiket_ditugaskan)
  - Kerjakan: mesin transisi tahap di `server/services/` (semua transisi BSD bagian 4 termasuk Dibatalkan dan Dikembalikan sebagai kerangka tanpa syarat uang; tes unit tiap transisi sah dan tidak sah per peran), `assignTechnician`, `changeStage` (tanpa form Selesai), tombol tahap di S-06 sesuai peran, notifikasi tiket ditugaskan.
  - Selesai jika: F-02.1, F-02.2, F-02.3, F-02.9 terpenuhi; tes unit transisi lolos (termasuk Teknisi menolak tiket orang lain, Express melompat ke Pengerjaan, transisi tak sah ditolak dengan pesan yang menyebut syarat); riwayat tahap mencatat nama + waktu.

- [ ] **[DIBATALKAN] L-40 Catatan, mundur tahap, form Selesai + garansi** (est. 2,5 jam)
  - Rujukan: F-02.4, F-02.5, F-02.7, F-02.8, F-03.5, AFD F-02 (konfirmasi tahap final), BSD `ticket_events`, `tickets` (final_amount, *_warranty_days)
  - Kerjakan: `addNote` (catatan internal), `revertStage` (hanya dari Diagnosa sampai Selesai), form Selesai (biaya final dengan nilai awal = estimasi; garansi jasa dan sparepart dengan nilai awal dari pengaturan, wajib diisi, boleh 0), dialog konfirmasi untuk Diambil, Dibatalkan, dan Dikembalikan, notifikasi "Status diubah ke <tahap>", notifikasi tiket selesai ke Admin dan Pemilik.
  - Selesai jika: F-02.4, F-02.5, F-02.7, F-02.8 (notifikasi) dan F-03.5 terpenuhi; tes unit: mundur ditolak dari Diterima, Diambil, Dibatalkan, Dikembalikan; Selesai ditolak tanpa garansi; biaya final bawaan = estimasi; dialog konfirmasi tahap final muncul sebelum tersimpan.

- [ ] **[DIBATALKAN] L-11 Estimasi dan persetujuan** (est. 2,5 jam)
  - Rujukan: F-03.1-F-03.3, F-03.7, BSD `tickets` (estimate_*), BSD bagian 4 (`estimate_decision`), `notifications` (estimasi_siap)
  - Kerjakan: `saveEstimate` (estimasi terkunci setelah Disetujui), `decideEstimate` (Disetujui atau Ditolak, bisa diubah selama Konfirmasi biaya), kunci Pengerjaan sampai Disetujui (kecuali Express), `estimate_decision` empat nilai, notifikasi estimasi siap.
  - Selesai jika: F-03.1, F-03.2, F-03.3, F-03.7 terpenuhi; tes unit: Pengerjaan ditolak sebelum disetujui, Express lolos, estimasi yang sudah Disetujui tidak bisa diubah, keputusan bisa diubah selama Konfirmasi biaya.

- [ ] **[DIBATALKAN] L-41 Pembatalan, estimasi ditolak, pengembalian, Dikembalikan** (est. 2,5 jam)
  - Rujukan: F-02.6, F-02.10, F-03.4, F-03.6, F-07.7, BSD bagian 4, `tickets` (check_fee, cancel_reason, returned_at), `payments` (refund), `notifications` (estimasi_ditolak)
  - Kerjakan: Dibatalkan (Admin/Pemilik, dari Diterima sampai Selesai; alasan + biaya cek, password/pola dihapus); alur Ditolak (Teknisi menandai -> notifikasi ke semua Admin dan Pemilik; Admin/Pemilik menandai -> dialog Batalkan); penanda "Perlu ditindaklanjuti" (Konfirmasi biaya > 2 hari, Ditolak belum dibatalkan); fungsi tagihan/dibayar/sisa/kelebihan di `server/services/money.ts` (dilengkapi tes di L-18); `recordRefund` (kelebihan bayar, cek saldo); tahap Dikembalikan (Admin/Pemilik, dari Dibatalkan; kunci uang dilengkapi di L-39).
  - Selesai jika: F-02.6, F-02.10 (tanpa kunci uang yang dilengkapi L-39), F-03.4, F-03.6, F-07.7 terpenuhi; tes unit: pengembalian maksimal = kelebihan, pengembalian melebihi saldo ditolak, Ditolak oleh Teknisi tidak membatalkan tiket tetapi membuat notifikasi untuk semua Admin dan Pemilik, Dikembalikan hanya dari Dibatalkan, password/pola terhapus saat Dibatalkan.

- [ ] **[DIBATALKAN] L-12 Tracking: data dan aturan** (est. 2,5 jam)
  - Rujukan: F-04.1-F-04.4, F-04.7, F-04.8, S-07, AFD F-04, BSD `tickets`, `ticket_events`
  - Kerjakan: rute `/lacak/[kode]` (host `lacak.`) dengan query terbatas pada kolom F-04.2; samaran nama; riwayat tahap; garansi (jumlah hari sebelum Diambil, tanggal berakhir sesudahnya, "Tanpa garansi"); aturan masa aktif (Diambil, Dibatalkan, Dikembalikan); halaman link tidak aktif + tombol chat WA; tampilan sementara sederhana (dunia nota di L-38).
  - Selesai jika: F-04.1, F-04.2 (data), F-04.3, F-04.4, F-04.7, F-04.8 terpenuhi; tes unit samaran nama ("Citra Lestari" -> "Ci*** L.", satu kata, nama sangat pendek) dan masa aktif link (garansi 0, garansi 30 dan 90 hari contoh, Dibatalkan, Dikembalikan); HTML tracking tidak berisi nomor WA, catatan, diagnosa, estimasi, biaya, atau pembayaran.

- [ ] **[DIBATALKAN] L-38 Tracking: tampilan nota dan performa** (est. 2,5 jam)
  - Rujukan: F-04.2 (tampilan), F-04.6, S-07, DBD Nota tracking + token tracking, DESIGN.md, `.impeccable/surfaces/lacak.md`
  - Kerjakan: tampilan dunia nota di S-07 (impeccable): kepala nota, riwayat tahap sebagai langkah, garansi, kartu kontak + rute, teks pemberitahuan privasi (jika diisi), halaman link tidak aktif; optimasi font dan ukuran agar LCP < 2 detik.
  - Selesai jika: F-04.2 (tampilan) dan F-04.6 terpenuhi; Lighthouse mobile (throttling 4G) mencatat LCP < 2 detik; kontras halaman sesuai DBD (dicek); tampil benar di 375px, 768px, 1280px.

- [ ] **[DIBATALKAN] L-13 Kabar status ke WA** (est. 2 jam)
  - Rujukan: F-05.1-F-05.6, F-01.8, F-02.8, BSD `wa_messages`, `settings` (wa_template_*)
  - Kerjakan: draf 3 template WA disetujui Pemilik (pertanyaan pra-langkah, tanpa fakta karangan); tombol Diterima/Selesai/Diambil untuk Admin/Pemilik (termasuk tombol kirim link tracking di S-06 setelah tiket dibuat), `recordWaMessage`, link `wa.me` ter-encode, tombol Salin pesan, sembunyikan Minta ulasan bila link ulasan kosong.
  - Selesai jika: F-05.1-F-05.6 dan F-01.8 terpenuhi, dan F-02.8 untuk tombol WA setelah Selesai dan Diambil; tes unit pembentuk URL wa.me (spasi, baris baru, karakter &); penanda "Link belum dikirim" hilang setelah tombol ditekan; Teknisi tidak melihat tombol atau nomor WA; diuji sekali ke nomor WA milik Pemilik.

- [ ] **[DIBATALKAN] L-14 Realtime tiket dan tracking** (est. 3 jam)
  - Rujukan: F-04.5, AFD bagian 5 (Realtime), TRD bagian 2 dan 9, BSD bagian 6 (channel, kebijakan RLS) dan 7
  - Kerjakan: `server/realtime.ts` (kirim sinyal lewat REST Broadcast dengan secret key setelah transaksi berhasil, best-effort); migrasi kebijakan Realtime (fungsi `public.is_active_staff()`, policy SELECT untuk `staff`, tanpa policy kirim); langganan privat di S-04 dan S-06 (S-03 di L-30) dan langganan publik di S-07; ambil ulang data via server; pemuatan ulang digabung (staf 2 detik, tracking 3 detik); payload hanya ID.
  - Selesai jika: F-04.5 terpenuhi; dua browser terbuka, perubahan tahap di satu browser terlihat di S-04/S-06 browser lain dan di S-07 dalam <= 5 detik; payload yang terekam hanya berisi UUID atau tanda berubah; klien tanpa login tidak bisa join `staff`; pesan palsu yang dikirim klien tanpa login ke topik `staff` tidak memicu muat ulang di layar staf; staf yang dinonaktifkan tidak bisa join ulang `staff`; migrasi tidak memuat `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY`.

- [ ] **[DIBATALKAN] L-15 Notifikasi lonceng** (est. 2 jam)
  - Rujukan: S-20, AFD bagian 5 (notifikasi), BSD `notifications`
  - Kerjakan: angka di lonceng, S-20, tandai dibaca saat dibuka, buka tiket terkait; kejadian tiket_ditugaskan, estimasi_siap, estimasi_ditolak, tiket_selesai (minta_izin_ambil di L-39).
  - Selesai jika: tiap kejadian membuat notifikasi ke penerima yang benar sesuai AFD bagian 5 (tes unit penerima); angka lonceng berkurang setelah dibuka.

- [ ] **[DIBATALKAN] L-16 Tes E2E alur P0** (est. 2,5 jam)
  - Rujukan: PRD bagian 5 (F-01-F-05), TRD bagian 7 (E2E)
  - Kerjakan: skenario Playwright alur P0 lengkap (TRD bagian 7) di database tes, plus skenario Teknisi ditolak mengubah tiket orang lain, link tracking tidak aktif, dan alur batal (Ditolak -> Dibatalkan -> Dikembalikan). Skenario diperbarui di L-39 saat kunci pelunasan aktif.
  - Selesai jika: `npm run test:e2e` lolos 3 kali berturut-turut; `npm test`, `npm run lint`, `npm run build` lolos.

### Fase 3 - Fitur Pendukung (P1)

- [ ] **[DIBATALKAN] L-17 Cetak tanda terima** (est. 3 jam)
  - Rujukan: F-06.1-F-06.5, S-08, DBD Layout cetak thermal, BSD `settings` (printer_width, receipt_terms, privacy_notice)
  - Kerjakan: tanyakan ukuran printer yang dipakai; S-08 untuk 58 dan 80 mm dengan logo hitam-putih, QR, S&K dan teks pemberitahuan privasi (kosong jika belum diisi); tombol cetak/cetak ulang di S-06; uji di laptop (USB) dan HP Android (RawBT). Klaim "semua gratis" untuk RawBT belum diverifikasi (audit S9 ditunda): catat hasil uji di Catatan.
  - Selesai jika: F-06.1-F-06.5 terpenuhi; tanda terima tercetak rapi di printer asli dari laptop dan dari Android (hasil dicek langsung oleh Pemilik; printer, ukuran, dan hasil OK atau tidak dicatat di Catatan); QR terbaca kamera HP dan membuka S-07.

- [ ] **[DIBATALKAN] L-18 Pembayaran: tagihan, sisa, split, diskon** (est. 3 jam)
  - Rujukan: F-07.1-F-07.4, F-07.6, F-07.7, F-07.9, AFD F-07, BSD `payments`, `cash_entries`, `tickets` (final_amount, discount_amount, check_fee)
  - Kerjakan: `recordPayment` (jenis dp atau pelunasan mengikuti tahap, split), diskon (mulai Selesai, <= biaya final), `voidPayment`, melengkapi `server/services/money.ts` (tagihan, dibayar, sisa, lunas) dan tampilannya di S-06, tombol "Kembalikan kelebihan" untuk kelebihan bayar (memakai `recordRefund` dari L-41).
  - Selesai jika: F-07.1-F-07.4, F-07.6, F-07.9 terpenuhi, dan F-07.7 untuk kelebihan setelah diskon atau biaya final lebih kecil dari DP; tes unit tagihan/dibayar/sisa/lunas (sebelum Selesai tanpa tagihan; DP tanpa patokan; dengan diskon; kelebihan; pembatalan pembayaran; tiket Dibatalkan) lolos; pembayaran melebihi sisa ditolak.

- [ ] **[DIBATALKAN] L-39 Kunci serah unit + izin Pemilik** (est. 2 jam)
  - Rujukan: F-07.5, F-02.10 (kunci uang), AFD F-07 (diagram kunci), BSD `tickets` (pickup_override_*), `notifications` (minta_izin_ambil)
  - Kerjakan: kunci tahap Diambil dan Dikembalikan selama sisa tidak nol; `requestPickupOverride` dan `approvePickupOverride` (khusus kurang bayar; kelebihan bayar tanpa pengecualian) + notifikasi ke Pemilik; perbarui skenario E2E L-16 agar membayar sebelum Diambil.
  - Selesai jika: F-07.5 terpenuhi; Diambil dan Dikembalikan ditolak saat kurang bayar atau kelebihan bayar, dan lolos setelah lunas atau (kurang bayar saja) izin Pemilik; notifikasi minta izin sampai ke Pemilik; `npm run test:e2e` lolos dengan skenario yang diperbarui.

- [ ] **[DIBATALKAN] L-19 Nota pelunasan** (est. 2 jam)
  - Rujukan: F-07.8, S-09, DBD Layout cetak thermal
  - Kerjakan: S-09 untuk nota pembayaran tiket (58/80 mm) sesuai isi F-07.8 dan tombol kirim ringkasan nota lewat wa.me.
  - Selesai jika: F-07.8 terpenuhi; nota tercetak di printer asli; teks WA nota memuat nomor tiket, total, dibayar, sisa.

- [ ] **[DIBATALKAN] L-20 Kas: pengeluaran, pindah saldo, koreksi saldo** (est. 3 jam)
  - Rujukan: F-11.1-F-11.7, S-15, BSD `expenses`, `cash_transfers`, `cash_entries`, `cash_accounts`
  - Kerjakan: migrasi L-20; S-15 (mutasi per hari per akun, saldo), `createExpense`, `createTransfer`, pembatalan, `adjustCashBalance` (Pemilik, alasan wajib), kunci saldo awal setelah akun punya mutasi; cek saldo dengan kunci baris.
  - Selesai jika: F-11.1-F-11.7 terpenuhi; tes unit saldo dan penolakan saldo kurang lolos (termasuk koreksi negatif yang membuat saldo minus ditolak); dua pengeluaran bersamaan yang total melebihi saldo hanya satu yang berhasil; saldo awal tidak bisa diubah setelah ada mutasi.

- [ ] **[DIBATALKAN] L-21 Stok sparepart** (est. 3 jam)
  - Rujukan: F-09.1, F-09.2, F-09.6, F-09.7, S-12, S-13, BSD `parts`, `stock_movements`
  - Kerjakan: migrasi L-21; S-12 (daftar, stok menipis), S-13 (detail, riwayat), tambah barang, barang masuk (harga modal rata-rata, uang keluar), koreksi stok dengan alasan.
  - Selesai jika: F-09.1, F-09.2, F-09.6, F-09.7 terpenuhi; tes unit harga modal rata-rata dan stok tidak minus lolos; Teknisi tidak bisa membuka S-12.

- [ ] **[DIBATALKAN] L-22 Sparepart di tiket + beli dadakan** (est. 2,5 jam)
  - Rujukan: F-09.3-F-09.5, F-09.8, F-09.9, S-06, S-04, S-03, BSD `ticket_parts`, `ticket_extra_costs`
  - Kerjakan: migrasi L-22; pakai sparepart (di S-06 dan dialog cepat "Tambah sparepart" di baris S-04), kembalikan (selama tiket belum Diambil atau Dikembalikan), beli dadakan (akun kas), modal/profit tiket khusus Pemilik. Dialog cepat di daftar tiket Teknisi pada S-03 ditambahkan di L-30.
  - Selesai jika: F-09.3-F-09.5, F-09.8 terpenuhi; F-09.9 terpenuhi untuk S-04 (sparepart tersimpan tanpa membuka S-06); tes unit modal tiket (stok + beli dadakan, pengembalian) lolos; respons S-06 untuk Admin/Teknisi tidak memuat angka modal.

- [ ] **[DIBATALKAN] L-23 Jual barang langsung** (est. 3 jam)
  - Rujukan: F-17.1-F-17.3, S-14, S-09, BSD `sales`, `sale_items`, `payments.sale_id`
  - Kerjakan: migrasi L-23; S-14, `createSale` (nomor JL-, diskon, split, pelanggan dari WA pembeli bila diisi), `voidSale`, nota JL di S-09 sesuai isi F-17.1 + WA.
  - Selesai jika: F-17.1-F-17.3 terpenuhi; tes unit stok dan saldo setelah jual dan batal lolos; nomor JL- urut tanpa lompatan; WA pembeli diisi tanpa nama ditolak.

- [ ] **[DIBATALKAN] L-24 Kelola akun staf + jadwal kerja** (est. 3 jam)
  - Rujukan: F-08.1-F-08.7, S-18, BSD `profiles`, `work_schedules`
  - Kerjakan: migrasi L-24; S-18 (tambah lewat Auth Admin API + `profiles`, ubah peran, jadwal Senin-Minggu, nonaktifkan: `is_active = false` + ban Supabase, aktifkan kembali, reset password sementara, perlindungan akun Pemilik sendiri dan minimal satu Pemilik aktif).
  - Selesai jika: F-08.1-F-08.7 terpenuhi; staf yang dinonaktifkan ditolak pada permintaan berikutnya di browser yang sedang login; tes E2E tambah staf -> login -> wajib ganti password lolos; menonaktifkan atau mengubah peran akun Pemilik sendiri ditolak; akun Auth dihapus kembali bila pembuatan `profiles` gagal (tes); akun yang dinonaktifkan tidak bisa menyegarkan sesi (diuji).

- [ ] **[DIBATALKAN] L-25 Absensi GPS** (est. 3 jam)
  - Rujukan: F-10.1-F-10.4, F-10.6 (bagian staf), F-10.7, S-16, S-03 (tombol absen Teknisi), BSD `attendances`
  - Kerjakan: migrasi L-25; tombol Masuk/Pulang, hitung jarak di server lalu buang koordinat, tolak di luar 100 m, tanda terlambat dari jadwal + toleransi, riwayat sendiri bulan ini.
  - Selesai jika: F-10.1-F-10.4, F-10.7 terpenuhi (absen di luar 100 m ditolak dengan pesan AFD; izin lokasi ditolak tetap tersimpan dengan tanda); tes unit jarak (Haversine), radius, dan terlambat lolos; tabel `attendances` tidak memuat koordinat; diuji di HP Android dan iPhone di workshop.

- [ ] **[DIBATALKAN] L-26 Rekap absensi Pemilik** (est. 2 jam)
  - Rujukan: F-10.5, F-10.6, S-16
  - Kerjakan: rekap per staf per bulan (hadir, terlambat, tanpa jam pulang, total jam), isi jam pulang, catat manual dengan alasan.
  - Selesai jika: F-10.5, F-10.6 terpenuhi; koreksi tercatat di `audit_logs`; Admin/Teknisi tidak bisa membuka rekap staf lain.

- [ ] **[DIBATALKAN] L-27 Pengaturan** (est. 3 jam)
  - Rujukan: F-16.1-F-16.3, F-11.3, S-19, BSD `settings`, `cash_accounts`
  - Kerjakan: S-19 per bagian (template keluhan/kelengkapan/WA, S&K dan teks pemberitahuan privasi, link ulasan, printer, akun kas + saldo awal yang terkunci setelah ada mutasi, garansi awal, titik lokasi "pakai lokasi saya sekarang", toleransi terlambat).
  - Selesai jika: F-16.1-F-16.3 terpenuhi; saldo awal tidak bisa diubah setelah akun punya mutasi (F-11.3); mengubah template keluhan langsung tampil di S-05; perubahan tercatat di `audit_logs` (termasuk kunci pengaturan berupa teks).

- [ ] **[DIBATALKAN] L-28 Data pelanggan + riwayat** (est. 2 jam)
  - Rujukan: F-14.1, F-14.2, S-10, S-11, BSD `customers`
  - Kerjakan: S-10 (cari), S-11 (riwayat tiket), samarkan pelanggan oleh Pemilik (nomor diganti `anon-<uuid>`).
  - Selesai jika: F-14.1, F-14.2 terpenuhi; setelah disamarkan, nama dan nomor lama tidak ditemukan lewat pencarian dan laporan bulan itu tidak berubah.

- [ ] **[DIBATALKAN] L-29 Klaim garansi** (est. 2 jam)
  - Rujukan: F-15.1-F-15.3, S-06, S-05, BSD `tickets` (warranty_claim_*)
  - Kerjakan: tombol Klaim garansi, prefill S-05, tautan dua arah di S-06, cek masa garansi per jenis, tiket klaim dengan estimasi Rp0 yang langsung Disetujui.
  - Selesai jika: F-15.1, F-15.2, F-15.3 terpenuhi; tes unit berakhirnya garansi jasa vs sparepart lolos; tiket klaim bisa langsung ke Pengerjaan tanpa persetujuan manual.

- [ ] **[DIBATALKAN] L-30 Beranda per peran** (est. 3 jam)
  - Rujukan: F-13.1-F-13.4, F-09.9, S-03, AFD bagian 5 (redirect), DBD Card
  - Kerjakan: S-03 untuk Pemilik, Admin, Teknisi (daftar tiket Teknisi dengan dialog "Tambah sparepart"); kartu perlu tindakan membuka S-04 terfilter (termasuk estimasi Ditolak belum dibatalkan dan Dibatalkan belum Dikembalikan); langganan realtime `dashboard_changed`; redirect pasca login ke S-03.
  - Selesai jika: F-13.1-F-13.4 terpenuhi; F-09.9 terpenuhi di S-03 Teknisi; angka kartu sama dengan hitungan manual di data contoh; respons beranda Admin tidak memuat modal/profit.

- [ ] **[DIBATALKAN] L-31 Laporan bulanan: aturan hitung** (est. 2,5 jam)
  - Rujukan: F-12.1-F-12.3, BSD `tickets`, `ticket_parts`, `ticket_extra_costs`, `sales`, `sale_items`, `expenses`
  - Kerjakan: `getMonthlyReport` di `server/services/` (omzet, biaya barang, pengeluaran, profit, tiket per status, per jenis perangkat, kinerja teknisi) dengan dasar bulan F-12.2.
  - Selesai jika: F-12.1, F-12.2, F-12.3 terpenuhi; tes unit laporan dengan data terkontrol cocok dengan hitungan tangan (tiket Diambil; tiket Dibatalkan dengan sparepart yang dikembalikan dan yang tidak; beli dadakan dibatalkan; penjualan langsung dengan modal barang terjual; DP bulan lalu; pembayaran yang dibatalkan tidak memengaruhi omzet).

- [ ] **[DIBATALKAN] L-42 Laporan bulanan: tampilan** (est. 2 jam)
  - Rujukan: F-12.4, F-12.5, S-17, DBD Card
  - Kerjakan: S-17 (pilih bulan, angka + selisih dari bulan lalu, kinerja teknisi, bulan kosong), akses khusus Pemilik.
  - Selesai jika: F-12.4, F-12.5 terpenuhi; Admin dan Teknisi yang membuka `/laporan` melihat S-21; angka di layar sama dengan hasil tes L-31.

### Fase 4 - Polesan & Rilis

- [ ] **[DIBATALKAN] L-32 Backup mingguan + reset password Pemilik** (est. 2 jam)
  - Rujukan: TRD bagian 5-7, 9, BSD bagian 8
  - Kerjakan: `.github/workflows/db-backup.yml` (pg_dump terenkripsi, artifact 60 hari), `scripts/reset-owner-password.ts` (Auth Admin API), `dashboard/scripts/README.md` (cara pulihkan dan reset). Bila koneksi langsung tidak tersambung dari GitHub Actions (IPv6), pakai session pooler dan catat (audit S1 ditunda).
  - Selesai jika: workflow dijalankan manual dan menghasilkan artifact; backup itu berhasil dipulihkan ke proyek Supabase tes; reset password Pemilik berjalan di database tes.

- [ ] **[DIBATALKAN] L-33 State kosong/loading/error semua layar** (est. 2,5 jam)
  - Rujukan: AFD bagian 4
  - Selesai jika: setiap baris AFD bagian 4 dicoba manual (database kosong, jaringan lambat, jaringan mati) dan tampil sesuai tabel.

- [ ] **[DIBATALKAN] L-34 Aksesibilitas, responsivitas, perangkat** (est. 3 jam)
  - Rujukan: DBD bagian 2 (kontras), DBD bagian 4, DBD bagian 5, TRD bagian 9 (Safari)
  - Kerjakan: audit keyboard dan pembaca layar, kontras token, finish review impeccable; uji di laptop Windows, HP Android, iPhone, tablet; cek teks dashboard tidak memuat "kamu", "Anda", atau "-mu" (hanya S-07 boleh "kamu").
  - Selesai jika: semua layar dicek di lebar 375px, 768px, dan 1280px tanpa scroll horizontal; semua aksi bisa dicapai dengan keyboard dan fokus terlihat; skor aksesibilitas Lighthouse >= 95 di S-04, S-05, S-06, S-07; pemasangan PWA dan absen GPS berhasil di iPhone dan Android; pencarian teks sapaan di layar dashboard kosong.

- [ ] **[DIBATALKAN] L-35 Tes menyeluruh & perbaikan bug** (est. 3 jam)
  - Rujukan: PRD bagian 5 (semua kriteria F-01-F-17)
  - Selesai jika: semua kriteria PRD bagian 5 dicentang dengan bukti (tes atau langkah manual); `npm test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`, `npm run build` lolos.

- [ ] **[DIBATALKAN] L-36 Rilis & peralihan dari FixMaster** (est. 2,5 jam)
  - Rujukan: TRD bagian 6, PRD bagian 3, BSD bagian 7
  - Kerjakan: buat proyek Supabase produksi (region Singapura; Data API mati, pengaturan Auth sama seperti L-02), jalankan migrasi dan `db:seed:prod`, alihkan env production Vercel ke proyek produksi; tanyakan ke Pemilik daftar akun staf final (nama, username, peran) dan buat lewat Auth Admin API; Pemilik mengisi Pengaturan (akun kas + saldo awal, garansi awal, S&K, teks pemberitahuan privasi, link ulasan, titik lokasi, toleransi, printer); uji satu tiket nyata dari buat sampai Diambil; tentukan hari mulai bersama Pemilik; catat tanggal untuk target berhenti FixMaster (<= 1 bulan).
  - Selesai jika: satu tiket nyata melewati semua tahap di production, tanda terima tercetak, link tracking diterima di WA pelanggan uji; proyek Supabase produksi tidak memuat data contoh; app.nuaraservice.my.id memakai proyek produksi; tanggal mulai dan tanggal target berhenti FixMaster tercatat di Catatan.
