---
name: Nuara Service
description: Nota servis rangkap di atas meja konter navy, landing page servis laptop, HP, dan elektronik di belakang kampus UNJANI Cimahi.
colors:
  counter: "#062036"
  counter-raised: "#0b2a45"
  paper: "#ffffff"
  ink: "#062036"
  ink-soft: "#5b6776"
  carbon: "#2536a0"
  numerator: "#fc5b02"
  stamp: "#c43f00"
  amber: "#faa403"
  amber-hover: "#ffb42d"
  ink-hover: "#0d3558"
  teal: "#73cabf"
  rule: "#c9d6e3"
  box-hover: "#eef3f8"
  on-counter: "#ffffff"
  on-counter-soft: "#c5d0db"
typography:
  display:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "clamp(2rem, 1.35rem + 3.2vw, 3.7rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.015em"
    fontVariation: "\"wdth\" 82"
  headline:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "clamp(1.7rem, 1.2rem + 2.2vw, 2.6rem)"
    fontWeight: 900
    lineHeight: 1.05
    fontVariation: "\"wdth\" 80"
  title:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "0.04em"
    fontVariation: "\"wdth\" 70"
  body:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    fontVariation: "\"wdth\" 96"
  label:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 800
    letterSpacing: "0.05em"
    fontVariation: "\"wdth\" 75"
  brand:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 900
    letterSpacing: "0.01em"
    fontVariation: "\"wdth\" 118"
  numerator:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
    fontVariation: "\"wdth\" 62"
  hand:
    fontFamily: "Kalam, Comic Sans MS, cursive"
    fontSize: "1.2rem"
    fontWeight: 700
rounded:
  box: "2px"
  paper: "3px"
  card: "6px"
  control: "8px"
  stamp: "50%"
spacing:
  xs: "4px"
  sm: "10px"
  md: "14px"
  gutter: "18px"
  lg: "26px"
  gutter-wide: "28px"
  section: "56px"
components:
  button-send:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "54px"
    width: "100%"
  button-send-hover:
    backgroundColor: "{colors.ink-hover}"
  button-amber:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "50px"
  button-amber-hover:
    backgroundColor: "{colors.amber-hover}"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.on-counter}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "50px"
  bar-wa:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  nota:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.paper}"
    padding: "30px 32px 0"
  sheet-teal:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.paper}"
    padding: "40px 40px 44px"
  stub:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
    padding: "28px 32px 24px"
  tick-box:
    backgroundColor: "transparent"
    textColor: "{colors.carbon}"
    rounded: "{rounded.box}"
    size: "22px"
  line-input:
    backgroundColor: "transparent"
    textColor: "{colors.carbon}"
    typography: "{typography.hand}"
    height: "44px"
    padding: "4px 0"
  stamp:
    textColor: "{colors.stamp}"
    typography: "{typography.numerator}"
    rounded: "{rounded.stamp}"
    width: "196px"
    padding: "14px 18px"
  kartu:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px 22px 18px"
    width: "420px"
  nav-link:
    textColor: "{colors.on-counter-soft}"
    rounded: "{rounded.card}"
    padding: "0 12px"
    height: "44px"
  nav-link-hover:
    backgroundColor: "{colors.counter-raised}"
    textColor: "{colors.on-counter}"
---

# Design System: Nuara Service

Dokumen ini mencatat dunia visual "Nota Servis Rangkap" dari halaman di root proyek (index.html, style.css, script.js). Semua token diambil dari CSS yang sudah dikirim.

## Overview

**Creative North Star: "Nota Servis Rangkap"**

Halaman adalah buku nota tanda terima servis yang tergeletak di meja konter navy. Lembar atas putih dicetak tinta navy, dan rangkapnya mengintip di bawah dalam amber dan teal, persis buku nota konter. Pengunjung tidak membaca brosur; ia mengisi nota: mencentang perangkat dan keluhan, menulis keluhan lain dengan tulisan tangan karbon biru, lalu mengirim nota itu lewat WhatsApp. Janji utama (biaya disepakati sebelum dikerjakan) tidak diklaim dengan kata sifat, tapi dicap di kolom Estimasi biaya.

Kepadatannya seperti formulir cetak: garis isian tipis, label kecil huruf kapital sempit, kotak centang, garis sobek putus-putus. Semua benda kertas sedikit miring dan punya bayangan lunak dari meja, sedangkan meja itu sendiri datar. Tipografi cetak memakai Archivo dengan sumbu lebar variabel sebagai alat utama hierarki; tulisan tangan Kalam hanya untuk isian.

Setiap bagian berujung pada chat WhatsApp atau rute ke workshop. Tidak ada foto, ilustrasi, atau gambar stok; satu-satunya citra adalah logo asli pemilik.

