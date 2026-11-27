import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { ChevronDown, FileText, Printer, Receipt, Scale } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Field, FormMessage } from '@/components/dens/field';
import { Label } from '@/components/dens/label';
import { RadioGroup, RadioGroupItem } from '@/components/dens/radio-group';
import { Switch } from '@/components/dens/switch';
import { TextInput } from '@/components/dens/text-input';
import { Textarea } from '@/components/dens/textarea';
import {
  PUBLIC_NOTE_MAX,
  setPublicNote,
  setPrivacyNotice,
  setReceiptSettings,
  setTermsSettings,
} from '@/config/orgConfig';
import { useCollection } from '@/hooks/useCollection';
import { useT, type TranslationKey } from '@/i18n';
import { saleReceiptDoc } from '@/features/pos/printSaleReceipt';
import {
  openReceiptWindow,
  receiptPreviewHtml,
  serviceReceiptDoc,
  type ReceiptDoc,
} from '@/features/services/printReceipt';
import { interpolate } from '@/lib/business/notify';
import { PRIVACY_NOTICE_MAX, cleanPrivacyNotice } from '@/lib/business/settingsFields';
import {
  TERMS_EXTRA_MAX,
  currentTerms,
  isValidPickupDays,
  isValidTermsFee,
  termsClauses,
  termsSentenceText,
  termsToSave,
} from '@/lib/business/serviceTerms';
import { fmtRpInput, parseRpInput } from '@/lib/format';
import { fmtDate, localDateStr } from '@/lib/time';
import {
  PAPER_WIDTHS,
  charsPerLine,
  normalizePaperWidth,
  paperSpec,
  type PaperWidth,
} from '@/lib/business/receiptPaper';
import {
  RECEIPT_TEXT_MAX,
  cleanReceiptText,
  resolveReceiptSettings,
  type ResolvedReceiptSettings,
} from '@/lib/business/receiptTemplate';
import { cn } from '@/lib/utils';
import { demoGuard } from '@/stores/demo';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import type { Organization, ReceiptSettings, ServiceTerms } from '@/data/types';
import { sampleSale, sampleService } from './receiptSample';
import { SETTINGS_GROUP, SaveFoot, SettingsCard, SettingsHint, SettingsSection } from './settingsUi';

/**
 * Pengaturan › Nota & Struk: satu rumah untuk semua yang menentukan isi dan
 * bentuk kertas yang dibawa pelanggan. Dulu tersebar: nama dan logo di
 * Usaha, Catatan Toko di kartu keenam Operasional, dan sisanya tertanam di kode.
 *
 * Saklar dan lebar kertas tersimpan seketika; teks bebas lewat satu tombol
 * Simpan. Pratinjau membaca yang SAMA dengan yang dicetak (saklar tersimpan +
 * teks yang sedang diketik), jadi pemilik toko melihat hasil sebelum menyimpan.
 *
 * Ambang dua kolom membaca wadah `settings` (SettingsSection), bukan layar:
 * ruang konten menyusut saat sidebar muncul dan saat zoom aplikasi dinaikkan,
 * tak satu pun tampak di lebar viewport. 720px diturunkan dari ukuran, bukan
 * angka bulat: satu kolom formulir mulai meluap pada wadah 280px (min-content
 * terukur ≈ 290px), diberi lantai 340px agar kolom teks tak sesempit lorong;
 * pratinjau minimal 360px (kertas 80mm menyusut zoom-nya sendiri, tak
 * menggeser); 340 + 16 jarak + 360 = 716.
 */

interface TextDraft {
  header: string;
  footer: string;
  serviceTerms: string;
  saleTerms: string;
  note: string;
  privacy: string;
}

const fromOrg = (org: Organization | null): TextDraft => {
  const r = resolveReceiptSettings(org?.settings?.receipt);
  return {
    header: r.header,
    footer: r.footer,
    serviceTerms: r.serviceTerms,
    saleTerms: r.saleTerms,
    note: (org?.settings?.publicNote ?? '').trim(),
    privacy: cleanPrivacyNotice(org?.settings?.privacyNotice),
  };
};

const cleanDraft = (d: TextDraft): TextDraft => ({
  header: cleanReceiptText(d.header, RECEIPT_TEXT_MAX.header),
  footer: cleanReceiptText(d.footer, RECEIPT_TEXT_MAX.footer),
  serviceTerms: cleanReceiptText(d.serviceTerms, RECEIPT_TEXT_MAX.terms),
  saleTerms: cleanReceiptText(d.saleTerms, RECEIPT_TEXT_MAX.terms),
  note: cleanReceiptText(d.note, PUBLIC_NOTE_MAX),
  privacy: cleanPrivacyNotice(d.privacy),
});

