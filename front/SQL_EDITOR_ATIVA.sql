-- Booksyde · sistema de Ativa por leitura
-- Pode ser executado no SQL Editor do Supabase.

create table if not exists public.reading_time_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  volume_id uuid not null references public.volumes(id) on delete cascade,
  reading_date date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  seconds_read integer not null default 0 check (seconds_read >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, volume_id, reading_date)
);

create index if not exists reading_time_daily_user_date_idx
  on public.reading_time_daily (user_id, reading_date desc);

alter table public.reading_time_daily enable row level security;

drop policy if exists "Users read own reading time" on public.reading_time_daily;
create policy "Users read own reading time"
on public.reading_time_daily for select
to authenticated
using (auth.uid() = user_id);

-- O app já usa esta RPC no leitor. Cada período realmente lido soma segundos no dia atual.
create or replace function public.add_reading_time(p_seconds integer, p_volume_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_seconds is null or p_seconds <= 0 then return; end if;

  insert into public.reading_time_daily(user_id, volume_id, reading_date, seconds_read)
  values (v_user, p_volume_id, v_day, p_seconds)
  on conflict (user_id, volume_id, reading_date)
  do update set
    seconds_read = public.reading_time_daily.seconds_read + excluded.seconds_read,
    updated_at = now();
end;
$$;

revoke all on function public.add_reading_time(integer, uuid) from public;
grant execute on function public.add_reading_time(integer, uuid) to authenticated;
