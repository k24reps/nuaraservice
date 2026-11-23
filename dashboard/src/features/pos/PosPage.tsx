import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowRight,
  ArrowUp,
  ChevronDown,
  CircleCheck,
  History,
  LoaderCircle,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShoppingCart,
  Tag,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { FormDialog } from '@/components/dens/form-dialog';
import { TextInput } from '@/components/dens/text-input';
import { WhatsAppIcon } from '@/components/dens/whatsapp-icon';
import { cn } from '@/lib/utils';
import { useCollection } from '@/hooks/useCollection';
import { repository } from '@/data';
import { processSale } from '@/data/supabase-client';
import { isCloudMode } from '@/stores/demo';
import { isManager } from '@/config/plans';
import { logActivity } from '@/lib/activity';
import { newId, nextDocNumber } from '@/lib/id';
import { fmtRp, fmtRpInput, parseRpInput } from '@/lib/format';
import { localDateStr, monthRange } from '@/lib/time';
import {
  cartSubtotal,
  resolveDiscount,
  discountLimit,
  STAFF_MAX_DISCOUNT_PCT,
  cartTotal,
  validateCart,
  settleTender,
  changeRowIndex,
  cashSuggestions,
  payBarState,
  payBarReady,
  toSaleLines,
  type CartItem,
  type DiscountType,
} from '@/lib/business/pos';
import { searchCustomers } from '@/lib/business/customers';
import { interpolate, waLink } from '@/lib/business/notify';
import { useT } from '@/i18n';
import { walletsForOutlet } from '@/lib/business/finance';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import { printSaleReceipt } from './printSaleReceipt';
import { saleWaMessage } from './saleWaMessage';
import { PosCatalog } from './PosCatalog';
import { PosHistory } from './PosHistory';
import { CustomerModal } from '@/features/customers/CustomerModal';
import { toast } from '@/stores/toast';
import { useSessionStore, resolveCreateOutlet, mustPickOutlet } from '@/stores/session';
import type { Customer, InventoryItem, Sale, PaymentAllocation } from '@/data/types';
import { useListNav } from '@/hooks/useListNav';

