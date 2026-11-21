# TRD (Technical Requirements Document) - Nuara Dashboard

> Versi: 0.3 | Diperbarui: 2026-11-21 | Merujuk: PRD.md, IPD.md, `dashboard/AGENTS.md`
<!-- Proyek existing: landing page statis di root repo tetap apa adanya. Dashboard ada di folder dashboard/.
Versi 0.2 (Next.js + Drizzle, dibangun dari nol) dibatalkan 2026-11-21 (wawancara P13): dasar kode diganti salinan FixMaster. Isi versi 0.2 ada di riwayat git (commit 215e799). -->

## 1. Tech Stack
| Lapisan | Pilihan | Versi mayor | Alasan (1 kalimat) |
|---|---|---|---|
| Dasar kode | Salinan FixMaster (`k24reps/fixmaster` commit `0175e8d`), bagian SaaS dibuang | - | Keputusan Pemilik 2026-11-21 (P13.1): hampir semua fitur PRD sudah ada dan teruji di FixMaster. |
| Frontend | Vite + React + TypeScript, react-router, Zustand, TanStack Query | Vite 8, React 19 | Bawaan FixMaster; SPA tanpa server sendiri. |
| UI | Fase 1: CSS Modules + token FixMaster. Fase 2: Tailwind CSS + komponen dens-ui (Radix, model shadcn) dengan token warna Nuara dari DBD | Tailwind 4 | Keputusan Pemilik (P13.3, P13.7): dens-ui, warna Nuara, dipindah per halaman. |
| Backend | Supabase: Postgres + RLS per `org_id`, RPC `security definer` untuk operasi uang dan stok, Edge Functions (Deno) untuk backup | Postgres 17 | Bawaan FixMaster; aturan akses ditegakkan database, bukan hanya UI. |
| Database | Proyek Supabase milik Nuara, region Singapura; migrasi `dashboard/supabase/migrations/` 0001 s.d. 0105 | - | 0105 khusus Nuara: satu toko, tanpa saldo unit (P13.5). |
| Auth | Supabase Auth email + password; staf bergabung lewat undangan email Pemilik; login PIN karyawan di perangkat bersama | - | Bawaan FixMaster; selisih dengan PRD (username tanpa email) ada di daftar selisih IPD. |
| Hosting | Vercel paket Hobby, proyek kedua, Root Directory `dashboard/` | - | Sudah dipakai landing page; risiko Hobby di bagian 9. |
| Pihak ketiga | Supabase Realtime (`postgres_changes`), WhatsApp `wa.me`, Sentry (opsional, aktif bila DSN diisi), Vercel Web Analytics, Resend untuk email backup (opsional) | - | Semua punya paket gratis; tanpa API WhatsApp berbayar. |

Runtime: Node 22 (CI) dan npm. PWA: `public/manifest.webmanifest` + `public/sw.js` (cache app shell, tanpa cache data).

## 2. Arsitektur
SPA statis di Vercel. Browser memakai `@supabase/supabase-js` dengan kunci publik (anon/publishable); keamanan data ditegakkan RLS Postgres per `org_id` dan RPC `security definer` yang memeriksa peran pemanggil. Tidak ada server aplikasi sendiri.

- Lapisan data: pola repository (`src/data/`). `useCollection('<koleksi>')` untuk baca, `repository` untuk tulis. Adapter Supabase dipakai bila env Supabase diisi; tanpa env, adapter IndexedDB di browser (mode lokal untuk pengembangan).
- Realtime: langganan `postgres_changes` per tabel organisasi; cache TanStack Query diinvalidasi saat ada perubahan.
- Satu toko: skema tetap multi-organisasi (tidak dibongkar, P13.5), tetapi `create_organization` menolak toko kedua (0105). Akun pertama yang menyelesaikan wizard menjadi Pemilik.
- Tracking pelanggan: rute publik `/t/<kode>` (kode acak per tiket, migrasi 0100) dan `/track`, dilayani host yang sama dengan dashboard, lewat RPC `track_service_by_code` yang bisa dipanggil anon dengan kolom terbatas.
- Backup: `auto-backup` (pg_cron harian) menyimpan salinan JSON per toko di Storage; `backup-email` (pg_cron Senin) mengirim tautan unduh ke Pemilik bila Resend diisi.
- Harness pengembangan: rute `/demo` hanya di dev server (`src/dev/DevSandbox.tsx`), berisi data contoh di RAM, dipakai skrip foto dan probe UI.

