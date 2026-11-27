import { useEffect, useState } from 'react';
import { ClipboardList, Clock, Columns3, Laptop, LoaderCircle, Plus, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Checkbox } from '@/components/dens/checkbox';
import { Field } from '@/components/dens/field';
import { Input } from '@/components/dens/input';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { Textarea } from '@/components/dens/textarea';
import { WhatsAppIcon } from '@/components/dens/whatsapp-icon';
import {
  getComplaintTemplates,
  getComplaintTemplatesFor,
  setComplaintTemplates,
  setComplaintTemplatesFor,
  getAccessoryTemplates,
  setAccessoryTemplates,
  getWarrantyServiceDays,
  getWarrantyPartsDays,
  setWarrantyDays,
  getWarrantyPresets,
  setWarrantyPresets,
  getWaTemplateOverrides,
  setWaTemplateOverrides,
  getReviewUrl,
  setReviewUrl,
  setLateToleranceMinutes,
  getCategories,
  setCategories,
  seedCategoriesFromLocal,
  saveServiceColumns,
} from '@/config/orgConfig';
import {
  DEFAULT_WA_TEMPLATES,
  WA_TEMPLATE_LABELS,
  WA_TEMPLATE_VARS,
  interpolate,
  type WaTemplateKey,
} from '@/lib/business/notify';
import { SERVICE_COLUMNS, resolveServiceColumns, type ServiceColumnId } from '@/lib/business/serviceColumns';
import { LATE_TOLERANCE_MAX, REVIEW_URL_MAX, parseLateTolerance, validateReviewUrl } from '@/lib/business/settingsFields';
import { useT } from '@/i18n';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import { SETTINGS_GROUP, SETTINGS_LABEL, SaveFoot, SettingsCard, SettingsHint, SettingsSection } from './settingsUi';

/** Tab Operasional (L-55, L-70): pilihan cepat form servis, kolom tabel, garansi, absensi, templat WhatsApp. */
export function OperationsSettings() {
  return (
    <SettingsSection>
      <ServiceTemplatesCard />
      <DeviceCategoriesCard />
      <ServiceColumnsCard />
      <WarrantyCard />
      <AttendanceCard />
      <WhatsAppTemplatesCard />
    </SettingsSection>
  );
}

const Spinner = () => <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />;

/**
 * Manage reusable complaint & accessory templates used as quick-picks in
 * the service form. Stored in orgConfig (localStorage), so we keep local
 * state in sync after each mutation.
 */
/** Penanda "daftar umum" di pemilih jenis (bukan nama jenis mana pun). */
const UMUM = '__umum__';

