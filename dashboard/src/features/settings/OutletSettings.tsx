import { useState } from 'react';
import { Check, Info, LoaderCircle, MapPin, Plus, Store, Trash2 } from 'lucide-react';
import { EmptyValue } from '@/components/ui/EmptyValue';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { EmptyState } from '@/components/dens/empty-state';
import { Field } from '@/components/dens/field';
import { Input } from '@/components/dens/input';
import { TextInput } from '@/components/dens/text-input';
import { repository } from '@/data';
import { getCurrentPosition } from '@/lib/geo';
import { newId } from '@/lib/id';
import { interpolate } from '@/lib/business/notify';
import { useT } from '@/i18n';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import type { Outlet } from '@/data/types';
import { SettingsCard, SettingsSection } from './settingsUi';

const Spinner = () => <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />;

/**
 * Batas atas radius geofence. Di atas ini "pagar"-nya tidak menjaga apa pun —
 * ia hanya membuat absensi terlihat terjaga sambil meloloskan siapa saja.
 */
const MAX_GEOFENCE_M = 5000;

/** Tab Outlet (L-66): daftar cabang dan pagar lokasi absensi (geofence). */
export function OutletSettings({ outlets }: { outlets: Outlet[] }) {
  const t = useT();
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [adding, setAdding] = useState(false);

  const add = async () => {
    if (!name.trim()) return toast.error(t('settingsPage.namaOutletWajibDiisi'));
    if (adding) return;
    setAdding(true);
    const now = new Date().toISOString();
    try {
      await repository.put('outlets', {
        id: newId(),
        orgId,
        outletId: null,
        name: name.trim(),
        address: address.trim(),
        isPrimary: outlets.length === 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      toast.success(t('settingsPage.outletDitambahkan'));
      setName('');
      setAddress('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.outletAddFailed'));
    } finally {
      setAdding(false);
    }
  };
  return (
    <SettingsSection>
      <SettingsCard icon={<Store aria-hidden />} title={t('settingsPage.outletCabang')}>
        {outlets.length === 0 ? (
          <EmptyState
            icon={<Store aria-hidden />}
            title={t('settingsPage.belumAdaOutletTambahan')}
            description={t('settingsPage.outletUtamaDigunakanSecara')}
          />
        ) : (
          <ul>
            {outlets.map((o) => (
              <OutletRow key={o.id} outlet={o} />
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <div className="min-w-[140px] flex-1">
            <TextInput placeholder={t('settingsPage.namaOutlet')} aria-label={t('settingsPage.namaOutlet')} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="min-w-[140px] flex-1">
            <TextInput placeholder={t('settingsPage.alamat')} aria-label={t('settingsPage.alamat')} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <Button onClick={add} disabled={adding} aria-busy={adding || undefined}>
            {adding ? <Spinner /> : <Plus aria-hidden />}
            {t('settingsPage.tambah')}
          </Button>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}

/**
 * One outlet row with an expandable geofence editor. Setting coordinates +
 * radius turns on GPS-validated attendance for that outlet; leaving them empty
 * keeps clock-in unrestricted. "Gunakan lokasi saya" fills lat/lng from the
 * device GPS (owner is expected to set it while physically at the outlet).
 */
function OutletRow({ outlet }: { outlet: Outlet }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState(outlet.lat != null ? String(outlet.lat) : '');
  const [lng, setLng] = useState(outlet.lng != null ? String(outlet.lng) : '');
  const [radius, setRadius] = useState(
    outlet.geofenceRadiusM != null ? String(outlet.geofenceRadiusM) : '100',
  );
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  // Nama & alamat cabang dulu tidak bisa diubah sama sekali setelah dibuat,
  // dan cabang yang tutup tidak bisa dihapus — keduanya menetap di semua
  // pemilih cabang selamanya.
  const [name, setName] = useState(outlet.name);
  const [address, setAddress] = useState(outlet.address ?? '');
  const [confirm, setConfirm] = useState(false);

  const geofenceOn =
    outlet.lat != null && outlet.lng != null && (outlet.geofenceRadiusM ?? 0) > 0;

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setLat(pos.lat.toFixed(6));
      setLng(pos.lng.toFixed(6));
      const radN = Number(radius) || 0;
      // Akurasi yang lebih lebar dari radius berarti titik ini bisa meleset
      // keluar pagar — dikatakan sekarang, bukan setelah absensi ditolak.
      if (radN > 0 && pos.accuracyM > radN) {
        toast.warning(
          interpolate(t('settingsPage.gpsWide'), { acc: String(Math.round(pos.accuracyM)), radius: String(radN) }),
        );
      } else {
        toast.success(interpolate(t('settingsPage.locationFound'), { acc: String(Math.round(pos.accuracyM)) }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.locationFailed'));
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    const latN = lat.trim() === '' ? null : Number(lat);
    const lngN = lng.trim() === '' ? null : Number(lng);
    const radN = radius.trim() === '' ? null : Math.round(Number(radius));
    if (latN != null && (Number.isNaN(latN) || latN < -90 || latN > 90)) {
      return toast.error(t('settingsPage.latitudeTidakValid90'));
    }
    if (lngN != null && (Number.isNaN(lngN) || lngN < -180 || lngN > 180)) {
      return toast.error(t('settingsPage.longitudeTidakValid180'));
    }
    if (radN != null && (Number.isNaN(radN) || radN <= 0)) {
      return toast.error(t('settingsPage.radiusHarusLebihDari'));
    }
    // Radius sebesar satu kota bukan pagar: ia meloloskan siapa pun sambil
    // tetap terlihat seperti penjagaan.
    if (radN != null && radN > MAX_GEOFENCE_M) {
      return toast.error(
        interpolate(t('settingsPage.radiusMax'), { max: MAX_GEOFENCE_M.toLocaleString('id-ID') }),
      );
    }
    if (!name.trim()) return toast.error(t('settingsPage.namaCabangWajibDiisi'));
    setBusy(true);
    try {
      await repository.put('outlets', {
        ...outlet,
        name: name.trim(),
        address: address.trim(),
        lat: latN,
        lng: lngN,
        geofenceRadiusM: radN,
        updatedAt: new Date().toISOString(),
      });
      toast.success(t('settingsPage.cabangDisimpan'));
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.geofenceFailed'));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await repository.put('outlets', {
        ...outlet,
        lat: null,
        lng: null,
        geofenceRadiusM: null,
        updatedAt: new Date().toISOString(),
      });
      setLat('');
      setLng('');
      setRadius('100');
      toast.success(t('settingsPage.geofenceDimatikanAbsensiBebas'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('settingsPage.geofenceOffFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="border-b border-dashed border-border py-3 first:pt-0 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="grid size-[38px] shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground [&>svg]:size-4">
          <Store aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block text-sm font-semibold [overflow-wrap:anywhere]">{outlet.name}</strong>
          <small className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{outlet.address || <EmptyValue />}</small>
        </div>
        {geofenceOn && (
          <Badge variant="success">
            <MapPin aria-hidden />
            {outlet.geofenceRadiusM}m
          </Badge>
        )}
        {outlet.isPrimary && <Badge>{t('settingsPage.utama')}</Badge>}
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <MapPin aria-hidden />
          {open ? t('settingsPage.tutup') : t('settingsPage.geofence')}
        </Button>
      </div>

      {open && (
        /* Sejajar dengan nama (38px avatar + 12px jarak = 50px); rata kiri di wadah sempit. */
        <div className="mt-2 ml-[50px] flex flex-col gap-3 rounded-xl bg-surface p-3 ring-1 ring-border/60 @max-[561px]/settings:ml-0">
          <div className={ROW2}>
            <Field label={t('settingsPage.namaCabang')}>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t('settingsPage.alamat')}>
              <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
          </div>
          <p className="flex items-start gap-2 text-sm leading-normal text-muted-foreground [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0">
            <Info aria-hidden />
            <span>
              Isi koordinat + radius untuk mewajibkan absensi dari lokasi outlet. Kosongkan untuk absensi bebas lokasi. Set saat
              Anda sedang berada di outlet. Radius maksimal {MAX_GEOFENCE_M.toLocaleString('id-ID')} m.
            </span>
          </p>
          <div className={ROW3}>
            <Field label={t('settingsPage.latitude')}>
              <Input inputMode="decimal" className={NUM} placeholder="-6.200000" value={lat} onChange={(e) => setLat(e.target.value)} />
            </Field>
            <Field label={t('settingsPage.longitude')}>
              <Input inputMode="decimal" className={NUM} placeholder="106.816666" value={lng} onChange={(e) => setLng(e.target.value)} />
            </Field>
            <Field label={t('settingsPage.radiusM')}>
              <Input type="number" className={NUM} placeholder="100" value={radius} onChange={(e) => setRadius(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={useMyLocation} disabled={locating} aria-busy={locating || undefined}>
              {locating ? <Spinner /> : <MapPin aria-hidden />}
              {t('settingsPage.gunakanLokasiSaya')}
            </Button>
            <span className="flex-1" />
            {!outlet.isPrimary && (
              <Button variant="ghost" size="sm" onClick={() => setConfirm(true)} disabled={busy}>
                <Trash2 aria-hidden />
                {t('settingsPage.hapusCabang')}
              </Button>
            )}
            {geofenceOn && (
              <Button variant="ghost" size="sm" onClick={clear} disabled={busy}>
                {t('settingsPage.matikan')}
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={busy} aria-busy={busy || undefined}>
              {busy ? <Spinner /> : <Check aria-hidden />}
              {t('settingsPage.simpan')}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title={t('settingsPage.hapusCabang2')}
        message={`"${outlet.name}" akan dihapus. Hanya bisa dihapus bila belum pernah dipakai transaksi, absensi, kas, atau penugasan anggota. Cabang utama tidak bisa dihapus.`}
        confirmLabel={t('settingsPage.hapus')}
        danger
        loading={busy}
        onConfirm={async () => {
          if (busy) return;
          setConfirm(false);
          setBusy(true);
          try {
            await repository.remove('outlets', outlet.id);
            toast.success(t('settingsPage.cabangDihapus'));
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('settingsPage.branchDeleteFailed'));
          } finally {
            setBusy(false);
          }
        }}
        onCancel={() => setConfirm(false)}
      />
    </li>
  );
}

// Dua kolom (nama, alamat) dan tiga kolom (lintang, bujur, radius 120px); satu kolom di wadah sempit (FixMaster: @media 768px).
const ROW2 = 'grid grid-cols-2 gap-3 @max-[561px]/settings:grid-cols-1';
const ROW3 = 'grid grid-cols-[1fr_1fr_120px] gap-3 @max-[561px]/settings:grid-cols-1';
// Koordinat dan radius juga mono.
const NUM = 'font-mono tabular-nums placeholder:font-sans';
