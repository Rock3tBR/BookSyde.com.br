-- Requer fixture + todas as migrações em PostgreSQL descartável.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check_true(ok boolean,label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RETURN 'PASS: '||label; END $$;
CREATE FUNCTION pg_temp.expect_error(command text,expected_code text,label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE command;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE=expected_code THEN RETURN 'PASS: '||label; END IF; RAISE;
 END;
 RAISE EXCEPTION 'FAIL: deveria falhar: %',label;
END $$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('30000000-0000-4000-8000-000000000001','admin@example.invalid','{}'),
 ('30000000-0000-4000-8000-000000000002','publisher@example.invalid','{}'),
 ('30000000-0000-4000-8000-000000000003','reader@example.invalid','{}');
INSERT INTO public.user_roles(user_id,role) VALUES ('30000000-0000-4000-8000-000000000001','admin');
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='30000000-0000-4000-8000-000000000001';
SELECT pg_temp.check_true((public.booksyde_admin_set_account_type('30000000-0000-4000-8000-000000000002','editora')->>'ok')::boolean,'admin altera tipo de conta');
SELECT pg_temp.check_true(public.is_creator('30000000-0000-4000-8000-000000000002'),'editora recebe permissão de publicação');
SELECT pg_temp.check_true(jsonb_array_length(public.booksyde_admin_list_users())=3,'lista administrativa continua funcionando');
SELECT pg_temp.check_true(public.get_admin_dashboard(30)->'users'->>'total'='3','dashboard administrativo');
SELECT pg_temp.expect_error($q$SELECT public.booksyde_admin_set_account_type(auth.uid(),'user')$q$,'22023','admin não rebaixa a própria conta');
INSERT INTO public.site_settings(key,value) VALUES('donations','{"enabled":true}')
ON CONFLICT(key) DO UPDATE SET value=excluded.value;

-- Admin cria obra no catálogo com INSERT RETURNING usado pelo frontend.
INSERT INTO public.mangas(id,creator_id,title,slug,work_type,visibility,distribution_channel)
 VALUES('30000000-0000-4000-8000-000000000010',auth.uid(),'Catálogo','crud-catalog','book','public','catalog') RETURNING id,slug,visibility,work_type,is_collection,distribution_channel;
INSERT INTO public.volumes(id,manga_id,number,published) VALUES('30000000-0000-4000-8000-000000000020','30000000-0000-4000-8000-000000000010',1,true) RETURNING id;
INSERT INTO public.pages(volume_id,page_index,storage_path) VALUES('30000000-0000-4000-8000-000000000020',0,'30000000-0000-4000-8000-000000000010/30000000-0000-4000-8000-000000000020/0.jpg');
INSERT INTO storage.objects(bucket_id,name) VALUES('manga-pages','30000000-0000-4000-8000-000000000010/30000000-0000-4000-8000-000000000020/0.jpg');

SET LOCAL request.jwt.claim.sub='30000000-0000-4000-8000-000000000002';
UPDATE public.profiles SET display_name='Editora teste',theme='midnight' WHERE id=auth.uid() RETURNING id;
INSERT INTO public.profile_contacts(user_id,phone_e164) VALUES(auth.uid(),'+5511999999999') ON CONFLICT(user_id) DO UPDATE SET phone_e164=excluded.phone_e164;
INSERT INTO public.mangas(id,creator_id,title,slug,work_type,visibility,distribution_channel,cover_url)
 VALUES('30000000-0000-4000-8000-000000000011',auth.uid(),'Privado','crud-private','book','private','unlisted','storage:30000000-0000-4000-8000-000000000002/cover.jpg') RETURNING id,slug,visibility,work_type,is_collection,distribution_channel;
UPDATE public.mangas SET title='Editado',price_cents=200,licensed_store_name='Loja',licensed_purchase_url='https://example.invalid'
 WHERE id='30000000-0000-4000-8000-000000000011' RETURNING id,slug,visibility,distribution_channel;
SELECT pg_temp.check_true((SELECT licensed_store_name='Loja' FROM public.booksyde_private_work_fields(ARRAY['30000000-0000-4000-8000-000000000011'::uuid])),'campos privados disponíveis ao dono por RPC');
SELECT pg_temp.expect_error($q$SELECT invite_token FROM public.mangas$q$,'42501','tokens continuam bloqueados no SELECT geral');
INSERT INTO public.volumes(id,manga_id,number,published) VALUES('30000000-0000-4000-8000-000000000021','30000000-0000-4000-8000-000000000011',1,false) RETURNING id;
UPDATE public.volumes SET file_format='epub',source_path='30000000-0000-4000-8000-000000000011/30000000-0000-4000-8000-000000000021/book.epub',source_name='book.epub',source_size=512,published=true
 WHERE id='30000000-0000-4000-8000-000000000021' RETURNING id;
INSERT INTO public.pages(id,volume_id,page_index,storage_path) VALUES('30000000-0000-4000-8000-000000000030','30000000-0000-4000-8000-000000000021',0,'30000000-0000-4000-8000-000000000011/30000000-0000-4000-8000-000000000021/0.jpg');
INSERT INTO storage.objects(bucket_id,name) VALUES
 ('volume-sources','30000000-0000-4000-8000-000000000011/30000000-0000-4000-8000-000000000021/book.epub'),
 ('manga-pages','30000000-0000-4000-8000-000000000011/30000000-0000-4000-8000-000000000021/0.jpg'),
 ('manga-covers','30000000-0000-4000-8000-000000000002/cover.jpg');
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.booksyde_reader_pages(ARRAY['30000000-0000-4000-8000-000000000021'::uuid])),'leitor consulta páginas autorizadas');
SELECT pg_temp.check_true(public.booksyde_reader_source('30000000-0000-4000-8000-000000000021') IS NOT NULL,'leitor consulta EPUB autorizado');
SELECT public.save_library_folder('Coleção',ARRAY['30000000-0000-4000-8000-000000000011'::uuid]) AS folder_id \gset
SELECT public.save_library_folder('Coleção editada',ARRAY['30000000-0000-4000-8000-000000000011'::uuid],'#123456',:'folder_id');
SELECT pg_temp.check_true(public.get_library_workspace()->'folders'->0->>'name'='Coleção editada','biblioteca cria e edita pasta');
SELECT public.upsert_marketplace_listing('manga','30000000-0000-4000-8000-000000000011',200) AS listing_id \gset
SELECT public.set_marketplace_listing_active(:'listing_id',true);
SELECT public.upsert_marketplace_listing('manga','30000000-0000-4000-8000-000000000011',300);
SELECT pg_temp.check_true((SELECT price_cents=300 FROM public.marketplace_listings WHERE id=:'listing_id'),'anúncio cria e edita');
INSERT INTO public.manga_favorites(user_id,manga_id) VALUES(auth.uid(),'30000000-0000-4000-8000-000000000011');
INSERT INTO public.reading_progress(user_id,volume_id,page_index) VALUES(auth.uid(),'30000000-0000-4000-8000-000000000021',0)
 ON CONFLICT(user_id,volume_id) DO UPDATE SET page_index=excluded.page_index;
