# PRD (Product Requirements Document) - Nuara Dashboard

> Versi: 0.2 | Diperbarui: 2026-11-04 | Status: Draft

## 1. Ringkasan
Nuara Dashboard adalah aplikasi web internal Nuara Service (workshop servis laptop/PC, HP, dan elektronik rumah tangga di belakang kampus UNJANI Cimahi) yang menggantikan FixMaster. Dipakai Pemilik, Admin konter, dan Teknisi untuk mencatat tiket servis, estimasi, pembayaran, stok sparepart, absensi, dan laporan. Pelanggan tidak punya akun; mereka menerima link tracking pribadi berbrand Nuara lewat WhatsApp. Urutan nilai: (1) tracking berbrand Nuara, (2) semua urusan workshop di satu tempat, (3) angka usaha yang jelas, (4) tidak ada biaya langganan bulanan.

## 2. Masalah
- Masalah: Nuara membayar langganan FixMaster setiap bulan untuk tiket, tracking, kabar WA, cetak tanda terima, absensi, stok, dan laporan.
- Dialami oleh: Pemilik (biaya dan laporan), Admin konter (penerimaan unit, kasir), Teknisi (update servis), pelanggan (status servis).
- Cara mereka mengatasinya sekarang: FixMaster. Tiket lama tidak dipindah; tiket aktif diselesaikan di FixMaster sampai habis.

## 3. Tujuan & Metrik Sukses
Rilis = semua fitur P0 dan P1 selesai; Nuara pindah dari FixMaster setelah itu (P0/P1 hanya urutan kerja).

| Tujuan | Metrik | Target |
|---|---|---|
| Semua tiket tercatat di Nuara Dashboard | % tiket baru yang dibuat di dashboard; cara ukur: tiap Senin Pemilik mengecek bahwa FixMaster tidak menerima tiket baru dan jumlah unit masuk menurut catatan Pemilik sama dengan jumlah tiket di dashboard | 100% dalam 1 minggu sejak dashboard mulai dipakai |
| Berhenti langganan FixMaster | Biaya langganan FixMaster per bulan | Rp0, paling lambat 1 bulan setelah rilis |
| Penerimaan unit cepat di konter | Waktu dari pelanggan datang sampai tiket tersimpan | <= 2 menit per tiket |
| Pelanggan langsung dapat link tracking | % tiket dengan tombol kirim link ditekan (tercatat di `wa_messages`, F-05.4); pengiriman sebenarnya di WhatsApp tidak bisa diverifikasi aplikasi | 100%, sesaat setelah unit diterima |

## 4. Pengguna & Peran
<!-- Daftar peran ini dipakai sama persis di kolom Akses AFD bagian 1 dan kolom BSD bagian 5. -->
| Peran | Deskripsi | Kebutuhan utama |
|---|---|---|
| Pemilik | Pemilik workshop; semua izin, satu-satunya yang mengelola akun staf, Pengaturan, laporan bulanan, modal/profit | Melihat kondisi usaha dan mengendalikan uang |
| Admin | Admin konter: menerima unit, kasir, stok, kas harian | Buat tiket cepat, catat bayar, kabari pelanggan |
| Teknisi | Mengerjakan servis; melihat semua tiket (tanpa nomor WA pelanggan), mengubah hanya tiket yang ditugaskan kepadanya | Antrean kerja jelas, update tahap dari HP |
| Publik | Pelanggan atau siapa pun tanpa login | Membuka halaman tracking lewat link pribadi |

Jumlah akun: 4-6 (termasuk Pemilik). Akun dibuat Pemilik; tidak ada pendaftaran mandiri.

