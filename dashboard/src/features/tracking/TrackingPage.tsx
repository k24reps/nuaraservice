import { useState, useRef, type ReactNode } from 'react';
import '@fontsource-variable/archivo/wdth.css';
import {
  Check,
  CircleCheck,
  CircleQuestionMark,
  Clock,
  Info,
  LoaderCircle,
  MapPin,
  RotateCw,
  Scissors,
  Search,
  ShieldCheck,
  TriangleAlert,
  Wrench,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { repository, isSupabaseConfigured } from '@/data';
import {
  trackService,
  trackServiceByCode,
  TrackRateLimitedError,
  type TrackServiceResult,
} from '@/data/supabase-client';
import { STATUS_LABELS, historyKind, partWarranties } from '@/lib/business/services';
import type { ServiceStatus } from '@/data/types';
import { nextStepFor, normalizeTrackCode, relativeSince } from '@/lib/business/tracking';
import { waLink, interpolate } from '@/lib/business/notify';
import { termsClauses, termsOf, termsSentenceText } from '@/lib/business/serviceTerms';
import { useT } from '@/i18n';
import { slidingWindowAllow } from '@/lib/rate-limit';
import { fmtDate, localDateOf, localTimeStr } from '@/lib/time';
import { WhatsAppIcon } from '@/components/dens/whatsapp-icon';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session';

/** Normalized tracking result shared by both the cloud-RPC and local paths. */
interface TrackResult {
  orgName: string;
  /** Store contact so the customer knows who/where to reach. No pricing. */
  orgPhone: string;
  orgAddress: string;
  /** Store logo — the customer's only proof this page belongs to THEIR shop. */
  orgLogoUrl: string | null;
  /** Catatan bebas milik toko (jam buka, syarat garansi, aturan pengambilan). */
  orgNote: string;
  service: {
    serviceNo: string;
    device: string;
    category: string;
    status: string;
    warrantyServiceUntil: string | null;
    warrantyPartsUntil: string | null;
    /** Garansi per sparepart; kosong untuk tiket lama → pakai warrantyPartsUntil. */
    partWarranties: { name: string; until: string | null }[];
    pickedUp: boolean;
  } | null;
  publicHistory: { status: string; at: string; note?: string; terms?: unknown }[];
}

/**
 * Tanggal + jam untuk satu langkah timeline. Tanggal saja membuat tiga langkah
 * yang terjadi di hari yang sama terbaca identik ("2 Sep 2026" tiga kali) dan
 * menghapus rasa "ini bergerak cepat" — padahal `at` sudah membawa jamnya.
 * Timestamp rusak jatuh kembali ke tanggal saja, bukan "Invalid Date".
 */
function stepStamp(at: string): string {
  const date = fmtDate(localDateOf(at));
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? date : date + ' · ' + localTimeStr(d);
}

/** Hasil RPC cloud (lewat nomor maupun kode) dalam bentuk halaman ini. */
function fromCloud(r: TrackServiceResult | null): TrackResult {
  return {
    orgName: r?.orgName ?? 'Nuara Service',
    orgPhone: r?.orgPhone ?? '',
    orgAddress: r?.orgAddress ?? '',
    orgLogoUrl: r?.orgLogoUrl ?? null,
    orgNote: r?.orgNote ?? '',
    service: r
      ? {
          serviceNo: r.serviceNo,
          device: r.device,
          category: r.category,
          status: r.status,
          warrantyServiceUntil: r.warrantyServiceUntil,
          warrantyPartsUntil: r.warrantyPartsUntil,
          partWarranties: r.partWarranties ?? [],
          pickedUp: r.pickedUp,
        }
      : null,
    publicHistory: (r?.publicHistory ?? []).filter((h) => !h.internal),
  };
}

// Kartu kertas di meja: garis atas amber (kartu nama), tinta navy.
const KARTU =
  'relative overflow-hidden rounded-md bg-paper p-5 pt-6 text-ink shadow-[0_2px_3px_rgb(0_0_0/0.18),0_18px_40px_-12px_rgb(0_0_0/0.5)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-amber';
// Label cetak: huruf sempit kapital kecil.
const LABEL =
  'block text-[0.78rem] font-extrabold tracking-[0.05em] text-ink-soft uppercase [font-variation-settings:"wdth"_75]';
const HINT = 'text-sm leading-normal text-ink-soft';

/** Baris garansi: label, garis titik-titik, nilai: seperti isian di lembar pelanggan. */
function WarrantyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 py-1.5">
      <dt className="min-w-0 [overflow-wrap:anywhere]">{label}</dt>
      <span aria-hidden className="mb-1 min-w-4 flex-1 border-b-2 border-dotted border-ink/50" />
      <dd className="shrink-0 font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}

function RetryButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink px-4 font-extrabold text-paper outline-none hover:bg-primary-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-carbon"
    >
      <RotateCw className="size-4" aria-hidden />
      {label}
    </button>
  );
}

