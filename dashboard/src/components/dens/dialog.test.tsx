import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormDialog } from './form-dialog';
import { Input } from './input';
import { Sheet, SheetContent, SheetTitle } from './sheet';

/**
 * Jendela yang dibuka dari state (bukan <DialogTrigger>): Radix sendiri hanya
 * mengembalikan fokus ke DialogTrigger, jadi tanpa CaptureFocus di
 * dialog.tsx fokus jatuh ke body saat jendela ditutup (terukur di daftar
 * Servis, L-48). Fokus awal lewat data-autofocus, bukan autoFocus.
 */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Servis Baru
      </button>
      <FormDialog open={open} onClose={() => setOpen(false)} title="Servis Baru">
        <Input aria-label="Cabang" />
        <Input aria-label="Nama" data-autofocus />
      </FormDialog>
    </>
  );
}

describe('FormDialog', () => {
  it('fokus awal ke data-autofocus, lalu kembali ke tombol pembuka saat ditutup', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Servis Baru' });
    opener.focus();
    fireEvent.click(opener);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Nama'));
    await act(async () => {
      fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    // Radix mengembalikan fokus sesudah satu tick (setTimeout di FocusScope).
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

/** Sheet (panel samping) memakai mekanisme yang sama: kartu pelanggan yang
 *  membuka riwayat (L-51) bukan SheetTrigger, jadi tanpa CaptureFocus fokus
 *  jatuh ke body saat panel ditutup. */
function SheetHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div role="button" tabIndex={0} onClick={() => setOpen(true)}>
        Andi
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle>Riwayat servis</SheetTitle>
        </SheetContent>
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  it('fokus kembali ke kartu pembuka saat panel ditutup', async () => {
    render(<SheetHarness />);
    const opener = screen.getByRole('button', { name: 'Andi' });
    opener.focus();
    fireEvent.click(opener);
    expect(await screen.findByRole('dialog')).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
