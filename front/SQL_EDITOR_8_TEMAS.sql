-- BookSyde: oito temas do Claro ao Noite absoluta.
-- Execute uma vez no SQL Editor (Supabase/Lovable) ANTES de salvar novos temas.
-- Não altera os demais campos dos perfis nem modifica políticas RLS.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'A tabela public.profiles não existe neste banco. Verifique o projeto Supabase.';
  END IF;
END $$;

-- Solta a restrição antiga antes de converter as escolhas descontinuadas.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_theme_check;

-- Compatibilidade com preferências antigas: toda conta permanece em um tema válido.
UPDATE public.profiles
SET theme = CASE theme
  WHEN 'ocean' THEN 'dark'
  WHEN 'sakura' THEN 'vanilla'
  WHEN 'forest' THEN 'dark'
  WHEN 'violet' THEN 'coffee'
  WHEN 'sunset' THEN 'latte'
  ELSE 'dark'
END
WHERE theme IS NULL
   OR theme NOT IN ('light', 'vanilla', 'latte', 'cappuccino',
                    'mocha', 'coffee', 'dark', 'midnight');

-- Preserva o default antigo 'dark' (agora visual Petróleo).
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_check
  CHECK (theme IN ('light', 'vanilla', 'latte', 'cappuccino',
                  'mocha', 'coffee', 'dark', 'midnight')) NOT VALID;

ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_theme_check;
COMMIT;
