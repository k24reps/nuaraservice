import type { ReactNode } from 'react';

/**
 * Aksi utama halaman di zona jempol ponsel, tepat di atas menu bawah.
 * Hanya tampil saat menu bawah tampil (<=720px, varian `phone:`); di layar
 * lebih lebar aksi yang sama tinggal di toolbar halaman, jadi pemanggil
 * menyembunyikan salinan toolbar-nya di ponsel. Terikat kehadiran menu bawah,
 * bukan lebar wadah, jadi media query yang sah. Geometrinya sama dengan dok
 * keranjang Kasir: --space-4 di atas menu bawah. Taruh di akhir halaman:
 * pengganjal setinggi kontrol memberi ruang supaya isi terakhir tidak
 * tertutup dok.
 */
export function ThumbDock({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="hidden h-11 flex-none phone:block" />
      <div className="hidden phone:fixed phone:right-4 phone:bottom-[calc(var(--mobile-nav-height)+var(--space-4)+env(safe-area-inset-bottom))] phone:z-(--z-sticky) phone:flex [&>*]:shadow-[0_8px_20px_-6px_rgb(6_32_54/0.4),0_2px_6px_rgb(6_32_54/0.2)]">
        {children}
      </div>
    </>
  );
}
