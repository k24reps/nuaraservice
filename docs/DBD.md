# DBD (Design & Brand Document) - Nuara Dashboard

> Versi: 0.3 | Diperbarui: 2026-11-21 | Merujuk: PRD.md, AFD.md, DESIGN.md (landing page)
<!-- Dokumen desain visual. Skema database ada di BSD, bukan di sini. Eksekusi visual memakai skill impeccable (CLAUDE.md); token di sini adalah kontraknya. -->

> [!note] Sejak 2026-11-21 (wawancara P13.3)
> Komponen dashboard diambil dari dens-ui (https://github.com/dendense/dens-ui, MIT, model shadcn, Tailwind v4) dengan warna diganti token di bagian 2. Tema Mars Green dens-ui tidak dipakai. Halaman dipindah bertahap (IPD Fase B); sampai itu, halaman yang belum dipindah masih bertampilan FixMaster.

## 1. Karakter Brand
- Kata kunci: tenang, rapi, transparan.
- Dua wajah, satu brand:
  - **Halaman tracking (S-07)**: dunia "Nota Servis Rangkap" dari DESIGN.md (kertas putih di meja konter navy, rangkap amber/teal, Archivo lebar variabel). Pelanggan merasa memegang lembar nota Nuara.
  - **Dashboard staf**: warna dan huruf yang sama, tetapi datar dan padat seperti alat kerja konter; tanpa kertas miring, tanpa bayangan dekoratif.
- Nada teks:
  - Dashboard netral tanpa sapaan dan tanpa kata ganti orang kedua (kamu, Anda, -mu), langsung ke tindakan: "Tiket NS-00012 dibuat. Kirim link tracking ke pelanggan."
  - Tracking menyapa "kamu", kalimat pendek: "Laptop-mu sedang dikerjakan. Kami kabari lewat WhatsApp saat siap diambil."
  - Pesan error spesifik + solusi (AFD bagian 3).
- Bahasa UI: Bahasa Indonesia; Rupiah tanpa desimal (Rp1.250.000); tanggal "2 Nov 2026"; jam "08.02" (WIB).
- Referensi: FixMaster untuk tata letak dan alur (daftar tiket -> detail dengan langkah tahap, tombol "Ubah status"), karena sudah dikenal staf; tampilan tetap Nuara. Beda dari FixMaster: sparepart bisa ditambahkan langsung dari baris daftar tiket tanpa membuka detail (F-09.9).
- Hindari: tampilan generik template admin (kartu statistik berwarna-warni, gradien), foto stok, ilustrasi, avatar orang, tombol WhatsApp mengambang.

## 2. Design Tokens
**Warna (dashboard)**
| Token | Hex | Pemakaian |
|---|---|---|
| primary | #062036 | Tombol utama, link, item navigasi aktif |
| primary-hover | #0D3558 | Hover tombol utama |
| on-primary | #FFFFFF | Teks/ikon di atas primary |
| accent | #FAA403 | Penanda perlu tindakan, badge Konfirmasi biaya, garis aktif navigasi (bukan untuk teks di putih) |
| on-accent | #062036 | Teks di atas accent |
| accent-soft | #FEF3D6 | Latar baris/kartu "perlu ditindaklanjuti" |
| background | #F4F6F9 | Latar halaman |
| surface | #FFFFFF | Kartu, tabel, modal, sidebar |
| border | #C9D6E3 | Garis pemisah dekoratif (bukan batas kontrol) |
| border-input | #7D8896 | Batas kolom input, checkbox, select |
| text | #062036 | Teks utama |
| text-muted | #5B6776 | Teks sekunder, label, placeholder |
| info-soft | #E8EEF5 | Latar badge Diterima, Diagnosa, Pengerjaan, Dikembalikan |
| success | #067647 | Status berhasil, Lunas, badge Selesai |
| success-soft | #E6F4EC | Latar badge Selesai/Lunas |
| warning | #B54708 | Terlambat, stok menipis, Tunggu part |
| warning-soft | #FDF0E1 | Latar badge warning |
| danger | #B42318 | Error, aksi batal, badge Dibatalkan |
| danger-soft | #FDECEA | Latar badge Dibatalkan/error |
| focus | #062036 | Cincin fokus 2px + jarak 2px |

**Warna (tracking S-07)**: memakai token DESIGN.md apa adanya: counter #062036, paper #FFFFFF, ink #062036, ink-soft #5B6776, carbon #2536A0, amber #FAA403, teal #73CABF, numerator #FC5B02 (hanya nomor tiket ukuran besar), stamp #C43F00. Fokus di atas meja navy: amber 3px; di atas kertas: carbon 3px.

**Warna (cetak S-08, S-09)**: hitam #000000 di putih, logo hitam-putih.

**Kontras** (rumus WCAG; teks normal >= 4.5:1, teks besar & ikon/batas kontrol >= 3:1)
| Teks | Latar | Rasio |
|---|---|---|
| text #062036 | background #F4F6F9 | 15.3:1 |
| text #062036 | surface #FFFFFF | 16.6:1 |
| text-muted #5B6776 | background #F4F6F9 | 5.3:1 |
| text-muted #5B6776 | surface #FFFFFF | 5.8:1 |
| text-muted #5B6776 | info-soft #E8EEF5 | 4.9:1 |
| on-primary #FFFFFF | primary #062036 | 16.6:1 |
| on-primary #FFFFFF | primary-hover #0D3558 | 12.6:1 |
| on-accent #062036 | accent #FAA403 | 8.2:1 |
| text #062036 | accent-soft #FEF3D6 | 15.0:1 |
| text #062036 | info-soft #E8EEF5 | 14.2:1 |
| success #067647 | surface #FFFFFF | 5.7:1 |
| success #067647 | success-soft #E6F4EC | 5.0:1 |
| warning #B54708 | surface #FFFFFF | 5.4:1 |
| warning #B54708 | warning-soft #FDF0E1 | 4.8:1 |
| danger #B42318 | background #F4F6F9 | 6.1:1 |
| danger #B42318 | surface #FFFFFF | 6.6:1 |
| danger #B42318 | danger-soft #FDECEA | 5.8:1 |
| on-danger #FFFFFF | danger #B42318 | 6.6:1 |
| border-input #7D8896 (batas) | surface #FFFFFF | 3.6:1 |
| border-input #7D8896 (batas) | background #F4F6F9 | 3.3:1 |
| focus #062036 (cincin) | surface #FFFFFF | 16.6:1 |
| Tracking: ink #062036 | paper #FFFFFF | 16.6:1 |
| Tracking: ink-soft #5B6776 | paper #FFFFFF | 5.8:1 |
| Tracking: on-counter #FFFFFF | counter #062036 | 16.6:1 |
| Tracking: on-counter-soft #C5D0DB | counter #062036 | 10.6:1 |
| Tracking: ink #062036 | amber #FAA403 | 8.2:1 |
| Tracking: ink #062036 | teal #73CABF | 8.6:1 |
| Tracking: carbon #2536A0 | paper #FFFFFF | 9.9:1 |
| Tracking: stamp #C43F00 | paper #FFFFFF | 5.2:1 |

Catatan: accent #FAA403 di atas putih hanya 2.0:1, jadi tidak dipakai untuk teks atau cincin fokus di surface.

Dark mode: tidak (P9.5, ditegaskan P14.1). Sejak L-47 seluruh aplikasi hanya tema terang; tombol ganti tema dicopot.

**Tipografi**
- Font dashboard (P13.3, P14.2, sejak 2026-11-21): Figtree (variable, dipaket lewat `@fontsource-variable/figtree`) untuk teks; JetBrains Mono untuk nomor tiket, Rupiah, ID, dan label kecil kapital. Mengikuti dens-ui, menggantikan Archivo untuk dashboard staf.
- Font tracking (S-07): tetap Archivo dan font nota DESIGN.md landing page. Kalam tidak dipakai di dashboard.
- Skala dashboard: ikuti skala dens-ui (judul halaman 24px/700, judul kartu 16px/600, body 14px/1.5, label kecil mono 11px kapital spasi 0.08-0.12em); nomor tiket dan Rupiah memakai angka tabular (`tabular-nums`), Rupiah rata kanan di tabel.
- Rancangan skala Archivo sebelumnya (h1 28px wght 800 wdth 85, dst.) tidak dipakai lagi.
- Skala tracking: ikuti DESIGN.md (display, title, body, numerator).

**Spacing & bentuk**
- Skala spacing: 4/8/12/16/24/32/48 px.
- Bentuk dashboard (P13.3): mengikuti dens-ui. Tombol, badge, dan tab berbentuk pill (`rounded-full`); input dan select radius 14px; kartu 22px; dialog 28px. Kertas tracking tetap 3px (DESIGN.md).
- Bayangan dashboard (P13.3): bayangan lembut dens-ui, diwarnai navy (`rgb(6 32 54 / ...)`): `shadow-panel` untuk kartu, `shadow-raised` untuk menu, dialog, toast. Tracking: bayangan kertas DESIGN.md.
- Token tema dashboard ada di `dashboard/src/styles/nuara-theme.css` (variabel `--nu-*`); kontras pasangan warnanya diuji `nuaraTheme.test.ts`.
- Grid & lebar maks konten: sidebar 240px; konten maks 1280px; gutter 16px (< 640px) dan 24px (>= 640px). Tracking: satu kolom maks 560px.
- Kepadatan sedang: baris tabel 48px (10-15 tiket per layar laptop 768px tinggi); target sentuh minimal 44px di layar sentuh (pointer kasar, P15.3): tombol, isian, dan item menu dens-ui naik ke 44px, checkbox/radio/switch mendapat area sentuh 44px tanpa membesar tampilannya; di perangkat bermouse kontrol tetap 40px.

## 3. Komponen
Sumber: `dashboard/src/components/dens/` (dens-ui v0.2.0 + tambahan pola shadcn: popover, sheet, drawer, command, combobox, sonner). Katalog hidup di dev server: `/dev/komponen`. Badge tahap memakai varian dens-ui: info (Diterima, Diagnosa, Pengerjaan, Dikembalikan), highlight (Konfirmasi biaya), warning (Tunggu part), success (Selesai, Diambil), destructive-soft (Dibatalkan).

| Komponen | Varian | State wajib | Dipakai di layar |
|---|---|---|---|
| Button | primary, secondary (garis), ghost, danger, whatsapp (primary + ikon WA) | default, hover, focus, disabled, loading | S-01, S-02, S-03, S-04, S-05, S-06, S-07, S-10, S-11, S-12, S-13, S-14, S-15, S-16, S-17, S-18, S-19, S-20, S-21 |
| Input | text, password, rupiah (format ribuan), nomor WA, select, textarea, checkbox grup (keluhan, kelengkapan), combobox cari (pelanggan, sparepart) | default, focus, error, disabled | S-01, S-02, S-05, S-06, S-10, S-12, S-13, S-14, S-15, S-17, S-18, S-19 |
| Card | ringkasan beranda, info tiket, saldo akun kas, angka laporan + selisih bulan lalu | default, perlu tindakan (accent-soft), loading (kerangka) | S-03, S-06, S-11, S-13, S-15, S-17 |
| Tabel/daftar | tabel (>= 1024px), daftar kartu bertumpuk (< 1024px), filter + cari | default, kosong, loading, error | S-04, S-10, S-12, S-13, S-14, S-15, S-16, S-18, S-20 |
| Badge | 9 tahap tiket (Diterima, Diagnosa, Pengerjaan, Dikembalikan = info-soft; Konfirmasi biaya = accent dengan teks on-accent; Tunggu part = warning-soft; Selesai, Diambil = success-soft; Dibatalkan = danger-soft), Lunas/Belum lunas, Express, Link belum dikirim, Perlu ditindaklanjuti, Stok menipis, Terlambat, Lokasi tidak terverifikasi | selalu teks + warna (tidak warna saja) | S-03, S-04, S-06, S-07, S-11, S-12, S-13, S-16, S-18 |
| Langkah tahap (stepper) | 7 tahap + Dibatalkan dan Dikembalikan, tahap dilewati ditandai "dilewati" | selesai, aktif, belum, dilewati | S-06, S-07 |
| Riwayat (timeline) | tahap + catatan internal (S-06); tahap saja (S-07) | default, kosong | S-06, S-07, S-13 |
| Modal / Dialog | konfirmasi (batal tiket, mundur tahap, tahap final Diambil/Dikembalikan, nonaktif akun, samarkan pelanggan, koreksi saldo), form (estimasi, Selesai + garansi, pembayaran split, kembalikan kelebihan, barang masuk, pengeluaran, tambah sparepart cepat) | buka, fokus terkunci, loading, error | S-03, S-04, S-06, S-11, S-13, S-14, S-15, S-16, S-18 |
| Toast | sukses, error, peringatan, info (sonner, P15.2) | muncul 4 detik, bisa ditutup, diumumkan `aria-live` | S-02, S-04, S-05, S-06, S-11, S-12, S-13, S-14, S-15, S-16, S-18, S-19 |
| Navigasi | sidebar (>= 1024px), tab bawah 4 item (< 1024px), header + lonceng notifikasi | aktif, hover, focus, badge jumlah | S-02, S-03, S-04, S-05, S-06, S-10, S-11, S-12, S-13, S-14, S-15, S-16, S-17, S-18, S-19, S-20 |
| Pita offline | "Tidak ada koneksi" di atas layar | tampil, hilang saat online | S-03, S-04, S-05, S-06, S-07, S-14, S-15, S-16 |
| Empty state | teks singkat + tombol aksi, tanpa ilustrasi | - | S-03, S-04, S-10, S-11, S-12, S-13, S-14, S-15, S-16, S-17, S-20 |
| Nota tracking | kepala nota (logo, NUARA SERVICE, nomor tiket numerator), baris isian, rangkap amber/teal, kartu kontak | default, kedaluwarsa | S-07 |
| Layout cetak thermal | 58 mm (sekitar 32 karakter/baris), 80 mm (sekitar 48 karakter/baris); logo hitam-putih, QR 30 mm | - | S-08, S-09 |
| Halaman pesan | judul + penjelasan + tombol ke Beranda | tidak ditemukan, tanpa akses | S-21 |

## 4. Responsivitas
| Breakpoint | Lebar | Perilaku layout |
|---|---|---|
| mobile | < 640px | Satu kolom; tab bawah; tabel menjadi daftar kartu; tombol simpan form menempel di bawah layar; S-07 satu kolom penuh. |
| tablet | 640-1023px | Tab bawah; form dua kolom; daftar kartu dua kolom; S-06 info dan riwayat bertumpuk. |
| desktop | >= 1024px | Sidebar 240px; tabel penuh; S-06 dua kolom (info + aksi di kiri, riwayat di kanan); S-07 tetap maks 560px di tengah meja navy. |

Pendekatan: mobile-first. Cetak memakai CSS `@page` (58 mm / 80 mm), terpisah dari breakpoint layar.

## 5. Aksesibilitas
- Standar WCAG 2.2 AA; kontras sesuai tabel di bagian 2.
- Target sentuh minimal 44x44px (termasuk tab bawah dan checkbox keluhan).
- Fokus keyboard terlihat (cincin focus 2px + jarak 2px; di tracking amber/carbon 3px); semua aksi bisa dicapai tanpa mouse; urutan Tab mengikuti urutan visual; dialog mengunci fokus dan kembali ke pemicunya saat ditutup.
- Setiap input punya label terlihat; pesan error ditautkan ke kolomnya (`aria-describedby`); logo punya teks alternatif.
- Status tidak hanya lewat warna: setiap badge berteks.
- Perubahan realtime dan toast diumumkan lewat `aria-live="polite"` satu kali, tanpa memindah fokus.
- Animasi dikurangi saat `prefers-reduced-motion` aktif (transisi warna saja).

## 6. Aset
- Logo: `assets/logo.jpg` (disalin ke `dashboard/public/`); versi hitam-putih untuk thermal dan ikon PWA 192/512 px (termasuk maskable) dibuat dari file ini di L-05/L-17.
- Ikon: lucide-react di komponen dens-ui; halaman FixMaster yang belum dipindah tetap memakai Phosphor lewat `Icon`. Ikon WhatsApp dan pin lokasi memakai simbol yang sama dengan landing page.
- Ilustrasi/gambar: tidak ada. Tidak ada foto stok, ilustrasi generik, atau gambar orang.

## 7. Do & Don't
| Do | Don't |
|---|---|
| Pakai token DESIGN.md hanya di halaman tracking; dashboard memakai token bagian 2 | Mencampur kertas miring, rangkap, atau bayangan kertas ke dashboard |
| Pakai accent amber hanya untuk hal yang perlu tindakan dan langkah aktif | Memakai amber untuk teks atau cincin fokus di atas putih (2.0:1) |
| Bedakan peran teks dengan ketebalan Figtree dan label mono sebelum menambah warna | Memakai Kalam di dashboard |
| Tulis nomor tiket dan Rupiah dengan angka tabular, Rupiah rata kanan | Menulis uang dengan desimal atau tanpa pemisah ribuan |
| Satu nomor numerator oranye dan maksimal satu cap di halaman tracking | Memakai oranye numerator atau merah cap di dashboard |
| Badge selalu berteks; empty state teks + tombol | Status hanya dengan warna; ilustrasi atau foto stok |
| Bayangan hanya dari token dens-ui (`shadow-panel`, `shadow-raised`) | Tombol WhatsApp mengambang |
| Teks UI tanpa em dash; tanpa fakta bisnis karangan (harga, jam buka, durasi garansi) | Kartu statistik berwarna-warni, gradien, tampilan template admin generik |
| Dashboard memakai kalimat netral ("Tiket NS-00012 dibuat.") | Memakai "kamu", "Anda", atau "-mu" di teks dashboard (hanya halaman tracking yang menyapa "kamu") |
