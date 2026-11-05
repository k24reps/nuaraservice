# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

static HTML/CSS tanpa framework dan tanpa build step: beranda `index.html` dan tiga halaman layanan statis (`servis-laptop-cimahi`, `servis-hp-cimahi`, `servis-tv-elektronik-cimahi`, masing-masing folder berisi `index.html`), plus `sitemap.xml` dan `robots.txt` di root. Kode di GitHub (repo privat), di-deploy ke Vercel. Dipilih pemilik saat perencanaan awal.

## Users

Primer: mahasiswa dan pelajar di kampus UNJANI Cimahi dan sekitarnya. Laptop mereka dipakai untuk tugas dan skripsi, jadi kerusakan terasa mendesak. Mereka sensitif pada transparansi biaya dan kecepatan, dan datang jalan kaki atau naik motor.

Sekunder: warga umum, penghuni kos, dan keluarga di sekitar Cimahi Selatan yang butuh servis HP dan elektronik rumah tangga tanpa harus ke pusat kota Bandung.

Sebagian besar membuka halaman dari HP.

## Product Purpose

Nuara Service adalah workshop reparasi laptop/PC, HP, dan elektronik rumah tangga. Landing page ini mengubah pengunjung yang perangkatnya rusak menjadi chat WhatsApp atau kunjungan ke workshop. Keduanya sama penting: sukses = chat WhatsApp masuk dan klik rute ke lokasi.

## Positioning

Kombinasi tiga hal, tidak ada yang dominan: lokasi di belakang kampus UNJANI (terjangkau jalan kaki), biaya disepakati di awal sebelum pengerjaan, dan tiket servis digital yang progresnya bisa dipantau lewat WhatsApp.

## Operating Context

Pelanggan bisa konsultasi awal lewat WhatsApp atau datang langsung ke workshop. Kerusakan dicek, estimasi biaya disampaikan, dan pengerjaan baru dimulai setelah pelanggan setuju. Perangkat yang dititipkan mendapat nomor tiket dan link pelacakan status pribadi lewat WhatsApp (sistem FixMaster). Link tracking dibuat per tiket; tidak ada halaman pelacakan publik.

## Capabilities and Constraints

- Nama: Nuara Service
- Alamat workshop: Jl. Ibu Ganirah No. 115, Cibeber, Kec. Cimahi Selatan, Kota Cimahi, Jawa Barat. Posisi: di belakang kampus UNJANI Cimahi. Kode pos 40531; patokan di listing Google Maps: dekat Cafe BTW (dicek 2026-11-04).
- Area layanan: Kota Cimahi, terutama Cimahi Selatan, Cibeureum, Baros, dan Leuwigajah, sampai perbatasan Bandung Barat.
- WhatsApp: 0821-1821-8747. Link CTA: https://wa.me/6282118218747?text=Halo%20Nuara%20Service,%20saya%20mau%20konsultasi%20kerusakan%20perangkat
- Teks CTA pilihan pemilik: "Konsultasi Kerusakan Gratis" atau "Cek Estimasi Biaya via WhatsApp".
- Layanan, urutan prioritas:
  1. Laptop & PC: mati total, black screen, perbaikan motherboard & IC; ganti LCD/layar, keyboard, baterai drop; upgrade SSD & RAM, bersihkan debu, ganti thermal paste.
  2. HP / smartphone: ganti LCD & touchscreen pecah/blank; ganti baterai boros/kembung; port charger tidak masuk; bootloop, restart sendiri.
  3. Elektronik rumah tangga & audio-visual: TV LED/LCD (mati total, ada suara tanpa gambar, layar bergaris); mesin cuci & kulkas (masalah modul/kelistrikan).
