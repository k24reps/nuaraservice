# IPD (Implementation Plan Document) - Nuara Dashboard

> Versi: 0.2 | Diperbarui: 2026-11-04 | Merujuk: PRD, TRD, AFD, DBD, BSD

## Cara memakai
- Kerjakan **satu langkah per sesi**, dari atas ke bawah. Urutan mengikuti posisi di daftar, bukan nomor ID (L-37 sampai L-42 disisipkan di posisi yang tepat).
- Status: `[ ]` belum, `[~]` sedang dikerjakan atau terputus, `[x]` selesai (kriteria "Selesai jika" terbukti lolos).
- ID `L-xx` tidak pernah dinomori ulang. Langkah baru memakai nomor berikutnya dan disisipkan di posisi yang tepat.
- Langkah yang tidak jadi dikerjakan: tulis `[DIBATALKAN]` di depan namanya, jangan dihapus.
- Jangan mengerjakan fitur di luar langkah yang aktif.
- Semua perintah dijalankan dari folder `dashboard/` (TRD bagian 7). Langkah UI memakai skill impeccable untuk eksekusi visual (CLAUDE.md).
- Fakta bisnis (nama staf, akun kas, saldo, durasi garansi, S&K, teks privasi, link ulasan, lokasi) ditanyakan ke Pemilik di pertanyaan pra-langkah, tidak dikarang.

## Ringkasan Fase
| Fase | Tujuan | Langkah | Estimasi (jam) |
|---|---|---|---|
| 1 | Fondasi | L-01 s.d. L-06 | 16,5 |
| 2 | Alur inti (P0) | L-07 s.d. L-16, L-37, L-38, L-40, L-41 | 35 |
| 3 | Fitur pendukung (P1) | L-17 s.d. L-31, L-39, L-42 | 44 |
| 4 | Polesan & rilis | L-32 s.d. L-36 | 13 |
| | **Total** | 42 langkah | 108,5 |

Target: belum ada tenggat (P0.3); waktu Pemilik > 30 jam/minggu. Nuara pindah dari FixMaster setelah L-36.

## Fase 1 - Fondasi

- [ ] **L-01 Setup proyek dashboard** (est. 2,5 jam)
  - Rujukan: TRD bagian 1, 3, 4, 6, 7
  - Kerjakan: cek versi mayor terbaru (Next.js, Tailwind, shadcn/ui, `@supabase/supabase-js` dan `@supabase/ssr`, Drizzle) di dokumentasi resmi dan catat di Catatan; buat `dashboard/` (Next.js + TypeScript strict + Tailwind + shadcn/ui), ESLint + Prettier, Vitest, Playwright, skrip npm sesuai TRD bagian 7, `dashboard/.env.example`, `.gitignore`; tambah `dashboard` dan `.github` ke `.vercelignore` root (`docs` sudah ada); `.github/workflows/dashboard-ci.yml`; commit pertama. Landing page di root tidak diubah.
  - Selesai jika: `npm run dev` menampilkan halaman awal; `npm run lint`, `npm run typecheck`, `npm test` (1 tes contoh), `npm run build` lolos; `.env.example` berisi semua variabel TRD bagian 6; `.vercelignore` memuat `dashboard`, `docs`, `.github`; `git diff` tidak menyentuh index.html, style.css, script.js, assets/.

- [ ] **L-02 Supabase, Vercel, domain, deploy awal** (est. 2,5 jam)
  - Rujukan: TRD bagian 1, 2, 5, 6
  - Kerjakan: dipandu AI, Pemilik membuat **satu** proyek Supabase untuk pengembangan dan tes (region Singapura; proyek produksi dibuat di L-36), mematikan Data API, mengatur Auth (pendaftaran baru dimatikan, panjang minimum password 8), membiarkan Realtime "Allow public access" aktif, membuat proyek Vercel kedua (paket Hobby, Root Directory `dashboard/`, region `sin1`), mengisi env, dan menambah DNS `app.` dan `lacak.` untuk nuaraservice.my.id. AI membuat `src/proxy.ts`: rewrite host `lacak.` ke `/lacak/[kode]`, host `lacak.` menolak semua rute selain `/<kode>` dan aset, host `app.` menolak `/lacak/*`; cek apakah proyek memakai JWT signing keys asimetris dan masa berlaku JWT, catat di Catatan.
  - Selesai jika: https://app.nuaraservice.my.id dan https://lacak.nuaraservice.my.id/tes terbuka dengan HTTPS; https://lacak.nuaraservice.my.id/masuk dan https://app.nuaraservice.my.id/lacak/tes menghasilkan 404; landing page di nuaraservice.my.id tetap tampil seperti sebelumnya; CI hijau di GitHub; env production Vercel menunjuk proyek Supabase tes (staging, TRD bagian 6).

- [ ] **L-03 Skema database inti + data contoh** (est. 3 jam)
  - Rujukan: BSD bagian 2-4, 7, 8
  - Kerjakan: skema Drizzle (postgres.js `prepare: false`, drizzle-kit hanya schema `public`) + migrasi tabel L-03 (BSD bagian 7) termasuk `profiles` yang merujuk `auth.users`, RLS aktif tanpa policy, `counters`, enum; `db:seed:dev` membuat akun contoh lewat Auth Admin API dan data contoh untuk proyek tes; `db:seed:prod` kerangka (pengaturan bawaan, daftar keluhan dari nota landing page; baru dijalankan di L-36). Bila koneksi langsung (IPv6) gagal untuk `db:migrate`, pakai session pooler dan catat di Catatan (audit S1 ditunda).
  - Selesai jika: `npm run db:migrate` berjalan dari database kosong di proyek tes; `npm run db:seed:dev` mengisi 30 tiket, 10 pelanggan, 4 akun yang bisa login; tes unit pembuat nomor (`counters`) dan kode tracking lolos; query dengan publishable key ke tabel mana pun ditolak.

