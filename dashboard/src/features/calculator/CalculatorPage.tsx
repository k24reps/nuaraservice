import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, Calculator as CalculatorIcon, Eye, RotateCcw } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Field } from '@/components/dens/field';
import { Input } from '@/components/dens/input';
import { cn } from '@/lib/utils';
import { EmptyValue } from '@/components/ui/EmptyValue';
import { isManager, roleAllows } from '@/config/plans';
import type { QuoteChip, QuoteField, QuoteRates } from '@/data/types';
import { useT, type TranslationKey } from '@/i18n';
import { fmtPctInput, fmtPercent, fmtRp, fmtRpInput, parsePctInput, parseRpInput } from '@/lib/format';
import { interpolate } from '@/lib/business/notify';
import { QUOTE_FIELDS, computeQuote, quoteDefaults, sanitizeQuoteRates } from '@/lib/business/quote';
import { useSessionStore } from '@/stores/session';

/*
 * Kalkulator Biaya: lima kolom sheet price list (modal, ongkir/waste, jasa
 * pasang, cover garansi, target profit) → harga rekomendasi. Empat kolom
 * terakhir punya template chip dari Pengaturan → Tarif; modal selalu diketik.
 */

interface Entry {
  text: string;
  /** Chip yang terakhir diketuk. Menyala hanya selama nilainya belum diubah. */
  chipId: string | null;
}
type Entries = Record<QuoteField, Entry>;

const LABEL: Record<QuoteField, TranslationKey> = {
  ongkir: 'quote.ongkir',
  jasa: 'quote.jasa',
  coverPct: 'quote.coverPct',
  targetProfit: 'quote.targetProfit',
};
const SAMPLE: Record<QuoteField, string> = {
  ongkir: '30.000',
  jasa: '150.000',
  coverPct: '10',
  targetProfit: '150.000',
};

const isPct = (field: QuoteField) => field === 'coverPct';
const pctText = (n: number) => String(n).replace('.', ',');
const valueText = (field: QuoteField, n: number) => (isPct(field) ? pctText(n) : fmtRpInput(String(n)));
const parseValue = (field: QuoteField, text: string) =>
  isPct(field) ? parsePctInput(text) : parseRpInput(text);

function initialEntries(rates: QuoteRates): Entries {
  const defaults = quoteDefaults(rates);
  return Object.fromEntries(
    QUOTE_FIELDS.map((field) => {
      const { chipId, value } = defaults[field];
      return [field, { text: chipId ? valueText(field, value) : '', chipId }];
    }),
  ) as Entries;
}

export function CalculatorPage() {
  const me = useSessionStore((s) => s.currentEmployee);
  const stored = useSessionStore((s) => s.org?.settings?.quoteRates);
  const rates = useMemo(() => sanitizeQuoteRates(stored), [stored]);
  const owner = me ? roleAllows(me.role, '*') : false;
  const manager = me ? isManager(me.role) : false;
  // Template yang berubah saat halaman terbuka tidak menghapus hitungan yang
  // sedang diketik: chip yang hilang cukup padam, default baru dipakai saat
  // "Mulai ulang".
  return <Calculator rates={rates} owner={owner} manager={manager} />;
}

