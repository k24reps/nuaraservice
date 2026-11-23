import { useRef, useState } from 'react';
import { LoaderCircle, Store, Target, Trash2, Upload } from 'lucide-react';
import { EmptyValue } from '@/components/ui/EmptyValue';
import { Button } from '@/components/dens/button';
import { Field } from '@/components/dens/field';
import { Input } from '@/components/dens/input';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { useCollection } from '@/hooks/useCollection';
import { repository } from '@/data';
import { fmtRp, fmtRpInput, parseRpInput } from '@/lib/format';
import { getRent, getTarget, setMonthlyTarget, setRent } from '@/config/orgConfig';
import { normalizePhone } from '@/lib/business/customers';
import { interpolate } from '@/lib/business/notify';
import { logActivity } from '@/lib/activity';
import { translate, useT } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useSessionStore } from '@/stores/session';
import { demoGuard } from '@/stores/demo';
import { toast } from '@/stores/toast';
import { uploadOrgLogo, removeOrgLogo } from '@/data/storage';
import type { OutletRent } from '@/data/types';
import { SaveFoot, SettingsCard, SettingsHint, SettingsSection } from './settingsUi';

/** Tab Usaha (L-55): profil toko, lalu target bulanan dan sewa untuk pemilik. */
export function BusinessSettings({ isOwner }: { isOwner: boolean }) {
  return (
    <SettingsSection>
      <BusinessTab />
      {isOwner && <MonthlyTargetCard />}
      {isOwner && <RentCard />}
    </SettingsSection>
  );
}

const Spinner = () => <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />;

/**
 * Downscale a picked image to a PNG Blob (max 256 px) without using
 * fetch(data:URL) — that call is blocked by CSP connect-src in production.
 * Uses canvas.toBlob() directly instead.
 */
async function fileToLogoBlob(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  // Logo yang sangat memanjang dikecilkan jadi seutas garis di nota dan di
  // sidebar — ukurannya lolos (≤500KB), hasilnya yang tidak terbaca.
  const ratio = Math.max(img.width, img.height) / Math.max(1, Math.min(img.width, img.height));
  if (ratio > 4) {
    // Di luar komponen: tak ada hook, jadi bahasa dibaca langsung dari store.
    throw new Error(translate(useSettingsStore.getState().language, 'settingsPage.logoRatio'));
  }
  const MAX = 256;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // Fallback: if canvas context unavailable, upload original file as-is.
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/png',
    ),
  );
}

