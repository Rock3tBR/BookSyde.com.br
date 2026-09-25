-- Compartilhamento seguro de biblioteca.
-- Regra: somente conteúdo criado pelo próprio usuário pode ser compartilhado.
-- Itens comprados, importados ou apenas adicionados à biblioteca não podem ser redistribuídos.

create or replace function public.generate_library_share(_folder_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_folder public.library_folders%rowtype;
  v_manga_ids uuid[];
  v_code text;
  v_expires_at timestamptz := now() + interval '12 hours';
begin
  if v_user is null then
    raise exception 'Entre na sua conta para compartilhar.' using errcode = '42501';
  end if;

  select * into v_folder
  from public.library_folders
  where id = _folder_id
    and owner_id = v_user
    and creator_id = v_user;

  if not found then
    raise exception 'Somente o criador da pasta pode compartilhá-la.' using errcode = '42501';
  end if;

  select coalesce(array_agg(li.manga_id order by li.position), array[]::uuid[])
    into v_manga_ids
  from public.library_items li
  where li.folder_id = _folder_id
    and li.owner_id = v_user;

  if exists (
    select 1
    from unnest(v_manga_ids) as x(manga_id)
    left join public.mangas m on m.id = x.manga_id
    where m.id is null or m.creator_id is distinct from v_user
  ) then
    raise exception 'Esta pasta contém item comprado ou importado. Somente criações próprias podem ser compartilhadas.'
      using errcode = '42501';
  end if;

  update public.library_share_codes
     set expires_at = now()
   where folder_id = _folder_id
     and creator_id = v_user
     and used_at is null
     and expires_at > now();

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.library_share_codes (
    code, creator_id, folder_id, folder_name, manga_ids, expires_at
  ) values (
    v_code, v_user, _folder_id, v_folder.name, v_manga_ids, v_expires_at
  );

  return jsonb_build_object(
    'code', v_code,
    'expires_at', v_expires_at,
    'folder_id', _folder_id
  );
end;
$$;

revoke all on function public.generate_library_share(uuid) from public, anon;
grant execute on function public.generate_library_share(uuid) to authenticated;


create or replace function public.share_code_with_friend(
  _receiver_id uuid,
  _share_type text,
  _title text,
  _path text default null,
  _folder_id uuid default null,
  _manga_id uuid default null,
  _volume_id uuid default null,
  _page_id uuid default null,
  _message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_manga_id uuid;
  v_manga_ids uuid[] := array[]::uuid[];
  v_folder public.library_folders%rowtype;
  v_folder_name text;
  v_folder_color text;
  v_code text;
  v_expires_at timestamptz := now() + interval '12 hours';
  v_message text := left(trim(coalesce(_message, '')), 1500);
begin
  if v_user is null then
    raise exception 'Entre na sua conta para compartilhar.' using errcode = '42501';
  end if;

  if _receiver_id is null or _receiver_id = v_user then
    raise exception 'Escolha outro usuário para compartilhar.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles p where p.id = _receiver_id) then
    raise exception 'Usuário não encontrado.' using errcode = '22023';
  end if;

  -- Compartilhamento direto é permitido apenas entre amizades aceitas.
  if not exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = v_user and f.addressee_id = _receiver_id)
        or
        (f.requester_id = _receiver_id and f.addressee_id = v_user)
      )
  ) then
    raise exception 'Adicione este usuário como amigo antes de compartilhar.' using errcode = '42501';
  end if;

  case _share_type
    when 'folder' then
      if _folder_id is null then
        raise exception 'Pasta inválida.' using errcode = '22023';
      end if;

      select * into v_folder
      from public.library_folders
      where id = _folder_id
        and owner_id = v_user
        and creator_id = v_user;

      if not found then
        raise exception 'Somente o criador da pasta pode compartilhá-la.' using errcode = '42501';
      end if;

      select coalesce(array_agg(li.manga_id order by li.position), array[]::uuid[])
        into v_manga_ids
      from public.library_items li
      where li.folder_id = _folder_id
        and li.owner_id = v_user;

      if exists (
        select 1
        from unnest(v_manga_ids) as x(manga_id)
        left join public.mangas m on m.id = x.manga_id
        where m.id is null or m.creator_id is distinct from v_user
      ) then
        raise exception 'Esta pasta contém item comprado ou importado. Somente criações próprias podem ser compartilhadas.'
          using errcode = '42501';
      end if;

      v_folder_name := v_folder.name;
      v_folder_color := v_folder.color;

    when 'manga' then
      if _manga_id is null then
        raise exception 'Obra inválida.' using errcode = '22023';
      end if;
      select m.id into v_manga_id
      from public.mangas m
      where m.id = _manga_id and m.creator_id = v_user;
      if not found then
        raise exception 'Itens comprados não podem ser compartilhados. Somente o criador da obra pode compartilhá-la.'
          using errcode = '42501';
      end if;
      v_manga_ids := array[v_manga_id];

    when 'volume' then
      if _volume_id is null then
        raise exception 'Volume inválido.' using errcode = '22023';
      end if;
      select m.id into v_manga_id
      from public.volumes v
      join public.mangas m on m.id = v.manga_id
      where v.id = _volume_id and m.creator_id = v_user;
      if not found then
        raise exception 'Itens comprados não podem ser compartilhados. Somente o criador da obra pode compartilhar este volume.'
          using errcode = '42501';
      end if;
      v_manga_ids := array[v_manga_id];

    when 'page' then
      if _page_id is null then
        raise exception 'Página inválida.' using errcode = '22023';
      end if;
      select m.id into v_manga_id
      from public.pages p
      join public.volumes v on v.id = p.volume_id
      join public.mangas m on m.id = v.manga_id
      where p.id = _page_id and m.creator_id = v_user;
      if not found then
        raise exception 'Itens comprados não podem ser compartilhados. Somente o criador da obra pode compartilhar esta página.'
          using errcode = '42501';
      end if;
      v_manga_ids := array[v_manga_id];

    else
      raise exception 'Tipo de compartilhamento inválido.' using errcode = '22023';
  end case;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.friend_share_codes (
    code,
    sender_id,
    recipient_id,
    share_type,
    title,
    share_path,
    folder_id,
    folder_name,
    folder_color,
    manga_id,
    manga_ids,
    volume_id,
    page_id,
    expires_at
  ) values (
    v_code,
    v_user,
    _receiver_id,
    _share_type,
    left(coalesce(_title, 'Compartilhamento'), 200),
    nullif(left(coalesce(_path, ''), 1000), ''),
    _folder_id,
    v_folder_name,
    v_folder_color,
    case when _share_type = 'manga' then v_manga_id else _manga_id end,
    v_manga_ids,
    _volume_id,
    _page_id,
    v_expires_at
  );

  insert into public.direct_messages (
    sender_id,
    receiver_id,
    body,
    share_type,
    share_title,
    share_path,
    share_code,
    manga_id,
    volume_id,
    page_id,
    message_kind
  ) values (
    v_user,
    _receiver_id,
    v_message,
    _share_type,
    left(coalesce(_title, 'Compartilhamento'), 200),
    nullif(left(coalesce(_path, ''), 1000), ''),
    v_code,
    _manga_id,
    _volume_id,
    _page_id,
    'share'
  );

  return jsonb_build_object(
    'code', v_code,
    'expires_at', v_expires_at,
    'receiver_id', _receiver_id,
    'share_type', _share_type
  );
end;
$$;

revoke all on function public.share_code_with_friend(uuid, text, text, text, uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.share_code_with_friend(uuid, text, text, text, uuid, uuid, uuid, uuid, text) to authenticated;