function Calculator({ rates, owner, manager }: { rates: QuoteRates; owner: boolean; manager: boolean }) {
  const t = useT();
  const [modal, setModal] = useState('');
  const [entries, setEntries] = useState<Entries>(() => initialEntries(rates));
  const tapeRef = useRef<HTMLDivElement>(null);

  const value = (field: QuoteField) => parseValue(field, entries[field].text);
  const result = computeQuote({
    modal: parseRpInput(modal),
    ongkir: value('ongkir'),
    jasa: value('jasa'),
    coverPct: value('coverPct'),
    targetProfit: value('targetProfit'),
  });

  const setEntry = (field: QuoteField, entry: Entry) => setEntries((e) => ({ ...e, [field]: entry }));
  const activeChip = (field: QuoteField): QuoteChip | undefined => {
    const chip = rates[field].chips.find((c) => c.id === entries[field].chipId);
    return chip && chip.value === value(field) ? chip : undefined;
  };

  const reset = () => {
    setModal('');
    setEntries(initialEntries(rates));
  };

  const noChips = QUOTE_FIELDS.every((field) => rates[field].chips.length === 0);
  const priceText = fmtRp(result.price);

  return (
    // data-calc-page: kait aturan scroll-padding <html> di app.css (fokus Tab tak
    // boleh mendarat di balik register yang menempel, WCAG 2.4.11).
    <div data-nu data-calc-page className="@container/calc bg-transparent">
      {/* Sempit dulu: satu kolom flex (bukan grid) supaya register yang menempel
          bisa melintasi seluruh kartu isian. Panel 20–24rem + kartu isian minimal
          ±24rem (chip tidak patah satu per baris) + satu celah: dua kolom mulai
          ±49rem. */}
      <div className="flex flex-col gap-4 @min-[49rem]/calc:grid @min-[49rem]/calc:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] @min-[49rem]/calc:items-start">
        <div className="overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60">
          <div className="flex items-center gap-3 px-5 pt-4 pb-3">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold [&>svg]:size-4 [&>svg]:text-muted-foreground">
              <CalculatorIcon aria-hidden />
              {t('quote.title')}
            </h2>
          </div>
          <div className="px-5 pb-5">
            {noChips && owner && (
              <p className="mb-5 rounded-xl border border-dashed border-border px-4 py-3 text-sm leading-normal text-muted-foreground">
                {t('quote.noChips')}{' '}
                <Link
                  to="/settings?tab=tarif"
                  className="rounded-sm font-semibold text-foreground underline underline-offset-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t('quote.noChipsAction')}
                </Link>
              </p>
            )}
            {/* Wadah sendiri: lebar kartu berbeda jauh antara satu dan dua kolom
                halaman, jadi baris kolom menakar ruangnya dari daftar. */}
            <ol className="@container/fields">
              <li className={FIELD_ROW}>
                <Field label={t('quote.modal')}>
                  <Input
                    inputMode="numeric"
                    className={NUM_INPUT}
                    value={modal}
                    placeholder="680.000"
                    onChange={(e) => setModal(fmtRpInput(e.target.value))}
                  />
                </Field>
                <div className={SIDE}>
                  <p className="text-sm leading-normal text-muted-foreground @min-[34rem]/fields:flex @min-[34rem]/fields:min-h-10 @min-[34rem]/fields:items-center pointer-coarse:@min-[34rem]/fields:min-h-11">
                    {t('quote.modalHint')}
                  </p>
                </div>
              </li>
              {QUOTE_FIELDS.map((field) => {
                const chips = rates[field].chips;
                const label = t(LABEL[field]);
                const active = activeChip(field);
                return (
                  <li key={field} className={FIELD_ROW}>
                    <Field label={label}>
                      <Input
                        inputMode={isPct(field) ? 'decimal' : 'numeric'}
                        className={NUM_INPUT}
                        value={entries[field].text}
                        placeholder={chips.length > 0 ? '0' : SAMPLE[field]}
                        onChange={(e) =>
                          setEntry(field, {
                            text: isPct(field) ? fmtPctInput(e.target.value) : fmtRpInput(e.target.value),
                            chipId: entries[field].chipId,
                          })
                        }
                        onBlur={(e) =>
                          isPct(field) &&
                          parsePctInput(e.target.value) > 100 &&
                          setEntry(field, { text: '100', chipId: entries[field].chipId })
                        }
                      />
                    </Field>
                    {chips.length > 0 && (
                      <div className={SIDE}>
                        <div
                          className="flex flex-wrap gap-2"
                          role="group"
                          aria-label={interpolate(t('quote.chipsAria'), { field: label })}
                        >
                          {chips.map((chip) => {
                            const on = active?.id === chip.id;
                            const amount = isPct(field) ? `${pctText(chip.value)}%` : fmtRp(chip.value);
                            return (
                              <button
                                key={chip.id}
                                type="button"
                                className={CHIP}
                                aria-pressed={on}
                                onClick={() =>
                                  setEntry(
                                    field,
                                    on ? { text: '', chipId: null } : { text: valueText(field, chip.value), chipId: chip.id },
                                  )
                                }
                              >
                                {chip.label && <span>{chip.label}</span>}
                                <span
                                  className={cn(
                                    'font-mono text-xs font-semibold tabular-nums text-muted-foreground group-aria-pressed/chip:text-primary-foreground/80',
                                    // Nama dan nilai dipisah sambungan putus, seperti saklar satuan.
                                    chip.label && 'border-l border-dashed border-border pl-2 group-aria-pressed/chip:border-primary-foreground/30',
                                  )}
                                >
                                  {amount}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* Bukan <section>: di layar sempit wadah ini display:contents supaya
            register bisa menempel di bawah layar sepanjang kolom isian. */}
        <div className={QUOTE}>
          <div className={REGISTER}>
            {/* Sempit: register yang menempel jadi tombol ke struk, seperti dok
                keranjang Kasir. Di dua kolom ia disembunyikan. */}
            <button
              type="button"
              className="absolute inset-0 z-[1] w-full rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-highlight focus-visible:ring-inset @min-[49rem]/calc:hidden"
              aria-label={t('quote.jumpToTape')}
              onClick={() => {
                // CSS reduced-motion global tidak menjangkau gulir dari JS.
                const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                tapeRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
              }}
            />
            <div className="relative mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-primary-foreground/80">
              <span className="inline-flex items-center gap-1.5">
                {t('quote.priceLabel')}
                <ArrowDown aria-hidden className="size-3.5 text-primary-foreground/70 @min-[49rem]/calc:hidden" />
              </span>
            </div>
            {/* Angka selalu sebaris: satu karakter mono ≈ 0.62em, jadi ukuran = lebar
                register / jumlah karakter, dibatasi 2.35rem. */}
            <div className={PRICE} style={{ '--lcd-chars': priceText.length } as CSSProperties}>
              {priceText}
            </div>
          </div>

          <div className={TAPE} ref={tapeRef}>
            <ul>
              <TapeLine name={t('quote.lineSubtotal')} amount={fmtRp(result.subtotal)} />
              <TapeLine name={interpolate(t('quote.lineCover'), { pct: pctText(result.coverPct) })} amount={fmtRp(result.cover)} />
              <TapeLine name={t('quote.lineJasa')} amount={fmtRp(result.jasa)} />
              <TapeLine name={t('quote.lineTarget')} amount={fmtRp(result.targetProfit)} />
              <TapeLine name={t('quote.linePrice')} amount={priceText} total />
            </ul>

            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden />
                {t('quote.reset')}
              </Button>
            </div>

            {manager && (
              // Angka dapur: hanya pemilik/admin. Diredam di bawah struk agar tak
              // terbaca sebagai bagian dari harga ke pelanggan.
              <div className="border-t border-dashed border-border pt-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground [&>svg]:size-4">
                  <Eye aria-hidden />
                  {t('quote.ownerTitle')}
                </p>
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">{t('quote.ownerProfit')}</dt>
                  <dd className={cn(OWNER_DD, result.profit > 0 && 'text-success-foreground')}>{fmtRp(result.profit)}</dd>
                  <dt className="text-muted-foreground">{t('quote.ownerMarkup')}</dt>
                  <dd className={cn(OWNER_DD, result.profit > 0 && 'text-success-foreground')}>
                    {result.markup === null ? <EmptyValue /> : fmtPercent(result.markup, 1)}
                  </dd>
                </dl>
                <p className="mt-3 text-xs leading-normal text-muted-foreground">{t('quote.ownerNote')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Kotak isian butuh ±11rem (angka jutaan + padding), chip tiga sebaris ±21rem,
   satu celah: di atas ±34rem wadah chip pindah ke samping kotak. */
const FIELD_ROW =
  'grid grid-cols-[minmax(0,1fr)] gap-3 border-t border-dashed border-border py-4 first:border-t-0 first:pt-0 last:pb-0 @min-[34rem]/fields:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)] @min-[34rem]/fields:items-start @min-[34rem]/fields:gap-4';
/* Sisi kanan duduk sejajar kotak isian, bukan label: label dens 14px + jarak 6px. */
const SIDE = 'min-w-0 @min-[34rem]/fields:pt-5';
// Angka uang di kotak isian juga mono.
const NUM_INPUT = 'font-mono tabular-nums placeholder:font-sans';
const CHIP =
  'group/chip inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full bg-card px-3 text-sm font-semibold text-foreground ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:ring-primary pointer-coarse:h-11';
/* Sempit: wadah lenyap dari tata letak, register jadi anak flex yang menempel di
   bawah layar sepanjang isian; struk mengikuti sebagai kartu. Dua kolom: satu
   kartu menempel di bawah topbar, register di atas struk. */
const QUOTE = [
  'contents',
  '@min-[49rem]/calc:sticky @min-[49rem]/calc:top-[calc(var(--topbar-height)+var(--space-4))] @min-[49rem]/calc:flex @min-[49rem]/calc:flex-col',
  '@min-[49rem]/calc:max-h-[calc(var(--app-vh,100dvh)-var(--topbar-height)-var(--space-8))] @min-[49rem]/calc:overflow-y-auto @min-[49rem]/calc:overscroll-contain',
  '@min-[49rem]/calc:rounded-2xl @min-[49rem]/calc:bg-card @min-[49rem]/calc:shadow-panel @min-[49rem]/calc:ring-1 @min-[49rem]/calc:ring-border/60',
].join(' ');
const REGISTER = [
  // Satu di bawah topbar: register yang tergulir ke atas lewat di BAWAH topbar.
  '@container/register sticky bottom-3 z-[calc(var(--z-sticky)-1)] overflow-hidden rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-lg',
  // Terikat kehadiran menu bawah (<=720px), bukan lebar wadah: media query.
  'phone:bottom-[calc(var(--mobile-nav-height)+var(--space-2)+env(safe-area-inset-bottom))]',
  '@min-[49rem]/calc:relative @min-[49rem]/calc:bottom-auto @min-[49rem]/calc:flex-none @min-[49rem]/calc:rounded-none @min-[49rem]/calc:px-5 @min-[49rem]/calc:pt-4 @min-[49rem]/calc:pb-3 @min-[49rem]/calc:shadow-none',
].join(' ');
const PRICE =
  'relative text-right font-mono text-[length:min(2.35rem,100cqi_/_(var(--lcd-chars,12)_*_0.62))] leading-[1.05] font-semibold whitespace-nowrap tabular-nums';
const TAPE =
  'flex flex-col gap-4 rounded-2xl bg-card p-4 text-card-foreground shadow-panel ring-1 ring-border/60 @min-[49rem]/calc:rounded-none @min-[49rem]/calc:bg-transparent @min-[49rem]/calc:shadow-none @min-[49rem]/calc:ring-0';
const OWNER_DD = 'text-right font-mono whitespace-nowrap tabular-nums text-foreground';

/** Satu baris struk; total memakai garis rangkap seperti potongan struk. */
function TapeLine({ name, amount, total }: { name: string; amount: string; total?: boolean }) {
  return (
    <li
      className={cn(
        'flex items-baseline justify-between gap-3 py-2 text-sm',
        total ? 'mt-1 border-t-[3px] border-double border-border pt-3 font-semibold' : 'border-t border-dashed border-border first:border-t-0 first:pt-0',
      )}
    >
      <span className={cn('min-w-0 [overflow-wrap:anywhere]', total ? 'text-foreground' : 'text-muted-foreground')}>{name}</span>
      <span className={cn('font-mono whitespace-nowrap tabular-nums text-foreground', total && 'text-base')}>{amount}</span>
    </li>
  );
}