Keputusan penting:
| Keputusan | Alternatif ditolak | Alasan |
|---|---|---|
| Salin FixMaster sekali jalan, tanpa sinkron upstream (P13.2) | Fork dengan riwayat git dan tarik perubahan berkala | UI berbeda total setelah Fase 2, jadi tarikan upstream selalu konflik; perbaikan logika boleh disalin manual. |
| Skema multi-organisasi dipertahankan + penjaga satu toko (P13.5) | Bersihkan `org_id` dari skema | `org_id` muncul 1.161 kali di migrasi; membongkar RLS berisiko membuka celah dan menulis ulang tes integrasi. |
| Perilaku FixMaster dulu, selisih PRD diputuskan per butir (P13.6) | Sesuaikan semua ke PRD saat menyalin | Aplikasi cepat bisa dipakai; tiap selisih diputuskan Pemilik dengan informasi lengkap. |
| UI ke dens-ui bertahap per halaman (P13.7) | Tulis ulang semua halaman sekaligus | Aplikasi tetap bisa di-build dan dipakai di setiap commit. |
| Form daftar tetap ada | Matikan pendaftaran di Supabase Auth | Staf bergabung lewat undangan email (migrasi 0008): staf mendaftar dengan email yang diundang. Pendaftar tanpa undangan berhenti di wizard karena toko sudah ada. |
| Data API (PostgREST) Supabase aktif | Data API dimatikan (rencana TRD 0.2) | supabase-js di browser membutuhkannya; pagar keamanannya RLS di setiap tabel. |

## 3. Struktur Folder
```
/                         # landing page statis (index.html, style.css, script.js, assets/) - tidak disentuh
docs/                     # PRD, TRD, AFD, DBD, BSD, IPD, _wawancara.md (tidak di-deploy)
.github/workflows/        # dashboard-ci.yml
dashboard/
  AGENTS.md CLAUDE.md     # aturan agent untuk kode dashboard
  src/
    app/                  # router, AuthGate, WorkspaceGate, guard peran
    components/           # layout (Sidebar, Topbar, MobileBottomNav) dan ui/
    features/<fitur>/     # halaman per fitur (services, pos, customers, finance, ...)
    lib/business/         # logika domain murni + tes
    data/                 # repository, adapter Supabase/IndexedDB, tipe entity
    stores/ hooks/ i18n/ config/ styles/
    dev/                  # data contoh + DevSandbox (hanya dev)
  supabase/migrations/    # 0001 s.d. 0105
  supabase/functions/     # auto-backup, backup-email, health
  tests/integration/      # tes RLS/RPC ke staging Supabase Nuara
  scripts/                # foto Playwright, probe audit-*, render-nuara-icons.sh
  docs/obsidian-vault/    # pengetahuan teknis warisan FixMaster
  public/                 # ikon, manifest, sw.js, font
```

## 4. Konvensi Kode
Aturan lengkap di `dashboard/AGENTS.md` bagian 4. Ringkasnya: TypeScript `strict`; warna lewat token CSS; data lewat `useCollection`/`repository`; logika domain di `src/lib/business/`; teks UI lewat `useT()`; uang integer rupiah, data uang dan stok hanya dibatalkan; breakpoint pencegah luberan memakai `@container`.

