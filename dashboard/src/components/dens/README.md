# Komponen dens-ui

Disalin dari dens-ui v0.2.0 (https://github.com/dendense/dens-ui, commit 4e8c4c2) lalu disesuaikan untuk Nuara Dashboard: impor ke `@/components/dens/`, warna lewat tema `src/styles/nuara-theme.css`, bayangan diwarnai navy, hover tombol utama memakai `primary-hover` DBD.

Komponen tambahan yang bukan dari dens-ui (ditulis mengikuti pola shadcn/ui, MIT): `popover`, `sheet`, `drawer` (vaul), `command` (cmdk), `combobox`, `sonner`.

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
