-- Permite volume/capítulo de número 0, sem permitir números negativos.
-- Não mexe em RLS, permissões, unicidade ou dados existentes.
-- Esta migração é idempotente e identifica constraints CHECK simples antes de removê-las.
begin;

do $migration$
declare
  current_check record;
  normalized text;
begin
  if to_regclass('public.volumes') is null then
    raise exception 'A tabela public.volumes não existe neste banco.';
  end if;

  for current_check in
    select c.conname, pg_get_constraintdef(c.oid) as definition
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.volumes'::regclass
      and c.contype = 'c'
      and a.attname = 'number'
  loop
    normalized := regexp_replace(
      lower(current_check.definition),
      '[[:space:]()"]', '', 'g'
    );
    normalized := regexp_replace(normalized, 'notvalid$', '');

    -- Só remove regras simples que proíbem zero; nunca descarta uma
    -- constraint composta ou desconhecida que possa proteger outros dados.
    if normalized in (
      'checknumber>0', 'checknumber>=1',
      'checknumber>0::integer', 'checknumber>=1::integer',
      'checknumber>0::bigint', 'checknumber>=1::bigint',
      'checknumber>0::smallint', 'checknumber>=1::smallint'
    ) then
      execute format('alter table public.volumes drop constraint %I', current_check.conname);
    elsif normalized in (
      'checknumber>=0', 'checknumber>=0::integer',
      'checknumber>=0::bigint', 'checknumber>=0::smallint'
    ) then
      null; -- Esta constraint já permite zero.
    else
      raise exception 'Constraint desconhecida %: %. Confira a regra manualmente antes de mudar a numeração.',
        current_check.conname, current_check.definition;
    end if;
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.volumes'::regclass
      and conname = 'volumes_number_nonnegative'
  ) then
    alter table public.volumes
      add constraint volumes_number_nonnegative check (number >= 0);
  end if;
end;
$migration$;

commit;