**Istilah domain** (ditulis sama persis di UI, kode, dan database):
| Istilah | Arti | Nama di kode/tabel |
|---|---|---|
| Tiket servis | Satu perangkat yang diterima untuk diservis | `tickets` |
| Nomor tiket | NS-00001, urut terus tanpa reset | `tickets.number` |
| Tiket Express | Tiket pelanggan yang menunggu di tempat; persetujuan lisan, langsung Pengerjaan | `tickets.is_express` |
| Pelanggan | Pemilik perangkat; satu nomor WA = satu pelanggan | `customers` |
| Tahap | Posisi tiket di alur servis (BSD bagian 4) | `tickets.stage` |
| Riwayat tiket | Perubahan tahap dan catatan internal | `ticket_events` |
| Estimasi | Hasil diagnosa, estimasi biaya, perkiraan lama pengerjaan | `tickets.estimate_*` |
| Biaya final | Angka yang ditagih, diisi saat Selesai | `tickets.final_amount` |
| Biaya cek | Biaya saat tiket Dibatalkan, boleh Rp0 | `tickets.check_fee` |
| Garansi jasa / garansi sparepart | Jumlah hari garansi per tiket | `tickets.service_warranty_days`, `tickets.part_warranty_days` |
| Klaim garansi | Tiket baru yang terhubung ke tiket lama | `tickets.warranty_claim_of_id` |
| Link tracking | Link publik berkode acak | `tickets.tracking_code` |
| Akun kas | Metode bayar sekaligus tempat uang (mis. tunai, rekening, QRIS) | `cash_accounts` |
| Pembayaran | DP, pelunasan, pengembalian kelebihan bayar, pembayaran penjualan | `payments` |
| Mutasi kas | Setiap uang masuk/keluar per akun kas | `cash_entries` |
| Pengeluaran | Uang keluar operasional | `expenses` |
| Pindah saldo | Uang pindah antar akun kas | `cash_transfers` |
| Sparepart | Barang stok (termasuk aksesoris yang dijual) | `parts` |
| Mutasi stok | Barang masuk, dipakai, dikembalikan, dijual, dikoreksi | `stock_movements` |
| Beli dadakan | Part dibeli khusus untuk satu tiket, tidak masuk stok | `ticket_extra_costs` |
| Penjualan langsung | Jual barang tanpa tiket, nota JL-00001 | `sales` |
| Absensi | Jam masuk/pulang staf | `attendances` |
| Pengaturan | Template dan nilai bawaan milik Pemilik | `settings` |
| Staf (akun) | Akun login Pemilik, Admin, atau Teknisi; dinonaktifkan, tidak dihapus | `profiles` |
| Dikembalikan | Tahap akhir tiket Dibatalkan: unit diserahkan kembali tanpa perbaikan | `tickets.stage = dikembalikan` |
| Kelebihan bayar | Dibayar lebih dari tagihan; wajib dikembalikan | `payments.kind = refund` |
| Koreksi saldo | Penyesuaian saldo akun kas oleh Pemilik, wajib alasan | `cash_entries.entry_type = adjustment` |
| Biaya barang | Modal sparepart terpakai di tiket (yang tidak dikembalikan ke stok) + beli dadakan + modal barang terjual langsung | dihitung di laporan |

## 5. Fitur MVP
Prioritas: P0 = wajib rilis, P1 = sebaiknya ada, P2 = jika sempat. Karena rilis menunggu semua P0 + P1, prioritas di sini = urutan kerja.

| ID | Fitur | Prioritas | User story |
|---|---|---|---|
| F-01 | Terima unit + buat tiket | P0 | Sebagai Admin, saya ingin mencatat unit masuk dalam <= 2 menit, agar pelanggan tidak menunggu |
| F-02 | Tahap + tugaskan teknisi | P0 | Sebagai Teknisi, saya ingin mengubah tahap tiket saya, agar semua orang dan pelanggan tahu progresnya |
| F-03 | Estimasi + persetujuan | P0 | Sebagai Teknisi, saya ingin mengisi estimasi dan baru mengerjakan setelah disetujui, agar janji "biaya disepakati sebelum dikerjakan" terjaga |
| F-04 | Halaman tracking pelanggan | P0 | Sebagai pelanggan, saya ingin membuka link untuk melihat tahap servis, agar tidak perlu bertanya di WA |
| F-05 | Kabar status ke WA | P0 | Sebagai Admin, saya ingin mengirim pesan WA siap kirim, agar pelanggan dapat link dan kabar tanpa mengetik ulang |
| F-06 | Cetak tanda terima | P1 | Sebagai Admin, saya ingin mencetak tanda terima thermal, agar pelanggan pegang bukti titip |
| F-07 | Catat pembayaran | P1 | Sebagai Admin, saya ingin mencatat DP dan pelunasan per akun kas, agar kas dan piutang tepat |
| F-08 | Kelola akun staf | P1 | Sebagai Pemilik, saya ingin menambah, mengubah, dan menonaktifkan akun staf, agar akses sesuai orangnya |
| F-09 | Stok sparepart | P1 | Sebagai Admin, saya ingin stok berkurang otomatis saat dipakai, agar stok dan modal akurat |
| F-10 | Absensi staf | P1 | Sebagai staf, saya ingin absen dengan satu tombol di workshop, agar kehadiran tercatat |
| F-11 | Catat pengeluaran | P1 | Sebagai Admin, saya ingin mencatat pengeluaran dan pindah saldo, agar saldo tiap akun kas akurat |
| F-12 | Laporan keuangan bulanan | P1 | Sebagai Pemilik, saya ingin melihat omzet, modal, pengeluaran, dan profit per bulan, agar tahu kondisi usaha |
| F-13 | Beranda ringkasan | P1 | Sebagai staf, saya ingin melihat hal yang perlu ditindaklanjuti di satu layar, agar tidak ada yang terlewat |
| F-14 | Data pelanggan + riwayat | P1 | Sebagai Admin, saya ingin melihat riwayat servis pelanggan, agar pelayanan konsisten |
| F-15 | Klaim garansi | P1 | Sebagai Admin, saya ingin membuat klaim dari tiket lama, agar garansi tercatat dan terhubung |
| F-16 | Pengaturan template | P1 | Sebagai Pemilik, saya ingin mengubah template dan nilai bawaan, agar aplikasi mengikuti aturan workshop |
| F-17 | Jual barang langsung | P1 | Sebagai Admin, saya ingin menjual aksesoris/sparepart tanpa tiket, agar penjualan dan stok tercatat |

