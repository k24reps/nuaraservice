import { useState } from 'react';
import { Button } from '@/components/dens/button';
import { Field, FormMessage } from '@/components/dens/field';
import { Input } from '@/components/dens/input';
import { PasswordInput } from '@/components/dens/password-input';
import { PasswordStrength } from '@/components/dens/password-strength';
import { useT, type TranslationKey } from '@/i18n';
import { useAuthStore } from '@/stores/auth';
import { toast } from '@/stores/toast';
import type { PublicAuthMode } from './auth-intent';
import { AuthShell } from './AuthShell';

type Mode = 'login' | 'signup' | 'reset';

interface AuthPageProps {
  initialMode?: PublicAuthMode;
}

const TITLES: Record<Mode, { heading: TranslationKey; hint: TranslationKey; cta: TranslationKey }> = {
  login: { heading: 'authPage.login.heading', hint: 'authPage.login.hint', cta: 'authPage.login.cta' },
  signup: { heading: 'authPage.signup.heading', hint: 'authPage.signup.hint', cta: 'authPage.signup.cta' },
  reset: { heading: 'authPage.reset.heading', hint: 'authPage.reset.hint', cta: 'authPage.reset.cta' },
};

/**
 * Masuk, daftar (staf yang diundang, lihat AuthGate), dan lupa password lewat
 * Supabase Auth. Hanya tampil di mode server, sebelum data toko dimuat.
 */
export function AuthPage({ initialMode = 'login' }: AuthPageProps = {}) {
  const t = useT();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const title = TITLES[mode];

  // Kecocokan konfirmasi baru tampil setelah user mulai mengetiknya, supaya
  // kolom kosong tidak langsung tampak "salah".
  const confirmMatch = confirm ? password === confirm : null;

  const validate = (): string | null => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t('authPage.error.email');
    if (mode === 'reset') return null;
    if (password.length < 8) return t('authPage.error.passwordLength');
    // F3: syarat kompleksitas hanya saat signup (jangan kunci akun lama saat login).
    if (mode === 'signup' && !(/[a-zA-Z]/.test(password) && /\d/.test(password))) {
      return t('authPage.error.passwordComplexity');
    }
    if (mode === 'signup' && password !== confirm) return t('authPage.error.passwordMismatch');
    return null;
  };

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError('');
  };

  const submit = async () => {
    if (busy) return; // Enter bisa melewati tombol yang nonaktif: cegah kirim ganda.
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (mode === 'reset') {
        const { error: e } = await resetPassword(email);
        if (e) {
          setError(e);
        } else {
          toast.success(t('authPage.toast.resetSent'));
          changeMode('login');
        }
        return;
      }
      const action = mode === 'login' ? signIn : signUp;
      const { error: e } = await action(email, password);
      if (e) {
        setError(e);
        return;
      }
      if (mode === 'signup') {
        // Konfirmasi email nonaktif di proyek ini, jadi akun langsung aktif:
        // kembali ke form masuk tanpa langkah kotak masuk.
        toast.success(t('authPage.toast.accountCreated'));
        changeMode('login');
        setPassword('');
        setConfirm('');
      }
      // Masuk berhasil: listener auth store mengubah status dan aplikasi terbuka.
    } finally {
      setBusy(false);
    }
  };

  const reveal = { showLabel: t('authPage.showPassword'), hideLabel: t('authPage.hidePassword') };
  const linkClass =
    'font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center pointer-coarse:justify-center';

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em]">{t(title.heading)}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{t(title.hint)}</p>

      <form
        className="mt-6 grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label={t('authPage.email')}>
          <Input
            type="email"
            name="email"
            placeholder={t('authPage.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>

        {mode !== 'reset' && (
          <Field label={t('authPage.password')}>
            <PasswordInput
              {...reveal}
              name="password"
              placeholder={t('authPage.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </Field>
        )}

        {mode === 'signup' && <PasswordStrength password={password} />}

        {mode === 'signup' && (
          <Field
            label={t('authPage.confirmPassword')}
            error={confirmMatch === false ? t('authPage.confirmError') : undefined}
            hint={confirmMatch === true ? t('authPage.confirmMatch') : undefined}
          >
            <PasswordInput
              {...reveal}
              name="confirm"
              placeholder={t('authPage.confirmPlaceholder')}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        )}

        <FormMessage>{error}</FormMessage>

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? t('authPage.processing') : t(title.cta)}
        </Button>
      </form>

      <div className="mt-5 flex flex-col items-center gap-2 text-sm">
        {mode === 'login' && (
          <>
            <button type="button" className={linkClass} onClick={() => changeMode('reset')}>
              {t('authPage.forgotPassword')}
            </button>
            <span className="text-muted-foreground">
              {t('authPage.noAccount')}{' '}
              <button type="button" className={linkClass} onClick={() => changeMode('signup')}>
                {t('authPage.register')}
              </button>
            </span>
          </>
        )}
        {mode === 'signup' && (
          <span className="text-muted-foreground">
            {t('authPage.haveAccount')}{' '}
            <button type="button" className={linkClass} onClick={() => changeMode('login')}>
              {t('authPage.signIn')}
            </button>
          </span>
        )}
        {mode === 'reset' && (
          <button type="button" className={linkClass} onClick={() => changeMode('login')}>
            {t('authPage.backToSignIn')}
          </button>
        )}
      </div>
    </AuthShell>
  );
}
