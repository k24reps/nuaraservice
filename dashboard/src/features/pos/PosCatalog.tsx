import { useMemo, useState, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Boxes, Pencil, Plus, Search } from 'lucide-react';
import { LoadState, loadPending, countCategories, categoryOf } from '@/components/ui';
import { Button } from '@/components/dens/button';
import { EmptyState } from '@/components/dens/empty-state';
import { FilterChips } from '@/components/dens/filter-chips';
import { SummaryStrip } from '@/components/dens/summary-strip';
import { TextInput } from '@/components/dens/text-input';
import { cn } from '@/lib/utils';
import type { LoadQuery } from '@/components/ui/loadPending';
import { fmtRp } from '@/lib/format';
import { pickOnEnter } from '@/lib/business/pos';
import {
  filterCatalog,
  parseStockFilter,
  stockState,
  stockSummary,
  type StockFilter,
} from '@/lib/business/stock';
import { interpolate } from '@/lib/business/notify';
import { isManager, roleAllows } from '@/config/plans';
import { useSessionStore } from '@/stores/session';
import { InventoryModal } from '@/features/inventory/InventoryModal';
import { useT } from '@/i18n';
import type { InventoryItem } from '@/data/types';

/** Kartu per halaman. Dulu dipotong mati di 50 tanpa tanda ada sisanya. */
const PAGE = 60;

interface PosCatalogProps {
  inventory: InventoryItem[];
  inventoryLoad: LoadQuery;
  searchRef: RefObject<HTMLInputElement | null>;
  /** Fokus otomatis hanya untuk mouse: di ponsel ia memunculkan keyboard. */
  finePointer: boolean;
  onAdd: (item: InventoryItem) => void;
  /** Enter di kolom cari yang kosong (mis. memulai transaksi baru setelah LUNAS). */
  onEmptyEnter?: () => void;
  /** Nama cabang pemilik stok, hanya saat katalog memuat beberapa cabang. */
  branchOf?: (item: InventoryItem) => string | null;
}

/**
 * Katalog Kasir & Stok: satu kartu per barang untuk menjual DAN mengurus
 * stoknya. Ketuk kartu = masuk keranjang; owner/admin punya tuts Ubah dan
 * + Stok di kaki kartu. Strip ringkasan di atas sekaligus saringan.
 */
