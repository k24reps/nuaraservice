import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { Checkbox } from '@/components/dens/checkbox';
import { Field } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { repository } from '@/data';
import { isCloudMode } from '@/stores/demo';
import { receiveGoodsWithFinance } from '@/data/supabase-client';
import { receiveGoods, receivedValue, averageCost, PO_STATUS_BADGE, PO_STATUS_LABELS } from '@/lib/business/purchase';
import { applyBalance } from '@/lib/business/finance';
import { newId } from '@/lib/id';
import { localDateStr } from '@/lib/time';
import { fmtRp } from '@/lib/format';
import { logActivity } from '@/lib/activity';
import { toast } from '@/stores/toast';
import { useSessionStore, resolveCreateOutlet, mustPickOutlet } from '@/stores/session';
import { useCollection } from '@/hooks/useCollection';
import { useResetOnOpen } from '@/hooks/useResetOnOpen';
import type { PurchaseOrder, Supplier } from '@/data/types';

interface ReceiveModalProps {
  open: boolean;
  onClose: () => void;
  po: PurchaseOrder | null;
  supplier: Supplier | null;
}

export function ReceiveModal({ open, onClose, po, supplier }: ReceiveModalProps) {
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const { data: wallets } = useCollection('wallets');
  const { data: outlets } = useCollection('outlets');
  const [receipts, setReceipts] = useState<Record<string, number>>({});
  // Q1=(c): cash payment is optional. Default ON + primary wallet (sortOrder).
  const [payFromWallet, setPayFromWallet] = useState(true);
  const [walletId, setWalletId] = useState('');
  const [busy, setBusy] = useState(false);

  const sortedWallets = [...wallets].sort((a, b) => a.sortOrder - b.sortOrder);

  useResetOnOpen(open, po?.id ?? null, () => {
    if (!po) return;
    // Default each line to its remaining quantity.
    const init: Record<string, number> = {};
    for (const l of po.lines) init[l.itemId] = Math.max(0, l.qty - l.receivedQty);
    setReceipts(init);
    setPayFromWallet(true);
    setWalletId(sortedWallets[0]?.id ?? '');
  });

  if (!po) return null;

  // Value of goods being received in this event (partial-aware).
  const amount = receivedValue(po, receipts);

  const apply = async () => {
    if (payFromWallet && amount > 0 && !walletId) {
      toast.error('Pilih wallet pembayaran');
      return;
    }
    // OQ-C (same guard as PosPage): the stock-purchase expense is stamped to an
    // outlet — a multi-outlet user must pick a branch first, not guess.
    if (mustPickOutlet(outlets.length)) {
      toast.error('Pilih cabang di sidebar sebelum menerima barang');
      return;
    }
    setBusy(true);
    const now = new Date().toISOString();
    try {
      const { lines, stockDeltas, status } = receiveGoods(po, receipts);
      if (stockDeltas.length === 0) {
        toast.warning('Tidak ada qty diterima');
        setBusy(false);
        return;
      }
      const txOutletId = resolveCreateOutlet(outlets);
      const payWalletId = payFromWallet && amount > 0 ? walletId : null;

      if (isCloudMode()) {
        // Cloud: one atomic RPC (stock + PO + expense + optional wallet debit).
        await receiveGoodsWithFinance({
          orgId,
          poId: po.id,
          lines,
          deltas: stockDeltas,
          status,
          outletId: txOutletId,
          walletId: payWalletId,
          amount,
        });
      } else {
        // Local/dev: sequential writes (no transaction available offline).
        const inventory = await repository.list('inventory');
        const updates = inventory
          .filter((i) => stockDeltas.some((d) => d.itemId === i.id))
          .map((i) => {
            const d = stockDeltas.find((x) => x.itemId === i.id)!;
            const unit = po.lines.find((l) => l.itemId === i.id)?.costPrice;
            // HPP rata-rata tertimbang (cermin receive_goods_v2, 0069).
            return { ...i, stock: i.stock + d.delta, costPrice: averageCost(i.stock, i.costPrice, d.delta, unit) };
          });
        if (updates.length) await repository.putMany('inventory', updates);

        await repository.put('purchaseOrders', {
          ...po,
          lines,
          status,
          receivedAt: status === 'received' ? localDateStr() : po.receivedAt,
          updatedAt: now,
        });

        if (amount > 0) {
          await repository.put('expenses', {
            id: newId(),
            orgId,
            outletId: txOutletId,
            date: localDateStr(),
            category: 'Sparepart',
            amount,
            walletId: payWalletId ?? '',
            description: `Pembelian stok PO ${po.poNumber}`,
            poId: po.id,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          });
          if (payWalletId) {
            const w = sortedWallets.find((x) => x.id === payWalletId);
            if (w) await repository.put('wallets', applyBalance(w, -amount));
          }
        }
      }

      logActivity({
        action: 'expense.create',
        entityType: 'expense',
        entityLabel: `Stok PO ${po.poNumber}`,
        meta: { amount, poId: po.id, status },
      });
      toast.success(
        amount > 0
          ? 'Barang diterima, stok & pengeluaran tercatat'
          : 'Barang diterima & stok diperbarui',
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menerima barang');
    } finally {
      setBusy(false);
    }
  };

  const num = 'text-center font-mono text-sm tabular-nums';
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={`Terima Barang · ${po.poNumber}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={apply} disabled={busy} aria-busy={busy || undefined}>
            {busy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            Terima & Update Stok
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-3 text-sm font-semibold">
          <span className="min-w-0 [overflow-wrap:anywhere]">{supplier?.name ?? 'Supplier'}</span>
          <Badge variant={PO_STATUS_BADGE[po.status]}>{PO_STATUS_LABELS[po.status]}</Badge>
        </div>
        <div className="grid gap-2" role="table" aria-label="Barang yang diterima">
          <div
            role="row"
            className="grid grid-cols-[minmax(0,1fr)_64px_64px_84px] items-center gap-2 border-b border-border pb-2 text-xs font-semibold text-muted-foreground"
          >
            <span role="columnheader">Barang</span>
            <span role="columnheader" className="text-center">Dipesan</span>
            <span role="columnheader" className="text-center">Sudah</span>
            <span role="columnheader" className="text-center">Terima</span>
          </div>
          {po.lines.map((l) => {
            const remaining = Math.max(0, l.qty - l.receivedQty);
            return (
              <div key={l.itemId} role="row" className="grid grid-cols-[minmax(0,1fr)_64px_64px_84px] items-center gap-2">
                <span role="cell" className="truncate text-sm font-medium">{l.name}</span>
                <span role="cell" className={num}>{l.qty}</span>
                <span role="cell" className={num}>{l.receivedQty}</span>
                <span role="cell">
                  <TextInput
                    type="number"
                    className="px-2 text-center font-mono text-sm"
                    aria-label={`Terima ${l.name}`}
                    value={String(receipts[l.itemId] ?? 0)}
                    onChange={(e) =>
                      setReceipts((prev) => ({
                        ...prev,
                        [l.itemId]: Math.max(0, Math.min(Number(e.target.value), remaining)),
                      }))
                    }
                    disabled={remaining === 0}
                  />
                </span>
              </div>
            );
          })}
        </div>

        {/* Keuangan: nilai barang yang diterima sekarang + bayar tunai opsional dari wallet. */}
        <div className="grid gap-3 rounded-xl bg-surface p-3 ring-1 ring-border/60">
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Nilai diterima</span>
            <strong className="font-mono text-lg font-semibold text-foreground tabular-nums">{fmtRp(amount)}</strong>
          </div>
          <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm pointer-coarse:min-h-11">
            <Checkbox checked={payFromWallet} onCheckedChange={(checked) => setPayFromWallet(checked === true)} />
            <span>Potong dari wallet (bayar tunai)</span>
          </label>
          {payFromWallet && (
            <Field label="Wallet pembayaran">
              <SelectBox
                value={walletId}
                onValueChange={setWalletId}
                options={sortedWallets.map((w) => ({
                  value: w.id,
                  label: `${w.name} · ${fmtRp(w.balance)}`,
                }))}
              />
            </Field>
          )}
          {!payFromWallet && (
            <p className="text-xs text-muted-foreground">Mode tempo/hutang: pengeluaran dicatat, saldo wallet tak berubah.</p>
          )}
        </div>
      </div>
    </FormDialog>
  );
}