### Kriteria Penerimaan
**F-01 Terima unit + buat tiket**
- F-01.1 Admin/Pemilik membuat tiket dengan kolom wajib: nama pelanggan, nomor WA, jenis perangkat (Laptop/PC, HP, Elektronik rumah tangga), merek + tipe, minimal satu keluhan (pilihan template atau keluhan lain). Teknisi tidak bisa membuat tiket.
- F-01.2 Kolom tambahan: kelengkapan (centang dari template), kondisi fisik, password/pola kunci, uang muka (DP + akun kas), centang Express. Tidak ada kolom alamat pelanggan, foto, IMEI, atau perkiraan selesai.
- F-01.3 Nomor WA diterima sebagai 08xx (10-13 digit), 628xx (11-14 digit), atau +628xx; spasi, titik, tanda hubung, dan kurung diabaikan. Disimpan seragam sebagai 628 diikuti 8-11 digit. Format lain ditolak dengan pesan di bawah kolom (teks di AFD F-01).
- F-01.4 Nomor WA yang sudah terdaftar menawarkan pemakaian data pelanggan lama (teks di AFD F-01); admin bisa memakai atau memperbarui nama. Satu nomor WA = satu pelanggan.
- F-01.5 Nomor tiket dibuat otomatis NS-00001, NS-00002, dst. tanpa reset dan tanpa lompatan; setiap tiket mendapat kode tracking acak 10 karakter.
- F-01.6 DP dicatat sebagai pembayaran pertama (BSD `payments`) ke akun kas yang dipilih.
- F-01.7 Tiket Express: admin mengisi estimasi saat buat tiket; persetujuan lisan tercatat otomatis; tiket langsung ke tahap Pengerjaan setelah Diterima.
- F-01.8 Setelah tersimpan, halaman detail tiket terbuka dengan tombol kirim link tracking (F-05).
- F-01.9 Admin & Pemilik bisa mengubah data tiket, termasuk nama dan nomor WA pelanggan (aturan nomor sama dengan F-01.3; nomor yang sudah dipakai pelanggan lain ditolak); tiket tidak bisa dihapus, hanya Dibatalkan (F-02.6).
- F-01.10 Daftar keluhan bawaan diambil dari nota landing page (index.html) per jenis perangkat.
- F-01.11 Kasus gagal: koneksi putus saat simpan -> pesan koneksi dengan tombol Coba lagi (teks di AFD F-01); isian tidak hilang; tidak terbentuk tiket ganda saat Coba lagi.
- F-01.12 Isian form buat tiket tidak hilang saat sesi habis: draf tersimpan sementara di browser (kecuali password/pola unit) dan dipulihkan setelah masuk kembali; draf dihapus setelah tiket tersimpan.

**F-02 Tahap + tugaskan teknisi**
- F-02.1 Tahap: Diterima -> Diagnosa (boleh dilewati) -> Konfirmasi biaya -> Tunggu part (boleh dilewati) -> Pengerjaan -> Selesai -> Diambil. Dibatalkan bisa dari tahap Diterima sampai Selesai, lalu dilanjutkan ke Dikembalikan (F-02.10). Transisi lengkap di BSD bagian 4.
- F-02.2 Admin & Pemilik menugaskan atau memindah teknisi kapan saja sebelum Diambil.
- F-02.3 Teknisi melihat semua tiket, tetapi tombol ubah hanya tampil di tiket yang ditugaskan kepadanya; server menolak perubahan tiket orang lain.
- F-02.4 Admin & Pemilik bisa memundurkan tahap satu langkah (ke tahap sebelumnya di riwayat) dari Diagnosa, Konfirmasi biaya, Tunggu part, Pengerjaan, atau Selesai; tercatat nama + waktu. Diambil, Dibatalkan, dan Dikembalikan bersifat final: tidak bisa dimundurkan dan meminta konfirmasi sebelum ditekan.
- F-02.5 Catatan teknisi selalu internal (tidak tampil di tracking), tercatat di riwayat tiket.
- F-02.6 Dibatalkan hanya oleh Admin/Pemilik dari tahap Diterima sampai Selesai; wajib alasan dan biaya cek (boleh Rp0). Kelebihan bayar (mis. DP lebih besar dari biaya cek) dikembalikan lewat F-07.7.
- F-02.7 Saat Selesai, garansi jasa dan garansi sparepart (jumlah hari) wajib terisi; nilai awal dari Pengaturan, boleh 0 ("Tanpa garansi").
- F-02.8 Setelah tahap berubah: notifikasi status (teks di AFD F-02); untuk Selesai dan Diambil, Admin/Pemilik melihat tombol kirim WA (F-05).
- F-02.9 Kasus gagal: perubahan tahap yang tidak diizinkan (melompat, tiket orang lain, syarat belum terpenuhi) ditolak dengan pesan yang menyebut syaratnya.
- F-02.10 Tiket Dibatalkan menjadi Dikembalikan saat unit diserahkan kembali ke pelanggan, oleh Admin/Pemilik. Syarat: sisa tagihan = 0 (biaya cek lunas dan tanpa kelebihan bayar), atau Pemilik mengizinkan penyerahan saat kurang bayar (F-07.5). Sparepart yang belum dikembalikan ke stok tetap dihitung sebagai biaya (F-12.2).

