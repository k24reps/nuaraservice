import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useDrawerFocus } from '@/hooks/useDrawerFocus';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/dens/dropdown-menu';

/**
 * Laci sidebar (tablet) dan menu cabang di dalamnya sama-sama menutup dengan
 * Esc. Esc pertama harus menutup menunya saja: Radix menandai event-nya
 * defaultPrevented di fase capture, dan useDrawerFocus melewati event itu.
 * Bila salah satunya berubah, Esc di menu cabang ikut menutup laci.
 */
function DrawerWithMenu({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLButtonElement>(null);
  useDrawerFocus({ active: true, containerRef, returnRef, onClose });
  return (
    <>
      <button ref={returnRef} type="button">
        Menu
      </button>
      <div ref={containerRef}>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Cabang</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Semua Outlet</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

describe('Esc di menu cabang di dalam laci', () => {
  it('menutup menunya dulu, laci tetap terbuka; Esc berikutnya baru menutup laci', () => {
    const onClose = vi.fn();
    render(<DrawerWithMenu onClose={onClose} />);
    const item = screen.getByRole('menuitem', { name: 'Semua Outlet' });
    fireEvent.keyDown(item, { key: 'Escape' });
    expect(screen.queryByRole('menuitem', { name: 'Semua Outlet' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
