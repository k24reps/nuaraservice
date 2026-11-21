import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Info, Layers, Plus, Trash2, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/dens/alert';
import { Button } from '@/components/dens/button';
import { Field, FormMessage } from '@/components/dens/field';
import { Input as BaseInput } from '@/components/dens/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/dens/select';
import { cn } from '@/lib/utils';
import { fmtRpInput, parseRpInput } from '@/lib/format';
import { derivePrefix } from '@/lib/id';
import { isSupabaseConfigured } from '@/data/supabase-client';
import { useSessionStore } from '@/stores/session';
import { toast } from '@/stores/toast';
import { trackEvent } from '@/lib/analytics';
import { useT, type TranslationKey } from '@/i18n';
import { interpolate } from '@/lib/business/notify';
import {
  emptyWizardData,
  validateStep,
  commitWizard,
  type WizardData,
} from './wizard-logic';
import type { Role } from '@/data/types';

/**
 * Isian wizard tidak mengubah huruf kapital: penulisan nama usaha dan nama
 * orang mengikuti apa yang diketik pendaftar.
 */
function Input(props: ComponentProps<typeof BaseInput>) {
  return <BaseInput autoCapitalize="none" {...props} />;
}

/**
 * Logical step numbers are STABLE (validateStep depends on them and is unit
 * tested by number). The "Tim" step (4) is local-only: in cloud mode the owner
 * IS the signed-in account and staff join later via invite, so there are no
 * PINs to collect during onboarding. We therefore drive navigation by a list
 * of *visible* steps while keeping each step's logical number intact.
 */
const STEP_DEFS = [
  { n: 1, labelKey: 'onboarding.step.profile' },
  { n: 6, labelKey: 'onboarding.step.outlet' },
  { n: 2, labelKey: 'onboarding.step.wallet' },
  { n: 3, labelKey: 'onboarding.step.category' },
  { n: 4, labelKey: 'onboarding.step.team' },
  { n: 5, labelKey: 'onboarding.step.target' },
] as const;

const ROLE_OPTIONS: { value: Role; labelKey: TranslationKey }[] = [
  { value: 'owner', labelKey: 'settingsPage.owner' },
  { value: 'admin', labelKey: 'settingsPage.admin' },
  { value: 'karyawan', labelKey: 'settingsPage.karyawan' },
];

interface WizardProps {
  onComplete: (orgId: string, ownerId: string) => void;
}

