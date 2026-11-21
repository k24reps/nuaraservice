import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthPage } from '@/features/auth/AuthPage';
import { PinLogin } from '@/features/auth/PinLogin';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { Wizard } from '@/features/onboarding/Wizard';
import { useSessionStore } from '@/stores/session';
import type { Employee, Organization } from '@/data/types';

/**
 * Pratinjau layar sebelum aplikasi di `/dev/layar?layar=...`, KHUSUS dev server
 * (App.tsx memasangnya di balik `import.meta.env.DEV`). Layar masuk dan PIN
 * hanya muncul di mode server, jadi tanpa ini tidak bisa difoto lokal.
 * Nilai `layar`: masuk, daftar, lupa, pin, reset, reset-form, wizard.
 */
const STAMP = '2026-11-21T00:00:00.000Z';
const staff = (id: string, name: string, role: Employee['role']) =>
  ({ id, name, role, pinHash: '', active: true, orgId: 'dev', outletId: null, createdAt: STAMP, updatedAt: STAMP }) as Employee;

export function AuthPreview() {
  const layar = new URLSearchParams(window.location.search).get('layar') ?? 'masuk';
  useState(() => {
    if (layar !== 'pin') return;
    useSessionStore.setState({
      org: { id: 'dev', name: 'Nuara Service', address: '', phone: '' } as Organization,
      employees: [staff('e1', 'Budi Santoso', 'owner'), staff('e2', 'Rina Wulandari', 'admin'), staff('e3', 'Agus Pratama', 'karyawan')],
    });
  });
  switch (layar) {
    case 'daftar':
      return <AuthPage initialMode="signup" />;
    case 'lupa':
      return <AuthPage initialMode="login" key="lupa" />;
    case 'pin':
      return <PinLogin />;
    case 'reset':
    case 'reset-form':
      return (
        <MemoryRouter>
          <ResetPasswordPage initialPhase={layar === 'reset' ? 'no-session' : 'ready'} />
        </MemoryRouter>
      );
    case 'wizard':
      return <Wizard onComplete={() => undefined} />;
    default:
      return <AuthPage initialMode="login" />;
  }
}
