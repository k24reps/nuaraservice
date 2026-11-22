import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Checkbox } from '@/components/dens/checkbox';
import { Field, FormMessage } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { useFormFault } from '@/hooks/useFormFault';
import { repository } from '@/data';
import { createWarrantyClaim } from '@/data/supabase-client';
import { newId, nextDocNumber } from '@/lib/id';
import { fmtRp, fmtRpInput, parseRpInput } from '@/lib/format';
import { fmtDate, localDateStr } from '@/lib/time';
import { applyBalance } from '@/lib/business/finance';
import { claimableItems, openClaimFor } from '@/lib/business/services';
import { toast } from '@/stores/toast';
import { useSessionStore } from '@/stores/session';
import { isCloudMode } from '@/stores/demo';
import { useCollection } from '@/hooks/useCollection';
import { useResetOnOpen } from '@/hooks/useResetOnOpen';
import type { ClaimItem, Service } from '@/data/types';
import { useT } from '@/i18n';
import { walletsForOutlet } from '@/lib/business/finance';
import { interpolate } from '@/lib/business/notify';

const itemKey = (item: ClaimItem) => `${item.kind}:${item.name}`;

interface WarrantyClaimModalProps {
  open: boolean;
  onClose: () => void;
  /** The original (settled, in-warranty) ticket being claimed against. */
  origin: Service | null;
  /** All services, used to generate the next ticket number. */
  services: Service[];
  onSaved: () => void;
}

/**
 * Opens a warranty claim as a NEW ticket linked to the original via
 * `warrantyClaimOf`. The original stays settled & untouched (its finances are
 * preserved). The claim ticket is free (finalCost 0). Optionally records a
 * manually-entered "Garansi" expense to keep profit accurate — the amount is
 * typed by the user, not derived from inventory/POS.
 *
 * Cloud: satu transaksi server (create_warranty_claim, 0064), jadi karyawan tak
 * lagi meninggalkan tiket klaim tanpa pengeluaran kerugiannya, dan klaim kedua
 * ditolak selama klaim sebelumnya belum Lunas/Batal.
 */
