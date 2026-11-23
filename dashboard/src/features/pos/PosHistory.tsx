import { useState } from 'react';
import { CircleX, History, LoaderCircle, Printer } from 'lucide-react';
import { LoadState, loadPending } from '@/components/ui';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { FormDialog } from '@/components/dens/form-dialog';
import { TextInput } from '@/components/dens/text-input';
import { WhatsAppIcon } from '@/components/dens/whatsapp-icon';
import { cn } from '@/lib/utils';
import type { LoadQuery } from '@/components/ui/loadPending';
import { repository } from '@/data';
import { voidSale } from '@/data/supabase-client';
import { isCloudMode } from '@/stores/demo';
import { logActivity } from '@/lib/activity';
import { fmtRp, EMPTY_VALUE } from '@/lib/format';
import { fmtDate } from '@/lib/time';
import { groupSalesByDay } from '@/lib/business/pos';
import { interpolate, waLink } from '@/lib/business/notify';
import { useT } from '@/i18n';
import { useCollection } from '@/hooks/useCollection';
import { toast } from '@/stores/toast';
import type { InventoryItem, Organization, Sale } from '@/data/types';
import { printSaleReceipt } from './printSaleReceipt';
import { saleWaMessage } from './saleWaMessage';

interface PosHistoryProps {
  recentSales: Sale[];
  salesLoad: LoadQuery;
  walletName: (id: string | null) => string;
  org: Organization | null;
  isMgr: boolean;
  /** Awal bulan berjalan: penjualan sebelum ini tak bisa dibatalkan (0069). */
  monthStart: string;
  /** Nama cabang aktif bila pengguna bisa memilih cabang lain. */
  branchName: string | null;
}

