import { toast as sonner } from 'sonner';

/**
 * Toast aplikasi, ditampilkan sonner sejak L-47 (<Toaster /> di App.tsx,
 * tampilan di components/dens/sonner.tsx). Pemanggil tetap memakai helper ini,
 * bukan sonner langsung: 39 berkas tidak berubah saat pustakanya diganti, dan
 * penggantian berikutnya pun cukup di sini.
 */
export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export const toast: Record<ToastTone, (message: string) => void> = {
  success: (message) => void sonner.success(message),
  error: (message) => void sonner.error(message),
  warning: (message) => void sonner.warning(message),
  info: (message) => void sonner.info(message),
};