export function ReceiptTab() {
  const org = useSessionStore((s) => s.org);
  const [draft, setDraft] = useState<TextDraft>(() => fromOrg(org));
  const [terms, setTerms] = useState<TermsDraft>(() => termsDraftOf(currentTerms(org?.settings?.terms)));

  return (
    <SettingsSection>
      {/* Jarak dok pratinjau dari dasar layar. Di <=720px viewport menu bawah ada
          dan menempel di dasar, jadi dok duduk di atasnya (angka yang sama dengan
          register Kalkulator). Terikat kehadiran menu, bukan lebar wadah: media
          query yang sah (AGENTS.md §3). `.layout` jadi blok di wadah sempit:
          sticky dibatasi containing block-nya, dan untuk item grid itu sel
          gridnya sendiri (tinggi satu kartu, tak ada ruang untuk menempel). */}
      <div
        className={cn(
          'items-start gap-4 [--dock-bottom:var(--space-3)] phone:[--dock-bottom:calc(var(--mobile-nav-height)+var(--space-2)+env(safe-area-inset-bottom))]',
          `@min-[720px]/settings:grid @min-[720px]/settings:grid-cols-[minmax(340px,1fr)_minmax(360px,470px)]`,
        )}
      >
        {/* Urutan di ponsel: kertas, lalu apa yang dicetak, baru isi teks. Saklar
            dulu karena ia murah (sekali ketuk) dan menentukan teks mana yang masih
            perlu diisi. Urutan Tab mengikuti DOM (desktop), bukan urutan visual ini.
            Kolom yang difokus lewat Tab tak boleh mendarat di balik bar dok (WCAG
            2.4.11): 5.5rem ≈ tinggi bar tertutup + celah. */}
        <div
          className={cn(
            // grid-cols-1 = minmax(0,1fr): tanpa itu satu kata panjang tanpa spasi di
            // kolom teks (field-sizing: content) melebarkan lintasan sampai 1.600px.
            'grid min-w-0 grid-cols-1 gap-4',
            '@max-[720px]/settings:[&_:is(input,textarea,button)]:scroll-mb-[calc(var(--dock-bottom)+5.5rem)]',
          )}
        >
          <PaperCard />
          <div className={cn(`@max-[720px]/settings:order-2`)}>
            <ContentCard draft={draft} onChange={setDraft} />
          </div>
          <div className={cn(`@max-[720px]/settings:order-1`)}>
            <ShowCard />
          </div>
          <div className={cn(`@max-[720px]/settings:order-3`)}>
            <TermsCard draft={terms} onChange={setTerms} />
          </div>
        </div>
        <div
          className={cn(
            'min-w-0',
            // Di bawah topbar (--z-sticky) saat tergulir ke atas, bukan menimpanya.
            `@max-[720px]/settings:sticky @max-[720px]/settings:bottom-(--dock-bottom) @max-[720px]/settings:z-[calc(var(--z-sticky)-1)] @max-[720px]/settings:mt-4`,
            `@min-[720px]/settings:sticky @min-[720px]/settings:top-4`,
          )}
        >
          <PreviewCard draft={draft} terms={terms} />
        </div>
      </div>
    </SettingsSection>
  );
}

const PAPER_LABEL: Record<PaperWidth, TranslationKey> = {
  58: 'receipt.paper.w58',
  80: 'receipt.paper.w80',
};
const PAPER_HINT: Record<PaperWidth, TranslationKey> = {
  58: 'receipt.paper.w58Hint',
  80: 'receipt.paper.w80Hint',
};