SELECT public.add_reading_time(60,'30000000-0000-4000-8000-000000000021');
SELECT public.record_system_access();
INSERT INTO public.comments(user_id,manga_id,body) VALUES(auth.uid(),'30000000-0000-4000-8000-000000000011','Comentário') RETURNING id AS comment_id \gset
UPDATE public.comments SET body='Comentário editado' WHERE id=:'comment_id';
DELETE FROM public.comments WHERE id=:'comment_id';
SELECT public.create_support_request('Editora','editora@example.invalid','outros','Teste suporte','Mensagem de suporte teste') AS support_id \gset

-- Terceiro não pode alterar papéis, publicar, ler originais nem apagar obra alheia.
SET LOCAL request.jwt.claim.sub='30000000-0000-4000-8000-000000000003';
SELECT pg_temp.expect_error($q$SELECT public.booksyde_admin_set_account_type(auth.uid(),'admin')$q$,'42501','leitor não promove conta');
SELECT pg_temp.expect_error($q$INSERT INTO public.mangas(creator_id,title,slug,work_type) VALUES(auth.uid(),'Invasão','crud-denied','book')$q$,'42501','leitor não publica');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.booksyde_reader_pages(ARRAY['30000000-0000-4000-8000-000000000021'::uuid])),'terceiro não lê páginas privadas');
SELECT pg_temp.check_true(public.booksyde_reader_source('30000000-0000-4000-8000-000000000021') IS NULL,'terceiro não recebe EPUB');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.booksyde_private_work_fields(ARRAY['30000000-0000-4000-8000-000000000011'::uuid])),'terceiro não recebe convite');
SELECT pg_temp.expect_error($q$SELECT public.booksyde_delete_publication('30000000-0000-4000-8000-000000000011')$q$,'42501','terceiro não apaga obra');
SELECT pg_temp.expect_error($q$INSERT INTO public.publication_cleanup(requested_by,bucket_id,object_path) VALUES(auth.uid(),'manga-pages','alheio')$q$,'42501','cliente não forja recibo de exclusão');
WITH changed AS(UPDATE public.profiles SET display_name='Invadido' WHERE id='30000000-0000-4000-8000-000000000002' RETURNING id)
SELECT pg_temp.check_true((SELECT count(*)=0 FROM changed),'terceiro não altera perfil');