- [ ] **L-04 Autentikasi** (est. 3 jam)
  - Rujukan: S-01, S-02, TRD bagian 5, BSD `profiles`, `login_attempts`, BSD bagian 5, F-08.4
  - Kerjakan: klien Supabase (server, browser, admin) dengan `cookieOptions.maxAge` 30 hari (cek opsi di dokumentasi `@supabase/ssr`); `proxy.ts` menyegarkan sesi (hanya host `app.`); `requireSession` dan `requireRole` (`getClaims()` + `profiles`: peran, `is_active`, `must_change_password`; tanpa pemeriksaan database di proxy); Server Action `signIn` dengan kunci 5x per 15 menit per (username, IP) dan batas 20 kegagalan per 15 menit per IP; S-01; S-02 (verifikasi password lama lewat `signInWithPassword`, ganti lewat Admin API); uji `createUser` dengan email sintetis `@staf.nuaraservice.my.id` di proyek tes (jika ditolak, ganti domain sintetis sebelum akun produksi dibuat).
  - Selesai jika: login benar masuk; salah 5x terkunci 15 menit untuk pasangan itu sementara IP lain tidak terkunci (tes unit + manual); rute staf tanpa sesi diarahkan ke S-01 lalu kembali; akun baru dipaksa ke S-02 (F-08.4, bagian ganti password); akun `is_active = false` ditolak pada permintaan berikutnya meski JWT masih berlaku (tes); JWT tidak memuat peran; `createUser` dengan email sintetis berhasil di proyek tes; akun contoh bisa login di app.nuaraservice.my.id.

- [ ] **L-05 Arah visual dashboard & tracking (impeccable)** (est. 2,5 jam)
  - Rujukan: DBD bagian 1-2, 6-7, DESIGN.md, `.impeccable/surfaces/`
  - Kerjakan: surface brief `.impeccable/surfaces/dashboard.md` dan `lacak.md`; token DBD bagian 2 ke tema Tailwind/shadcn; font Archivo via `next/font`; logo ke `public/`, ikon PWA 192/512 + maskable; mock satu layar (S-04) disetujui Pemilik.
  - Selesai jika: Pemilik menyetujui mock S-04; token di kode sama persis dengan DBD bagian 2 (dicek per hex); `npm run build` lolos.

- [ ] **L-06 Kerangka aplikasi** (est. 3 jam)
  - Rujukan: AFD bagian 2, 5, S-21, S-03, DBD komponen Navigasi, Pita offline, Halaman pesan, Toast, TRD bagian 1 (PWA), TRD bagian 5 (header keamanan)
  - Kerjakan: layout staf (sidebar >= 1024px, tab bawah < 1024px, menu per peran, header + lonceng kosong), pita offline, toast, S-21 (404 dan tanpa akses), S-03 versi kerangka (nama, peran, tombol keluar) sebagai tujuan setelah login sampai S-04 dan F-13 ada, `manifest.ts` + service worker minimal, header keamanan dasar (CSP yang menyisakan Next.js, Google Fonts, dan WebSocket Realtime; frame-ancestors none; nosniff).
  - Selesai jika: Teknisi hanya melihat menu Beranda, Tiket, Absensi; membuka `/laporan` sebagai Admin menampilkan "Halaman ini khusus Pemilik."; aplikasi bisa dipasang dari Chrome Android; mematikan jaringan memunculkan pita "Tidak ada koneksi"; header keamanan terkirim (dicek di respons); setelah login membuka S-03 kerangka; lebar 375px tanpa scroll horizontal.

## Fase 2 - Alur Inti (fitur P0)

- [ ] **L-07 Form buat tiket + pelanggan** (est. 3 jam)
  - Rujukan: F-01.1-F-01.5, F-01.10-F-01.12, S-05, AFD F-01, BSD `customers`, `tickets`, `ticket_events`
  - Kerjakan: S-05 dengan template keluhan per jenis perangkat, kelengkapan (draf daftar kelengkapan disetujui Pemilik di pertanyaan pra-langkah), dan kondisi fisik; normalisasi dan validasi nomor WA (F-01.3); saran data pelanggan lama (F-01.4); `client_request_id`; `createTicket` (tanpa DP, password/pola, Express; ditambah di L-08); draf form di browser tanpa password/pola (F-01.12); setelah simpan membuka S-06 sementara (halaman kerangka berisi nomor tiket) yang dilengkapi di L-09.
  - Selesai jika: F-01.1, F-01.3, F-01.4, F-01.5, F-01.10, F-01.11, F-01.12 terpenuhi, dan F-01.2 untuk kelengkapan dan kondisi fisik; tes unit normalisasi nomor WA (08xx 10-13 digit, 628xx 11-14 digit, +628xx, spasi/titik/tanda hubung/kurung diabaikan, nomor non-seluler ditolak) dan nomor NS- tanpa lompatan lolos; menekan Simpan dua kali dengan koneksi diputus lalu disambung hanya membuat satu tiket; draf isian pulih setelah sesi dihabiskan; tiket contoh tersimpan <= 2 menit saat diuji manual.

