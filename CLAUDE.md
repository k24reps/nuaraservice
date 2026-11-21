# Nuara Service landing page

Fakta bisnis hanya boleh berasal dari pemilik. Jangan menambah harga, durasi garansi, jam buka, testimoni, atau angka lain yang belum dikonfirmasi pemilik.

Situs ada di root proyek (index.html, style.css, script.js, assets/) dan di-deploy ke Vercel dari GitHub. Desain visual memakai skill `impeccable` (PRODUCT.md, DESIGN.md, surface brief di `.impeccable/surfaces/`). Dari antislop, pakai hanya skill non-UI: core (fakta dan kejujuran), `antislop-copywriting`, `antislop-human`, `antislop-layoutmobile`, `antislop-code`. Jangan pakai `antislop-ui`; urusan visual milik impeccable.

<!-- antislop:start -->
## antislop
Diterapkan permanen di proyek ini, mode DURING (selama proses, bukan audit belakangan).
Untuk kerja UI, copy, aksesibilitas, layout mobile, atau komentar kode, muat skill `antislop` (core) lalu skill sesuai tugas:
- UI / visual: impeccable (`antislop-ui` tidak dipakai di proyek ini)
- Copy & teks: `antislop-copywriting`
- Aksesibilitas: `antislop-human`
- Mobile / responsive: `antislop-layoutmobile`
- Komentar kode: `antislop-code`
Jalankan Delivery Gate sebelum menyerahkan hasil.
<!-- antislop:end -->

# Nuara Dashboard (folder `dashboard/`)

Aplikasi web internal yang menggantikan FixMaster: tiket servis, tracking pelanggan, kabar WA, kas, stok, absensi, dan laporan untuk Pemilik, Admin konter, dan Teknisi Nuara Service. Landing page di root tetap terpisah.

Sejak 2026-11-21 (wawancara P13) kodenya adalah salinan FixMaster (Vite + React + Supabase) yang bagian SaaS-nya dibuang. UI dipindah bertahap ke dens-ui dengan warna Nuara. Aturan kode, verifikasi, dan probe UI ada di `dashboard/AGENTS.md`.

## Dokumen Proyek (sumber kebenaran)
Baca sebelum bekerja. Jangan menebak jika dokumen tidak menjelaskan; tanyakan lewat pertanyaan pilihan (`AskUserQuestion`) dengan opsi rekomendasi di urutan pertama.

| Dokumen | Isi | Baca saat |
|---|---|---|
| `docs/PRD.md` | Product Requirements: fitur (F-xx), kriteria (F-xx.n), peran, istilah, scope | Selalu |
| `docs/IPD.md` | Implementation Plan: langkah (L-xx) + status, Daftar Selisih PRD vs FixMaster (G-xx) | Menentukan tugas berikutnya |
| `docs/TRD.md` | Technical Requirements: stack, struktur folder, env, perintah | Menulis kode apa pun |
| `dashboard/AGENTS.md` | Konvensi kode, verifikasi, probe UI, vault teknis | Menulis kode apa pun |
| `docs/AFD.md` | App Flow: layar target (S-xx), alur, teks pesan | Mengerjakan UI/alur |
| `docs/DBD.md` | Design & Brand: token warna Nuara, font, komponen (bukan database) | Mengerjakan UI |
| `docs/BSD.md` | Rancangan skema awal; skema yang berlaku = `dashboard/supabase/migrations/` | Menyusun selisih aturan bisnis |
| `docs/_wawancara.md` | Log wawancara: jawaban user di balik setiap keputusan | Ragu kenapa sesuatu diputuskan |

