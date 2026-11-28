import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CircleCheck,
  Cpu,
  Ellipsis,
  Info,
  Link2,
  LoaderCircle,
  Package,
  PackageOpen,
  Pencil,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCollection, invalidateCollection } from '@/hooks/useCollection';
import { useServiceHistory } from '@/hooks/useServiceHistory';
import { repository } from '@/data';
import { addServicePart, addServiceModalLine, saveServiceParts } from '@/data/serviceParts';
import { deleteServiceTicket } from '@/data/serviceDelete';
import { updateServiceModal, removeServiceModal } from '@/data/supabase-client';
import { isCloudMode } from '@/stores/demo';
import { toast } from '@/stores/toast';
import { useSessionStore } from '@/stores/session';
import { useFormat } from '@/lib/useFormat';
import { useT } from '@/i18n';
import { walletsForOutlet } from '@/lib/business/finance';
import {
  assignmentNote,
  canCreateService,
  canSeeCustomerPhone,
  canWorkOnService,
} from '@/lib/business/staffAccess';
import {
  outstandingBalance,
  serviceProfit,
  cancelledProfit,
  heldCost,
  retainedDownPayment,
  serviceModalTotal,
  walletDeltasForModalEdit,
  isTerminal,
  nextStatuses,
  canSetStatus,
  canClaimWarranty,
  isAwaitingPickup,
  warrantyDecided,
  openClaimFor,
  finalCostLocked,
  modalDadakanIssue,
  modalExpenseDescription,
} from '@/lib/business/services';
import { applyBalance } from '@/lib/business/finance';
import { localDateStr } from '@/lib/time';
import { newId } from '@/lib/id';
import { EMPTY_VALUE, fmtRpInput, parseRpInput } from '@/lib/format';
import { cn } from '@/lib/utils';
import { logActivity } from '@/lib/activity';
import { getLastExpenseWallet, setLastExpenseWallet } from '@/config/orgConfig';
import { LoadState } from '@/components/ui';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { ConfirmDialog } from '@/components/dens/confirm-dialog';
import { Field } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { SelectBox } from '@/components/dens/select-box';
import { TextInput } from '@/components/dens/text-input';
import { WhatsAppIcon } from '@/components/dens/whatsapp-icon';
import { ServiceModal } from './ServiceModal';
import { StatusModal } from './StatusModal';
import { NotifyModal } from './NotifyModal';
import { TicketDoneModal } from './TicketDoneModal';
import { ScreenLockReadout } from './ScreenLockReadout';
import { useServicePrint } from './useServicePrint';
import { WarrantyClaimModal } from './WarrantyClaimModal';
import { SparepartPickerModal } from './SparepartPickerModal';
import { PartWarrantyModal } from './PartWarrantyModal';
import type { ServiceHistoryEntry, ServiceStatus, ServiceSparepart } from '@/data/types';
import { interpolate } from '@/lib/business/notify';
import { PICKUP_NOTE, UNPICK_NOTE, serviceDeleteBlocker } from '@/lib/business/services';
import { historyKind, STATUS_BADGE } from '@/lib/business/services';
import { qrSvg } from '@/lib/qr';

/** Linear "job traveler" stages (cancel handled separately). */
interface TicketAction {
  key: string;
  icon: LucideIcon;
  label: string;
  primary?: boolean;
  active?: boolean;
  iconRight?: boolean;
  onClick?: () => void;
  to?: string;
}

const TRAVELER: ServiceStatus[] = [
  'diterima',
  'diagnosa',
  'konfirmasi',
  'tunggu',
  'pengerjaan',
  'selesai',
  'lunas',
];