**F-03 Estimasi + persetujuan**
- F-03.1 Teknisi yang ditugaskan (atau Admin/Pemilik) mengisi hasil diagnosa, estimasi biaya (satu angka total, Rupiah), dan perkiraan lama pengerjaan; tiket masuk tahap Konfirmasi biaya. Estimasi yang sudah Disetujui tidak bisa diubah; selisih biaya diselesaikan lewat biaya final (F-03.5).
- F-03.2 Admin/Pemilik/Teknisi yang ditugaskan menandai persetujuan "Disetujui" atau "Ditolak" berdasarkan balasan pelanggan di WA; tercatat siapa dan kapan. Keputusan bisa diubah selama tiket masih di Konfirmasi biaya.
- F-03.3 Tahap Pengerjaan terkunci sampai estimasi Disetujui, kecuali tiket Express.
- F-03.4 Estimasi Ditolak tidak membatalkan tiket otomatis: tiket tetap di Konfirmasi biaya sampai Admin/Pemilik membatalkannya (F-02.6; alasan terisi otomatis, biaya cek diisi, boleh Rp0; teks di AFD F-03). Jika yang menandai Ditolak adalah Teknisi, semua Admin dan Pemilik mendapat notifikasi untuk membatalkan; jika Admin/Pemilik, dialog Batalkan langsung terbuka.
- F-03.5 Biaya final diisi saat Selesai, nilai awal = estimasi, bisa diubah; kenaikan dari estimasi cukup dicatat tanpa persetujuan ulang.
- F-03.6 Tiket ditandai "Perlu ditindaklanjuti" di daftar tiket dan beranda jika sudah > 2 hari di Konfirmasi biaya tanpa keputusan, atau estimasinya Ditolak tetapi tiket belum dibatalkan.
- F-03.7 Kasus gagal: menekan Pengerjaan sebelum estimasi disetujui ditolak dengan pesan yang menyebut syaratnya (teks di AFD F-03).

**F-04 Halaman tracking pelanggan**
- F-04.1 Alamat: https://lacak.nuaraservice.my.id/<kode 10 karakter acak>; tanpa login.
- F-04.2 Tampil: nomor tiket, perangkat, tahap saat ini, riwayat tahap + waktu, nama pelanggan disamarkan, nama depan teknisi, kelengkapan dititipkan, garansi jasa dan garansi sparepart, tombol chat WA dan rute Google Maps workshop, serta teks pemberitahuan privasi (jika diisi Pemilik). Samaran nama: 2 huruf pertama kata pertama + "***", lalu inisial kata terakhir + titik bila nama lebih dari satu kata (mis. "Citra Lestari" -> "Ci*** L."). Garansi sebelum Diambil tampil sebagai jumlah hari sejak unit diambil (0 = "Tanpa garansi"); setelah Diambil tampil tanggal berakhir.
- F-04.3 Tidak tampil: nomor WA, password/pola, kondisi fisik, catatan, diagnosa, estimasi, biaya, pembayaran.
- F-04.4 Tiket yang belum Diambil atau Dibatalkan: link selalu aktif. Setelah Diambil: aktif sampai 30 hari setelah garansi terpanjang berakhir (garansi 0 = 30 hari setelah Diambil). Tiket Dibatalkan atau Dikembalikan: aktif sampai 30 hari setelah Dibatalkan.
- F-04.5 Tahap di halaman yang sedang terbuka berubah sendiri dalam <= 5 detik setelah diubah staf (realtime).
- F-04.6 Halaman termuat < 2 detik di koneksi 4G.
- F-04.7 Kasus gagal: kode salah atau link kedaluwarsa menampilkan pesan link tidak aktif + tombol chat WA Nuara (teks di AFD F-04).
- F-04.8 Tiket Dibatalkan atau Dikembalikan: riwayat menampilkan tahap Dibatalkan dan Dikembalikan; alasan batal dan biaya cek tidak tampil.

