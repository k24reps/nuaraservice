import { createPortal } from 'react-dom';
import { Toaster } from '@/components/dens/sonner';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/**
 * Toast aplikasi (sonner). Di ponsel (<=720px, sama dengan menu bawah) toast
 * naik di atas menu bawah supaya tidak menutupi navigasi; sonner sendiri hanya
 * punya satu ambang ponsel (600px), jadi jaraknya diatur di sini.
 *
 * Dirender lewat portal ke <body>: #root memakai `isolation: isolate`, sehingga
 * toast di dalamnya selalu tertutup laci vaul dan dialog Radix (portal di body),
 * berapa pun z-index-nya.
 */
export function AppToaster() {
  const phone = useMediaQuery('(max-width: 720px)');
  const bottom = phone ? 'calc(var(--mobile-nav-height) + 20px + env(safe-area-inset-bottom))' : 24;
  if (typeof document === 'undefined') return null;
  return createPortal(
    <Toaster
      position={phone ? 'bottom-center' : 'bottom-right'}
      offset={{ bottom, right: 24, left: 16 }}
      mobileOffset={{ bottom, right: 12, left: 12 }}
    />,
    document.body,
  );
}
