-- Busca restrita de leitores: não flexibilizar as políticas RLS de public.profiles.
-- Execute esta migração no projeto Supabase ligado ao Mangaka antes de testar os amigos.
-- Retorna exclusivamente os campos de perfil destinados a descoberta/contatos.

create or replace function public.search_readers(
  _query text,
  _max_results integer default 12
)
returns table(id uuid, display_name text, avatar_url text, user_code text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_query text := left(trim(regexp_replace(coalesce(_query, ''), '^\s*#\s*', '')), 64);
begin
  if v_user is null then
    raise exception 'É necessário entrar na conta para buscar leitores' using errcode = '42501';
  end if;

  if char_length(v_query) < 2 then
    return;
  end if;

  return query
    select p.id, p.display_name::text, p.avatar_url::text, p.user_code::text
      from public.profiles as p
     where p.id <> v_user
       and (
         position(lower(v_query) in lower(coalesce(p.display_name, ''))) > 0
         or (p.user_code is not null and lower(p.user_code) = lower(v_query))
       )
     order by
       case when lower(coalesce(p.user_code, '')) = lower(v_query) then 0
            when lower(coalesce(p.display_name, '')) = lower(v_query) then 1
            else 2 end,
       p.display_name, p.id
     limit greatest(1, least(coalesce(_max_results, 12), 12));
end;
$$;

revoke all on function public.search_readers(text, integer) from public, anon;
grant execute on function public.search_readers(text, integer) to authenticated;

-- Somente os perfis vinculados à conta podem ser usados em conversas/pedidos.
-- Não expõe configurações privadas de leitura, e-mail ou outros dados do usuário.
create or replace function public.get_reader_profiles(_ids uuid[])
returns table(id uuid, display_name text, avatar_url text, user_code text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'É necessário entrar na conta para consultar contatos' using errcode = '42501';
  end if;

  return query
    select p.id, p.display_name::text, p.avatar_url::text, p.user_code::text
      from public.profiles p
     where p.id = any(coalesce(_ids, array[]::uuid[]))
       and p.id <> v_user
       and (
         exists (
           select 1 from public.friendships f
            where f.status in ('pending', 'accepted')
              and ((f.requester_id = v_user and f.addressee_id = p.id)
                or (f.addressee_id = v_user and f.requester_id = p.id))
         )
         or exists (
           select 1 from public.marketplace_orders mo
            where (mo.buyer_id = v_user and mo.seller_id = p.id)
               or (mo.seller_id = v_user and mo.buyer_id = p.id)
         )
       )
     order by p.display_name
     limit 200;
end;
$$;

revoke all on function public.get_reader_profiles(uuid[]) from public, anon;
grant execute on function public.get_reader_profiles(uuid[]) to authenticated;
