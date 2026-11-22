import { useEffect, useState } from 'react';
import { readScreenLock } from '@/data/serviceSecret';
import { useT } from '@/i18n';
import type { Service } from '@/data/types';
import { Button } from '@/components/dens/button';

/**
 * Kunci layar di detail tiket: tersamar sampai diminta, hilang sendiri setelah
 * 30 detik, dan hanya bisa dibuka teknisi yang ditugaskan atau owner/admin
 * (server menolak yang lain — `canView` hanya menyembunyikan tombolnya).
 * Setelah unit diambil, yang tersisa hanya jejak bahwa kunci pernah diberikan.
 */
export function ScreenLockReadout({ service, canView }: { service: Service; canView: boolean }) {
  const t = useT();
  const [shown, setShown] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (shown === null) return;
    const id = window.setTimeout(() => setShown(null), 30_000);
    return () => window.clearTimeout(id);
  }, [shown]);

  if (!service.secretKind) return null;
  const kind = t(`serviceForm.lock_${service.secretKind}`);

  if (service.pickedUp || gone) {
    return (
      <span className="text-sm text-muted-foreground">
        {kind} · {t(service.pickedUp ? 'serviceDetail.lockPurged' : 'serviceDetail.lockMissing')}
      </span>
    );
  }
  if (!canView) {
    return (
      <span className="text-sm text-muted-foreground">
        {kind} · {t('serviceDetail.lockRestricted')}
      </span>
    );
  }

  const reveal = async () => {
    setBusy(true);
    setError('');
    try {
      const lock = await readScreenLock(service);
      if (lock) setShown(lock.secret);
      else setGone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('serviceDetail.lockFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <span className="font-mono tabular-nums tracking-[0.04em] [overflow-wrap:anywhere]">
        {kind} {shown ?? '••••'}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => (shown === null ? void reveal() : setShown(null))}
        disabled={busy}
      >
        {t(shown === null ? 'serviceDetail.lockShow' : 'serviceDetail.lockHide')}
      </Button>
      {error && <span className="basis-full text-right text-xs text-destructive">{error}</span>}
    </span>
  );
}
