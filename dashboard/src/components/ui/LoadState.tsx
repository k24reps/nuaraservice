import { LoaderCircle, RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { EmptyState } from '@/components/dens/empty-state';
import { useT } from '@/i18n';
import type { LoadQuery } from './loadPending';

/**
 * Loading or failed state for a list whose emptiness is not known yet. Pair
 * with `loadPending` (./loadPending) before rendering the page's EmptyState.
 */
export function LoadState({ queries }: { queries: LoadQuery[] }) {
  const t = useT();
  const failed = queries.filter((q) => q.error !== null);

  if (failed.length === 0) {
    return (
      <div role="status" aria-live="polite">
        <EmptyState
          icon={<LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
          title={t('common.loading')}
        />
      </div>
    );
  }

  return (
    <div role="alert">
      <EmptyState
        icon={<TriangleAlert aria-hidden />}
        title={t('common.loadFailed')}
        description={t('common.loadFailedDescription')}
        action={
          <Button variant="secondary" size="sm" onClick={() => failed.forEach((q) => void q.refetch())}>
            <RotateCw aria-hidden />
            {t('common.retry')}
          </Button>
        }
      />
    </div>
  );
}
