/**
 * Jenis perangkat bawaan dan daftar keluhan awal per jenis.
 *
 * Tiga jenis dan 16 keluhannya diambil apa adanya dari nota di landing page
 * Nuara (index.html, bagian "Keluhan"), sesuai PRD F-01.10 dan F-16.1; bukan
 * karangan. Pemilik menyunting daftar per jenis di Pengaturan, Operasional.
 */
export const DEVICE_LAPTOP = 'Laptop/PC';
export const DEVICE_HP = 'HP';
export const DEVICE_HOME = 'Elektronik rumah tangga';

/** Jenis awal toko baru (wizard dan cadangan bila baris toko belum menyimpan daftar). */
export const DEFAULT_DEVICE_CATEGORIES: string[] = [DEVICE_LAPTOP, DEVICE_HP, DEVICE_HOME];

export const DEFAULT_COMPLAINTS_BY_CATEGORY: Readonly<Record<string, readonly string[]>> = {
  [DEVICE_LAPTOP]: [
    'Mati total atau black screen',
    'Motherboard atau IC bermasalah',
    'LCD/layar rusak',
    'Keyboard rusak',
    'Baterai drop',
    'Upgrade SSD atau RAM',
    'Bersihkan debu dan ganti thermal paste',
  ],
  [DEVICE_HP]: [
    'LCD/touchscreen pecah atau blank',
    'Baterai boros atau kembung',
    'Port charger tidak masuk',
    'Bootloop atau restart sendiri',
  ],
  [DEVICE_HOME]: [
    'TV mati total',
    'TV ada suara tapi tidak ada gambar',
    'TV layar bergaris',
    'Mesin cuci bermasalah (modul/kelistrikan)',
    'Kulkas bermasalah (modul/kelistrikan)',
  ],
};

/**
 * Daftar keluhan untuk satu jenis. Urutan: daftar yang sudah disimpan Pemilik
 * untuk jenis itu (boleh kosong: sengaja tanpa pilihan cepat), lalu isi awal bila
 * namanya salah satu dari tiga jenis bawaan, lalu daftar umum (jenis tanpa daftar
 * sendiri). Tanpa jenis (form belum memilih) = daftar umum.
 */
export function resolveComplaints(
  category: string | undefined,
  saved: Record<string, string[]> | undefined,
  general: readonly string[],
): string[] {
  if (category) {
    const own = saved?.[category];
    // jsonb bisa ditulis tangan: hanya teks tak kosong yang dipakai.
    if (Array.isArray(own)) return own.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
    const seed = DEFAULT_COMPLAINTS_BY_CATEGORY[category];
    if (seed) return [...seed];
  }
  return [...general];
}
