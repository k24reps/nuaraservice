import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { FormDialog } from '@/components/dens/form-dialog';
import { repository } from '@/data';
import { toast } from '@/stores/toast';
import { useResetOnOpen } from '@/hooks/useResetOnOpen';
import { getWarrantyPartsDays, getWarrantyPresets } from '@/config/orgConfig';
import { applyPartWarranty, latestPartWarranty } from '@/lib/business/services';
import { fmtDate, localDateOf, localDateStr } from '@/lib/time';
import type { Service, ServiceHistoryEntry } from '@/data/types';
import { PartWarrantyFields } from './PartWarrantyFields';
import { useT } from '@/i18n';
import { interpolate } from '@/lib/business/notify';

/**
 * Atur garansi sparepart setelah tiket Selesai: untuk part yang ditambahkan
 * belakangan, atau koreksi. Tanggal akhir dihitung dari tanggal tiket Selesai
 * (bukan hari ini), sama seperti saat garansi pertama kali ditetapkan.
 */
export function PartWarrantyModal({
  open,
  onClose,
  service,
  history,
}: {
  open: boolean;
  onClose: () => void;
  service: Service;
  history: ServiceHistoryEntry[];
}) {
  const t = useT();
  const [values, setValues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useResetOnOpen(open, service.id, () => {
    setValues(
      service.spareparts.map((p) =>
        p.warrantyDays != null ? String(p.warrantyDays) : String(p.defaultWarrantyDays ?? getWarrantyPartsDays()),
      ),
    );
  });

  const finishedAt = history.find((h) => h.status === 'selesai')?.at;
  const finishDate = finishedAt ? localDateOf(finishedAt) : localDateStr();

  const save = async () => {
    setBusy(true);
    try {
      const fresh = (await repository.get('services', service.id)) ?? service;
      // Indeks isian milik daftar part saat modal dibuka.
      if (fresh.spareparts.length !== values.length) {
        toast.warning(t('partWarranty.changed'));
        return;
      }
      const days = values.map((v) => Math.max(0, Math.round(Number(v) || 0)));
      const spareparts = applyPartWarranty(fresh.spareparts, days, finishDate);
      await repository.patch('services', fresh.id, {
        spareparts,
        warrantyPartsUntil: latestPartWarranty(spareparts),
        updatedAt: new Date().toISOString(),
      });
      toast.success(t('partWarranty.saved'));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('partWarranty.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={interpolate(t('partWarranty.title'), { no: service.serviceNo })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {t('common.save')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        {interpolate(t('partWarranty.intro'), { date: fmtDate(finishDate) })}
      </p>
      <PartWarrantyFields
        parts={service.spareparts}
        values={values}
        onChange={(i, v) => setValues((prev) => prev.map((x, j) => (j === i ? v : x)))}
        presets={getWarrantyPresets()}
      />
    </FormDialog>
  );
}