export function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { fmtMoney, fmtDate, fmtDateTime } = useFormat();

  // Halaman ini hanya butuh SATU tiket. Daftar penuh dibaca bila KEBETULAN sudah
  // ada di cache (mis. pengguna datang dari halaman Servis), tapi `enabled: false`
  // membuatnya tidak pernah MEMICU pengambilan — dulu membuka satu tiket lewat
  // tautan langsung menarik seluruh tabel servis hanya untuk mencari satu baris.
  const { data: services } = useCollection('services', { enabled: false });
  const { data: allWallets } = useCollection('wallets');
  const sessionEmployees = useSessionStore((s) => s.employees);
  const org = useSessionStore((s) => s.org);
  const me = useSessionStore((s) => s.currentEmployee);
  const role = me?.role ?? 'karyawan';
  const isOwner = role === 'owner';
  const isManager = role === 'owner' || role === 'admin';

  const [editOpen, setEditOpen] = useState(false);
  // "Serahkan unit" membuka Update Status langsung di Lunas + diambil.
  const [statusHandover, setStatusHandover] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  // Part/modal ditambah setelah biaya final ditetapkan: biaya final TIDAK ikut
  // naik, jadi profit turun tanpa tanda. Diingatkan di panel biaya.
  const [costStale, setCostStale] = useState(false);
  // Baris BOM yang akan dihapus — menghapus memindahkan kas/stok, jadi dikonfirmasi dulu.
  const [toRemove, setToRemove] = useState<number | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [partWarrantyOpen, setPartWarrantyOpen] = useState(false);
  const [confirmPickup, setConfirmPickup] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();
  // Ad-hoc "modal dadakan" entry form (inline in the cost panel).
  const [modalFormOpen, setModalFormOpen] = useState(false);
  // Index of the manual line being edited; null = adding a new line.
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalWalletId, setModalWalletId] = useState('');
  const [savingCost, setSavingCost] = useState(false);

  const listed = useMemo(() => services.find((s) => s.id === id) ?? null, [services, id]);
  // Tiket di luar 1000 terbaru (cloud) tidak ada di daftar — ambil barisnya sendiri.
  const oneQuery = useQuery({
    queryKey: ['collection', 'services', 'one', id],
    queryFn: () => repository.get('services', id ?? ''),
    // Tidak lagi menunggu daftar selesai dimuat — barisnya diambil langsung.
    enabled: !!id && !listed,
  });
  const service = listed ?? oneQuery.data ?? null;
  // Modal dadakan dibayar dari wallet cabang tiket atau wallet bersama (0095).
  const wallets = walletsForOutlet(allWallets, service?.outletId ?? null);
  const history = useServiceHistory(service);
  const servicePrint = useServicePrint(service);

  if (!service) {
    // Dulu: layar kosong selama memuat, dan galat jaringan tampil sebagai 404.
    // 404 hanya benar bila pengambilan BERHASIL tetapi tiketnya memang tidak ada.
    if (id && (oneQuery.isPending || oneQuery.isFetching || oneQuery.isError)) {
      return (
        <LoadState
          queries={[
            {
              loading: oneQuery.isFetching,
              // Saat mencoba ulang, tampilkan penanda memuat, bukan galat lama.
              error: oneQuery.isFetching ? null : oneQuery.error,
              refetch: oneQuery.refetch,
            },
          ]}
        />
      );
    }
    return (
      <div data-nu className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="font-mono text-3xl font-semibold">404</span>
        <p className="text-muted-foreground">{t('serviceDetail.notFound')}</p>
        <Button variant="outline" onClick={() => navigate('/services')}>
          <ArrowLeft aria-hidden /> {t('serviceDetail.backToList')}
        </Button>
      </div>
    );
  }

  /**
   * Write the sparepart list after RE-READING the service, so a rapid second
   * cost-line mutation can't overwrite a line whose cash/stock side-effect
   * already committed. The closure's `service.spareparts` can be stale between
   * refetches; deriving from the fresh copy avoids the lost update.
   * ponytail: re-read closes the realistic single-user rapid-click gap; a true
   * concurrent interleave would still need an in-flight mutex — add if it bites.
   */
  const putServiceSpareparts = async (
    mutate: (current: ServiceSparepart[]) => ServiceSparepart[],
  ) => {
    // One row by id, not the whole services list, per sparepart edit.
    const fresh = (await repository.get('services', service.id)) ?? service;
    // Stok inventori ikut disesuaikan dalam transaksi yang sama (0064).
    await saveServiceParts(fresh, mutate(fresh.spareparts));
  };

  const cancelled = service.status === 'batal';
  const currentIndex = TRAVELER.indexOf(service.status);
  const outstanding = service.status === 'lunas' ? 0 : outstandingBalance(service);
  // Tiket batal tak punya tagihan: dulu terbaca "Menunggu biaya final" (amber)
  // seolah pelanggan masih berutang.
  const billingReadout =
    service.status === 'lunas'
      ? { label: t('serviceDetail.billPayment'), value: t('serviceDetail.billPaid') }
      : cancelled
        ? { label: t('common.status'), value: t('serviceDetail.billCancelled') }
        : service.finalCost <= 0
        ? { label: t('serviceDetail.billLabel'), value: t('serviceDetail.billAwaitFinal') }
        : { label: t('serviceDetail.billRemaining'), value: fmtMoney(outstanding) };
  // Tiket batal: pendapatannya DP yang ditahan, biayanya hanya yang tetap
  // ditanggung (part terpakai + modal dadakan). DP tiket lama tak diketahui → "—".
  // Selain itu profit baru bermakna bila biaya final ada — sebelumnya negatif palsu.
  const keptDp = retainedDownPayment(service);
  const cancelProfit = cancelledProfit(service);
  const profit = cancelled ? (cancelProfit ?? 0) : serviceProfit(service);
  const profitKnown = cancelled ? cancelProfit !== null : service.finalCost > 0;
  const modalTotal = cancelled ? heldCost(service.spareparts) : serviceModalTotal(service.spareparts);
  const costLocked = finalCostLocked(service);
  // Teknisi hanya mengubah tiket yang ditugaskan kepadanya dan tidak melihat nomor WA (P18.3).
  const canWork = canWorkOnService(me, service);
  const canSeePhone = canSeeCustomerPhone(role);
  const note = assignmentNote(service);
  const staffNote =
    note.kind === 'unassigned'
      ? t('serviceDetail.staffUnassigned')
      : interpolate(t('serviceDetail.staffAssigned'), { name: note.name });
  // Tiket Lunas sudah dibayar: menambah part hanya untuk owner/admin (0093).
  const canAddParts = canWork && !cancelled && (service.status !== 'lunas' || isManager);
  // Satu klaim berjalan per tiket asli (juga dijaga server, 0064).
  const openClaim = openClaimFor(services, service.id);
  const claimable = canCreateService(role) && canClaimWarranty(service, localDateStr()) && !openClaim;
  // When the only thing this role can do is take a DP (no allowed status
  // transitions, but the ticket isn't terminal), label the action accordingly
  // instead of the misleading "Update Status" — e.g. staff on a finished unit.
  const allowedNext = nextStatuses(service.status).filter((s) => canSetStatus(role, s));
  const onlyDp = allowedNext.length === 0 && !isTerminal(service.status);
  const originTicket = service.warrantyClaimOf
    ? services.find((s) => s.id === service.warrantyClaimOf) ?? null
    : null;

  /**
   * Append an inventory sparepart line AND deduct its stock immediately
   * (stock leaves the shelf the moment the part is committed to the ticket).
   * The stock check runs against the live row in the same transaction
   * (update_service_parts, 0064) — the picker's check uses cached state. The
   * line is stored `deducted:true` so the later "pengerjaan" transition won't
   * deduct it again, and cancelling the ticket gives the stock back.
   */
  const addSparepartLine = async (line: ServiceSparepart) => {
    try {
      await addServicePart(service, line);
      toast.success(t('serviceDetail.partAdded'));
      if (costLocked) setCostStale(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('serviceDetail.partAddFailed'));
    }
  };

  /** Open the ad-hoc modal form for a NEW line, wallet defaults to last-used. */
  const openModalForm = () => {
    const last = getLastExpenseWallet();
    const fallback = wallets[0]?.id ?? '';
    setEditIndex(null);
    setModalWalletId(wallets.some((w) => w.id === last) ? last : fallback);
    setModalName('');
    setModalAmount('');
    setModalFormOpen(true);
  };

  /** Open the form pre-filled to EDIT an existing manual line. */
  const openEditModal = (index: number) => {
    const line = service.spareparts[index];
    if (!line || line.kind !== 'manual') return;
    const wid = line.walletId ?? getLastExpenseWallet();
    const fallback = wallets[0]?.id ?? '';
    setEditIndex(index);
    setModalName(line.name);
    setModalAmount(fmtRpInput(String(line.costPrice)));
    setModalWalletId(wallets.some((w) => w.id === wid) ? wid : fallback);
    setModalFormOpen(true);
  };

  /** Close the modal form and clear edit state. */
  const closeModalForm = () => {
    setModalFormOpen(false);
    setEditIndex(null);
  };

  /**
   * Record an ad-hoc "modal dadakan": creates a manual cost line AND a linked
   * Expense (real cash out), debiting the chosen wallet. The expense id is kept
   * on the line so it can be reversed if the line is later removed.
   */
  const addManualModal = async () => {
    const input = { name: modalName, amount: parseRpInput(modalAmount), walletId: modalWalletId };
    const issue = modalDadakanIssue(input);
    if (issue) return toast.warning(t(issue));
    setSavingCost(true);
    try {
      await addServiceModalLine(service, input);
      setLastExpenseWallet(modalWalletId);
      toast.success(t('serviceDetail.modalAdded'));
      if (costLocked) setCostStale(true);
      closeModalForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('serviceDetail.modalAddFailed'));
    } finally {
      setSavingCost(false);
    }
  };

  /**
   * Edit an existing manual "modal dadakan" line. Keeps cash consistent by
   * reversing the old wallet debit and applying the new one (netted per wallet
   * so editing on the same wallet doesn't double-apply), updates the linked
   * Expense (amount/wallet/description), and rewrites the cost line. The linked
   * Expense id is preserved so the audit trail stays continuous.
   */
  const updateManualModal = async () => {
    if (editIndex == null) return;
    const line = service.spareparts[editIndex];
    if (!line || line.kind !== 'manual') return;
    const amount = parseRpInput(modalAmount);
    const issue = modalDadakanIssue({ name: modalName, amount, walletId: modalWalletId });
    if (issue) return toast.warning(t(issue));

    setSavingCost(true);
    const now = new Date().toISOString();
    try {
      const oldAmount = line.costPrice;
      if (isCloudMode() && line.expenseId) {
        await updateServiceModal({
          orgId: service.orgId,
          serviceId: service.id,
          expenseId: line.expenseId,
          name: modalName.trim(),
          amount,
          walletId: modalWalletId,
        });
        setLastExpenseWallet(modalWalletId);
        logActivity({
          action: 'expense.update',
          entityType: 'expense',
          entityId: line.expenseId,
          entityLabel: `Modal ${service.serviceNo}`,
          meta: { amount, prevAmount: oldAmount, serviceId: service.id },
        });
        toast.success(t('serviceDetail.modalUpdated'));
        closeModalForm();
        return;
      }
      const oldWalletId = line.walletId ?? null;
      // Net the cash movement per wallet (refund old debit, apply new debit).
      const delta = walletDeltasForModalEdit(oldWalletId, oldAmount, modalWalletId, amount);
      for (const [wid, d] of delta) {
        const wallet = wallets.find((w) => w.id === wid);
        if (wallet) await repository.put('wallets', applyBalance(wallet, d));
      }

      // Sync the linked Expense (or create one if an older line lacked it).
      const expenseId = line.expenseId ?? newId();
      const expenses = await repository.list('expenses');
      const existing = expenses.find((e) => e.id === expenseId);
      await repository.put('expenses', {
        id: expenseId,
        orgId: service.orgId,
        outletId: service.outletId,
        date: existing?.date ?? localDateStr(),
        category: 'Sparepart',
        amount,
        walletId: modalWalletId,
        description: modalExpenseDescription(service.serviceNo, modalName),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      });

      const updatedLine: ServiceSparepart = {
        ...line,
        name: modalName.trim(),
        costPrice: amount,
        expenseId,
        walletId: modalWalletId,
      };
      await putServiceSpareparts((list) =>
        list.map((sp, i) => (i === editIndex ? updatedLine : sp)),
      );
      setLastExpenseWallet(modalWalletId);
      logActivity({
        action: 'expense.update',
        entityType: 'expense',
        entityId: expenseId,
        entityLabel: `Modal ${service.serviceNo}`,
        meta: { amount, prevAmount: oldAmount, serviceId: service.id },
      });
      toast.success(t('serviceDetail.modalUpdated'));
      closeModalForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('serviceDetail.modalUpdateFailed'));
    } finally {
      setSavingCost(false);
    }
  };

  /**
   * Remove a cost line. For manual lines this also reverses the linked Expense
   * and refunds the wallet (atomic), so cash & profit stay consistent. For
   * inventory lines already deducted, stock is returned to the item.
   */
  const removeCostLine = async (index: number) => {
    const line = service.spareparts[index];
    if (!line) return;
    try {
      if (isCloudMode() && line.kind === 'manual' && line.expenseId) {
        await removeServiceModal({ orgId: service.orgId, serviceId: service.id, expenseId: line.expenseId });
        toast.success(t('serviceDetail.lineRemoved'));
        return;
      }
      if (line.kind === 'manual') {
        if (line.expenseId) {
          const expenses = await repository.list('expenses');
          const exp = expenses.find((e) => e.id === line.expenseId);
          await repository.remove('expenses', line.expenseId);
          if (exp) {
            const wallet = wallets.find((w) => w.id === exp.walletId);
            if (wallet) await repository.put('wallets', applyBalance(wallet, exp.amount));
          }
        }
      }
      // Stok baris inventori yang sudah dipotong kembali lewat selisih di sini.
      await putServiceSpareparts((sp) => sp.filter((_, i) => i !== index));
      toast.success(t('serviceDetail.lineRemoved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('serviceDetail.lineRemoveFailed'));
    }
  };

  /** Latest history timestamp for a given stage. */
  const stageAt = (stage: ServiceStatus): string | null => {
    const entry = [...history].reverse().find((h) => h.status === stage);
    return entry ? fmtDateTime(entry.at) : null;
  };

  const log = [...history].reverse();
  // Alamat yang sama dengan QR di nota dan tautan di pesan WhatsApp: `/t/<kode>`
  // bila kode lacaknya sudah dimuat, selain itu alamat lama `?org=&no=`.
  const trackingLink = servicePrint.trackLink;

  /**
   * Copy the public tracking link with explicit feedback. Uses the async
   * Clipboard API when available, falling back to a hidden-textarea +
   * execCommand for non-secure contexts (e.g. plain HTTP on a LAN device).
   */
  const copyTrackingLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(trackingLink);
      } else {
        const ta = document.createElement('textarea');
        ta.value = trackingLink;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('execCommand failed');
      }
      toast.success(t('serviceDetail.linkCopied'));
    } catch {
      toast.error(t('serviceDetail.linkCopyFailed'));
    }
  };

  // Toggle physical collection of the device — independent of payment.
  const togglePickup = async (confirmed = false) => {
    // Unit keluar sebelum lunas boleh, tapi harus disengaja.
    if (!service.pickedUp && !confirmed && service.status === 'selesai' && outstandingBalance(service) > 0) {
      setConfirmPickup(true);
      return;
    }
    const now = new Date().toISOString();
    const nowPicked = !service.pickedUp;
    try {
      await repository.patch('services', service.id, {
        pickedUp: nowPicked,
        pickedUpAt: nowPicked ? now : null,
        updatedAt: now,
        history: [
          ...(service.history ?? []),
          {
            at: now,
            status: 'edit',
            by: me?.id ?? '',
            byName: me?.name ?? '',
            note: nowPicked ? PICKUP_NOTE : UNPICK_NOTE,
            internal: false,
          },
        ],
      });
      toast.success(t(nowPicked ? 'services.pickedToast' : 'services.unpickedToast'));
      if (nowPicked && service.status === 'lunas') setDoneOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('services.pickupFailed'));
    }
  };
  const historyLabel = (h: ServiceHistoryEntry) => {
    const k = historyKind(h);
    return k === 'pickup'
      ? t('services.pickedUp')
      : k === 'unpickup'
        ? t('serviceDetail.unpicked')
        : k === 'edit'
          ? t('serviceDetail.historyEdited')
          : t(`statusLabel.${k}`);
  };
  const openStatus = (handover = false) => {
    setStatusHandover(handover);
    setStatusOpen(true);
  };
  const canHandover = isManager && service.status === 'selesai' && !service.pickedUp;

  const hasWarrantyClaims = services.some((s) => s.warrantyClaimOf === service.id);
  function requestDelete() {
    const blocker = serviceDeleteBlocker(service!, hasWarrantyClaims);
    if (blocker) {
      toast.error(t(blocker));
      return;
    }
    setConfirmDelete(true);
  }
  const runDelete = async () => {
    if (!service) return;
    setDeleting(true);
    try {
      const { refunded } = await deleteServiceTicket(service, hasWarrantyClaims);
      invalidateCollection(queryClient, 'services');
      toast.success(
        interpolate(t(refunded ? 'serviceDelete.doneRefunded' : 'serviceDelete.done'), { no: service.serviceNo }),
      );
      navigate('/services');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('serviceDelete.failed'));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // Satu daftar aksi untuk bilah bawah DAN panel "Lainnya" di ponsel, supaya
  // syarat tampil tiap aksi tidak ditulis dua kali.
  const actions: TicketAction[] = [
    ...(canWork
      ? [{ key: 'edit', icon: Pencil, label: t('serviceDetail.edit'), onClick: () => setEditOpen(true) }]
      : []),
    ...(org
      ? [{ key: 'print', icon: Printer, label: t('serviceDetail.printReceipt'), onClick: servicePrint.print }]
      : []),
    ...(isManager && (isAwaitingPickup(service) || service.pickedUp)
      ? [
          {
            key: 'pickup',
            icon: service.pickedUp ? CircleCheck : Package,
            label: service.pickedUp
              ? t('serviceDetail.pickedUp')
              : service.status === 'lunas'
                ? t('serviceDetail.handover')
                : t('serviceDetail.markPickedUp'),
            primary: service.status === 'lunas' && !service.pickedUp,
            active: service.pickedUp,
            onClick: () => void togglePickup(),
          },
        ]
      : []),
    ...(claimable
      ? [{ key: 'claim', icon: ShieldCheck, label: t('serviceDetail.claimWarranty'), primary: service.pickedUp, onClick: () => setClaimOpen(true) }]
      : []),
    ...(openClaim
      ? [{ key: 'open-claim', icon: ShieldCheck, label: interpolate(t('serviceDetail.claimRunning'), { no: openClaim.serviceNo }), to: `/services/${openClaim.id}` }]
      : []),
    ...(canWork && !isTerminal(service.status)
      ? [
          onlyDp
            ? { key: 'status', icon: Banknote, label: t('serviceDetail.receiveDp'), primary: true, onClick: () => openStatus() }
            : { key: 'status', icon: ArrowRight, iconRight: true, label: t('serviceDetail.updateStatus'), primary: !canHandover, onClick: () => openStatus() },
        ]
      : []),
    // Selesai → pelanggan datang: lunasi + tandai diambil dalam satu alur, lalu
    // panel serah unit (nota, WA). Dulu empat langkah dan berakhir di toast.
    ...(canHandover
      ? [{ key: 'handover', icon: PackageOpen, label: t('serviceDetail.handover'), primary: true, onClick: () => openStatus(true) }]
      : []),
    ...(service.status === 'lunas' && isManager
      ? [{ key: 'correct', icon: Pencil, label: t('serviceDetail.correctCost'), onClick: () => openStatus() }]
      : []),
    // Hapus permanen: owner saja, dan hanya tiket bersih (0101). Tombolnya
    // tetap tampil untuk tiket yang belum bersih; ketukan menjelaskan alasannya.
    ...(isOwner && service.status !== 'lunas'
      ? [{ key: 'delete', icon: Trash2, label: t('serviceDelete.button'), onClick: requestDelete }]
      : []),
  ];
  const secondaryActions = actions.filter((a) => !a.primary);
  // Lebar bilah yang dibutuhkan bergantung pada jumlah aksi (label 90-150px).
  // Di bawah ambangnya aksi sekunder pindah ke "Lainnya", supaya bilah tetap
  // satu baris. Kelas ditulis utuh karena Tailwind hanya membuat kelas yang tertulis.
  const barFold =
    secondaryActions.length >= 5
      ? { hide: '@max-[64rem]/bar:hidden', more: '@max-[64rem]/bar:inline-flex' }
      : secondaryActions.length === 4
        ? { hide: '@max-[56rem]/bar:hidden', more: '@max-[56rem]/bar:inline-flex' }
        : { hide: '@max-[52rem]/bar:hidden', more: '@max-[52rem]/bar:inline-flex' };
  // Satu bentuk tombol untuk bilah bawah dan panel "Lainnya". Di bilah bawah aksi
  // sekunder disembunyikan bila bilahnya sempit (container query `bar`), dan
  // tombol "Lainnya" menggantikannya; dulu Ubah, Cetak Nota, Koreksi Biaya lenyap
  // di ponsel pemilik.
  const renderAction = (a: TicketAction, place: 'bar' | 'sheet', after?: () => void) => {
    const Glyph = a.icon;
    const content = a.iconRight ? (
      <>
        {a.label} <Glyph aria-hidden />
      </>
    ) : (
      <>
        <Glyph aria-hidden /> {a.label}
      </>
    );
    const className = cn(
      place === 'sheet' && 'h-auto min-h-11 w-full justify-start whitespace-normal py-2.5 text-left',
      place === 'bar' && !a.primary && barFold.hide,
      // Bilah sempit (ponsel): tombol tetap sebaris, labelnya boleh dua baris.
      place === 'bar' &&
        '@max-[30rem]/bar:h-auto @max-[30rem]/bar:min-h-11 @max-[30rem]/bar:whitespace-normal @max-[30rem]/bar:py-2 @max-[30rem]/bar:text-center @max-[30rem]/bar:leading-tight',
      a.active && 'border-success-foreground/40 bg-success text-success-foreground hover:bg-success',
    );
    const variant = place === 'bar' && a.primary ? 'default' : 'outline';
    return a.to ? (
      <Button key={a.key} asChild variant={variant} className={className}>
        <Link to={a.to} onClick={after}>
          {content}
        </Link>
      </Button>
    ) : (
      <Button
        key={a.key}
        variant={variant}
        className={className}
        onClick={() => {
          after?.();
          a.onClick?.();
        }}
      >
        {content}
      </Button>
    );
  };

  // Isi sel yang memang kosong: mata melihat tanda pisah, pembaca layar mendengar "kosong".
  const emptyValue = (
    <>
      <span aria-hidden="true">{EMPTY_VALUE}</span>
      <span className="sr-only">{t('common.emptyValue')}</span>
    </>
  );
  const panel = 'min-w-0 rounded-2xl bg-card p-5 text-card-foreground shadow-panel ring-1 ring-border/60 compact:p-4';
  const panelTitle = 'mb-4 border-b border-border/70 pb-3 font-mono text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground';
  const metaDot = <span aria-hidden className="size-1 shrink-0 rounded-full bg-muted-foreground/50" />;
  const costRow = 'flex items-baseline justify-between gap-3 text-sm';
  const money = 'font-mono tabular-nums';

  return (
    <div data-nu className="@container/detail flex flex-col gap-4">
      <Link
        to="/services"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 [&_svg]:size-4"
      >
        <ArrowLeft aria-hidden /> {t('nav.services')}
      </Link>

      {service.warrantyClaimOf && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-highlight-soft px-4 py-3 text-sm text-foreground ring-1 ring-highlight/40 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0">
          <ShieldCheck aria-hidden />
          <span>
            {t('serviceDetail.claimBanner')} <strong>{t('serviceDetail.claimBannerStrong')}</strong>
            {originTicket ? (
              <>
                {' '}{t('serviceDetail.claimFrom')}{' '}
                <Link
                  to={`/services/${originTicket.id}`}
                  className="font-mono font-semibold underline underline-offset-4 hover:text-primary"
                >
                  {originTicket.serviceNo}
                </Link>
              </>
            ) : (
              t('serviceDetail.claimOriginMissing')
            )}
            .
            {service.claimedItems && service.claimedItems.length > 0 && (
              <>
                {' '}{t('serviceDetail.claimedItems')}
                {service.claimedItems.some((item) => item.inferred) ? t('serviceDetail.claimedInferred') : ''}:{' '}
                <strong>
                  {service.claimedItems
                    .map((item) => interpolate(t('serviceDetail.until'), { name: item.name, date: fmtDate(item.until) }))
                    .join(', ')}
                </strong>
                .
              </>
            )}
          </span>
        </div>
      )}

      {/* ---------- Kepala tiket ---------- */}
      <header className={cn(panel, 'flex flex-col gap-2')}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="font-mono text-lg font-semibold tracking-tight">{service.serviceNo}</span>
          <Badge variant={STATUS_BADGE[service.status]} className="px-3 py-1 text-sm">
            {t(`statusLabel.${service.status}`)}
          </Badge>
        </div>
        {/* h2: judul halaman (h1) ada di Topbar. */}
        <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] [overflow-wrap:anywhere]">
          {service.device}
        </h2>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground">
          <Badge variant="outline" className="font-medium">
            {service.category}
          </Badge>
          {metaDot}
          {fmtDate(service.createdAt)}
          {service.technicianName && (
            <>
              {metaDot}
              <span>
                {t('serviceDetail.technician')} <strong className="font-semibold text-foreground">{service.technicianName}</strong>
              </span>
            </>
          )}
          {service.warrantyServiceUntil ? (
            <>
              {metaDot}
              {interpolate(t('serviceDetail.serviceWarranty'), { date: fmtDate(service.warrantyServiceUntil) })}
            </>
          ) : (
            warrantyDecided(service) && (
              <>
                {metaDot}
                {t('serviceDetail.noServiceWarranty')}
              </>
            )
          )}
          {service.warrantyPartsUntil && (
            <>
              {metaDot}
              {interpolate(t('serviceDetail.partWarranty'), { date: fmtDate(service.warrantyPartsUntil) })}
            </>
          )}
          {metaDot}
          {service.pickedUp ? (
            <span className="inline-flex items-center gap-1.5 [&_svg]:size-3.5">
              <CircleCheck aria-hidden /> {t('serviceDetail.pickedUp')}
              {service.pickedUpAt ? ` · ${fmtDate(service.pickedUpAt)}` : ''}
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 [&_svg]:size-3.5',
                isAwaitingPickup(service) && 'font-semibold text-foreground',
              )}
            >
              {/* Titik amber: unit siap diambil menuntut perhatian. */}
              {isAwaitingPickup(service) && <span aria-hidden className="size-2 shrink-0 rounded-full bg-highlight" />}
              <Package aria-hidden /> {t('serviceDetail.notPickedUp')}
            </span>
          )}
        </p>
      </header>

      {/* ---------- Tahap ---------- */}
      {!cancelled && (
        <section className={cn(panel, '@container/trav')} aria-label={t('common.status')}>
          {/* Tujuh tahap berjajar bila wadahnya muat; di wadah sempit (container
              query, jadi zoom aplikasi ikut dihitung) tersusun ke bawah. */}
          <ol className="m-0 grid list-none grid-cols-7 gap-1 p-0 @max-[36rem]/trav:grid-cols-1 @max-[36rem]/trav:gap-0.5">
            {TRAVELER.map((stage, i) => {
              const at = stageAt(stage);
              // Hanya tahap yang benar-benar tercatat di riwayat yang dicentang.
              // Sejak Selesai bisa dicapai langsung (0089), tahap yang dilompati
              // dulu ikut bercentang dengan tanggal "—" — riwayat tampak lebih
              // lengkap dari kenyataannya.
              const passed = i < currentIndex;
              const done = passed && !!at;
              const skipped = passed && !at;
              const current = i === currentIndex;
              return (
                <li
                  key={stage}
                  aria-current={current ? 'step' : undefined}
                  className="relative flex min-w-0 flex-col items-center gap-1.5 text-center @max-[36rem]/trav:flex-row @max-[36rem]/trav:gap-3 @max-[36rem]/trav:py-1 @max-[36rem]/trav:text-left"
                >
                  {i > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 @max-[36rem]/trav:hidden',
                        done || current ? 'bg-primary' : 'bg-border',
                      )}
                    />
                  )}
                  {/* z-[1]: garis milik tahap berikutnya muncul belakangan di DOM dan melintasi separuh lingkaran ini. */}
                  <span
                    className={cn(
                      'relative z-[1] grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold [&_svg]:size-4',
                      done && 'bg-primary text-primary-foreground',
                      current && 'bg-highlight text-highlight-foreground',
                      skipped && 'border border-dashed border-border bg-card text-muted-foreground',
                      !done && !current && !skipped && 'bg-card text-muted-foreground ring-1 ring-border',
                    )}
                  >
                    {done ? <Check aria-hidden /> : i + 1}
                  </span>
                  <span className="flex min-w-0 flex-col items-center gap-0.5 @max-[36rem]/trav:flex-row @max-[36rem]/trav:items-baseline @max-[36rem]/trav:gap-2">
                    <span className={cn('text-xs', current ? 'font-semibold text-foreground' : 'font-medium text-foreground/80')}>
                      {t(`status.${stage}`)}
                    </span>
                    <span className={cn('font-mono text-xs text-muted-foreground', skipped && 'italic')}>
                      {at ?? (skipped ? t('serviceDetail.skipped') : emptyValue)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Dua kolom selama halaman cukup lebar (container query). */}
      <div className="grid gap-4 @min-[44rem]/detail:grid-cols-2">
        {/* ---------- Pelanggan ---------- */}
        <section className={panel}>
          <h3 className={panelTitle}>{t('serviceDetail.customerLabel')}</h3>
          <p className="text-lg font-semibold [overflow-wrap:anywhere]">{service.customerName}</p>
          {canSeePhone && (
            <p className="font-mono text-sm text-muted-foreground">{service.customerPhone || emptyValue}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {canSeePhone && (
              <Button variant="outline" size="sm" onClick={() => setNotifyOpen(true)}>
                <WhatsAppIcon className="size-4" /> WhatsApp
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => void copyTrackingLink()}>
              <Link2 aria-hidden /> {t('serviceDetail.copyTracking')}
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            {/* QR sungguhan: pelanggan memindainya dari layar untuk membuka halaman lacak. */}
            <div
              className="size-[72px] shrink-0 rounded-lg bg-white p-0.5 ring-1 ring-border/70 [&_svg]:size-full"
              role="img"
              aria-label={t('serviceDetail.qrAria')}
              dangerouslySetInnerHTML={{ __html: qrSvg(trackingLink, { size: 72, margin: 2 }) }}
            />
            <span className="text-xs text-muted-foreground">{t('serviceDetail.qrText')}</span>
          </div>
        </section>

        {/* ---------- Penerimaan unit ---------- */}
        <section className={panel}>
          <h3 className={panelTitle}>{t('serviceDetail.intakeLabel')}</h3>
          <p className="mb-4 text-sm [overflow-wrap:anywhere]">{service.complaint || emptyValue}</p>
          <dl className="m-0 grid gap-2.5 text-sm">
            {[
              [t('serviceDetail.accessories'), service.accessories || emptyValue, ''],
              [t('serviceDetail.category'), service.category, ''],
              ...(service.deviceSerial ? [[t('serviceDetail.serial'), service.deviceSerial, 'font-mono']] : []),
              ...(service.deviceCondition ? [[t('serviceDetail.condition'), service.deviceCondition, '']] : []),
            ].map(([label, value, cls], i) => (
              <div key={i} className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-muted-foreground">{label}</dt>
                <dd className={cn('m-0 min-w-0 text-right font-medium [overflow-wrap:anywhere]', cls as string)}>{value}</dd>
              </div>
            ))}
            {service.secretKind && (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="shrink-0 text-muted-foreground">{t('serviceDetail.screenLock')}</dt>
                <dd className="m-0 min-w-0 text-right">
                  <ScreenLockReadout
                    service={service}
                    canView={isManager || (!!me && service.technicianId === me.id)}
                  />
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* ---------- Sparepart ---------- */}
        <section className={cn(panel, '@min-[44rem]/detail:col-span-2')}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/70 pb-3">
            <h3 className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {t('serviceDetail.partsLabel')}
            </h3>
            {canAddParts && (
              <div className="flex flex-wrap gap-2">
                {/* Garansi per part ditetapkan saat Selesai; tombol ini untuk part
                    yang ditambahkan belakangan atau koreksi. */}
                {warrantyDecided(service) && service.spareparts.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setPartWarrantyOpen(true)}>
                    <ShieldCheck aria-hidden /> {t('serviceDetail.partWarrantyBtn')}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                  <Plus aria-hidden /> {t('serviceDetail.sparepart')}
                </Button>
                {/* Modal Dadakan = pengeluaran kas: owner/admin saja (RLS & RPC 0087). */}
                {isManager && (
                  <Button variant="outline" size="sm" onClick={openModalForm}>
                    <Plus aria-hidden /> {t('serviceDetail.extraCost')}
                  </Button>
                )}
              </div>
            )}
          </div>

          {modalFormOpen && (
            <div className="@container/mform mb-4 grid gap-3 rounded-xl bg-surface p-4 ring-1 ring-border/60">
              <Field label={t('serviceDetail.modalName')}>
                <TextInput
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder={t('serviceDetail.modalNamePh')}
                  autoFocus
                />
              </Field>
              <div className="grid gap-3 @min-[30rem]/mform:grid-cols-2">
                <Field label={t('serviceDetail.modalAmount')}>
                  <TextInput
                    capitalize="none"
                    inputMode="numeric"
                    className="font-mono tabular-nums placeholder:font-sans"
                    value={modalAmount}
                    onChange={(e) => setModalAmount(fmtRpInput(e.target.value))}
                    placeholder="250.000"
                  />
                </Field>
                <Field label={t('serviceDetail.fromWallet')}>
                  <SelectBox
                    value={modalWalletId}
                    onValueChange={setModalWalletId}
                    options={wallets.map((w) => ({ value: w.id, label: w.name }))}
                  />
                </Field>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">
                <Info aria-hidden />
                {editIndex == null ? t('serviceDetail.modalAddHint') : t('serviceDetail.modalEditHint')}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={closeModalForm}>
                  {t('common.cancel')}
                </Button>
                <Button size="sm" onClick={editIndex == null ? addManualModal : updateManualModal} disabled={savingCost}>
                  {savingCost && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
                  {t(editIndex == null ? 'serviceDetail.saveModal' : 'serviceDetail.updateModal')}
                </Button>
              </div>
            </div>
          )}

          {service.spareparts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('serviceDetail.noParts')}</p>
          ) : (
            // Enam lajur butuh ±470px (ikon + jumlah + biaya + status + dua tombol);
            // di wadah lebih sempit nama mengambil baris pertama, sisanya baris kedua.
            <ul className="@container/bom m-0 flex list-none flex-col p-0">
              {service.spareparts.map((p, i) => {
                const manual = p.kind === 'manual';
                const state = manual
                  ? { variant: 'secondary' as const, label: t('serviceDetail.stateCash') }
                  : cancelled
                    ? p.deducted
                      ? { variant: 'secondary' as const, label: t('serviceDetail.stateUsed') }
                      : { variant: 'secondary' as const, label: t('serviceDetail.stateReturned') }
                    : p.deducted
                      ? { variant: 'success' as const, label: t('serviceDetail.stateFitted') }
                      : { variant: 'warning' as const, label: t('serviceDetail.stateWaiting') };
                const Glyph = manual ? Banknote : Cpu;
                return (
                  <li
                    key={`${p.itemId ?? 'm'}-${i}`}
                    className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto_auto_auto_auto] items-center gap-3 border-b border-border/70 py-2.5 last:border-b-0 @max-[470px]/bom:flex @max-[470px]/bom:flex-wrap @max-[470px]/bom:gap-x-3 @max-[470px]/bom:gap-y-1.5"
                  >
                    <span className="grid size-7 place-items-center rounded-lg bg-secondary text-secondary-foreground [&_svg]:size-3.5">
                      <Glyph aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-col text-sm font-medium [overflow-wrap:anywhere] @max-[470px]/bom:flex-[1_1_calc(100%-2.5rem)]">
                      {p.name}
                      {warrantyDecided(service) && (
                        <small className="text-xs font-normal text-muted-foreground">
                          {p.warrantyDays == null
                            ? t('serviceDetail.warrantyUnset')
                            : p.warrantyUntil
                              ? interpolate(t('serviceDetail.warrantyUntil'), { date: fmtDate(p.warrantyUntil) })
                              : t('serviceDetail.noWarranty')}
                        </small>
                      )}
                    </span>
                    <span className={cn(money, 'text-sm text-muted-foreground @max-[470px]/bom:ml-10')}>
                      {manual ? '' : `×${p.qty}`}
                    </span>
                    <span className={cn(money, 'whitespace-nowrap text-sm font-semibold')}>
                      {manual ? fmtMoney(p.costPrice) : fmtMoney(p.sellPrice * p.qty)}
                    </span>
                    <Badge variant={state.variant} className="@max-[470px]/bom:mr-auto">
                      {state.label}
                    </Badge>
                    {/* Satu sel untuk semua tombol baris, supaya baris tak pernah punya trek ketujuh. */}
                    <span className="flex justify-end gap-0.5">
                      {!cancelled && manual && isManager && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => openEditModal(i)}
                          title={t('serviceDetail.editModal')}
                          aria-label={t('serviceDetail.editModal')}
                        >
                          <Pencil aria-hidden />
                        </Button>
                      )}
                      {/* Part terpasang di tiket Lunas sudah dibayar: stoknya tak bisa kembali (0088). */}
                      {canWork && !cancelled && !(manual && !isManager) && !(service.status === 'lunas' && !manual && p.deducted) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                          onClick={() => setToRemove(i)}
                          title={t('serviceDetail.removeLine')}
                          aria-label={interpolate(t('serviceDetail.removeAria'), { name: p.name })}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ---------- Biaya ---------- */}
        <section className={panel}>
          <h3 className={panelTitle}>{t('serviceDetail.costLabel')}</h3>
          <dl className="m-0 grid gap-2">
            <div className={costRow}>
              <dt className="text-muted-foreground">{t('serviceDetail.estimate')}</dt>
              <dd className={cn('m-0', money)}>{fmtMoney(service.estimateCost)}</dd>
            </div>
            <div className={costRow}>
              <dt className="text-muted-foreground">{t('serviceDetail.finalCost')}</dt>
              <dd className={cn('m-0', service.finalCost > 0 && money)}>
                {service.finalCost > 0 ? fmtMoney(service.finalCost) : t('serviceDetail.notSet')}
              </dd>
            </div>
            {service.downPayment > 0 && (
              <div className={costRow}>
                <dt className="text-muted-foreground">{t('serviceDetail.dpReceived')}</dt>
                <dd className={cn('m-0 text-muted-foreground', money)}>− {fmtMoney(service.downPayment)}</dd>
              </div>
            )}
            {cancelled && keptDp !== null && keptDp > 0 && (
              <div className={costRow}>
                <dt className="text-muted-foreground">{t('serviceDetail.dpKept')}</dt>
                <dd className={cn('m-0', money)}>{fmtMoney(keptDp)}</dd>
              </div>
            )}
            <div className={cn(costRow, 'mt-1 border-t border-border/70 pt-3 font-semibold')}>
              <dt>{billingReadout.label}</dt>
              <dd className={cn('m-0 text-base', money)}>{billingReadout.value}</dd>
            </div>
            {isOwner && (
              <>
                <div className={costRow}>
                  <dt className="text-muted-foreground">{t('serviceDetail.modalTotal')}</dt>
                  <dd className={cn('m-0 text-muted-foreground', money)}>− {fmtMoney(modalTotal)}</dd>
                </div>
                <div className={cn(costRow, 'font-semibold')} data-loss={profitKnown && profit < 0}>
                  <dt>{t('serviceDetail.unitProfit')}</dt>
                  <dd
                    className={cn(
                      'm-0',
                      money,
                      profitKnown && (profit < 0 ? 'text-warning-foreground' : 'text-success-foreground'),
                    )}
                  >
                    {profitKnown ? fmtMoney(profit) : emptyValue}
                  </dd>
                </div>
              </>
            )}
          </dl>
          {costStale && costLocked && (
            <div
              className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-warning px-3.5 py-3 text-sm text-warning-foreground ring-1 ring-warning-foreground/20"
              role="status"
            >
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning-foreground" />
              <p className="min-w-0 flex-1">
                {interpolate(t(service.status === 'lunas' ? 'serviceDetail.costStalePaid' : 'serviceDetail.costStale'), {
                  amount: fmtMoney(service.finalCost),
                })}
              </p>
              {isManager && (
                <Button type="button" variant="outline" size="sm" onClick={() => openStatus()}>
                  {t(service.status === 'lunas' ? 'serviceDetail.correctCost' : 'serviceDetail.reviseAtSettle')}
                </Button>
              )}
            </div>
          )}
        </section>

        {/* ---------- Log ---------- */}
        <section className={panel}>
          <h3 className={panelTitle}>{t('serviceDetail.logLabel')}</h3>
          <ul className="m-0 grid list-none gap-4 p-0">
            {log.map((l, i) => (
              <li
                key={i}
                className="relative pl-5 before:absolute before:left-[3px] before:top-1.5 before:size-2 before:rounded-full before:bg-primary after:absolute after:bottom-[-1rem] after:left-[6px] after:top-4 after:w-px after:bg-border last:after:hidden data-[internal=true]:before:bg-muted-foreground/50"
                data-internal={l.internal || undefined}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm font-semibold">{historyLabel(l)}</strong>
                  {l.internal && <Badge variant="secondary">{t('serviceDetail.internal')}</Badge>}
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {fmtDateTime(l.at)} · {l.byName}
                </span>
                {l.note && <p className="mt-1 text-sm [overflow-wrap:anywhere]">{l.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ---------- Bilah aksi ----------
          Menempel di dasar layar selebar kolom isi (sticky, bukan fixed): dulu
          fixed dengan tepi kiri = lebar sidebar, sehingga salah tempat saat
          sidebar dilipat. Sekunder disembunyikan bila bilahnya sempit. */}
      <div className="@container/bar sticky bottom-0 z-(--z-sticky) mt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div
          className={cn(
            'flex items-center justify-between gap-4 rounded-2xl bg-card/90 px-5 py-3 shadow-raised ring-1 ring-border/70 backdrop-blur-md compact:px-4',
            // Teknisi pada tiket orang lain: catatan penugasan mengisi baris sendiri di atas bilah.
            !canWork && 'flex-wrap gap-y-2',
          )}
        >
          {!canWork && (
            <p className="basis-full text-sm text-muted-foreground [overflow-wrap:anywhere]" role="note">
              {staffNote}
            </p>
          )}
          <div className="flex min-w-0 shrink-0 flex-col">
            <span className="text-xs font-medium text-muted-foreground">{billingReadout.label}</span>
            <span className={cn(money, 'text-lg font-semibold leading-tight')}>{billingReadout.value}</span>
          </div>
          <div className="flex min-w-0 flex-wrap justify-end gap-2 @max-[30rem]/bar:flex-nowrap">
            {actions.map((a) => renderAction(a, 'bar'))}
            {secondaryActions.length > 0 && (
              <Button
                variant="outline"
                className={cn('hidden', barFold.more)}
                onClick={() => setMoreOpen(true)}
                aria-haspopup="dialog"
              >
                <Ellipsis aria-hidden /> {t('serviceDetail.more')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <FormDialog
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={`${t('serviceDetail.moreTitle')} · ${service.serviceNo}`}
        size="sm"
      >
        <div className="grid gap-2">
          {secondaryActions.map((a) => renderAction(a, 'sheet', () => setMoreOpen(false)))}
        </div>
      </FormDialog>

      {/* ---------- Modals ---------- */}
      <ServiceModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editing={service}
        services={services}
        employees={sessionEmployees}
        onSaved={() => {}}
      />
      <StatusModal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        service={service}
        onSaved={() => setCostStale(false)}
        handover={statusHandover}
        onHandedOver={() => setDoneOpen(true)}
      />
      <TicketDoneModal open={doneOpen} onClose={() => setDoneOpen(false)} service={service} variant="handover" />
      <NotifyModal open={notifyOpen} onClose={() => setNotifyOpen(false)} service={service} />
      <WarrantyClaimModal
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        origin={service}
        services={services}
        onSaved={() => {}}
      />
      <PartWarrantyModal
        open={partWarrantyOpen}
        onClose={() => setPartWarrantyOpen(false)}
        service={service}
        history={history}
      />
      <SparepartPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existingItemIds={service.spareparts.map((p) => p.itemId).filter((x): x is string => !!x)}
        onPick={addSparepartLine}
      />
      <ConfirmDialog
        open={confirmPickup}
        title={t('services.unpaidTitle')}
        message={interpolate(t('serviceDetail.unpaidMsg'), { amount: fmtMoney(outstanding) })}
        confirmLabel={t('services.unpaidConfirm')}
        onCancel={() => setConfirmPickup(false)}
        onConfirm={() => {
          setConfirmPickup(false);
          void togglePickup(true);
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={interpolate(t('serviceDelete.title'), { no: service.serviceNo })}
        message={t('serviceDelete.message')}
        confirmLabel={t('serviceDelete.confirm')}
        danger
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void runDelete()}
      />
      {/* Hapus baris BOM memindahkan uang (modal dadakan → saldo kembali) atau
          stok (part → rak). Dulu terjadi seketika tanpa konfirmasi. */}
      <ConfirmDialog
        open={toRemove !== null}
        title={t('serviceDetail.removeTitle')}
        message={(() => {
          const line = toRemove !== null ? service.spareparts[toRemove] : null;
          if (!line) return '';
          return line.kind === 'manual'
            ? interpolate(t('serviceDetail.removeManualMsg'), { name: line.name, amount: fmtMoney(line.costPrice) })
            : interpolate(t('serviceDetail.removePartMsg'), {
                name: line.name,
                qty: String(line.qty),
                effect: t(line.deducted ? 'serviceDetail.stockRestored' : 'serviceDetail.stockNotDeducted'),
              });
        })()}
        confirmLabel={t('common.delete')}
        danger
        onCancel={() => setToRemove(null)}
        onConfirm={() => {
          const i = toRemove;
          setToRemove(null);
          if (i !== null) void removeCostLine(i);
        }}
      />
    </div>
  );
}
