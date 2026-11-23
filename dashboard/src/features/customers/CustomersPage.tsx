import { EmptyValue } from '@/components/ui/EmptyValue';
import { useMemo, useState } from 'react';
import { Pencil, Phone, Plus, Search, Trash2, Users } from 'lucide-react';
import { LoadState, loadPending, usePersistedView } from '@/components/ui';
import { Button } from '@/components/dens/button';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { EmptyState } from '@/components/dens/empty-state';
import { FilterChips } from '@/components/dens/filter-chips';
import { SelectBox } from '@/components/dens/select-box';
import { SummaryStrip } from '@/components/dens/summary-strip';
import { TextInput } from '@/components/dens/text-input';
import { ViewToggle } from '@/components/dens/view-toggle';
import { WhatsAppIcon } from '@/components/dens/whatsapp-icon';
import { cn } from '@/lib/utils';
import { useCollection } from '@/hooks/useCollection';
import { useCustomerServices, useCustomerStats } from '@/hooks/useCustomerStats';
import { EMPTY_CUSTOMER_STAT, matchesCustomer } from '@/lib/business/customers';
import { repository } from '@/data';
import { useSessionStore } from '@/stores/session';
import { isManager } from '@/config/plans';
import { fmtRp, EMPTY_VALUE } from '@/lib/format';
import { toast } from '@/stores/toast';
import { logActivity } from '@/lib/activity';
import { waLink, interpolate } from '@/lib/business/notify';
import { useT } from '@/i18n';
import { demoGuard } from '@/stores/demo';
import { CustomerModal } from './CustomerModal';
import { CustomerHistoryDrawer } from './CustomerHistoryDrawer';
import type { Customer } from '@/data/types';

type SortKey = 'svc_desc' | 'name_asc' | 'trx_desc';