- [ ] **L-08 DP, Express, password unit** (est. 2,5 jam)
  - Rujukan: F-01.2, F-01.6, F-01.7, BSD `cash_accounts`, `payments`, `cash_entries`, TRD bagian 5 (enkripsi)
  - Kerjakan: DP split ke akun kas (akun kas contoh dari seed dev; akun kas asli diisi Pemilik di L-27 atau L-36); centang Express (estimasi wajib, persetujuan lisan, langsung Pengerjaan); enkripsi AES-256-GCM password/pola + `revealUnlockSecret` dengan audit; fungsi saldo akun kas (saldo awal + mutasi).
  - Selesai jika: F-01.2 (bagian password/pola, DP, Express), F-01.6, F-01.7 terpenuhi; tes unit enkripsi/dekripsi dan saldo (saldo awal + mutasi) lolos; password tidak terbaca di database (kolom berisi ciphertext); pembukaan tercatat di `audit_logs`.

- [ ] **L-09 Daftar tiket + detail tiket** (est. 3 jam)
  - Rujukan: S-04, S-06, F-03.6 (tampilan penanda; aturan di L-11 dan L-41), F-05.4, F-09.8, BSD bagian 5-6 (pagination), DBD Tabel/daftar, Badge
  - Kerjakan: S-04 (25 per halaman, cari nomor/nama/WA, filter tahap/teknisi/"perlu tindakan", badge Express/Link belum dikirim/Perlu ditindaklanjuti, filter "Tiket saya" untuk Teknisi); S-06 tampilan baca dengan aksi per peran (aksi diisi di langkah berikutnya, ubah data di L-37); nomor WA disembunyikan untuk Teknisi.
  - Selesai jika: pencarian "NS-00012", nama, dan "0812..." menemukan tiket yang benar di data contoh; Teknisi tidak melihat nomor WA di S-04/S-06 (dicek di HTML respons); setelah buat tiket S-06 terbuka dengan notifikasi "Tiket NS-xxxxx dibuat."; daftar 30 tiket contoh tampil < 3 detik.

- [ ] **L-37 Ubah data tiket** (est. 2 jam)
  - Rujukan: F-01.9, F-01.3, S-06, S-05, AFD F-01 (nomor sudah dipakai), BSD `tickets`, `customers`, `audit_logs`
  - Kerjakan: form ubah data tiket di S-06 memakai komponen form L-07 (unit, keluhan, kelengkapan, kondisi fisik, password/pola, nama dan nomor WA pelanggan) untuk Admin/Pemilik; `updateTicket`; penolakan nomor yang dipakai pelanggan lain; perubahan tercatat di riwayat perubahan.
  - Selesai jika: F-01.9 terpenuhi; mengubah nomor WA ke nomor pelanggan lain ditolak dengan pesan AFD; tes unit `updateTicket` (izin per peran, tiket tidak bisa dihapus); Teknisi tidak melihat tombol ubah.

- [ ] **L-10 Tahap dan penugasan** (est. 2,5 jam)
  - Rujukan: F-02.1-F-02.3, F-02.9, BSD bagian 4 (`ticket_stage`), `ticket_events`, `notifications` (tiket_ditugaskan)
  - Kerjakan: mesin transisi tahap di `server/services/` (semua transisi BSD bagian 4 termasuk Dibatalkan dan Dikembalikan sebagai kerangka tanpa syarat uang; tes unit tiap transisi sah dan tidak sah per peran), `assignTechnician`, `changeStage` (tanpa form Selesai), tombol tahap di S-06 sesuai peran, notifikasi tiket ditugaskan.
  - Selesai jika: F-02.1, F-02.2, F-02.3, F-02.9 terpenuhi; tes unit transisi lolos (termasuk Teknisi menolak tiket orang lain, Express melompat ke Pengerjaan, transisi tak sah ditolak dengan pesan yang menyebut syarat); riwayat tahap mencatat nama + waktu.

- [ ] **L-40 Catatan, mundur tahap, form Selesai + garansi** (est. 2,5 jam)
  - Rujukan: F-02.4, F-02.5, F-02.7, F-02.8, F-03.5, AFD F-02 (konfirmasi tahap final), BSD `ticket_events`, `tickets` (final_amount, *_warranty_days)
  - Kerjakan: `addNote` (catatan internal), `revertStage` (hanya dari Diagnosa sampai Selesai), form Selesai (biaya final dengan nilai awal = estimasi; garansi jasa dan sparepart dengan nilai awal dari pengaturan, wajib diisi, boleh 0), dialog konfirmasi untuk Diambil, Dibatalkan, dan Dikembalikan, notifikasi "Status diubah ke <tahap>", notifikasi tiket selesai ke Admin dan Pemilik.
  - Selesai jika: F-02.4, F-02.5, F-02.7, F-02.8 (notifikasi) dan F-03.5 terpenuhi; tes unit: mundur ditolak dari Diterima, Diambil, Dibatalkan, Dikembalikan; Selesai ditolak tanpa garansi; biaya final bawaan = estimasi; dialog konfirmasi tahap final muncul sebelum tersimpan.

- [ ] **L-11 Estimasi dan persetujuan** (est. 2,5 jam)
  - Rujukan: F-03.1-F-03.3, F-03.7, BSD `tickets` (estimate_*), BSD bagian 4 (`estimate_decision`), `notifications` (estimasi_siap)
  - Kerjakan: `saveEstimate` (estimasi terkunci setelah Disetujui), `decideEstimate` (Disetujui atau Ditolak, bisa diubah selama Konfirmasi biaya), kunci Pengerjaan sampai Disetujui (kecuali Express), `estimate_decision` empat nilai, notifikasi estimasi siap.
  - Selesai jika: F-03.1, F-03.2, F-03.3, F-03.7 terpenuhi; tes unit: Pengerjaan ditolak sebelum disetujui, Express lolos, estimasi yang sudah Disetujui tidak bisa diubah, keputusan bisa diubah selama Konfirmasi biaya.