function BusinessTab() {
  const t = useT();
  const org = useSessionStore((s) => s.org);
  const setOrg = useSessionStore((s) => s.setOrg);
  const [name, setName] = useState(org?.name ?? '');
  const [address, setAddress] = useState(org?.address ?? '');
  const [phone, setPhone] = useState(org?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Sama dengan Target dan Sewa: tombol simpan hanya menyala bila ada yang
  // berubah. Dulu tab Usaha membuka dengan tiga tombol amber sekaligus.
  const dirty =
    name.trim() !== (org?.name ?? '') ||
    address.trim() !== (org?.address ?? '') ||
    phone.trim() !== (org?.phone ?? '');

  const save = async () => {
    if (!org) return;
    // Nama, alamat, dan telepon ini tercetak di nota yang dibawa pulang
    // pelanggan dan tampil di halaman lacak publik — dulu ketiganya diterima
    // apa adanya, termasuk nomor yang jelas bukan nomor.
    if (!name.trim()) return toast.error(t('settingsPage.namaUsahaWajibDiisi'));
    if (name.trim().length > 60) return toast.error(t('settingsPage.namaUsahaTerlaluPanjang'));
    if (address.trim().length > 160)
      return toast.error(t('settingsPage.alamatTerlaluPanjangUntuk'));
    if (phone.trim() && normalizePhone(phone).length < 8)
      return toast.error(t('settingsPage.noTeleponTidakValid'));

    setBusy(true);
    const updated = {
      ...org,
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
    };
    try {
      await repository.setSingleton('organization', updated);
      setOrg(updated);
      logActivity({
        action: 'settings.update',
        entityType: 'organization',
        entityId: org.id,
        entityLabel: updated.name,
        meta: { address: updated.address, phone: updated.phone },
      });
      toast.success(t('settingsPage.profilUsahaDisimpan'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.profileFailed'));
    } finally {
      setBusy(false);
    }
  };

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || !org) return;
    if (!file.type.startsWith('image/')) return toast.error(t('settingsPage.fileHarusBerupaGambar'));
    if (file.size > 500 * 1024) return toast.error(t('settingsPage.ukuranLogoMaksimal500kb'));
    try {
      // Downscale to PNG Blob via canvas (no fetch(data:URL) — CSP blocks it).
      // Cloud mode: uploads to `org-logos` bucket, returns public CDN URL.
      // Local mode: falls back to a data URL stored in the org row.
      const blob = await fileToLogoBlob(file);
      const logoDataUrl = await uploadOrgLogo(org.id, blob);
      const updated = { ...org, logoDataUrl };
      await repository.setSingleton('organization', updated);
      setOrg(updated);
      toast.success(t('settingsPage.logoDiperbarui'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Gagal upload logo: ${msg}`);
      console.error('[logo upload]', err);
    }
  };

  const removeLogo = async () => {
    if (!org) return;
    try {
      await removeOrgLogo(org.id); // delete bucket objects in cloud mode
    } catch {
      // Non-critical: still clear the reference below even if delete failed.
    }
    const updated = { ...org, logoDataUrl: null };
    await repository.setSingleton('organization', updated);
    setOrg(updated);
    toast.success(t('settingsPage.logoDihapus'));
  };

  return (
    <SettingsCard icon={<Store aria-hidden />} title={t('settingsPage.profilUsaha')}>
      {/* Dua kolom; satu kolom di wadah sempit (FixMaster: @media 640px). */}
      <div className="grid max-w-[960px] grid-cols-2 items-start gap-4 @max-[609px]/settings:grid-cols-1">
        <div className="col-span-full flex items-center gap-4 rounded-xl bg-surface p-3 ring-1 ring-border/60">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary ring-1 ring-border [&>img]:size-full [&>img]:object-cover">
            {org?.logoDataUrl ? (
              <img src={org.logoDataUrl} alt="Logo toko" />
            ) : (
              <span className="text-2xl font-bold">{(org?.name ?? 'F').charAt(0).toUpperCase()}</span>
            )}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <strong className="text-sm font-semibold">{t('settingsPage.logoToko')}</strong>
            <small className="text-xs text-muted-foreground">{t('settingsPage.pngJpgMaks500kb')}</small>
            <small className="text-xs text-muted-foreground">{t('settingsPage.logoPrintBw')}</small>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload aria-hidden />
                {org?.logoDataUrl ? t('settingsPage.changeLogo') : t('settingsPage.uploadLogo')}
              </Button>
              {org?.logoDataUrl && (
                <Button variant="ghost" size="sm" onClick={removeLogo}>
                  <Trash2 aria-hidden />
                  {t('settingsPage.hapus')}
                </Button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickLogo} hidden />
          </div>
        </div>
        <Field label={t('settingsPage.namaUsaha')}>
          <TextInput capitalize="words" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('settingsPage.alamat')}>
          <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label={t('settingsPage.noTelepon')}>
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <SaveFoot>
        <Button onClick={save} disabled={busy || !dirty} aria-busy={busy || undefined}>
          {busy && <Spinner />}
          {t('settingsPage.simpanPerubahan')}
        </Button>
      </SaveFoot>
    </SettingsCard>
  );
}

/**
 * Target bulanan (Dashboard). Wizard onboarding berjanji "bisa diubah nanti",
 * tapi sampai 28 Sep 2026 tak ada tempat untuk mengubahnya. Isian anggaran
 * overhead ditiadakan 29 Sep 2026: break-even kini membaca catatan Keuangan.
 */
function MonthlyTargetCard() {
  const t = useT();
  const current = getTarget();
  const [revenue, setRevenue] = useState(() => (current.revenue ? fmtRpInput(String(current.revenue)) : ''));
  const [units, setUnits] = useState(() => (current.serviceCount ? String(current.serviceCount) : ''));
  const [busy, setBusy] = useState(false);
  const next = {
    revenue: parseRpInput(revenue),
    serviceCount: Math.max(0, parseInt(units.replace(/\D/g, ''), 10) || 0),
    // Angka lama toko yang dulu mengisinya dibiarkan; tak dibaca lagi.
    overheadBudget: current.overheadBudget,
  };
  const dirty = next.revenue !== current.revenue || next.serviceCount !== current.serviceCount;

  const save = async () => {
    if (demoGuard()) return;
    setBusy(true);
    try {
      await setMonthlyTarget(next);
      toast.success(t('settingsPage.targetBulananDisimpan'));
    } catch {
      toast.error(t('settingsPage.gagalMenyimpanTarget'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard icon={<Target aria-hidden />} title={t('settingsPage.targetBulanan')}>
      <SettingsHint className="mb-3">{t('settingsPage.pDipakaiGaugeTargetDi')}</SettingsHint>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
        <Field label={t('settingsPage.targetPendapatanBulan')}>
          <Input
            inputMode="numeric"
            className={NUM}
            value={revenue}
            onChange={(e) => setRevenue(fmtRpInput(e.target.value))}
            placeholder="50.000.000"
          />
        </Field>
        <Field label={t('settingsPage.targetUnitServisSelesai')}>
          <Input
            inputMode="numeric"
            className={NUM}
            value={units}
            onChange={(e) => setUnits(e.target.value.replace(/\D/g, ''))}
            placeholder="60"
          />
        </Field>
      </div>
      <SaveFoot>
        <Button onClick={save} disabled={busy || !dirty} aria-busy={busy || undefined}>
          {busy && <Spinner />}
          {t('settingsPage.simpanTarget')}
        </Button>
      </SaveFoot>
    </SettingsCard>
  );
}

/**
 * Sewa tempat per cabang untuk overhead Laporan. Bulanan = dari catatan Sewa di
 * Keuangan; tahunan = nominal ÷ 12 tiap bulan, dan catatan Sewa cabang itu
 * tidak dihitung lagi (pembayarannya tetap dicatat supaya saldo kas benar).
 */
function RentCard() {
  const t = useT();
  const { data: outlets } = useCollection('outlets');
  const current = getRent();
  const [draft, setDraft] = useState<Record<string, { mode: OutletRent['mode']; yearly: string }>>(() =>
    Object.fromEntries(
      Object.entries(current).map(([id, r]) => [id, { mode: r.mode, yearly: r.yearly ? fmtRpInput(String(r.yearly)) : '' }]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const rowOf = (id: string) => draft[id] ?? { mode: 'bulanan' as const, yearly: '' };
  const normalize = (r: OutletRent | undefined): OutletRent =>
    r?.mode === 'tahunan' ? { mode: 'tahunan', yearly: r.yearly } : { mode: 'bulanan', yearly: 0 };
  const next: Record<string, OutletRent> = Object.fromEntries(
    outlets.map((o) => {
      const r = rowOf(o.id);
      return [o.id, normalize({ mode: r.mode, yearly: parseRpInput(r.yearly) })];
    }),
  );
  const dirty = outlets.some((o) => JSON.stringify(next[o.id]) !== JSON.stringify(normalize(current[o.id])));
  const missing = outlets.some((o) => next[o.id].mode === 'tahunan' && next[o.id].yearly <= 0);
  const patch = (id: string, change: Partial<{ mode: OutletRent['mode']; yearly: string }>) =>
    setDraft((d) => ({ ...d, [id]: { ...rowOf(id), ...change } }));

  const save = async () => {
    if (demoGuard()) return;
    setBusy(true);
    try {
      await setRent(next);
      toast.success(t('settingsPage.rentSaved'));
    } catch {
      toast.error(t('settingsPage.rentSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (outlets.length === 0) return null;
  return (
    <SettingsCard icon={<Store aria-hidden />} title={t('settingsPage.rentTitle')}>
      <SettingsHint className="mb-3">{t('settingsPage.rentHint')}</SettingsHint>
      <div className="flex flex-col">
        {outlets.map((o) => {
          const r = rowOf(o.id);
          const yearly = parseRpInput(r.yearly);
          return (
            <div
              key={o.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-dashed border-border py-2 last:border-b-0"
            >
              <span className="min-w-0 flex-[1_1_9rem] font-semibold">{o.name}</span>
              <div className="min-w-0 flex-[0_1_10rem]">
                <SelectBox
                  aria-label={interpolate(t('settingsPage.rentModeFor'), { outlet: o.name })}
                  value={r.mode}
                  onValueChange={(v) => patch(o.id, { mode: v as OutletRent['mode'] })}
                  options={[
                    { value: 'bulanan', label: t('settingsPage.rentMonthly') },
                    { value: 'tahunan', label: t('settingsPage.rentYearly') },
                  ]}
                />
              </div>
              {r.mode === 'tahunan' ? (
                <>
                  <div className="min-w-0 flex-[1_1_10rem]">
                    <Input
                      aria-label={interpolate(t('settingsPage.rentYearlyFor'), { outlet: o.name })}
                      inputMode="numeric"
                      className={NUM}
                      value={r.yearly}
                      onChange={(e) => patch(o.id, { yearly: fmtRpInput(e.target.value) })}
                      placeholder="24.000.000"
                    />
                  </div>
                  <span className="font-mono text-xs whitespace-nowrap tabular-nums text-muted-foreground">
                    {yearly > 0 ? interpolate(t('settingsPage.rentPerMonth'), { amount: fmtRp(yearly / 12) }) : <EmptyValue />}
                  </span>
                </>
              ) : (
                <span className="flex-[1_1_10rem] text-xs text-muted-foreground">{t('settingsPage.rentFromFinance')}</span>
              )}
            </div>
          );
        })}
      </div>
      <SaveFoot note={missing ? t('settingsPage.rentYearlyMissing') : undefined}>
        <Button onClick={save} disabled={busy || !dirty || missing} aria-busy={busy || undefined}>
          {busy && <Spinner />}
          {t('settingsPage.rentSave')}
        </Button>
      </SaveFoot>
    </SettingsCard>
  );
}

// Angka uang di kotak isian juga mono.
const NUM = 'font-mono tabular-nums placeholder:font-sans';
