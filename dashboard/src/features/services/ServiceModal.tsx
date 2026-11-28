import { useState } from 'react';
import { LoaderCircle, Plus } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Field, FormMessage } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { useFormFault } from '@/hooks/useFormFault';
import { repository } from '@/data';
import { newId, nextDocNumber } from '@/lib/id';
import { fmtRpInput, parseRpInput } from '@/lib/format';
import { findByPhone, searchCustomers } from '@/lib/business/customers';
import { logActivity } from '@/lib/activity';
import { getCategories, getComplaintTemplates, getAccessoryTemplates } from '@/config/orgConfig';
import { toast } from '@/stores/toast';
import { useSessionStore, resolveCreateOutlet, mustPickOutlet } from '@/stores/session';
import { useCollection } from '@/hooks/useCollection';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import { useResetOnOpen } from '@/hooks/useResetOnOpen';
import { isSupabaseConfigured } from '@/data/supabase-client';
import { trackEvent } from '@/lib/analytics';
import { useDemoStore } from '@/stores/demo';
import type { Service, Customer, Employee, ScreenLockKind } from '@/data/types';
import type { TranslationKey } from '@/i18n';
import { saveScreenLock } from '@/data/serviceSecret';
import { useT } from '@/i18n';
import { interpolate } from '@/lib/business/notify';
import { currentTerms } from '@/lib/business/serviceTerms';
import { canEditServiceIdentity } from '@/lib/business/staffAccess';
import { useListNav } from '@/hooks/useListNav';

interface IntakeDraft {
  customerName: string;
  customerPhone: string;
  category: string;
  device: string;
  complaint: string;
  accessories: string;
  technicianId: string;
  estimateCost: string;
  outletId: string;
  deviceSerial: string;
  deviceCondition: string;
  // Jenis saja — isi kunci layar sengaja TIDAK ikut draf.
  lockKind: ScreenLockKind | '';
}

/** Pilihan cepat kondisi fisik; teksnya ikut tersimpan di tiket (data, bukan label UI). */
const CONDITION_CHIPS: TranslationKey[] = [
  'serviceForm.condNormal',
  'serviceForm.condScratch',
  'serviceForm.condCracked',
  'serviceForm.condDent',
  'serviceForm.condWater',
];

// Isian tiket BARU yang ditutup tanpa disimpan (Esc, ketuk latar, Batal). Dulu
// hilang seketika — di meja konter itu berarti mengetik ulang semuanya sementara
// pelanggan menunggu. Hanya di memori: hilang saat halaman dimuat ulang.
let intakeDraft: IntakeDraft | null = null;

interface ServiceModalProps {
  open: boolean;
  onClose: () => void;
  editing: Service | null;
  services: Service[];
  employees: Employee[];
  /** `created` terisi hanya saat tiket BARU dibuat (panel tanda terima). */
  onSaved: (created?: Service) => void;
}