export function Wizard({ onComplete }: WizardProps) {
  // Cloud onboarding skips the Tim/PIN step (owner = signed-in account).
  const isCloud = isSupabaseConfigured;
  const steps = isCloud ? STEP_DEFS.filter((s) => s.n !== 4) : STEP_DEFS;
  // Kenapa akun ini sampai di layar setup, kalau bukan karena memang mendaftar
  // toko baru. Wajib terlihat: menyelesaikan wizard di sini membuat toko
  // TANDINGAN yang tak bisa lagi diundang ke toko pengundang.
  const setupNotice = useSessionStore((st) => st.setupNotice);
  const t = useT();

  const [idx, setIdx] = useState(0);
  const [data, setData] = useState<WizardData>(emptyWizardData());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const step = steps[idx].n; // current logical step number
  const isLast = idx === steps.length - 1;

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));

  const errorMap = (): Record<string, string> => {
    const list = validateStep(step, data);
    const map: Record<string, string> = Object.fromEntries(
      list.map((e) => [e.field, t(e.messageKey)]),
    );
    // Cloud captures the owner name on the Profil step (no Tim step).
    if (isCloud && step === 1 && !data.employees[0]?.name.trim()) {
      map.ownerName = t('onboarding.ownerNameRequired');
    }
    return map;
  };

  const next = () => {
    const map = errorMap();
    if (Object.keys(map).length) {
      setErrors(map);
      toast.error(t('onboarding.checkFields'));
      return;
    }
    setErrors({});
    setIdx((i) => Math.min(i + 1, steps.length - 1));
  };
  const prev = () => {
    setErrors({});
    setIdx((i) => Math.max(i - 1, 0));
  };

  const finish = async () => {
    const map = errorMap();
    if (Object.keys(map).length) {
      setErrors(map);
      return;
    }
    setBusy(true);
    try {
      const { org, owner } = await commitWizard(data);
      trackEvent('activation_completed', { workspace_mode: isCloud ? 'cloud' : 'local' });
      toast.success(t('onboarding.created'));
      onComplete(org.id, owner.id);
    } catch {
      toast.error(t('onboarding.createFailed'));
      setBusy(false);
    }
  };

  // DEV-ONLY, LOCAL-ONLY: populate a demo workspace and sign in as owner. The
  // seed module is dynamically imported so it never lands in production
  // bundles. Hidden in cloud mode — demo data must never touch a real org.
  const runDevSeed = async () => {
    setSeeding(true);
    try {
      const { seedDemoWorkspace } = await import('@/dev/seed');
      await seedDemoWorkspace();
    } catch {
      toast.error(t('onboarding.seedFailed'));
      setSeeding(false);
    }
  };

  const listError = (msg?: string) => <FormMessage>{msg}</FormMessage>;

  return (
    <div data-nu className="min-h-dvh px-4 py-10 compact:py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <img
              src="/logo-mark.png"
              alt=""
              width="44"
              height="44"
              className="size-11 rounded-xl shadow-panel ring-1 ring-border/60"
            />
            <span className="text-lg font-semibold tracking-[-0.015em]">Nuara Service</span>
          </div>
          <p className="text-sm text-muted-foreground">{t('onboarding.subtitle')}</p>
        </header>

        {import.meta.env.DEV && !isCloud && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border p-3">
            <Button variant="soft" size="sm" onClick={() => void runDevSeed()} disabled={seeding}>
              <Layers />
              {seeding ? t('onboarding.seeding') : t('onboarding.seed')}
            </Button>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {t('onboarding.devHint')}
            </span>
          </div>
        )}

        {isCloud && (
          <Alert variant="highlight" role="status">
            <Info aria-hidden />
            <AlertDescription className="text-foreground">
              {setupNotice ? (
                <>
                  <strong>{setupNotice}</strong> {t('onboarding.inviteStop')}
                </>
              ) : (
                <>
                  {t('onboarding.inviteQuestion')} <strong>{t('onboarding.inviteDontFill')}</strong>{' '}
                  {t('onboarding.inviteHowTo')}
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <ol
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          aria-label={t('onboarding.subtitle')}
        >
          {steps.map((s, i) => {
            const done = i < idx;
            const active = i === idx;
            return (
              <li
                key={s.n}
                aria-current={active ? 'step' : undefined}
                className="relative flex min-w-0 flex-col items-center gap-1.5 text-center"
              >
                {i > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2',
                      done || active ? 'bg-primary' : 'bg-border',
                    )}
                  />
                )}
                {/* z-[1]: garis milik langkah berikutnya muncul belakangan di DOM dan melintasi separuh lingkaran ini. */}
                <span
                  className={cn(
                    'relative z-[1] grid size-8 place-items-center rounded-full font-mono text-xs font-semibold ring-1 transition-colors',
                    done && 'bg-primary text-primary-foreground ring-primary',
                    active && 'bg-highlight text-highlight-foreground ring-highlight',
                    !done && !active && 'bg-card text-muted-foreground ring-border',
                  )}
                >
                  {done ? <Check aria-hidden className="size-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    'max-w-full truncate text-xs',
                    active ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {t(s.labelKey)}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="rounded-3xl bg-card p-6 text-card-foreground shadow-panel ring-1 ring-border/60 compact:p-5">
          {step === 1 && (
            <Step title={t('onboarding.profileTitle')} desc={t('onboarding.profileDesc')}>
              <Field label={t('onboarding.shopName')} error={errors.shopName}>
                <Input
                  placeholder={t('onboarding.shopNamePh')}
                  value={data.shopName}
                  onChange={(e) => {
                    const shopName = e.target.value;
                    update({
                      shopName,
                      servicePrefix: data.servicePrefix || derivePrefix(shopName),
                    });
                  }}
                />
              </Field>
              {isCloud && (
                <Field label={t('onboarding.ownerName')} error={errors.ownerName}>
                  <Input
                    placeholder={t('onboarding.ownerNamePh')}
                    value={data.employees[0]?.name ?? ''}
                    onChange={(e) => {
                      const employees = [...data.employees];
                      employees[0] = {
                        ...(employees[0] ?? { role: 'owner', pin: '' }),
                        name: e.target.value,
                        role: 'owner',
                      };
                      update({ employees });
                    }}
                  />
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
                <Field label={t('onboarding.address')}>
                  <Input
                    placeholder={t('onboarding.addressPh')}
                    value={data.address}
                    onChange={(e) => update({ address: e.target.value })}
                  />
                </Field>
                <Field label={t('onboarding.prefix')}>
                  <Input
                    placeholder="SGS"
                    maxLength={5}
                    className="font-mono uppercase"
                    value={data.servicePrefix}
                    onChange={(e) => update({ servicePrefix: e.target.value.toUpperCase() })}
                  />
                </Field>
              </div>
              <Field label={t('onboarding.phone')}>
                <Input
                  placeholder="0812-3456-7890"
                  inputMode="tel"
                  value={data.phone}
                  onChange={(e) => update({ phone: e.target.value })}
                />
              </Field>
            </Step>
          )}

          {step === 2 && (
            <Step title={t('onboarding.walletTitle')} desc={t('onboarding.walletDesc')}>
              {listError(errors.wallets)}
              <div className="grid gap-2">
                {data.wallets.map((w, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                    <Input
                      aria-label={t('onboarding.walletName')}
                      placeholder={t('onboarding.walletName')}
                      value={w.name}
                      onChange={(e) => {
                        const wallets = [...data.wallets];
                        wallets[i] = { ...w, name: e.target.value };
                        update({ wallets });
                      }}
                    />
                    <Input
                      aria-label={t('onboarding.walletBalance')}
                      placeholder={t('onboarding.walletBalance')}
                      inputMode="numeric"
                      className="text-right font-mono tabular-nums"
                      value={w.balance ? fmtRpInput(String(w.balance)) : ''}
                      onChange={(e) => {
                        const wallets = [...data.wallets];
                        wallets[i] = { ...w, balance: parseRpInput(e.target.value) };
                        update({ wallets });
                      }}
                    />
                    <RemoveButton
                      label={t('common.delete')}
                      onClick={() => update({ wallets: data.wallets.filter((_, j) => j !== i) })}
                    />
                  </div>
                ))}
              </div>
              <AddButton onClick={() => update({ wallets: [...data.wallets, { name: '', balance: 0 }] })}>
                {t('onboarding.addWallet')}
              </AddButton>
            </Step>
          )}

          {step === 3 && (
            <Step title={t('onboarding.categoryTitle')} desc={t('onboarding.categoryDesc')}>
              {listError(errors.categories)}
              <ul className="flex flex-wrap gap-2">
                {data.categories.map((c, i) => (
                  <li
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm font-medium text-secondary-foreground"
                  >
                    {c}
                    <button
                      type="button"
                      onClick={() => update({ categories: data.categories.filter((_, j) => j !== i) })}
                      aria-label={`${t('common.delete')} ${c}`}
                      className="grid size-7 place-items-center rounded-full text-muted-foreground outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11 [&_svg]:size-3.5"
                    >
                      <X />
                    </button>
                  </li>
                ))}
              </ul>
              <CategoryAdder onAdd={(name) => update({ categories: [...data.categories, name] })} />
            </Step>
          )}

          {step === 4 && (
            <Step title={t('onboarding.teamTitle')} desc={t('onboarding.teamDesc')}>
              {listError(errors.employees)}
              <div className="grid gap-3">
                {data.employees.map((emp, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,1fr)_9rem_6rem_auto] items-start gap-2 compact:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  >
                    <Field error={errors[`emp-name-${i}`]} className="compact:col-span-3">
                      <Input
                        aria-label={t('onboarding.fullName')}
                        placeholder={t('onboarding.fullName')}
                        value={emp.name}
                        onChange={(e) => {
                          const employees = [...data.employees];
                          employees[i] = { ...emp, name: e.target.value };
                          update({ employees });
                        }}
                      />
                    </Field>
                    <Select
                      value={emp.role}
                      onValueChange={(role) => {
                        const employees = [...data.employees];
                        employees[i] = { ...emp, role: role as Role };
                        update({ employees });
                      }}
                    >
                      <SelectTrigger aria-label={t('settingsPage.peran')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {t(r.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Field error={errors[`emp-pin-${i}`]}>
                      <Input
                        aria-label={t('onboarding.pin')}
                        placeholder={t('onboarding.pin')}
                        maxLength={4}
                        inputMode="numeric"
                        className="font-mono tracking-[0.3em]"
                        value={emp.pin}
                        onChange={(e) => {
                          const employees = [...data.employees];
                          employees[i] = { ...emp, pin: e.target.value.replace(/\D/g, '') };
                          update({ employees });
                        }}
                      />
                    </Field>
                    <RemoveButton
                      label={t('common.delete')}
                      onClick={() => update({ employees: data.employees.filter((_, j) => j !== i) })}
                    />
                  </div>
                ))}
              </div>
              <AddButton
                onClick={() =>
                  update({ employees: [...data.employees, { name: '', role: 'karyawan', pin: '' }] })
                }
              >
                {t('onboarding.addMember')}
              </AddButton>
            </Step>
          )}

          {step === 5 && (
            <Step title={t('onboarding.targetTitle')} desc={t('onboarding.targetDesc')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('onboarding.targetRevenue')}>
                  <Input
                    placeholder="15.000.000"
                    inputMode="numeric"
                    className="font-mono tabular-nums"
                    value={data.targetRevenue ? fmtRpInput(String(data.targetRevenue)) : ''}
                    onChange={(e) => update({ targetRevenue: parseRpInput(e.target.value) })}
                  />
                </Field>
                <Field label={t('onboarding.targetServices')}>
                  <Input
                    type="number"
                    placeholder="50"
                    className="font-mono tabular-nums"
                    value={data.targetServiceCount || ''}
                    onChange={(e) => update({ targetServiceCount: Number(e.target.value) })}
                  />
                </Field>
              </div>
              <StepHint>{t('onboarding.targetHint')}</StepHint>
            </Step>
          )}

          {step === 6 && (
            <Step title={t('onboarding.outletTitle')} desc={t('onboarding.outletDesc')}>
              {listError(errors.outlets)}
              <div className="grid gap-3">
                {data.outlets.map((o, i) => (
                  <div key={i} className="grid gap-3 rounded-2xl bg-surface p-3 ring-1 ring-border/60">
                    <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <Field
                        label={
                          i === 0
                            ? t('onboarding.primaryOutlet')
                            : interpolate(t('onboarding.branchN'), { n: String(i) })
                        }
                        error={errors[`outlet-name-${i}`]}
                      >
                        <Input
                          placeholder={
                            i === 0 ? data.shopName || t('onboarding.primaryOutletPh') : t('onboarding.branchNamePh')
                          }
                          value={o.name}
                          onChange={(e) => {
                            const outlets = [...data.outlets];
                            outlets[i] = { ...o, name: e.target.value };
                            update({ outlets });
                          }}
                        />
                      </Field>
                      <Field label={t('onboarding.address')}>
                        <Input
                          placeholder={
                            i === 0 ? data.address || t('onboarding.outletAddressPh') : t('onboarding.branchAddressPh')
                          }
                          value={o.address}
                          onChange={(e) => {
                            const outlets = [...data.outlets];
                            outlets[i] = { ...o, address: e.target.value };
                            update({ outlets });
                          }}
                        />
                      </Field>
                      {i > 0 && (
                        <RemoveButton
                          label={t('common.delete')}
                          className="sm:mt-6"
                          onClick={() => update({ outlets: data.outlets.filter((_, j) => j !== i) })}
                        />
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select
                        value={o.rentMode ?? 'bulanan'}
                        onValueChange={(rentMode) => {
                          const outlets = [...data.outlets];
                          outlets[i] = { ...o, rentMode: rentMode as 'bulanan' | 'tahunan' };
                          update({ outlets });
                        }}
                      >
                        <SelectTrigger
                          aria-label={interpolate(t('onboarding.rentModeLabel'), {
                            name:
                              o.name ||
                              (i === 0
                                ? t('onboarding.primaryOutletLower')
                                : interpolate(t('onboarding.branchNLower'), { n: String(i) })),
                          })}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bulanan">{t('onboarding.rentMonthly')}</SelectItem>
                          <SelectItem value="tahunan">{t('onboarding.rentYearly')}</SelectItem>
                        </SelectContent>
                      </Select>
                      {o.rentMode === 'tahunan' && (
                        <Input
                          aria-label={t('onboarding.rentYearlyLabel')}
                          placeholder={t('onboarding.rentYearlyPh')}
                          inputMode="numeric"
                          className="font-mono tabular-nums"
                          value={o.rentYearly ? fmtRpInput(String(o.rentYearly)) : ''}
                          onChange={(e) => {
                            const outlets = [...data.outlets];
                            outlets[i] = { ...o, rentYearly: parseRpInput(e.target.value) };
                            update({ outlets });
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <StepHint>{t('onboarding.outletHint')}</StepHint>
              <AddButton onClick={() => update({ outlets: [...data.outlets, { name: '', address: '' }] })}>
                {t('onboarding.addBranch')}
              </AddButton>
            </Step>
          )}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border/70 pt-5">
            {idx > 0 ? (
              <Button variant="secondary" onClick={prev}>
                <ArrowLeft />
                {t('common.back')}
              </Button>
            ) : (
              <span />
            )}
            {!isLast ? (
              <Button onClick={next}>
                {t('common.next')}
                <ArrowRight />
              </Button>
            ) : (
              <Button onClick={() => void finish()} disabled={busy} aria-busy={busy || undefined}>
                <Check />
                {t('onboarding.finish')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        {/* Satu-satunya heading di layar setup: judul langkah adalah judul halaman. */}
        <h1 className="text-xl font-semibold leading-tight tracking-[-0.015em]">{title}</h1>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </div>
  );
}

function StepHint({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button variant="secondary" size="sm" className="justify-self-start" onClick={onClick}>
      <Plus />
      {children}
    </Button>
  );
}

function RemoveButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <Button variant="ghost" size="icon" className={cn('text-muted-foreground hover:text-destructive', className)} onClick={onClick} aria-label={label}>
      <Trash2 />
    </Button>
  );
}

function CategoryAdder({ onAdd }: { onAdd: (name: string) => void }) {
  const t = useT();
  const [value, setValue] = useState('');
  const add = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
    }
  };
  return (
    <div className="flex gap-2">
      <Input
        aria-label={t('onboarding.categoryPh')}
        placeholder={t('onboarding.categoryPh')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
      />
      <Button variant="secondary" onClick={add}>
        <Plus />
        {t('common.add')}
      </Button>
    </div>
  );
}
