import { useState } from 'react';
import { Link2, Printer } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { Field } from '@/components/dens/field';
import { FormDialog } from '@/components/dens/form-dialog';
import { Textarea } from '@/components/dens/textarea';
import { WhatsAppIcon } from '@/components/dens/whatsapp-icon';
import {
  waLink,
  interpolate,
  serviceVars,
  resolveWaTemplates,
  WA_TEMPLATE_LABELS,
  type WaTemplateKey,
} from '@/lib/business/notify';
import { useServicePrint } from './useServicePrint';
import { getWaTemplateOverrides } from '@/config/orgConfig';
import { toast } from '@/stores/toast';
import { demoGuard } from '@/stores/demo';
import { useSessionStore } from '@/stores/session';
import { useResetOnOpen } from '@/hooks/useResetOnOpen';
import type { Service } from '@/data/types';
import { useT } from '@/i18n';

interface NotifyModalProps {
  open: boolean;
  onClose: () => void;
  service: Service | null;
  /** Template yang dipilih saat dibuka (panel tiket baru / serah unit). */
  initialTemplate?: TemplateKey;
}

type TemplateKey = WaTemplateKey;

export function NotifyModal({ open, onClose, service, initialTemplate }: NotifyModalProps) {
  const t = useT();
  const org = useSessionStore((s) => s.org);
  const { trackCode, trackLink, print: printReceipt } = useServicePrint(service);
  const [templateKey, setTemplateKey] = useState<TemplateKey>(initialTemplate ?? 'selesai');
  // Dibuka dari panel tiket baru / serah unit: mulai di template momen itu.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && initialTemplate) setTemplateKey(initialTemplate);
  }
  const [message, setMessage] = useState('');

  const templates = resolveWaTemplates(getWaTemplateOverrides());

  // Include finalCost + updatedAt in the memo key so the message regenerates
  // when the cost (or any field) changes after the modal was first opened.
  // Without this, the WA text kept a stale "Rp 0" until a full page refresh.
  // Kode lacak tiba sesudah modal terbuka; pesannya disusun ulang supaya
  // tautannya ikut menjadi `/t/<kode>`.
  const memoKey = service
    ? `${service.id}|${templateKey}|${service.finalCost}|${service.updatedAt}|${trackCode ?? ''}`
    : null;
  useResetOnOpen(open, memoKey, () => {
    // Penyempitan tipe tidak menembus batas callback, jadi diulang di sini.
    // `memoKey` sudah null saat service belum ada, jadi ini praktis tak
    // pernah terpicu — tetapi tetap ditulis agar tipenya jujur.
    if (!service || !org) return;
    const vars = { ...serviceVars(service, org), tautan: trackLink };
    setMessage(interpolate(templates[templateKey], vars));
  });

  if (!service || !org) return null;

  const sendWa = () => {
    if (demoGuard('demo.whatsapp')) return;
    window.open(waLink(service.customerPhone, message), '_blank');
    toast.success(t('notify.waOpening'));
  };

  const copyTracking = async () => {
    try {
      await navigator.clipboard.writeText(trackLink);
      toast.success(t('notify.linkCopied'));
    } catch {
      toast.error(t('notify.linkFailed'));
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={interpolate(t('notify.title'), { no: service.serviceNo })}
      footer={
        <>
          <Button variant="outline" onClick={printReceipt}>
            <Printer aria-hidden />
            {t('notify.print')}
          </Button>
          <Button onClick={sendWa}>
            <WhatsAppIcon className="size-4" />
            {t('notify.sendWa')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('notify.message')}>
          {(Object.keys(templates) as TemplateKey[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={templateKey === k}
              className="min-h-9 flex-auto rounded-full bg-card px-3 text-[13px] font-medium text-foreground ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:ring-primary pointer-coarse:min-h-11"
              onClick={() => setTemplateKey(k)}
            >
              {WA_TEMPLATE_LABELS[k]}
            </button>
          ))}
        </div>

        <Field label={t('notify.message')}>
          <Textarea
            className="max-h-[50dvh] min-h-48 [field-sizing:fixed]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={12}
          />
        </Field>

        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={copyTracking}>
          <Link2 aria-hidden /> {t('notify.copyLink')}
        </Button>
      </div>
    </FormDialog>
  );
}
