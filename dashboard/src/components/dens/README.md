# Komponen dens-ui

Disalin dari dens-ui v0.2.0 (https://github.com/dendense/dens-ui, commit 4e8c4c2) lalu disesuaikan untuk Nuara Dashboard: impor ke `@/components/dens/`, warna lewat tema `src/styles/nuara-theme.css`, bayangan diwarnai navy, hover tombol utama memakai `primary-hover` DBD.

Komponen tambahan yang bukan dari dens-ui (ditulis mengikuti pola shadcn/ui, MIT): `popover`, `sheet`, `drawer` (vaul), `command` (cmdk), `combobox`, `sonner`.

Tambahan Nuara (bukan dari dens-ui; tiap berkas menyebutnya di komentar kepala). Sebagian adalah pengganti komponen FixMaster di `components/ui/` dengan API yang sama, supaya halaman yang dipindah tinggal mengganti impor:

| Berkas | Isi | Pengganti FixMaster |
|---|---|---|
| `field.tsx` | `Field` (label + petunjuk/galat tertaut, `invalid`), `FormMessage` | `FormFields`/`FormError` |
| `password-input.tsx`, `password-strength.tsx` | password dengan tombol tampil/sembunyi, kekuatan password | `Input revealable`, `PasswordStrength` |
| `text-input.tsx` | `TextInput`: kapitalisasi otomatis, ikon depan, tombol hapus isi | `Input` |
| `select-box.tsx` | `SelectBox`: Select dari daftar opsi, opsi bernilai "" diizinkan | `Select`, `<select>` |
| `form-dialog.tsx` | `FormDialog`: jendela form, lembar bawah di <=640px, fokus awal `data-autofocus` | `Modal` (form) |
| `confirm-dialog.tsx` | `ConfirmDialog` | `ConfirmDialog` |
| `summary-strip.tsx` | `SummaryStrip`: strip ringkasan halaman | `PageSummary` |
| `filter-chips.tsx` | `FilterChips`: chip saring berjumlah, baris geser berpudar | `CategoryChips` |
| `empty-state.tsx` | `EmptyState` | `EmptyState` |
| `whatsapp-icon.tsx` | logo WhatsApp (Phosphor, MIT); lucide tak memuat logo merek | ikon `whatsapp` |

Folder ini sengaja bukan `components/ui/`: komponen FixMaster di sana bernama `Button.tsx`, sedangkan dens-ui `button.tsx`; di Windows dan macOS keduanya berkas yang sama.

## Lisensi dens-ui

```
MIT License

Copyright (c) 2026 Denslab

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
