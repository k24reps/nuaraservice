---
version: 1
slug: "dashboard-src-features-tracking-trackingpage-tsx"
primary_target: "dashboard/src/features/tracking/TrackingPage.tsx"
related_targets: []
---

Scope: halaman lacak pelanggan S-07 di dashboard (dashboard/src/features/tracking/TrackingPage.tsx, rute /t/<kode> dan /track), mode Operate untuk pelanggan: satu tugas, tahu status servis perangkatnya tanpa bertanya di WhatsApp. Pelanggan membuka dari tautan WA atau QR nota, hampir selalu dari HP, sekali lihat lalu pergi. Isi yang boleh tampil (PRD F-04.2): nomor tiket, perangkat, jenis, tahap, riwayat tahap + waktu, garansi, kontak toko, catatan toko, S&K yang disetujui. Tidak tampil: nomor WA pelanggan, password, kondisi fisik, diagnosa, biaya. Dunia visual sudah ditetapkan Pemilik (DESIGN.md "Nota Servis Rangkap", DBD bagian 1 dan 2); sapaan "kamu". Tanpa gambar baru: satu-satunya citra adalah logo toko.

## Direction contract

THESIS: Halaman ini adalah salinan nota milik pelanggan itu sendiri, sudah diisi dan dicap bengkel; cap bulat adalah statusnya. Menolak dasbor status: tanpa kartu metrik, progress bar, atau spinner raksasa.

OWN-WORLD: Meja konter navy (#062036) datar. Lembar putih tinta navy miring tipis dengan lubang sobekan, rangkap teal (alur servis) dan amber (lembar pelanggan: garansi) mengintip. Isian terisi karbon biru (#2536A0), nomor tiket numerator oranye (#FC5B02) besar, satu cap bulat merah (#C43F00) berganda garis. Archivo variabel: lebar sempit untuk label dan angka, lebar lebar untuk nama toko. Kotak centang cetak 22px, garis putus-putus. Tanpa Kalam.

STORY: Pelanggan melihat nomor tiketnya, perangkatnya, dan cap status dalam satu layar pertama, membaca satu kalimat apa yang harus ia lakukan (sering: tidak ada), lalu menggulir ke alur, garansi, dan tombol chat WhatsApp bila perlu.

FIRST VIEWPORT: HP 390px: meja navy, nota di bawah jarak 24px dengan logo, nama toko, "NOTA SERVIS" dan nomor tiket oranye; baris Perangkat dan Jenis; cap bulat berisi tahap dan waktunya; satu kalimat langkah berikut. Garansi (amber) mulai di sepertiga bawah layar pertama bila tiketnya selesai. Desktop: kolom 560px di tengah meja; tautan "Lacak nomor lain" di atas, kecil, di meja.

FORM: Nota Servis Rangkap (landing page), diterapkan sebagai salinan yang sudah diisi. Dibangun code-led tanpa komp (tak ada alat gambar); satu momen gerak: cap mendarat sekali (skala 1,1 ke 1, 0,45 detik, ease-out ekspo), mati bila reduced-motion. seed key: tidak ada; dunia dan struktur sudah ditetapkan Pemilik (DESIGN.md, DBD bagian 1 dan 7), jadi pengundian arah tak berlaku untuk permintaan sespesifik ini.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
