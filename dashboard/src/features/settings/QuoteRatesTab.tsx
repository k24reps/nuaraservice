import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageOpen, Plus, ShieldCheck, Target, Trash2, Wrench, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Field } from '@/components/dens/field';
import { Switch } from '@/components/dens/switch';
import { TextInput } from '@/components/dens/text-input';
import { setQuoteRates } from '@/config/orgConfig';
import type { QuoteField, QuoteRates } from '@/data/types';
import { fmtPctInput, fmtRp, fmtRpInput, parsePctInput, parseRpInput } from '@/lib/format';
import { newId } from '@/lib/id';
import { interpolate } from '@/lib/business/notify';
import {
  QUOTE_FIELDS,
  QUOTE_LIMITS,
  quoteRatesIssues,
  quoteValue,
  sanitizeQuoteRates,
} from '@/lib/business/quote';
import { useT, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';
import { demoGuard } from '@/stores/demo';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import { SettingsCard, SettingsHint, SettingsSection } from './settingsUi';

/*
 * Pengaturan → Tarif: template chip untuk empat kolom Kalkulator Biaya. Satu
 * draf untuk seluruh tab karena keempat kartu adalah satu objek `quoteRates`:
 * menyimpan per kartu akan menimpa kartu lain dengan nilai lama. Angka
 * disimpan sebagai teks selama diedit supaya "12,5" dan "150.000" tidak
 * melompat saat diketik.
 *
 * Ambang baris membaca wadah `settings` (SettingsSection) dan diturunkan dari
 * isi terlebar yang harus muat sebaris: empat kolom butuh ±36rem isi kartu
 * (nama 11rem, nilai 8rem, saklar ±5rem, hapus 44px, tiga celah).
 */

interface ChipDraft {
  id: string;
  label: string;
  value: string;
}
interface PresetDraft {
  chips: ChipDraft[];
  defaultId: string | null;
}
type Draft = Record<QuoteField, PresetDraft>;

const FIELD_COPY: Record<
  QuoteField,
  { icon: LucideIcon; title: TranslationKey; hint: TranslationKey; placeholder: TranslationKey; sample: string }
> = {
  ongkir: {
    icon: PackageOpen,
    title: 'quoteRates.ongkirTitle',
    hint: 'quoteRates.ongkirHint',
    placeholder: 'quoteRates.ongkirPlaceholder',
    sample: '15.000',
  },
  jasa: {
    icon: Wrench,
    title: 'quoteRates.jasaTitle',
    hint: 'quoteRates.jasaHint',
    placeholder: 'quoteRates.jasaPlaceholder',
    sample: '150.000',
  },
  coverPct: {
    icon: ShieldCheck,
    title: 'quoteRates.coverTitle',
    hint: 'quoteRates.coverHint',
    placeholder: 'quoteRates.coverPlaceholder',
    sample: '10',
  },
  targetProfit: {
    icon: Target,
    title: 'quoteRates.profitTitle',
    hint: 'quoteRates.profitHint',
    placeholder: 'quoteRates.profitPlaceholder',
    sample: '100.000',
  },
};

const isPct = (field: QuoteField) => field === 'coverPct';
const valueText = (field: QuoteField, n: number) =>
  isPct(field) ? String(n).replace('.', ',') : fmtRpInput(String(n));
const parseValue = (field: QuoteField, s: string) =>
  quoteValue(field, isPct(field) ? parsePctInput(s) : parseRpInput(s));

/** Mengikuti urutan QUOTE_FIELDS = urutan kunci sanitizeQuoteRates. */
function byField<T>(make: (field: QuoteField) => T): Record<QuoteField, T> {
  return Object.fromEntries(QUOTE_FIELDS.map((f) => [f, make(f)])) as Record<QuoteField, T>;
}

function toDraft(r: QuoteRates): Draft {
  return byField((field) => ({
    chips: r[field].chips.map((c) => ({ id: c.id, label: c.label, value: valueText(field, c.value) })),
    defaultId: r[field].defaultId,
  }));
}

// Urutan kunci sengaja sama dengan sanitizeQuoteRates: draf dibandingkan
// dengan nilai tersimpan lewat JSON.stringify untuk tahu ada perubahan.
function fromDraft(d: Draft): QuoteRates {
  return byField((field) => ({
    chips: d[field].chips.map((c) => ({
      id: c.id,
      label: c.label.trim(),
      value: parseValue(field, c.value),
    })),
    defaultId: d[field].defaultId,
  }));
}

/**
 * Kolom tanpa kotak isian (saklar, tombol hapus) duduk sejajar dengan kotak
 * isian di sebelahnya: judul kolom setinggi label Field (`leading-none` 14px +
 * celah 6px), kontrolnya setinggi kotak isian (40px, 44px di layar sentuh).
 */
const COLUMN = 'grid content-start gap-1.5';
const COLUMN_HEAD = 'text-sm leading-none font-semibold select-none';
const CONTROL_ROW = 'flex h-10 items-center pointer-coarse:h-11';

export function QuoteRatesTab() {
  const stored = useSessionStore((s) => s.org?.settings?.quoteRates);
  const current = useMemo(() => sanitizeQuoteRates(stored), [stored]);
  // Draf dibuat ulang hanya bila nilai tersimpan berubah dari luar (simpan,
  // perangkat lain), bukan setiap render.
  return (
    <SettingsSection>
      <QuoteRatesEditor key={JSON.stringify(current)} current={current} />
    </SettingsSection>
  );
}

function QuoteRatesEditor({ current }: { current: QuoteRates }) {
  const t = useT();
  const [draft, setDraft] = useState<Draft>(() => toDraft(current));
  const [showIssues, setShowIssues] = useState(false);
  const [busy, setBusy] = useState(false);

  const next = useMemo(() => fromDraft(draft), [draft]);
  const duplicates = useMemo(() => quoteRatesIssues(next), [next]);
  // Kolom nilai kosong tersimpan sebagai 0 tanpa disadari; "0" yang diketik boleh.
  const blanks = QUOTE_FIELDS.flatMap((field) =>
    draft[field].chips.flatMap((c, index) => (c.value.trim() === '' ? [{ field, index }] : [])),
  );
  const issueCount = duplicates.length + blanks.length;
  const dirty = JSON.stringify(next) !== JSON.stringify(current);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const patchPreset = (field: QuoteField, change: (p: PresetDraft) => PresetDraft) =>
    setDraft((d) => ({ ...d, [field]: change(d[field]) }));
  const patchChip = (field: QuoteField, index: number, change: Partial<ChipDraft>) =>
    patchPreset(field, (p) => ({
      ...p,
      chips: p.chips.map((c, i) => (i === index ? { ...c, ...change } : c)),
    }));

  const save = async () => {
    if (demoGuard()) return;
    if (issueCount > 0) {
      setShowIssues(true);
      toast.warning(t('quoteRates.fixIssues'));
      return;
    }
    setBusy(true);
    try {
      await setQuoteRates(next);
      toast.success(t('quoteRates.saved'));
    } catch {
      toast.error(t('quoteRates.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const chipName = (field: QuoteField, chip: ChipDraft) =>
    chip.label.trim() ||
    (isPct(field) ? `${chip.value || '0'}%` : fmtRp(parseRpInput(chip.value)));

  return (
    <>
      <p className="max-w-[70ch] text-sm leading-normal text-muted-foreground">{t('quoteRates.intro')}</p>

      {QUOTE_FIELDS.map((field) => {
        const copy = FIELD_COPY[field];
        const preset = draft[field];
        const title = t(copy.title);
        const Icon = copy.icon;
        return (
          <SettingsCard key={field} icon={<Icon aria-hidden />} title={title}>
            <SettingsHint className="max-w-[70ch]">{t(copy.hint)}</SettingsHint>
            {preset.chips.length === 0 ? (
              <p className="mb-4 rounded-xl border border-dashed border-border p-4 text-center text-sm leading-normal text-muted-foreground">
                {t('quoteRates.empty')}
              </p>
            ) : (
              <ul className="mb-4">
                {preset.chips.map((chip, index) => {
                  const duplicate =
                    showIssues && duplicates.some((i) => i.field === field && i.index === index);
                  const blank = showIssues && blanks.some((i) => i.field === field && i.index === index);
                  const on = preset.defaultId === chip.id;
                  const name = chipName(field, chip);
                  return (
                    // Empat kolom; di bawah 640px nama + hapus sebaris lalu nilai + saklar;
                    // di bawah 420px nilai dan saklar masing-masing satu baris penuh
                    // (kotak nilai di samping saklar tinggal ±5rem, "150.000" terpotong).
                    <li
                      key={chip.id}
                      className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] items-start gap-3 border-t border-dashed border-border py-4 first:border-t-0 first:pt-0 @max-[641px]/settings:grid-cols-[minmax(0,1fr)_auto_auto]"
                    >
                      <div className="@max-[641px]/settings:col-span-2 @max-[641px]/settings:row-start-1">
                        <Field
                          label={t('quoteRates.chipLabel')}
                          error={duplicate ? t('quoteRates.duplicate') : undefined}
                        >
                          <TextInput
                            value={chip.label}
                            maxLength={QUOTE_LIMITS.label}
                            placeholder={t(copy.placeholder)}
                            onChange={(e) => patchChip(field, index, { label: e.target.value })}
                          />
                        </Field>
                      </div>
                      <div className="@max-[641px]/settings:col-start-1 @max-[641px]/settings:row-start-2 @max-[421px]/settings:col-span-full">
                        <Field
                          label={isPct(field) ? t('quoteRates.valuePct') : t('quoteRates.valueRp')}
                          error={blank ? t('quoteRates.valueMissing') : undefined}
                        >
                          <TextInput
                            capitalize="none"
                            inputMode={isPct(field) ? 'decimal' : 'numeric'}
                            className="font-mono tabular-nums placeholder:font-sans"
                            value={chip.value}
                            placeholder={copy.sample}
                            onChange={(e) =>
                              patchChip(field, index, {
                                value: isPct(field) ? fmtPctInput(e.target.value) : fmtRpInput(e.target.value),
                              })
                            }
                            // Di atas 100% dipotong saat kolom ditinggalkan, bukan diam-diam saat disimpan.
                            onBlur={(e) =>
                              isPct(field) &&
                              parsePctInput(e.target.value) > 100 &&
                              patchChip(field, index, { value: '100' })
                            }
                          />
                        </Field>
                      </div>
                      <div
                        className={cn(
                          COLUMN,
                          '@max-[641px]/settings:col-[2/-1] @max-[641px]/settings:row-start-2',
                          '@max-[421px]/settings:col-span-full @max-[421px]/settings:row-start-3 @max-[421px]/settings:flex @max-[421px]/settings:items-center @max-[421px]/settings:justify-between @max-[421px]/settings:gap-3',
                        )}
                      >
                        <span className={COLUMN_HEAD}>{t('quoteRates.auto')}</span>
                        <span className={CONTROL_ROW}>
                          <Switch
                            checked={on}
                            aria-label={interpolate(t('quoteRates.autoAria'), { name })}
                            onCheckedChange={() =>
                              patchPreset(field, (p) => ({ ...p, defaultId: on ? null : chip.id }))
                            }
                          />
                        </span>
                      </div>
                      <div
                        className={cn(
                          COLUMN,
                          '@max-[641px]/settings:col-start-3 @max-[641px]/settings:row-start-1',
                        )}
                      >
                        <span aria-hidden className={COLUMN_HEAD}>
                          &nbsp;
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="hover:border-destructive/45 hover:bg-destructive-soft hover:text-destructive"
                          aria-label={interpolate(t('quoteRates.removeChip'), { name })}
                          title={t('common.delete')}
                          onClick={() =>
                            patchPreset(field, (p) => ({
                              chips: p.chips.filter((_, i) => i !== index),
                              defaultId: on ? null : p.defaultId,
                            }))
                          }
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={preset.chips.length >= QUOTE_LIMITS.chips}
              onClick={() =>
                patchPreset(field, (p) => ({
                  ...p,
                  chips: [...p.chips, { id: newId(), label: '', value: '' }],
                }))
              }
            >
              <Plus aria-hidden />
              {interpolate(t('quoteRates.addChip'), { field: title })}
            </Button>
          </SettingsCard>
        );
      })}

      {/* Diam di akhir tab saat tak ada perubahan; begitu draf berubah ia menempel
          di bawah layar sebagai bar aksi. `data-save-bar` adalah kait aturan
          scroll-padding <html> di app.css: fokus dari Tab tak boleh mendarat di
          baliknya (WCAG 2.4.11). Di ponsel ia duduk di atas menu bawah, terikat
          kehadiran menu (<=720px), bukan lebar wadah: media query yang sah. */}
      <div
        data-save-bar={dirty ? 'dirty' : undefined}
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card px-4 py-3 text-card-foreground shadow-panel ring-1 ring-border/60',
          dirty &&
            // Di bawah topbar (--z-sticky) saat tergulir ke atas, bukan menimpanya.
            'sticky bottom-3 z-[calc(var(--z-sticky)-1)] shadow-raised ring-2 ring-primary/40 phone:bottom-[calc(var(--mobile-nav-height)+var(--space-2)+env(safe-area-inset-bottom))]',
        )}
      >
        <span
          role="status"
          className={cn(
            'mr-auto inline-flex items-center gap-2 text-sm font-medium',
            dirty ? 'text-warning-foreground' : 'text-muted-foreground',
          )}
        >
          <span
            aria-hidden
            className={cn('size-2 shrink-0 rounded-full', dirty ? 'bg-warning-foreground' : 'bg-success-foreground')}
          />
          {dirty ? t('quoteRates.unsaved') : t('quoteRates.upToDate')}
        </span>
        <Button asChild variant="link" className="px-2 text-muted-foreground underline hover:text-foreground">
          <Link to="/calculator">{t('quoteRates.openCalculator')}</Link>
        </Button>
        {dirty && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(toDraft(current));
              setShowIssues(false);
            }}
          >
            {t('quoteRates.discard')}
          </Button>
        )}
        <Button onClick={() => void save()} disabled={busy || !dirty} aria-busy={busy || undefined}>
          {t('quoteRates.save')}
        </Button>
      </div>
    </>
  );
}