## Cara Bekerja
1. Pekerjaan dari rencana: satu langkah IPD per permintaan. Lanjutkan langkah `[~]` jika ada; jika tidak, ambil `[ ]` teratas. Sebelum menulis kode, tanyakan dulu keputusan kecil yang tidak diatur dokumen (teks, urutan field, kasus tepi) dan konfirmasi rencana langkahnya.
2. Permintaan langsung dari user di luar IPD (bugfix kecil, pertanyaan, penyesuaian kecil) boleh dikerjakan; catat di "Catatan & Utang Teknis" IPD jika mengubah perilaku aplikasi. Fitur baru atau perubahan scope lewat `/vibe-docs update`.
3. Jangan menambah fitur, library, atau refactor di luar langkah aktif, dan jangan kerjakan apa pun yang tercantum di "Di Luar Scope" PRD. Catat idenya di IPD.
4. Nama tabel, kolom, dan rute mengikuti kode dan migrasi yang ada (`services`, `memberships`, `/services`), bukan BSD. Istilah yang tampil di layar mengikuti PRD bagian 4 hanya bila langkah IPD memintanya; selisih istilah masuk Daftar Selisih.
5. Jika perlu mengubah spesifikasi, ubah dokumennya juga dan sebutkan perubahannya ke user.
6. Sebelum menyatakan selesai: jalankan Test, Lint, dan Build di bawah, lalu cek "Selesai jika". Laporkan hasil apa adanya. Jangan melemahkan, melewati, atau menghapus tes agar lolos.
7. Centang `[x]` di IPD hanya setelah terbukti lolos.
8. Setelah langkah lolos, tawarkan commit dengan pesan `L-xx: <ringkasan>`; jangan commit tanpa persetujuan user.
9. Jangan mengubah landing page di root (index.html, style.css, script.js, assets/) saat mengerjakan dashboard. Jangan commit secret; pakai environment variable (`dashboard/.env.example` sebagai daftar). Jangan hapus atau timpa data/migrasi yang sudah ada tanpa konfirmasi; migrasi baru selalu nomor berikutnya.
10. Data pribadi pelanggan (nomor WA, password/pola unit) tidak boleh masuk log atau URL. Uang selalu integer rupiah; data uang dan stok tidak diedit atau dihapus, hanya dibatalkan.
11. Pemilik bisa sedikit coding: penjelasan ringkas, istilah teknis umum boleh dipakai tanpa penjelasan dasar.
12. Teks pesan yang tampil di layar ditulis di AFD (bagian 3-5) lebih dulu; PRD dan dokumen lain merujuknya. Teks dashboard baru memakai kalimat netral tanpa sapaan (tanpa "kamu", "Anda", "-mu"); hanya halaman tracking menyapa "kamu". Teks FixMaster lama yang menyapa "Anda" adalah selisih G-07, bukan untuk diubah sambil lalu.
13. Akses data ditegakkan RLS dan RPC di Postgres (TRD 5), bukan hanya disembunyikan di UI. Kunci `service_role` tidak pernah masuk kode browser. Migrasi dan tes integrasi hanya ke proyek Supabase milik Nuara, tidak pernah ke proyek FixMaster.

## Perintah
<!-- Salinan TRD bagian 7. Ubah keduanya bersamaan. Semua perintah dijalankan dari folder dashboard/. -->
| Tujuan | Perintah |
|---|---|
| Dev | `npm run dev` |
| Test | `npm run test` (unit, Vitest, offline) dan `npm run test:integration` (RLS/RPC ke staging Supabase Nuara) |
| Lint | `npm run lint` |
| Typecheck | `npm run type-check` |
| Build | `npm run build` |
| Migrasi DB | `supabase db push` (setelah `supabase link` ke proyek Nuara) |
| Probe UI | `BASE_URL=http://localhost:5173 node scripts/audit-mobile.mjs` dan `scripts/audit-zoom.mjs` (dev server jalan; di container cloud tambah `PW_CHROMIUM=/opt/pw-browsers/chromium`) |
| Katalog komponen | `npm run dev`, buka `/dev/komponen` |
| Ikon | `npm run brand:render` (butuh ImageMagick) |

## Perintah vibe-docs
- `/vibe-docs build` atau "lanjut": kerjakan langkah IPD berikutnya
- `/vibe-docs update`: ubah kebutuhan dan sinkronkan semua dokumen
- `/vibe-docs check`: cek konsistensi dokumen tanpa mengubah file