**Key Characteristics:**
- Meja navy datar, benda kertas di atasnya miring dan berbayang.
- Tiga warna kertas: putih (lembar atas), amber (lembar pelanggan), teal (rangkap alur).
- Archivo variabel: lebar sempit untuk label dan angka, lebar lebar untuk nama toko.
- Kalam hanya untuk isian tangan dan pratinjau pesan, selalu dalam karbon biru.
- Satu cap bulat per halaman, satu nomor numerator oranye per halaman.
- Nota adalah formulir sungguhan yang menyusun pesan WhatsApp.

## Colors

Palet diambil dari piksel logo (navy, amber, oranye, teal), ditambah karbon biru dan merah cap sebagai warna alat tulis.

### Primary
- **Navy Meja Konter** (counter): latar seluruh halaman, bar atas, dan footer. Sama dengan tinta cetak (ink), sehingga lubang sobekan nota "menembus" ke meja.
- **Amber Rangkap** (amber): lembar pelanggan di bawah nota, rangkap yang mengintip, tombol aksi di atas meja (Chat WhatsApp di bar, Rute ke workshop), bintang rating, baris kedua judul utama, garis atas kartu nama, cincin fokus di atas meja, dan seleksi teks. Hover naik ke Amber Terang (amber-hover).

### Secondary
- **Teal Rangkap Kedua** (teal): lembar alur servis dan rangkap terbawah di tumpukan nota. Juga warna teks pada label langkah yang dicetak terbalik.

### Tertiary
- **Karbon Biru** (carbon): hanya untuk jejak tangan: centang, isian Keluhan lain, pratinjau "Akan terkirim", caret, accent-color, dan cincin fokus di dalam nota atau kartu.
- **Oranye Numerator** (numerator): hanya untuk nomor nota "No. NS-" pada ukuran besar (1.6rem, 800). Kontrasnya di atas putih cukup untuk teks besar saja.
- **Merah Cap** (stamp): tinta cap bulat. Lebih gelap dari oranye logo supaya teks cap kecil tetap terbaca di atas putih.

### Neutral
- **Kertas Putih** (paper): lembar atas nota dan kartu nama.
- **Tinta Cetak** (ink): teks cetak di kertas, garis kepala nota, tombol kirim, bingkai kotak centang. Hover tombol kirim ke Navy Hover (ink-hover).
- **Tinta Pudar** (ink-soft): label baris, alamat, petunjuk, placeholder, garis isian titik-titik.
- **Garis Isian** (rule): pemisah antarbaris nota.
- **Meja Terangkat** (counter-raised): garis bar dan footer, latar hover navigasi.
- **Teks di Meja** (on-counter) dan **Teks di Meja Redup** (on-counter-soft): judul dan paragraf di atas navy, bingkai tombol garis.
- **Kotak Disentuh** (box-hover): latar kotak centang saat hover.

### Named Rules
**The Kertas Punya Warna Sendiri Rule.** Amber dan teal adalah warna kertas, bukan warna aksen dekoratif. Keduanya muncul sebagai lembar, rangkap, atau tombol aksi; tidak sebagai gradien, ikon berwarna, atau latar bagian yang bukan kertas.

**The Tangan Selalu Karbon Rule.** Apa pun yang "ditulis pelanggan" berwarna karbon biru; apa pun yang "dicetak toko" berwarna tinta navy. Jangan campur.

**The Satu Cap Satu Nomor Rule.** Merah cap dan oranye numerator masing-masing muncul sekali per halaman. Kelangkaannya yang membuat keduanya terbaca sebagai bukti.

## Typography

**Display Font:** Archivo (dengan Arial Narrow, sans-serif), sumbu wdth 62..125 dan wght 400..900
**Body Font:** Archivo, wdth 96
**Label/Mono Font:** Kalam (dengan Comic Sans MS, cursive) untuk tulisan tangan

**Character:** Satu keluarga huruf cetak yang dilebarkan dan disempitkan seperti huruf timah di percetakan nota, ditemani tulisan tangan pendek dari pulpen karbon.

### Hierarchy
- **Display** (800, clamp 2rem sampai 3.7rem, 1.02, wdth 82): judul penawaran di meja. Baris kedua (janji biaya) turun ke baris baru berwarna amber.
- **Headline** (900, clamp 1.7rem sampai 2.6rem, 1.05, wdth 80): judul bagian (Setelah nota dikirim, Datang ke workshop).
- **Title** (900, 1.05rem sampai 1.15rem, kapital, 0.03em sampai 0.04em, wdth 70 sampai 75): judul cetak di kertas: Tanda Terima Servis, label langkah, Tiket servis digital.
- **Body** (400, 1rem, 1.55, wdth 96): paragraf. Lebar baris dibatasi 38ch sampai 52ch.
- **Label** (800, 0.78rem, 0.05em, kapital, wdth 75): label baris formulir di nota (Perangkat, Keluhan, Estimasi biaya).
- **Brand** (900, 1.2rem, wdth 118): nama toko NUARA, dengan SERVICE di 600, 0.7em, jarak huruf 0.18em sampai 0.2em.
- **Numerator** (800, 1.6rem, wdth 62, angka tabular): nomor nota saja.
- **Hand** (Kalam 700, 1.2rem pada isian; 400 1.05rem pada pratinjau): isian pelanggan.

