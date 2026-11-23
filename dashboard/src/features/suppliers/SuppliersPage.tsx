import { useMemo, useState } from 'react';
import { CircleX, FileText, Mail, PackageOpen, Pencil, Phone, Plus, Trash2, Truck } from 'lucide-react';
import { LoadState, loadPending } from '@/components/ui';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { EmptyState } from '@/components/dens/empty-state';
import { SummaryStrip } from '@/components/dens/summary-strip';
import { cn } from '@/lib/utils';
import { useCollection } from '@/hooks/useCollection';
import { repository } from '@/data';
import { isCloudMode } from '@/stores/demo';
import { voidPurchaseOrder } from '@/data/supabase-client';
import { fmtRp, EMPTY_VALUE } from '@/lib/format';
import { fmtDate } from '@/lib/time';
import { poTotal, poReceivedQty, PO_STATUS_BADGE, PO_STATUS_LABELS } from '@/lib/business/purchase';
import { applyBalance } from '@/lib/business/finance';
import { logActivity } from '@/lib/activity';
import { toast } from '@/stores/toast';
import { useSessionStore, resolveCreateOutlet, mustPickOutlet } from '@/stores/session';
import { useT } from '@/i18n';
import { SupplierModal } from './SupplierModal';
import { PurchaseOrderModal } from './PurchaseOrderModal';
import { ReceiveModal } from './ReceiveModal';
import type { Supplier, PurchaseOrder } from '@/data/types';

