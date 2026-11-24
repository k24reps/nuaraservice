import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/dens/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 text-center text-card-foreground shadow-panel ring-1 ring-border/60">
        <p className="font-mono text-5xl font-semibold text-muted-foreground tabular-nums" aria-hidden>
          404
        </p>
        <h1 className="mt-3 text-xl font-semibold">Jalur halaman terputus</h1>
        <p className="mt-2 text-sm leading-normal text-muted-foreground">Halaman ini tidak ditemukan atau sudah dipindahkan.</p>
        <Button asChild className="mt-6 h-auto min-h-10 py-2 whitespace-normal">
          <Link to="/">
            <ArrowLeft aria-hidden />
            Kembali ke Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
