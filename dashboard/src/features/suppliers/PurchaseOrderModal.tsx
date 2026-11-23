import { useState } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Field, FormMessage } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { useFormFault } from '@/hooks/useFormFault';
import { repository } from '@/data';
import { useCollection } from '@/hooks/useCollection';
import { isCloudMode } from '@/stores/demo';
import { createPurchaseOrder, updatePurchaseOrder } from '@/data/supabase-client';
import { newId, nextDocNumber } from '@/lib/id';
import { fmtRp, fmtRpInput, parseRpInput } from '@/lib/format';
import { localDateStr } from '@/lib/time';
import { poTotal } from '@/lib/business/purchase';
import { toast } from '@/stores/toast';
import { useSessionStore, resolveCreateOutlet, mustPickOutlet } from '@/stores/session';
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  Supplier,
  InventoryItem,
} from '@/data/types';

interface PurchaseOrderModalProps {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  inventory: InventoryItem[];
  purchaseOrders: PurchaseOrder[];
  /** PO yang sedang diperbaiki (hanya boleh selama belum ada barang diterima). */
  editing?: PurchaseOrder | null;
}

export function PurchaseOrderModal({
  open,
  onClose,
  suppliers,
  inventory,
  purchaseOrders,
  editing = null,
}: PurchaseOrderModalProps) {
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const { data: outlets } = useCollection('outlets');
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<PurchaseOrderLine[]>([]);
  const [note, setNote] = useState('');
  const { error, setError, fail, invalid } = useFormFault<'supplier'>();
  const [busy, setBusy] = useState(false);

  const [lastOpen, setLastOpen] = useState(false);
  if (open && !lastOpen) {
    setLastOpen(true);
    setSupplierId(editing?.supplierId ?? suppliers[0]?.id ?? '');
    setLines(editing ? editing.lines.map((l) => ({ ...l })) : []);
    setNote(editing?.note ?? '');
    setError('');
  }
  if (!open && lastOpen) setLastOpen(false);

  const addLine = (itemId: string) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item || lines.some((l) => l.itemId === itemId)) return;
    setLines((prev) => [
      ...prev,
      { itemId: item.id, name: item.name, qty: 1, costPrice: item.costPrice, receivedQty: 0 },
    ]);
  };

  const updateLine = (itemId: string, patch: Partial<PurchaseOrderLine>) => {
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, ...patch } : l)));
  };

  const removeLine = (itemId: string) => {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  };

  const save = async () => {
    if (!supplierId) return fail('supplier', 'Pilih supplier');
    if (lines.length === 0) return setError('Tambahkan minimal 1 barang');
    // Qty bilangan bulat: kolom stok integer, jadi "2,5 pcs" dulu dibulatkan
    // diam-diam saat barang diterima (server menolaknya sejak 0071).
    if (lines.some((l) => l.qty <= 0 || !Number.isInteger(l.qty)))
      return setError('Jumlah setiap barang harus bilangan bulat lebih dari 0');
    // PO dicap ke cabang, sama seperti pengeluaran saat barang diterima.
    if (!editing && mustPickOutlet(outlets.length))
      return setError('Pilih cabang di sidebar sebelum membuat PO');

    setBusy(true);
    const now = new Date().toISOString();
    try {
      if (isCloudMode()) {
        // Nomor PO ditetapkan server (0071): dua perangkat tidak lagi bentrok,
        // dan daftar yang terpotong 1000 baris tak lagi mengulang nomor lama.
        if (editing) {
          await updatePurchaseOrder({
            orgId,
            poId: editing.id,
            supplierId,
            lines,
            note: note.trim(),
          });
          toast.success(`PO ${editing.poNumber} diperbarui`);
        } else {
          const { poNumber } = await createPurchaseOrder({
            orgId,
            supplierId,
            lines,
            note: note.trim(),
            outletId: resolveCreateOutlet(outlets),
          });
          toast.success(`PO ${poNumber} dibuat`);
        }
        onClose();
        return;
      }

      const poNumber =
        editing?.poNumber ?? nextDocNumber('PO', purchaseOrders.map((p) => p.poNumber));
      const record: PurchaseOrder = {
        id: editing?.id ?? newId(),
        orgId,
        outletId: editing?.outletId ?? resolveCreateOutlet(outlets),
        poNumber,
        supplierId,
        status: editing?.status ?? 'ordered',
        lines,
        orderedAt: editing?.orderedAt ?? localDateStr(),
        receivedAt: editing?.receivedAt ?? null,
        note: note.trim(),
        createdAt: editing?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      };
      await repository.put('purchaseOrders', record);
      toast.success(editing ? `PO ${poNumber} diperbarui` : `PO ${poNumber} dibuat`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan PO');
    } finally {
      setBusy(false);
    }
  };

  const availableItems = inventory.filter((i) => !lines.some((l) => l.itemId === i.id));

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={editing ? `Perbaiki ${editing.poNumber}` : 'PO Baru'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={save} disabled={busy} aria-busy={busy || undefined}>
            {busy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {editing ? 'Simpan Perubahan' : 'Buat PO'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <FormMessage>{error}</FormMessage>
        <Field label="Supplier" invalid={invalid('supplier')}>
          <SelectBox
            value={supplierId}
            onValueChange={setSupplierId}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            placeholder={suppliers.length ? undefined : 'Belum ada supplier'}
            data-autofocus
          />
        </Field>

        <Field label="Tambah Barang">
          <SelectBox
            value=""
            onValueChange={(v) => v && addLine(v)}
            options={availableItems.map((i) => ({ value: i.id, label: `${i.name} (stok ${i.stock})` }))}
            placeholder="Pilih sparepart…"
          />
        </Field>

        {lines.length > 0 && (
          // Baris barang: nama | qty | harga beli | jumlah | hapus. Di wadah
          // sempit kolom jumlah hilang (ambang muat/tidak muat = container query):
          // nama 120 + qty 70 + harga 110 + "Rp 99.999.999" 110 + tuts 40 + jeda
          // 32 + bingkai 24 = 506px.
          <div className="@container/lines grid gap-2 rounded-xl bg-surface p-3">
            {lines.map((l) => (
              <div
                key={l.itemId}
                className="grid grid-cols-[minmax(0,1fr)_70px_110px_auto_40px] items-center gap-2 @max-[507px]/lines:grid-cols-[minmax(0,1fr)_60px_90px_40px]"
              >
                <span className="truncate text-sm font-medium">{l.name}</span>
                <TextInput
                  type="number"
                  className="px-2 text-center font-mono text-sm"
                  aria-label={`Jumlah ${l.name}`}
                  value={String(l.qty)}
                  onChange={(e) => updateLine(l.itemId, { qty: Math.max(0, Math.round(Number(e.target.value))) })}
                />
                <TextInput
                  capitalize="none"
                  inputMode="numeric"
                  className="px-2 text-right font-mono text-sm"
                  aria-label={`Harga beli ${l.name}`}
                  value={fmtRpInput(String(l.costPrice))}
                  onChange={(e) => updateLine(l.itemId, { costPrice: parseRpInput(e.target.value) })}
                />
                <span className="text-right font-mono text-sm font-semibold whitespace-nowrap tabular-nums @max-[507px]/lines:hidden">
                  {fmtRp(l.qty * l.costPrice)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                  onClick={() => removeLine(l.itemId)}
                  aria-label={`Hapus ${l.name}`}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-dashed border-border pt-3 text-sm">
              <span>Total PO</span>
              <strong className="font-mono text-base font-semibold tabular-nums">{fmtRp(poTotal(lines))}</strong>
            </div>
          </div>
        )}

        <Field label="Catatan (opsional)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </FormDialog>
  );
}
