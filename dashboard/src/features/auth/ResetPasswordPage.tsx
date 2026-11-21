import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/dens/button';
import { Field, FormMessage } from '@/components/dens/field';
import { PasswordInput } from '@/components/dens/password-input';
import { PasswordStrength } from '@/components/dens/password-strength';
import { getSupabase, authUpdatePassword } from '@/data/supabase-client';
import { toast } from '@/stores/toast';
import { AuthShell } from './AuthShell';

export type ResetPhase = 'checking' | 'ready' | 'no-session' | 'done';

/**
 * Password recovery screen — the landing target of the reset email link
 * (redirectTo=/reset-password). supabase-js parses the recovery token from the
 * URL on load (detectSessionInUrl) and establishes a temporary session, which
 * authorizes updateUser({ password }). This is a PUBLIC route (outside AuthGate)
 * so it renders regardless of the normal signed-in/out flow.
 *
 * Memakai bingkai yang sama dengan halaman masuk (AuthShell).
 */
export function ResetPasswordPage({ initialPhase }: { initialPhase?: ResetPhase } = {}) {
  const navigate = useNavigate();

  // No Supabase client → no recovery possible; start in the invalid-link state
  // (computed lazily so the effect below never setStates synchronously).
  // `initialPhase` hanya dipakai pratinjau dev (/dev/layar), yang tidak punya tautan reset.
  const [phase, setPhase] = useState<ResetPhase>(
    () => initialPhase ?? (getSupabase() ? 'checking' : 'no-session'),
  );
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Resolve whether we have a valid recovery session. supabase-js emits
  // PASSWORD_RECOVERY (or SIGNED_IN) once it parses the token from the URL;
  // we also probe getSession in case the event fired before mount.
  useEffect(() => {
    const c = getSupabase();
    if (!c || initialPhase) return;
    let settled = false;
    const markReady = () => {
      settled = true;
      setPhase('ready');
    };

    const { data: sub } = c.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) markReady();
    });

    void c.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });

    // If no recovery session materializes shortly, the link is invalid/expired.
    const timer = window.setTimeout(() => {
      if (!settled) setPhase((p) => (p === 'checking' ? 'no-session' : p));
    }, 2500);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [initialPhase]);

  const validate = (): string | null => {
    if (password.length < 8) return 'Password minimal 8 karakter';
    if (!(/[a-zA-Z]/.test(password) && /\d/.test(password))) {
      return 'Password harus mengandung huruf dan angka';
    }
    if (password !== confirm) return 'Konfirmasi password tidak cocok';
    return null;
  };

  const submit = async () => {
    if (busy) return; // Enter bypasses the disabled button → guard double-submit.
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { error: e } = await authUpdatePassword(password);
      if (e) {
        setError(e);
        return;
      }
      setPhase('done');
      toast.success('Password berhasil diperbarui.');
      // The recovery session is now a normal signed-in session → enter the app.
      window.setTimeout(() => navigate('/', { replace: true }), 1200);
    } finally {
      setBusy(false);
    }
  };

  const reveal = { showLabel: 'Tampilkan password', hideLabel: 'Sembunyikan password' };

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em]">Password Baru</h1>

      {phase === 'checking' && (
        <p role="status" className="mt-1.5 text-sm text-muted-foreground">
          Memeriksa tautan reset…
        </p>
      )}

      {phase === 'no-session' && (
        <>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru dari halaman masuk.
          </p>
          <Button
            size="lg"
            className="mt-6 w-full"
            onClick={() => navigate('/?auth=login&source=reset_password', { replace: true })}
          >
            Kembali ke Masuk
          </Button>
        </>
      )}

      {phase === 'done' && (
        <p role="status" className="mt-1.5 text-sm text-muted-foreground">
          Password diperbarui. Mengarahkan ke aplikasi…
        </p>
      )}

      {phase === 'ready' && (
        <>
          <p className="mt-1.5 text-sm text-muted-foreground">Masukkan password baru untuk akun Anda.</p>
          <form
            className="mt-6 grid gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Field label="Password Baru">
              <PasswordInput
                {...reveal}
                name="password"
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
            </Field>
            <PasswordStrength password={password} />
            <Field
              label="Konfirmasi Password"
              error={confirm && password !== confirm ? 'Belum cocok dengan password di atas' : undefined}
              hint={confirm && password === confirm ? '✓ Password cocok' : undefined}
            >
              <PasswordInput
                {...reveal}
                name="confirm"
                placeholder="Ulangi password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <FormMessage>{error}</FormMessage>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan Password'}
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
