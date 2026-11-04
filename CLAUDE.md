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

## Dokumen Proyek (sumber kebenaran)
Baca sebelum bekerja. Jangan menebak jika dokumen tidak menjelaskan; tanyakan lewat pertanyaan pilihan (`AskUserQuestion`) dengan opsi rekomendasi di urutan pertama.

| Dokumen | Isi | Baca saat |
|---|---|---|
| `docs/PRD.md` | Product Requirements: fitur (F-xx), kriteria (F-xx.n), peran, istilah, scope | Selalu |
| `docs/TRD.md` | Technical Requirements: stack, struktur folder, konvensi, env, perintah | Menulis kode apa pun |
| `docs/AFD.md` | App Flow: layar (S-xx), alur pengguna, state layar | Mengerjakan UI/alur |
| `docs/DBD.md` | Design & Brand: warna, font, komponen, aksesibilitas (bukan database) | Mengerjakan UI |
| `docs/BSD.md` | Backend & Schema: tabel, aturan akses, API | Menyentuh data/API |
| `docs/IPD.md` | Implementation Plan: langkah (L-xx) + status | Menentukan tugas berikutnya |
| `docs/_wawancara.md` | Log wawancara: jawaban user di balik setiap keputusan | Ragu kenapa sesuatu diputuskan |

## Cara Bekerja
1. Pekerjaan dari rencana: satu langkah IPD per permintaan. Lanjutkan langkah `[~]` jika ada; jika tidak, ambil `[ ]` teratas. Sebelum menulis kode, tanyakan dulu keputusan kecil yang tidak diatur dokumen (teks, urutan field, kasus tepi) dan konfirmasi rencana langkahnya.
2. Permintaan langsung dari user di luar IPD (bugfix kecil, pertanyaan, penyesuaian kecil) boleh dikerjakan; catat di "Catatan & Utang Teknis" IPD jika mengubah perilaku aplikasi. Fitur baru atau perubahan scope lewat `/vibe-docs update`.
3. Jangan menambah fitur, library, atau refactor di luar langkah aktif, dan jangan kerjakan apa pun yang tercantum di "Di Luar Scope" PRD. Catat idenya di IPD.
4. Gunakan nama tabel, kolom, ID, rute, dan istilah persis seperti di dokumen.
5. Jika perlu mengubah spesifikasi, ubah dokumennya juga dan sebutkan perubahannya ke user.
6. Sebelum menyatakan selesai: jalankan Test, Lint, dan Build di bawah, lalu cek "Selesai jika". Laporkan hasil apa adanya. Jangan melemahkan, melewati, atau menghapus tes agar lolos.
7. Centang `[x]` di IPD hanya setelah terbukti lolos.
8. Setelah langkah lolos, tawarkan commit dengan pesan `L-xx: <ringkasan>`; jangan commit tanpa persetujuan user.
9. Jangan mengubah landing page di root (index.html, style.css, script.js, assets/) saat mengerjakan dashboard. Jangan commit secret; pakai environment variable (`dashboard/.env.example` sebagai daftar). Jangan hapus atau timpa data/migrasi yang sudah ada tanpa konfirmasi.
10. Data pribadi pelanggan (nomor WA, password/pola unit) tidak boleh masuk log, URL, atau payload Realtime. Uang selalu integer rupiah; data uang dan stok tidak diedit atau dihapus, hanya dibatalkan.
11. Pemilik bisa sedikit coding: penjelasan ringkas, istilah teknis umum boleh dipakai tanpa penjelasan dasar.
12. Teks pesan yang tampil di layar hanya ditulis di AFD (bagian 3-5); PRD dan dokumen lain merujuknya. Dashboard memakai kalimat netral tanpa sapaan (tanpa "kamu", "Anda", "-mu"); hanya halaman tracking (S-07) menyapa "kamu".
13. Peran dan status aktif staf dibaca dari tabel `profiles` pada setiap permintaan, bukan dari JWT atau `user_metadata`. Setiap Server Action memeriksa izinnya sendiri (`proxy.ts` tidak melindungi Server Action dan tidak berisi pemeriksaan database).

## Perintah
<!-- Salinan TRD bagian 7. Ubah keduanya bersamaan. Semua perintah dijalankan dari folder dashboard/. -->
| Tujuan | Perintah |
|---|---|
| Dev | `npm run dev` |
| Test | `npm test` (unit, Vitest) dan `npm run test:e2e` (Playwright, database tes) |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Migrasi DB | `npm run db:generate` (buat migrasi) lalu `npm run db:migrate` |
| Seed | `npm run db:seed:dev` (data contoh, hanya database tes), `npm run db:seed:prod` (pengaturan + akun awal) |
| Reset password Pemilik | `npm run owner:reset-password -- --username <u>` |

## Perintah vibe-docs
- `/vibe-docs build` atau "lanjut": kerjakan langkah IPD berikutnya
- `/vibe-docs update`: ubah kebutuhan dan sinkronkan semua dokumen
- `/vibe-docs check`: cek konsistensi dokumen tanpa mengubah file