### Named Rules
**The Lebar Adalah Hierarki Rule.** Bedakan peran dengan sumbu lebar Archivo: sempit (62 sampai 82) untuk angka, label, dan judul; normal (96 sampai 100) untuk bacaan dan tombol; lebar (110 sampai 118) hanya untuk nama merek.

**The Kalam Pendek Rule.** Kalam hanya untuk isian satu baris dan pratinjau pesan. Tidak pernah untuk judul, paragraf, atau tombol.

## Layout

Satu kolom, dirancang dari HP. Kontainer maksimal 1200px dengan gutter 18px di bawah 640px dan 28px ke atas. Bar atas lengket (60px) dengan scroll-padding 72px.

- **< 640px:** nota harus terlihat di layar pertama. Jarak hero dirapatkan (atas 22px, gap 26px), alamat di kepala nota disembunyikan, baris nota dirapatkan (10px 0 8px), dua tombol di hero berbagi lebar penuh (48px).
- **>= 640px:** nota berpadding 32px, nomor nota pindah ke kolom kanan kepala nota, perangkat berjajar tiga kolom, alur menjadi dua kolom.
- **>= 820px:** navigasi bar muncul; bagian lokasi menjadi dua kolom (teks dan kartu nama).
- **>= 1080px:** meja konter penuh. Hero dua kolom 5fr/6fr dengan gap 64px; kolom penawaran lengket (top 108px) sementara nota bergulir di kanan, nota miring -0.8deg dan rangkapnya lebih menyebar. Alur menjadi empat kolom.

Ritme vertikal di dalam kertas memakai 10px, 14px, dan 26px; jarak bagian di meja 56px sampai 104px, membesar di layar lebar.

## Elevation & Depth

Hibrida yang tegas: meja datar, kertas terangkat. Semua bayangan adalah bayangan kertas di atas meja, dua lapis (kontak tipis plus jatuhan lunak lebar), selalu hitam transparan, tidak pernah berwarna dan tidak pernah offset keras. Kedalaman juga dibangun dengan tumpukan: dua lembar rangkap diputar berlawanan di belakang nota.

### Shadow Vocabulary
- **Kertas nota** (`box-shadow: 0 2px 3px rgba(0,0,0,0.18), 0 18px 40px -12px rgba(0,0,0,0.5)`): lembar atas nota.
- **Kertas lembar** (`box-shadow: 0 2px 3px rgba(0,0,0,0.18), 0 18px 40px -16px rgba(0,0,0,0.45)`): lembar alur teal.
- **Kartu nama** (`box-shadow: 0 2px 3px rgba(0,0,0,0.2), 0 20px 36px -14px rgba(0,0,0,0.55)`): kartu nama di bagian lokasi.
- **Cincin logo** (`box-shadow: 0 0 0 1px rgba(255,255,255,0.24)`): logo kecil di bar, agar tepi navy logo terpisah dari meja.
- **Cincin ganda cap** (`box-shadow: inset 0 0 0 3px paper, inset 0 0 0 4.5px currentColor`): garis dalam cap bulat; bukan elevasi.

### Named Rules
**The Hanya Kertas Terangkat Rule.** Tombol, navigasi, dan bar tidak berbayang. Bayangan hanya milik benda kertas yang tergeletak di meja.

**The Miring Tipis Rule.** Kertas diputar sedikit: nota -0.8deg (desktop), lembar teal -0.4deg, kartu nama -3deg, rangkap 2.2deg sampai 3deg dan -1.4deg sampai -2deg. Tombol dan teks di meja selalu lurus.

## Shapes

Sudut kertas hampir tajam (3px), kartu nama sedikit lebih lembut (6px), kontrol yang bisa ditekan 8px, kotak centang 2px, cap bulat penuh (elips 50%). Garis adalah bahasa bentuk utama: garis tebal 2px tinta di bawah kepala nota dan label langkah, garis isian 1px, garis titik-titik untuk kolom kosong, garis sobek putus-putus 2px di atas lembar pelanggan. Tepi atas nota berlubang (titik 2.4px setiap 13px dalam warna meja). Kartu nama berproporsi 85:55 dengan garis atas amber 6px.

## Components

