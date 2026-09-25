-- BookSyde: Minha estante física
create extension if not exists pgcrypto;

create table if not exists public.physical_shelf_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  image_path text not null,
  position text not null default 'standing' check (position in ('standing', 'lying')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists physical_shelf_books_user_created_idx on public.physical_shelf_books(user_id, created_at);
alter table public.physical_shelf_books enable row level security;

drop policy if exists "physical shelf select own" on public.physical_shelf_books;
create policy "physical shelf select own" on public.physical_shelf_books for select to authenticated using (auth.uid() = user_id);
drop policy if exists "physical shelf insert own" on public.physical_shelf_books;
create policy "physical shelf insert own" on public.physical_shelf_books for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "physical shelf update own" on public.physical_shelf_books;
create policy "physical shelf update own" on public.physical_shelf_books for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "physical shelf delete own" on public.physical_shelf_books;
create policy "physical shelf delete own" on public.physical_shelf_books for delete to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('physical-shelf', 'physical-shelf', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "physical shelf storage select own" on storage.objects;
create policy "physical shelf storage select own" on storage.objects for select to authenticated using (bucket_id = 'physical-shelf' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "physical shelf storage insert own" on storage.objects;
create policy "physical shelf storage insert own" on storage.objects for insert to authenticated with check (bucket_id = 'physical-shelf' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "physical shelf storage delete own" on storage.objects;
create policy "physical shelf storage delete own" on storage.objects for delete to authenticated using (bucket_id = 'physical-shelf' and (storage.foldername(name))[1] = auth.uid()::text);

-- Scanner proporcional (seguro para executar também em instalações existentes)
alter table public.physical_shelf_books add column if not exists aspect_ratio numeric;
alter table public.physical_shelf_books add column if not exists crop_x numeric;
alter table public.physical_shelf_books add column if not exists crop_y numeric;
alter table public.physical_shelf_books add column if not exists crop_w numeric;
alter table public.physical_shelf_books add column if not exists crop_h numeric;
