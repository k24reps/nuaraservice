# Log Wawancara - Dashboard Nuara Service

> Status: selesai | Putaran terakhir selesai: P13 (2026-11-21, fork FixMaster) | Pertanyaan dijawab: 230 (222 sampai 2026-11-04 + 8 di P13) | Sumber terserah: 16, semuanya sudah disetujui atau diubah user; [ASUMSI] tersisa: 0 | Diperbarui: 2026-11-21
<!-- Status: berjalan -> siap-tulis (P12 dikonfirmasi) -> selesai (dokumen ditulis).
Sumber: user = dipilih atau diketik user (termasuk memilih opsi Rekomendasi);
terserah = user menyerahkan, AI memakai rekomendasi -> [ASUMSI];
dipercepat = user minta sisa wawancara diisi rekomendasi -> [ASUMSI];
repo = dikonfirmasi user dari kondisi kode. -->

Konteks repo (Fase 1): landing page statis di root (index.html, style.css, script.js, assets/), tanpa package.json, repo git dengan remote GitHub, deploy ke Vercel. Tiket servis saat ini memakai FixMaster (PRODUCT.md).

| Kode | Topik | Jawaban | Sumber | Dipakai di |
|---|---|---|---|---|
| P0.1 | Tujuan proyek | Dipakai Nuara Service saja (satu workshop) | user | PRD 1, BSD 3 |
| P0.2 | Profil teknis | Bisa sedikit coding (review Fase 5; awalnya terserah: non-teknis) | user | gaya pertanyaan, TRD 1, CLAUDE.md |
| P0.3 | Target rilis | Belum ada target | user | IPD ringkasan fase |
| P0.4 | Waktu per minggu | > 30 jam | user | IPD estimasi |
| P1.1 | Nama produk | Nuara Dashboard | user | semua |
| P1.2 | Masalah | Menggantikan FixMaster (diketik user) | user | PRD 1-2 |
| P1.3 | Pengguna | Pemilik, teknisi, admin konter; pelanggan hanya menerima link tracking servis (tanpa akun) | user | PRD 2, 4, AFD 1, BSD 5 |
| P1.4 | Cara sekarang | FixMaster (tersirat dari P1.2 dan PRODUCT.md); pilihan lain tidak dijawab | user | PRD 2 |
| P1.4a | Kekurangan FixMaster | Biaya langganan | user | PRD 2 |
| P1.4b | Fitur FixMaster yang wajib ada | Absensi, laporan, stok sparepart (inventori), tiket + nomor tiket, link tracking pelanggan, kabar status ke WA, cetak tanda terima | user | P4, PRD 5 |
| P1.5 | Nilai utama (urutan) | 1) Tracking berbrand Nuara 2) Semua urusan di satu tempat 3) Angka usaha yang jelas 4) Hemat biaya bulanan | user | PRD 1 |
| P1.6 | Skala | 100-200 tiket servis per bulan (diketik user) | user | TRD 8, BSD indeks |
| P2.1 | Metrik | Semua tiket di dashboard; langganan FixMaster berhenti; tiket cepat dibuat di konter; link tracking | user | PRD 3 |
| P2.1a | Target: semua tiket di dashboard | 100% tiket baru dalam 1 minggu sejak dashboard dipakai | user | PRD 3 |
| P2.1b | Target: berhenti FixMaster | Maks 1 bulan setelah rilis | user | PRD 3, IPD |
| P2.1c | Target: waktu buat tiket | <= 2 menit per tiket di konter | user | PRD 3, F-xx kriteria |
| P2.1d | Target: link tracking | Link dikirim ke WA pelanggan sesaat setelah unit diterima (diketik user; dibaca sebagai 100% tiket) | user | PRD 3 |
| P2.2 | Model bisnis | Alat internal; pelanggan bayar di workshop, pembayaran dicatat staf; tanpa payment gateway | user | PRD 6-7, TRD |
| P2.3 | Risiko produk | Staf kembali ke cara lama (kertas/FixMaster) jika dashboard lambat atau ribet (disetujui di review Fase 5) | user | PRD 8 |
| P2.4 | Data lama FixMaster | Mulai baru; tiket lama diselesaikan di FixMaster, tanpa impor | user | BSD 7, IPD |
| P3.1 | Peran | Pemilik, Teknisi, Admin konter; pelanggan tanpa akun (hanya link tracking per tiket) | user | PRD 4, AFD 1, BSD 5 |
| P3.2 | Cara akun dibuat | Dibuat oleh Pemilik; tidak ada daftar mandiri | user | AFD, BSD 5, F-08 |
| P3.3 | Organisasi | Satu workshop | user | BSD 3, 5 |
| P3.4 | Istilah utama | Tiket servis (nomor berawalan NS-) | user | PRD 4, semua |
| P3.5 | Jumlah akun | 4-6 orang termasuk pemilik | user | TRD 8, BSD 7 seed |
| P3.6 | Izin Admin konter | Buat tiket + cetak, catat pembayaran, kelola stok sparepart, lihat catatan keuangan harian; TIDAK boleh lihat laporan keuangan bulanan (omzet, profit) | user | BSD 5, AFD 1 |
| P3.7 | Izin Teknisi | Update status + catatan, isi estimasi biaya, pakai sparepart dari stok; tidak membuat tiket | user | BSD 5, AFD 1 |
| P3.8 | Tiket yang terlihat Teknisi | Semua tiket terlihat; hanya tiket yang ditugaskan ke dirinya yang bisa diubah | user | BSD 5 |
| P3.9 | Izin Pemilik | Semua, termasuk kelola akun staf dan pengaturan workshop | user | BSD 5 |
| P4.1 | Fitur dipilih | 15 fitur (semua kandidat kecuali ekspor Excel) | user | PRD 5 |
| P4.2 | Prioritas P0 | F-01 Terima unit + buat tiket, F-02 Status + tugaskan teknisi, F-03 Estimasi + persetujuan, F-04 Halaman tracking pelanggan, F-05 Kabar status ke WA (+ pesan minta ulasan saat unit diambil, diketik user) | user | PRD 5 |
| P4.3 | Prioritas P1 | F-06 Cetak tanda terima, F-07 Catat pembayaran, F-08 Kelola akun staf (akun awal lewat seed), F-09 Stok sparepart, F-10 Absensi staf, F-11 Catat pengeluaran, F-12 Laporan keuangan bulanan, F-13 Beranda ringkasan, F-14 Data pelanggan + riwayat, F-15 Klaim garansi | user | PRD 5 |
| P4.4 | Di luar scope | Aplikasi HP (Play Store), penggajian dari absensi, booking online pelanggan, ekspor Excel; ditambah pembayaran online (P2.2) dan multi-cabang (P3.3) | user | PRD 6 |
| P5.F01.1 | Data tiket | Wajib: nama pelanggan, nomor WA, jenis perangkat (Laptop/PC, HP, Elektronik rumah tangga), merek + tipe, keluhan. Tambahan: kelengkapan dibawa, kondisi fisik, password/pola kunci, keluhan pilihan (template), uang muka (DP). Tanpa foto, tanpa IMEI, tanpa perkiraan selesai | user | PRD F-01, BSD tickets, AFD F-01 |
| P5.F01.1a | Template | Daftar keluhan dan template lain (kelengkapan, teks WA) bisa diatur di Pengaturan (diketik user) | user | F-16 |
| P5.F01.2 | Nomor tiket | NS-00001, urut terus tanpa reset | user | PRD F-01, BSD tickets |
| P5.F01.3 | Gagal simpan (koneksi putus) | Isian tetap di form + pesan + tombol Coba lagi | user | PRD F-01, AFD F-01 |
| P5.F01.4 | Sukses | Halaman detail tiket + tombol kirim link tracking ke WA | user | AFD F-01 |
| P5.F01.5 | Prioritas Pengaturan template | F-16 Pengaturan template = P1; isi awal dari nota landing page sejak P0 | user | PRD 5, BSD seed |
| P5.F01.6 | DP | DP dicatat sebagai pembayaran pertama sejak P0 (tabel pembayaran dibuat di P0) | user | BSD payments, IPD |
| P5.F01.7 | Ubah/hapus tiket | Admin & Pemilik boleh ubah; tiket tidak dihapus, hanya Dibatalkan | user | BSD 5, PRD F-01 |
| P5.F02.0 | Referensi alur status | User minta cek demo fixmaster.app; terlihat: Diterima, Diagnosa (boleh dilewati), Konfirmasi biaya, Tunggu part, Pengerjaan, Selesai, Lunas, Dibatalkan; status ambil terpisah | user | BSD 4 |
| P5.F02.1 | Tahap servis | Diterima -> Diagnosa (boleh dilewati) -> Konfirmasi biaya -> Tunggu part (boleh dilewati) -> Pengerjaan -> Selesai (siap diambil) -> Diambil (memicu pesan minta ulasan); Dibatalkan dari tahap mana pun sebelum Diambil (sejak A3: dari Diterima sampai Selesai, lalu Dikembalikan); lunas dihitung dari pembayaran | user | BSD 4, AFD F-02, F-04 |
| P5.F02.2 | Penugasan teknisi | Admin & Pemilik menugaskan | user | BSD 5, AFD F-02 |
| P5.F02.3 | Tahap mundur | Admin/Pemilik boleh mundur 1 tahap; tercatat di riwayat (nama + waktu) (disetujui di review Fase 5) | user | BSD 4, PRD F-02 |
| P5.F02.4 | Catatan teknisi | Diganti jawaban user di P5.F04.3: semua catatan internal (awalnya terserah: dua jenis) | user | BSD ticket_events, F-02.5 |
| P5.F02.5 | Gagal: teknisi buka tiket orang lain | Bisa lihat, tombol ubah tidak tampil; server menolak jika dipaksa | user | PRD F-02, BSD 5 |
| P5.F02.6 | Sukses ubah tahap | Notifikasi + tombol kirim WA untuk tahap yang perlu dikabarkan | user | AFD F-02 |
| P5.F02.7 | Yang boleh ubah tahap | Teknisi yang ditugaskan (tiketnya sendiri) + Admin + Pemilik (semua tiket); Dibatalkan hanya Admin/Pemilik (P5.F01.7) | user | BSD 5 |
| P5.F03.1 | Data estimasi | Estimasi biaya (satu angka total), hasil diagnosa, perkiraan lama pengerjaan; tanpa rincian per baris | user | PRD F-03, BSD tickets |
| P5.F03.2 | Cara persetujuan | Staf menandai Disetujui/Ditolak berdasarkan balasan pelanggan di chat WA | user | PRD F-03, AFD F-03 |
| P5.F03.3 | Kunci pengerjaan | Tahap Pengerjaan terkunci sampai persetujuan tercatat; kecuali tiket Express (diketik user) | user | PRD F-03, BSD 4 |
| P5.F03.3a | Tiket Express | Dicentang saat buat tiket untuk pelanggan yang menunggu di tempat (pekerjaan ringan); admin isi estimasi, persetujuan lisan langsung tercatat, tiket langsung ke Pengerjaan | user | PRD F-01, F-03, BSD tickets |
| P5.F03.4 | Biaya naik dari estimasi | Cukup dicatat di biaya final; tanpa persetujuan ulang | user | PRD F-03 |
| P5.F03.5 | Biaya cek saat ditolak | Diisi per tiket saat Dibatalkan, boleh Rp0; tanpa angka bawaan | user | PRD F-03, BSD tickets |
| P5.F03.6 | Biaya final | Diisi saat Selesai; nilai awal = estimasi, bisa diubah | user | PRD F-03, BSD tickets |
| P5.F03.7 | Pelanggan belum membalas | Tiket 2 hari di Konfirmasi biaya ditandai "perlu ditindaklanjuti" | user | PRD F-03, AFD 4 |
| P5.F04.1 | Isi tracking | Nomor tiket, perangkat, tahap saat ini, riwayat tahap + waktu, masa garansi (diketik user), kontak & rute workshop, kelengkapan dititipkan, nama depan teknisi (sesuai deskripsi opsi), nama pelanggan disamarkan. Tidak tampil: catatan, diagnosa, estimasi, pembayaran | user | PRD F-04, AFD F-04 |
| P5.F04.2 | Garansi | Per tiket, nilai awal dari Pengaturan; dua jenis: garansi jasa dan garansi sparepart (jumlah hari masing-masing). Durasi diisi pemilik, tidak dikarang | user | PRD F-04, F-15, BSD tickets |
| P5.F04.3 | Catatan teknisi | Semua internal (mengganti jawaban terserah P5.F02.4) | user | BSD ticket_events |
| P5.F04.4 | Bentuk link | Kode acak panjang, tidak bisa ditebak | user | PRD F-04, BSD tickets |
| P5.F04.5 | Masa aktif link | Sampai 30 hari setelah masa garansi terpanjang habis (diketik user) | user | PRD F-04 |
| P5.F04.6 | Link salah/tidak aktif | Pesan "Link ini tidak ditemukan atau sudah tidak aktif..." + tombol chat WA | user | AFD F-04 |
| P5.F05.1 | Cara kirim WA | Tombol membuka WhatsApp workshop dengan pesan + link terisi (wa.me); staf menekan kirim. Tanpa API berbayar | user | PRD F-05, TRD 1 |
| P5.F05.2 | Pemicu pesan | Diterima (link tracking), Selesai (siap diambil), Diambil (minta ulasan) | user | PRD F-05, AFD 5 |
| P5.F05.3 | Link ulasan Google | Diisi Pemilik di Pengaturan; sebelum diisi, pesan ulasan tidak ditawarkan; sebelum F-16 ada, lewat data awal | user | PRD F-05, F-16, BSD settings |
| P5.F05.4 | Tiket Express | Mendapat pesan WA sama seperti tiket biasa | user | PRD F-05 |
| P5.F05.5 | Catat kirim WA | Catat waktu + nama saat tombol ditekan; tiket yang linknya belum dikirim diberi penanda | user | PRD 3, F-05, BSD |
| P5.F05.6 | Nomor WA | Nomor Indonesia saja: 08xx/62xx/+62; diperjelas di A5: 08xx 10-13 digit, 628xx 11-14 digit, disimpan sebagai 628 + 8-11 digit; format salah ditolak dengan pesan di bawah kolom | user | PRD F-01, BSD customers |
| P5.F06.1 | Printer | Thermal 58 mm dan 80 mm | user | PRD F-06, DBD |
| P5.F06.2 | Isi tanda terima | Logo, nama, alamat workshop, WA workshop, nomor tiket, data pelanggan, perangkat, keluhan, QR link tracking, kelengkapan + kondisi fisik, S&K dari Pengaturan; tanpa kolom tanda tangan | user | PRD F-06 |
| P5.F06.3 | Alamat | Alamat pelanggan tidak dicatat di form mana pun; alamat workshop tetap tercetak | user | BSD customers, PRD F-06 |
| P5.F06.4 | Ukuran + cetak ulang | Ukuran dipilih Pemilik di Pengaturan; cetak ulang bebas dari detail tiket | user | PRD F-06, F-16 |
| P5.F07.1 | Data pembayaran | Metode bayar = akun kas (satu hal yang sama); split payment boleh; diskon; nota pelunasan (cetak 58/80 mm atau kirim WA) | user | PRD F-07, BSD payments |
| P5.F07.2 | Ambil sebelum lunas | Tombol Diambil terkunci sampai lunas; Pemilik bisa mengizinkan dengan alasan | user | PRD F-07, BSD 4 |
| P5.F07.3 | Diskon | Admin & Pemilik bebas memberi diskon, tanpa alasan | user | PRD F-07, BSD 5 |
| P5.F07.4 | Koreksi pembayaran | Dibatalkan dengan alasan (tetap terlihat) lalu dicatat ulang; tidak bisa diedit/dihapus | user | PRD F-07, BSD payments |
| P5.F08.1 | Data akun staf | Nama, peran, status aktif, jadwal kerja; tanpa email dan nomor WA | user | PRD F-08, BSD users, TRD 5 |
| P5.F08.2 | Staf berhenti | Akun dinonaktifkan, tidak dihapus; nama tetap di data lama | user | PRD F-08, BSD 5 |
| P5.F09.1 | Data sparepart | Nama, jumlah stok, harga modal, harga jual, stok minimum; barang stok juga bisa dijual langsung (aksesoris) | user | PRD F-09, BSD parts |
| P5.F09.2 | Barang masuk | Jumlah + harga beli; harga modal rata-rata otomatis; pembelian tercatat sebagai uang keluar | user | PRD F-09, BSD |
| P5.F09.3 | Stok 0 saat dipakai | Ditolak (stok tidak boleh minus); part dibeli khusus untuk tiket dicatat sebagai "beli dadakan" (modal tiket, tanpa masuk stok) | user | PRD F-09, BSD |
| P5.F09.4 | Koreksi stok | Admin & Pemilik, wajib alasan, tercatat di riwayat barang | user | PRD F-09, BSD |
| P5.F17.1 | Fitur baru: Jual barang langsung | Prioritas P1 | user | PRD 5 |
| P5.F17.2 | Alur jual | Pilih barang + jumlah, bayar (split, diskon boleh), cetak/kirim nota; nama & WA pembeli opsional | user | PRD F-17, BSD sales |
| P5.F10.1 | Cara absen | Tombol Masuk/Pulang di aplikasi + lokasi GPS; waktu dari server | user | PRD F-10, TRD |
| P5.F10.2 | Lupa Pulang | Ditandai "tanpa jam pulang"; Pemilik mengisi jam pulang dengan alasan | user | PRD F-10 |
| P5.F10.3 | Radius | 100 meter dari titik workshop (titik diset Pemilik di Pengaturan); sejak A10 radius tetap 100 m dan absen di luar radius ditolak | user | PRD F-10, F-16 |
| P5.F10.4 | GPS ditolak/tidak terbaca | Tetap boleh absen, ditandai "lokasi tidak terverifikasi" | user | PRD F-10, BSD |
| P5.F10.5 | Terlambat | Toleransi menit diatur Pemilik di Pengaturan (boleh 0), dibanding jadwal kerja staf | user | PRD F-10, F-16 |
| P5.F11.1 | Data pengeluaran | Tanggal, nominal, akun kas sumber, keterangan; tanpa kategori, tanpa foto | user | PRD F-11, BSD expenses |
| P5.F11.2 | Yang mencatat | Admin & Pemilik; koreksi lewat batal + catat ulang | user | BSD 5 |
| P5.F11.3 | Saldo kurang | Pengeluaran ditolak jika melebihi saldo akun kas | user | PRD F-11 |
| P5.F11.4 | Saldo kas | Saldo awal tiap akun kas diisi Pemilik di Pengaturan; ada catatan pindah saldo antar akun oleh Admin/Pemilik | user | PRD F-11, F-16, BSD |
| P5.F12.1 | Isi laporan bulanan | Omzet, biaya sparepart, pengeluaran, profit, kategori perangkat yang masuk (diketik user), jumlah tiket per status, kinerja per teknisi, banding bulan lalu; servis dan jual barang tidak dipisah | user | PRD F-12 |
| P5.F12.2 | Dasar bulan | Servis dihitung di bulan unit Diambil | user | PRD F-12, BSD |
| P5.F13.1 | Beranda Pemilik | Perlu tindakan, tiket aktif per tahap, kas hari ini per akun, stok menipis + absensi hari ini | user | PRD F-13, AFD |
| P5.F13.2 | Beranda per peran | Admin: sama dengan Pemilik tanpa angka bulanan; Teknisi: tiket yang ditugaskan + tombol absen | user | PRD F-13, AFD 1 |
| P5.F14.1 | Isi halaman pelanggan | Nama, nomor WA, riwayat semua tiket (disetujui di review Fase 5) | user | PRD F-14 |
| P5.F14.2 | Nomor WA terdaftar | Tawarkan data lama; satu nomor WA = satu pelanggan | user | PRD F-14, BSD customers |
| P5.F15.1 | Alur klaim | Tombol "Klaim garansi" di tiket lama membuat tiket baru terhubung; pilih garansi jasa/sparepart; biaya awal Rp0 | user | PRD F-15, BSD tickets |
| P5.F15.2 | Garansi habis | Klaim ditolak; dibuat sebagai tiket biasa | user | PRD F-15 |
| P5.F16.1 | Isi Pengaturan | Daftar keluhan, daftar kelengkapan, teks WA (diterima, selesai, diambil), S&K tanda terima, link ulasan Google, ukuran printer, akun kas + saldo awal, garansi awal (jasa, sparepart), titik lokasi workshop + toleransi terlambat; hanya Pemilik | user | PRD F-16, BSD settings |
| P5.F09.5 | Sparepart di tiket vs tagihan | Tidak menambah tagihan; hanya mengurangi stok dan menjadi modal tiket | user | PRD F-09, F-12 |
| P5.F09.6 | Sparepart batal dipasang | Tombol Kembalikan (Teknisi/Admin) selama tiket belum Diambil; stok bertambah, tercatat | user | PRD F-09 |
| P5.F17.3 | Jual melebihi stok | Ditolak + tampil sisa stok | user | PRD F-17 |
| P5.F17.4 | Yang boleh jual | Admin & Pemilik | user | BSD 5 |
| P6.1 | Layar awal | Langsung halaman masuk; landing page tetap terpisah; tracking lewat link sendiri | user | AFD 1-2 |
| P6.2 | Navigasi | Sidebar di laptop (>= 1024px), 4 tab bawah di HP (Beranda, Tiket, Absen, Lainnya) | user | AFD 2, DBD 3 |
| P6.3 | Setelah login | Beranda per peran (F-13); sebelum F-13 jadi: Admin/Pemilik ke daftar tiket, Teknisi ke tiket miliknya | user | AFD 5 |
| P6.4 | State kosong | Teks singkat + tombol aksi, tanpa ilustrasi | user | AFD 4, DBD 3 |
| P6.5 | Notifikasi staf | Teknisi: tiket ditugaskan; Admin + Pemilik: estimasi siap dan tiket Selesai; Pemilik: minta izin ambil belum lunas (disetujui di review Fase 5) | user | AFD 5 |
| P6.5a | Saluran notifikasi | Tanda di dalam aplikasi (lonceng + daftar); tanpa push | user | AFD 5, TRD |
| P6.6 | Pesan error | Spesifik + solusi | user | AFD 3 |
| P6.7 | Tanpa izin | Belum login: ke halaman masuk lalu kembali; peran tak berizin: "Halaman ini khusus <peran>" + tombol ke Beranda | user | AFD 5 |
| P6.8 | Offline | Pita "Tidak ada koneksi"; isian tidak hilang; tombol Coba lagi | user | AFD 3 |
| P7.1 | Platform | Web responsif yang bisa dipasang di HP (PWA, tanpa push) | user | TRD 1, DBD 4 |
| P7.2 | Stack | Next.js + Tailwind CSS + shadcn/ui + Better Auth (diketik user); Better Auth diganti Supabase Auth, lihat A1 | user | TRD 1-3 |
| P7.2a | Database | Supabase Postgres | user | TRD 1, BSD |
| P7.2b | Lokasi kode | Folder dashboard/ di repo ini; landing page di root tidak disentuh; proyek Vercel kedua | user | TRD 3, 6 |
| P7.3 | Biaya | Gratis dulu (paket gratis Vercel + Supabase) | user | TRD 1, 6 |
| P7.4 | Login | Username + password (sejak A1: Supabase Auth dengan email sintetis) | user | TRD 5 |
| P7.5 | Kebutuhan | Tanpa upload file, tanpa pembayaran online, tanpa email, tanpa ekspor Excel; perlu pencarian/filter tiket, QR code, cetak thermal via browser, GPS via browser | user | TRD 1, AFD |
| P7.5a | Realtime | Ya: daftar + detail tiket, beranda, halaman tracking; tidak untuk notifikasi | user | TRD 1-2 |
| P7.5b | Cara realtime | Supabase Realtime (instan) | user | TRD 1-2, 9 |
| P7.7 | Tes | Unit + E2E alur P0 | user | TRD 7, IPD |
| P7.8 | CI/CD | GitHub Actions: lint + tes | user | TRD 6 |
| P7.4a | Sesi | 30 hari; Pemilik bisa memaksa logout saat menonaktifkan akun | user | TRD 5 |
| P7.4b | Lupa password staf | Pemilik membuat password sementara; staf wajib ganti saat login berikutnya | user | TRD 5, F-08 |
| P7.4c | Lupa password Pemilik | Perintah reset darurat dari komputer pengembang | user | TRD 5, 7 |
| P7.9 | Domain | nuaraservice.my.id (diketik user); dashboard app.nuaraservice.my.id, tracking lacak.nuaraservice.my.id/<kode> | user | TRD 6, F-04 |
| P8.1a | Password/pola unit | Terenkripsi; hanya teknisi yang ditugaskan, Admin, Pemilik yang bisa membuka (tercatat); dihapus otomatis saat Diambil atau Dibatalkan | user | BSD 8, TRD 5 |
| P8.1b | GPS absen | Simpan status dalam radius + jarak (meter) saja, bukan koordinat | user | BSD 8 |
| P8.3 | Backup | Mingguan otomatis (GitHub Actions, Minggu malam, simpan 8 salinan terakhir); rencana user: setelah semua rampung, migrasi ke Supabase self-host (CLI/Docker) di VPS (diketik user) | user | BSD 8, TRD 6, 9 |
| P8.4 | Regulasi | UU PDP Indonesia | user | PRD 7, BSD 8 |
| P8.2 | Hapus data pelanggan | Disamarkan oleh Pemilik (nama + WA diganti "Pelanggan dihapus"); tiket dan angka tetap | user | BSD 2, 8 |
| P8.6 | Riwayat perubahan | Ya untuk data penting: tahap, estimasi, biaya final, pembayaran, stok, koreksi absensi, akun staf (siapa, kapan, sebelum-sesudah) | user | BSD 3, 8 |
| P8.5 | Retensi | Selamanya | user | BSD 8 |
| P8.7 | Anti-spam login | 5x salah per 15 menit -> username dikunci 15 menit (sejak A15/R12: kunci per pasangan username + IP, ditambah batas 20 kegagalan per IP) | user | TRD 5 |
| P8.8 | Salinan data pelanggan | Admin/Pemilik mengirim ringkasan dari halaman pelanggan lewat WA; tanpa fitur khusus | user | BSD 8 |
| P9.1 | Kesan | Tracking memakai dunia "nota servis" landing page; dashboard memakai warna + huruf yang sama, lebih tenang dan padat. Eksekusi visual lewat skill impeccable | user | DBD 1 |
| P9.2 | Palet | Kertas & tinta: background #F4F6F9, surface #FFFFFF, text #062036, text-muted #5B6776, primary #062036, accent #FAA403, danger #B42318, success #067647, warning #B54708 | user | DBD 2 |
| P9.3 | Font | Archivo (seperti landing page); Kalam tidak dipakai di dashboard | user | DBD 2 |
| P9.4 | Nada | Dashboard netral tanpa sapaan; tracking menyapa "kamu" | user | DBD 1 |
| P9.5 | Mode gelap | Tidak dulu | user | DBD 2 |
| P9.6 | Kepadatan | Sedang (10-15 baris tiket per layar laptop; target sentuh 44px di HP) | user | DBD 2 |
| P9.7 | Logo | assets/logo.jpg; versi hitam-putih untuk thermal dibuat dari file ini | user | DBD 6 |
| P9.8 | Referensi | FixMaster (sudah dikenal staf) (disetujui di review Fase 5) | user | DBD 1 |
| P9.8a | Tambah sparepart cepat | Sparepart bisa ditambahkan langsung dari baris daftar tiket tanpa membuka detail tiket (diketik user saat review); diterapkan di S-04 dan daftar tiket Teknisi di S-03 | user | PRD F-09.9, AFD F-09, IPD L-22, L-30 |
| P10.1 | Lokal | Bahasa Indonesia, IDR tanpa desimal (Rp1.250.000), Asia/Jakarta (WIB), tanggal "2 Nov 2026" | user | PRD 7, BSD 2 |
| P10.2 | Perangkat | Laptop/PC Windows di konter, HP Android, iPhone, tablet | user | PRD 7, DBD 4 |
| P10.2a | Cetak dari | Laptop/PC via USB dan HP Android via Bluetooth (butuh aplikasi perantara, mis. RawBT) | user | TRD 1, 9, F-06 |
| P10.3 | Kecepatan | Tracking < 2 detik di 4G; dashboard < 3 detik | user | PRD 7, TRD 8 |
| P10.4 | Aksesibilitas | WCAG 2.2 AA | user | PRD 7, DBD 5 |
| P11.1 | Urutan kerja | Fondasi dulu (setup, database, login, lalu alur tiket P0) | user | IPD |
| P11.2 | Deploy | Online sejak awal di app.nuaraservice.my.id (belum dipakai pelanggan); sampai rilis memakai proyek Supabase tes (A9) | user | IPD, TRD 6 |
| P11.3 | Ukuran langkah | 2-3 jam per langkah (disetujui di review Fase 5) | user | IPD |
| P11.4 | Commit | Tawarkan commit tiap langkah, pesan "L-xx: ..." | user | Fase 6, CLAUDE.md |
| P11.5 | Data contoh | Ya, hanya di database tes: sekitar 30 tiket, 10 pelanggan, 15 sparepart, 4 akun dengan nama jelas palsu | user | BSD 7 |
| P11.6 | Database tes | Proyek Supabase tes (gratis); proyek produksi dibuat di L-36 (A9) | user | TRD 6 |
| P11.7 | Peralihan dari FixMaster | Pindah setelah semua fitur (P0 + P1) benar-benar rampung (diketik user); P0/P1 hanya urutan kerja | user | PRD 3, IPD |
| P12.1 | DP saat tiket Dibatalkan | Dikembalikan dikurangi biaya cek; dicatat sebagai uang keluar dari akun kas yang dipilih (sejak A6a: lewat aturan kelebihan bayar F-07.7) | user | PRD F-03, F-07, BSD |
| P12.2 | Modal & profit per tiket | Hanya Pemilik; Teknisi/Admin melihat sparepart terpakai tanpa angka modal/profit | user | BSD 5, AFD |
| P12.3 | Absensi milik staf | Staf melihat riwayat sendiri bulan ini; rekap semua staf hanya Pemilik | user | PRD F-10, BSD 5 |
| P12.4 | Palet final | Pilihan P9.2 + primary-hover #0D3558, border dekoratif #C9D6E3, border-input #7D8896 (3.6:1), focus ring #062036 2px + jarak 2px | user | DBD 2 |
| P12.5 | Nomor nota jual | JL-00001, urut terpisah dari NS- | user | PRD F-17, BSD sales |
| P12.6 | Garansi saat default kosong | Wajib diisi manual saat Selesai (jumlah hari, boleh 0 = "Tanpa garansi") | user | PRD F-02, F-04 |
| P12.7 | Teks bawaan | Teks WA dan daftar kelengkapan bawaan disusun AI, disetujui user di pertanyaan pra-langkah; tanpa fakta karangan; daftar keluhan dari nota landing page | user | BSD 7, IPD |
| P12.8 | Akun awal | Nama, username, peran 4-6 akun diberikan user saat langkah login; tidak ada nama karangan di database asli | user | BSD 7, IPD |
| P12.9 | Uang keluar & saldo | Semua uang keluar (pengeluaran, barang masuk, beli dadakan, pengembalian DP, pindah saldo) ditolak jika melebihi saldo akun sumber (review Fase 5) | user | PRD F-11.2, BSD cash_entries |
| A3a | Detail alur batal (T3) | Tahap Dikembalikan (final) setelah Dibatalkan; Dibatalkan hanya dari Diterima sampai Selesai; estimasi Ditolak oleh Teknisi tidak membatalkan otomatis (notifikasi ke semua Admin dan Pemilik, yang membatalkan); Diambil, Dibatalkan, Dikembalikan tidak bisa dimundurkan; link tiket batal aktif 30 hari setelah Dibatalkan; biaya cek masuk bulan Dibatalkan (disetujui di review 2026-11-04) | user | PRD F-02, F-03, F-04, F-12; BSD 3, 4 |
| A6a | Aturan uang (S3) | Tagihan ditetapkan mulai Selesai (DP sebelumnya tanpa patokan); jenis pembayaran mengikuti tahap; kelebihan bayar wajib dikembalikan sebelum Diambil atau Dikembalikan (tanpa pengecualian); kurang bayar boleh diizinkan Pemilik; omzet mengikuti tagihan bukan kas; biaya barang = modal sparepart tiket yang tidak dikembalikan + beli dadakan + modal barang terjual langsung (disetujui di review 2026-11-04) | user | PRD F-07, F-12; BSD 3, 4 |
| A15a | Saldo awal akun kas (R10) | Terkunci setelah akun punya mutasi; koreksi lewat Koreksi saldo oleh Pemilik dengan alasan (disetujui di review 2026-11-04) | user | PRD F-11.3, F-11.7; BSD cash_entries |
| A15b | Visibilitas data (R11) | Teknisi tidak melihat nomor WA pelanggan; Admin dan Pemilik melihat harga modal barang di daftar stok (disetujui di review 2026-11-04) | user | PRD F-05.1, F-09.8; BSD 5 |
| A15c | Klaim garansi dan estimasi (R18) | Tiket klaim dibuat dengan estimasi Rp0 yang langsung Disetujui; estimasi yang sudah Disetujui tidak bisa diubah (disetujui di review 2026-11-04) | user | PRD F-03.1, F-15.3; BSD 4 |
| A15d | Isi nota dan tampilan garansi (R9, R15) | Isi nota pelunasan dan nota penjualan; aturan samaran nama; garansi di tracking tampil sebagai jumlah hari sebelum Diambil dan tanggal berakhir sesudahnya (disetujui di review 2026-11-04) | user | PRD F-04.2, F-07.8, F-17.1 |
| A15e | Akun staf | Pemilik bisa mengaktifkan kembali akun; Pemilik tidak bisa menonaktifkan atau mengubah peran akunnya sendiri; selalu ada minimal satu Pemilik aktif (disetujui di review 2026-11-04) | user | PRD F-08.6, F-08.7; BSD profiles |
| A15f | Pemberitahuan privasi (R17) | Teks pemberitahuan privasi diisi Pemilik di Pengaturan (`privacy_notice`) dan tampil di tanda terima dan tracking bila diisi (disetujui di review 2026-11-04) | user | PRD F-04.2, F-06.2, F-16.1; BSD settings |
| P13.1 | Dasar kode (2026-11-21) | Fork FixMaster: salin kode FixMaster lalu ganti UI-nya ke dens-ui; TRD dan IPD ditulis ulang, PRD tetap acuan fitur. Rencana Next.js dari nol dibatalkan | user | TRD 1-2, IPD |
| P13.2 | Lokasi kode | Folder `dashboard/` di repo nuaraservice (sesuai CLAUDE.md lama); disalin sekali tanpa riwayat git FixMaster | user | TRD 3 |
| P13.3 | Tampilan | Komponen dens-ui (github.com/dendense/dens-ui), warnanya diganti token Nuara (navy/amber DBD), bukan Mars Green | user | DBD, TRD 1 |
| P13.4 | Cakupan salinan | Buang bagian SaaS (landing, harga dan saldo unit, operator, demo, onboarding SaaS); fitur operasional toko tetap | user | TRD 1, IPD L-43 |
| P13.5 | Database | Proyek Supabase baru milik Nuara; skema FixMaster utuh dengan satu organisasi; satu migrasi tambahan mematikan potongan unit; pendaftaran org baru, operator, dan pembayaran dihapus | user | TRD 2, 5; BSD |
| P13.6 | Selisih PRD vs FixMaster | Perilaku FixMaster dulu; selisih dicatat di IPD lalu diputuskan Pemilik satu per satu setelah UI dipindah ke dens-ui | user | IPD Daftar Selisih |
| P13.7 | Strategi pindah UI | Bertahap per halaman; Tailwind + dens-ui berdampingan dengan CSS Modules; aplikasi tetap bisa di-build di setiap commit | user | IPD Fase B, TRD 9 |
| P13.8 | Lingkup sesi 2026-11-21 | Fase 1 (salin, buang SaaS, merek Nuara, migrasi penetral, build/test/lint lolos) + perbarui dokumen, lalu commit dan push ke branch `claude/` | user | IPD L-43 |

