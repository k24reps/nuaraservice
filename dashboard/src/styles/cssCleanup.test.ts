import { describe, expect, it } from 'vitest';
import appCss from './app.css?raw';
import baseCss from './base.css?raw';
import layoutCss from './layout-tokens.css?raw';

/**
 * Pencabutan CSS FixMaster (L-69): tokens.css dan global.css tak ada lagi;
 * dasar global ada di base.css (layer base), token tata letak di
 * layout-tokens.css, warna dan bentuk di nuara-theme.css.
 */
const sources = import.meta.glob('/src/**/*.{ts,tsx,css}', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

describe('CSS global (L-69)', () => {
  it('tokens.css dan global.css FixMaster sudah tak ada', () => {
    const files = Object.keys(import.meta.glob('/src/styles/*.css'));
    expect(files.map((f) => f.split('/').pop()).sort()).toEqual([
      'app.css',
      'base.css',
      'dens-base.css',
      'layout-tokens.css',
      'nuara-theme.css',
    ]);
    expect(appCss).not.toMatch(/@import "\.\/(tokens|global)\.css"/);
    expect(appCss).not.toContain('layer(legacy)');
  });

  it('urutan layer: theme < base < nu-base < components < utilities', () => {
    expect(appCss).toContain('@layer theme, base, nu-base, components, utilities;');
    expect(appCss).toContain('@import "./layout-tokens.css";');
    expect(appCss).toContain('@import "./base.css";');
  });

  it('aturan dasar berada di layer base supaya kalah dari utilitas (selection:, focus-visible:)', () => {
    // Satu-satunya yang boleh di luar layer: @font-face dan blok @layer itu sendiri.
    const outside = baseCss
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@font-face\s*\{[^}]*\}/g, '')
      .replace(/@layer base \{[\s\S]*?\n\}\n/g, '');
    expect(outside.trim()).toBe('');
    expect(baseCss).toContain('::selection');
    // Hiasan merek FixMaster tidak kembali: kisi PCB di latar, tautan amber, font judul, keyframe fm-*.
    const code = baseCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/body::before|Space Grotesk|--brand|fm-[a-z]+|\.spin/);
  });

  it('body memakai warna latar Nuara, sama dengan latar aplikasi (bukan #ebeef2 FixMaster)', () => {
    expect(baseCss).toContain('background: var(--nu-background);');
    expect(baseCss).toContain('font-family: var(--nu-font-sans);');
  });

  it('tangga token tata letak tetap lengkap, termasuk kerapatan Padat', () => {
    for (const name of [
      '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-8', '--space-10',
      '--control-h', '--sidebar-width', '--sidebar-collapsed', '--topbar-height', '--mobile-nav-height',
      '--content-max', '--app-inset-top', '--zoom', '--app-vh', '--z-sticky', '--z-sidebar', '--z-overlay', '--z-toast',
    ]) {
      expect(layoutCss, name).toContain(`${name}:`);
    }
    expect(layoutCss).toContain("@media (pointer: fine)");
    expect(layoutCss).toContain(":root[data-density='padat']");
  });

  it('tak ada variabel CSS menggantung: tiap var(--x) dibaca punya definisi di src', () => {
    const all = Object.entries(sources).filter(([f]) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));
    const text = all.map(([, s]) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')).join('\n');
    const used = new Set([...text.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
    // Definisi: `--x:` di CSS atau string kelas Tailwind `[--x:...]`, `'--x'` di style/setProperty, nama tema Tailwind.
    const defined = new Set([...text.matchAll(/(?:^|[\s;{[(,'"`])(--[a-z0-9-]+)\s*['"`]?\s*:/gm)].map((m) => m[1]));
    for (const m of text.matchAll(/setProperty\(\s*['"`](--[a-z0-9-]+)/g)) defined.add(m[1]);
    // Dasar Tailwind sendiri: spacing dan variabel pembantu.
    const builtin = /^--(spacing|tw-|color-|font-|text-|radius-|shadow-|ease-|animate-|default-|container-|breakpoint-|leading-|tracking-|blur-|inset-shadow-|drop-shadow-)/;
    const dangling = [...used].filter((n) => !defined.has(n) && !builtin.test(n)).sort();
    expect(dangling).toEqual([]);
  });
});