- [ ] **L-41 Pembatalan, estimasi ditolak, pengembalian, Dikembalikan** (est. 2,5 jam)
  - Rujukan: F-02.6, F-02.10, F-03.4, F-03.6, F-07.7, BSD bagian 4, `tickets` (check_fee, cancel_reason, returned_at), `payments` (refund), `notifications` (estimasi_ditolak)
  - Kerjakan: Dibatalkan (Admin/Pemilik, dari Diterima sampai Selesai; alasan + biaya cek, password/pola dihapus); alur Ditolak (Teknisi menandai -> notifikasi ke semua Admin dan Pemilik; Admin/Pemilik menandai -> dialog Batalkan); penanda "Perlu ditindaklanjuti" (Konfirmasi biaya > 2 hari, Ditolak belum dibatalkan); fungsi tagihan/dibayar/sisa/kelebihan di `server/services/money.ts` (dilengkapi tes di L-18); `recordRefund` (kelebihan bayar, cek saldo); tahap Dikembalikan (Admin/Pemilik, dari Dibatalkan; kunci uang dilengkapi di L-39).
  - Selesai jika: F-02.6, F-02.10 (tanpa kunci uang yang dilengkapi L-39), F-03.4, F-03.6, F-07.7 terpenuhi; tes unit: pengembalian maksimal = kelebihan, pengembalian melebihi saldo ditolak, Ditolak oleh Teknisi tidak membatalkan tiket tetapi membuat notifikasi untuk semua Admin dan Pemilik, Dikembalikan hanya dari Dibatalkan, password/pola terhapus saat Dibatalkan.

- [ ] **L-12 Tracking: data dan aturan** (est. 2,5 jam)
  - Rujukan: F-04.1-F-04.4, F-04.7, F-04.8, S-07, AFD F-04, BSD `tickets`, `ticket_events`
  - Kerjakan: rute `/lacak/[kode]` (host `lacak.`) dengan query terbatas pada kolom F-04.2; samaran nama; riwayat tahap; garansi (jumlah hari sebelum Diambil, tanggal berakhir sesudahnya, "Tanpa garansi"); aturan masa aktif (Diambil, Dibatalkan, Dikembalikan); halaman link tidak aktif + tombol chat WA; tampilan sementara sederhana (dunia nota di L-38).
  - Selesai jika: F-04.1, F-04.2 (data), F-04.3, F-04.4, F-04.7, F-04.8 terpenuhi; tes unit samaran nama ("Citra Lestari" -> "Ci*** L.", satu kata, nama sangat pendek) dan masa aktif link (garansi 0, garansi 30 dan 90 hari contoh, Dibatalkan, Dikembalikan); HTML tracking tidak berisi nomor WA, catatan, diagnosa, estimasi, biaya, atau pembayaran.

- [ ] **L-38 Tracking: tampilan nota dan performa** (est. 2,5 jam)
  - Rujukan: F-04.2 (tampilan), F-04.6, S-07, DBD Nota tracking + token tracking, DESIGN.md, `.impeccable/surfaces/lacak.md`
  - Kerjakan: tampilan dunia nota di S-07 (impeccable): kepala nota, riwayat tahap sebagai langkah, garansi, kartu kontak + rute, teks pemberitahuan privasi (jika diisi), halaman link tidak aktif; optimasi font dan ukuran agar LCP < 2 detik.
  - Selesai jika: F-04.2 (tampilan) dan F-04.6 terpenuhi; Lighthouse mobile (throttling 4G) mencatat LCP < 2 detik; kontras halaman sesuai DBD (dicek); tampil benar di 375px, 768px, 1280px.

- [ ] **L-13 Kabar status ke WA** (est. 2 jam)
  - Rujukan: F-05.1-F-05.6, F-01.8, F-02.8, BSD `wa_messages`, `settings` (wa_template_*)
  - Kerjakan: draf 3 template WA disetujui Pemilik (pertanyaan pra-langkah, tanpa fakta karangan); tombol Diterima/Selesai/Diambil untuk Admin/Pemilik (termasuk tombol kirim link tracking di S-06 setelah tiket dibuat), `recordWaMessage`, link `wa.me` ter-encode, tombol Salin pesan, sembunyikan Minta ulasan bila link ulasan kosong.
  - Selesai jika: F-05.1-F-05.6 dan F-01.8 terpenuhi, dan F-02.8 untuk tombol WA setelah Selesai dan Diambil; tes unit pembentuk URL wa.me (spasi, baris baru, karakter &); penanda "Link belum dikirim" hilang setelah tombol ditekan; Teknisi tidak melihat tombol atau nomor WA; diuji sekali ke nomor WA milik Pemilik.

- [ ] **L-14 Realtime tiket dan tracking** (est. 3 jam)
  - Rujukan: F-04.5, AFD bagian 5 (Realtime), TRD bagian 2 dan 9, BSD bagian 6 (channel, kebijakan RLS) dan 7
  - Kerjakan: `server/realtime.ts` (kirim sinyal lewat REST Broadcast dengan secret key setelah transaksi berhasil, best-effort); migrasi kebijakan Realtime (fungsi `public.is_active_staff()`, policy SELECT untuk `staff`, tanpa policy kirim); langganan privat di S-04 dan S-06 (S-03 di L-30) dan langganan publik di S-07; ambil ulang data via server; pemuatan ulang digabung (staf 2 detik, tracking 3 detik); payload hanya ID.
  - Selesai jika: F-04.5 terpenuhi; dua browser terbuka, perubahan tahap di satu browser terlihat di S-04/S-06 browser lain dan di S-07 dalam <= 5 detik; payload yang terekam hanya berisi UUID atau tanda berubah; klien tanpa login tidak bisa join `staff`; pesan palsu yang dikirim klien tanpa login ke topik `staff` tidak memicu muat ulang di layar staf; staf yang dinonaktifkan tidak bisa join ulang `staff`; migrasi tidak memuat `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY`.