function PaperCard() {
  const t = useT();
  const org = useSessionStore((s) => s.org);
  const current = normalizePaperWidth(org?.settings?.receipt?.paperWidth);
  // Di ponsel empat langkah dialog cetak tertutup supaya "Yang dicetak" tak
  // terdorong satu layar ke bawah; di lebar lapang selalu terbuka.
  const [setupOpen, setSetupOpen] = useState(false);
  const setupId = useId();

  const choose = async (width: PaperWidth) => {
    if (width === current) return;
    if (demoGuard()) return;
    try {
      await setReceiptSettings({ paperWidth: width });
      toast.success(t('receipt.paper.saved'));
    } catch {
      toast.error(t('receipt.paper.saveFailed'));
    }
  };

  return (
    <SettingsCard icon={<Receipt aria-hidden />} title={t('receipt.paper.title')}>
      <SettingsHint className="max-w-[60ch]">{t('receipt.paper.hint')}</SettingsHint>
      <RadioGroup
        value={String(current)}
        onValueChange={(v) => void choose(Number(v) as PaperWidth)}
        aria-label={t('receipt.paper.title')}
        // Menumpuk sendiri saat kartu sempit, tanpa breakpoint.
        className="grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-2"
      >
        {PAPER_WIDTHS.map((w) => (
          <label
            key={w}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-3 py-3 ring-1 ring-border transition-colors hover:bg-accent/40 has-[[data-state=checked]]:bg-soft/40 has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary/50"
          >
            <RadioGroupItem value={String(w)} className="mt-1" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <strong className="font-mono text-base font-semibold">{t(PAPER_LABEL[w])}</strong>
              <small className="text-sm leading-normal text-muted-foreground">{t(PAPER_HINT[w])}</small>
              <small className="font-mono text-xs text-muted-foreground tabular-nums">
                {charsPerLine(paperSpec(w))} {t('receipt.paper.cols')}
              </small>
            </span>
          </label>
        ))}
      </RadioGroup>

      <div className="mt-5 border-t border-dashed border-border pt-4">
        <div className={cn('flex items-center justify-between gap-3', `@max-[720px]/settings:min-h-11`)}>
          <h3 className="text-sm font-semibold">{t('receipt.setup.title')}</h3>
          {/* Tombol lipat hanya hidup di lebar sempit; di lebar lapang daftar
              selalu terbuka dan tombolnya tak ada. */}
          <button
            type="button"
            className={cn(
              'hidden items-center gap-2 rounded-full px-3 text-xs font-medium text-muted-foreground ring-1 ring-border outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
              `@max-[720px]/settings:inline-flex @max-[720px]/settings:min-h-11`,
            )}
            aria-expanded={setupOpen}
            aria-controls={setupId}
            onClick={() => setSetupOpen((v) => !v)}
          >
            {setupOpen ? t('receipt.setup.close') : t('receipt.setup.open')}
            <ChevronDown aria-hidden className={cn('size-3.5 transition-transform', setupOpen && 'rotate-180')} />
          </button>
        </div>
        <ul
          id={setupId}
          className={cn(
            'mt-2 grid max-w-[64ch] list-disc gap-1 pl-5 text-sm leading-normal text-muted-foreground',
            !setupOpen && `@max-[720px]/settings:hidden`,
          )}
        >
          <li>{t('receipt.setup.margin')}</li>
          <li>{t('receipt.setup.headers')}</li>
          <li>{t('receipt.setup.scale')}</li>
          <li>{t('receipt.setup.android')}</li>
        </ul>
      </div>
    </SettingsCard>
  );
}

// ---------------------------------------------------------------------------
// Isi kertas

interface TextFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: string;
  max: number;
  /** Tinggi awal kolom; kolom tumbuh sendiri mengikuti isinya. */
  minH: string;
  /** Teks bawaan, tampil redup selama kolom kosong. */
  placeholder?: string;
  onChange: (value: string) => void;
}

function TextField({ id, label, hint, value, max, minH, placeholder, onChange }: TextFieldProps) {
  const t = useT();
  const left = max - value.length;
  const low = left <= Math.min(40, max / 4);
  return (
    <div className={SETTINGS_GROUP}>
      <Label htmlFor={id}>{label}</Label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm leading-normal text-muted-foreground">
          {hint}
        </p>
      )}
      <Textarea
        id={id}
        className={minH}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <span
        className={cn(
          'text-right font-mono text-xs tabular-nums',
          low ? 'text-warning-foreground' : 'text-muted-foreground',
        )}
      >
        {interpolate(t('receipt.field.left'), { n: String(left) })}
      </span>
    </div>
  );
}

/**
 * Wadah status yang selalu ada supaya "belum tersimpan" diumumkan pembaca
 * layar; yang terlihat memakai `note` di SaveFoot, yang hanya dirender saat
 * ada perubahan (baris kosong sebesar satu baris di wadah sempit bila tidak).
 */
function UnsavedStatus({ dirty }: { dirty: boolean }) {
  const t = useT();
  return (
    <span role="status" className="sr-only">
      {dirty ? t('receipt.content.unsaved') : ''}
    </span>
  );
}