export function WarrantyClaimModal({ open, onClose, origin, services, onSaved }: WarrantyClaimModalProps) {
  const t = useT();
  const org = useSessionStore((s) => s.org);
  const me = useSessionStore((s) => s.currentEmployee);
  const { data: allWallets } = useCollection('wallets');
  const wallets = walletsForOutlet(allWallets, origin?.outletId ?? null);

  const [complaint, setComplaint] = useState('');
  const [recordLoss, setRecordLoss] = useState(false);
  const [lossAmount, setLossAmount] = useState('');
  const [walletId, setWalletId] = useState('');
  const { error, setError, fail, invalid } = useFormFault<'complaint' | 'loss' | 'wallet'>();
  const [busy, setBusy] = useState(false);
  // Kunci bagian yang dicentang (`kind:name`).
  const [picked, setPicked] = useState<string[]>([]);

  useResetOnOpen(open, origin?.id ?? null, () => {
    const available = origin ? claimableItems(origin, localDateStr()) : [];
    // Satu-satunya bagian yang masih bergaransi langsung terpilih.
    setPicked(available.length === 1 ? [itemKey(available[0])] : []);
    setComplaint('');
    setRecordLoss(false);
    setLossAmount('');
    setWalletId(wallets[0]?.id ?? '');
    setError('');
  });

  if (!origin) return null;

  const items = claimableItems(origin, localDateStr());

  const save = async () => {
    const chosen = items.filter((i) => picked.includes(itemKey(i)));
    if (chosen.length === 0) return setError(t('warrantyClaim.pickItems'));
    if (!complaint.trim()) return fail('complaint', t('warrantyClaim.complaintRequired'));
    const running = openClaimFor(services, origin.id);
    if (running) return setError(interpolate(t('warrantyClaim.running'), { no: running.serviceNo }));
    const loss = recordLoss ? parseRpInput(lossAmount) : 0;
    const wallet = wallets.find((w) => w.id === walletId);
    if (recordLoss) {
      if (loss <= 0) return fail('loss', t('warrantyClaim.lossRequired'));
      if (!wallet) return fail('wallet', t('warrantyClaim.walletRequired'));
      if (wallet.balance < loss) return fail('wallet', interpolate(t('warrantyClaim.walletShort'), { wallet: wallet.name, amount: fmtRp(wallet.balance) }));
    }

    setBusy(true);
    const now = new Date().toISOString();
    const orgId = org?.id ?? '';

    try {
      const serviceNo = nextDocNumber(
        org?.servicePrefix ?? 'FM',
        services.map((s) => s.serviceNo),
      );
      let claimNo: string;

      if (isCloudMode()) {
        ({ serviceNo: claimNo } = await createWarrantyClaim({
          orgId,
          originId: origin.id,
          serviceNo,
          complaint: complaint.trim(),
          by: me?.id ?? '',
          byName: me?.name ?? '',
          lossAmount: loss,
          lossWalletId: recordLoss ? walletId : null,
          claimedItems: chosen.map(({ kind, name }) => ({ kind, name })),
        }));
      } else {
        const claim: Service = {
          id: newId(),
          orgId,
          outletId: origin.outletId,
          serviceNo,
          customerId: origin.customerId,
          customerName: origin.customerName,
          customerPhone: origin.customerPhone,
          category: origin.category,
          device: origin.device,
          complaint: complaint.trim(),
          accessories: origin.accessories,
          status: 'diterima',
          technicianId: origin.technicianId,
          technicianName: origin.technicianName,
          estimateCost: 0,
          finalCost: 0,
          downPayment: 0,
          spareparts: [],
          warrantyServiceUntil: null,
          warrantyPartsUntil: null,
          pickedUp: false,
          pickedUpAt: null,
          warrantyClaimOf: origin.id,
          claimedItems: chosen,
          history: [
            {
              at: now,
              status: 'diterima',
              by: me?.id ?? '',
              byName: me?.name ?? '',
              note: `Klaim garansi dari ${origin.serviceNo}`,
              internal: false,
            },
          ],
          archived: false,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        ({ serviceNo: claimNo } = await repository.put('services', claim));

        // Annotate the original ticket's history so the link is visible there too.
        await repository.put('services', {
          ...origin,
          updatedAt: now,
          history: [
            ...(origin.history ?? []),
            {
              at: now,
              status: 'edit',
              by: me?.id ?? '',
              byName: me?.name ?? '',
              note: `Klaim garansi dibuka → ${claimNo}`,
              internal: false,
            },
          ],
        });

        // Optional manual warranty-loss expense.
        if (recordLoss && wallet) {
          await repository.put('expenses', {
            id: newId(),
            orgId,
            outletId: origin.outletId,
            date: localDateStr(),
            category: 'Garansi',
            amount: loss,
            walletId,
            description: `Kerugian garansi ${claimNo} (asli ${origin.serviceNo})`,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          });
          await repository.put('wallets', applyBalance(wallet, -loss));
        }
      }

      toast.success(interpolate(t('warrantyClaim.created'), { no: claimNo }));
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('warrantyClaim.failed'));
    } finally {
      setBusy(false);
    }
  };

  // Kotak centang + teks: seluruh baris jadi label, area sentuh ikut membesar di layar sentuh.
  const checkRow = 'flex min-h-9 cursor-pointer items-center gap-2.5 text-sm pointer-coarse:min-h-11';

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={interpolate(t('warrantyClaim.title'), { no: origin.serviceNo })}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {t('warrantyClaim.create')}
          </Button>
        </>
      }
    >
      <div className="@container/claim grid gap-4">
        <FormMessage>{error}</FormMessage>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('warrantyClaim.introA')} <strong className="text-foreground">{t('warrantyClaim.introStrong')}</strong>{' '}
          {t('warrantyClaim.introB')} <strong className="text-foreground">{origin.device}</strong> ({origin.customerName}).{' '}
          {t('warrantyClaim.introC')}
        </p>
        <div role="group" aria-label={t('warrantyClaim.items')} className="grid gap-1">
          <span className="text-sm font-semibold">{t('warrantyClaim.items')}</span>
          {items.map((item) => {
            const key = itemKey(item);
            return (
              <label key={key} className={checkRow}>
                <Checkbox
                  checked={picked.includes(key)}
                  onCheckedChange={(checked) =>
                    setPicked((prev) => (checked === true ? [...prev, key] : prev.filter((k) => k !== key)))
                  }
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">{item.name}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {interpolate(t('warrantyClaim.until'), { date: fmtDate(item.until) })}
                </span>
              </label>
            );
          })}
        </div>
        <Field label={t('warrantyClaim.complaint')} invalid={invalid('complaint')}>
          <TextInput
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            placeholder={t('warrantyClaim.complaintPh')}
            data-autofocus
          />
        </Field>
        <label className={checkRow}>
          <Checkbox checked={recordLoss} onCheckedChange={(checked) => setRecordLoss(checked === true)} />
          {t('warrantyClaim.recordLoss')}
        </label>
        {recordLoss && (
          <div className="grid gap-3 @min-[26rem]/claim:grid-cols-2">
            <Field label={t('warrantyClaim.lossAmount')} invalid={invalid('loss')}>
              <TextInput
                capitalize="none"
                inputMode="numeric"
                className="font-mono tabular-nums placeholder:font-sans"
                value={lossAmount}
                onChange={(e) => setLossAmount(fmtRpInput(e.target.value))}
                placeholder="100.000"
              />
            </Field>
            <Field label={t('warrantyClaim.wallet')} invalid={invalid('wallet')}>
              <SelectBox
                value={walletId}
                onValueChange={setWalletId}
                options={wallets.map((w) => ({ value: w.id, label: w.name }))}
              />
            </Field>
          </div>
        )}
      </div>
    </FormDialog>
  );
}