- Tiket FixMaster ditampilkan sebagai teks saja, tanpa tombol atau link.
- Jam buka (listing Google Maps milik pemilik, dicek 2026-11-04): Senin sampai Kamis 09.00-21.00; Jumat 13.00-21.00; Sabtu dan Minggu 11.00-21.00. Tampil sebagai daftar di bagian "Datang ke workshop" (sejak 2026-11-04) dan di data terstruktur.
- Profil Google Maps (kategori: Jasa Reparasi Komputer; nama di listing: NUARA SERVICE – Service HP, Laptop & Elektronik UNJANI): https://www.google.com/maps/place/NUARA+SERVICE+%E2%80%93+Service+HP,+Laptop+%26+Elektronik+UNJANI/data=!4m2!3m1!1s0x2e68e5c1cfdf5711:0x4ba547a0be3c727c
- Data terstruktur (JSON-LD LocalBusiness) ada di head `index.html`. Isinya harus sama dengan listing Google Maps (nama, alamat, telepon, jam buka) dan layanan yang dikonfirmasi pemilik di atas. Jangan menambah aggregateRating, review, atau priceRange. Tiga halaman layanan membawa JSON-LD `Service` minimal yang menunjuk ke LocalBusiness yang sama lewat `@id` (`https://nuaraservice.my.id/#localbusiness`); isinya hanya layanan yang dikonfirmasi di atas, tanpa rating, ulasan, atau harga.
- Analitik (sejak 2026-11-05): snippet Google tag dari pemilik, ID container `GTM-N8CL664P`, mengirim `page_view` ke stream GA4 `G-1HHWZVQ09Z` (terbaca dari isi container publik). Snippet ada di `<head>` `index.html` dan tiga halaman layanan, tepat setelah meta viewport. Setiap halaman baru harus memuatnya juga; salin dari `index.html` apa adanya. Pengaturan pengukuran ada di akun Google pemilik, bukan di repo.
- Belum ditentukan, jangan dikarang: daftar harga, durasi garansi, dan apakah mesin cuci dan kulkas dibawa ke workshop atau diservis di tempat pelanggan (langkah terakhir alur di halaman TV sengaja tidak menyebut pengambilan). Belum dikonfirmasi sebagai layanan: iPhone secara khusus, Magic Com, Water Heater.

## Brand Commitments

- Logo: monogram "N" dari kapsul berwarna berisi ikon perangkat (laptop, HP, TV, kulkas, mesin cuci, kipas) dengan wordmark NUARA SERVICE, di atas latar navy. File: `assets/logo.jpg`.
- Warna terukur dari piksel logo: navy #062036, amber #FAA403, oranye #FC5B02, teal #73CABF.
- Bahasa Indonesia sehari-hari dengan kalimat pendek. Tone: kalem, profesional, transparan, dengan sentuhan ramah.
- Pesan kunci dari pemilik: cek kerusakan transparan dan estimasi disepakati di awal; teknisi berpengalaman menangani hardware sampai level komponen; pengerjaan rapi dan bergaransi.

## Evidence on Hand

- Rating Google 4,9 dengan 216 ulasan menurut listing Google Maps pada 2026-11-04 (sebelumnya 210, dikonfirmasi pemilik pada 2026-09-22). Di halaman ditulis "215+" (keputusan pemilik 2026-11-04) supaya tidak perlu diubah tiap ada ulasan baru; perbarui angka itu bila jumlah ulasan sudah jauh di atasnya. Ditampilkan sebagai teks. Tidak ditandai sebagai aggregateRating di data terstruktur: pedoman Google melarang rating dari situs lain ditandai sebagai rating situs sendiri.
- Logo asli di `assets/logo.jpg`.
- Tidak ada: foto workshop, teknisi, atau hasil kerja yang layak dipakai; testimoni atau kutipan ulasan; statistik lain; sertifikasi. Jangan memakai foto stok, ilustrasi generik, atau gambar orang sebagai pengganti.

## Product Principles

1. Setiap bagian halaman berujung pada chat WhatsApp atau rute ke workshop.
2. Ketidakpastian soal harga dijawab dengan ajakan bertanya, bukan angka karangan.
3. Transparansi ditunjukkan lewat alur kerja yang nyata, bukan kata sifat.
4. Dirancang dari layar HP dulu.

## Accessibility & Inclusion

Kontras teks minimal WCAG AA. Nomor telepon dan alamat berupa teks yang bisa disalin. Target sentuh minimal 44px. Bisa dipakai penuh dengan keyboard.