function ContentCard({ draft, onChange }: { draft: TextDraft; onChange: (d: TextDraft) => void }) {
  const t = useT();
  const org = useSessionStore((s) => s.org);
  const [busy, setBusy] = useState(false);
  const saved = useMemo(() => cleanDraft(fromOrg(org)), [org]);
  const dirty = JSON.stringify(cleanDraft(draft)) !== JSON.stringify(saved);

  const set = (key: keyof TextDraft) => (value: string) => onChange({ ...draft, [key]: value });

  const save = async () => {
    if (demoGuard()) return;
    const next = cleanDraft(draft);
    setBusy(true);
    try {
      await setReceiptSettings({
        header: next.header,
        footer: next.footer,
        serviceTerms: next.serviceTerms,
        saleTerms: next.saleTerms,
      });
      if (next.note !== saved.note) await setPublicNote(next.note);
      if (next.privacy !== saved.privacy) await setPrivacyNotice(next.privacy);
      onChange(next);
      toast.success(t('receipt.content.saved'));
    } catch {
      toast.error(t('receipt.content.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard icon={<FileText aria-hidden />} title={t('receipt.content.title')}>
      <SettingsHint className="max-w-[60ch]">{t('receipt.content.hint')}</SettingsHint>
      <TextField
        id="receipt-header"
        label={t('receipt.field.header')}
        hint={t('receipt.field.headerHint')}
        value={draft.header}
        max={RECEIPT_TEXT_MAX.header}
        minH="min-h-16"
        onChange={set('header')}
      />
      <TextField
        id="receipt-footer"
        label={t('receipt.field.footer')}
        hint={t('receipt.field.footerHint')}
        value={draft.footer}
        max={RECEIPT_TEXT_MAX.footer}
        minH="min-h-16"
        placeholder={t('receipt.foot.thanks')}
        onChange={set('footer')}
      />
      <TextField
        id="receipt-service-terms"
        label={t('receipt.field.serviceTerms')}
        value={draft.serviceTerms}
        max={RECEIPT_TEXT_MAX.terms}
        minH="min-h-24"
        placeholder={t('receipt.service.fine')}
        onChange={set('serviceTerms')}
      />
      <TextField
        id="receipt-sale-terms"
        label={t('receipt.field.saleTerms')}
        hint={t('receipt.field.saleTermsHint')}
        value={draft.saleTerms}
        max={RECEIPT_TEXT_MAX.terms}
        minH="min-h-24"
        placeholder={t('receipt.sale.fine')}
        onChange={set('saleTerms')}
      />
      <TextField
        id="receipt-note"
        label={t('settingsPage.catatanToko')}
        hint={t('receipt.field.noteHint')}
        value={draft.note}
        max={PUBLIC_NOTE_MAX}
        minH="min-h-24"
        onChange={set('note')}
      />
      <TextField
        id="receipt-privacy"
        label={t('receipt.field.privacy')}
        hint={t('receipt.field.privacyHint')}
        value={draft.privacy}
        max={PRIVACY_NOTICE_MAX}
        minH="min-h-24"
        onChange={set('privacy')}
      />
      <UnsavedStatus dirty={dirty} />
      <SaveFoot note={dirty ? <span aria-hidden>{t('receipt.content.unsaved')}</span> : undefined}>
        <Button onClick={() => void save()} disabled={busy || !dirty} aria-busy={busy || undefined}>
          {t('receipt.content.save')}
        </Button>
      </SaveFoot>
    </SettingsCard>
  );
}

// ---------------------------------------------------------------------------
// Yang dicetak

type SwitchKey = 'showQr' | 'showTrackUrl' | 'showImei' | 'showTechnician' | 'showTime';

const SWITCHES: { key: SwitchKey; label: TranslationKey; hint: TranslationKey }[] = [
  { key: 'showQr', label: 'receipt.show.qr', hint: 'receipt.show.qrHint' },
  { key: 'showTrackUrl', label: 'receipt.show.trackUrl', hint: 'receipt.show.trackUrlHint' },
  { key: 'showImei', label: 'receipt.show.imei', hint: 'receipt.show.imeiHint' },
  { key: 'showTechnician', label: 'receipt.show.technician', hint: 'receipt.show.technicianHint' },
  { key: 'showTime', label: 'receipt.show.time', hint: 'receipt.show.timeHint' },
];

function ShowCard() {
  const t = useT();
  const org = useSessionStore((s) => s.org);
  const cfg = resolveReceiptSettings(org?.settings?.receipt);
  const [busy, setBusy] = useState<SwitchKey | null>(null);

  const flip = async (key: SwitchKey) => {
    if (busy || demoGuard()) return;
    setBusy(key);
    try {
      await setReceiptSettings({ [key]: !cfg[key] } as Partial<ReceiptSettings>);
      toast.success(t('receipt.show.saved'));
    } catch {
      toast.error(t('receipt.show.saveFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsCard icon={<Receipt aria-hidden />} title={t('receipt.show.title')}>
      <SettingsHint className="max-w-[60ch]">{t('receipt.show.hint')}</SettingsHint>
      <ul>
        {SWITCHES.map((s) => (
          // Label dan saklar sebaris, petunjuk selebar baris di bawahnya: di kolom
          // kiri 340px petunjuk di samping saklar jadi tiga empat baris per saklar.
          <li
            key={s.key}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-3 first:pt-0 last:pb-0 [&+&]:border-t [&+&]:border-dashed [&+&]:border-border"
          >
            <span id={`${s.key}-label`} className="text-sm font-semibold">
              {t(s.label)}
            </span>
            <Switch
              checked={cfg[s.key]}
              onCheckedChange={() => void flip(s.key)}
              disabled={busy === s.key}
              aria-labelledby={`${s.key}-label`}
              aria-describedby={`${s.key}-hint`}
              className="col-start-2 row-start-1"
            />
            <span id={`${s.key}-hint`} className="col-span-2 text-sm leading-normal text-muted-foreground">
              {t(s.hint)}
            </span>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}

// ---------------------------------------------------------------------------
// Syarat & Ketentuan

/** Isian S&K sebagai teks yang sedang diketik; angka dibaca saat disimpan. */
interface TermsDraft {
  pickupDays: string;
  storageFee: string;
  checkFee: string;
  extra: string;
}

const termsDraftOf = (t: ServiceTerms): TermsDraft => ({
  pickupDays: String(t.pickupDays),
  storageFee: t.storageFee ? fmtRpInput(String(t.storageFee)) : '',
  checkFee: t.checkFee ? fmtRpInput(String(t.checkFee)) : '',
  extra: t.extra,
});

function termsValues(d: TermsDraft) {
  const days = d.pickupDays.replace(/\D/g, '');
  return {
    pickupDays: days ? Number(days) : Number.NaN,
    storageFee: parseRpInput(d.storageFee),
    checkFee: parseRpInput(d.checkFee),
    extra: d.extra,
  };
}

/**
 * S&K yang akan berlaku bila isian ini disimpan sekarang, atau `null` bila
 * isiannya belum sah. Satu fungsi untuk tombol Simpan, catatan "belum tersimpan",
 * dan pratinjau nota, supaya ketiganya tak pernah berbeda pendapat.
 */
function termsFromDraft(saved: ServiceTerms, d: TermsDraft): ServiceTerms | null {
  const v = termsValues(d);
  if (!isValidPickupDays(v.pickupDays) || !isValidTermsFee(v.storageFee) || !isValidTermsFee(v.checkFee))
    return null;
  return termsToSave(saved, v, localDateStr());
}

function TermsClauseList({ terms }: { terms: ServiceTerms }) {
  const t = useT();
  return (
    <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm leading-normal text-muted-foreground marker:font-mono marker:text-xs">
      {termsClauses(terms).map((c) => (
        <li key={c.title}>
          <strong className="font-semibold text-foreground">{t(c.title)}.</strong>{' '}
          {c.body.map((b) => termsSentenceText(b, t)).join(' ')}
        </li>
      ))}
      {terms.extra && (
        <li>
          <span className="[overflow-wrap:anywhere]">
            <strong className="font-semibold text-foreground">{t('terms.extra.title')}.</strong> {terms.extra}
          </span>
        </li>
      )}
    </ol>
  );
}

function TermsCard({ draft, onChange }: { draft: TermsDraft; onChange: (d: TermsDraft) => void }) {
  const t = useT();
  const org = useSessionStore((s) => s.org);
  const saved = useMemo(() => currentTerms(org?.settings?.terms), [org]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const v = termsValues(draft);
  const badDays = !isValidPickupDays(v.pickupDays);
  const next = termsFromDraft(saved, draft);
  const dirty = next !== saved;
  const shown = next ?? saved;

  const set = (key: keyof TermsDraft, money = false) => (value: string) => {
    setError('');
    onChange({ ...draft, [key]: money ? fmtRpInput(value) : value });
  };

  const save = async () => {
    if (!next) {
      setError(t(badDays ? 'terms.settings.invalidDays' : 'terms.settings.invalidFee'));
      return;
    }
    if (demoGuard()) return;
    setBusy(true);
    try {
      await setTermsSettings(next);
      onChange(termsDraftOf(next));
      toast.success(t('terms.settings.saved'));
    } catch {
      toast.error(t('terms.settings.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard icon={<Scale aria-hidden />} title={t('terms.settings.title')}>
      <SettingsHint className="max-w-[60ch]">{t('terms.settings.hint')}</SettingsHint>
      <div className="@container/terms flex flex-col gap-4">
        <FormMessage>{error}</FormMessage>
        <Field
          label={t('terms.settings.pickupDays')}
          hint={t('terms.settings.pickupDaysHint')}
          invalid={!!error && badDays}
        >
          <TextInput
            capitalize="none"
            inputMode="numeric"
            autoComplete="off"
            value={draft.pickupDays}
            onChange={(e) => set('pickupDays')(e.target.value.replace(/\D/g, '').slice(0, 3))}
          />
        </Field>
        <div className="grid gap-4 @min-[28rem]/terms:grid-cols-2">
          <Field
            label={t('terms.settings.storageFee')}
            hint={t('terms.settings.storageFeeHint')}
            invalid={!!error && !isValidTermsFee(v.storageFee)}
          >
            <TextInput
              capitalize="none"
              inputMode="numeric"
              autoComplete="off"
              className="font-mono tabular-nums"
              value={draft.storageFee}
              onChange={(e) => set('storageFee', true)(e.target.value)}
            />
          </Field>
          <Field
            label={t('terms.settings.checkFee')}
            hint={t('terms.settings.checkFeeHint')}
            invalid={!!error && !isValidTermsFee(v.checkFee)}
          >
            <TextInput
              capitalize="none"
              inputMode="numeric"
              autoComplete="off"
              className="font-mono tabular-nums"
              value={draft.checkFee}
              onChange={(e) => set('checkFee', true)(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t('terms.settings.extra')} hint={t('terms.settings.extraHint')}>
          <Textarea
            maxLength={TERMS_EXTRA_MAX}
            value={draft.extra}
            onChange={(e) => set('extra')(e.target.value)}
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 border-t border-dashed border-border pt-4">
        <span className="text-sm font-semibold">{t('terms.settings.version')}</span>
        <span className="font-mono text-sm tabular-nums">{fmtDate(shown.version)}</span>
      </div>
      <p className="mt-1 text-sm leading-normal text-muted-foreground">{t('terms.settings.versionHint')}</p>

      <details className="group mt-3">
        <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-full px-3 text-sm font-medium ring-1 ring-border outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
          {t('terms.settings.view')}
          <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <TermsClauseList terms={shown} />
      </details>

      <UnsavedStatus dirty={dirty} />
      <SaveFoot note={dirty ? <span aria-hidden>{t('receipt.content.unsaved')}</span> : undefined}>
        <Button onClick={() => void save()} disabled={busy || !dirty} aria-busy={busy || undefined}>
          {t('terms.settings.save')}
        </Button>
      </SaveFoot>
    </SettingsCard>
  );
}

// ---------------------------------------------------------------------------
// Pratinjau

type Sample = 'service' | 'sale';

/**
 * Zoom pratinjau paling besar: kertas 58mm hanya 219px, terlalu kecil untuk
 * dibaca di layar. Zoom yang dipakai mengecil sendiri bila meja kerjanya lebih
 * sempit dari kertas yang diperbesar (kertas 80mm di kolom 470px atau di ponsel):
 * menggeser kertas ke samping di dalam kartu lebih buruk daripada kertas kecil.
 */
const PREVIEW_ZOOM = 1.5;

function PreviewCard({ draft, terms }: { draft: TextDraft; terms: TermsDraft }) {
  const t = useT();
  const org = useSessionStore((s) => s.org);
  // S&K yang akan berlaku bila disimpan sekarang; isian yang belum sah = yang tersimpan.
  const previewTerms = useMemo(() => {
    const saved = currentTerms(org?.settings?.terms);
    return termsFromDraft(saved, terms) ?? saved;
  }, [org, terms]);
  const { data: outlets } = useCollection('outlets');
  const [which, setWhich] = useState<Sample>('service');
  const [oneBit, setOneBit] = useState(false);
  const [height, setHeight] = useState(0);
  const [avail, setAvail] = useState(0);
  // Hanya bermakna di bawah ambang dua kolom: kartu jadi dok yang menempel di
  // dasar layar dan panelnya terbuka ke atas. Di lebar lapang CSS mengabaikannya.
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const bwId = useId();
  const peek = useRef<HTMLButtonElement>(null);
  const dock = useRef<HTMLElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const watcher = useRef<ResizeObserver | null>(null);

  // Panel yang terbuka menutupi bagian bawah layar: begitu pemilik toko
  // menyentuh kolom atau saklar lain, panel menyingkir supaya yang diketik
  // tak tertutup.
  useEffect(() => {
    if (!open) return;
    const away = (e: FocusEvent) => {
      if (dock.current && e.target instanceof Node && !dock.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('focusin', away);
    return () => document.removeEventListener('focusin', away);
  }, [open]);

  // Lebar bersih meja kerja (tanpa padding) diukur dari DOM-nya, bukan ditebak
  // dari breakpoint: ia menyusut oleh sidebar, kolom, dan zoom aplikasi sekaligus.
  const watchBench = useCallback((el: HTMLDivElement | null) => {
    watcher.current?.disconnect();
    watcher.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const read = () => {
      const cs = getComputedStyle(el);
      setAvail(Math.floor(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
    };
    read();
    watcher.current = new ResizeObserver(read);
    watcher.current.observe(el);
  }, []);

  // Organisasi bayangan: setelan tersimpan + teks yang sedang diketik.
  const previewOrg = useMemo<Organization | null>(() => {
    if (!org) return null;
    const next = cleanDraft(draft);
    return {
      ...org,
      settings: {
        ...org.settings,
        publicNote: next.note,
        receipt: {
          ...org.settings?.receipt,
          header: next.header,
          footer: next.footer,
          serviceTerms: next.serviceTerms,
          saleTerms: next.saleTerms,
        },
      },
    };
  }, [org, draft]);

  const cfg: ResolvedReceiptSettings = resolveReceiptSettings(previewOrg?.settings?.receipt);
  const paper = paperSpec(cfg.paperWidth);

  const doc = useMemo<ReceiptDoc | null>(() => {
    if (!previewOrg) return null;
    const text = {
      complaint: t('receipt.sample.complaint'),
      condition: t('receipt.sample.condition'),
      accessories: t('receipt.sample.accessories'),
      item1: t('receipt.sample.item1'),
      item2: t('receipt.sample.item2'),
    };
    if (which === 'service')
      return serviceReceiptDoc(sampleService(text), previewOrg, window.location.origin, outlets, {
        terms: previewTerms,
      });
    const { sale, change } = sampleSale(text);
    return saleReceiptDoc(sale, previewOrg, {
      change,
      outlets,
      walletName: (id) => (id === 'sample-cash' ? t('receipt.sample.cash') : ''),
    });
  }, [previewOrg, which, outlets, t, previewTerms]);

  if (!previewOrg || !doc) return null;
  const html = receiptPreviewHtml(previewOrg, doc);

  // Tinggi isi diukur dari dokumennya sendiri: baris yang membungkus bergantung
  // pada font mono yang ada di mesin ini, bukan pada angka yang kami tebak.
  const measure = () => {
    // body, bukan documentElement: scrollHeight html tak bisa lebih kecil dari
    // tinggi iframe, jadi nota pendek akan terukur setinggi bingkainya.
    const body = frame.current?.contentDocument?.body;
    if (body) setHeight(Math.ceil(body.getBoundingClientRect().height));
  };

  const print = () => openReceiptWindow(previewOrg, doc);
  const mmPx = (mm: number) => (mm * 96) / 25.4;
  const paperPx = mmPx(cfg.paperWidth);
  // Dibulatkan ke bawah per 0,01: ukuran kertas tak ikut bergetar bersama sub-piksel.
  const zoom =
    avail > 0 ? Math.min(PREVIEW_ZOOM, Math.floor((avail / paperPx) * 100) / 100) : PREVIEW_ZOOM;

  const closeOnEscape = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape' || !open) return;
    setOpen(false);
    peek.current?.focus();
  };

  return (
    // Escape ditangkap di kartunya: fokus bisa sedang di tombol pilih atau saklar
    // di dalam panel, bukan di tombol dok.
    <section
      ref={dock}
      onKeyDown={closeOnEscape}
      className={cn(
        'rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60',
        'overflow-hidden',
        // Kartu pratinjau menjadi dok. Yang menempel hanya BAR-nya (tinggi tetap);
        // panel melayang di atasnya (absolute), bukan ikut menambah tinggi kotak
        // sticky: kotak setinggi 485px tak muat di antara puncak tata letak dan
        // dasar layar di 320px, lalu didorong ke bawah sampai bar Cetak percobaan
        // tertutup menu bawah (terukur 23px).
        `@max-[720px]/settings:relative @max-[720px]/settings:overflow-visible @max-[720px]/settings:shadow-raised @max-[720px]/settings:ring-border`,
        open && `@max-[720px]/settings:rounded-t-none`,
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3',
          `@max-[720px]/settings:flex-nowrap @max-[720px]/settings:py-2 @max-[720px]/settings:pr-3 @max-[720px]/settings:pl-4`,
        )}
      >
        {/* Satu h2, dua isi: label biasa di lebar lapang, tombol buka-tutup di
            lebar sempit. Yang tak dipakai display:none, jadi hilang juga dari
            pohon aksesibilitas dan tak ada tombol mati yang bisa difokus. Basis
            8.25rem = lebar terkecil yang masih memuat "Pratinjau" utuh: yang
            mengalah saat sempit adalah tombol cetak di sebelahnya, bukan judul. */}
        <h2 className={cn('min-w-0 text-sm font-semibold', `@max-[720px]/settings:flex-[1_0_8.25rem]`)}>
          <span className={cn('inline-flex items-center gap-2 [&>svg]:size-4 [&>svg]:text-muted-foreground', `@max-[720px]/settings:hidden`)}>
            <Receipt aria-hidden />
            {t('receipt.preview.title')}
          </span>
          <button
            ref={peek}
            type="button"
            className={cn(
              'hidden w-full items-center gap-2 rounded-full px-3 text-left text-sm font-semibold outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
              `@max-[720px]/settings:flex @max-[720px]/settings:min-h-11`,
            )}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="min-w-0 flex-1 truncate">{t('receipt.preview.title')}</span>
            {/* Panel terbuka ke ATAS: panah naik saat tertutup, turun saat terbuka. */}
            <ChevronDown aria-hidden className={cn('size-4 shrink-0 rotate-180 transition-transform', open && 'rotate-0')} />
          </button>
        </h2>
        <Button
          variant="secondary"
          size="sm"
          // Di 320px bar tak muat dua tombol selebar isinya: tombol cetak yang
          // mengalah (labelnya turun ke dua baris).
          className={cn(`@max-[720px]/settings:h-auto @max-[720px]/settings:min-w-0 @max-[720px]/settings:flex-[0_1_auto] @max-[720px]/settings:py-1.5 @max-[720px]/settings:leading-tight @max-[720px]/settings:whitespace-normal @max-[720px]/settings:text-left`)}
          onClick={print}
        >
          <Printer aria-hidden />
          {t('receipt.preview.print')}
        </Button>
      </div>

      {/* Tertutup di wadah sempit: tak terlihat dan tak bisa difokus, tapi TETAP
          ter-layout. iframe pratinjau mengukur tinggi isinya dan meja kerjanya
          mengukur lebar untuk zoom; display:none membuat keduanya terbaca 0. */}
      <div
        id={panelId}
        className={cn(
          'px-5 pb-5',
          `@max-[720px]/settings:absolute @max-[720px]/settings:inset-x-[-1px] @max-[720px]/settings:bottom-full @max-[720px]/settings:rounded-t-2xl @max-[720px]/settings:bg-card @max-[720px]/settings:px-4 @max-[720px]/settings:shadow-raised @max-[720px]/settings:ring-1 @max-[720px]/settings:ring-border`,
          open
            ? `@max-[720px]/settings:max-h-[calc(var(--app-vh)_*_0.6)] @max-[720px]/settings:overflow-y-auto @max-[720px]/settings:overscroll-contain @max-[720px]/settings:py-4`
            : `@max-[720px]/settings:invisible @max-[720px]/settings:max-h-0 @max-[720px]/settings:overflow-hidden @max-[720px]/settings:py-0`,
        )}
      >
        <div
          role="group"
          aria-label={t('receipt.preview.title')}
          className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
        >
          {(['service', 'sale'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={which === k}
              onClick={() => setWhich(k)}
              className="min-h-9 rounded-full px-3 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm pointer-coarse:min-h-11"
            >
              {t(k === 'service' ? 'receipt.preview.service' : 'receipt.preview.sale')}
            </button>
          ))}
        </div>

        <div className="my-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 font-mono text-xs text-muted-foreground">
          <span>
            {cfg.paperWidth} mm · {charsPerLine(paper)} {t('receipt.paper.cols')}
          </span>
          <span className="inline-flex items-center gap-2 font-sans text-sm text-foreground">
            <Switch checked={oneBit} onCheckedChange={setOneBit} aria-labelledby={bwId} />
            <span id={bwId}>{t('receipt.preview.bw')}</span>
          </span>
        </div>
        {oneBit && <p className="mb-3 text-sm leading-normal text-muted-foreground">{t('receipt.preview.bwHint')}</p>}

        {/* Meja kerja: kertas ditaruh di atas landasan. Putih kertas di sini
            disengaja: tinta di kertas tak punya mode gelap. */}
        <div
          ref={watchBench}
          className="my-3 flex justify-center overflow-x-auto rounded-xl bg-muted px-3 py-4 ring-1 ring-border/60"
        >
          <div
            className="flex-none overflow-hidden border-b-2 border-dotted border-border shadow-[0_6px_8px_rgb(20_28_40/0.1)]"
            style={{
              width: paperPx * zoom,
              height: height ? height * zoom : undefined,
            }}
          >
            <iframe
              ref={frame}
              key={cfg.paperWidth}
              title={interpolate(t('receipt.preview.frame'), { width: String(cfg.paperWidth) })}
              srcDoc={html}
              sandbox="allow-same-origin"
              scrolling="no"
              // Simulasi head termal: ambang 50% (abu-abu di bawahnya hilang).
              className={cn('block origin-top-left border-0 bg-white', oneBit && '[filter:grayscale(1)_contrast(1000)]')}
              style={{ width: paperPx, height: height || 480, zoom }}
              onLoad={measure}
            />
          </div>
        </div>
        <p className="text-sm leading-normal text-muted-foreground">{t('receipt.preview.sample')}</p>
      </div>
    </section>
  );
}
