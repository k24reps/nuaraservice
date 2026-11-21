import { describe, expect, it } from 'vitest';
import css from './nuara-theme.css?raw';

/*
 * Gerbang kontras tema Nuara (komponen dens-ui). Pasangan di bawah adalah
 * pasangan teks/latar yang benar-benar dipakai komponen di src/components/dens
 * (mis. badge `bg-warning text-warning-foreground`). WCAG 2.2 AA: teks >= 4.5,
 * batas kontrol dan cincin fokus >= 3 (DBD bagian 2 dan 5).
 */

function tokens(): Record<string, string> {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const m of root.matchAll(/--nu-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT: [fg: string, bg: string][] = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['foreground', 'surface'],
  ['foreground', 'highlight-soft'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'secondary'],
  ['primary', 'card'],
  ['primary-foreground', 'primary'],
  ['primary-foreground', 'primary-hover'],
  ['brand-foreground', 'brand'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['highlight-foreground', 'highlight'],
  ['soft-foreground', 'soft'],
  ['success-foreground', 'success'],
  ['warning-foreground', 'warning'],
  ['info-foreground', 'info'],
  ['destructive-foreground', 'destructive'],
  ['destructive', 'card'],
  ['destructive', 'destructive-soft'],
  ['sidebar-foreground', 'sidebar'],
  // L-58: label kekuatan password dan kriteria yang terpenuhi (teks 12px di kartu).
  ['warning-foreground', 'card'],
  ['success-foreground', 'card'],
  // L-58: kartu pengguna PIN terpilih/hover, dan baris tim/wallet wizard (bg-surface).
  ['foreground', 'sidebar-accent'],
  ['muted-foreground', 'sidebar-accent'],
  ['muted-foreground', 'accent'],
  ['muted-foreground', 'surface'],
  ['sidebar-primary-foreground', 'sidebar-primary'],
  ['sidebar-accent-foreground', 'sidebar-accent'],
  ['rail-foreground', 'rail'],
];

const NON_TEXT: [fg: string, bg: string][] = [
  ['input', 'card'],
  ['input', 'background'],
  ['ring', 'card'],
  ['ring', 'background'],
  ['sidebar-ring', 'sidebar'],
];

describe('tema Nuara (nuara-theme.css)', () => {
  const t = tokens();

  it('mendefinisikan semua warna yang dipasangkan', () => {
    for (const [fg, bg] of [...TEXT, ...NON_TEXT]) {
      expect(t[fg], `--nu-${fg}`).toMatch(/^#/);
      expect(t[bg], `--nu-${bg}`).toMatch(/^#/);
    }
  });

  it.each(TEXT)('teks %s di atas %s >= 4.5:1', (fg, bg) => {
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT)('batas/fokus %s di atas %s >= 3:1', (fg, bg) => {
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
  });

  it('memakai warna merek DBD, bukan Mars Green dens-ui', () => {
    expect(t.primary.toLowerCase()).toBe('#062036');
    expect(t.highlight.toLowerCase()).toBe('#faa403');
    expect(css.toLowerCase()).not.toMatch(/#008c8d|#00797a|#ff8a00/);
  });
});