function ServiceTemplatesCard() {
  const t = useT();
  // Berlangganan baris toko: render ulang setelah penyimpanan diterima server,
  // dan daftar di bawah dibaca langsung darinya.
  useSessionStore((s) => s.org);
  const categories = getCategories();
  const [picked, setPicked] = useState('');
  const [accessories, setAccessories] = useState<string[]>(() => getAccessoryTemplates());
  const [busy, setBusy] = useState(false);
  // Awalnya jenis pertama, supaya isi awal per jenis langsung terlihat. Jenis yang
  // dihapus dari daftar kategori juga jatuh kembali ke jenis pertama.
  const active = picked === UMUM || categories.includes(picked) ? picked : (categories[0] ?? UMUM);
  const complaints = active === UMUM ? getComplaintTemplates() : getComplaintTemplatesFor(active);

  const saveComplaints = async (next: string[]) => {
    setBusy(true);
    try {
      if (active === UMUM) await setComplaintTemplates(next);
      else await setComplaintTemplatesFor(active, next);
    } catch {
      toast.error(t('settingsPage.gagalMenyimpanTemplate'));
    } finally {
      setBusy(false);
    }
  };
  const saveAccessories = async (next: string[]) => {
    setBusy(true);
    try {
      await setAccessoryTemplates(next);
      setAccessories(next);
    } catch {
      toast.error(t('settingsPage.gagalMenyimpanTemplate'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard icon={<ClipboardList aria-hidden />} title={t('settingsPage.templateServis')}>
      <SettingsHint>Pilihan cepat keluhan &amp; kelengkapan saat membuat servis baru.</SettingsHint>
      <div className={SETTINGS_GROUP}>
        <Field label={t('settingsPage.keluhanJenis')} hint={t('settingsPage.keluhanJenisHint')}>
          <SelectBox
            value={active}
            onValueChange={setPicked}
            options={[
              ...categories.map((c) => ({ value: c, label: c })),
              { value: UMUM, label: t('settingsPage.keluhanUmum') },
            ]}
            disabled={busy}
          />
        </Field>
      </div>
      <StringListEditor
        key={active}
        label={t('settingsPage.templateKeluhan')}
        placeholder={t('settingsPage.misMatiTotal')}
        items={complaints}
        onAdd={(value) => void saveComplaints([...complaints, value])}
        onRemove={(value) => void saveComplaints(complaints.filter((c) => c !== value))}
        disabled={busy}
      />
      <StringListEditor
        label={t('settingsPage.templateKelengkapan')}
        placeholder={t('settingsPage.misCharger')}
        items={accessories}
        onAdd={(value) => void saveAccessories([...accessories, value])}
        onRemove={(value) => void saveAccessories(accessories.filter((a) => a !== value))}
        disabled={busy}
      />
    </SettingsCard>
  );
}

/**
 * Kolom tabel Servis yang ditampilkan. Tersimpan di baris organisasi, jadi semua
 * perangkat toko melihat tabel yang sama. No. Servis, Status, dan Aksi selalu ada.
 */
function ServiceColumnsCard() {
  const t = useT();
  const org = useSessionStore((s) => s.org);
  const columns = resolveServiceColumns(org?.settings?.serviceColumns);
  const [busy, setBusy] = useState(false);

  const toggle = async (id: ServiceColumnId) => {
    const next = columns.includes(id) ? columns.filter((c) => c !== id) : [...columns, id];
    setBusy(true);
    try {
      await saveServiceColumns(next);
    } catch {
      toast.error(t('settingsPage.gagalMenyimpanKolomTabel'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard icon={<Columns3 aria-hidden />} title={t('settingsPage.kolomTabelServis')}>
      <SettingsHint>{t('settingsPage.pPilihKolomYangTampil')}</SettingsHint>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-2">
        {SERVICE_COLUMNS.map((c) => (
          <label
            key={c.id}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 ring-1 ring-border transition-colors hover:bg-accent/40 has-[[data-state=checked]]:ring-primary/40"
          >
            <Checkbox
              className="mt-0.5"
              checked={columns.includes(c.id)}
              onCheckedChange={() => void toggle(c.id)}
              disabled={busy}
            />
            <span className="flex flex-col gap-0.5">
              <strong className="text-sm font-semibold">{t(c.labelKey)}</strong>
              <small className="text-xs text-muted-foreground">{t(c.hintKey)}</small>
            </span>
          </label>
        ))}
      </div>
    </SettingsCard>
  );
}

/**
 * Device categories (e.g. "Laptop", "HP / Smartphone") offered as the category
 * dropdown when creating a service. Stored on the organization row
 * (settings.deviceCategories, migration 0032) so they sync across devices.
 */
function DeviceCategoriesCard() {
  const t = useT();
  // Read reactively from the org slice so a save here (and realtime updates
  // from other devices) re-render the list immediately.
  const org = useSessionStore((s) => s.org);
  const categories = org?.settings?.deviceCategories ?? getCategories();
  const [busy, setBusy] = useState(false);

  // One-time lift of any legacy per-device list into the cloud copy.
  useEffect(() => {
    void seedCategoriesFromLocal();
  }, []);

  const persist = async (next: string[]) => {
    setBusy(true);
    try {
      await setCategories(next);
    } catch {
      toast.error(t('settingsPage.gagalMenyimpanKategori'));
    } finally {
      setBusy(false);
    }
  };

  const addCategory = (value: string) => {
    if (categories.includes(value)) return;
    void persist([...categories, value]);
  };
  const removeCategory = (value: string) => {
    void persist(categories.filter((c) => c !== value));
  };

  return (
    <SettingsCard icon={<Laptop aria-hidden />} title={t('settingsPage.kategoriPerangkat')}>
      <SettingsHint>{t('settingsPage.pJenisPerangkatYangDilayani')}</SettingsHint>
      <StringListEditor
        label={t('settingsPage.kategori')}
        placeholder={t('settingsPage.misTablet')}
        items={categories}
        onAdd={addCategory}
        onRemove={removeCategory}
        disabled={busy}
      />
    </SettingsCard>
  );
}

function StringListEditor({
  label,
  placeholder,
  items,
  onAdd,
  onRemove,
  disabled = false,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [value, setValue] = useState('');
  const commit = () => {
    const v = value.trim();
    if (!v) return;
    if (items.includes(v)) {
      toast.warning(t('settingsPage.templateSudahAda'));
      return;
    }
    onAdd(v);
    setValue('');
  };
  return (
    <div className={SETTINGS_GROUP}>
      <span className={SETTINGS_LABEL}>{label}</span>
      {items.length > 0 && (
        <TagChips
          items={items.map((item) => ({ key: item, label: item, removeLabel: `Hapus ${item}` }))}
          onRemove={onRemove}
          removeTitle={t('settingsPage.hapus')}
          disabled={disabled}
        />
      )}
      <AddRow
        placeholder={placeholder}
        value={value}
        onChange={setValue}
        onCommit={commit}
        addLabel={t('settingsPage.tambah')}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * Default warranty lengths (service & parts) prefilled in StatusModal when a
 * job is finished, plus quick-pick duration presets. Stored in orgConfig.
 */
function WarrantyCard() {
  const t = useT();
  const [svcDays, setSvcDays] = useState(() => String(getWarrantyServiceDays()));
  const [partsDays, setPartsDays] = useState(() => String(getWarrantyPartsDays()));
  const [presets, setPresets] = useState<number[]>(() => getWarrantyPresets());
  const [presetInput, setPresetInput] = useState('');

  const [saving, setSaving] = useState(false);

  const saveDefaults = async () => {
    setSaving(true);
    try {
      // Clamp to non-negative: a "number" input still accepts "-5".
      await setWarrantyDays(Number(svcDays) || 0, Number(partsDays) || 0);
      toast.success(t('settingsPage.defaultGaransiDisimpan'));
    } catch {
      toast.error(t('settingsPage.gagalMenyimpanDefaultGaransi'));
    } finally {
      setSaving(false);
    }
  };

  const addPreset = async () => {
    const n = Math.max(0, Math.round(Number(presetInput) || 0));
    if (!n) return toast.warning(t('settingsPage.masukkanJumlahHariYang'));
    if (presets.includes(n)) return toast.warning(t('settingsPage.presetSudahAda'));
    const next = [...presets, n].sort((a, b) => a - b);
    try {
      await setWarrantyPresets(next);
      setPresets(next);
      setPresetInput('');
    } catch {
      toast.error(t('settingsPage.gagalMenyimpanPreset'));
    }
  };
  const removePreset = async (n: number) => {
    const next = presets.filter((p) => p !== n);
    try {
      await setWarrantyPresets(next);
      setPresets(next);
    } catch {
      toast.error(t('settingsPage.gagalMenyimpanPreset'));
    }
  };

  return (
    <SettingsCard icon={<ShieldCheck aria-hidden />} title={t('settingsPage.garansi')}>
      <SettingsHint>
        {t('settingsPage.warrantyIntro')} <strong>{t('settingsPage.warrantyDone')}</strong>. {t('settingsPage.warrantyPerService')}
      </SettingsHint>
      {/* Dua isian berdampingan; satu kolom di wadah sempit (FixMaster: @media 520px). */}
      <div className="grid grid-cols-2 gap-3 @max-[489px]/settings:grid-cols-1">
        <Field label={t('settingsPage.garansiJasaHari')}>
          <Input type="number" inputMode="numeric" className={NUM} value={svcDays} onChange={(e) => setSvcDays(e.target.value)} />
        </Field>
        <Field label={t('settingsPage.garansiSparepartHari')}>
          <Input type="number" inputMode="numeric" className={NUM} value={partsDays} onChange={(e) => setPartsDays(e.target.value)} />
        </Field>
      </div>
      <SaveFoot>
        <Button onClick={saveDefaults} disabled={saving} aria-busy={saving || undefined}>
          {saving && <Spinner />}
          {t('settingsPage.simpanDefault')}
        </Button>
      </SaveFoot>

      <div className={`${SETTINGS_GROUP} mt-5`}>
        <span className={SETTINGS_LABEL}>{t('settingsPage.presetDurasiQuickPick')}</span>
        {presets.length > 0 && (
          <TagChips
            items={presets.map((p) => ({ key: String(p), label: `${p} hari`, removeLabel: `Hapus ${p} hari` }))}
            onRemove={(key) => void removePreset(Number(key))}
            removeTitle={t('settingsPage.hapus')}
          />
        )}
        <AddRow
          placeholder={t('settingsPage.mis60')}
          type="number"
          value={presetInput}
          onChange={setPresetInput}
          onCommit={() => void addPreset()}
          addLabel={t('settingsPage.tambah')}
        />
      </div>
    </SettingsCard>
  );
}

/**
 * Toleransi terlambat absensi (L-70). Hanya disimpan di sini; status terlambat
 * dihitung di langkah absensi (L-79). Kosong = 0 menit, tanpa toleransi.
 */
function AttendanceCard() {
  const t = useT();
  const saved = useSessionStore((s) => s.org?.settings?.lateToleranceMinutes);
  const [value, setValue] = useState(() => (typeof saved === 'number' ? String(saved) : ''));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const parsed = parseLateTolerance(value);
    if (!parsed.ok) {
      setError(interpolate(t('settingsPage.toleransiTidakValid'), { n: String(LATE_TOLERANCE_MAX) }));
      return;
    }
    setError('');
    setSaving(true);
    try {
      await setLateToleranceMinutes(parsed.value);
      toast.success(t('settingsPage.toleransiDisimpan'));
    } catch {
      toast.error(t('settingsPage.gagalMenyimpanToleransi'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard icon={<Clock aria-hidden />} title={t('settingsPage.absensiCard')}>
      <Field
        label={t('settingsPage.toleransiTerlambat')}
        hint={t('settingsPage.toleransiHint')}
        error={error || undefined}
        className="max-w-[28ch]"
      >
        <Input
          type="text"
          inputMode="numeric"
          className={NUM}
          maxLength={3}
          placeholder="0"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.replace(/\D/g, '').slice(0, 3));
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
        />
      </Field>
      <SaveFoot>
        <Button onClick={() => void save()} disabled={saving} aria-busy={saving || undefined}>
          {saving && <Spinner />}
          {t('settingsPage.simpanToleransi')}
        </Button>
      </SaveFoot>
    </SettingsCard>
  );
}

/**
 * Per-key WhatsApp message template editor. Saves overrides to orgConfig;
 * blank fields fall back to the built-in default via resolveWaTemplates.
 */
function WhatsAppTemplatesCard() {
  const t = useT();
  const overrides = getWaTemplateOverrides();
  const keys = Object.keys(DEFAULT_WA_TEMPLATES) as WaTemplateKey[];
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const k of keys) init[k] = overrides[k] ?? DEFAULT_WA_TEMPLATES[k];
    return init;
  });

  const [saving, setSaving] = useState(false);
  const [reviewUrl, setReviewUrlDraft] = useState(() => getReviewUrl());
  const [reviewError, setReviewError] = useState('');

  const save = async () => {
    // Link ulasan diperiksa lebih dulu: yang salah tidak menyimpan apa pun,
    // supaya template dan link tak pernah tersimpan setengah.
    const check = validateReviewUrl(reviewUrl);
    if (!check.ok) {
      setReviewError(
        check.reason === 'scheme'
          ? t('settingsPage.linkUlasanHarusHttps')
          : check.reason === 'length'
            ? interpolate(t('settingsPage.linkUlasanTerlaluPanjang'), { n: String(REVIEW_URL_MAX) })
            : t('settingsPage.linkUlasanTidakValid'),
      );
      return;
    }
    setReviewError('');
    const next: Record<string, string> = {};
    for (const k of keys) {
      const v = drafts[k]?.trim();
      // Only persist as override if it differs from default & is non-empty.
      if (v && v !== DEFAULT_WA_TEMPLATES[k]) next[k] = v;
    }
    setSaving(true);
    try {
      await setWaTemplateOverrides(next);
      if (check.value !== getReviewUrl()) await setReviewUrl(check.value);
      toast.success(t('settingsPage.waDanUlasanDisimpan'));
    } catch {
      toast.error(t('settingsPage.gagalMenyimpanTemplateWhatsapp'));
    } finally {
      setSaving(false);
    }
  };

  const resetKey = (k: WaTemplateKey) => {
    setDrafts((d) => ({ ...d, [k]: DEFAULT_WA_TEMPLATES[k] }));
  };

  return (
    <SettingsCard icon={<WhatsAppIcon aria-hidden />} title={t('settingsPage.templateWhatsapp')}>
      <SettingsHint>
        Variabel tersedia:{' '}
        {WA_TEMPLATE_VARS.map((v) => (
          <code key={v} className={VAR}>{`{${v}}`}</code>
        ))}
        <br />
        <code className={VAR}>{`{keluhan}`}</code>, <code className={VAR}>{`{kelengkapan}`}</code>,{' '}
        <code className={VAR}>{`{alamat}`}</code>, <code className={VAR}>{`{garansi}`}</code> dan{' '}
        <code className={VAR}>{`{rincian_bayar}`}</code> membawa barisnya sendiri. Barisnya hilang otomatis kalau datanya
        kosong, jadi tidak perlu ditulis label lagi di depannya.
      </SettingsHint>
      <div className={SETTINGS_GROUP}>
        <Field
          label={t('settingsPage.linkUlasan')}
          hint={t('settingsPage.linkUlasanHint')}
          error={reviewError || undefined}
        >
          <Input
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://g.page/r/..."
            value={reviewUrl}
            onChange={(e) => {
              setReviewUrlDraft(e.target.value);
              setReviewError('');
            }}
          />
        </Field>
      </div>
      {keys.map((k) => (
        <div key={k} className={SETTINGS_GROUP}>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`wa-${k}`} className={SETTINGS_LABEL}>
              {WA_TEMPLATE_LABELS[k]}
            </label>
            <button
              type="button"
              className="rounded-sm text-xs text-muted-foreground underline underline-offset-2 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
              onClick={() => resetKey(k)}
            >
              {t('settingsPage.resetDefault')}
            </button>
          </div>
          <Textarea
            id={`wa-${k}`}
            className="resize-y"
            // Default kini multi-baris — 3 baris memotongnya jadi tak terbaca.
            rows={10}
            value={drafts[k]}
            onChange={(e) => setDrafts((d) => ({ ...d, [k]: e.target.value }))}
          />
        </div>
      ))}
      <SaveFoot>
        <Button onClick={save} disabled={saving} aria-busy={saving || undefined}>
          {saving && <Spinner />}
          {t('settingsPage.simpanTemplate')}
        </Button>
      </SaveFoot>
    </SettingsCard>
  );
}

/** Daftar isian yang bisa dihapus satu per satu (templat, kategori, preset). */
function TagChips({
  items,
  onRemove,
  removeTitle,
  disabled = false,
}: {
  items: { key: string; label: string; removeLabel: string }[];
  onRemove: (key: string) => void;
  removeTitle: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <span
          key={item.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pr-1 pl-3 text-xs font-medium text-secondary-foreground"
        >
          {item.label}
          {/* 20px, area ketuknya 44px di layar sentuh lewat ::after. */}
          <button
            type="button"
            onClick={() => onRemove(item.key)}
            aria-label={item.removeLabel}
            title={removeTitle}
            disabled={disabled}
            className="relative grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-destructive-soft hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [&>svg]:size-3 pointer-coarse:after:absolute pointer-coarse:after:-inset-3"
          >
            <X aria-hidden />
          </button>
        </span>
      ))}
    </div>
  );
}

/** Isian + tombol Tambah; Enter juga menambah. */
function AddRow({
  placeholder,
  value,
  onChange,
  onCommit,
  addLabel,
  type,
  disabled = false,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  addLabel: string;
  type?: 'number';
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="min-w-[140px] flex-1">
        <TextInput
          type={type}
          inputMode={type === 'number' ? 'numeric' : undefined}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCommit()}
          disabled={disabled}
          aria-label={placeholder}
        />
      </div>
      <Button onClick={onCommit} disabled={disabled}>
        <Plus aria-hidden />
        {addLabel}
      </Button>
    </div>
  );
}

// Angka di kotak isian juga mono.
const NUM = 'font-mono tabular-nums placeholder:font-sans';
const VAR = 'mr-1 mb-1 inline-block rounded-md bg-secondary px-1.5 font-mono text-xs text-secondary-foreground';
