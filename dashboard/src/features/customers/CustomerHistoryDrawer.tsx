import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Cpu, Wrench } from 'lucide-react';
import { LoadState, loadPending } from '@/components/ui';
import { Badge } from '@/components/dens/badge';
import { EmptyState } from '@/components/dens/empty-state';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/dens/sheet';
import type { LoadQuery } from '@/components/ui/loadPending';
import { STATUS_BADGE, STATUS_LABELS } from '@/lib/business/services';
import { customerServiceStats } from '@/lib/business/customers';
import { fmtRp, EMPTY_VALUE } from '@/lib/format';
import { useFormat } from '@/lib/useFormat';
import type { Customer, Service } from '@/data/types';

interface Props {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  services: Service[];
  servicesLoad: LoadQuery;
}

/**
 * Panel samping berisi seluruh riwayat servis satu pelanggan (terbaru dulu),
 * yaitu tiket di balik hitungan pada kartunya. Tiap baris menuju detail tiket.
 * Sheet dens (Radix Dialog): fokus terkunci, Esc menutup, fokus kembali ke
 * kartu pembukanya.
 */
export function CustomerHistoryDrawer({ open, onClose, customer, services, servicesLoad }: Props) {
  const { fmtDate } = useFormat();
  // Servis belum termuat / gagal: "Belum ada servis · Rp 0" di sini bohong.
  const pending = loadPending(servicesLoad);
  // Pelanggan terakhir tetap ditampilkan selama panel menutup (halaman
  // mengosongkan pilihannya saat ditutup), supaya isi tak hilang di tengah animasi.
  const [shown, setShown] = useState<Customer | null>(customer);
  if (customer && customer !== shown) setShown(customer);

  // Tickets for this customer, newest first (createdAt desc, fallback serviceNo).
  const tickets = useMemo(() => {
    if (!shown) return [];
    return services
      .filter((s) => s.customerId === shown.id)
      .sort(
        (a, b) =>
          (b.createdAt ?? '').localeCompare(a.createdAt ?? '') ||
          b.serviceNo.localeCompare(a.serviceNo),
      );
  }, [shown, services]);

  // Angka di strip ini HARUS sama dengan kartu yang dipakai membukanya: aturan
  // "batal tidak dihitung, hanya Lunas yang menambah nilai" tinggal di satu
  // tempat. Dulu strip memakai tickets.length, jadi pelanggan dengan satu tiket
  // batal terbaca "3x" di kartu dan "4 servis" di sini.
  const stat = useMemo(
    () => (shown ? customerServiceStats(tickets).get(shown.id) : undefined),
    [shown, tickets],
  );

  return (
    <Sheet open={open && !!customer} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        aria-describedby={undefined}
        className="gap-0 p-0"
      >
        {shown && (
          <>
            <SheetHeader className="border-b border-border/70 px-5 pt-5 pb-4 pr-14">
              <span className="text-xs font-medium text-muted-foreground">Riwayat servis</span>
              <SheetTitle className="truncate">{shown.name}</SheetTitle>
            </SheetHeader>

            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-dashed border-border bg-surface/60 px-5 py-2.5 text-sm text-muted-foreground [&_strong]:font-mono [&_strong]:font-semibold [&_strong]:text-foreground [&_strong]:tabular-nums">
              <span>
                <strong>{pending ? EMPTY_VALUE : (stat?.count ?? 0)}</strong> servis
              </span>
              <span>
                Lunas <strong>{pending ? EMPTY_VALUE : fmtRp(stat?.paidTotal ?? 0)}</strong>
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {pending ? (
                <LoadState queries={[servicesLoad]} />
              ) : tickets.length === 0 ? (
                <EmptyState
                  icon={<Wrench aria-hidden />}
                  title="Belum ada servis"
                  description="Tiket servis pelanggan ini akan muncul di sini."
                />
              ) : (
                <ul className="m-0 grid list-none gap-2 p-0">
                  {tickets.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/services/${s.id}`}
                        onClick={onClose}
                        className="group flex items-center gap-3 rounded-xl p-3 text-inherit no-underline ring-1 ring-border/70 outline-none transition-[box-shadow,background-color] hover:bg-accent/50 hover:ring-primary/30 focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="grid min-w-0 flex-1 gap-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-semibold">{s.serviceNo}</span>
                            <Badge variant={STATUS_BADGE[s.status]}>{STATUS_LABELS[s.status]}</Badge>
                          </span>
                          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground [&>svg]:size-3.5 [&>svg]:shrink-0">
                            <Cpu aria-hidden />
                            <span className="truncate">
                              {s.category}
                              {s.device ? ` · ${s.device}` : ''}
                            </span>
                          </span>
                          <span className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground [&>svg]:size-3.5">
                              <CalendarDays aria-hidden /> {fmtDate(s.createdAt)}
                            </span>
                            <span className="font-mono text-sm font-semibold tabular-nums">{fmtRp(s.finalCost)}</span>
                          </span>
                        </span>
                        <ArrowRight
                          aria-hidden
                          className="size-4 shrink-0 text-muted-foreground transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