### Buttons
Mantap dan berisi, tanpa bayangan.
- **Shape:** sudut kontrol (8px), tinggi minimal 44px sampai 54px.
- **Kirim nota (utama di kertas):** tinta navy penuh lebar, teks putih 800 1.05rem, ikon WhatsApp 22px. Hover ke Navy Hover, active turun 1px.
- **Amber (utama di meja):** amber dengan teks tinta, 800, tinggi 50px. Hover ke Amber Terang. Dipakai untuk rute ke workshop dan chat di bar.
- **Garis (sekunder di meja):** bingkai 2px teks di meja redup, teks putih; hover bingkai menjadi putih.
- **Hover / Focus:** transisi warna 0.2s dengan ease keluar. Fokus: garis 3px amber berjarak 3px di meja, karbon di dalam kertas.

### Inputs / Fields
- **Kotak centang (tick):** kotak 22px bingkai tinta 2px, input asli transparan di atasnya, seluruh baris label menjadi target sentuh 44px. Saat dicentang, centang tangan karbon (stroke 3.2) tergores dari kiri ke kanan dalam 0.28s dan keluar sedikit dari kotak. Radio dan checkbox memakai bentuk yang sama.
- **Garis isian:** tanpa bingkai, hanya garis bawah titik-titik 1.5px; teks Kalam karbon; placeholder tinta pudar 400.
- **Pratinjau:** keluaran Kalam karbon "Akan terkirim: ..." yang diperbarui langsung, disembunyikan saat kosong.

### Navigation
Bar navy 97% lengket dengan garis bawah meja terangkat. Merek: logo 36px plus nama 800 wdth 110. Tautan (muncul dari 820px) 600 teks redup, hover putih di atas meja terangkat, sudut 6px. Tombol Chat WhatsApp amber selalu di kanan, termasuk di HP.

### Nota (Signature Component)
Formulir tanda terima di atas tumpukan rangkap. Kepala: logo 56px, nama toko, baris kecil alamat dan WA, janji teknisi tebal, lalu judul Tanda Terima Servis dan nomor numerator dengan kolom kosong titik-titik. Baris-baris berlabel dipisah garis isian. Grup keluhan berganti sesuai perangkat yang dicentang.

### Cap Bulat
Elips 196px, bingkai 3px ditambah garis dalam, tinta merah cap, Archivo 900 wdth 62 kapital, diputar -8deg dan dikasarkan dengan filter SVG `ink-rough` (feTurbulence plus feDisplacementMap, skala 1.6). Jika berada di bawah layar pertama, cap turun sekali dari skala 1.08 dan transparan saat terlihat (0.45s). Dilewati saat prefers-reduced-motion.

### Lembar Pelanggan
Sobekan amber di dasar nota, selebar nota, dipisah garis sobek putus-putus tinta 2px. Tab "lembar pelanggan" putih dengan ikon gunting menumpang di garis sobek.

### Lembar Alur
Kertas teal miring berisi langkah bernomor dengan label bergaris bawah tinta. Langkah yang memuat janji biaya dicetak terbalik: latar tinta, teks teal.

### Kartu Nama
Alamat dan WA sebagai teks yang bisa disalin, dalam kartu putih 85:55 bergaris atas amber, miring -3deg.

## Do's and Don'ts

### Do:
- **Do** letakkan setiap isi baru di atas benda kertas (nota, lembar, kartu) atau langsung di meja navy; tidak ada permukaan ketiga.
- **Do** pakai Archivo dengan sumbu lebar sebagai pembeda peran (wdth 62 sampai 118) sebelum menambah ukuran atau warna.
- **Do** tulis isian pelanggan dengan Kalam karbon biru, dan cetakan toko dengan Archivo tinta navy.
- **Do** beri bayangan dua lapis hitam transparan hanya pada kertas, dan putar kertas tipis (di bawah 3deg, kartu nama 3deg).
- **Do** jaga target sentuh minimal 44px dan cincin fokus 3px (amber di meja, karbon di kertas).
- **Do** hormati prefers-reduced-motion: gerak hanya goresan centang dan cap, masing-masing sekali.

### Don't:
- **Don't** pakai oranye numerator untuk teks kecil atau lebih dari satu nomor nota; kontrasnya hanya cukup untuk ukuran besar.
- **Don't** tambah cap kedua; cap bulat hanya milik kolom Estimasi biaya.
- **Don't** pakai Kalam untuk judul, paragraf, atau tombol.
- **Don't** beri bayangan pada tombol atau navigasi, dan jangan pakai bayangan offset keras.
- **Don't** ganti bukti dengan foto stok, ilustrasi generik, atau gambar orang; citra satu-satunya adalah logo asli.
- **Don't** kembali ke susunan kategori (hero, kartu layanan berikon, "kenapa kami", tombol WhatsApp mengambang).
