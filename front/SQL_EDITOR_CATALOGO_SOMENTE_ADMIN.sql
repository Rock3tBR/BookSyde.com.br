-- BookSyde: somente contas Admin podem publicar no Catálogo oficial.
-- Marketplace continua disponível para criadores, vendedores e editoras.
create or replace function public.enforce_admin_catalog_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.distribution_channel::text = 'catalog' and new.visibility::text = 'public' then
    if auth.uid() is null or not exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role::text = 'admin'
    ) then
      raise exception 'Somente administradores podem publicar no Catálogo oficial.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mangas_catalog_admin_only on public.mangas;
create trigger trg_mangas_catalog_admin_only
before insert or update of distribution_channel, visibility on public.mangas
for each row execute function public.enforce_admin_catalog_publication();