## 5. Keamanan
- Akses data: RLS aktif di semua tabel organisasi; peran (owner, admin, karyawan) dibaca dari `memberships` di dalam kebijakan RLS dan RPC, bukan dari JWT. Operasi uang dan stok lewat RPC yang memeriksa peran dan mengunci baris.
- Kunci di browser hanya kunci publik Supabase. Kunci `service_role` hanya untuk Edge Function dan runner tes integrasi; tidak pernah diberi prefix `VITE_`.
- Satu toko: `create_organization` (0105) mengunci tabel lalu menolak toko kedua.
- Permukaan anon: `track_service`, `track_service_by_code`, `check_rate_limit`. RPC lead demo ditutup (0105).
- Password/pola unit disimpan terpisah lewat RPC `set_service_secret`/`get_service_secret` dan dihapus server saat unit diambil.
- Header keamanan di `dashboard/vercel.json`: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Permissions-Policy` (geolocation untuk absensi), `X-Robots-Tag: noindex, nofollow` untuk semua rute.

## 6. Environment & Deploy
| Env | Tujuan | URL | Catatan |
|---|---|---|---|
| local | pengembangan | http://localhost:5173 | Tanpa env Supabase: IndexedDB. `/demo`: data contoh. |
| staging | tes integrasi + uji manual | URL preview Vercel | Proyek Supabase tes milik Nuara (dibuat di L-44). |
| production | dipakai workshop | https://app.nuaraservice.my.id (rencana) | Proyek Vercel kedua; proyek Supabase produksi dibuat saat rilis. |

Variabel lingkungan aplikasi (`dashboard/.env.example`):
| Nama | Untuk |
|---|---|
| VITE_SUPABASE_URL | URL proyek Supabase |
| VITE_SUPABASE_ANON_KEY | Kunci publik Supabase (aman di browser; RLS menegakkan akses) |
| VITE_SENTRY_DSN | Opsional, pelacakan error |

Secret Vault Supabase (dibaca pg_cron untuk memanggil Edge Function backup): `project_url` dan `backup_cron_secret`. Secret Edge Function: `BACKUP_CRON_SECRET` (sama dengan `backup_cron_secret`), `RESEND_API_KEY` dan `MAIL_FROM` (opsional; kosong = email backup hanya dicatat), `MAIL_REPLY_TO` (opsional), `SUPABASE_PUBLIC_URL`.

Tes integrasi (`dashboard/.env.test.local`, tidak di-commit): `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` milik proyek staging Nuara. **Jangan pernah memakai proyek FixMaster.**

Migrasi diterapkan dengan Supabase CLI dari folder `dashboard/`: `supabase link --project-ref <ref proyek Nuara>` lalu `supabase db push`.

CI/CD:
- `.github/workflows/dashboard-ci.yml`: saat push ke `main` atau PR yang mengubah `dashboard/**`: `npm ci`, lint, build (type-check), tes unit.
- Vercel: proyek kedua dengan Root Directory `dashboard/`. Landing page tetap di proyek Vercel lama; `.vercelignore` root mengecualikan `dashboard` dan `.github`.

## 7. Perintah & Testing
<!-- Sumber tunggal perintah proyek. CLAUDE.md menyalin tabel ini; ubah keduanya bersamaan. Semua perintah dijalankan dari folder dashboard/. -->
| Tujuan | Perintah |
|---|---|
| Dev | `npm run dev` |
| Test | `npm run test` (unit, Vitest, offline) dan `npm run test:integration` (RLS/RPC ke staging Supabase Nuara) |
| Lint | `npm run lint` |
| Typecheck | `npm run type-check` |
| Build | `npm run build` |
| Migrasi DB | `supabase db push` (setelah `supabase link` ke proyek Nuara) |
| Probe UI | `BASE_URL=http://localhost:5173 node scripts/audit-mobile.mjs` dan `scripts/audit-zoom.mjs` (dev server jalan) |
| Ikon | `npm run brand:render` (butuh ImageMagick) |

- Unit (Vitest): logika domain di `src/lib/business/`, data layer, komponen, i18n, konfigurasi deploy.
- Integrasi: RLS lintas toko, RPC uang dan stok, absensi, tracking. Toko uji dibuat lewat service_role (`createOrgAs`) karena `create_organization` menolak toko kedua.
- UI: foto Playwright lewat `/demo` + probe `audit-*` (ukur DOM, bukan membaca gambar).

## 8. Non-Fungsional Teknis
- Performa: bundle dipecah per rute; target dashboard < 3 detik di 4G.
- Skala: 100-200 tiket/bulan, 4-6 akun; jauh di bawah batas paket gratis Supabase (500 MB).
- Observability: log Edge Function, `activity_logs` untuk perubahan penting, Sentry bila DSN diisi.

## 9. Risiko Teknis
- Vercel Hobby dibatasi untuk pemakaian non-komersial (https://vercel.com/docs/limits/fair-use-guidelines). Pemilik memilih tetap Hobby (2026-11-04) -> proyek bisa dijeda; aplikasi berupa SPA statis sehingga mudah dipindah ke hosting statis lain.
- Paket gratis Supabase: proyek dijeda setelah 7 hari tanpa aktivitas, tanpa backup harian bawaan -> backup harian `auto-backup` + email mingguan; proyek produksi dibuat saat rilis.
- Migrasi Nuara dijalankan ke proyek yang salah (mis. proyek FixMaster yang tercatat di vault) -> skrip deploy FixMaster tidak disalin; `supabase link` selalu dengan ref proyek Nuara; dicek ulang sebelum `db push`.
- Fase 2: Tailwind dan CSS Modules hidup berdampingan -> reset dasar Tailwind (preflight) bisa mengubah tampilan halaman lama; diputuskan di L-46 dan dijaga probe `audit-*` sebelum dan sesudah.
- Teks dan alur FixMaster berbeda dari PRD (sapaan "Anda", format nomor tiket, login email) -> dicatat di daftar selisih IPD, bukan diperbaiki diam-diam.
- Tes integrasi belum pernah dijalankan untuk salinan ini (belum ada staging Nuara) -> dijalankan di L-44.
