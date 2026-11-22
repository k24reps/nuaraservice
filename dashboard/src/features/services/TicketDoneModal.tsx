import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { Badge } from '@/components/dens/badge';
import { Button } from '@/components/dens/button';
import { FormDialog } from '@/components/dens/form-dialog';
import { WhatsAppIcon } from '@/components/dens/whatsapp-icon';
import { useSessionStore } from '@/stores/session';
import { fmtRp } from '@/lib/format';
import { fmtDate } from '@/lib/time';
import { interpolate } from '@/lib/business/notify';
import { useT } from '@/i18n';
import type { Service } from '@/data/types';
import { NotifyModal } from './NotifyModal';
import { useServicePrint } from './useServicePrint';

interface TicketDoneModalProps {
  open: boolean;
  onClose: () => void;
  service: Service | null;
  /** `intake` = tiket baru dibuat; `handover` = unit lunas & diserahkan. */
  variant: 'intake' | 'handover';
}

/**
 * Dua momen fisik di konter — unit dititipkan dan unit diserahkan — dulu hanya
 * ditutup toast, padahal pelanggan masih di depan meja menunggu kertas atau
 * pesan WA. Panel ini menahan momennya: stempel, ringkasan, cetak, kirim WA.
 * Polanya sama dengan panel LUNAS di Kasir.
 */
export function TicketDoneModal({ open, onClose, service, variant }: TicketDoneModalProps) {
  const t = useT();
  const org = useSessionStore((s) => s.org);
  const { print } = useServicePrint(service);
  const navigate = useNavigate();
  const [notifyOpen, setNotifyOpen] = useState(false);
  if (!service) return null;
  const intake = variant === 'intake';

  return (
    <>
      <FormDialog
        open={open}
        onClose={onClose}
        title={t(intake ? 'ticketDone.intakeTitle' : 'ticketDone.handoverTitle')}
        size="sm"
        footer={
          <>
            {intake && (
              <Button
                variant="ghost"
                onClick={() => {
                  onClose();
                  navigate(`/services/${service.id}`);
                }}
              >
                {t('ticketDone.viewTicket')}
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              {t('common.close')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Dulu cap miring (motif FixMaster); kini lencana dengan teks yang sama. */}
            <Badge variant={intake ? 'info' : 'success'} className="px-3 py-1 text-sm">
              {t(intake ? 'ticketDone.intakeStamp' : 'ticketDone.handoverStamp')}
            </Badge>
            <span className="font-mono text-sm font-semibold tracking-wide text-muted-foreground">{service.serviceNo}</span>
          </div>
          <dl className="m-0 grid divide-y divide-border/70 border-y border-border/70">
            {[
              [t('ticketDone.unit'), service.device, ''],
              [t('ticketDone.customer'), service.customerName, ''],
              ...(intake
                ? service.estimateCost > 0
                  ? [[t('ticketDone.estimate'), fmtRp(service.estimateCost), 'font-mono tabular-nums']]
                  : []
                : [
                    [t('ticketDone.paid'), fmtRp(service.finalCost), 'font-mono tabular-nums'],
                    ...(service.warrantyServiceUntil
                      ? [[
                          t('ticketDone.warranty'),
                          interpolate(t('ticketDone.until'), { date: fmtDate(service.warrantyServiceUntil.slice(0, 10)) }),
                          '',
                        ]]
                      : []),
                  ]),
            ].map(([term, value, cls]) => (
              <div key={term} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <dt className="shrink-0 text-muted-foreground">{term}</dt>
                <dd className={`m-0 min-w-0 text-right font-medium [overflow-wrap:anywhere] ${cls}`}>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">{t(intake ? 'ticketDone.intakeHint' : 'ticketDone.handoverHint')}</p>
          <div className="grid gap-2">
            {org && (
              <Button onClick={print}>
                <Printer aria-hidden />
                {t(intake ? 'ticketDone.printIntake' : 'ticketDone.printNota')}
              </Button>
            )}
            <Button variant="outline" onClick={() => setNotifyOpen(true)}>
              <WhatsAppIcon className="size-4" />
              {t('ticketDone.sendWa')}
            </Button>
          </div>
        </div>
      </FormDialog>
      <NotifyModal
        open={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        service={service}
        initialTemplate={intake ? 'diterima' : 'diambil'}
      />
    </>
  );
}
