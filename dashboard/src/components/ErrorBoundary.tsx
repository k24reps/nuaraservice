import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ArrowLeft, RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/dens/button';
import { cn } from '@/lib/utils';
import { reportError } from '@/lib/report';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * When this value changes, the boundary resets and re-renders its children.
   * Pass the current route path so navigating away from a crashed page clears
   * the error automatically.
   */
  resetKey?: string;
  /**
   * Root-level boundary (last resort). Renders a full-screen fallback and a
   * "reload app" action instead of the in-layout "try again" action.
   */
  root?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors in its subtree and shows a recoverable
 * fallback instead of a blank white screen. Used at two levels:
 *   1. Root (App) — last-resort full-screen catch.
 *   2. Route (AppLayout) — catches a single page crash while keeping the
 *      sidebar/topbar usable; resets automatically on navigation.
 *
 * Note: error boundaries only catch errors during React rendering, not in
 * event handlers or async code (those surface via toasts/promise rejections).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    // Auto-recover when the reset key changes (e.g. route navigation).
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Route through the pluggable error reporter (console-only by default;
    // a real tracker like Sentry can be wired via setErrorReporter at startup).
    reportError(error, {
      source: this.props.root ? 'root' : 'route',
      componentStack: info.componentStack ?? undefined,
    });
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <ErrorFallback error={error} root={this.props.root} onRetry={this.reset} />;
  }
}

interface ErrorFallbackProps {
  error: Error;
  /** Full-screen last-resort variant with a "reload app" action. */
  root?: boolean;
  /** Omitted by the router variant: there is nothing to reset without a boundary. */
  onRetry?: () => void;
}

/**
 * Tampilan galat bersama. Dipakai oleh ErrorBoundary (galat render React)
 * DAN oleh errorElement React Router (galat pemuatan rute) — router menangkap
 * galatnya sendiri sebelum sampai ke error boundary React, jadi tanpa ini
 * pengguna produksi melihat layar bawaan React Router yang berbunyi
 * "Hey developer".
 */
export function ErrorFallback({ error, root, onRetry }: ErrorFallbackProps) {
  return (
    <div
      data-nu
      role="alert"
      className={cn('flex items-center justify-center p-4', root ? 'min-h-dvh' : 'min-h-[60dvh] bg-transparent')}
    >
      <div className="w-full max-w-md rounded-2xl bg-card p-6 text-center text-card-foreground shadow-panel ring-1 ring-border/60">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-destructive-soft text-destructive">
          <TriangleAlert className="size-6" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">Terjadi kesalahan</h1>
        <p className="mt-2 text-sm leading-normal text-muted-foreground">
          {root
            ? 'Aplikasi mengalami gangguan tak terduga. Muat ulang untuk melanjutkan.'
            : 'Halaman ini gagal dimuat. Coba lagi, atau kembali ke dashboard.'}
        </p>

        {import.meta.env.DEV && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-surface p-3 text-left font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">
            {error.message}
          </pre>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {root ? (
            <Button className="h-auto min-h-10 py-2 whitespace-normal" onClick={() => window.location.reload()}>
              <RotateCw aria-hidden />
              Muat Ulang Aplikasi
            </Button>
          ) : (
            <>
              <Button className="h-auto min-h-10 py-2 whitespace-normal" onClick={onRetry}>
                <RotateCw aria-hidden />
                Coba Lagi
              </Button>
              <Button asChild variant="outline" className="h-auto min-h-10 py-2 whitespace-normal">
                <a href="/">
                  <ArrowLeft aria-hidden />
                  Ke Dashboard
                </a>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