**F-05 Kabar status ke WA**
- F-05.1 Admin/Pemilik menekan tombol yang membuka WhatsApp (wa.me) ke nomor pelanggan dengan pesan terisi dari template, lalu menekan kirim di WhatsApp workshop. Tanpa API berbayar. Teknisi tidak melihat nomor WA pelanggan.
- F-05.2 Pesan tersedia untuk: Diterima (berisi nomor tiket + link tracking), Selesai (siap diambil), Diambil (permintaan ulasan + link ulasan Google). Berlaku juga untuk tiket Express.
- F-05.3 Pesan ulasan hanya ditawarkan jika link ulasan Google sudah diisi Pemilik.
- F-05.4 Saat tombol ditekan, tercatat jenis pesan, nama staf, dan waktu; tiket yang pesan "Diterima"-nya belum tercatat diberi penanda "Link belum dikirim".
- F-05.5 Template awal disusun AI dan disetujui Pemilik sebelum dipakai; tanpa harga, jam buka, atau durasi garansi karangan.
- F-05.6 Kasus gagal: WhatsApp tidak terbuka -> tombol "Salin pesan" menyalin teks lengkap untuk ditempel manual.

**F-06 Cetak tanda terima**
- F-06.1 Format thermal 58 mm dan 80 mm; ukuran dipilih Pemilik di Pengaturan.
- F-06.2 Isi: logo, nama, alamat workshop, WA workshop, nomor tiket, tanggal, nama + WA pelanggan, perangkat, keluhan, kelengkapan, kondisi fisik, QR link tracking, S&K dan teks pemberitahuan privasi dari Pengaturan (dikosongkan jika belum diisi). Tanpa password/pola, tanpa kolom tanda tangan.
- F-06.3 Bisa dicetak dari laptop/PC (printer USB) dan HP Android (printer Bluetooth lewat aplikasi perantara RawBT).
- F-06.4 Cetak ulang bebas dari detail tiket.
- F-06.5 Kasus gagal: printer tidak merespons -> tanda terima tetap bisa dicetak ulang kapan saja; link tetap bisa dikirim lewat WA.

**F-07 Catat pembayaran**
- F-07.1 Admin/Pemilik mencatat pembayaran; satu pembayaran bisa dipecah ke beberapa akun kas (split). Jenisnya mengikuti tahap tiket: sebelum Selesai = DP; mulai Selesai, dan pada tiket Dibatalkan atau Dikembalikan = pelunasan.
- F-07.2 Diskon diisi Admin/Pemilik mulai tahap Selesai (saat biaya final ada), bebas tanpa alasan, tidak boleh melebihi biaya final.
- F-07.3 Tagihan: mulai Selesai = biaya final - diskon; tiket Dibatalkan atau Dikembalikan = biaya cek; sebelum Selesai belum ditetapkan. Dibayar = DP + pelunasan - pengembalian (tanpa yang dibatalkan). Sisa = tagihan - dibayar (positif = kurang bayar, negatif = kelebihan bayar). Lunas jika tagihan sudah ditetapkan dan sisa = 0.
- F-07.4 DP sebelum Selesai tidak dibatasi patokan tagihan (tagihan belum ditetapkan). Setelah tagihan ditetapkan, pembayaran yang melebihi sisa ditolak (teks di AFD F-07).
- F-07.5 Tahap Diambil (dan Dikembalikan) terkunci selama sisa tidak nol. Kurang bayar: Admin menekan "Minta izin Pemilik"; Pemilik mengizinkan dengan alasan, lalu tahap bisa ditekan. Kelebihan bayar: wajib dikembalikan lewat F-07.7, tanpa izin pengecualian.
- F-07.6 Pembayaran salah dibatalkan dengan alasan (tetap terlihat, saldo kembali), lalu dicatat ulang; tidak bisa diedit atau dihapus.
- F-07.7 Kelebihan bayar (dibayar > tagihan, mis. biaya final lebih kecil dari DP, atau DP lebih besar dari biaya cek) dikembalikan lewat tombol "Kembalikan kelebihan": nominal maksimal sebesar kelebihan, dari akun kas yang dipilih, dicatat sebagai uang keluar (jenis `refund`); ditolak jika saldo akun kurang (F-11.2).
- F-07.8 Nota pelunasan bisa dicetak (58/80 mm) atau ringkasannya dikirim lewat WA (wa.me). Isi: logo, nama, alamat, WA workshop, nomor tiket, tanggal, nama pelanggan, perangkat, biaya final, diskon, rincian pembayaran (tanggal, akun kas, nominal), total dibayar, sisa, garansi jasa dan sparepart (hari).
- F-07.9 Kasus gagal: total split tidak sama dengan nominal ditolak dengan pesan yang menyebut kedua angka (teks di AFD F-07).

