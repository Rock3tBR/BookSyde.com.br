-- BookSyde — contratos de editoras
create table if not exists public.publisher_contracts (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Contrato editorial BookSyde',
  status text not null default 'active' check (status in ('draft','active','expired','cancelled')),
  publisher_percentage numeric(5,2) not null check (publisher_percentage between 0 and 100),
  booksyde_percentage numeric(5,2) not null check (booksyde_percentage between 0 and 100),
  contract_date date not null,
  starts_at date not null,
  ends_at date,
  file_path text not null,
  file_name text not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_percentages_total check (round(publisher_percentage + booksyde_percentage,2)=100.00),
  constraint contract_dates_valid check (ends_at is null or ends_at >= starts_at)
);
create unique index if not exists publisher_one_active_contract on public.publisher_contracts(publisher_id) where status='active';
create index if not exists idx_publisher_contracts_publisher on public.publisher_contracts(publisher_id);
create index if not exists idx_publisher_contracts_status on public.publisher_contracts(status);
alter table public.publisher_contracts enable row level security;

do $$ begin
  create policy publisher_contract_select_own on public.publisher_contracts for select to authenticated using (publisher_id=auth.uid() or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy publisher_contract_admin_insert on public.publisher_contracts for insert to authenticated with check (public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy publisher_contract_admin_update on public.publisher_contracts for update to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy publisher_contract_admin_delete on public.publisher_contracts for delete to authenticated using (public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

grant select on public.publisher_contracts to authenticated;
grant insert,update,delete on public.publisher_contracts to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('contracts','contracts',false,20971520,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

do $$ begin
  create policy contracts_admin_upload on storage.objects for insert to authenticated with check (bucket_id='contracts' and public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy contracts_admin_update on storage.objects for update to authenticated using (bucket_id='contracts' and public.is_admin(auth.uid())) with check (bucket_id='contracts' and public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy contracts_admin_delete on storage.objects for delete to authenticated using (bucket_id='contracts' and public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy contracts_private_read on storage.objects for select to authenticated using (
    bucket_id='contracts' and (
      public.is_admin(auth.uid()) or exists(
        select 1 from public.publisher_contracts pc where pc.file_path=storage.objects.name and pc.publisher_id=auth.uid()
      )
    )
  );
exception when duplicate_object then null; end $$;