## Perubahan (mode update)
| Tanggal | Kode | Perubahan | Jawaban | Dokumen terdampak |
|---|---|---|---|---|
| 2026-11-04 | A1 (T1) | Better Auth diganti Supabase Auth: tabel `profiles` menggantikan `users`, email sintetis `<username>@staf.nuaraservice.my.id`, peran dan status aktif dibaca dari `profiles` di setiap permintaan, tabel Better Auth dihapus, nama kunci Supabase memakai publishable dan secret | "ganti better auth dengan supabase auth" | TRD 1-3, 5, 6, 9; BSD 1, 3, 5-7; AFD 3, 5; PRD F-08; IPD L-01 sampai L-04, L-24, L-32 |
| 2026-11-04 | A2 (T2) | Tetap memakai Vercel Hobby walau ketentuan Vercel membatasi Hobby untuk pemakaian non-komersial; risiko diterima Pemilik dan dicatat | "tetap pakai vercel hobby" | PRD 8; TRD 1, 9; IPD Catatan |
| 2026-11-04 | A3 (T3) | Saran tiket dibatalkan diterapkan: tahap Dikembalikan setelah Dibatalkan, penyerahan terkunci sampai biaya cek lunas atau izin Pemilik, notifikasi ke Admin dan Pemilik saat Teknisi menandai estimasi Ditolak (detail: A3a) | "kerjakan saran tiket dibatalkan" | PRD F-02, F-03, F-04, F-07, F-12, F-13; AFD F-02, F-03, F-07, 5; BSD 1, 3-6; DBD 3; IPD L-10, L-39 sampai L-41 |
| 2026-11-04 | A4 (S1) | Ditunda: perbaikan koneksi backup dan migrasi (koneksi langsung Supabase hanya IPv6); hanya catatan risiko | "skip dulu backup dan migrasi" | TRD 9; IPD Catatan, L-03, L-32 |
| 2026-11-04 | A5 (S2) | Aturan nomor WA diperjelas: 08xx 10-13 digit, 628xx 11-14 digit, disimpan 628 + 8-11 digit; nilai samaran pelanggan tidak melanggar aturan format | "perbaiki poin s2" | PRD F-01.3; AFD F-01; BSD customers |
| 2026-11-04 | A6 (S3) | Celah aturan uang ditutup (detail: A6a) | "perbaiki poin s3" | PRD F-07, F-12; AFD F-07; BSD 3, 4, 6; IPD L-18, L-31, L-41 |
| 2026-11-04 | A7 (S4) | F-01.9 (ubah data tiket) mendapat langkah L-37; klaim kriteria F-01.* di L-07, L-08, L-13 dikoreksi | "perbaiki poin s4" | IPD L-07, L-08, L-09, L-13, L-37 |
| 2026-11-04 | A8 (S5) | Channel Realtime `staff` privat (RLS `realtime.messages`, klien tidak bisa mengirim), `track:<kode>` publik tanpa data, pemuatan ulang digabung (staf 2 detik, tracking 3 detik), sinyal dikirim server lewat REST setelah transaksi berhasil | "perbaiki poin s5" | TRD 2, 9; BSD 6, 7; AFD 5; IPD L-14 |
| 2026-11-04 | A9 (S6) | Proyek Supabase produksi dibuat di L-36; sebelum itu app.nuaraservice.my.id memakai proyek tes (staging) supaya proyek produksi tidak menganggur dan dijeda | "perbaiki poin s6" | TRD 6, 9; BSD 7; IPD L-02, L-04, L-08, L-36 |
| 2026-11-04 | A10 (S7) | Radius absen tetap 100 m: absen masuk dan pulang di luar radius ditolak; izin lokasi ditolak atau GPS tidak terbaca tetap boleh dengan tanda (keputusan lama P5.F10.4); kolom `*_within_radius` dihapus | "tetapkan 100m saja untuk absen" | PRD F-10.2, F-10.3, F-10.7; AFD F-10; BSD attendances |
| 2026-11-04 | A11 (S8) | `src/proxy.ts` menggantikan `middleware.ts` (Next.js 16, Node.js); proxy hanya rewrite host + segarkan sesi; pemeriksaan database (peran, `is_active`, `must_change_password`) di layout server dan Server Action | "perbaiki poin s8" | TRD 2-4, 9; IPD L-02, L-04 |
| 2026-11-04 | A12 (S9) | Ditunda: klaim 'semua gratis' untuk RawBT belum diverifikasi; diuji dengan printer asli di L-17 | "skip dulu poin s9" | IPD Catatan, L-17 |
| 2026-11-04 | A13 (S10) | Dashboard netral tanpa sapaan: teks 'Kamu sudah absen', 'untukmu', 'kepadamu' diganti; aturan masuk DBD dan CLAUDE.md | "dashboard netral tanpa sapaan" | PRD F-10.7; AFD 3-5; DBD 1, 7; CLAUDE.md |
| 2026-11-04 | A14 (S11) | `audit_logs.record_id` menjadi teks agar perubahan Pengaturan (kunci teks) bisa dicatat | "perbaiki poin s11" | BSD audit_logs |
| 2026-11-04 | A15 (R1-R23) | Semua perbaikan kecil: total jam IPD dihitung ulang (R1); langkah padat dipecah L-10/L-40, L-11/L-41, L-12/L-38, L-18/L-39, L-31/L-42 (R2); ERD dilengkapi (R3); klaim indeks pencarian dijujurkan (R4); `prepare: false` dan nama kunci Supabase baru (R5); kode error dan operasi Admin API (R6); urutan L-03/L-04/L-06 (R7); L-01 dan L-17 dikoreksi (R8); samaran nama dan tampilan garansi (R9); kunci saldo awal + Koreksi saldo (R10); visibilitas modal di stok (R11); kunci login per username + IP (R12); host `lacak.` hanya tracking (R13); tahap final tidak bisa dimundurkan (R14); isi nota (R15); cara ukur metrik (R16); teks pemberitahuan privasi (R17); `estimate_decision` 4 nilai dan klaim garansi disetujui otomatis (R18); draf form pulih setelah sesi habis (R19); keputusan turunan dicatat sebagai A3a sampai A15f (R20); hitungan pertanyaan dan nama tabel log dikoreksi (R21); CLAUDE.md antislop-ui diselaraskan (R22); teks pesan hanya di AFD (R23) | "kerjakan semua perbaikan kecil" | semua dokumen |
| 2026-11-04 | A16 (review asumsi) | 8 asumsi baru (A3a, A6a, A15a sampai A15f) disetujui apa adanya; tanda [ASUMSI] dihapus dari PRD 8 dan sumber di log menjadi user | "Setujui semua" | PRD 8; log |
| 2026-11-21 | A17 (P13) | Rencana Next.js + Drizzle dibatalkan; dasar kode = salinan FixMaster di `dashboard/`, UI dens-ui dengan warna Nuara, satu toko per database (migrasi 0105). Penyimpangan dari P13.4 yang menunggu konfirmasi Pemilik: wizard pengaturan awal toko FixMaster dipertahankan, karena itu satu-satunya jalan membuat toko pertama dan akun Pemilik; yang dibuang hanya jalur SaaS di sekitarnya (landing, pilihan paket, trial) | wawancara P13 | TRD; IPD; CLAUDE.md; catatan kepala PRD, AFD, BSD, DBD |
