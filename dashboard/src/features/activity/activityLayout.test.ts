import { describe, expect, it } from 'vitest';
import pageTsx from './ActivityLogPage.tsx?raw';
import activityTs from '@/lib/business/activity.ts?raw';
import appCss from '@/styles/app.css?raw';

const cssModules = Object.keys(import.meta.glob('./*.module.css'));

/** Mekanisme Log Aktivitas sejak pindah ke dens-ui (L-65). */
describe('Log Aktivitas', () => {
  it('folder bertailwind: di @source utuh, tanpa CSS Module, satu data-nu di akar', () => {
    expect(appCss).toContain('@source "../features/activity";');
    expect(cssModules).toEqual([]);
    expect(pageTsx).not.toContain('styles.');
    expect(pageTsx).not.toMatch(/from '@\/components\/ui'/);
    expect(pageTsx).toContain('<div data-nu className="@container/log flex flex-col gap-4 bg-transparent">');
    expect(pageTsx.match(/\bdata-nu\b/g)).toHaveLength(1);
  });

  it('setiap ikon di ACTION_META punya padanan lucide', () => {
    const names = new Set([...activityTs.matchAll(/icon: '([a-z-]+)'/g)].map((m) => m[1]));
    expect(names.size).toBeGreaterThan(10);
    for (const n of names) expect(pageTsx, n).toMatch(new RegExp(`^\\s+'?${n}'?: [A-Z]\\w*,$`, 'm'));
  });

  it('toolbar menumpuk lewat container query, bukan media query', () => {
    expect(pageTsx).not.toMatch(/[\s'"`](drawer|narrow|phone|compact):/);
    expect(pageTsx).toContain('@max-[641px]/log:basis-full');
    expect(pageTsx).toContain('<SelectBox\n          className="w-auto @max-[641px]/log:w-full"');
  });

  it('ringkasan jumlah = SummaryStrip; pangkas log tak bisa diketuk dua kali', () => {
    expect(pageTsx).toContain('<SummaryStrip');
    expect(pageTsx).toContain("{ label: 'Termuat', value: logs.length }");
    expect(pageTsx).toContain('loading={purging}');
    expect(pageTsx).toContain('if (purging) return;');
  });
});
