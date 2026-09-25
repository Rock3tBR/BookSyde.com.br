-- Executar exclusivamente em PostgreSQL descartável com a fixture de plataforma
-- e todas as migrações. A transação final é revertida; nenhum teste usa produção.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check_true(ok boolean,label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RETURN 'PASS: '||label; END $$;
CREATE FUNCTION pg_temp.expect_error(command text,expected_code text,label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE command;
 EXCEPTION WHEN OTHERS THEN
   IF SQLSTATE=expected_code THEN RETURN 'PASS: '||label; END IF;
   RAISE;
 END;
 RAISE EXCEPTION 'FAIL: comando deveria falhar: %',label;
END $$;
SET LOCAL ROLE supabase_auth_admin;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('20000000-0000-4000-8000-000000000001','audit-a@example.invalid','{"display_name":"Autora Auditoria"}'),
 ('20000000-0000-4000-8000-000000000002','audit-b@example.invalid','{"display_name":"Leitor Auditoria"}'),
 ('20000000-0000-4000-8000-000000000003','audit-c@example.invalid','{"display_name":"Pessoa 100%_!"}');
RESET ROLE;
INSERT INTO public.user_roles(user_id,role) VALUES ('20000000-0000-4000-8000-000000000001','creator');
SELECT pg_temp.check_true((SELECT count(*)=3 FROM public.profiles WHERE id::text LIKE '20000000-%'),'cadastro cria perfis');
SELECT pg_temp.check_true((SELECT count(*)=3 FROM public.user_roles WHERE user_id::text LIKE '20000000-%' AND role='user'),'cadastro não concede admin');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.search_readers('Leitor Auditoria',12)),'busca por nome');
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.search_readers('100%_!',12)),'busca trata caracteres LIKE literalmente');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.search_readers('Autora Auditoria',12)),'busca exclui o próprio usuário');
SELECT pg_temp.expect_error($q$SELECT public.send_direct_message('20000000-0000-4000-8000-000000000002','antes da amizade')$q$,'P0001','mensagem para desconhecido bloqueada');
SELECT public.send_friend_request('20000000-0000-4000-8000-000000000002') AS friendship \gset
SELECT pg_temp.check_true(public.send_friend_request('20000000-0000-4000-8000-000000000002')=:'friendship'::uuid,'pedido de amizade idempotente');
SELECT pg_temp.expect_error(format('SELECT public.respond_friend_request(%L,true)',:'friendship'),'P0001','remetente não aceita próprio pedido');
SET LOCAL request.jwt.claim.sub='20000000-0000-4000-8000-000000000002';
SELECT public.respond_friend_request(:'friendship',true);
SELECT pg_temp.check_true((SELECT status='accepted' FROM public.friendships WHERE id=:'friendship'),'destinatário aceita amizade');
SELECT public.send_direct_message('20000000-0000-4000-8000-000000000001','Olá, amizade!') AS message_id \gset
SET LOCAL request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
SELECT pg_temp.check_true((SELECT body='Olá, amizade!' FROM public.direct_messages WHERE id=:'message_id'),'destinatário lê mensagem');
SELECT public.mark_direct_messages_read('20000000-0000-4000-8000-000000000002');
SELECT pg_temp.check_true((SELECT read_at IS NOT NULL FROM public.direct_messages WHERE id=:'message_id'),'marcação de mensagem lida');
INSERT INTO public.mangas(id,creator_id,title,slug,work_type,visibility,distribution_channel)
VALUES('20000000-0000-4000-8000-000000000010',auth.uid(),'Livro auditoria','audit-book-unique','book','private','unlisted');
UPDATE public.mangas SET title='Livro editado' WHERE id='20000000-0000-4000-8000-000000000010';
SELECT pg_temp.check_true((SELECT title='Livro editado' FROM public.mangas WHERE id='20000000-0000-4000-8000-000000000010'),'edição simples pelo proprietário');
SELECT pg_temp.check_true(NOT has_column_privilege('authenticated','public.mangas','invite_token','SELECT'),'bloqueio conhecido: app solicita invite_token sem grant');
SELECT pg_temp.expect_error($q$UPDATE public.mangas SET title='Retorno bloqueado' WHERE id='20000000-0000-4000-8000-000000000010' RETURNING id,invite_token$q$,'42501','reproduz bloqueio da edição usada pelo app');
SELECT pg_temp.expect_error($q$UPDATE public.mangas SET visibility='public',distribution_channel='catalog' WHERE id='20000000-0000-4000-8000-000000000010'$q$,'P0001','catálogo recusa usuário sem admin');
INSERT INTO public.physical_shelf_books(id,user_id,title,image_path,aspect_ratio,crop_x,crop_y,crop_w,crop_h)
VALUES('20000000-0000-4000-8000-000000000020',auth.uid(),'Estante teste',auth.uid()::text||'/teste.jpg',0.2,0.1,0.1,0.2,0.8);
UPDATE public.physical_shelf_books SET title='Estante editada' WHERE id='20000000-0000-4000-8000-000000000020';
SELECT pg_temp.check_true((SELECT title='Estante editada' FROM public.physical_shelf_books WHERE id='20000000-0000-4000-8000-000000000020'),'estante física cria e edita');
INSERT INTO storage.objects(bucket_id,name) VALUES ('physical-shelf',auth.uid()::text||'/teste.jpg');
SELECT pg_temp.check_true((SELECT count(*)=1 FROM storage.objects WHERE bucket_id='physical-shelf' AND name=auth.uid()::text||'/teste.jpg'),'política permite imagem própria');
SELECT public.save_library_folder('Pasta auditoria',ARRAY['20000000-0000-4000-8000-000000000010'::uuid],'#123456',NULL) AS folder_id \gset
SELECT pg_temp.check_true(jsonb_array_length(public.get_library_workspace()->'folders')=1,'biblioteca salva e lista pasta');
SET LOCAL request.jwt.claim.sub='20000000-0000-4000-8000-000000000003';
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.direct_messages WHERE id=:'message_id'),'terceiro não lê mensagens');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.physical_shelf_books WHERE id='20000000-0000-4000-8000-000000000020'),'terceiro não lê estante alheia');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM storage.objects WHERE name='20000000-0000-4000-8000-000000000001/teste.jpg'),'terceiro não lê imagem alheia');
WITH changed AS (UPDATE public.mangas SET title='Ataque' WHERE id='20000000-0000-4000-8000-000000000010' RETURNING id)
SELECT pg_temp.check_true((SELECT count(*)=0 FROM changed),'terceiro não edita livro privado');
SELECT pg_temp.expect_error($q$INSERT INTO public.physical_shelf_books(user_id,image_path) VALUES('20000000-0000-4000-8000-000000000001','outro/teste.jpg')$q$,'42501','terceiro não grava na estante alheia');
SELECT pg_temp.expect_error($q$INSERT INTO storage.objects(bucket_id,name) VALUES('physical-shelf','20000000-0000-4000-8000-000000000001/invasao.jpg')$q$,'42501','terceiro não envia imagem a pasta alheia');
SET LOCAL request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
DELETE FROM public.physical_shelf_books WHERE id='20000000-0000-4000-8000-000000000020';
DELETE FROM storage.objects WHERE bucket_id='physical-shelf' AND name=auth.uid()::text||'/teste.jpg';
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.physical_shelf_books WHERE id='20000000-0000-4000-8000-000000000020'),'proprietário remove livro físico');
ROLLBACK;