/** Kartu pesan di meja: gagal muat, batas laju, tidak ditemukan, memuat. */
function Notice({
  icon: Icon,
  children,
  action,
  role,
  spin,
}: {
  icon: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
  role?: 'alert' | 'status';
  spin?: boolean;
}) {
  return (
    <div role={role} className={cn(KARTU, 'flex gap-3')}>
      <Icon className={cn('mt-0.5 size-6 shrink-0 text-stamp', spin && 'motion-safe:animate-spin')} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1.5 leading-snug">
        {children}
        {action}
      </div>
    </div>
  );
}

/**
 * Public, no-login service tracking page, in two modes:
 *
 * - `/t/<kode>` (QR nota sejak 0100): kode acak per tiket lewat RPC
 *   `track_service_by_code`. Kodenya sendiri yang menunjuk toko dan tiket, jadi
 *   nomor tiket berikutnya tak bisa ditebak dari nota yang sedang dipegang.
 * - `/track?org=&no=`: nota dan pesan WhatsApp lama tetap terbuka, lewat RPC
 *   `track_service`.
 *
 * Cloud reads go through security-definer RPCs granted to `anon` — a direct
 * `services` table read is blocked by RLS for anonymous visitors. Local/dev
 * mode (no Supabase) reads the IndexedDB repository, scoped by the org query
 * param, and has no codes at all (data/servicePrint).
 */
