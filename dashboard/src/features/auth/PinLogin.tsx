import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/dens/button';
import { cn } from '@/lib/utils';
import { AuthShell } from './AuthShell';
import { verifyPin, needsRehash, hashPin } from '@/lib/pin';
import { repository } from '@/data';
import {
  initialAttemptState,
  registerFailure,
  registerSuccess,
  isLocked,
  lockSecondsLeft,
  attemptsLeft,
  type AttemptState,
} from '@/lib/rate-limit';
import { useSessionStore } from '@/stores/session';
import { logActivity } from '@/lib/activity';
import { toast } from '@/stores/toast';
import type { Employee } from '@/data/types';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  karyawan: 'Karyawan',
};

export function PinLogin() {
  const org = useSessionStore((s) => s.org);
  const employees = useSessionStore((s) => s.employees);
  const signInEmployee = useSessionStore((s) => s.signInEmployee);

  const [selectedId, setSelectedId] = useState<string>(employees[0]?.id ?? '');
  const [pin, setPin] = useState(['', '', '', '']);
  const [attempts, setAttempts] = useState<AttemptState>(initialAttemptState());
  const [lockLeft, setLockLeft] = useState(0);
  const [error, setError] = useState('');
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Tick down the lockout countdown.
  useEffect(() => {
    if (!isLocked(attempts)) return;
    const timer = setInterval(() => {
      const left = lockSecondsLeft(attempts);
      setLockLeft(left);
      if (left <= 0) setError('');
    }, 500);
    return () => clearInterval(timer);
  }, [attempts]);

  const selected = employees.find((e) => e.id === selectedId);
  const locked = isLocked(attempts);

  const handleDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextPin = [...pin];
    nextPin[index] = digit;
    setPin(nextPin);
    if (digit && index < 3) inputsRef.current[index + 1]?.focus();
    if (digit && index === 3) void submit(nextPin.join(''));
  };

  const handleKey = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const reset = () => {
    setPin(['', '', '', '']);
    inputsRef.current[0]?.focus();
  };

  const submit = async (code: string) => {
    if (!selected) {
      setError('Pilih pengguna terlebih dahulu');
      return;
    }
    if (locked) return;
    const ok = await verifyPin(code, selected.id, selected.pinHash);
    if (ok) {
      setAttempts(registerSuccess());
      // Best-effort upgrade of a legacy (weaker) PIN hash to the current format.
      // Guarded: a cloud RLS denial (staff can't write their own record) must
      // not block a valid login — the hash just stays legacy until next change.
      if (needsRehash(selected.pinHash)) {
        try {
          const pinHash = await hashPin(code, selected.id);
          await repository.put('employees', { ...(selected as Employee), pinHash });
        } catch {
          /* keep legacy hash; login proceeds */
        }
      }
      toast.success(`Selamat datang, ${selected.name}!`);
      signInEmployee(selected as Employee);
      logActivity({ action: 'auth.login', entityType: 'session', entityLabel: selected.name });
      return;
    }
    const nextAttempts = registerFailure(attempts);
    setAttempts(nextAttempts);
    reset();
    if (isLocked(nextAttempts)) {
      setLockLeft(lockSecondsLeft(nextAttempts));
      setError(`Terlalu banyak percobaan. Terkunci sementara.`);
    } else {
      setError(`PIN salah. Sisa ${attemptsLeft(nextAttempts)} percobaan.`);
    }
  };

  return (
    <AuthShell title={org?.name ?? 'Nuara Service'}>
      <h1 className="text-xl font-semibold leading-tight tracking-[-0.015em]">Pilih pengguna & masukkan PIN</h1>

      <div role="group" aria-label="Pengguna" className="mt-6 grid grid-cols-2 gap-2 compact:grid-cols-1">
        {employees.map((e) => {
          const active = selectedId === e.id;
          return (
            <button
              key={e.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setSelectedId(e.id);
                setError('');
                reset();
              }}
              className={cn(
                'flex min-h-14 items-center gap-3 rounded-xl p-2 pr-3 text-left ring-1 ring-border/70 outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                active && 'bg-sidebar-accent ring-2 ring-primary/50',
              )}
            >
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              >
                {e.name.charAt(0).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-col">
                <strong className="truncate text-sm font-semibold">{e.name}</strong>
                <small className="text-xs text-muted-foreground">{ROLE_LABEL[e.role]}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex justify-center gap-3" role="group" aria-label="PIN">
        {pin.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            className={cn(
              'size-14 rounded-xl border border-input bg-card text-center font-mono text-2xl font-semibold shadow-[inset_0_1px_2px_rgb(6_32_54/0.04)] outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive',
            )}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            value={d}
            disabled={locked}
            aria-invalid={error ? true : undefined}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            aria-label={`Digit PIN ${i + 1}`}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-center text-sm text-destructive">
          {error}
          {locked && lockLeft > 0 && <strong className="font-mono tabular-nums"> ({lockLeft}s)</strong>}
        </p>
      )}

      <Button size="lg" className="mt-6 w-full" onClick={() => void submit(pin.join(''))} disabled={locked}>
        Masuk
      </Button>
    </AuthShell>
  );
}
