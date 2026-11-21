import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Field } from '@/components/dens/field';
import { Input } from '@/components/dens/input';
import { PasswordInput } from '@/components/dens/password-input';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { AuthPage } from './AuthPage';

/**
 * Layar masuk dan daftar (L-58). Field harus menyambungkan label, petunjuk,
 * dan galat ke isiannya; tanpa itu pembaca layar membaca kolom tanpa nama
 * dan tidak tahu kolom mana yang salah.
 */
beforeEach(() => {
  useSettingsStore.setState({ language: 'id' });
});

describe('Field', () => {
  it('memberi nama dan petunjuk ke isian', () => {
    render(
      <Field label="Email" hint="Pakai email kerja">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    const hint = document.getElementById(input.getAttribute('aria-describedby') ?? '');
    expect(hint?.textContent).toBe('Pakai email kerja');
  });

  it('galat menggantikan petunjuk dan menandai isian tidak valid', () => {
    render(
      <Field label="Email" hint="Pakai email kerja" error="Email tidak valid">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual(['Email tidak valid']);
    expect(screen.queryByText('Pakai email kerja')).toBeNull();
  });
});

describe('PasswordInput', () => {
  it('tombolnya membuka dan menutup password, labelnya ikut berganti', () => {
    render(
      <Field label="Password">
        <PasswordInput showLabel="Tampilkan password" hideLabel="Sembunyikan password" />
      </Field>,
    );
    const input = screen.getByLabelText('Password');
    expect(input.getAttribute('type')).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan password' }));
    expect(input.getAttribute('type')).toBe('text');
    const hide = screen.getByRole('button', { name: 'Sembunyikan password' });
    expect(hide.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(hide);
    expect(input.getAttribute('type')).toBe('password');
  });
});

describe('AuthPage daftar', () => {
  it('konfirmasi yang beda ditandai di kolomnya dan form tidak dikirim', () => {
    const signUp = vi.fn().mockResolvedValue({});
    useAuthStore.setState({ signUp });
    render(<AuthPage initialMode="signup" />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'staf@nuara.id' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abc12345' } });
    const confirm = screen.getByLabelText('Konfirmasi password');
    fireEvent.change(confirm, { target: { value: 'abc1234' } });

    expect(confirm.getAttribute('aria-invalid')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Buat akun' }));
    expect(screen.getByRole('alert').textContent).toBe('Konfirmasi password tidak cocok');
    expect(signUp).not.toHaveBeenCalled();
  });
});
