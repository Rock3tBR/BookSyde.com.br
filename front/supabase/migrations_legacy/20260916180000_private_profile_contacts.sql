-- Telefone é dado pessoal: não adicionar à tabela public.profiles, consultada
-- pelo sistema social/marketplace. Acesso exclusivamente pelo próprio usuário.
create table if not exists public.profile_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text null check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  updated_at timestamptz not null default now()
);

alter table public.profile_contacts enable row level security;
revoke all on public.profile_contacts from anon;
grant select, insert, update, delete on public.profile_contacts to authenticated;

-- Idempotente: as políticas existem apenas para os registros do dono.
drop policy if exists "profile_contacts_read_own" on public.profile_contacts;
create policy "profile_contacts_read_own" on public.profile_contacts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "profile_contacts_insert_own" on public.profile_contacts;
create policy "profile_contacts_insert_own" on public.profile_contacts
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "profile_contacts_update_own" on public.profile_contacts;
create policy "profile_contacts_update_own" on public.profile_contacts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "profile_contacts_delete_own" on public.profile_contacts;
create policy "profile_contacts_delete_own" on public.profile_contacts
  for delete to authenticated using ((select auth.uid()) = user_id);

comment on table public.profile_contacts is 'Dados privados da conta: telefone opcional, ainda não verificado.';
comment on column public.profile_contacts.phone_e164 is 'Telefone opcional normalizado para E.164; não é telefone do Supabase Auth.';