- [ ] **L-15 Notifikasi lonceng** (est. 2 jam)
  - Rujukan: S-20, AFD bagian 5 (notifikasi), BSD `notifications`
  - Kerjakan: angka di lonceng, S-20, tandai dibaca saat dibuka, buka tiket terkait; kejadian tiket_ditugaskan, estimasi_siap, estimasi_ditolak, tiket_selesai (minta_izin_ambil di L-39).
  - Selesai jika: tiap kejadian membuat notifikasi ke penerima yang benar sesuai AFD bagian 5 (tes unit penerima); angka lonceng berkurang setelah dibuka.

- [ ] **L-16 Tes E2E alur P0** (est. 2,5 jam)
  - Rujukan: PRD bagian 5 (F-01-F-05), TRD bagian 7 (E2E)
  - Kerjakan: skenario Playwright alur P0 lengkap (TRD bagian 7) di database tes, plus skenario Teknisi ditolak mengubah tiket orang lain, link tracking tidak aktif, dan alur batal (Ditolak -> Dibatalkan -> Dikembalikan). Skenario diperbarui di L-39 saat kunci pelunasan aktif.
  - Selesai jika: `npm run test:e2e` lolos 3 kali berturut-turut; `npm test`, `npm run lint`, `npm run build` lolos.

## Fase 3 - Fitur Pendukung (P1)

- [ ] **L-17 Cetak tanda terima** (est. 3 jam)
  - Rujukan: F-06.1-F-06.5, S-08, DBD Layout cetak thermal, BSD `settings` (printer_width, receipt_terms, privacy_notice)
  - Kerjakan: tanyakan ukuran printer yang dipakai; S-08 untuk 58 dan 80 mm dengan logo hitam-putih, QR, S&K dan teks pemberitahuan privasi (kosong jika belum diisi); tombol cetak/cetak ulang di S-06; uji di laptop (USB) dan HP Android (RawBT). Klaim "semua gratis" untuk RawBT belum diverifikasi (audit S9 ditunda): catat hasil uji di Catatan.
  - Selesai jika: F-06.1-F-06.5 terpenuhi; tanda terima tercetak rapi di printer asli dari laptop dan dari Android (hasil dicek langsung oleh Pemilik; printer, ukuran, dan hasil OK atau tidak dicatat di Catatan); QR terbaca kamera HP dan membuka S-07.

- [ ] **L-18 Pembayaran: tagihan, sisa, split, diskon** (est. 3 jam)
  - Rujukan: F-07.1-F-07.4, F-07.6, F-07.7, F-07.9, AFD F-07, BSD `payments`, `cash_entries`, `tickets` (final_amount, discount_amount, check_fee)
  - Kerjakan: `recordPayment` (jenis dp atau pelunasan mengikuti tahap, split), diskon (mulai Selesai, <= biaya final), `voidPayment`, melengkapi `server/services/money.ts` (tagihan, dibayar, sisa, lunas) dan tampilannya di S-06, tombol "Kembalikan kelebihan" untuk kelebihan bayar (memakai `recordRefund` dari L-41).
  - Selesai jika: F-07.1-F-07.4, F-07.6, F-07.9 terpenuhi, dan F-07.7 untuk kelebihan setelah diskon atau biaya final lebih kecil dari DP; tes unit tagihan/dibayar/sisa/lunas (sebelum Selesai tanpa tagihan; DP tanpa patokan; dengan diskon; kelebihan; pembatalan pembayaran; tiket Dibatalkan) lolos; pembayaran melebihi sisa ditolak.

- [ ] **L-39 Kunci serah unit + izin Pemilik** (est. 2 jam)
  - Rujukan: F-07.5, F-02.10 (kunci uang), AFD F-07 (diagram kunci), BSD `tickets` (pickup_override_*), `notifications` (minta_izin_ambil)
  - Kerjakan: kunci tahap Diambil dan Dikembalikan selama sisa tidak nol; `requestPickupOverride` dan `approvePickupOverride` (khusus kurang bayar; kelebihan bayar tanpa pengecualian) + notifikasi ke Pemilik; perbarui skenario E2E L-16 agar membayar sebelum Diambil.
  - Selesai jika: F-07.5 terpenuhi; Diambil dan Dikembalikan ditolak saat kurang bayar atau kelebihan bayar, dan lolos setelah lunas atau (kurang bayar saja) izin Pemilik; notifikasi minta izin sampai ke Pemilik; `npm run test:e2e` lolos dengan skenario yang diperbarui.

- [ ] **L-19 Nota pelunasan** (est. 2 jam)
  - Rujukan: F-07.8, S-09, DBD Layout cetak thermal
  - Kerjakan: S-09 untuk nota pembayaran tiket (58/80 mm) sesuai isi F-07.8 dan tombol kirim ringkasan nota lewat wa.me.
  - Selesai jika: F-07.8 terpenuhi; nota tercetak di printer asli; teks WA nota memuat nomor tiket, total, dibayar, sisa.

- [ ] **L-20 Kas: pengeluaran, pindah saldo, koreksi saldo** (est. 3 jam)
  - Rujukan: F-11.1-F-11.7, S-15, BSD `expenses`, `cash_transfers`, `cash_entries`, `cash_accounts`
  - Kerjakan: migrasi L-20; S-15 (mutasi per hari per akun, saldo), `createExpense`, `createTransfer`, pembatalan, `adjustCashBalance` (Pemilik, alasan wajib), kunci saldo awal setelah akun punya mutasi; cek saldo dengan kunci baris.
  - Selesai jika: F-11.1-F-11.7 terpenuhi; tes unit saldo dan penolakan saldo kurang lolos (termasuk koreksi negatif yang membuat saldo minus ditolak); dua pengeluaran bersamaan yang total melebihi saldo hanya satu yang berhasil; saldo awal tidak bisa diubah setelah ada mutasi.