export function CustomersPage() {
  const t = useT();
  const { data: customers, ...customersLoad } = useCollection('customers');
  // Hitungan per pelanggan dari SEMUA tiket (server; daftar servis dipotong 1000).
  // Selama belum termuat / gagal, "0x · Rp 0 · Belum servis" adalah angka palsu, jadi tampil "—".
  const statsQuery = useCustomerStats();
  const servicesPending = loadPending(statsQuery);
  const me = useSessionStore((s) => s.currentEmployee);
  const org = useSessionStore((s) => s.org);
  const isMgr = me ? isManager(me.role) : false;
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('svc_desc');
  const [view, chooseView] = usePersistedView('fixmaster-customers-view');
  const [category, setCategory] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  // Riwayat diambil per pelanggan dari server — pelanggan lama punya tiket di luar 1000 terbaru.
  const historyQuery = useCustomerServices(historyCustomer?.id ?? null);

  // Per pelanggan: jumlah tiket (tanpa batal), nilai tiket Lunas, kategori perangkat.
  const stats = statsQuery.data;

  // Chip perangkat seperti di Kasir & Inventori. Jumlahnya = pelanggan (yang
  // masih ada) yang pernah membawa kategori itu; satu pelanggan bisa di beberapa.
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of customers) {
      for (const cat of stats.get(c.id)?.categories ?? []) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [customers, stats]);
  const activeCategory = categoryCounts.some(([c]) => c === category) ? category : 'all';

  const rows = useMemo(() => {
    let list = customers.filter((c) => {
      if (!matchesCustomer(c, query)) return false;
      if (activeCategory !== 'all' && !stats.get(c.id)?.categories.includes(activeCategory)) {
        return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === 'name_asc') return a.name.localeCompare(b.name);
      const sa = stats.get(a.id) ?? EMPTY_CUSTOMER_STAT;
      const sb = stats.get(b.id) ?? EMPTY_CUSTOMER_STAT;
      if (sort === 'trx_desc') return sb.paidTotal - sa.paidTotal;
      return sb.count - sa.count;
    });
    return list;
  }, [customers, query, sort, stats, activeCategory]);
  const filtered = Boolean(query) || activeCategory !== 'all';

  const repeatCount = useMemo(
    () => customers.filter((c) => (stats.get(c.id)?.count ?? 0) > 1).length,
    [customers, stats],
  );

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setModalOpen(true);
  };

  // Open WhatsApp with a pre-filled, shop-branded greeting the user can edit
  // before sending. Mirrors NotifyModal: wa.me deep link, demo-guarded.
  const sendWa = (c: Customer) => {
    if (demoGuard('demo.whatsapp')) return;
    const toko = org?.name?.trim();
    const greeting = toko ? `Halo ${c.name}, ${toko} di sini. ` : `Halo ${c.name}, `;
    window.open(waLink(c.phone, greeting), '_blank');
    toast.success(t('customers.waOpening'));
  };

  // Pelanggan yang punya tiket tidak dihapus: tiketnya kehilangan pemilik dan
  // riwayat + statistiknya ikut hilang. Server menolaknya juga (0070) — cek di
  // sini supaya alasannya terbaca sebelum dialog konfirmasi muncul.
  const requestDelete = (c: Customer) => {
    // Statistik belum termuat = setiap pelanggan terbaca "0 tiket", dan dialog
    // konfirmasi menyatakan hal yang belum tentu benar sebagai fakta.
    if (statsQuery.loading) {
      toast.warning(t('customers.statsLoading'));
      return;
    }
    const used = stats.get(c.id)?.count ?? 0;
    if (used > 0) {
      toast.warning(interpolate(t('customers.hasTickets'), { name: c.name, count: String(used) }));
      return;
    }
    setToDelete(c);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await repository.remove('customers', toDelete.id);
      toast.success(t('customers.deleted'));
      logActivity({
        action: 'customer.delete',
        entityType: 'customer',
        entityId: toDelete.id,
        entityLabel: toDelete.name,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('customers.deleteFailed'));
    } finally {
      setToDelete(null);
    }
  };

  // Seluruh kartu/ubin membuka riwayat servis; tombol di dalamnya tidak.
  const openOnKey = (c: Customer) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setHistoryCustomer(c);
    }
  };

  // Aksi yang sama di ketiga tampilan. Ubin ringkas memakai tombol 36px.
  const renderActions = (c: Customer, compact = false) => {
    const size = compact ? 'size-9 pointer-coarse:size-11' : undefined;
    return (
      <>
        {c.phone && (
          <Button
            variant="ghost"
            size="icon"
            className={cn('text-muted-foreground hover:bg-success hover:text-success-foreground', size)}
            onClick={(e) => {
              e.stopPropagation();
              sendWa(c);
            }}
            aria-label={t('customers.sendWa')}
            title={t('customers.sendWa')}
          >
            <WhatsAppIcon className="size-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn('text-muted-foreground hover:text-foreground', size)}
          onClick={(e) => {
            e.stopPropagation();
            openEdit(c);
          }}
          aria-label={t('customers.edit')}
        >
          <Pencil aria-hidden />
        </Button>
        {isMgr && (
          <Button
            variant="ghost"
            size="icon"
            className={cn('text-muted-foreground hover:bg-destructive-soft hover:text-destructive', size)}
            onClick={(e) => {
              e.stopPropagation();
              requestDelete(c);
            }}
            aria-label={t('common.delete')}
          >
            <Trash2 aria-hidden />
          </Button>
        )}
      </>
    );
  };

  // Seluruh kartu/baris/ubin membuka riwayat servis; tombol di dalamnya tidak.
  const recordProps = (c: Customer) => ({
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => setHistoryCustomer(c),
    onKeyDown: openOnKey(c),
    title: t('customers.viewHistory'),
  });
  const plate = 'grid shrink-0 place-items-center rounded-xl bg-secondary font-semibold text-secondary-foreground';
  const panel = 'overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60';
  const statusOf = (count: number) =>
    servicesPending ? (
      <span className="text-xs text-muted-foreground">
        <EmptyValue />
      </span>
    ) : count > 1 ? (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
        <span aria-hidden className="size-2 rounded-full bg-highlight" />
        {t('customers.loyal')}
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">
        {count === 1 ? t('customers.servedOnce') : t('customers.neverServed')}
      </span>
    );

  return (
    <div data-nu className="flex flex-col gap-4 bg-transparent">
      {/* Ringkasan membuka halaman, seperti Servis dan Kasir. Dulu ia di bawah
          chip kategori, jadi di ponsel tertutup isi lain. */}
      <SummaryStrip
        label={t('customers.summaryAria')}
        items={[
          { label: t('customers.statTotal'), short: t('customers.statTotalShort'), value: customers.length },
          {
            label: t('customers.statRepeat'),
            short: t('customers.statRepeatShort'),
            value: servicesPending ? EMPTY_VALUE : repeatCount,
          },
          { label: t('customers.statShown'), short: t('customers.statShownShort'), value: rows.length },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-[380px] min-w-[220px] flex-1">
          <TextInput
            capitalize="none"
            placeholder={t('customers.searchPh')}
            aria-label={t('customers.searchPh')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            start={<Search aria-hidden />}
          />
        </div>
        {/* Ponsel: tanpa wrap baris ini (urutan + tampilan + tombol) memaksa
            ~566px dan menyeret halaman ke geser samping. */}
        <div className="flex flex-wrap items-center gap-3">
          <SelectBox
            value={sort}
            onValueChange={(v) => setSort(v as SortKey)}
            aria-label={t('customers.sortLabel')}
            className="w-auto min-w-44"
            options={[
              { value: 'svc_desc', label: t('customers.sortServices') },
              { value: 'trx_desc', label: t('customers.sortValue') },
              { value: 'name_asc', label: t('customers.sortName') },
            ]}
          />
          <ViewToggle value={view} onChange={chooseView} label={t('customers.viewLabel')} />
          <Button onClick={openNew}>
            <Plus aria-hidden />
            {t('customers.new')}
          </Button>
        </div>
      </div>

      <FilterChips
        categories={categoryCounts}
        total={customers.length}
        value={activeCategory}
        onChange={setCategory}
        label={t('customers.categoryLabel')}
      />

      {loadPending(customersLoad) ? (
        <div className={panel}>
          <LoadState queries={[customersLoad]} />
        </div>
      ) : rows.length === 0 ? (
        <div className={panel}>
          <EmptyState
            icon={<Users aria-hidden />}
            title={filtered ? t('customers.noResults') : t('customers.emptyTitle')}
            description={filtered ? t('customers.noResultsHint') : t('customers.emptyHint')}
            action={
              !filtered && (
                <Button onClick={openNew}>
                  <Plus aria-hidden />
                  {t('customers.new')}
                </Button>
              )
            }
          />
        </div>
      ) : view === 'tiles' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-2">
          {rows.map((c) => {
            const st = stats.get(c.id) ?? EMPTY_CUSTOMER_STAT;
            return (
              <div
                key={c.id}
                {...recordProps(c)}
                className="flex cursor-pointer flex-col gap-2 rounded-xl bg-card px-3 py-2.5 text-card-foreground ring-1 ring-border/60 outline-none transition-[background-color,box-shadow] hover:bg-accent/50 hover:ring-primary/25 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn(plate, 'size-8 text-sm')}>{c.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{c.phone || t('customers.noPhone')}</div>
                  </div>
                </div>
                {/* Statistik + sampai tiga aksi tak selalu muat sebaris; aksi yang
                    turun baris, bukan meluap keluar ubin. */}
                <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1">
                  <span className="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                    {servicesPending ? EMPTY_VALUE : `${st.count}x · ${fmtRp(st.paidTotal)}`}
                  </span>
                  <div className="flex gap-1">{renderActions(c, true)}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : view === 'list' ? (
        // Baris daftar, tiga tingkat (ambang muat/tidak muat = container query,
        // AGENTS §4). Kasus terburuk terukur: bingkai 32 + jeda 48 + nama 176
        // (plat 44 + 12 + teks 120) + HP 14 digit 123 + "999x" & "Rp 999.999.999"
        // 175 + status & tiga tuts 44px 253 = 807px. Di bawahnya kolom HP dan
        // jumlah servis hilang (butuh 611px); di bawah itu status + tuts turun ke
        // barisnya sendiri. FixMaster memakai @media 768px, yang di 1025-1100px
        // (sidebar tampil) menyisakan wadah 667px untuk baris 807px.
        <div className="@container/cust grid gap-2">
          {rows.map((c) => {
            const st = stats.get(c.id) ?? EMPTY_CUSTOMER_STAT;
            return (
              <div
                key={c.id}
                {...recordProps(c)}
                className={cn(
                  'grid cursor-pointer items-center gap-x-4 gap-y-2 rounded-xl bg-card px-4 py-2 text-card-foreground shadow-panel ring-1 ring-border/60 outline-none transition-[box-shadow] hover:ring-primary/25 focus-visible:ring-2 focus-visible:ring-ring',
                  "grid-cols-[minmax(0,1fr)_auto_auto_auto] [grid-template-areas:'head_contacts_activity_foot']",
                  "@max-[808px]/cust:grid-cols-[minmax(0,1fr)_auto_auto] @max-[808px]/cust:[grid-template-areas:'head_activity_foot']",
                  "@max-[611px]/cust:grid-cols-[minmax(0,1fr)_auto] @max-[611px]/cust:[grid-template-areas:'head_activity'_'foot_foot']",
                )}
              >
                <div className="flex min-w-0 items-center gap-3 [grid-area:head]">
                  <span className={cn(plate, 'size-11 text-lg')}>{c.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{c.name}</div>
                    <div className="font-mono text-xs text-muted-foreground uppercase">ID-{c.id.slice(0, 6).toUpperCase()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground [grid-area:contacts] @max-[808px]/cust:hidden [&>svg]:size-3.5 [&>svg]:shrink-0">
                  <Phone aria-hidden />
                  <span className="whitespace-nowrap">{c.phone || <em className="italic">{t('customers.noPhone')}</em>}</span>
                </div>
                <div className="flex items-center justify-end gap-5 font-mono text-sm font-semibold whitespace-nowrap tabular-nums [grid-area:activity]">
                  <span
                    className={cn(
                      '@max-[808px]/cust:hidden',
                      !servicesPending && st.count > 0 ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {servicesPending ? EMPTY_VALUE : `${st.count}x`}
                  </span>
                  <span>{servicesPending ? EMPTY_VALUE : fmtRp(st.paidTotal)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 [grid-area:foot] @max-[611px]/cust:border-t @max-[611px]/cust:border-dashed @max-[611px]/cust:border-border @max-[611px]/cust:pt-2">
                  {statusOf(st.count)}
                  <div className="flex gap-1">{renderActions(c)}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(290px,100%),1fr))] gap-3">
          {rows.map((c) => {
            const st = stats.get(c.id) ?? EMPTY_CUSTOMER_STAT;
            return (
              <div
                key={c.id}
                {...recordProps(c)}
                className="flex cursor-pointer flex-col gap-3 rounded-2xl bg-card p-4 text-card-foreground shadow-panel ring-1 ring-border/60 outline-none transition-[box-shadow,translate] hover:-translate-y-0.5 hover:shadow-raised hover:ring-primary/25 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0"
              >
                <div className="flex items-center gap-3">
                  <span className={cn(plate, 'size-11 text-lg')}>{c.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{c.name}</div>
                    <div className="font-mono text-xs text-muted-foreground uppercase">ID-{c.id.slice(0, 6).toUpperCase()}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 border-y border-dashed border-border py-3 font-mono text-xs text-muted-foreground [&>svg]:size-3.5 [&>svg]:shrink-0">
                  <Phone aria-hidden />
                  <span className="truncate">{c.phone || <em className="italic">{t('customers.noPhone')}</em>}</span>
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div className="grid min-w-0 gap-0.5">
                    <span className="text-xs text-muted-foreground">{t('customers.services')}</span>
                    <span
                      className={cn(
                        'font-mono font-semibold tabular-nums',
                        !servicesPending && st.count > 0 ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {servicesPending ? EMPTY_VALUE : `${st.count}x`}
                    </span>
                  </div>
                  <div className="grid min-w-0 gap-0.5 text-right">
                    <span className="text-xs text-muted-foreground">{t('customers.paidServices')}</span>
                    <span className="font-mono font-semibold tabular-nums">{servicesPending ? EMPTY_VALUE : fmtRp(st.paidTotal)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {statusOf(st.count)}
                  <div className="flex gap-1">{renderActions(c)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CustomerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        customers={customers}
        onSaved={() => {}}
      />
      <CustomerHistoryDrawer
        open={historyCustomer !== null}
        onClose={() => setHistoryCustomer(null)}
        customer={historyCustomer}
        services={historyQuery.data}
        servicesLoad={historyQuery}
      />
      <ConfirmDialog
        open={!!toDelete}
        title={t('customers.deleteTitle')}
        message={interpolate(t('customers.deleteMessage'), { name: toDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