-- Convite concede acesso somente após resgate.
SET LOCAL request.jwt.claim.sub='30000000-0000-4000-8000-000000000002';
UPDATE public.mangas SET visibility='invite' WHERE id='30000000-0000-4000-8000-000000000011';
SELECT invite_token FROM public.booksyde_private_work_fields(ARRAY['30000000-0000-4000-8000-000000000011'::uuid]) \gset
SET LOCAL request.jwt.claim.sub='30000000-0000-4000-8000-000000000003';
SELECT public.redeem_manga_invite(:'invite_token');
SELECT pg_temp.check_true(public.booksyde_reader_source('30000000-0000-4000-8000-000000000021') IS NOT NULL,'convite resgatado libera leitura');
SET LOCAL request.jwt.claim.sub='30000000-0000-4000-8000-000000000002';
UPDATE public.volumes SET published=false WHERE id='30000000-0000-4000-8000-000000000021';
SET LOCAL request.jwt.claim.sub='30000000-0000-4000-8000-000000000003';
SELECT pg_temp.check_true(public.booksyde_reader_source('30000000-0000-4000-8000-000000000021') IS NULL,'rascunho não é liberado ao leitor');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM storage.objects WHERE bucket_id='volume-sources'),'Storage também bloqueia o rascunho');

-- Exclusão remove dados em cascata e mantém os recibos de limpeza até o Storage concluir.
SET LOCAL request.jwt.claim.sub='30000000-0000-4000-8000-000000000002';
SELECT public.booksyde_delete_publication(NULL,'30000000-0000-4000-8000-000000000021');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.volumes WHERE id='30000000-0000-4000-8000-000000000021'),'editora exclui volume');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.publication_cleanup WHERE object_path LIKE '%/cover.jpg'),'capa da obra preservada ao excluir volume');
SELECT pg_temp.check_true((SELECT count(*)=1 FROM storage.objects WHERE bucket_id='volume-sources'),'recibo permite localizar original após exclusão');
DELETE FROM storage.objects WHERE bucket_id='volume-sources';
SELECT pg_temp.check_true((SELECT count(*)=0 FROM storage.objects WHERE bucket_id='volume-sources'),'recibo permite remover original após exclusão');
SELECT public.set_marketplace_listing_active(:'listing_id',true);
SELECT public.booksyde_delete_publication('30000000-0000-4000-8000-000000000011');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.mangas WHERE id='30000000-0000-4000-8000-000000000011'),'editora exclui obra');
SELECT pg_temp.check_true((SELECT NOT active FROM public.marketplace_listings WHERE id=:'listing_id'),'exclusão desativa anúncio');
SET LOCAL request.jwt.claim.sub='30000000-0000-4000-8000-000000000003';
SELECT pg_temp.check_true((SELECT count(*)=0 FROM public.publication_cleanup),'terceiro não vê recibos de limpeza');
SET LOCAL request.jwt.claim.sub='30000000-0000-4000-8000-000000000001';
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.content_removals WHERE manga_id='30000000-0000-4000-8000-000000000011'),'exclusão registrada na auditoria');
SELECT public.admin_review_support_request(:'support_id','resolved');
SELECT pg_temp.expect_error($q$SELECT public.booksyde_delete_publication('30000000-0000-4000-8000-000000000010')$q$,'22023','moderação exige motivo');

-- Visitante: leitura pública funciona, mas não há acesso a privados/pagamentos.
RESET ROLE;
SET LOCAL request.jwt.claim.sub='';
SET LOCAL ROLE anon;
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.site_settings WHERE key='donations'),'visitante consulta doações sem erro de EXECUTE');
SELECT pg_temp.check_true((SELECT count(*)=1 FROM public.booksyde_reader_pages(ARRAY['30000000-0000-4000-8000-000000000020'::uuid])),'visitante lê catálogo gratuito');
SELECT pg_temp.check_true((SELECT count(*)=1 FROM storage.objects WHERE name='30000000-0000-4000-8000-000000000010/30000000-0000-4000-8000-000000000020/0.jpg'),'visitante acessa arquivo gratuito');
SELECT pg_temp.check_true(NOT has_function_privilege('anon','public.booksyde_delete_publication(uuid,uuid,text,text)','EXECUTE'),'anon não executa exclusão');
SELECT pg_temp.check_true(NOT has_function_privilege('authenticated','public.fulfill_marketplace_order(uuid,text)','EXECUTE'),'cliente não confirma pagamento');
ROLLBACK;
