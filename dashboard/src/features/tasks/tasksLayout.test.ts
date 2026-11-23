import { describe, expect, it } from 'vitest';
import pageTsx from './TasksPage.tsx?raw';
import modalTsx from './TaskTemplateModal.tsx?raw';
import appCss from '@/styles/app.css?raw';

const cssModules = Object.keys(import.meta.glob('./*.module.css'));

/**
 * Mekanisme halaman Tugas dan jendela templatnya sejak pindah ke dens-ui
 * (L-54). Ukuran sungguhan dicek lewat Playwright; tes ini menjaga mekanismenya.
 */
describe('halaman Tugas', () => {
  it('folder bertailwind: di @source utuh, tanpa CSS Module, satu data-nu di akar halaman', () => {
    expect(appCss).toContain('@source "../features/tasks";');
    expect(cssModules).toEqual([]);
    for (const src of [pageTsx, modalTsx]) {
      expect(src).not.toContain('styles.');
      expect(src).not.toMatch(/<(Icon|Modal|Card)\b/);
      for (const [, names] of src.matchAll(/import \{([^}]*)\} from '@\/components\/ui';/g)) {
        for (const n of names.split(',').map((x) => x.trim()).filter(Boolean)) {
          expect(['LoadState', 'loadPending']).toContain(n);
        }
      }
    }
    expect(pageTsx).toContain('<div data-nu className="@container/tugas flex flex-col gap-4 bg-transparent">');
    expect(pageTsx.match(/\bdata-nu\b/g)).toHaveLength(1);
  });

  it('tab sebagai tombol bertanda aria-pressed; baris tab boleh patah', () => {
    expect(pageTsx.match(/aria-pressed=\{tab === '(today|templates)'\}/g)).toHaveLength(2);
    expect(pageTsx).toContain('<div className="flex flex-wrap items-center gap-2">');
  });

  it('tanpa spine status: telat = lencana, selesai = coretan + kotak tercentang', () => {
    expect(pageTsx).not.toMatch(/::before|before:/);
    expect(pageTsx).toContain('<Badge variant="destructive-soft" className="font-mono">');
    expect(pageTsx).toContain('line-through');
  });

  it('target sentuh: kotak selesai 26px berarea 44px, pasangan naik/turun 26px jadi 44px', () => {
    expect(pageTsx).toContain('size-[26px]');
    expect(pageTsx).toContain('pointer-coarse:after:-inset-[11px]');
    expect(pageTsx).toContain("const narrow = 'w-[26px] pointer-coarse:w-11';");
  });

  it('baris templat: aksi turun ke baris kedua di wadah sempit', () => {
    expect(pageTsx).toContain('<li key={t.id} className={`flex flex-wrap items-center gap-3 py-3.5 ${ROW}`}>');
    expect(pageTsx).toContain('<div className="min-w-0 flex-1 @max-[400px]/tugas:basis-full">');
    expect(pageTsx).toContain('<div className="ml-auto flex shrink-0 gap-1">');
  });

  it('kolom tugas cepat melebar lewat pembungkus (kelas TextInput jatuh ke <input>)', () => {
    expect(pageTsx).toMatch(/<div className="min-w-0 flex-1">\s*<TextInput/);
  });

  it('hapus templat mati selama diproses', () => {
    expect(pageTsx).toContain('loading={deleting}');
    expect(pageTsx).toContain('if (!toDelete || deleting) return;');
  });

  it('jendela templat: FormDialog + <form>, galat di puncak, fokus awal di nama', () => {
    expect(modalTsx).toContain('<FormDialog');
    expect(modalTsx).toContain('form="task-template"');
    expect(modalTsx).toContain('<FormMessage>{error}</FormMessage>');
    expect(modalTsx).not.toMatch(/\bautoFocus\b/);
    expect(modalTsx.match(/data-autofocus/g)).toHaveLength(1);
    // Kolom yang salah tetap ditandai.
    expect(modalTsx).toContain("invalid={invalid('name')}");
    expect(modalTsx).toContain("invalid={invalid('items')}");
    expect(modalTsx).toContain("invalid={invalid('monthDays')}");
    // Hari mingguan: tombol toggle yang terbaca pembaca layar.
    expect(modalTsx).toContain('aria-pressed={weekdays.includes(w.d)}');
  });
});