/** Tab Transaksi Terakhir: cetak ulang, kirim ulang WA, dan pembatalan. */
export function PosHistory({ recentSales, salesLoad, walletName, org, isMgr, monthStart, branchName }: PosHistoryProps) {
  const t = useT();
  const { data: outlets } = useCollection('outlets');
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);

  // Void a sale (manager-only). Cloud → atomic RPC; local → mirror the
  // reversal (restore stock, reverse wallet, delete linked income, mark void).
  const confirmVoid = async () => {
    if (!voidTarget) return;
    if (voidTarget.date < monthStart) {
      toast.error(t('pos.voidLastMonth'));
      return;
    }
    setVoidBusy(true);
    try {
      if (isCloudMode()) {
        await voidSale(voidTarget.id, voidReason.trim());
      } else {
        const inv = await repository.list('inventory');
        const restocked = voidTarget.lines
          .map((l) => {
            const item = inv.find((i) => i.id === l.itemId);
            return item ? { ...item, stock: item.stock + l.qty } : null;
          })
          .filter((x): x is InventoryItem => x !== null);
        if (restocked.length) await repository.putMany('inventory', restocked);

        const allIncomes = await repository.list('incomes');
        const allWallets = await repository.list('wallets');
        for (const inc of allIncomes.filter((i) => i.saleId === voidTarget.id)) {
          const w = allWallets.find((x) => x.id === inc.walletId);
          if (w) await repository.put('wallets', { ...w, balance: w.balance - inc.amount });
          await repository.remove('incomes', inc.id);
        }
        await repository.put('sales', {
          ...voidTarget,
          voided: true,
          voidedReason: voidReason.trim(),
        });
      }
      toast.success(interpolate(t('pos.voided'), { no: voidTarget.saleNo }));
      // Di cloud ini dilewati: database yang mencatatnya sendiri (0073, lihat
      // SERVER_LOGGED di lib/activity).
      logActivity({
        action: 'sale.void',
        entityType: 'sale',
        entityId: voidTarget.id,
        entityLabel: voidTarget.saleNo,
        meta: { total: voidTarget.total, reason: voidReason.trim() },
      });
      setVoidTarget(null);
      setVoidReason('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('pos.voidFailed'));
    } finally {
      setVoidBusy(false);
    }
  };

  // Kirim ulang struk WA dari riwayat. Nomor diambil dari data pelanggan saat
  // diklik; jendela dibuka lebih dulu (sinkron) supaya tak diblokir peramban.
  const resendWa = async (s: Sale) => {
    const win = window.open('', '_blank');
    try {
      const c = s.customerId ? await repository.get('customers', s.customerId) : null;
      if (!c?.phone) {
        win?.close();
        toast.warning(t('pos.noPhone'));
        return;
      }
      const url = waLink(c.phone, saleWaMessage(t('pos.waMessage'), org?.name ?? '', s));
      if (win) win.location.href = url;
      else window.open(url, '_blank');
    } catch (e) {
      win?.close();
      toast.error(e instanceof Error ? e.message : t('pos.waFailed'));
    }
  };

  return (
    <>
      <section
        id="pos-panel"
        role="tabpanel"
        aria-labelledby="pos-tab-history"
        className="grid gap-3 rounded-2xl bg-card px-5 py-4 text-card-foreground shadow-panel ring-1 ring-border/60 compact:px-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
            <History aria-hidden /> {t('pos.tabHistory')}
          </h2>
          {/* Riwayat mengikuti cabang aktif — dulu tanpa tanda, sehingga cabang
              tanpa penjualan tampak seperti data hilang. */}
          {branchName && (
            <span className="text-xs text-muted-foreground">{t('pos.historyBranch').replace('{name}', branchName)}</span>
          )}
        </div>
        {loadPending(salesLoad) ? (
          <LoadState queries={[salesLoad]} />
        ) : recentSales.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('pos.noSales')}</p>
        ) : (
          groupSalesByDay(recentSales).map((day) => (
            <section key={day.date} className="grid gap-2 [&+&]:mt-1" aria-label={fmtDate(day.date)}>
              {/* Kepala hari: tanggal + jumlah transaksi + total (tanpa yang batal).
                  Di 320px keduanya tak muat sebaris: ringkasan turun utuh, bukan
                  dua kolom yang masing-masing patah. */}
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 border-b border-dashed border-border px-3 pb-1.5 text-xs font-semibold text-muted-foreground">
                <span>{fmtDate(day.date)}</span>
                <span>
                  {interpolate(t('pos.dayCount'), { n: String(day.count) })} ·{' '}
                  <span className="font-mono tabular-nums">{fmtRp(day.total)}</span>
                </span>
              </div>
              {/* Satu transaksi = dua baris: nomor + jam ... total, lalu rincian;
                  tuts di kanan selama muat. Ambang diukur dari baris terburuk di
                  layar sentuh: 26 bingkai + 117 nomor & jam + 118 "Rp 999.999.999"
                  + 148 tiga tuts 44px + 24 jeda = 433px, jadi di wadah <=432px
                  tuts turun ke barisnya sendiri. Ambang muat/tidak muat: wajib
                  container query. */}
              <ul className="@container/hist m-0 grid list-none gap-2 p-0">
                {day.rows.map((s) => (
                  <li
                    key={s.id}
                    data-voided={s.voided || undefined}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-0.5 rounded-xl px-3 py-2 ring-1 ring-border/70 [grid-template-areas:'no_total_actions'_'meta_meta_actions'] data-voided:opacity-55 @max-[433px]/hist:grid-cols-[minmax(0,1fr)_auto] @max-[433px]/hist:[grid-template-areas:'no_total'_'meta_meta'_'actions_actions']"
                  >
                    <strong className="min-w-0 font-mono text-sm font-semibold [grid-area:no] [overflow-wrap:anywhere]">
                      {s.saleNo}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {s.createdAt
                          ? new Date(s.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </strong>
                    <span
                      className={cn(
                        'justify-self-end font-mono text-sm font-semibold whitespace-nowrap tabular-nums [grid-area:total]',
                        s.voided && 'line-through',
                      )}
                    >
                      {fmtRp(s.total)}
                    </span>
                    <small className="min-w-0 text-xs text-muted-foreground [grid-area:meta]">
                      {interpolate(t('pos.itemCount'), { n: String(s.lines.length) })}
                      {s.payments.length > 0 && ` · ${s.payments.map((p) => walletName(p.walletId) || EMPTY_VALUE).join(' + ')}`}
                      {s.cashierName ? ` · ${s.cashierName}` : ''}
                      {s.customerName ? ` · ${s.customerName}` : ''}
                    </small>
                    <div className="flex items-center justify-end gap-2 [grid-area:actions] empty:hidden @max-[433px]/hist:mt-2 @max-[433px]/hist:border-t @max-[433px]/hist:border-dashed @max-[433px]/hist:border-border @max-[433px]/hist:pt-2">
                      {s.customerId && !s.voided && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-muted-foreground shadow-none hover:text-foreground"
                          onClick={() => void resendWa(s)}
                          aria-label={t('pos.resendWa').replace('{no}', s.saleNo)}
                          title={t('pos.resendWa').replace('{no}', s.saleNo)}
                        >
                          <WhatsAppIcon className="size-4" />
                        </Button>
                      )}
                      {org && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-muted-foreground shadow-none hover:text-foreground"
                          onClick={() => printSaleReceipt(s, org, { reprint: true, walletName, outlets })}
                          aria-label={interpolate(t('pos.printAria'), { no: s.saleNo })}
                          title={t('pos.printTitle')}
                        >
                          <Printer aria-hidden />
                        </Button>
                      )}
                      {s.voided ? (
                        <Badge variant="destructive-soft">{t('pos.voidedBadge')}</Badge>
                      ) : !isMgr || s.date < monthStart ? null : (
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-muted-foreground shadow-none hover:border-destructive/40 hover:bg-destructive-soft hover:text-destructive"
                          onClick={() => {
                            setVoidTarget(s);
                            setVoidReason('');
                          }}
                          aria-label={interpolate(t('pos.voidAria'), { no: s.saleNo })}
                          title={t('pos.voidTitle')}
                        >
                          <CircleX aria-hidden />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </section>

      <FormDialog
        open={voidTarget !== null}
        onClose={() => setVoidTarget(null)}
        title={interpolate(t('pos.voidModalTitle'), { no: voidTarget?.saleNo ?? '' })}
        description={
          <>
            {t('pos.voidBody')} <strong className="font-semibold text-foreground">{t('pos.voidedBadge')}</strong>{' '}
            {t('pos.voidBodyTail')}
          </>
        }
        size="sm"
        footer={
          <>
            {/* Fokus awal di Kembali, bukan kolom alasan: jendela ini membatalkan uang
                dan stok, dan di ponsel keyboard yang muncul menutupi tombolnya. */}
            <Button variant="outline" onClick={() => setVoidTarget(null)} data-autofocus>
              {t('common.back')}
            </Button>
            <Button variant="destructive" onClick={confirmVoid} disabled={voidBusy} aria-busy={voidBusy || undefined}>
              {voidBusy && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
              {t('pos.voidConfirm').replace('{no}', voidTarget?.saleNo ?? '')}
            </Button>
          </>
        }
      >
        <TextInput
          placeholder={t('pos.voidReason')}
          aria-label={t('pos.voidReason')}
          value={voidReason}
          onChange={(e) => setVoidReason(e.target.value)}
        />
      </FormDialog>
    </>
  );
}