**F-08 Kelola akun staf**
- F-08.1 Hanya Pemilik: tambah akun (nama, username, peran, jadwal kerja, password awal), ubah peran, ubah jadwal. Username 3-30 karakter (huruf kecil, angka, titik, garis bawah); password minimal 8 karakter. Aplikasi tidak menyimpan email atau nomor WA staf.
- F-08.2 Jadwal kerja: jam masuk dan pulang per hari (Senin-Minggu); hari tanpa jam = libur.
- F-08.3 Nonaktifkan: staf tidak bisa masuk, dan permintaan berikutnya dari sesi yang sedang aktif ditolak (status aktif dicek di setiap permintaan); nama tetap tampil di data lama. Tidak ada hapus akun.
- F-08.4 Reset password: Pemilik membuat password sementara; staf wajib menggantinya saat login berikutnya.
- F-08.5 Kasus gagal: username yang sudah dipakai ditolak dengan pesan di bawah kolom (teks di AFD F-08).
- F-08.6 Pemilik bisa mengaktifkan kembali akun yang dinonaktifkan (username tetap milik akun itu).
- F-08.7 Pemilik tidak bisa menonaktifkan atau mengubah peran akunnya sendiri; selalu ada minimal satu Pemilik aktif.

**F-09 Stok sparepart**
- F-09.1 Data sparepart: nama, jumlah stok, harga modal (rata-rata otomatis), harga jual, stok minimum. Semua barang stok juga bisa dijual langsung (F-17).
- F-09.2 Barang masuk: jumlah + harga beli + akun kas sumber; harga modal dihitung ulang rata-rata; tercatat sebagai uang keluar.
- F-09.3 Teknisi yang ditugaskan, Admin, Pemilik mencatat sparepart dipakai di tiket; stok berkurang. Sparepart tidak menambah tagihan, hanya menjadi modal tiket.
- F-09.4 Stok tidak boleh minus (pesan menyebut sisa stok, teks di AFD F-09). Part yang dibeli khusus untuk satu tiket dicatat sebagai beli dadakan (nama, harga, akun kas sumber) tanpa masuk stok.
- F-09.5 Sparepart yang batal dipasang bisa dikembalikan ke stok selama tiket belum Diambil atau Dikembalikan.
- F-09.6 Koreksi stok oleh Admin/Pemilik wajib alasan; semua mutasi tercatat di riwayat barang.
- F-09.7 Barang di bawah stok minimum ditandai "stok menipis".
- F-09.8 Modal dan profit per tiket hanya terlihat Pemilik. Harga modal barang di daftar stok (S-12, S-13) terlihat Pemilik dan Admin, karena Admin mengisi harga beli saat barang masuk.
- F-09.9 Sparepart bisa ditambahkan ke tiket langsung dari daftar tiket (S-04) dan dari daftar tiket Teknisi di beranda (S-03) lewat dialog cepat, tanpa membuka detail tiket; aturan F-09.3 dan F-09.4 tetap berlaku.

**F-10 Absensi staf**
- F-10.1 Staf menekan Masuk/Pulang; waktu diambil dari server (WIB).
- F-10.2 Lokasi HP dicek terhadap titik workshop (Pengaturan). Absen masuk dan pulang hanya diterima dalam radius 100 m (tetap, tidak bisa diubah); di luar radius ditolak (teks di AFD F-10). Yang disimpan hanya jarak (meter), bukan koordinat.
- F-10.3 Izin lokasi ditolak atau GPS tidak terbaca: absen tetap tersimpan dengan tanda "lokasi tidak terverifikasi" (terlihat Pemilik di rekap).
- F-10.4 Terlambat jika jam masuk melewati jadwal + toleransi menit dari Pengaturan.
- F-10.5 Lupa Pulang: absensi ditandai "tanpa jam pulang"; Pemilik mengisi jam pulang dengan alasan. Pemilik juga bisa mencatat absensi manual dengan alasan.
- F-10.6 Staf melihat riwayat absensinya sendiri bulan ini; Pemilik melihat rekap semua staf per bulan (hadir, terlambat, tanpa jam pulang, total jam).
- F-10.7 Kasus gagal: menekan Masuk dua kali di hari yang sama ditolak dengan pesan yang menyebut jam absen pertama (teks di AFD F-10); satu absensi per staf per hari.

**F-11 Catat pengeluaran**
- F-11.1 Admin/Pemilik mencatat pengeluaran: tanggal, nominal, akun kas sumber, keterangan.
- F-11.2 Uang keluar apa pun (pengeluaran, barang masuk, beli dadakan, pengembalian kelebihan bayar, pindah saldo, koreksi saldo negatif) ditolak jika melebihi saldo akun sumber (teks di AFD F-11).
- F-11.3 Saldo awal tiap akun kas diisi Pemilik di Pengaturan dan hanya bisa diubah selama akun itu belum punya mutasi kas; saldo = saldo awal + mutasi kas yang tidak dibatalkan.
- F-11.4 Pindah saldo antar akun kas oleh Admin/Pemilik.
- F-11.5 Koreksi: pengeluaran/pindah saldo dibatalkan dengan alasan lalu dicatat ulang.
- F-11.6 Halaman Kas menampilkan mutasi per hari per akun kas untuk Admin/Pemilik.
- F-11.7 Koreksi saldo oleh Pemilik: penyesuaian plus atau minus pada satu akun kas dengan alasan wajib (mis. hasil hitung kas fisik), tercatat sebagai mutasi `adjustment` dan di riwayat perubahan; tidak boleh membuat saldo minus.