export function PosPage() {
  const { data: inventory, ...inventoryLoad } = useCollection('inventory');
  const { data: allWallets } = useCollection('wallets');
  const { data: sales, ...salesLoad } = useCollection('sales');
  const { data: outlets } = useCollection('outlets');
  // Pelanggan dicari di server; daftar lokal hanya untuk adapter lokal/demo.
  const serverSearch = !!repository.queryCustomers;
  const { data: customers } = useCollection('customers', { enabled: !serverSearch });
  const t = useT();
  const me = useSessionStore((s) => s.currentEmployee);
  const org = useSessionStore((s) => s.org);
  const activeOutletId = useSessionStore((s) => s.activeOutletId);
  // Cara bayar = wallet bersama + wallet cabang ini (0095). "Tunai Pusat" tidak
  // ditawarkan di meja Dago; server menolaknya juga.
  const wallets = walletsForOutlet(allWallets, activeOutletId);
  const cashIds = new Set(wallets.filter((w) => w.isCash).map((w) => w.id));
  const allowedOutletIds = useSessionStore((s) => s.allowedOutletIds);
  const setActiveOutlet = useSessionStore((s) => s.setActiveOutlet);
  const reachableOutlets = allowedOutletIds.length
    ? outlets.filter((o) => allowedOutletIds.includes(o.id))
    : outlets;
  // Mesin kasir milik satu meja: di "Semua Outlet" katalognya campuran stok
  // beberapa cabang. Katalog boleh dijelajah (owner memeriksa stok semua
  // cabang di sini), tapi cabang dipilih SEBELUM barang pertama masuk
  // keranjang — bukan ditolak setelah keranjang dan pembayaran terisi
  // (critique 27 Sep 2026). activeOutletId dibaca di atas supaya komponen
  // ini ikut render ulang.
  const needOutlet = mustPickOutlet(outlets.length);
  const activeOutlet = outlets.find((o) => o.id === activeOutletId) ?? null;
  const orgId = org?.id ?? '';
  const isMgr = me ? isManager(me.role) : false;
  // Penjualan bulan lalu tidak bisa dibatalkan (0069): laporan bulan itu sudah berjalan.
  const monthStart = monthRange().from;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('amount');
  // Uang yang DITERIMA per wallet, urut sesuai ketukan; kembalian dipotong dari
  // baris terakhir (settleTender).
  const [tender, setTender] = useState<PaymentAllocation[]>([]);
  const [busy, setBusy] = useState(false);
  // Keadaan LUNAS setelah transaksi: register menahan total & kembalian, dan
  // struk tersedia tepat saat pelanggan masih di depan meja.
  const [done, setDone] = useState<{ sale: Sale; change: number; phone: string } | null>(null);
  const [outletModal, setOutletModal] = useState(false);
  // Barang yang diketuk di "Semua Outlet": masuk keranjang setelah cabang dipilih.
  const [pendingItem, setPendingItem] = useState<InventoryItem | null>(null);
  // Isi keranjang terakhir yang dikosongkan — "Kosongkan" dulu tanpa jalan kembali.
  const [cleared, setCleared] = useState<{
    cart: CartItem[];
    discount: string;
    discountType: DiscountType;
    tender: PaymentAllocation[];
    customer: Customer | null;
  } | null>(null);
  const [outletNotice, setOutletNotice] = useState(false);
  const [cartOutlet, setCartOutlet] = useState(activeOutletId);
  const [cartInView, setCartInView] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // Fokus otomatis hanya untuk mouse: di ponsel ia memunculkan keyboard.
  const [finePointer] = useState(() => !!window.matchMedia?.('(pointer: fine)').matches);
  const [tab, setTab] = useState<'pos' | 'history'>('pos');
  // Pelanggan transaksi (opsional): belanja sparepart pun jadi bagian riwayat
  // orangnya, bukan penjualan anonim yang tak bisa ditelusuri lagi.
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [custQuery, setCustQuery] = useState('');
  // Pelanggan & diskon dilipat jadi dua tombol: keduanya opsional dan dulu
  // memakan 104px yang mendorong Proses keluar layar di laptop 768px.
  const [custOpen, setCustOpen] = useState(false);
  const [discOpen, setDiscOpen] = useState(false);
  const custInputRef = useRef<HTMLInputElement>(null);
  const discInputRef = useRef<HTMLInputElement>(null);
  const showCust = custOpen || !!customer || custQuery !== '';
  const showDisc = discOpen || discount !== '';
  // Tombolnya hilang saat diklik, jadi fokus harus pindah ke kolom yang baru
  // muncul. Dipakai juga saat pelanggan dilepas: kolom cari langsung siap.
  const openCust = () => {
    setCustomer(null);
    setCustOpen(true);
    requestAnimationFrame(() => custInputRef.current?.focus());
  };
  const openDisc = () => {
    setDiscOpen(true);
    requestAnimationFrame(() => discInputRef.current?.focus());
  };

  // Transaksi terbaru (terbaru dulu): untuk cetak ulang struk & pembatalan.
  // Delapan baris tidak cukup bahkan untuk satu hari kasir yang ramai.
  const recentSales = useMemo(
    () => [...sales].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 30),
    [sales],
  );

  const { results: remoteCustomers, pending: custPending } = useCustomerSearch({ enabled: true, term: custQuery });
  const [custModal, setCustModal] = useState(false);
  // `searchCustomers` tetap yang memutuskan — server hanya mempersempit kandidat.
  const custMatches = useMemo(
    () => searchCustomers(serverSearch ? remoteCustomers : customers, custQuery),
    [serverSearch, remoteCustomers, customers, custQuery],
  );
  // Panah + Enter di kolom pelanggan: baris cocok, lalu "Tambah pelanggan baru".
  const showCustMatches = !!custQuery.trim() && !(serverSearch && custQuery.trim().length < 3);
  const custOptions = showCustMatches ? custMatches.length : 0;
  // Daftar saran menutupi diskon dan tuts bayar di ponsel. Escape atau
  // ketukan di luar menutupnya; teksnya tetap, mengetik atau fokus lagi
  // membukanya kembali.
  const [suggestOpen, setSuggestOpen] = useState(true);
  const custBoxRef = useRef<HTMLDivElement>(null);
  const custListOpen = suggestOpen && !!custQuery.trim();
  useEffect(() => {
    if (!custListOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!custBoxRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [custListOpen]);
  const custNav = useListNav(custListOpen ? custOptions + 1 : 0, (i) => {
    if (i < custOptions) {
      setCustomer(custMatches[i]);
      setCustQuery('');
    } else setCustModal(true);
  });

  const subtotal = cartSubtotal(cart);
  const discountValue = resolveDiscount(subtotal, parseRpInput(discount), discountType);
  const total = cartTotal(cart, parseRpInput(discount), discountType);
  const settle = settleTender(tender, total, cashIds);
  // Riwayat bisa memuat wallet cabang lain / yang sudah dipindah — cari di semua.
  const walletName = (id: string | null) => allWallets.find((w) => w.id === id)?.name ?? '';
  // Baris yang menyerahkan kembalian: tunai terakhir, atau baris terakhir.
  const changeTender = tender[changeRowIndex(tender, cashIds)];
  const quickCash = changeTender
    ? cashSuggestions(total - (settle.paid - Math.max(0, changeTender.amount)))
    : [];
  // Diskon besar = uang toko keluar tanpa persetujuan. Karyawan dibatasi;
  // server menolaknya juga (0070), ini hanya supaya batasnya terbaca lebih awal.
  const maxDiscount = discountLimit(subtotal, isMgr);
  const discountOver = discountValue > maxDiscount;
  const totalQty = cart.reduce((n, c) => n + c.qty, 0);
  const nextNo = useMemo(() => nextDocNumber('INV', sales.map((s) => s.saleNo)), [sales]);
  const totalText = fmtRp(done ? done.sale.total : total);

  // Cabang berganti dari mana pun (register, sidebar, menu ponsel): stok di
  // keranjang milik cabang lama, jadi keranjang dikosongkan dan diberi tahu —
  // dulu keranjang tetap, lalu checkout gagal dengan "Stok … berubah" palsu.
  if (cartOutlet !== activeOutletId) {
    setCartOutlet(activeOutletId);
    if (cart.length) {
      setCart([]);
      setTender([]);
      setDiscount('');
      setOutletNotice(true);
    }
  }

  // Dock ponsel hanya berguna selama register belum terlihat. Ia menyerahkan
  // tempatnya ke bar Proses yang menempel di atas menu bawah: garis serah
  // terimanya = tepi atas dock, supaya keduanya tak pernah tampil bertumpuk
  // atau sama-sama hilang di tengah guliran.
  //
  // Tepi itu DIUKUR, bukan dihitung dari CSS: aturan min-height global membuat
  // dock tergambar 44px, bukan 56px, dan zoom aplikasi memperbesar menu + dock
  // tanpa mengubah token. Tebakan "menu + 72" meleset di keduanya. Dock yang
  // display:none (>720px) tak punya tinggi; angka itu diabaikan.
  const [dockReach, setDockReach] = useState(0);
  const measureDock = useCallback((dock: HTMLButtonElement | null) => {
    const r = dock?.getBoundingClientRect();
    if (r && r.height > 0) setDockReach(Math.round(window.innerHeight - r.top));
  }, []);
  useEffect(() => {
    const el = document.getElementById('pos-cart');
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mobile-nav-height')) || 0;
    const reach = dockReach || Math.round(nav + 72);
    // Entri TERAKHIR yang berlaku. Sesudah cabang dipilih, satu panggilan bisa
    // membawa dua entri untuk panel yang sama ([false, true]); membaca yang
    // pertama membuat dock bertahan di atas Proses (terukur di 320px: ketukan
    // ke Proses mengenai dock dan halaman malah menggulir).
    const io = new IntersectionObserver((entries) => {
      const latest = entries[entries.length - 1];
      if (latest) setCartInView(latest.isIntersecting);
    }, { rootMargin: `0px 0px -${reach}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [tab, needOutlet, dockReach]);

  // "/" memfokuskan pencarian dari mana saja di halaman (kecuali saat mengetik).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (!searchRef.current) return;
      e.preventDefault();
      searchRef.current.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const addToCart = (item: InventoryItem) => {
    if (item.stock <= 0) {
      toast.warning(t('pos.outOfStockToast').replace('{name}', item.name));
      return;
    }
    // Dicek di luar updater: updater setState dijalankan dua kali di StrictMode,
    // dan toast di dalamnya dulu muncul kembar.
    const inCart = cart.find((c) => c.itemId === item.id);
    if (inCart && inCart.qty >= item.stock) {
      toast.warning(interpolate(t('pos.stockLimit'), { name: item.name, n: String(item.stock) }));
      return;
    }
    setDone(null);
    setOutletNotice(false);
    setCleared(null);
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.itemId === item.id ? { ...c, qty: Math.min(c.qty + 1, item.stock) } : c,
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          qty: 1,
          sellPrice: item.sellPrice,
          costPrice: item.costPrice,
          stock: item.stock,
        },
      ];
    });
  };

  const requestAdd = (item: InventoryItem) => {
    if (needOutlet && item.stock > 0) {
      setPendingItem(item);
      setOutletModal(true);
      return;
    }
    addToCart(item);
  };

  const setQty = (itemId: string, qty: number) => {
    const item = cart.find((c) => c.itemId === itemId);
    if (item && qty > item.stock) {
      toast.warning(interpolate(t('pos.stockLimit'), { name: item.name, n: String(item.stock) }));
    }
    setCart((prev) =>
      prev
        .map((c) => (c.itemId === itemId ? { ...c, qty: Math.max(0, Math.min(qty, c.stock)) } : c))
        .filter((c) => c.qty > 0),
    );
  };

  const reveal = (el: HTMLElement | null, block: ScrollLogicalPosition) => {
    if (!el) return null;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block });
    return el;
  };

  // Tombol wallet: yang belum dipakai ditambahkan dengan SISA tagihan, jadi
  // pembayaran pas cukup satu ketukan; yang sudah dipakai difokuskan saja.
  const pickWallet = (walletId: string) => {
    if (tender.some((p) => p.walletId === walletId)) {
      document.getElementById(`tender-${walletId}`)?.focus();
      return;
    }
    setTender((prev) => [...prev, { walletId, amount: Math.max(0, settle.due) }]);
    // Di layar sentuh kolom nominal, nominal cepat, dan status muncul di
    // bawah tuts, tepat di balik bar Proses yang menempel. Geser secukupnya
    // supaya terlihat (scroll-margin di CSS memberi ruang bar).
    if (!finePointer) requestAnimationFrame(() => reveal(document.getElementById('pos-pay-status'), 'nearest'));
  };
  // Nominal diubah DI TEMPAT — urutan baris tetap, karena baris terakhir yang
  // menyerahkan kembalian.
  const setTenderAmount = (walletId: string, amount: number) =>
    setTender((prev) => prev.map((p) => (p.walletId === walletId ? { ...p, amount } : p)));
  const removeTender = (walletId: string) =>
    setTender((prev) => prev.filter((p) => p.walletId !== walletId));

  const reset = () => {
    setCart([]);
    setDiscount('');
    setTender([]);
    setCustomer(null);
    setCustQuery('');
    setCustOpen(false);
    setDiscOpen(false);
  };

  const clearCart = () => {
    setCleared({ cart, discount, discountType, tender, customer });
    reset();
    searchRef.current?.focus();
  };
  const restoreCart = () => {
    if (!cleared) return;
    setCart(cleared.cart);
    setDiscount(cleared.discount);
    setDiscountType(cleared.discountType);
    setTender(cleared.tender);
    setCustomer(cleared.customer);
    setCleared(null);
  };

  const newSale = () => {
    setDone(null);
    searchRef.current?.focus();
  };

  const chooseOutlet = (id: string) => {
    setOutletModal(false);
    setOutletNotice(false);
    setDone(null);
    const item = pendingItem;
    setPendingItem(null);
    if (item && cart.length === 0) {
      // Keranjang dimulai di cabang ini. Tanpa ini, cek pergantian cabang di
      // render berikutnya mengosongkannya lagi.
      setCartOutlet(id);
      if (item.outletId && item.outletId !== id) {
        toast.warning(t('pos.notInOutlet').replace('{name}', item.name));
      } else {
        addToCart(item);
      }
    }
    setActiveOutlet(id);
  };

  const statusText = settle.ok
    ? settle.change > 0
      ? interpolate(t('pos.statusChange'), {
          amount: fmtRp(settle.change),
          wallet: walletName(settle.changeWalletId),
        })
      : t('pos.statusExact')
    : settle.excess
      ? interpolate(t('pos.statusExcess'), { wallet: walletName(changeTender?.walletId ?? null) })
      : settle.paid === 0
        ? interpolate(t('pos.statusEmpty'), { amount: fmtRp(total) })
        : interpolate(t('pos.statusDue'), { amount: fmtRp(settle.due) });

  // Bar Proses menyebut keadaan uang. Selama belum siap, ia tetap bisa
  // diketuk (aria-disabled, bukan disabled) dan menuntun ke kolom yang kurang.
  const bar = payBarState(settle, tender.length, discountOver);
  const barReady = payBarReady(bar);
  const guidePay = () => {
    const target =
      bar.kind === 'discount'
        ? discInputRef.current
        : bar.kind === 'pick'
          ? document.querySelector<HTMLElement>('#pos-tender-keys button')
          : document.getElementById(`tender-${changeTender?.walletId ?? ''}`);
    reveal(target, 'center')?.focus({ preventScroll: true });
  };
  const payReadout: { caption: string; value: string } | null =
    bar.kind === 'pick'
      ? { caption: t('common.total'), value: fmtRp(total) }
      : bar.kind === 'due'
        ? { caption: t('pos.lcdDue'), value: fmtRp(bar.amount) }
        : bar.kind === 'change'
          ? { caption: t('pos.lcdChange'), value: fmtRp(bar.amount) }
          : bar.kind === 'exact'
            ? { caption: t('pos.lcdChange'), value: t('pos.lcdExact') }
            : null;
  const payAction = {
    discount: t('pos.payDiscount'),
    pick: t('pos.payPick'),
    excess: t('pos.payExcess'),
    due: t('pos.payDue'),
    change: t('pos.payProcess'),
    exact: t('pos.payProcess'),
  }[bar.kind];

  const checkout = async () => {
    const cartCheck = validateCart(cart);
    if (!cartCheck.ok) {
      toast.error(cartCheck.errors[0]);
      return;
    }
    if (!settle.ok) {
      toast.error(statusText);
      return;
    }
    const payments = settle.allocations;
    if (discountOver) {
      toast.error(
        interpolate(t('pos.staffDiscountToast'), { pct: String(STAFF_MAX_DISCOUNT_PCT), amount: fmtRp(maxDiscount) }),
      );
      return;
    }
    // OQ-C: a user who can reach multiple outlets must pick a specific branch
    // first, so the sale is tagged to the right outlet (not guessed).
    if (needOutlet) {
      setOutletModal(true);
      return;
    }
    const txOutletId = resolveCreateOutlet(outlets);
    setBusy(true);
    const now = new Date().toISOString();
    try {
      const saleNo = nextDocNumber('INV', sales.map((s) => s.saleNo));
      const draft: Sale = {
        id: newId(),
        orgId,
        outletId: txOutletId,
        saleNo,
        date: localDateStr(),
        lines: toSaleLines(cart),
        subtotal,
        discount: discountValue,
        discountType,
        total,
        payments,
        cashierId: me?.id ?? '',
        cashierName: me?.name ?? '',
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? '',
        voided: false,
        voidedReason: '',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      let saleId = draft.id;
      let savedNo = saleNo;

      if (isCloudMode()) {
        // Cloud: atomic, server-side RPC. This is the ONLY path that lets a
        // staff cashier complete a sale, since wallet/inventory writes are
        // manager-only under RLS. Stock re-validation + deduction, wallet
        // credit, and income insert all happen in one transaction.
        // Harga, HPP, total & pembayaran divalidasi ulang di server (0069);
        // nomornya juga ditetapkan server — tampilkan yang tersimpan.
        ({ id: saleId, saleNo: savedNo } = await processSale({
          orgId,
          saleNo,
          lines: toSaleLines(cart),
          payments,
          subtotal,
          discount: discountValue,
          discountType,
          total,
          outletId: txOutletId,
          customerId: customer?.id ?? null,
        }));
      } else {
        // Local: re-validate stock against latest inventory (multi-device safety).
        const fresh = await repository.list('inventory');
        for (const c of cart) {
          const item = fresh.find((i) => i.id === c.itemId);
          if (!item || item.stock < c.qty) {
            toast.error(
              item
                ? interpolate(t('pos.stockChanged'), { name: c.name })
                : t('pos.notInOutlet').replace('{name}', c.name),
            );
            setBusy(false);
            return;
          }
        }
        await repository.put('sales', draft);

        // Deduct stock.
        const updatedInv = fresh
          .filter((i) => cart.some((c) => c.itemId === i.id))
          .map((i) => {
            const c = cart.find((x) => x.itemId === i.id)!;
            return { ...i, stock: i.stock - c.qty };
          });
        await repository.putMany('inventory', updatedInv);

        // Record income + credit wallets per allocation. Description must stay
        // 'Penjualan <no>' so void_sale's fallback match still works.
        for (const p of payments) {
          const wallet = wallets.find((w) => w.id === p.walletId);
          if (!wallet) continue;
          await repository.put('incomes', {
            id: newId(),
            orgId,
            outletId: txOutletId,
            date: localDateStr(),
            category: 'Penjualan',
            amount: p.amount,
            walletId: p.walletId,
            description: `Penjualan ${saleNo}`,
            serviceId: null,
            saleId,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          });
          await repository.put('wallets', { ...wallet, balance: wallet.balance + p.amount });
        }
      }

      // Salinan untuk struk segera — server sudah menyimpan yang asli, tapi
      // pelanggan menunggu sekarang, bukan setelah realtime tiba.
      setDone({
        sale: { ...draft, id: saleId, saleNo: savedNo },
        change: settle.change,
        phone: customer?.phone ?? '',
      });
      if (finePointer) searchRef.current?.focus();
      logActivity({
        action: 'sale.create',
        entityType: 'sale',
        entityId: saleId,
        entityLabel: savedNo,
        meta: { total, items: cart.length },
        outletId: txOutletId,
      });
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('pos.processFailed'));
    } finally {
      setBusy(false);
    }
  };

  const outletButtons = (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(12.5rem,100%),1fr))] gap-2">
      {reachableOutlets.map((o) => (
        <button
          key={o.id}
          type="button"
          className="flex min-h-11 items-center gap-2.5 rounded-xl bg-card px-3.5 text-left text-sm font-medium ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-primary"
          aria-pressed={o.id === activeOutletId}
          onClick={() => chooseOutlet(o.id)}
        >
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{o.name}</span>
          {o.isPrimary && <Badge variant="secondary">{t('pos.outletMain')}</Badge>}
        </button>
      ))}
    </div>
  );

  // Baris kedua total: yang harus dilihat kasir berikutnya — sisa, kembalian, pas.
  const lcdSub: { label: string; value: string; tone: 'due' | 'change' | 'exact' } | null = done
    ? done.change > 0
      ? { label: t('pos.lcdChange'), value: fmtRp(done.change), tone: 'change' }
      : { label: t('pos.lcdExact'), value: done.sale.saleNo, tone: 'exact' }
    : cart.length === 0 || settle.paid === 0
      ? null
      : settle.excess
        ? { label: t('pos.lcdExcess'), value: fmtRp(settle.change), tone: 'due' }
        : settle.change > 0
          ? { label: t('pos.lcdChange'), value: fmtRp(settle.change), tone: 'change' }
        : settle.due > 0
          ? { label: t('pos.lcdDue'), value: fmtRp(settle.due), tone: 'due' }
          : { label: t('pos.lcdExact'), value: '', tone: 'exact' };

  // Kolom yang dituju (fokus, ketukan bar, tuts bayar) mendarat di atas bar
  // Proses yang menempel, bukan di baliknya. 96px ≈ tinggi bar + jeda; di ponsel
  // bar duduk di atas menu bawah.
  const clearOfBar = 'drawer:scroll-mb-24 phone:scroll-mb-[calc(var(--mobile-nav-height)+var(--space-2)+96px)]';
  const clearOfBarInside =
    'drawer:[&_:is(input,button)]:scroll-mb-24 phone:[&_:is(input,button)]:scroll-mb-[calc(var(--mobile-nav-height)+var(--space-2)+96px)]';
  const money = 'font-mono tabular-nums';

  return (
    <div
      className={cn(
        // Posisi diam register = margin topbar (14px) + topbar + padding atas
        // konten. Register menempel di titik yang SAMA, jadi ia tak pernah
        // bergeser dan tingginya bisa dihitung tanpa mengukur DOM.
        'flex flex-col gap-4 [--pos-register-top:calc(14px+var(--topbar-height)+var(--space-6))]',
        // Ponsel: ruang untuk dock keranjang di atas menu bawah.
        'phone:pb-[calc(var(--mobile-nav-height)+76px+env(safe-area-inset-bottom))]',
        // Register setinggi layar, sejajar tab (bukan di bawahnya). Dulu register
        // mulai di bawah tab tapi tingginya dihitung seolah sudah menempel, jadi
        // saat halaman dibuka Proses jatuh 39px di bawah layar (1366×768).
        // Kolom sama dengan tata letak di bawah; tata letak itu hanya "dibuka"
        // (contents) agar tab duduk di kolom kiri saja.
        tab === 'pos' &&
          'min-[1025px]:grid min-[1025px]:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] min-[1025px]:grid-rows-[auto_1fr] min-[1025px]:items-start',
      )}
    >
      {/* data-nu per bagian, bukan di akar: Riwayat (PosHistory) masih CSS
          FixMaster sampai L-61 dan tak boleh kena reset dens. */}
      <div data-nu className="flex gap-5 border-b border-border bg-transparent" role="tablist">
        {(
          [
            ['pos', 'pos-tab-register', ShoppingCart, t('pos.tabRegister')],
            ['history', 'pos-tab-history', History, t('pos.tabHistory')],
          ] as const
        ).map(([id, domId, Glyph, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={domId}
            aria-selected={tab === id}
            aria-controls={tab === id ? 'pos-panel' : undefined}
            className="-mb-px inline-flex min-h-10 items-center gap-1.5 border-b-2 border-transparent px-0.5 text-sm font-semibold whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-selected:border-foreground aria-selected:text-foreground pointer-coarse:min-h-11 [&_svg]:size-4 [&_svg]:shrink-0"
            onClick={() => setTab(id)}
          >
            <Glyph aria-hidden /> {label}
            {/* Kasir juga perlu tab Riwayat: di situlah struk dicetak ulang.
                Pembatalan tetap milik manager. */}
            {id === 'history' && recentSales.length > 0 && (
              <span className="text-xs font-medium tabular-nums text-muted-foreground">{recentSales.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'pos' && (
      <div
        data-nu
        // minmax, bukan 400px mati: kolom keranjang boleh mengembalikan ruang
        // saat wadahnya sempit. Ambang 1 vs 2 kolom terikat KEHADIRAN SIDEBAR (di
        // <=1024px sidebar hilang sehingga wadah justru melebar), jadi tak bisa
        // dijadikan container query; ruang sempit diserap trek-nya sendiri (zoom
        // 125% di jendela 1097px dulu meluber 31px). minmax(0, 1fr), bukan 1fr:
        // minimum 1fr = isi terpanjang, dan baris chip kategori melebarkan
        // seluruh kolom (13 kategori = 1266px di layar 390px).
        className="grid grid-cols-[minmax(0,1fr)_minmax(320px,400px)] items-start gap-4 bg-transparent drawer:grid-cols-[minmax(0,1fr)] min-[1025px]:contents"
        id="pos-panel"
        role="tabpanel"
        aria-labelledby="pos-tab-register"
      >
        <div className="flex min-w-0 flex-col gap-4 min-[1025px]:col-start-1 min-[1025px]:row-start-2">
          <PosCatalog
            inventory={inventory}
            inventoryLoad={inventoryLoad}
            searchRef={searchRef}
            finePointer={finePointer}
            onAdd={requestAdd}
            onEmptyEnter={done ? newSale : undefined}
            branchOf={needOutlet ? (i) => outlets.find((o) => o.id === i.outletId)?.name ?? null : undefined}
          />
        </div>

      <section
        id="pos-cart"
        aria-label={t('pos.cart')}
        className={cn(
          'relative flex flex-col overflow-clip rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60',
          // Dock ponsel menggulir ke sini; tanpa ini total mendarat di bawah header.
          'scroll-mt-[calc(var(--topbar-height)+var(--space-3))]',
          // Desktop: register setinggi layar di kolom kanan; total dan bar Proses
          // menempel, hanya struk yang menggulir. Jaring pengaman: bila bagian
          // bayar sendiri lebih tinggi dari layar (tiga tender + diskon di layar
          // pendek), seluruh register menggulir, dan kolom yang difokus mendarat
          // di antara total dan bar Proses (scroll-padding ≈ tinggi keduanya:
          // register 140px, 170px dengan baris sisa; bar 84px).
          'min-[1025px]:sticky min-[1025px]:top-(--pos-register-top) min-[1025px]:col-start-2 min-[1025px]:row-span-2 min-[1025px]:row-start-1 min-[1025px]:h-[calc(var(--app-vh)-var(--pos-register-top)-var(--space-4))] min-[1025px]:overflow-y-auto min-[1025px]:overscroll-contain min-[1025px]:[scroll-padding-block:176px_88px]',
        )}
      >
        {/* Pembaca layar hanya mendengar angka uangnya. Dulu aria-live
            membungkus seluruh register, jadi tiap ubah qty membacakan ulang
            cabang, nomor faktur, dan jumlah baris. */}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {done ? `${t('pos.lcdPaid')}. ` : ''}
          {t('common.total')} {totalText}
          {lcdSub ? `. ${lcdSub.label} ${lcdSub.value}` : ''}
        </p>
        <div className="@container/reg relative bg-primary px-5 pt-4 pb-3 text-primary-foreground min-[1025px]:sticky min-[1025px]:top-0 min-[1025px]:z-[2]">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-primary-foreground/80">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn('size-2 rounded-full', done ? 'bg-highlight' : 'bg-primary-foreground/50')} />
              {done ? t('pos.lcdPaid') : t('pos.lcdLive')}
            </span>
            <span>{t('common.total')}</span>
          </div>
          {/* Angka total selalu sebaris: di 320px "Rp 140.460.000" pada 2,35rem
              patah dua baris. Lebar satu karakter mono ≈ 0,6em, jadi ukuran =
              lebar wadah / jumlah karakter, dibatasi 2,35rem. */}
          <div
            className="text-right font-mono text-[length:min(2.35rem,calc(100cqi/(var(--lcd-chars,12)*0.62)))] leading-[1.05] font-semibold whitespace-nowrap tabular-nums"
            style={{ '--lcd-chars': totalText.length } as CSSProperties}
          >
            {totalText}
          </div>
          {lcdSub && (
            <div
              className={cn(
                'mt-1.5 flex items-baseline justify-between gap-3 text-sm',
                lcdSub.tone === 'due' && 'font-semibold text-highlight',
                lcdSub.tone === 'change' && 'font-semibold',
                lcdSub.tone === 'exact' && 'text-primary-foreground/80',
              )}
            >
              <span>{lcdSub.label}</span>
              <span className={cn(money, 'text-base')}>{lcdSub.value}</span>
            </div>
          )}
          {/* Nama cabang lebih penting daripada hitungan baris: bila tak muat
              sebaris, hitungan yang turun, bukan nama cabang yang dielipsis. */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-primary-foreground/15 pt-2 font-mono text-xs text-primary-foreground/80">
            {reachableOutlets.length > 1 ? (
              <button
                type="button"
                className="-mx-1.5 inline-flex min-h-8 items-center gap-1.5 rounded-full px-1.5 font-sans font-medium text-primary-foreground outline-none transition-colors hover:bg-primary-foreground/10 focus-visible:ring-2 focus-visible:ring-highlight pointer-coarse:min-h-11 [&_svg]:size-3.5"
                onClick={() => setOutletModal(true)}
                aria-label={t('pos.outletChip').replace('{name}', activeOutlet?.name ?? t('pos.pickBranch'))}
              >
                <span aria-hidden className={cn('size-2 rounded-full', activeOutlet ? 'bg-highlight' : 'bg-primary-foreground/50')} />
                {activeOutlet?.name ?? t('pos.pickBranch')}
                <ChevronDown aria-hidden />
              </button>
            ) : (
              <span>{done ? done.sale.saleNo : nextNo}</span>
            )}
            <span>
              {done
                ? interpolate(t('pos.lcdLinesDone'), { n: String(done.sale.lines.length) })
                : interpolate(t('pos.lcdLines'), { qty: String(totalQty), n: String(cart.length) })}
            </span>
          </div>
        </div>

        {done ? (
          <div className="grid gap-3 p-5">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <span aria-hidden className="size-2 rounded-full bg-success-foreground" /> {t('pos.doneTitle')}
              <span className="font-mono text-sm font-normal text-muted-foreground">{done.sale.saleNo}</span>
            </p>
            <p className="text-sm text-muted-foreground [&_strong]:font-mono [&_strong]:font-semibold [&_strong]:text-foreground">
              {done.change > 0
                ? t('pos.doneChange')
                    .split('{amount}')
                    .flatMap((part, i) => (i ? [<strong key={i}>{fmtRp(done.change)}</strong>, part] : [part]))
                : t('pos.doneExact')}
            </p>
            <div className="flex flex-wrap gap-2 [&>*]:flex-1">
              {org && (
                <Button
                  variant="outline"
                  onClick={() => printSaleReceipt(done.sale, org, { change: done.change, walletName, outlets })}
                >
                  <Printer aria-hidden />
                  {t('pos.printReceipt')}
                </Button>
              )}
              {done.phone && (
                <Button asChild variant="outline">
                  <a
                    href={waLink(done.phone, saleWaMessage(t('pos.waMessage'), org?.name ?? '', done.sale))}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <WhatsAppIcon className="size-4" /> {t('pos.sendWa')}
                  </a>
                </Button>
              )}
            </div>
            {/* Tanpa autoFocus: Enter yang menyelesaikan transaksi dulu ikut
                "menekan" tombol ini, sehingga LUNAS & kembalian hilang sebelum
                terbaca. Fokus pindah ke kolom cari; Enter kosong di sana (atau
                pindaian berikutnya) memulai transaksi baru. */}
            <Button className="w-full" onClick={newSale}>
              {t('pos.newSale')}
            </Button>
          </div>
        ) : (
        <>
        <div className="flex min-h-12 items-center justify-between gap-3 px-5 pt-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
            <ShoppingCart aria-hidden /> {t('pos.cart')}
          </h2>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={clearCart}>
              {t('pos.clearCart')}
            </Button>
          )}
        </div>

        {/* Struk yang terpotong di tepi bawah memudar, tanda masih ada baris lagi. */}
        <div className="px-5 min-[1025px]:min-h-[104px] min-[1025px]:flex-[1_1_0] min-[1025px]:overflow-y-auto min-[1025px]:overscroll-contain min-[1025px]:scroll-fade-b">
          {cart.length === 0 ? (
            <div className="grid justify-items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {outletNotice ? t('pos.outletChanged') : cleared ? t('pos.cleared') : t('pos.cartEmpty')}
              </p>
              {cleared && !outletNotice && (
                <Button variant="outline" size="sm" onClick={restoreCart}>
                  <RotateCcw aria-hidden />
                  {t('pos.restoreCart').replace('{n}', String(cleared.cart.reduce((n, c) => n + c.qty, 0)))}
                </Button>
              )}
            </div>
          ) : (
            // Dua baris: nama selebar struk, lalu harga satuan dan tuts qty. Satu
            // baris dulu memeras nama jadi "Keyb…"; tuts qty 44px di baris kedua
            // bersama total memeras harga satuan sampai tertimpa.
            <ul className="m-0 grid list-none divide-y divide-border/70 p-0">
              {cart.map((c) => (
                <li key={c.itemId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-3">
                  <strong className="text-sm font-semibold [overflow-wrap:anywhere]">{c.name}</strong>
                  <span className={cn(money, 'self-start text-right text-sm font-semibold whitespace-nowrap')}>
                    {fmtRp(c.sellPrice * c.qty)}
                  </span>
                  <small className={cn(money, 'min-w-0 text-xs text-muted-foreground')}>
                    {fmtRp(c.sellPrice)} ×{' '}{c.qty}
                  </small>
                  <div className="flex items-center justify-self-end rounded-full ring-1 ring-border">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full"
                      onClick={() => setQty(c.itemId, c.qty - 1)}
                      aria-label={interpolate(t('pos.qtyMinus'), { name: c.name })}
                    >
                      <Minus aria-hidden />
                    </Button>
                    {/* Qty bisa diketik — 12 kabel data bukan 11 ketukan "+". */}
                    <input
                      className={cn(
                        money,
                        'h-8 w-10 rounded-md bg-transparent pointer-coarse:h-11 pointer-coarse:w-11 text-center text-sm font-semibold outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring',
                      )}
                      inputMode="numeric"
                      aria-label={t('pos.qtyLabel').replace('{name}', c.name)}
                      value={c.qty}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                        if (!Number.isNaN(n) && n > 0) setQty(c.itemId, n);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full"
                      onClick={() => setQty(c.itemId, c.qty + 1)}
                      aria-label={interpolate(t('pos.qtyPlus'), { name: c.name })}
                    >
                      <Plus aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart.length > 0 && (
          <>
            <div aria-hidden className="mx-5 border-t border-dashed border-border" />
            <div className={cn('grid gap-3 px-5 pt-4', clearOfBarInside)}>
            {showCust && (
            <div className="relative" ref={custBoxRef}>
              {customer ? (
                <div className="flex min-h-10 items-center gap-2 rounded-xl bg-surface pl-3.5 text-sm ring-1 ring-border/60 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
                  <Users aria-hidden />
                  <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{customer.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                    onClick={() => openCust()}
                    aria-label={t('pos.custRemove')}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              ) : (
                <>
                  <TextInput
                    ref={custInputRef}
                    capitalize="none"
                    placeholder={t('pos.custOptional')}
                    aria-label={t('pos.custOptional')}
                    value={custQuery}
                    onChange={(e) => {
                      setCustQuery(e.target.value);
                      setSuggestOpen(true);
                    }}
                    onFocus={() => setSuggestOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' && custListOpen) {
                        e.preventDefault();
                        e.stopPropagation();
                        setSuggestOpen(false);
                        return;
                      }
                      custNav.onKeyDown(e);
                    }}
                    role="combobox"
                    aria-expanded={custListOpen}
                    aria-autocomplete="list"
                    aria-controls="pos-customer-suggest"
                    aria-activedescendant={custNav.active >= 0 ? `pos-cust-${custNav.active}` : undefined}
                    start={<Search aria-hidden />}
                  />
                  {/* Saran selalu menjelaskan dirinya: kurang huruf, masih mencari,
                      tidak ditemukan — dan selalu menawarkan pelanggan baru. Dulu
                      kolom ini diam saja bila tak ada yang cocok, dan Kasir tak bisa
                      membuat pelanggan. */}
                  {custListOpen && (
                    <ul
                      className="absolute inset-x-0 top-[calc(100%+4px)] z-20 m-0 grid max-h-64 list-none gap-0.5 overflow-y-auto rounded-xl bg-popover p-1 text-popover-foreground shadow-raised ring-1 ring-border/70"
                      id="pos-customer-suggest"
                      role="listbox"
                    >
                      {serverSearch && custQuery.trim().length < 3 ? (
                        <li className="px-2.5 py-2 text-xs text-muted-foreground">{t('pos.custMinChars')}</li>
                      ) : custMatches.length === 0 ? (
                        <li className="px-2.5 py-2 text-xs text-muted-foreground">
                          {serverSearch && custPending
                            ? t('pos.custSearching')
                            : t('pos.custNotFound').replace('{q}', custQuery.trim())}
                        </li>
                      ) : (
                        custMatches.map((c, i) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              id={`pos-cust-${i}`}
                              role="option"
                              aria-selected={i === custNav.active}
                              tabIndex={-1}
                              className="grid w-full gap-0.5 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-accent aria-selected:bg-accent pointer-coarse:min-h-11"
                              onClick={() => {
                                setCustomer(c);
                                setCustQuery('');
                              }}
                            >
                              <strong className="text-sm font-medium">{c.name}</strong>
                              <small className="font-mono text-xs text-muted-foreground">{c.phone || t('pos.custNoPhone')}</small>
                            </button>
                          </li>
                        ))
                      )}
                      <li>
                        <button
                          type="button"
                          id={`pos-cust-${custOptions}`}
                          role="option"
                          aria-selected={custNav.active === custOptions}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-primary outline-none hover:bg-accent aria-selected:bg-accent pointer-coarse:min-h-11 [&_svg]:size-4"
                          onClick={() => setCustModal(true)}
                        >
                          <Plus aria-hidden /> {t('pos.custAdd')}
                        </button>
                      </li>
                    </ul>
                  )}
                </>
              )}
            </div>
            )}

            {showDisc && (
            <div className="flex items-center gap-2">
              <TextInput
                ref={discInputRef}
                capitalize="none"
                className="min-w-0 flex-1"
                placeholder={t('pos.discount')}
                aria-label={t('pos.discount')}
                inputMode="numeric"
                value={discount}
                onChange={(e) => setDiscount(fmtRpInput(e.target.value))}
              />
              <div className="flex shrink-0 gap-0.5 rounded-full bg-muted p-1 ring-1 ring-inset ring-border/60" role="group">
                {(['amount', 'percent'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={discountType === k}
                    aria-label={t(k === 'amount' ? 'pos.discountAmount' : 'pos.discountPercent')}
                    className="min-h-8 min-w-10 rounded-full px-2.5 font-mono text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-[0_1px_2px_rgb(6_32_54/0.08)] pointer-coarse:min-h-11"
                    onClick={() => setDiscountType(k)}
                  >
                    {k === 'amount' ? 'Rp' : '%'}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Pelanggan & diskon terlipat: tuts tambahan bergaris putus, bahasa
                yang sama dengan nominal cepat di bawahnya. */}
            {(!showCust || !showDisc) && (
              <div className="flex gap-2">
                {!showCust && (
                  <Button
                    variant="outline"
                    className="min-w-0 flex-1 border-dashed shadow-none"
                    onClick={openCust}
                    aria-label={t('pos.custAddAria')}
                  >
                    <UserPlus aria-hidden /> {t('pos.custShort')}
                  </Button>
                )}
                {!showDisc && (
                  <Button
                    variant="outline"
                    className="min-w-0 flex-1 border-dashed shadow-none"
                    onClick={openDisc}
                    aria-label={t('pos.discountAddAria')}
                  >
                    <Tag aria-hidden /> {t('pos.discount')}
                  </Button>
                )}
              </div>
            )}

            {discountOver && (
              <p className="text-xs text-warning-foreground">
                {interpolate(t('pos.staffDiscountNote'), { pct: String(STAFF_MAX_DISCOUNT_PCT), amount: fmtRp(maxDiscount) })}
              </p>
            )}

            {/* Tanpa diskon, subtotal = total = angka di atas; rincian ini hanya
                mengulang angka yang sama dua kali lagi. */}
            {discountValue > 0 && (
              <dl className="m-0 grid gap-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t('pos.subtotal')}</dt>
                  <dd className={cn('m-0', money)}>{fmtRp(subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-3 text-success-foreground">
                  <dt>{t('pos.discount')}</dt>
                  <dd className={cn('m-0', money)}>−{fmtRp(discountValue)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-border/70 pt-1 font-semibold">
                  <dt>{t('common.total')}</dt>
                  <dd className={cn('m-0', money)}>{fmtRp(total)}</dd>
                </div>
              </dl>
            )}

            <div className="@container/pay grid gap-2">
              <div className="flex items-baseline justify-between gap-3 @max-[271px]/pay:flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground">{t('pos.tender')}</span>
                {tender.length === 0 && (
                  <span
                    id="pos-tender-hint"
                    className="flex-1 text-right text-xs text-muted-foreground @max-[271px]/pay:basis-full @max-[271px]/pay:text-left"
                  >
                    {t('pos.tenderHint')}
                  </span>
                )}
              </div>
              <div
                id="pos-tender-keys"
                className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2"
                role="group"
                aria-label={t('pos.tenderKeys')}
              >
                {wallets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className="flex min-h-11 items-center rounded-xl bg-card px-3 text-left text-sm font-medium ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-accent aria-pressed:ring-2 aria-pressed:ring-primary"
                    aria-pressed={tender.some((p) => p.walletId === w.id)}
                    onClick={() => pickWallet(w.id)}
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">{w.name}</span>
                  </button>
                ))}
              </div>
              {tender.map((p) => {
                const name = walletName(p.walletId);
                return (
                  // Label 90px menyisakan terlalu sedikit untuk nominal di wadah
                  // sempit: di <=270px (90 label + jeda + tuts hapus + kolom yang
                  // memuat "888.888.888") label naik ke barisnya sendiri.
                  <div
                    key={p.walletId}
                    className="grid grid-cols-[90px_minmax(0,1fr)_auto] items-center gap-2 text-sm @max-[271px]/pay:grid-cols-[minmax(0,1fr)_auto] @max-[271px]/pay:gap-y-1"
                  >
                    <label
                      htmlFor={`tender-${p.walletId}`}
                      className="truncate font-medium @max-[271px]/pay:col-span-full @max-[271px]/pay:text-xs @max-[271px]/pay:text-muted-foreground"
                    >
                      {name}
                    </label>
                    <TextInput
                      id={`tender-${p.walletId}`}
                      capitalize="none"
                      className={cn(money, 'text-right')}
                      aria-label={t('pos.tenderAmount').replace('{wallet}', name)}
                      inputMode="numeric"
                      autoFocus={finePointer}
                      onFocus={(e) => e.currentTarget.select()}
                      value={p.amount ? fmtRpInput(String(p.amount)) : ''}
                      onChange={(e) => setTenderAmount(p.walletId, parseRpInput(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        if (!e.repeat && settle.ok && !discountOver) void checkout();
                      }}
                      placeholder="0"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                      onClick={() => removeTender(p.walletId)}
                      aria-label={t('pos.tenderRemove').replace('{wallet}', name)}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                );
              })}
              {tender.length > 1 && changeTender && (
                <p className="text-xs text-muted-foreground">
                  {t(cashIds.has(changeTender.walletId) ? 'pos.changeRuleCash' : 'pos.changeRule').replace(
                    '{wallet}',
                    walletName(changeTender.walletId),
                  )}
                </p>
              )}
              {quickCash.length > 1 && changeTender && (
                <div id="pos-quick-cash" className="flex flex-wrap gap-1.5" role="group" aria-label={t('pos.cashQuick')}>
                  {quickCash.map((v, i) => (
                    <button
                      key={v}
                      type="button"
                      className="inline-flex min-h-8 items-center rounded-full border border-dashed border-border px-3 font-mono text-xs text-muted-foreground tabular-nums outline-none transition-colors hover:border-solid hover:border-primary/40 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
                      onClick={() => setTenderAmount(changeTender.walletId, v)}
                    >
                      {i === 0 ? t('pos.exact') : fmtRp(v)}
                    </button>
                  ))}
                </div>
              )}
              {/* Sebelum ada tuts yang ditekan, petunjuk di kepala bagian sudah
                  bilang apa yang harus dilakukan. Di desktop total selalu
                  terlihat dan baris keduanya sudah menyebut sisa/kembalian/pas,
                  jadi status hanya tampil bila membawa info lebih: dompet
                  kembalian saat bayar campur, lebih bayar, nominal 0. */}
              {tender.length > 0 && (
                <div
                  id="pos-pay-status"
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm',
                    clearOfBar,
                    settle.ok
                      ? 'bg-success text-success-foreground'
                      : settle.paid === 0
                        ? 'bg-surface text-muted-foreground'
                        : 'bg-warning text-warning-foreground',
                    !(tender.length > 1 || settle.excess || settle.paid === 0) && 'min-[1025px]:hidden',
                  )}
                >
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-current" />
                  {statusText}
                </div>
              )}
            </div>
            </div>

            {/* Bar Proses = penunjuk uang: aksi di kiri, angka di kanan (TOTAL,
                SISA, KEMBALIAN). Saat kasir menerima uang total sudah tergulir ke
                atas, jadi angka yang ditunggu pelanggan ada di bar yang menempel
                ini. Di luar bagian bayar supaya menempel ke tepi bawah seluruh
                register; di desktop isi di baliknya memudar ke arahnya. */}
            <div
              className={cn(
                'bg-card px-5 pt-3 pb-4',
                'min-[1025px]:sticky min-[1025px]:bottom-0 min-[1025px]:z-[1] min-[1025px]:scroll-fade-above',
                // Kolom tunggal: bar menempel ke layar (panel clip, bukan wadah
                // gulir); di ponsel duduk tepat di atas menu bawah.
                'drawer:sticky drawer:bottom-[env(safe-area-inset-bottom)] drawer:z-[2]',
                'phone:bottom-[calc(var(--mobile-nav-height)+var(--space-2)+env(safe-area-inset-bottom))]',
              )}
            >
              <Button
                size="lg"
                variant={barReady ? 'default' : 'secondary'}
                className="h-auto min-h-12 w-full justify-start px-4 py-2.5 text-left has-[>svg]:px-4"
                data-state={bar.kind}
                onClick={barReady ? checkout : guidePay}
                disabled={busy}
                aria-busy={busy || undefined}
                aria-disabled={!barReady || undefined}
                aria-describedby={tender.length ? 'pos-pay-status' : 'pos-tender-hint'}
              >
                {busy ? (
                  <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
                ) : barReady ? (
                  <CircleCheck aria-hidden />
                ) : (
                  <ArrowUp aria-hidden />
                )}
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="leading-tight whitespace-normal">{payAction}</span>
                  {payReadout && (
                    <span className="flex shrink-0 flex-col items-end leading-tight whitespace-nowrap">
                      <small className={cn('text-xs font-semibold', !barReady && 'text-muted-foreground')}>
                        {payReadout.caption}
                      </small>
                      <strong className={cn(money, 'text-sm font-semibold', bar.kind === 'due' && 'text-warning-foreground')}>
                        {payReadout.value}
                      </strong>
                    </span>
                  )}
                </span>
              </Button>
            </div>
          </>
        )}
        </>
        )}
      </section>
      </div>
      )}

      {tab === 'pos' && cart.length > 0 && !done && !cartInView && (
        <button
          data-nu
          ref={measureDock}
          type="button"
          className="fixed inset-x-4 bottom-[calc(var(--mobile-nav-height)+var(--space-4)+env(safe-area-inset-bottom))] z-(--z-sticky) hidden grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl bg-primary px-4 py-2.5 text-left text-primary-foreground shadow-raised outline-none focus-visible:ring-2 focus-visible:ring-highlight focus-visible:ring-offset-2 phone:grid [&_svg]:size-4"
          onClick={() => document.getElementById('pos-cart')?.scrollIntoView({ behavior: 'smooth' })}
          aria-label={interpolate(t('pos.dockAria'), { qty: String(totalQty), total: totalText })}
        >
          <span className="inline-flex items-center gap-2 font-semibold">
            <ShoppingCart aria-hidden /> {interpolate(t('pos.units'), { n: String(totalQty) })}
          </span>
          <strong className={cn(money, 'font-semibold')}>{totalText}</strong>
          <ArrowRight aria-hidden />
        </button>
      )}

      {tab === 'history' && (
        <PosHistory
          recentSales={recentSales}
          salesLoad={salesLoad}
          walletName={walletName}
          org={org}
          isMgr={isMgr}
          monthStart={monthStart}
          branchName={activeOutlet && reachableOutlets.length > 1 ? activeOutlet.name : null}
        />
      )}

      <CustomerModal
        open={custModal}
        onClose={() => setCustModal(false)}
        editing={null}
        customers={serverSearch ? remoteCustomers : customers}
        initialQuery={custQuery}
        onSaved={(c) => {
          setCustomer(c);
          setCustQuery('');
        }}
      />

      <FormDialog
        open={outletModal}
        onClose={() => {
          setOutletModal(false);
          setPendingItem(null);
        }}
        title={t(pendingItem ? 'pos.outletPickTitle' : 'pos.outletSwitchTitle')}
        description={
          pendingItem ? t('pos.outletPickBody') : cart.length > 0 ? t('pos.outletSwitchCartNote') : undefined
        }
        size="sm"
      >
        {outletButtons}
      </FormDialog>
    </div>
  );
}