export function ServiceModal({
  open,
  onClose,
  editing,
  services,
  employees,
  onSaved,
}: ServiceModalProps) {
  const org = useSessionStore((s) => s.org);
  const me = useSessionStore((s) => s.currentEmployee);
  // Teknisi yang mengubah tiketnya mendapat formulir terbatas: tanpa nama dan nomor WA
  // pelanggan, tanpa pilihan teknisi (P18.3). Tiket tak lagi menyentuh tabel pelanggan.
  const identityLocked = !!editing && !canEditServiceIdentity(me?.role);
  const { data: outlets } = useCollection('outlets');
  // Pelanggan tidak lagi dimuat utuh. Di cloud, kotak saran dan pemeriksaan
  // duplikat memakai query bertarget; adapter lokal tetap memakai daftar penuh
  // karena di sana tidak ada ongkos egress. `enabled: false` membuat hook ini
  // TIDAK memicu pengambilan di cloud, tapi tetap membaca cache bila halaman
  // lain kebetulan sudah memuatnya.
  const serverSearch = !!repository.queryCustomers;
  const { data: localCustomers } = useCollection('customers', { enabled: !serverSearch && !identityLocked });
  const categories = getCategories();
  const complaintTemplates = getComplaintTemplates();
  const accessoryTemplates = getAccessoryTemplates();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  // Kosong, bukan kategori pertama: dulu "Redmi Note 12" diam-diam tersimpan sebagai Laptop.
  const [category, setCategory] = useState('');
  const [device, setDevice] = useState('');
  const [complaint, setComplaint] = useState('');
  const [accessories, setAccessories] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');
  const [deviceCondition, setDeviceCondition] = useState('');
  const [lockKind, setLockKind] = useState<ScreenLockKind | ''>('');
  const [lockSecret, setLockSecret] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [estimateCost, setEstimateCost] = useState('');
  const [outletId, setOutletId] = useState('');
  const { error, setError, fail, invalid } = useFormFault<'name' | 'phone' | 'device' | 'category' | 'outlet' | 'lock'>();
  const [busy, setBusy] = useState(false);
  const t = useT();
  const allowedOutletIds = useSessionStore((s) => s.allowedOutletIds);
  // Pengguna multi-cabang di "Semua Outlet" wajib memilih cabang. Dulu hanya
  // diberitahu SETELAH Simpan, dengan petunjuk ke sidebar yang tertutup jendela
  // ini — dan isiannya hilang saat jendela ditutup untuk mencarinya.
  const needOutlet = !editing && mustPickOutlet(outlets.length);
  const outletOptions = outlets
    .filter((o) => allowedOutletIds.length === 0 || allowedOutletIds.includes(o.id))
    .map((o) => ({ value: o.id, label: o.name }));

  const snapshot = (): IntakeDraft => ({
    customerName,
    customerPhone,
    category,
    device,
    complaint,
    accessories,
    technicianId,
    estimateCost,
    outletId,
    deviceSerial,
    deviceCondition,
    lockKind,
  });
  const hasContent = [customerName, customerPhone, device, complaint, accessories, estimateCost].some((v) =>
    v.trim(),
  );
  const applyDraft = (d: IntakeDraft | null) => {
    setCustomerName(d?.customerName ?? '');
    setCustomerPhone(d?.customerPhone ?? '');
    setCategory(d?.category ?? '');
    setDevice(d?.device ?? '');
    setComplaint(d?.complaint ?? '');
    setAccessories(d?.accessories ?? '');
    setTechnicianId(d?.technicianId ?? '');
    setEstimateCost(d?.estimateCost ?? '');
    setOutletId(d?.outletId ?? '');
    setDeviceSerial(d?.deviceSerial ?? '');
    setDeviceCondition(d?.deviceCondition ?? '');
    setLockKind(d?.lockKind ?? '');
    setLockSecret('');
    setError('');
  };
  const close = () => {
    if (!editing) intakeDraft = hasContent ? snapshot() : null;
    onClose();
  };
  // Quick-suggest: which customer field is active (drives the dropdown). Only
  // for NEW services — picking an existing customer here is the main way to
  // avoid near-duplicate records from re-typing a slightly different name.
  const [suggestField, setSuggestField] = useState<'name' | 'phone' | null>(null);

  // Servis baru selalu mulai kosong; mode edit mencerminkan recordnya.
  useResetOnOpen(open, editing?.id ?? 'new', () => {
    setSuggestField(null);
    if (!editing) {
      applyDraft(intakeDraft);
      return;
    }
    applyDraft({
      customerName: editing.customerName,
      customerPhone: editing.customerPhone,
      category: editing.category,
      device: editing.device,
      complaint: editing.complaint,
      accessories: editing.accessories,
      technicianId: editing.technicianId ?? '',
      estimateCost: editing.estimateCost ? fmtRpInput(String(editing.estimateCost)) : '',
      outletId: '',
      deviceSerial: editing.deviceSerial ?? '',
      deviceCondition: editing.deviceCondition ?? '',
      lockKind: editing.secretKind ?? '',
    });
  });

  const technicianOptions = [
    { value: '', label: t('serviceForm.techUnset') },
    ...employees.map((e) => ({ value: e.id, label: e.name })),
  ];

  const suggestTerm = suggestField === 'name' ? customerName : customerPhone;
  const { results: remoteMatches } = useCustomerSearch({
    enabled: !editing && !!suggestField,
    term: suggestTerm,
  });
  // `searchCustomers` tetap yang memutuskan — server hanya mempersempit
  // kandidat, jadi aturan pencocokan tidak terduplikasi ke SQL.
  const suggestions =
    !editing && suggestField
      ? searchCustomers(serverSearch ? remoteMatches : localCustomers, suggestTerm)
      : [];

  const pickCustomer = (c: Customer) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setSuggestField(null);
  };

  // Close the dropdown on blur, but defer so a suggestion click registers first.
  // Compares against the field that blurred so moving focus name→phone is safe.
  const hideSuggest = (field: 'name' | 'phone') =>
    window.setTimeout(() => setSuggestField((f) => (f === field ? null : f)), 150);

  const nav = useListNav(suggestions.length, (i) => pickCustomer(suggestions[i]));
  const suggestList = suggestions.length > 0 && (
    <div
      className="absolute inset-x-0 top-[calc(100%+4px)] z-20 max-h-58 overflow-y-auto rounded-xl bg-popover p-1 text-popover-foreground shadow-raised ring-1 ring-border/70"
      role="listbox"
      id="intake-customer-suggest"
    >
      <span className="block px-2 pb-1.5 pt-1 text-xs text-muted-foreground">{t('serviceForm.suggestHint')}</span>
      {suggestions.map((c, i) => (
        <button
          type="button"
          key={c.id}
          id={`intake-cust-${i}`}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-accent aria-selected:bg-accent pointer-coarse:min-h-11"
          role="option"
          aria-selected={i === nav.active}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pickCustomer(c)}
        >
          <span className="text-sm font-medium text-foreground">{c.name}</span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">{c.phone}</span>
        </button>
      ))}
    </div>
  );
  // Kolom nama dan nomor berbagi satu daftar saran; atributnya sama.
  const comboProps = (field: 'name' | 'phone') => ({
    role: 'combobox' as const,
    'aria-autocomplete': 'list' as const,
    'aria-expanded': suggestField === field && suggestions.length > 0,
    'aria-controls': 'intake-customer-suggest',
    'aria-activedescendant': suggestField === field && nav.active >= 0 ? `intake-cust-${nav.active}` : undefined,
    onKeyDown: nav.onKeyDown,
    onFocus: () => setSuggestField(field),
    onBlur: () => hideSuggest(field),
  });

  // Pilihan cepat di bawah kolom teks: ketuk untuk menambahkan, dipisah koma.
  const quickChips = (label: string, items: string[], onPick: (v: string) => void) => (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className="w-full text-xs text-muted-foreground">{label}</span>
      {items.map((tpl) => (
        <button
          type="button"
          key={tpl}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border bg-surface px-2.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:border-solid hover:border-primary/40 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 [&_svg]:size-3"
          onClick={() => onPick(tpl)}
        >
          <Plus aria-hidden /> {tpl}
        </button>
      ))}
    </div>
  );

  /** Append a template snippet to a field, comma-joining when non-empty. */
  const appendToField = (
    current: string,
    snippet: string,
    setter: (v: string) => void,
  ) => {
    const trimmed = current.trim();
    setter(trimmed ? `${trimmed}, ${snippet}` : snippet);
  };

  const save = async () => {
    if (!identityLocked && !customerName.trim()) return fail('name', t('serviceForm.nameRequired'));
    if (!identityLocked && !customerPhone.trim()) return fail('phone', t('serviceForm.phoneRequired'));
    if (!device.trim()) return fail('device', t('serviceForm.deviceRequired'));
    if (categories.length && !category) return fail('category', t('serviceForm.categoryRequired'));
    // OQ-C (same guard as PosPage/EntryModal): a multi-outlet user must pick a
    // branch first so the ticket isn't silently stamped to the primary outlet.
    if (needOutlet && !outletId) return fail('outlet', t('serviceForm.outletRequired'));
    // Jenis dipilih tanpa isi = lupa mengetik. Saat edit, kosong berarti "tetap".
    if (lockKind && !lockSecret.trim() && !(editing?.secretKind === lockKind)) {
      return fail('lock', t('serviceForm.lockRequired'));
    }

    setBusy(true);
    const now = new Date().toISOString();
    const orgId = org?.id ?? '';

    let created: Service | null = null;
    try {
      // Link or create the customer by phone.
      // Kandidat diambil bertarget per nomor. Filternya longgar dan mencakup
      // bentuk 0 maupun 62 (phoneLookupFilter) — kekurangan cocok di sini
      // berarti pelanggan GANDA, bug yang membuat FULL_LIST ada.
      let customer: Customer | null = null;
      if (!identityLocked) {
        const candidates = repository.queryCustomers
          ? await repository.queryCustomers({ phone: customerPhone, limit: 50 })
          : localCustomers;
        customer = findByPhone(candidates, customerPhone);
        if (!customer) {
          customer = {
            id: newId(),
            orgId,
            outletId: null,
            name: customerName.trim(),
            phone: customerPhone.trim(),
            email: '',
            address: '',
            note: '',
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          };
          await repository.put('customers', customer);
        } else if (editing && customer.id === editing.customerId && customer.name !== customerName.trim()) {
          // Nama dikoreksi dari tiket → kartu pelanggannya ikut, supaya tidak berbeda
          // dengan menu Pelanggan. Hanya pelanggan tiket ini sendiri: nomor yang
          // ternyata milik pelanggan lain tidak diganti namanya.
          customer = { ...customer, name: customerName.trim(), updatedAt: now };
          await repository.put('customers', customer);
        }
      }

      const tech = employees.find((e) => e.id === technicianId);

      if (editing) {
        // Hanya kolom form: status, DP, biaya, dan sparepart bisa saja berubah di
        // perangkat lain selama form terbuka, dan tidak boleh tertimpa salinan ini.
        await repository.patch('services', editing.id, {
          ...(customer
            ? { customerId: customer.id, customerName: customerName.trim(), customerPhone: customerPhone.trim() }
            : {}),
          category,
          device: device.trim(),
          complaint: complaint.trim(),
          accessories: accessories.trim(),
          deviceSerial: deviceSerial.trim(),
          deviceCondition: deviceCondition.trim(),
          ...(identityLocked ? {} : { technicianId: technicianId || null, technicianName: tech?.name ?? '' }),
          estimateCost: parseRpInput(estimateCost),
          updatedAt: now,
          history: [
            ...(editing.history ?? []),
            {
              at: now,
              status: 'edit',
              by: me?.id ?? '',
              byName: me?.name ?? '',
              note: 'Data servis diperbarui',
              internal: true,
            },
          ],
        });
        if (!editing.pickedUp) {
          if (!lockKind && editing.secretKind) await saveScreenLock(editing, editing.secretKind, '');
          else if (lockKind && lockSecret.trim()) await saveScreenLock(editing, lockKind, lockSecret);
        }
        toast.success(t('serviceForm.updated'));
      } else {
        // Tiket baru hanya dibuat Admin/Pemilik, yang selalu lewat langkah pelanggan di atas.
        if (!customer) throw new Error('Pelanggan tiket baru tidak terbentuk');
        const serviceNo = nextDocNumber(
          org?.servicePrefix ?? 'FM',
          services.map((s) => s.serviceNo),
        );
        const record: Service = {
          id: newId(),
          orgId,
          outletId: needOutlet ? outletId : resolveCreateOutlet(outlets),
          serviceNo,
          customerId: customer.id,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          category,
          device: device.trim(),
          complaint: complaint.trim(),
          accessories: accessories.trim(),
          deviceSerial: deviceSerial.trim(),
          deviceCondition: deviceCondition.trim(),
          secretKind: null,
          status: 'diterima',
          technicianId: technicianId || null,
          technicianName: tech?.name ?? '',
          estimateCost: parseRpInput(estimateCost),
          finalCost: 0,
          downPayment: 0,
          spareparts: [],
          warrantyServiceUntil: null,
          warrantyPartsUntil: null,
          pickedUp: false,
          pickedUpAt: null,
          warrantyClaimOf: null,
          history: [
            {
              at: now,
              status: 'diterima',
              by: me?.id ?? '',
              byName: me?.name ?? '',
              note: 'Unit diterima',
              internal: false,
              // S&K yang disetujui saat unit dititipkan. Di riwayat, yang append-only
              // di server, jadi perubahan S&K toko sesudahnya tak menyentuh tiket ini.
              terms: currentTerms(org?.settings?.terms),
            },
          ],
          archived: false,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        // Nomor usulan bisa diganti server bila bentrok (0061), jadi pesan & log
        // memakai nomor yang benar-benar tersimpan.
        const saved = await repository.put('services', record);
        created = saved;
        // Kunci layar disimpan terpisah (0094). Gagal di sini tidak membatalkan
        // tiket yang sudah tersimpan — cukup diberi tahu, bisa diulang dari Edit.
        if (lockKind && lockSecret.trim()) {
          try {
            await saveScreenLock(saved, lockKind, lockSecret);
            created = { ...saved, secretKind: lockKind };
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('serviceForm.lockFailed'));
          }
        }
        if (services.length === 0 && !useDemoStore.getState().isDemo) {
          trackEvent('first_service_created', {
            workspace_mode: isSupabaseConfigured ? 'cloud' : 'local',
          });
        }
        logActivity({
          action: 'service.create',
          entityType: 'service',
          entityId: record.id,
          entityLabel: saved.serviceNo,
          meta: { device: record.device, customer: record.customerName },
        });
        toast.success(interpolate(t('serviceForm.created'), { no: saved.serviceNo }));
        intakeDraft = null;
      }
      onSaved(created ?? undefined);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('serviceForm.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  // Dua kolom selama jendela cukup lebar (container query: zoom aplikasi ikut dihitung).
  const row = 'grid gap-4 @lg/form:grid-cols-2';

  return (
    <FormDialog
      open={open}
      onClose={close}
      title={editing ? interpolate(t('serviceForm.editTitle'), { no: editing.serviceNo }) : t('serviceForm.newTitle')}
      size="lg"
      footer={
        <>
          {!editing && hasContent && (
            <Button
              variant="ghost"
              className="mr-auto compact:mr-0"
              onClick={() => {
                intakeDraft = null;
                applyDraft(null);
              }}
            >
              {t('serviceForm.clear')}
            </Button>
          )}
          <Button variant="outline" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="service-intake" disabled={busy}>
            {busy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {t('common.save')}
          </Button>
        </>
      }
    >
      {/* <form>: Enter di field satu baris menyimpan (Keluhan tetap baris baru). */}
      <form
        id="service-intake"
        className="@container/form grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <FormMessage>{error}</FormMessage>
        {needOutlet && (
          <Field label={t('serviceForm.outlet')} invalid={invalid('outlet')}>
            <SelectBox
              value={outletId}
              onValueChange={(v) => {
                setOutletId(v);
                setError('');
              }}
              options={outletOptions}
              placeholder={t('serviceForm.outletPlaceholder')}
              data-autofocus
            />
          </Field>
        )}
        {!identityLocked && (
          <div className={row}>
            <div className="relative">
              <Field label={t('serviceForm.customerName')} invalid={invalid('name')}>
                <TextInput
                  capitalize="words"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setSuggestField('name');
                  }}
                  {...comboProps('name')}
                  data-autofocus={!needOutlet || undefined}
                />
              </Field>
              {suggestField === 'name' && suggestList}
            </div>
            <div className="relative">
              <Field label={t('serviceForm.customerPhone')} invalid={invalid('phone')}>
                <TextInput
                  capitalize="none"
                  inputMode="tel"
                  className="font-mono placeholder:font-sans"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    setSuggestField('phone');
                  }}
                  {...comboProps('phone')}
                />
              </Field>
              {suggestField === 'phone' && suggestList}
            </div>
          </div>
        )}
        <div className={row}>
          <Field label={t('serviceForm.category')} invalid={invalid('category')}>
            <SelectBox
              value={category}
              onValueChange={setCategory}
              options={categories.map((c) => ({ value: c, label: c }))}
              placeholder={t(categories.length ? 'serviceForm.categoryPh' : 'serviceForm.noCategory')}
            />
          </Field>
          <Field label={t('serviceForm.device')} invalid={invalid('device')}>
            <TextInput
              capitalize="words"
              placeholder={t('serviceForm.devicePh')}
              value={device}
              onChange={(e) => setDevice(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t('serviceForm.serial')}>
          <TextInput
            capitalize="none"
            className="font-mono placeholder:font-sans"
            placeholder={t('serviceForm.serialPh')}
            value={deviceSerial}
            spellCheck={false}
            onChange={(e) => setDeviceSerial(e.target.value)}
          />
        </Field>
        <div>
          <Field label={t('serviceForm.complaint')}>
            <TextInput
              placeholder={t('serviceForm.complaintPh')}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
            />
          </Field>
          {complaintTemplates.length > 0 &&
            quickChips(t('serviceForm.complaintQuick'), complaintTemplates, (tpl) =>
              appendToField(complaint, tpl, setComplaint),
            )}
        </div>
        <div>
          <Field label={t('serviceForm.accessories')}>
            <TextInput
              placeholder={t('serviceForm.accessoriesPh')}
              value={accessories}
              onChange={(e) => setAccessories(e.target.value)}
            />
          </Field>
          {accessoryTemplates.length > 0 &&
            quickChips(t('serviceForm.accessoriesQuick'), accessoryTemplates, (tpl) =>
              appendToField(accessories, tpl, setAccessories),
            )}
        </div>
        <div>
          <Field label={t('serviceForm.condition')}>
            <TextInput
              placeholder={t('serviceForm.conditionPh')}
              value={deviceCondition}
              onChange={(e) => setDeviceCondition(e.target.value)}
            />
          </Field>
          {quickChips(
            t('serviceForm.conditionQuick'),
            CONDITION_CHIPS.map((k) => t(k)),
            (text) => appendToField(deviceCondition, text, setDeviceCondition),
          )}
        </div>
        {/* Kunci layar: tidak ditawarkan lagi setelah unit diambil (sudah dihapus server). */}
        {!editing?.pickedUp && (
          <div className={row}>
            <Field label={t('serviceForm.lockKind')}>
              <SelectBox
                value={lockKind}
                onValueChange={(v) => {
                  setLockKind(v as ScreenLockKind | '');
                  setLockSecret('');
                }}
                options={[
                  { value: '', label: t('serviceForm.lockNone') },
                  { value: 'pin', label: t('serviceForm.lock_pin') },
                  { value: 'pola', label: t('serviceForm.lock_pola') },
                  { value: 'sandi', label: t('serviceForm.lock_sandi') },
                ]}
              />
            </Field>
            {lockKind && (
              <Field label={t('serviceForm.lockValue')} invalid={invalid('lock')} hint={t('serviceForm.lockHint')}>
                <TextInput
                  capitalize="none"
                  className="font-mono placeholder:font-sans"
                  value={lockSecret}
                  onChange={(e) => setLockSecret(e.target.value)}
                  inputMode={lockKind === 'sandi' ? 'text' : 'numeric'}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={64}
                  data-1p-ignore
                  data-lpignore="true"
                  placeholder={
                    editing?.secretKind === lockKind
                      ? t('serviceForm.lockKeep')
                      : lockKind === 'pola'
                        ? t('serviceForm.lockPolaPh')
                        : ''
                  }
                />
              </Field>
            )}
          </div>
        )}
        <div className={row}>
          {!identityLocked && (
            <Field label={t('serviceForm.technician')}>
              <SelectBox value={technicianId} onValueChange={setTechnicianId} options={technicianOptions} />
            </Field>
          )}
          <Field label={t('serviceForm.estimate')}>
            <TextInput
              capitalize="none"
              inputMode="numeric"
              className="font-mono tabular-nums placeholder:font-sans"
              placeholder="150.000"
              value={estimateCost}
              onChange={(e) => setEstimateCost(fmtRpInput(e.target.value))}
            />
          </Field>
        </div>
      </form>
    </FormDialog>
  );
}