**F-12 Laporan keuangan bulanan**
- F-12.1 Hanya Pemilik. Per bulan (WIB): omzet, biaya barang, pengeluaran, profit. Omzet = biaya final - diskon tiket yang Diambil + biaya cek tiket yang Dibatalkan + total penjualan langsung. Biaya barang = modal sparepart terpakai di tiket (yang tidak dikembalikan ke stok) + beli dadakan + modal barang terjual langsung. Profit = omzet - biaya barang - pengeluaran. Pembayaran, DP, dan pengembalian tidak memengaruhi omzet (omzet mengikuti tagihan, bukan kas).
- F-12.2 Dasar bulan: tiket Diambil di bulan unit Diambil (omzet dan biaya barang); tiket Dibatalkan atau Dikembalikan di bulan Dibatalkan (biaya cek, biaya barang yang tidak dikembalikan, beli dadakan); penjualan langsung di bulan penjualan. Penjualan, beli dadakan, dan pembayaran yang dibatalkan tidak dihitung.
- F-12.3 Jumlah tiket per status (masuk, selesai, diambil, dibatalkan, dikembalikan; masing-masing menurut tanggal masuk tahap itu), jumlah tiket masuk per jenis perangkat, kinerja per teknisi (tiket diambil + nilai servis).
- F-12.4 Setiap angka dibandingkan dengan bulan sebelumnya (selisih Rupiah/jumlah dan persen).
- F-12.5 Kasus gagal: bulan tanpa data menampilkan pesan bulan kosong (teks di AFD F-12).

**F-13 Beranda ringkasan**
- F-13.1 Pemilik: perlu tindakan (Konfirmasi biaya > 2 hari, estimasi Ditolak belum dibatalkan, siap diambil, Dibatalkan belum Dikembalikan, link belum dikirim, belum lunas, minta izin serah), tiket aktif per tahap, kas hari ini per akun, stok menipis, absensi hari ini.
- F-13.2 Admin: sama dengan Pemilik tanpa modal/profit dan angka bulanan.
- F-13.3 Teknisi: tiket yang ditugaskan kepadanya + tombol absen.
- F-13.4 Angka berubah sendiri saat data berubah (realtime).

**F-14 Data pelanggan + riwayat**
- F-14.1 Admin/Pemilik mencari pelanggan dari nama atau nomor WA; halaman pelanggan berisi nama, WA, dan riwayat semua tiket.
- F-14.2 Pemilik bisa menyamarkan pelanggan atas permintaan (UU PDP): nama dan WA diganti "Pelanggan dihapus"; tiket dan angka tetap.

**F-15 Klaim garansi**
- F-15.1 Tombol "Klaim garansi" di tiket lama (Diambil) membuat tiket baru (nomor NS- berikutnya) yang terhubung ke tiket lama; pilih garansi jasa atau sparepart; biaya awal Rp0.
- F-15.2 Garansi yang dipilih sudah berakhir: tombol klaim tidak tersedia dan tampil tanggal berakhirnya (teks di AFD F-15). Klaim dibuat sebagai tiket biasa.
- F-15.3 Tiket klaim dibuat dengan estimasi Rp0 yang langsung Disetujui (tidak terkunci di Konfirmasi biaya); biaya final tetap bisa diisi lebih dari Rp0 saat Selesai.

**F-16 Pengaturan template**
- F-16.1 Hanya Pemilik: daftar keluhan per jenis perangkat, daftar kelengkapan, teks pesan WA (Diterima, Selesai, Diambil), S&K dan teks pemberitahuan privasi, link ulasan Google, ukuran printer (58/80 mm), akun kas + saldo awal, garansi awal (jasa, sparepart), titik lokasi workshop ("pakai lokasi saya sekarang"), toleransi terlambat (menit).
- F-16.2 Sebelum layar ini ada, semua nilai diisi lewat data awal (BSD bagian 7).
- F-16.3 Kasus gagal: link ulasan yang bukan URL https ditolak dengan pesan di bawah kolom (teks di AFD F-16).