- [ ] **L-21 Stok sparepart** (est. 3 jam)
  - Rujukan: F-09.1, F-09.2, F-09.6, F-09.7, S-12, S-13, BSD `parts`, `stock_movements`
  - Kerjakan: migrasi L-21; S-12 (daftar, stok menipis), S-13 (detail, riwayat), tambah barang, barang masuk (harga modal rata-rata, uang keluar), koreksi stok dengan alasan.
  - Selesai jika: F-09.1, F-09.2, F-09.6, F-09.7 terpenuhi; tes unit harga modal rata-rata dan stok tidak minus lolos; Teknisi tidak bisa membuka S-12.

- [ ] **L-22 Sparepart di tiket + beli dadakan** (est. 2,5 jam)
  - Rujukan: F-09.3-F-09.5, F-09.8, F-09.9, S-06, S-04, S-03, BSD `ticket_parts`, `ticket_extra_costs`
  - Kerjakan: migrasi L-22; pakai sparepart (di S-06 dan dialog cepat "Tambah sparepart" di baris S-04), kembalikan (selama tiket belum Diambil atau Dikembalikan), beli dadakan (akun kas), modal/profit tiket khusus Pemilik. Dialog cepat di daftar tiket Teknisi pada S-03 ditambahkan di L-30.
  - Selesai jika: F-09.3-F-09.5, F-09.8 terpenuhi; F-09.9 terpenuhi untuk S-04 (sparepart tersimpan tanpa membuka S-06); tes unit modal tiket (stok + beli dadakan, pengembalian) lolos; respons S-06 untuk Admin/Teknisi tidak memuat angka modal.

- [ ] **L-23 Jual barang langsung** (est. 3 jam)
  - Rujukan: F-17.1-F-17.3, S-14, S-09, BSD `sales`, `sale_items`, `payments.sale_id`
  - Kerjakan: migrasi L-23; S-14, `createSale` (nomor JL-, diskon, split, pelanggan dari WA pembeli bila diisi), `voidSale`, nota JL di S-09 sesuai isi F-17.1 + WA.
  - Selesai jika: F-17.1-F-17.3 terpenuhi; tes unit stok dan saldo setelah jual dan batal lolos; nomor JL- urut tanpa lompatan; WA pembeli diisi tanpa nama ditolak.

- [ ] **L-24 Kelola akun staf + jadwal kerja** (est. 3 jam)
  - Rujukan: F-08.1-F-08.7, S-18, BSD `profiles`, `work_schedules`
  - Kerjakan: migrasi L-24; S-18 (tambah lewat Auth Admin API + `profiles`, ubah peran, jadwal Senin-Minggu, nonaktifkan: `is_active = false` + ban Supabase, aktifkan kembali, reset password sementara, perlindungan akun Pemilik sendiri dan minimal satu Pemilik aktif).
  - Selesai jika: F-08.1-F-08.7 terpenuhi; staf yang dinonaktifkan ditolak pada permintaan berikutnya di browser yang sedang login; tes E2E tambah staf -> login -> wajib ganti password lolos; menonaktifkan atau mengubah peran akun Pemilik sendiri ditolak; akun Auth dihapus kembali bila pembuatan `profiles` gagal (tes); akun yang dinonaktifkan tidak bisa menyegarkan sesi (diuji).

- [ ] **L-25 Absensi GPS** (est. 3 jam)
  - Rujukan: F-10.1-F-10.4, F-10.6 (bagian staf), F-10.7, S-16, S-03 (tombol absen Teknisi), BSD `attendances`
  - Kerjakan: migrasi L-25; tombol Masuk/Pulang, hitung jarak di server lalu buang koordinat, tolak di luar 100 m, tanda terlambat dari jadwal + toleransi, riwayat sendiri bulan ini.
  - Selesai jika: F-10.1-F-10.4, F-10.7 terpenuhi (absen di luar 100 m ditolak dengan pesan AFD; izin lokasi ditolak tetap tersimpan dengan tanda); tes unit jarak (Haversine), radius, dan terlambat lolos; tabel `attendances` tidak memuat koordinat; diuji di HP Android dan iPhone di workshop.

- [ ] **L-26 Rekap absensi Pemilik** (est. 2 jam)
  - Rujukan: F-10.5, F-10.6, S-16
  - Kerjakan: rekap per staf per bulan (hadir, terlambat, tanpa jam pulang, total jam), isi jam pulang, catat manual dengan alasan.
  - Selesai jika: F-10.5, F-10.6 terpenuhi; koreksi tercatat di `audit_logs`; Admin/Teknisi tidak bisa membuka rekap staf lain.

- [ ] **L-27 Pengaturan** (est. 3 jam)
  - Rujukan: F-16.1-F-16.3, F-11.3, S-19, BSD `settings`, `cash_accounts`
  - Kerjakan: S-19 per bagian (template keluhan/kelengkapan/WA, S&K dan teks pemberitahuan privasi, link ulasan, printer, akun kas + saldo awal yang terkunci setelah ada mutasi, garansi awal, titik lokasi "pakai lokasi saya sekarang", toleransi terlambat).
  - Selesai jika: F-16.1-F-16.3 terpenuhi; saldo awal tidak bisa diubah setelah akun punya mutasi (F-11.3); mengubah template keluhan langsung tampil di S-05; perubahan tercatat di `audit_logs` (termasuk kunci pengaturan berupa teks).

