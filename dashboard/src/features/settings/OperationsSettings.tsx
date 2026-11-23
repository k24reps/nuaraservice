import { useEffect, useState } from 'react';
import { ClipboardList, Columns3, Laptop, LoaderCircle, Plus, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Checkbox } from '@/components/dens/checkbox';
import { Field } from '@/components/dens/field';
import { Input } from '@/components/dens/input';
import { TextInput } from '@/components/dens/text-input';
import { Textarea } from '@/components/dens/textarea';
import { WhatsAppIcon } from '@/components/dens/whatsapp-icon';
import {
  getComplaintTemplates,
  setComplaintTemplates,
  getAccessoryTemplates,
  setAccessoryTemplates,
  getWarrantyServiceDays,
  getWarrantyPartsDays,
  setWarrantyDays,
  getWarrantyPresets,
  setWarrantyPresets,
  getWaTemplateOverrides,
  setWaTemplateOverrides,
  getCategories,
  setCategories,
  seedCategoriesFromLocal,
  saveServiceColumns,
} from '@/config/orgConfig';
import {
  DEFAULT_WA_TEMPLATES,
  WA_TEMPLATE_LABELS,
  WA_TEMPLATE_VARS,
  type WaTemplateKey,
} from '@/lib/business/notify';
import { SERVICE_COLUMNS, resolveServiceColumns, type ServiceColumnId } from '@/lib/business/serviceColumns';
import { useT } from '@/i18n';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import { SETTINGS_GROUP, SETTINGS_LABEL, SaveFoot, SettingsCard, SettingsHint, SettingsSection } from './settingsUi';

/** Tab Operasional (L-55): pilihan cepat form servis, kolom tabel, garansi, templat WhatsApp. */
export function OperationsSettings() {
  return (
    <SettingsSection>
      <ServiceTemplatesCard />
      <DeviceCategoriesCard />
      <ServiceColumnsCard />
      <WarrantyCard />
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
function ServiceTemplatesCard() {
  const t = useT();
  const [complaints, setComplaints] = useState<string[]>(() => getComplaintTemplates());
  const [accessories, setAccessories] = useState<string[]>(() => getAccessoryTemplates());
  const [busy, setBusy] = useState(false);

  // Template kini tersimpan di baris organisasi (tersinkron), jadi penyimpanan
  // bisa gagal — daftar di layar hanya berubah setelah servernya menerima.
  const persist = async (next: string[], save: (v: string[]) => Promise<void>, apply: (v: string[]) => void) => {
    setBusy(true);
    try {
      await save(next);
      apply(next);
    } catch {
      toast.error(t('settingsPage.gagalMenyimpanTemplate'));
    } finally {
      setBusy(false);
    }
  };

  const addComplaint = (value: string) =>
    void persist([...complaints, value], setComplaintTemplates, setComplaints);
  const removeComplaint = (value: string) =>
    void persist(complaints.filter((c) => c !== value), setComplaintTemplates, setComplaints);
  const addAccessory = (value: string) =>
    void persist([...accessories, value], setAccessoryTemplates, setAccessories);
  const removeAccessory = (value: string) =>
    void persist(accessories.filter((a) => a !== value), setAccessoryTemplates, setAccessories);

  return (
    <SettingsCard icon={<ClipboardList aria-hidden />} title={t('settingsPage.templateServis')}>
      <SettingsHint>Pilihan cepat keluhan &amp; kelengkapan saat membuat servis baru.</SettingsHint>
      <StringListEditor
        label={t('settingsPage.templateKeluhan')}
        placeholder={t('settingsPage.misMatiTotal')}
        items={complaints}
        onAdd={addComplaint}
        onRemove={removeComplaint}
        disabled={busy}
      />
      <StringListEditor
        label={t('settingsPage.templateKelengkapan')}
        placeholder={t('settingsPage.misCharger')}
        items={accessories}
        onAdd={addAccessory}
        onRemove={removeAccessory}
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

  const save = async () => {
    const next: Record<string, string> = {};
    for (const k of keys) {
      const v = drafts[k]?.trim();
      // Only persist as override if it differs from default & is non-empty.
      if (v && v !== DEFAULT_WA_TEMPLATES[k]) next[k] = v;
    }
    setSaving(true);
    try {
      await setWaTemplateOverrides(next);
      toast.success(t('settingsPage.templateWhatsappDisimpan'));
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
