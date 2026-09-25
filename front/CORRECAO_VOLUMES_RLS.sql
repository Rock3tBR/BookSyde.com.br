-- MangakaLib: permite publicar volumes somente na própria obra ou como admin real.
-- Executar no SQL Editor do MESMO projeto Supabase usado pelo aplicativo.
-- Não desativa RLS nem concede permissão para usuários comuns editarem obras alheias.

begin;

-- SECURITY DEFINER é necessário para consultar o proprietário da obra durante
-- políticas de volumes/pages/storage sem depender da visibilidade pública da obra.
create or replace function public.can_manage_publication(_manga_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.mangas m
      where m.id = _manga_id
        and (
          m.creator_id = auth.uid()
          or exists (
            select 1 from public.user_roles ur
            where ur.user_id = auth.uid()
              and ur.role::text = 'admin'
          )
        )
    );
$$;

revoke all on function public.can_manage_publication(uuid) from public, anon;
grant execute on function public.can_manage_publication(uuid) to authenticated;

alter table public.volumes enable row level security;
alter table public.pages enable row level security;

-- Nomes exclusivos: não removemos regras anteriores de leitura pública/compra.
drop policy if exists "volume_upload_owner_select" on public.volumes;
create policy "volume_upload_owner_select" on public.volumes
  for select to authenticated
  using (public.can_manage_publication(manga_id));

drop policy if exists "volume_upload_owner_insert" on public.volumes;
create policy "volume_upload_owner_insert" on public.volumes
  for insert to authenticated
  with check (public.can_manage_publication(manga_id));

drop policy if exists "volume_upload_owner_update" on public.volumes;
create policy "volume_upload_owner_update" on public.volumes
  for update to authenticated
  using (public.can_manage_publication(manga_id))
  with check (public.can_manage_publication(manga_id));

drop policy if exists "volume_upload_owner_delete" on public.volumes;
create policy "volume_upload_owner_delete" on public.volumes
  for delete to authenticated
  using (public.can_manage_publication(manga_id));

-- A página só pode ser gerenciada se seu volume pertencer a uma obra gerenciável.
create or replace function public.can_manage_publication_volume(_volume_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.volumes v
    where v.id = _volume_id
      and public.can_manage_publication(v.manga_id)
  );
$$;

revoke all on function public.can_manage_publication_volume(uuid) from public, anon;
grant execute on function public.can_manage_publication_volume(uuid) to authenticated;

drop policy if exists "volume_upload_pages_select" on public.pages;
create policy "volume_upload_pages_select" on public.pages
  for select to authenticated
  using (public.can_manage_publication_volume(volume_id));

drop policy if exists "volume_upload_pages_insert" on public.pages;
create policy "volume_upload_pages_insert" on public.pages
  for insert to authenticated
  with check (public.can_manage_publication_volume(volume_id));

drop policy if exists "volume_upload_pages_update" on public.pages;
create policy "volume_upload_pages_update" on public.pages
  for update to authenticated
  using (public.can_manage_publication_volume(volume_id))
  with check (public.can_manage_publication_volume(volume_id));

drop policy if exists "volume_upload_pages_delete" on public.pages;
create policy "volume_upload_pages_delete" on public.pages
  for delete to authenticated
  using (public.can_manage_publication_volume(volume_id));

-- Storage: não confundir auth.uid() com o primeiro diretório do upload.
-- As capas novas usam <manga_id>/...; algumas capas antigas usam <user_id>/...
-- Páginas/fontes sempre usam <manga_id>/<volume_id>/arquivo.
create or replace function public.can_manage_publication_object(
  _bucket_id text,
  _name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_first text := split_part(coalesce(_name, ''), '/', 1);
  v_second text := split_part(coalesce(_name, ''), '/', 2);
  v_manga_id uuid;
  v_volume_id uuid;
begin
  if auth.uid() is null
     or _bucket_id not in ('manga-covers', 'manga-pages', 'volume-sources')
     or v_first !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_second = '' then
    return false;
  end if;

  if _bucket_id = 'manga-covers' and v_first = auth.uid()::text then
    return true;
  end if;

  v_manga_id := v_first::uuid;
  if not public.can_manage_publication(v_manga_id) then
    return false;
  end if;

  if _bucket_id = 'manga-covers' then
    return true;
  end if;

  if v_second !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or split_part(_name, '/', 3) = '' then
    return false;
  end if;

  v_volume_id := v_second::uuid;
  return exists (
    select 1 from public.volumes v
    where v.id = v_volume_id and v.manga_id = v_manga_id
  );
end;
$$;

revoke all on function public.can_manage_publication_object(text, text) from public, anon;
grant execute on function public.can_manage_publication_object(text, text) to authenticated;

-- Não muda políticas de download/leitura de compradores. Acrescenta acesso de
-- manutenção apenas aos arquivos da obra própria ou a administradores reais.
drop policy if exists "volume_upload_storage_select" on storage.objects;
create policy "volume_upload_storage_select" on storage.objects
  for select to authenticated
  using (public.can_manage_publication_object(bucket_id, name));

drop policy if exists "volume_upload_storage_insert" on storage.objects;
create policy "volume_upload_storage_insert" on storage.objects
  for insert to authenticated
  with check (public.can_manage_publication_object(bucket_id, name));

drop policy if exists "volume_upload_storage_update" on storage.objects;
create policy "volume_upload_storage_update" on storage.objects
  for update to authenticated
  using (public.can_manage_publication_object(bucket_id, name))
  with check (public.can_manage_publication_object(bucket_id, name));

drop policy if exists "volume_upload_storage_delete" on storage.objects;
create policy "volume_upload_storage_delete" on storage.objects
  for delete to authenticated
  using (public.can_manage_publication_object(bucket_id, name));

commit;