- [ ] **L-28 Data pelanggan + riwayat** (est. 2 jam)
  - Rujukan: F-14.1, F-14.2, S-10, S-11, BSD `customers`
  - Kerjakan: S-10 (cari), S-11 (riwayat tiket), samarkan pelanggan oleh Pemilik (nomor diganti `anon-<uuid>`).
  - Selesai jika: F-14.1, F-14.2 terpenuhi; setelah disamarkan, nama dan nomor lama tidak ditemukan lewat pencarian dan laporan bulan itu tidak berubah.

- [ ] **L-29 Klaim garansi** (est. 2 jam)
  - Rujukan: F-15.1-F-15.3, S-06, S-05, BSD `tickets` (warranty_claim_*)
  - Kerjakan: tombol Klaim garansi, prefill S-05, tautan dua arah di S-06, cek masa garansi per jenis, tiket klaim dengan estimasi Rp0 yang langsung Disetujui.
  - Selesai jika: F-15.1, F-15.2, F-15.3 terpenuhi; tes unit berakhirnya garansi jasa vs sparepart lolos; tiket klaim bisa langsung ke Pengerjaan tanpa persetujuan manual.

- [ ] **L-30 Beranda per peran** (est. 3 jam)
  - Rujukan: F-13.1-F-13.4, F-09.9, S-03, AFD bagian 5 (redirect), DBD Card
  - Kerjakan: S-03 untuk Pemilik, Admin, Teknisi (daftar tiket Teknisi dengan dialog "Tambah sparepart"); kartu perlu tindakan membuka S-04 terfilter (termasuk estimasi Ditolak belum dibatalkan dan Dibatalkan belum Dikembalikan); langganan realtime `dashboard_changed`; redirect pasca login ke S-03.
  - Selesai jika: F-13.1-F-13.4 terpenuhi; F-09.9 terpenuhi di S-03 Teknisi; angka kartu sama dengan hitungan manual di data contoh; respons beranda Admin tidak memuat modal/profit.

- [ ] **L-31 Laporan bulanan: aturan hitung** (est. 2,5 jam)
  - Rujukan: F-12.1-F-12.3, BSD `tickets`, `ticket_parts`, `ticket_extra_costs`, `sales`, `sale_items`, `expenses`
  - Kerjakan: `getMonthlyReport` di `server/services/` (omzet, biaya barang, pengeluaran, profit, tiket per status, per jenis perangkat, kinerja teknisi) dengan dasar bulan F-12.2.
  - Selesai jika: F-12.1, F-12.2, F-12.3 terpenuhi; tes unit laporan dengan data terkontrol cocok dengan hitungan tangan (tiket Diambil; tiket Dibatalkan dengan sparepart yang dikembalikan dan yang tidak; beli dadakan dibatalkan; penjualan langsung dengan modal barang terjual; DP bulan lalu; pembayaran yang dibatalkan tidak memengaruhi omzet).

- [ ] **L-42 Laporan bulanan: tampilan** (est. 2 jam)
  - Rujukan: F-12.4, F-12.5, S-17, DBD Card
  - Kerjakan: S-17 (pilih bulan, angka + selisih dari bulan lalu, kinerja teknisi, bulan kosong), akses khusus Pemilik.
  - Selesai jika: F-12.4, F-12.5 terpenuhi; Admin dan Teknisi yang membuka `/laporan` melihat S-21; angka di layar sama dengan hasil tes L-31.

## Fase 4 - Polesan & Rilis

- [ ] **L-32 Backup mingguan + reset password Pemilik** (est. 2 jam)
  - Rujukan: TRD bagian 5-7, 9, BSD bagian 8
  - Kerjakan: `.github/workflows/db-backup.yml` (pg_dump terenkripsi, artifact 60 hari), `scripts/reset-owner-password.ts` (Auth Admin API), `dashboard/scripts/README.md` (cara pulihkan dan reset). Bila koneksi langsung tidak tersambung dari GitHub Actions (IPv6), pakai session pooler dan catat (audit S1 ditunda).
  - Selesai jika: workflow dijalankan manual dan menghasilkan artifact; backup itu berhasil dipulihkan ke proyek Supabase tes; reset password Pemilik berjalan di database tes.

- [ ] **L-33 State kosong/loading/error semua layar** (est. 2,5 jam)
  - Rujukan: AFD bagian 4
  - Selesai jika: setiap baris AFD bagian 4 dicoba manual (database kosong, jaringan lambat, jaringan mati) dan tampil sesuai tabel.

- [ ] **L-34 Aksesibilitas, responsivitas, perangkat** (est. 3 jam)
  - Rujukan: DBD bagian 2 (kontras), DBD bagian 4, DBD bagian 5, TRD bagian 9 (Safari)
  - Kerjakan: audit keyboard dan pembaca layar, kontras token, finish review impeccable; uji di laptop Windows, HP Android, iPhone, tablet; cek teks dashboard tidak memuat "kamu", "Anda", atau "-mu" (hanya S-07 boleh "kamu").
  - Selesai jika: semua layar dicek di lebar 375px, 768px, dan 1280px tanpa scroll horizontal; semua aksi bisa dicapai dengan keyboard dan fokus terlihat; skor aksesibilitas Lighthouse >= 95 di S-04, S-05, S-06, S-07; pemasangan PWA dan absen GPS berhasil di iPhone dan Android; pencarian teks sapaan di layar dashboard kosong.

- [ ] **L-35 Tes menyeluruh & perbaikan bug** (est. 3 jam)
  - Rujukan: PRD bagian 5 (semua kriteria F-01-F-17)
  - Selesai jika: semua kriteria PRD bagian 5 dicentang dengan bukti (tes atau langkah manual); `npm test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`, `npm run build` lolos.