export function SuppliersPage() {
  const t = useT();
  const orgId = useSessionStore((s) => s.org?.id ?? '');
  const { data: suppliers, ...suppliersLoad } = useCollection('suppliers');
  const { data: purchaseOrders, ...poLoad } = useCollection('purchaseOrders');
  const { data: inventory } = useCollection('inventory');
  const { data: wallets } = useCollection('wallets');
  const { data: outlets } = useCollection('outlets');
  const { data: expenses } = useCollection('expenses');

  const [tab, setTab] = useState<'po' | 'suppliers'>('po');
  const [supplierModal, setSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [poModal, setPoModal] = useState(false);
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [deleteSupplier, setDeleteSupplier] = useState<Supplier | null>(null);
  const [voidTarget, setVoidTarget] = useState<PurchaseOrder | null>(null);
  const [voiding, setVoiding] = useState(false);

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? EMPTY_VALUE;

  const sortedPOs = useMemo(
    () => [...purchaseOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [purchaseOrders],
  );
  const activePoCount = purchaseOrders.filter((po) => po.status === 'ordered' || po.status === 'partial').length;

  // Per-supplier purchasing readout: PO count + total spend.
  const vendorStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const po of purchaseOrders) {
      const cur = map.get(po.supplierId) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += poTotal(po.lines);
      map.set(po.supplierId, cur);
    }
    return map;
  }, [purchaseOrders]);

  const confirmDeleteSupplier = async () => {
    if (!deleteSupplier) return;
    // Bukan hanya PO aktif: PO yang sudah selesai pun kehilangan nama
    // suppliernya (tampil "—") kalau suppliernya dihapus. Server menolak juga (0072).
    const linkedPo = purchaseOrders.filter((p) => p.supplierId === deleteSupplier.id).length;
    if (linkedPo > 0) {
      toast.error(
        `Supplier punya ${linkedPo} PO, jadi riwayatnya akan kehilangan nama supplier. Perbarui datanya saja.`,
      );
      setDeleteSupplier(null);
      return;
    }
    try {
      await repository.remove('suppliers', deleteSupplier.id);
      toast.success('Supplier dihapus');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus supplier');
    } finally {
      setDeleteSupplier(null);
    }
  };

  // Automatic void: reverse received stock, refund wallets for linked expenses,
  // delete those expenses, and set the PO to 'cancelled'. Atomic via RPC in
  // cloud; sequential reversal in local/dev mode.
  const confirmVoid = async () => {
    if (!voidTarget) return;
    // OQ-C (same guard as PosPage): the refund expense reversal is stamped to
    // an outlet — a multi-outlet user must pick a branch first, not guess.
    if (mustPickOutlet(outlets.length)) {
      toast.error('Pilih cabang di sidebar sebelum membatalkan PO');
      return;
    }
    setVoiding(true);
    const now = new Date().toISOString();
    try {
      const txOutletId = resolveCreateOutlet(outlets);
      if (isCloudMode()) {
        await voidPurchaseOrder({ orgId, poId: voidTarget.id, outletId: txOutletId });
      } else {
        // Reverse received stock.
        const stockUpdates = inventory
          .filter((i) => voidTarget.lines.some((l) => l.itemId === i.id && l.receivedQty > 0))
          .map((i) => {
            const l = voidTarget.lines.find((x) => x.itemId === i.id)!;
            return { ...i, stock: i.stock - l.receivedQty, updatedAt: now };
          });
        if (stockUpdates.length) await repository.putMany('inventory', stockUpdates);

        // Refund wallets for linked expenses, then delete those expenses.
        const linked = expenses.filter((e) => e.poId === voidTarget.id);
        for (const exp of linked) {
          if (exp.walletId) {
            const w = wallets.find((x) => x.id === exp.walletId);
            if (w) await repository.put('wallets', applyBalance(w, exp.amount));
          }
          await repository.remove('expenses', exp.id);
        }

        // Reset receivedQty to 0 and cancel.
        await repository.put('purchaseOrders', {
          ...voidTarget,
          lines: voidTarget.lines.map((l) => ({ ...l, receivedQty: 0 })),
          status: 'cancelled',
          updatedAt: now,
        });
      }
      // Cloud: dicatat database sendiri (0073, SERVER_LOGGED), termasuk bila PO
      // dibatalkan lewat jalur lain.
      logActivity({
        action: 'po.void',
        entityType: 'purchaseOrder',
        entityId: voidTarget.id,
        entityLabel: voidTarget.poNumber,
        meta: { poId: voidTarget.id, total: poTotal(voidTarget.lines) },
      });
      toast.success('PO dibatalkan, stok & keuangan dikembalikan');
      setVoidTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membatalkan PO');
    } finally {
      setVoiding(false);
    }
  };

  const panel = 'overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60';
  const newSupplier = () => {
    setEditingSupplier(null);
    setSupplierModal(true);
  };

  return (
    <div data-nu className="flex flex-col gap-4 bg-transparent">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2" role="group" aria-label={t('suppliers.tabsAria')}>
          {(
            [
              ['po', t('suppliers.tabPo'), purchaseOrders.length],
              ['suppliers', t('suppliers.tabSuppliers'), suppliers.length],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground ring-1 ring-border outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:text-foreground aria-pressed:ring-primary/30 pointer-coarse:h-11"
            >
              {label}
              {/* Hitungan sebagai angka, bukan "(1)" dalam kurung. */}
              <span className="rounded-full bg-secondary px-1.5 font-mono text-xs leading-[18px] text-secondary-foreground tabular-nums">
                {count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex-1 compact:hidden" />
        {tab === 'po' ? (
          <Button
            className="compact:w-full"
            onClick={() => {
              setEditingPo(null);
              setPoModal(true);
            }}
            disabled={suppliers.length === 0 || inventory.length === 0}
          >
            <Plus aria-hidden />
            PO Baru
          </Button>
        ) : (
          <Button className="compact:w-full" onClick={newSupplier}>
            <Plus aria-hidden />
            Supplier Baru
          </Button>
        )}
      </div>

      {tab === 'po' && (
        <SummaryStrip
          label={t('suppliers.summaryAria')}
          items={[
            { label: t('suppliers.statPo'), short: t('suppliers.statPoShort'), value: purchaseOrders.length },
            {
              label: t('suppliers.statPoActive'),
              short: t('suppliers.statPoActiveShort'),
              value: activePoCount,
              tone: activePoCount > 0 ? 'info' : undefined,
            },
            { label: t('suppliers.statSuppliers'), value: suppliers.length },
          ]}
        />
      )}

      {tab === 'po' ? (
        loadPending(poLoad) ? (
          <div className={panel}>
            <LoadState queries={[poLoad]} />
          </div>
        ) : sortedPOs.length === 0 ? (
          <div className={panel}>
            <EmptyState
              icon={<FileText aria-hidden />}
              title="Belum ada PO"
              description={
                suppliers.length === 0
                  ? 'Tambahkan supplier terlebih dahulu.'
                  : 'Buat PO untuk memesan stok dari supplier.'
              }
            />
          </div>
        ) : (
          <div className={panel}>
            {/* Satu baris PO, tiga tingkat (ambang muat/tidak muat = container
                query). Kasus terburuk terukur di layar sentuh: bingkai 40 +
                nomor 116 + nama 160 + "Rp 999.999.999" 118 + status "Sebagian
                Diterima" dengan Terima dan dua tuts 343 + jeda 48 = 825px; di
                bawahnya status dan tuts turun ke baris kedua (butuh 515px). Di
                bawah itu total ikut turun ke bawah nomor PO. */}
            <ul className="@container/polist m-0 grid list-none p-0">
              {sortedPOs.map((po) => (
                <li
                  key={po.id}
                  className={cn(
                    'grid items-center gap-x-4 gap-y-2 border-b border-dashed border-border px-5 py-3.5 last:border-b-0 hover:bg-accent/40',
                    "grid-cols-[116px_minmax(0,1fr)_auto_auto] [grid-template-areas:'no_info_total_right']",
                    "@max-[826px]/polist:grid-cols-[116px_minmax(0,1fr)_auto] @max-[826px]/polist:[grid-template-areas:'no_info_total'_'._right_right']",
                    "@max-[516px]/polist:grid-cols-[104px_minmax(0,1fr)] @max-[516px]/polist:px-4 @max-[516px]/polist:[grid-template-areas:'no_info'_'total_total'_'right_right']",
                  )}
                >
                  <span className="rounded-md bg-secondary px-2 py-1 text-center font-mono text-xs font-semibold whitespace-nowrap text-secondary-foreground [grid-area:no]">
                    {po.poNumber}
                  </span>
                  <div className="grid min-w-0 gap-0.5 [grid-area:info]">
                    {/* Nama supplier membungkus, maksimal dua baris. Satu baris +
                        elipsis memotong "PT Sumber Komponen" di 1097px. */}
                    <strong className="line-clamp-2 text-sm font-semibold [overflow-wrap:anywhere]">
                      {supplierName(po.supplierId)}
                    </strong>
                    <small className="font-mono text-xs text-muted-foreground">
                      {po.orderedAt ? fmtDate(po.orderedAt) : 'belum dipesan'}
                    </small>
                  </div>
                  <span className="font-mono text-sm font-semibold whitespace-nowrap tabular-nums [grid-area:total]">
                    {fmtRp(poTotal(po.lines))}
                  </span>
                  {/* Status di kiri, tuts mengumpul di kanan saat turun baris. */}
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 [grid-area:right] @max-[826px]/polist:[&>:first-child]:mr-auto">
                    <Badge variant={PO_STATUS_BADGE[po.status]}>{PO_STATUS_LABELS[po.status]}</Badge>
                    {(po.status === 'ordered' || po.status === 'partial') && (
                      <Button
                        variant="secondary"
                        className="bg-success text-success-foreground hover:bg-success/75"
                        onClick={() => setReceiveTarget(po)}
                      >
                        <PackageOpen aria-hidden /> Terima
                      </Button>
                    )}
                    {/* Salah ketik qty/harga tak lagi memaksa batal + buat ulang —
                        selama belum ada barang masuk, PO-nya masih bisa diperbaiki. */}
                    {po.status !== 'cancelled' && poReceivedQty(po.lines) === 0 && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-muted-foreground shadow-none hover:text-foreground"
                        onClick={() => {
                          setEditingPo(po);
                          setPoModal(true);
                        }}
                        aria-label={`Perbaiki ${po.poNumber}`}
                        title="Perbaiki PO (belum ada barang diterima)"
                      >
                        <Pencil aria-hidden />
                      </Button>
                    )}
                    {po.status !== 'cancelled' && po.status !== 'draft' && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-muted-foreground shadow-none hover:border-destructive/40 hover:bg-destructive-soft hover:text-destructive"
                        onClick={() => setVoidTarget(po)}
                        aria-label="Batalkan PO"
                        title="Batalkan PO (kembalikan stok & keuangan)"
                      >
                        <CircleX aria-hidden />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      ) : loadPending(suppliersLoad) ? (
        <div className={panel}>
          <LoadState queries={[suppliersLoad]} />
        </div>
      ) : suppliers.length === 0 ? (
        <div className={panel}>
          <EmptyState
            icon={<Truck aria-hidden />}
            title="Belum ada supplier"
            description="Tambahkan supplier untuk mulai membuat purchase order."
            action={
              <Button onClick={newSupplier}>
                <Plus aria-hidden />
                Supplier Baru
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(290px,100%),1fr))] gap-3">
          {suppliers.map((s) => {
            const vs = vendorStats.get(s.id) ?? { count: 0, total: 0 };
            return (
              <div
                key={s.id}
                className="flex flex-col gap-3 rounded-2xl bg-card p-4 text-card-foreground shadow-panel ring-1 ring-border/60"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-info text-info-foreground [&>svg]:size-5">
                    <Truck aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{s.name}</div>
                    <div className="font-mono text-xs text-muted-foreground uppercase">VND-{s.id.slice(0, 6).toUpperCase()}</div>
                  </div>
                </div>
                <div className="grid gap-1.5 border-y border-dashed border-border py-3 font-mono text-xs text-muted-foreground">
                  {(
                    [
                      [Phone, s.phone, 'tanpa nomor'],
                      [Mail, s.email, 'tanpa email'],
                    ] as const
                  ).map(([Glyph, value, empty]) => (
                    <div key={empty} className="flex min-w-0 items-center gap-2 [&>svg]:size-3.5 [&>svg]:shrink-0">
                      <Glyph aria-hidden />
                      <span className="truncate">{value || <em className="italic">{empty}</em>}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="grid gap-0.5">
                    <span className="text-xs text-muted-foreground">Total PO</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{vs.count}</span>
                  </div>
                  <div className="grid gap-0.5">
                    <span className="text-xs text-muted-foreground">Total Belanja</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{fmtRp(vs.total)}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditingSupplier(s);
                        setSupplierModal(true);
                      }}
                      aria-label="Ubah"
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                      onClick={() => setDeleteSupplier(s)}
                      aria-label="Hapus"
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SupplierModal
        open={supplierModal}
        onClose={() => setSupplierModal(false)}
        editing={editingSupplier}
        suppliers={suppliers}
      />
      <PurchaseOrderModal
        open={poModal}
        onClose={() => {
          setPoModal(false);
          setEditingPo(null);
        }}
        suppliers={suppliers}
        inventory={inventory}
        purchaseOrders={purchaseOrders}
        editing={editingPo}
      />
      <ReceiveModal
        open={!!receiveTarget}
        onClose={() => setReceiveTarget(null)}
        po={receiveTarget}
        supplier={receiveTarget ? suppliers.find((s) => s.id === receiveTarget.supplierId) ?? null : null}
      />
      <ConfirmDialog
        open={!!deleteSupplier}
        title="Hapus Supplier?"
        message={`"${deleteSupplier?.name}" akan dihapus permanen. Hanya bisa dihapus bila belum pernah dipakai di purchase order.`}
        confirmLabel="Hapus"
        danger
        onConfirm={confirmDeleteSupplier}
        onCancel={() => setDeleteSupplier(null)}
      />
      <ConfirmDialog
        open={!!voidTarget}
        title="Batalkan PO?"
        message={`PO ${voidTarget?.poNumber ?? ''} akan dibatalkan. Stok yang sudah diterima dikembalikan, pengeluaran terkait dihapus, dan saldo wallet dikembalikan. HPP rata-rata TIDAK ikut kembali ke nilai sebelumnya, jadi periksa harga modal barangnya setelah ini. Hanya bisa dibatalkan bila stoknya masih utuh dan pengeluarannya masih bulan ini.`}
        confirmLabel={voiding ? 'Membatalkan…' : 'Batalkan PO'}
        danger
        loading={voiding}
        onConfirm={confirmVoid}
        onCancel={() => setVoidTarget(null)}
      />
    </div>
  );
}
