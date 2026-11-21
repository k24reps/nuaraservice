import { describe, expect, it } from 'vitest';
import vercelSource from '../../vercel.json?raw';

const config = JSON.parse(vercelSource) as {
  rewrites: Array<{ source: string; destination: string }>;
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};

// Sumber header di vercel.json ditulis sebagai grup regex mentah tanpa
// parameter bernama, jadi RegExp biasa mencocokkannya sama seperti Vercel.
function headersFor(path: string) {
  return config.headers
    .filter((rule) => new RegExp(`^${rule.source}$`).test(path))
    .flatMap((rule) => rule.headers);
}

const robotsTagFor = (path: string) =>
  headersFor(path).find((header) => header.key === 'X-Robots-Tag')?.value;

const spaRoutes = [
  '/track',
  '/t/:code',
  '/reset-password',
  '/services',
  '/services/:id',
  '/calculator',
  '/pos',
  '/customers',
  '/inventory',
  '/suppliers',
  '/finance',
  '/tasks',
  '/attendance',
  '/reports',
  '/activity',
  '/settings',
];

describe('Vercel SPA route allowlist', () => {
  it('keeps every app and tracking deep link available', () => {
    expect(config.rewrites).toEqual(
      spaRoutes.map((source) => ({ source, destination: '/index.html' })),
    );
  });

  it('does not rewrite unknown URLs', () => {
    expect(config.rewrites.some((rewrite) => rewrite.source.includes('(.*)'))).toBe(false);
  });
});

describe('Vercel crawler headers', () => {
  it('writes header sources without named params, so the test matcher stays faithful', () => {
    expect(config.headers.some((rule) => rule.source.includes(':'))).toBe(false);
  });

  // Nuara Dashboard adalah alat internal workshop: tidak ada halaman yang
  // boleh muncul di mesin pencari, termasuk link lacak pelanggan.
  it('marks every route noindex, including the root', () => {
    for (const source of ['/', ...spaRoutes]) {
      const path = source.replace(/:\w+/g, 'X7K2QA');
      expect(robotsTagFor(path), path).toBe('noindex, nofollow');
    }
  });
});
