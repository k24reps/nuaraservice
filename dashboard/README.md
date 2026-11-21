# Nuara Dashboard

Aplikasi web internal Nuara Service: tiket servis, link lacak pelanggan, kabar WhatsApp,
kasir dan stok, kas, absensi, dan laporan. Dipakai Pemilik, Admin konter, dan Teknisi.

Kode ini disalin dari FixMaster (21 Nov 2026), lalu bagian SaaS-nya dibuang. Rencana dan
spesifikasi ada di `../docs/` (PRD, TRD, IPD). Untuk agent AI dan developer baru: baca
[`AGENTS.md`](AGENTS.md) lebih dulu.

## Stack

- Vite + React 19 + TypeScript, Zustand, TanStack Query
- Supabase: Postgres + RLS + RPC, Auth, Realtime, Edge Functions (backup)
- CSS Modules warisan FixMaster; dipindah bertahap ke Tailwind v4 + dens-ui (Fase 2)
- Vitest + Testing Library, Playwright untuk foto dan probe UI

## Menjalankan lokal

```bash
npm install
npm run dev      # http://localhost:5173
```

Tanpa `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` (lihat `.env.example`), aplikasi jalan
penuh dengan IndexedDB di browser. Buka `/demo` di dev server untuk aplikasi berisi data contoh.

## Perintah

```bash
npm run build             # type-check + build produksi
npm run test              # tes unit (offline)
npm run lint              # eslint
npm run test:integration  # RLS/RPC ke staging Supabase Nuara (.env.test.local)
npm run brand:render      # buat ulang ikon dari ../assets/logo.jpg (ImageMagick)
```

## Database

Migrasi ada di `supabase/migrations/` (`0001` sampai `0105`) dan diterapkan berurutan ke proyek
Supabase milik Nuara. `0105_nuara_single_shop.sql` khusus Nuara: satu toko per database, tanpa
saldo unit.
