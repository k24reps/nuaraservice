import { cleanReceiptText } from './receiptTemplate';

/**
 * Isian Pengaturan yang dibaca fitur lain (nota, halaman lacak, pesan WA, absensi).
 * Semuanya kosong sampai Pemilik mengisi: tidak ada nilai bisnis yang dikarang.
 */

/** Teks pemberitahuan privasi: dicetak di nota dan tampil di halaman lacak (L-77, L-78). */
export const PRIVACY_NOTICE_MAX = 400;

export function cleanPrivacyNotice(raw: unknown): string {
  return cleanReceiptText(raw, PRIVACY_NOTICE_MAX);
}

/** Link ulasan Google: panjang URL yang wajar untuk pesan WA. */
export const REVIEW_URL_MAX = 300;

export type ReviewUrlResult =
  | { ok: true; value: string }
  | { ok: false; reason: 'scheme' | 'format' | 'length' };

/**
 * Kosong = tanpa link (pesan ulasan tidak dikirim). Selain itu harus URL https
 * yang utuh: skema lain (http, javascript, data) ditolak, begitu juga spasi di
 * dalamnya dan kredensial di depan alamat.
 */
export function validateReviewUrl(raw: string): ReviewUrlResult {
  const value = raw.trim();
  if (value === '') return { ok: true, value: '' };
  if (value.length > REVIEW_URL_MAX) return { ok: false, reason: 'length' };
  if (/\s/.test(value)) return { ok: false, reason: 'format' };
  // Skema dibaca dari teks, bukan dari `new URL`: "javascript:..." dan "http://"
  // harus dijawab "bukan https", bukan "format salah".
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (!scheme || scheme[1].toLowerCase() !== 'https') return { ok: false, reason: 'scheme' };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'format' };
  }
  if (!url.hostname.includes('.') || url.username || url.password) {
    return { ok: false, reason: 'format' };
  }
  return { ok: true, value };
}

/** Toleransi terlambat absensi (menit); dipakai L-79. */
export const LATE_TOLERANCE_MAX = 120;

export type LateToleranceResult = { ok: true; value: number | null } | { ok: false };

/** Kosong = tidak diisi (dibaca 0 menit). Selain itu bilangan bulat 0 sampai 120. */
export function parseLateTolerance(raw: string): LateToleranceResult {
  const text = raw.trim();
  if (text === '') return { ok: true, value: null };
  if (!/^\d{1,3}$/.test(text)) return { ok: false };
  const n = Number(text);
  return n <= LATE_TOLERANCE_MAX ? { ok: true, value: n } : { ok: false };
}

/** Nilai tersimpan yang tak masuk akal (jsonb ditulis tangan) dibaca sebagai 0 menit. */
export function readLateTolerance(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return 0;
  return raw >= 0 && raw <= LATE_TOLERANCE_MAX ? raw : 0;
}
