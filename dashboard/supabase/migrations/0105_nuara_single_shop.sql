-- 0105 — Nuara Dashboard: satu toko, tanpa penagihan SaaS.
--
-- Nuara Dashboard adalah salinan FixMaster (0001-0104 dibawa apa adanya) yang
-- dipakai SATU workshop. Skema multi-organisasi (org_id + RLS) sengaja
-- dipertahankan: membongkarnya berarti menyentuh seluruh kebijakan RLS. Yang
-- dimatikan di sini hanya bagian yang khas produk SaaS:
--
--   A. Saldo unit (0101/0103): tiket baru tidak lagi memotong unit, jadi
--      penerimaan unit tidak pernah ditolak karena saldo. Kolom dan tabel
--      unit_ledger dibiarkan supaya migrasi lama tetap konsisten.
--   B. Pembuatan organisasi dibatasi satu. Tanpa ini, akun mana pun yang
--      berhasil login tanpa membership bisa membuat toko kedua di database
--      yang sama lewat wizard.
--   C. Lead demo landing page (0102/0104): RPC anonim ditutup dan cron
--      notifikasinya dihentikan. Landing page FixMaster tidak ikut disalin.

-- ---------- A. saldo unit dilepas ----------
drop trigger if exists trg_services_charge_unit on services;
drop trigger if exists trg_services_refund_on_cancel on services;
drop trigger if exists trg_organizations_grant_free_units on organizations;

-- ---------- B. satu toko per database ----------
create or replace function create_organization(
  p_name text,
  p_owner_name text,
  p_address text default '',
  p_phone text default '',
  p_service_prefix text default 'NS'
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Kunci tabel supaya dua wizard yang selesai bersamaan tidak sama-sama
  -- lolos pemeriksaan di bawah.
  lock table organizations in share row exclusive mode;

  if exists (select 1 from organizations) then
    raise exception 'Toko sudah dibuat. Minta Pemilik menambahkan akun ini di Pengaturan > Tim.'
      using errcode = 'P0001', hint = 'single_shop';
  end if;

  insert into organizations (name, address, phone, service_prefix, plan_type, trial_started_at, plan_expired_at)
  values (p_name, p_address, p_phone, p_service_prefix, 'standard', now(), null)
  returning id into new_org_id;

  insert into memberships (org_id, user_id, name, role, active)
  values (new_org_id, auth.uid(), p_owner_name, 'owner', true);

  return new_org_id;
end;
$$;

revoke execute on function create_organization(text, text, text, text, text) from public, anon;
grant execute on function create_organization(text, text, text, text, text) to authenticated;

-- ---------- C. lead demo ----------
revoke execute on function submit_demo_lead(text, text, text, text, text) from anon, authenticated;

select cron.unschedule('fixmaster-demo-lead-notify')
  where exists (select 1 from cron.job where jobname = 'fixmaster-demo-lead-notify');
select cron.unschedule('fixmaster-purge-demo-leads')
  where exists (select 1 from cron.job where jobname = 'fixmaster-purge-demo-leads');