export function TrackingPage() {
  const t = useT();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { code: routeCode } = useParams<{ code?: string }>();
  const codeMode = routeCode !== undefined;
  const trackCode = codeMode ? normalizeTrackCode(routeCode) : null;
  // Tracking is inherently org-scoped (service numbers like FM-0001 repeat
  // across shops). Prefer the ?org= param from a shared link; if absent (e.g.
  // an owner opening /track directly while logged in), fall back to the
  // session org so the lookup still works.
  const sessionOrgId = useSessionStore((s) => s.org?.id ?? '');
  const orgId = params.get('org') || sessionOrgId;
  const initialNo = params.get('no') ?? '';

  const [query, setQuery] = useState(codeMode ? (trackCode ?? routeCode ?? '') : initialNo);
  const [searchNo, setSearchNo] = useState(initialNo);
  const [throttleMsg, setThrottleMsg] = useState('');
  // Pengunjung yang datang dari tautan WhatsApp sudah membawa nomornya dan
  // hasilnya langsung tampil; kotak pencarian penuh cuma mendorong jawabannya
  // ke bawah lipatan. Jadi begitu ada hasil, panel ini menciut jadi satu
  // tautan — dan terbuka lagi kalau pengunjung memang mau mencari nomor lain.
  const [searchOpen, setSearchOpen] = useState(false);
  // Client-side defense-in-depth: throttle repeated lookups (the cloud RPC is
  // also throttled server-side at 60/min per org).
  const searchTimes = useRef<number[]>([]);

  const runSearch = () => {
    const { allowed, timestamps, retryAfter } = slidingWindowAllow(
      searchTimes.current,
      10,
      60_000,
    );
    searchTimes.current = timestamps;
    if (!allowed) {
      setThrottleMsg(interpolate(t('tracking.throttled'), { seconds: String(retryAfter) }));
      return;
    }
    setThrottleMsg('');
    if (codeMode) {
      const next = normalizeTrackCode(query);
      if (!next) {
        setThrottleMsg(t('tracking.codeInvalid'));
        return;
      }
      setSearchOpen(false);
      navigate('/t/' + next);
      return;
    }
    if (!orgId) {
      // No org from the link and no logged-in session → we can't know which
      // shop's service to look up. Tell the visitor instead of silently doing
      // nothing (the lookup query stays disabled without an org).
      setThrottleMsg(t('tracking.noOrg'));
      return;
    }
    setSearchNo(query);
    setSearchOpen(false);
  };

  // Kode yang bentuknya salah, atau mode lokal yang tak punya server untuk
  // menerjemahkannya, tak perlu ditanyakan ke mana pun: jawabannya pasti kosong.
  const codeUnresolvable = codeMode && (!trackCode || !isSupabaseConfigured);

  const { data, error, isFetching, isFetched, isError, refetch } = useQuery<TrackResult>({
    queryKey: codeMode ? ['track-code', trackCode] : ['track', orgId, searchNo],
    enabled: codeMode ? !codeUnresolvable : !!orgId && !!searchNo.trim(),
    // Batas laju server dihitung per menit; mengulang otomatis cuma memperpanjangnya.
    retry: (count, err) => !(err instanceof TrackRateLimitedError) && count < 3,
    queryFn: async () => {
      if (codeMode) return fromCloud(await trackServiceByCode(trackCode ?? ''));
      // Cloud: public RPC bypasses RLS safely for anonymous visitors.
      if (isSupabaseConfigured) return fromCloud(await trackService(orgId, searchNo.trim()));
      // Local/dev: read the IndexedDB repository, scoped to the org param.
      repository.setScope(orgId, null);
      const [org, services] = await Promise.all([
        repository.getSingleton('organization'),
        repository.list('services'),
      ]);
      const svc =
        services.find((s) => s.serviceNo.toLowerCase() === searchNo.trim().toLowerCase()) ?? null;
      const orgRec = org as
        | {
            name?: string;
            phone?: string;
            address?: string;
            logoDataUrl?: string | null;
            settings?: { publicNote?: string };
          }
        | null;
      return {
        orgName: orgRec?.name ?? 'Nuara Service',
        orgPhone: orgRec?.phone ?? '',
        orgAddress: orgRec?.address ?? '',
        orgLogoUrl: orgRec?.logoDataUrl ?? null,
        orgNote: (orgRec?.settings?.publicNote ?? '').trim(),
        service: svc
          ? {
              serviceNo: svc.serviceNo,
              device: svc.device,
              category: svc.category,
              status: svc.status,
              warrantyServiceUntil: svc.warrantyServiceUntil,
              warrantyPartsUntil: svc.warrantyPartsUntil,
              partWarranties: partWarranties(svc.spareparts ?? []),
              pickedUp: svc.pickedUp,
            }
          : null,
        publicHistory: (svc?.history ?? []).filter((h) => !h.internal),
      };
    },
  });

  const orgName = data?.orgName ?? 'Nuara Service';
  const orgPhone = data?.orgPhone ?? '';
  const orgAddress = data?.orgAddress ?? '';
  const orgLogoUrl = data?.orgLogoUrl ?? null;
  const orgNote = data?.orgNote ?? '';
  const service = data?.service ?? null;
  // Setelah Selesai, garansi kosong berarti "tanpa garansi" yang disengaja.
  const warrantyDecided = service?.status === 'selesai' || service?.status === 'lunas';
  const publicHistory = data?.publicHistory ?? [];
  // S&K yang disetujui saat unit diterima, bukan S&K toko hari ini.
  const terms = termsOf(publicHistory);
  // Gagal memuat (sinyal putus, server sibuk) BUKAN berarti nomornya salah.
  // Dulu keduanya jatuh ke pesan "tidak ditemukan", sehingga pelanggan mengira
  // salah ketik lalu menelepon toko, padahal cukup mencoba lagi.
  const loadFailed = isError && !isFetching;
  // Server menolak karena terlalu banyak permintaan dari jaringan ini: bukan
  // sinyal lemah (mencoba lagi sekarang tak menolong) dan bukan kode salah.
  const rateLimited = loadFailed && error instanceof TrackRateLimitedError;
  const notFound = codeUnresolvable || (isFetched && !isFetching && !isError && !service);
  const searched = codeMode ? (trackCode ?? routeCode ?? '') : searchNo.trim();

  // History datang urut lama → baru, jadi entri terakhir adalah yang terbaru.
  const lastUpdate = publicHistory.length
    ? relativeSince(publicHistory[publicHistory.length - 1].at, t)
    : null;
  const nextStep = service ? nextStepFor(service.status, service.pickedUp) : null;
  // Status dari server bisa saja nilai yang belum dikenal klien; tampilkan apa adanya.
  const statusText = (s: string) =>
    s in STATUS_LABELS ? t(`statusLabel.${s as ServiceStatus}`) : s;
  const statusLabel = service?.pickedUp
    ? t('tracking.pickedUpStatus')
    : service
      ? statusText(service.status)
      : '';
  // Kalimat "tidak ditemukan" membungkus nomor yang dicari dalam <strong>.
  const [notFoundBefore, notFoundAfter = ''] = t(codeMode ? 'tracking.notFoundCode' : 'tracking.notFound').split('{no}');
  // Chat kosong memaksa pelanggan menjelaskan ulang siapa dia dan unit mana,
  // padahal halaman ini sudah tahu keduanya.
  const contactMessage = service
    ? 'Halo ' + orgName + ', saya ingin menanyakan servis ' + service.serviceNo + ' (' + service.device + ').'
    : 'Halo ' + orgName + ', saya ingin menanyakan servis saya.';
  const contactLink = orgPhone ? waLink(orgPhone, contactMessage) : '';

  // Tinta dan kertas: satu rumus bayangan untuk semua benda kertas di meja navy.
  const hasWarranty = !!service && (warrantyDecided || !!service.warrantyServiceUntil || !!service.warrantyPartsUntil);
  const loading = isFetching && !data && !loadFailed;

  return (
    <div
      data-nu
      data-nota-page
      className="@container/nota min-h-dvh overflow-x-clip bg-counter font-print text-on-counter selection:bg-amber selection:text-ink"
    >
      {/* Filter tinta kasar untuk cap, sama dengan landing page. */}
      <svg aria-hidden="true" focusable="false" className="absolute size-0">
        <filter id="nota-ink-rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="1.6" />
        </filter>
      </svg>

      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-4 pt-6 pb-10 @min-[420px]/nota:px-5 @min-[420px]/nota:pt-10">
        {service && !searchOpen ? (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="-mb-2 inline-flex min-h-11 items-center gap-2 self-start rounded-md px-1 text-sm font-semibold text-on-counter-soft underline underline-offset-4 outline-none hover:text-on-counter focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            <Search className="size-4" aria-hidden />
            {codeMode ? t('tracking.searchAnotherCode') : t('tracking.searchAnother')}
          </button>
        ) : loading && codeMode ? (
          <Notice icon={LoaderCircle} spin role="status">
            <p className="font-bold">{t('common.loading')}</p>
          </Notice>
        ) : (
          <section aria-label={codeMode ? t('tracking.codeLabel') : t('tracking.numberLabel')} className={KARTU}>
            <label className={LABEL} htmlFor="tracking-number">
              {codeMode ? t('tracking.codeLabel') : t('tracking.numberLabel')}
            </label>
            <div className="mt-1 flex items-end gap-3">
              <input
                id="tracking-number"
                className="h-11 min-w-0 flex-1 rounded-none border-0 border-b-2 border-ink bg-transparent px-0 text-lg font-bold text-carbon outline-none placeholder:font-normal placeholder:text-ink-soft focus-visible:border-carbon focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-carbon"
                placeholder={codeMode ? t('tracking.codePh') : t('tracking.numberPh')}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              />
              <button
                type="button"
                onClick={runSearch}
                disabled={isFetching}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-5 font-extrabold text-paper outline-none hover:bg-primary-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-carbon disabled:opacity-60"
              >
                {isFetching ? (
                  <LoaderCircle className="size-5 motion-safe:animate-spin" aria-hidden />
                ) : (
                  <Search className="size-5" aria-hidden />
                )}
                {t('tracking.track')}
              </button>
            </div>
            <p className="mt-3 text-sm leading-normal text-ink-soft">
              {codeMode ? t('tracking.codeHint') : t('tracking.searchHint')}
            </p>
          </section>
        )}

        {throttleMsg && (
          <Notice icon={TriangleAlert} role="alert">
            <p className="font-bold">{throttleMsg}</p>
          </Notice>
        )}

        {rateLimited && (
          <Notice icon={Clock} role="alert" action={<RetryButton onClick={() => refetch()} label={t('common.retry')} />}>
            <p className="font-bold">{t('tracking.rateLimited')}</p>
            <p className={HINT}>{t('tracking.rateLimitedHint')}</p>
          </Notice>
        )}

        {loadFailed && !rateLimited && (
          <Notice icon={TriangleAlert} role="alert" action={<RetryButton onClick={() => refetch()} label={t('common.retry')} />}>
            <p className="font-bold">{t('tracking.loadFailed')}</p>
            <p className={HINT}>{t('tracking.loadFailedHint')}</p>
          </Notice>
        )}

        {/* RPC mengembalikan nol baris baik untuk nomor salah ketik maupun kode
            toko yang keliru, jadi halaman ini tidak bisa menebak yang mana.
            Yang bisa dilakukan: mengulang nomor yang dicari (menangkap salah
            ketik) dan menyebut kedua kemungkinan itu apa adanya. Kode lacak
            sudah menunjuk tokonya sendiri, jadi yang tersisa hanya salah salin. */}
        {notFound && (
          <Notice icon={CircleQuestionMark}>
            <p className="font-bold">
              {notFoundBefore}
              <strong className="font-black text-stamp [overflow-wrap:anywhere]">{searched}</strong>
              {notFoundAfter}
            </p>
            <p className={HINT}>{codeMode ? t('tracking.notFoundHintCode') : t('tracking.notFoundHint')}</p>
          </Notice>
        )}

        {service && (
          <>
            {/* Nota: lembar atas putih, rangkap teal dan amber mengintip di
                bawahnya seperti buku nota konter. */}
            <div className="relative isolate">
              <span aria-hidden className="absolute inset-[10px_-4px_-10px_6px] -z-10 rotate-[2.2deg] rounded-[3px] bg-teal" />
              <span aria-hidden className="absolute inset-[4px_4px_-5px_-3px] -z-10 -rotate-[1.4deg] rounded-[3px] bg-amber" />
              <article
                aria-labelledby="nota-title"
                className={cn(
                  'relative -rotate-[0.5deg] rounded-[3px] bg-paper px-[18px] pt-[30px] text-ink shadow-[0_2px_3px_rgb(0_0_0/0.18),0_18px_40px_-12px_rgb(0_0_0/0.5)] @min-[420px]/nota:px-8',
                  hasWarranty ? 'pb-0' : 'pb-6',
                )}
              >
                <span aria-hidden className="nota-holes absolute inset-x-3.5 top-[7px] h-[7px] opacity-85" />

                <header className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 border-b-2 border-ink pb-3.5">
                  <span className="grid size-14 place-items-center overflow-hidden rounded-md bg-ink text-paper">
                    {orgLogoUrl ? (
                      <img src={orgLogoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <Wrench className="size-6" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h1 className="text-[1.2rem] leading-tight font-black tracking-[0.01em] [font-variation-settings:'wdth'_118] [overflow-wrap:anywhere]">
                      {orgName}
                    </h1>
                    {orgAddress && (
                      <p className="mt-0.5 text-[0.8rem] leading-snug text-ink-soft [overflow-wrap:anywhere]">{orgAddress}</p>
                    )}
                    <p className="mt-1 text-[0.95rem] leading-snug font-bold text-balance">{t('tracking.subtitle')}</p>
                  </div>
                </header>

                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-rule py-3.5">
                  <h2
                    id="nota-title"
                    className="text-[1.05rem] font-black tracking-[0.03em] uppercase [font-variation-settings:'wdth'_70]"
                  >
                    {t('tracking.notaTitle')}
                  </h2>
                  <p className="text-[1.6rem] leading-none font-extrabold text-numerator tabular-nums [font-variation-settings:'wdth'_62] [overflow-wrap:anywhere]">
                    {service.serviceNo}
                  </p>
                </div>

                <dl className="grid gap-x-6 @min-[420px]/nota:grid-cols-[1.4fr_1fr]">
                  <div className="border-b border-rule py-3">
                    <dt className={LABEL}>{t('tracking.deviceLabel')}</dt>
                    <dd className="mt-0.5 text-[1.15rem] leading-snug font-bold text-carbon [overflow-wrap:anywhere]">
                      {service.device}
                    </dd>
                  </div>
                  <div className="border-b border-rule py-3">
                    <dt className={LABEL}>{t('tracking.categoryLabel')}</dt>
                    <dd className="mt-0.5 text-[1.15rem] leading-snug font-bold text-carbon [overflow-wrap:anywhere]">
                      {service.category}
                    </dd>
                  </div>
                </dl>

                {/* Cap bulat: satu-satunya di halaman, isinya tahap sekarang dan
                    kapan diperbarui. Yang dibaca pelanggan sekilas memang ini. */}
                <div className="flex flex-col items-start gap-4 py-5 @min-[420px]/nota:flex-row @min-[420px]/nota:items-center @min-[420px]/nota:gap-6">
                  <p className="nota-stamp inline-flex min-h-[5.75rem] w-[10.5rem] shrink-0 -rotate-8 flex-col items-center justify-center gap-0.5 rounded-full border-[3px] border-current px-5 py-3 text-center text-[1.15rem] leading-[1.05] font-black tracking-[0.05em] text-stamp uppercase [filter:url(#nota-ink-rough)] [font-variation-settings:'wdth'_62] motion-safe:animate-nota-stamp @min-[420px]/nota:min-h-[6.6rem] @min-[420px]/nota:w-49 @min-[420px]/nota:text-[1.3rem]">
                    <span className="sr-only">{t('tracking.statusLabel')}: </span>
                    <span>{statusLabel}</span>
                    {lastUpdate && (
                      <span className="block text-[0.72em] tracking-[0.07em] text-balance">
                        {interpolate(t('tracking.updated'), { when: lastUpdate })}
                      </span>
                    )}
                  </p>
                  {nextStep && (
                    <p className="flex min-w-0 gap-2.5 text-[0.95rem] leading-snug">
                      {nextStep.tone === 'wait' ? (
                        <Clock className="mt-0.5 size-5 shrink-0 text-carbon" aria-hidden />
                      ) : nextStep.tone === 'done' ? (
                        <CircleCheck className="mt-0.5 size-5 shrink-0 text-carbon" aria-hidden />
                      ) : (
                        <Info className="mt-0.5 size-5 shrink-0 text-carbon" aria-hidden />
                      )}
                      <span>{t(nextStep.textKey)}</span>
                    </p>
                  )}
                </div>

                {/* Ditulis pemilik toko sendiri: jam buka, syarat garansi, aturan
                    pengambilan. Inilah yang membuat halaman ini terbaca sebagai
                    dokumen toko itu, bukan cetakan seragam. */}
                {orgNote && (
                  <section className="border-t border-rule py-4">
                    <h2 className={LABEL}>{t('tracking.shopNote')}</h2>
                    <p className="mt-1 text-[0.95rem] leading-normal whitespace-pre-line [overflow-wrap:anywhere]">{orgNote}</p>
                  </section>
                )}

                {hasWarranty && (
                  <section
                    aria-labelledby="stub-title"
                    className="relative mt-2 -mx-[18px] rounded-b-[3px] bg-amber px-[18px] pt-[26px] pb-[22px] text-ink @min-[420px]/nota:-mx-8 @min-[420px]/nota:px-8"
                  >
                    {/* Garis sobek di tepi atas lembar pelanggan. */}
                    <span aria-hidden className="absolute inset-x-0 top-0 h-0 border-t-2 border-dashed border-ink" />
                    <span aria-hidden className="absolute -top-[13px] left-3.5 grid place-items-center bg-paper px-2">
                      <Scissors className="size-[18px]" />
                    </span>
                    <h2
                      id="stub-title"
                      className="mb-2 inline-flex items-center gap-2 text-[1.15rem] font-black tracking-[0.03em] uppercase [font-variation-settings:'wdth'_75]"
                    >
                      <ShieldCheck className="size-5" aria-hidden />
                      {t('tracking.warranty')}
                    </h2>
                    <dl>
                      {(service.warrantyServiceUntil || warrantyDecided) && (
                        <WarrantyRow
                          label={t('tracking.labor')}
                          value={
                            service.warrantyServiceUntil
                              ? interpolate(t('tracking.until'), { date: fmtDate(service.warrantyServiceUntil.slice(0, 10)) })
                              : t('serviceDetail.noWarranty')
                          }
                        />
                      )}
                      {service.partWarranties.length > 0
                        ? service.partWarranties.map((p, i) => (
                            <WarrantyRow
                              key={`${p.name}-${i}`}
                              label={p.name}
                              value={
                                p.until
                                  ? interpolate(t('tracking.until'), { date: fmtDate(p.until.slice(0, 10)) })
                                  : t('serviceDetail.noWarranty')
                              }
                            />
                          ))
                        : service.warrantyPartsUntil && (
                            <WarrantyRow
                              label={t('tracking.parts')}
                              value={interpolate(t('tracking.until'), { date: fmtDate(service.warrantyPartsUntil.slice(0, 10)) })}
                            />
                          )}
                    </dl>
                  </section>
                )}
              </article>
            </div>

            {/* Rangkap teal: alur servis. Kotak centang cetak, terbaru di atas. */}
            <section
              aria-labelledby="flow-title"
              className="-rotate-[0.4deg] rounded-[3px] bg-teal px-[18px] pt-[26px] pb-7 text-ink shadow-[0_2px_3px_rgb(0_0_0/0.18),0_18px_40px_-16px_rgb(0_0_0/0.45)] @min-[420px]/nota:px-8"
            >
              <h2
                id="flow-title"
                className="text-[clamp(1.5rem,1.1rem+2vw,2rem)] leading-none font-black [font-variation-settings:'wdth'_80]"
              >
                {t('tracking.flowTitle')}
              </h2>
              <ol className="mt-5">
                {[...publicHistory].reverse().map((h, i) => (
                  <li
                    key={i}
                    aria-current={i === 0 ? 'step' : undefined}
                    className="relative grid grid-cols-[1.375rem_1fr] gap-x-3 pb-5 before:absolute before:top-7 before:bottom-1 before:left-[0.625rem] before:w-0.5 before:bg-ink/30 last:pb-0 last:before:hidden"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 grid size-[22px] place-items-center rounded-[2px] border-2 border-carbon',
                        i === 0 ? 'bg-carbon text-paper' : 'text-carbon',
                      )}
                    >
                      <Check className="size-4" strokeWidth={3} />
                    </span>
                    <div className="min-w-0">
                      <strong className={cn('block text-[1.05rem] leading-tight', i === 0 ? 'font-black' : 'font-bold')}>
                        {(() => {
                          const k = historyKind(h as { status: ServiceStatus | 'edit'; note: string });
                          return k === 'pickup'
                            ? t('services.pickedUp')
                            : k === 'unpickup'
                              ? t('tracking.unpickup')
                              : k === 'edit'
                                ? t('tracking.edited')
                                : statusText(k);
                        })()}
                      </strong>
                      <small className="mt-0.5 block text-sm leading-snug text-ink/80 [overflow-wrap:anywhere]">
                        <span className="tabular-nums">{stepStamp(h.at)}</span>
                        {h.note ? ' · ' + h.note : ''}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {(orgPhone || orgAddress || terms) && (
              <section aria-labelledby="contact-title" className={KARTU}>
                {(orgPhone || orgAddress) && (
                  <>
                    <h2
                      id="contact-title"
                      className="text-[1.1rem] font-black tracking-[0.04em] uppercase [font-variation-settings:'wdth'_70]"
                    >
                      {t('tracking.contact')}
                    </h2>
                    {orgPhone && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <a
                          href={contactLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-amber px-4 font-extrabold text-ink outline-none hover:bg-amber-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-carbon"
                        >
                          <WhatsAppIcon className="size-5" />
                          {t('tracking.chatWa')}
                        </a>
                        <span className="font-bold tabular-nums select-all">{orgPhone}</span>
                      </div>
                    )}
                    {orgAddress && (
                      <p className="mt-3 flex gap-2 text-[0.95rem] leading-snug">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
                        <span className="[overflow-wrap:anywhere]">{orgAddress}</span>
                      </p>
                    )}
                  </>
                )}

                {/* Tertutup bawaan: yang dicari pelanggan di halaman ini adalah status.
                    Kalimat persetujuan di nota menunjuk ke sini lewat QR. */}
                {terms && (
                  <details className={cn('group', (orgPhone || orgAddress) && 'mt-4 border-t border-dashed border-ink-soft/50 pt-1')}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm font-bold outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-carbon [&::-webkit-details-marker]:hidden">
                      <span>{t('terms.title')}</span>
                      <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <p className="mt-1 text-sm leading-normal text-ink-soft">
                      {interpolate(t('terms.version'), { date: fmtDate(terms.version) })}
                    </p>
                    <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm leading-normal marker:font-bold">
                      {termsClauses(terms).map((c) => (
                        <li key={c.title}>
                          <strong>{t(c.title)}.</strong> {c.body.map((b) => termsSentenceText(b, t)).join(' ')}
                        </li>
                      ))}
                      {terms.extra && (
                        <li>
                          <span className="[overflow-wrap:anywhere]">
                            <strong>{t('terms.extra.title')}.</strong> {terms.extra}
                          </span>
                        </li>
                      )}
                    </ol>
                  </details>
                )}
              </section>
            )}
          </>
        )}

        <footer className="pt-2 text-center text-sm font-black tracking-[0.18em] text-on-counter-soft uppercase [font-variation-settings:'wdth'_118]">
          {t('tracking.poweredBy')}
        </footer>
      </main>
    </div>
  );
}