export function PosCatalog({
  inventory,
  inventoryLoad,
  searchRef,
  finePointer,
  onAdd,
  onEmptyEnter,
  branchOf,
}: PosCatalogProps) {
  const t = useT();
  const me = useSessionStore((s) => s.currentEmployee);
  const canManage = me ? roleAllows(me.role, 'inventory.write') : false;
  // Nilai stok = modal toko; hanya owner/admin (audit #14).
  const isMgr = me ? isManager(me.role) : false;

  // ?stock=low|out dari peringatan Dashboard dan alamat lama /inventory.
  // Diikuti juga saat halaman sudah terbuka dan alamatnya berganti.
  const [searchParams] = useSearchParams();
  const requested = parseStockFilter(searchParams.get('stock'));
  const [stockFilter, setStockFilter] = useState<StockFilter>(requested);
  const [seenRequest, setSeenRequest] = useState(requested);
  if (requested !== seenRequest) {
    setSeenRequest(requested);
    setStockFilter(requested);
  }
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  // Barang yang terakhir dibuka tetap disimpan saat modal menutup, supaya
  // judulnya tak berubah jadi "Sparepart Baru" selama animasi keluar.
  const [modal, setModal] = useState<{ editing: InventoryItem | null; restock: boolean }>({
    editing: null,
    restock: false,
  });
  const openModal = (editing: InventoryItem | null, restock = false) => {
    setModal({ editing, restock });
    setModalOpen(true);
  };

  const summary = useMemo(() => stockSummary(inventory), [inventory]);
  const categories = useMemo(
    () => [...new Set(inventory.map((i) => i.category).filter(Boolean))].sort(),
    [inventory],
  );
  // Chip kategori menghitung barang di saringan stok yang aktif: di "Habis",
  // angkanya = berapa yang perlu dibeli per kategori.
  const categoryCounts = useMemo(
    () =>
      countCategories(
        stockFilter === 'all' ? inventory : inventory.filter((i) => stockState(i) === stockFilter),
      ),
    [inventory, stockFilter],
  );
  const categoryTotal = categoryCounts.reduce((n, [, count]) => n + count, 0);
  // Kategori yang hilang dari saringan ini tak lagi punya chip; pilihan lama
  // jangan sampai mengunci katalog di daftar kosong.
  const activeCategory = categoryCounts.some(([c]) => c === category) ? category : 'all';

  // Barang habis TETAP tampil, redup, di ujung daftar. Disembunyikan, kasir
  // membaca "tidak ada" dan mengira barangnya tak terdaftar; owner kehilangan
  // tempat untuk mengisinya lagi.
  const rows = useMemo(
    () =>
      filterCatalog(inventory, {
        stock: stockFilter,
        query,
        inCategory: activeCategory === 'all' ? undefined : (i) => categoryOf(i.category) === activeCategory,
      }),
    [inventory, stockFilter, query, activeCategory],
  );
  // Batas tampil kembali ke satu halaman tiap saringan berubah.
  const filterKey = `${stockFilter}|${activeCategory}|${query.trim()}`;
  const [shown, setShown] = useState({ key: filterKey, n: PAGE });
  const limit = shown.key === filterKey ? shown.n : PAGE;
  const visible = rows.slice(0, limit);

  const pickStock = (f: StockFilter) => () =>
    // Mengetuk saringan yang sedang aktif mengembalikannya ke Semua.
    setStockFilter((cur) => (cur === f ? 'all' : f));

  const onSearchEnter = () => {
    if (onEmptyEnter && !query.trim()) {
      onEmptyEnter();
      return;
    }
    const hit = pickOnEnter(inventory, rows, query);
    if (!hit) return;
    onAdd(hit);
    setQuery('');
  };

  const stateLabel = { out: t('inventory.statOut'), low: t('inventory.statLow'), ok: '' };

  const panel = 'overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60';

  return (
    <>
      <SummaryStrip
        label={t('pos.stockFilterAria')}
        items={[
          { label: t('pos.statAll'), value: summary.total, onSelect: pickStock('all'), pressed: stockFilter === 'all' },
          {
            label: t('inventory.statLow'),
            value: summary.low,
            tone: summary.low > 0 ? 'warning' : undefined,
            onSelect: pickStock('low'),
            pressed: stockFilter === 'low',
          },
          {
            label: t('inventory.statOut'),
            value: summary.out,
            tone: summary.out > 0 ? 'danger' : undefined,
            onSelect: pickStock('out'),
            pressed: stockFilter === 'out',
          },
          ...(isMgr ? [{ label: t('inventory.statValue'), value: fmtRp(summary.value), wide: true }] : []),
        ]}
      />
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <TextInput
            ref={searchRef}
            placeholder={t('pos.searchPlaceholder')}
            aria-label={t('pos.searchPlaceholder')}
            value={query}
            autoFocus={finePointer}
            capitalize="none"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                // Enter yang ditahan tidak boleh ikut menutup LUNAS.
                if (!e.repeat) onSearchEnter();
              }
            }}
            start={<Search aria-hidden />}
            className={finePointer ? 'pr-10' : undefined}
          />
          {finePointer && (
            <kbd
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1.5 font-mono text-xs text-muted-foreground ring-1 ring-border"
            >
              /
            </kbd>
          )}
        </div>
        {canManage && (
          <Button variant="outline" className="shrink-0" onClick={() => openModal(null)} aria-label={t('pos.addItemAria')}>
            <Plus aria-hidden />
            {t('pos.addItem')}
          </Button>
        )}
      </div>
      <FilterChips
        categories={categoryCounts}
        total={categoryTotal}
        value={activeCategory}
        onChange={setCategory}
        label={t('pos.categoryLabel')}
      />
      {loadPending(inventoryLoad) ? (
        <div className={panel}>
          <LoadState queries={[inventoryLoad]} />
        </div>
      ) : rows.length === 0 ? (
        <div className={panel}>
          {inventory.length === 0 ? (
            <EmptyState
              icon={<Boxes aria-hidden />}
              title={t('pos.noStockTitle')}
              description={canManage ? t('inventory.emptyFirst') : t('pos.noStockBody')}
              action={
                canManage && (
                  <Button onClick={() => openModal(null)}>
                    <Plus aria-hidden />
                    {t('pos.addItemAria')}
                  </Button>
                )
              }
            />
          ) : (
            <EmptyState icon={<Search aria-hidden />} title={t('pos.noMatchTitle')} description={t('pos.noMatchBody')} />
          )}
        </div>
      ) : (
        <>
          {/* Satu tampilan saja: kartu. Nama turun baris utuh, jadi nomor model
              di ujungnya (A1989, Pro Max) tetap terbaca. Kartu = <article>;
              tombol tambah dan tuts kelola bersaudara, tak pernah bersarang.
              Ponsel: dua kolom tetap (selera, bukan muat/tidak muat). */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3 phone:grid-cols-2">
            {visible.map((item) => {
              const st = stockState(item);
              const branch = branchOf?.(item);
              return (
                <article
                  key={item.id}
                  data-state={st}
                  className={cn(
                    'flex min-w-0 flex-col overflow-hidden rounded-2xl bg-card shadow-panel ring-1 ring-border/60',
                    // Hanya keadaan yang menuntut tindakan yang berwarna: menipis, habis.
                    st === 'low' && 'ring-warning-foreground/45',
                    st === 'out' && 'ring-destructive/40',
                  )}
                >
                  <button
                    type="button"
                    className="flex min-h-28 flex-1 flex-col gap-1.5 p-3.5 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:hover:bg-transparent [&:disabled>*]:opacity-55 phone:p-3"
                    onClick={() => onAdd(item)}
                    disabled={st === 'out'}
                  >
                    <span className="text-sm font-semibold leading-snug [overflow-wrap:anywhere]">{item.name}</span>
                    {branch && <span className="text-xs text-muted-foreground">{branch}</span>}
                    <span className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          aria-hidden
                          className={cn(
                            'size-2 shrink-0 rounded-full',
                            st === 'out' ? 'bg-destructive' : st === 'low' ? 'bg-warning-foreground' : 'bg-success-foreground',
                          )}
                        />
                        <span className="font-mono font-semibold tabular-nums text-foreground">{item.stock}</span>
                        <span>· {interpolate(t('pos.minStock'), { n: String(item.minStock) })}</span>
                        {stateLabel[st] && <span className="sr-only">{stateLabel[st]}</span>}
                      </span>
                      <strong className="font-mono text-sm font-semibold tabular-nums">{fmtRp(item.sellPrice)}</strong>
                    </span>
                  </button>
                  {canManage && (
                    <div className="flex border-t border-border/70">
                      <button
                        type="button"
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring pointer-coarse:min-h-11 [&_svg]:size-3.5"
                        onClick={() => openModal(item)}
                        aria-label={interpolate(t('pos.editItemAria'), { name: item.name })}
                      >
                        <Pencil aria-hidden /> {t('inventory.edit')}
                      </button>
                      {st !== 'ok' && (
                        <button
                          type="button"
                          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 border-l border-border/70 text-xs font-semibold text-warning-foreground outline-none transition-colors hover:bg-warning focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring pointer-coarse:min-h-11 [&_svg]:size-3.5"
                          onClick={() => openModal(item, true)}
                          aria-label={interpolate(t('pos.restockAria'), { name: item.name })}
                        >
                          <Plus aria-hidden /> {t('pos.restock')}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {rows.length > limit && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-xs text-muted-foreground">
                {interpolate(t('pos.shownOf'), { shown: String(limit), total: String(rows.length) })}
              </span>
              <Button variant="outline" onClick={() => setShown({ key: filterKey, n: limit + PAGE })}>
                {interpolate(t('pos.showMore'), { n: String(Math.min(PAGE, rows.length - limit)) })}
              </Button>
            </div>
          )}
        </>
      )}
      {canManage && (
        <InventoryModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          editing={modal.editing}
          restock={modal.restock}
          categories={categories}
          canDelete
        />
      )}
    </>
  );
}
