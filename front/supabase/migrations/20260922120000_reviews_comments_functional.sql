-- Avaliações e comentários funcionais do BookSyde
-- Uma avaliação por usuário/obra e leitura pública dos comentários.
DO $$ BEGIN
  ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_manga_unique UNIQUE (user_id, manga_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Permite o relacionamento profiles(...) usado pelo PostgREST sem remover a FK de auth.users.
DO $$ BEGIN
  ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_profile_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.comments ADD CONSTRAINT comments_user_profile_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS comments_own_read ON public.comments;
DROP POLICY IF EXISTS comments_public_read ON public.comments;
CREATE POLICY comments_public_read ON public.comments FOR SELECT TO anon, authenticated USING (true);

-- As policies de escrita existentes continuam restringindo UPDATE/DELETE ao próprio usuário.
CREATE INDEX IF NOT EXISTS idx_reviews_manga_rating ON public.reviews(manga_id, rating);