**F-17 Jual barang langsung**
- F-17.1 Admin/Pemilik memilih barang + jumlah, diskon (boleh), bayar (split boleh), lalu cetak atau kirim nota bernomor JL-00001 (urut, terpisah dari NS-). Nama dan WA pembeli opsional; jika WA diisi, nama wajib (nomor WA memakai aturan F-01.3). Isi nota: logo, nama, alamat, WA workshop, nomor JL, tanggal, nama pembeli (jika ada), daftar barang (nama, jumlah, harga satuan, subtotal), diskon, total, rincian pembayaran (akun kas, nominal).
- F-17.2 Jumlah melebihi stok ditolak dengan sisa stok; stok berkurang saat tersimpan.
- F-17.3 Penjualan salah dibatalkan dengan alasan; stok dan saldo kembali.

## 6. Di Luar Scope (jangan dikerjakan)
- Aplikasi di Play Store/App Store: dashboard tetap web (bisa dipasang sebagai PWA).
- Penggajian dari absensi: absensi hanya mencatat jam.
- Booking/antre online pelanggan: pelanggan tetap lewat WA atau datang langsung.
- Ekspor ke Excel/CSV.
- Pembayaran online (payment gateway): pembayaran di workshop, dicatat staf.
- Multi-cabang/multi-bisnis: satu workshop.
- Kirim WA otomatis lewat API, push notification, kirim email, upload foto/file.
- Impor data dari FixMaster.
- Membuka kembali tiket yang sudah Diambil, Dibatalkan, atau Dikembalikan (final; salah tekan diperbaiki Pemilik lewat bantuan AI dan dicatat di IPD).
- Pemulihan akun lewat email dan pendaftaran mandiri staf (login hanya username + password; reset oleh Pemilik).
- Migrasi ke Supabase self-host di VPS (rencana Pemilik setelah rilis; kode dijaga tetap Postgres standar).

## 7. Kebutuhan Non-Fungsional
- Performa: halaman tracking < 2 detik di 4G; halaman dashboard < 3 detik di 4G; buat tiket <= 2 menit.
- Keamanan & privasi: UU PDP Indonesia; password/pola unit terenkripsi dan dihapus saat Diambil/Dibatalkan; GPS hanya jarak; riwayat perubahan data penting (BSD bagian 8); pemberitahuan privasi singkat (teks dari Pemilik) di tanda terima dan halaman tracking.
- Aksesibilitas: WCAG 2.2 AA.
- Perangkat/browser yang didukung: laptop/PC Windows (Chrome/Edge), HP Android (Chrome), iPhone (Safari), tablet; dua versi mayor terakhir.
- Bahasa UI, mata uang, zona waktu: Bahasa Indonesia, IDR tanpa desimal (Rp1.250.000), Asia/Jakarta (WIB), tanggal "2 Nov 2026".

## 8. Asumsi, Risiko Produk, Dependensi
- Asumsi: tidak ada yang tersisa; 8 asumsi dari update 2026-11-04 disetujui Pemilik pada 2026-11-04 (log A3a, A6a, A15a sampai A15f) dan isinya sudah menjadi kriteria di F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-09, F-11, F-12, F-15, F-16, F-17.
- Risiko produk terbesar: staf kembali ke cara lama -> mitigasi: buat tiket <= 2 menit, pelanggan lama terisi dari nomor WA, alur dan istilah tahap mengikuti FixMaster, peralihan setelah semua fitur siap.
- Risiko produk: nomor WA salah ketik sehingga link tidak sampai -> mitigasi: validasi format (F-01.3), penanda "Link belum dikirim" (F-05.4).
- Risiko produk: cetak thermal dari Android gagal -> mitigasi: diuji di printer asli sebelum rilis (IPD), cetak ulang dan WA sebagai cadangan.
- Risiko produk: Vercel Hobby melarang pemakaian komersial menurut ketentuan Vercel (https://vercel.com/docs/limits/fair-use-guidelines); Pemilik memutuskan tetap memakai Hobby (2026-11-04) -> akun atau proyek bisa dijeda atau ditutup Vercel sewaktu-waktu -> mitigasi: kode tidak memakai fitur khusus Vercel sehingga bisa dipindah ke VPS (rencana Pemilik), backup mingguan (L-32), pantau email dari Vercel.
- Risiko produk: proyek Supabase gratis dijeda jika tidak ada aktivitas database 7 hari (mis. workshop libur panjang) -> mitigasi: pulihkan lewat dashboard Supabase; proyek produksi baru dibuat saat rilis (L-36) supaya tidak menganggur selama build.
- Dependensi: Vercel (hosting, paket Hobby), Supabase (Auth + Postgres + Realtime), domain nuaraservice.my.id (perpanjangan tahunan), WhatsApp (wa.me), Google Maps (rute), RawBT (cetak Bluetooth Android), GitHub (kode, CI, backup).

## 9. Pertanyaan Terbuka
- Tidak ada. Nilai yang menunggu Pemilik (nama akun staf, akun kas + saldo awal, durasi garansi awal, S&K, teks pemberitahuan privasi, link ulasan Google, titik lokasi, toleransi terlambat) diisi saat langkah IPD terkait dan tidak dikarang.