- [ ] **L-36 Rilis & peralihan dari FixMaster** (est. 2,5 jam)
  - Rujukan: TRD bagian 6, PRD bagian 3, BSD bagian 7
  - Kerjakan: buat proyek Supabase produksi (region Singapura; Data API mati, pengaturan Auth sama seperti L-02), jalankan migrasi dan `db:seed:prod`, alihkan env production Vercel ke proyek produksi; tanyakan ke Pemilik daftar akun staf final (nama, username, peran) dan buat lewat Auth Admin API; Pemilik mengisi Pengaturan (akun kas + saldo awal, garansi awal, S&K, teks pemberitahuan privasi, link ulasan, titik lokasi, toleransi, printer); uji satu tiket nyata dari buat sampai Diambil; tentukan hari mulai bersama Pemilik; catat tanggal untuk target berhenti FixMaster (<= 1 bulan).
  - Selesai jika: satu tiket nyata melewati semua tahap di production, tanda terima tercetak, link tracking diterima di WA pelanggan uji; proyek Supabase produksi tidak memuat data contoh; app.nuaraservice.my.id memakai proyek produksi; tanggal mulai dan tanggal target berhenti FixMaster tercatat di Catatan.

## Definition of Done (berlaku untuk tiap langkah)
- Sesuai spesifikasi di dokumen yang dirujuk
- Tes relevan ditulis dan lolos; lint & build lolos; tidak ada tes yang dilemahkan, dilewati, atau dihapus agar lolos
- Tidak ada secret di kode; tidak ada log debug tertinggal; tidak ada data pribadi di log atau payload Realtime
- Landing page di root tidak berubah (kecuali `.vercelignore` di L-01)
- Teks UI tanpa em dash dan tanpa fakta bisnis karangan; teks dashboard netral tanpa sapaan (hanya S-07 memakai "kamu"); teks pesan persis dari AFD
- Otorisasi dicek di setiap Server Action, bukan hanya di proxy
- Dokumen diperbarui bila ada keputusan yang mengubah spesifikasi

## Risiko Jadwal & Eksekusi
| Risiko | Dampak | Mitigasi |
|---|---|---|
| Langkah L-02 butuh akun dan DNS milik Pemilik | Fondasi tertunda | Dipandu langkah demi langkah; propagasi DNS ditunggu sambil mengerjakan L-03 di database tes |
| Printer thermal/RawBT tidak cocok | L-17, L-19 molor | Uji printer asli di awal L-17; cadangan cetak dari laptop |
| Banyak fitur P1 (12) sebelum rilis | Peralihan dari FixMaster mundur | Target berhenti FixMaster dihitung dari rilis (PRD bagian 3); urutan P1 bisa diubah lewat `/vibe-docs update` |
| Versi library atau nama kunci Supabase berubah dari dokumen | Langkah awal molor | Versi dicek dan dicatat di L-01 dan L-02 |
| Realtime privat dan pengiriman REST berperilaku beda dari dugaan | L-14 molor | Uji dua browser dan klien tanpa login di L-14; payload hanya ID sehingga mudah diganti (mis. polling) |
| Koneksi langsung Supabase (IPv6) gagal saat L-03 atau L-32 (audit S1 ditunda) | Migrasi atau backup tertunda | Pakai session pooler; dicatat di Catatan |
| Email sintetis ditolak Supabase di L-04 | Auth tertunda | Ganti domain sintetis sebelum akun produksi dibuat; dicek di proyek tes |

## Catatan & Utang Teknis
<!-- Satu baris per catatan, terbaru di bawah: YYYY-MM-DD - L-xx - catatan/keputusan -->
- 2026-11-02 - (perencanaan) - Dokumen dibuat dari wawancara vibe-docs (188 pertanyaan). Rencana Pemilik setelah rilis: pindah ke Supabase self-host (Docker) di VPS; di luar scope versi ini.
- 2026-11-04 - (audit) - Keputusan Pemilik: Better Auth diganti Supabase Auth (T1); tetap Vercel Hobby (T2); tiket Dibatalkan dilanjutkan ke Dikembalikan (T3); S2-S8, S10, S11 diperbaiki; R1-R23 dikerjakan. Langkah baru: L-37 (F-01.9) serta L-38, L-39, L-40, L-41, L-42 (hasil memecah L-12, L-18, L-10, L-11, L-31 yang terlalu padat).
- 2026-11-04 - (audit S1) - Ditunda atas permintaan Pemilik: koneksi langsung Supabase hanya IPv6, sehingga tidak bisa dipakai dari GitHub Actions dan bisa gagal dari jaringan tanpa IPv6. Dicek saat L-03 dan L-32; session pooler sebagai cadangan.
- 2026-11-04 - (audit S9) - Ditunda atas permintaan Pemilik: klaim "semua gratis" untuk RawBT belum diverifikasi (versi gratis dilaporkan menambah catatan di hasil cetak). Diuji dengan printer asli di L-17.
- 2026-11-04 - (audit T2) - Vercel Hobby dipertahankan oleh Pemilik walau ketentuan Vercel membatasi Hobby untuk pemakaian non-komersial (https://vercel.com/docs/limits/fair-use-guidelines). Risiko: akun atau proyek bisa dijeda atau ditutup; pantau email dari Vercel; rencana pindah VPS.
- 2026-11-04 - (audit S6) - Proyek Supabase produksi baru dibuat di L-36; sebelum itu app.nuaraservice.my.id memakai proyek tes (staging) supaya proyek produksi tidak menganggur dan dijeda.
