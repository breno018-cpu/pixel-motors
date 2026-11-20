CREATE TEMP TABLE res(passo text, ok boolean, detalhe text);
CREATE TEMP TABLE uids AS SELECT email, id FROM auth.users WHERE email IN ('shineraymoc@user.com','shineraymoch@user.com','shineraydivg@user.com','admbreno@index.com');
GRANT ALL ON res, uids TO authenticated;
DO $$
DECLARE cid uuid := '41b205a5-a206-416d-80f2-58fc8b173ead'; vid uuid := 'e2a3222a-9ecf-48d5-9fc6-39961089d27a'; n int; mar uuid; hal uuid; div uuid; adm uuid; ncount int;
BEGIN
 SELECT id INTO mar FROM uids WHERE email='shineraymoc@user.com'; SELECT id INTO hal FROM uids WHERE email='shineraymoch@user.com';
 SELECT id INTO div FROM uids WHERE email='shineraydivg@user.com'; SELECT id INTO adm FROM uids WHERE email='admbreno@index.com';

 PERFORM set_config('request.jwt.claims', json_build_object('sub',hal,'role','authenticated')::text, true); SET LOCAL ROLE authenticated;
 SELECT count(*) INTO ncount FROM contracts WHERE id=cid; INSERT INTO res VALUES ('6 persistiu e Halanna (mesma loja) enxerga', ncount=1, ncount::text);
 RESET ROLE;

 PERFORM set_config('request.jwt.claims', json_build_object('sub',div,'role','authenticated')::text, true); SET LOCAL ROLE authenticated;
 SELECT count(*) INTO ncount FROM contracts WHERE id=cid; INSERT INTO res VALUES ('7 vendedor de Divinopolis NAO enxerga', ncount=0, ncount::text);
 UPDATE contracts SET notes='invasao' WHERE id=cid; GET DIAGNOSTICS n=ROW_COUNT; INSERT INTO res VALUES ('8 vendedor de outra loja NAO consegue editar', n=0, n::text);
 RESET ROLE;

 PERFORM set_config('request.jwt.claims', json_build_object('sub',mar,'role','authenticated')::text, true); SET LOCAL ROLE authenticated;
 UPDATE contracts SET created_by=hal, external_data = external_data || '{"vendedor":"Halanna","seller_name":"Halanna"}' WHERE id=cid; GET DIAGNOSTICS n=ROW_COUNT; INSERT INTO res VALUES ('9 transferir operador Mariana -> Halanna', n=1, n::text);
 RESET ROLE;

 PERFORM set_config('request.jwt.claims', json_build_object('sub',hal,'role','authenticated')::text, true); SET LOCAL ROLE authenticated;
 SELECT count(*) INTO ncount FROM contracts WHERE id=cid AND created_by=hal AND external_data->>'seller_name'='Halanna'; INSERT INTO res VALUES ('10 Halanna ve a venda como dela', ncount=1, ncount::text);
 BEGIN DELETE FROM contracts WHERE id=cid; GET DIAGNOSTICS n=ROW_COUNT; INSERT INTO res VALUES ('11 exclusao fisica por vendedor bloqueada', n=0, n::text);
 EXCEPTION WHEN OTHERS THEN INSERT INTO res VALUES ('11 exclusao fisica por vendedor bloqueada', true, SQLERRM); END;
 UPDATE contracts SET is_deleted=true, deleted_at=now(), deleted_by=hal, deletion_reason='TESTE-AUTOMATICO', status='cancelado' WHERE id=cid; GET DIAGNOSTICS n=ROW_COUNT; INSERT INTO res VALUES ('12 exclusao logica da venda', n=1, n::text);
 UPDATE vehicles SET is_deleted=true, deleted_at=now(), deleted_by=hal, deletion_reason='TESTE-AUTOMATICO' WHERE id=vid; GET DIAGNOSTICS n=ROW_COUNT; INSERT INTO res VALUES ('13 exclusao logica do veiculo', n=1, n::text);
 SELECT count(*) INTO ncount FROM contracts WHERE id=cid AND is_deleted=false; INSERT INTO res VALUES ('14 some das listas ativas', ncount=0, ncount::text);
 RESET ROLE;

 PERFORM set_config('request.jwt.claims', json_build_object('sub',adm,'role','authenticated')::text, true); SET LOCAL ROLE authenticated;
 BEGIN DELETE FROM contracts WHERE id=cid; INSERT INTO res VALUES ('15 nem admin apaga fisicamente', false, 'APAGOU');
 EXCEPTION WHEN OTHERS THEN INSERT INTO res VALUES ('15 nem admin apaga fisicamente', true, SQLERRM); END;
 UPDATE contracts SET is_deleted=false, deleted_at=NULL, deleted_by=NULL, deletion_reason=NULL, status='concluido' WHERE id=cid; GET DIAGNOSTICS n=ROW_COUNT; INSERT INTO res VALUES ('16 admin recupera a venda', n=1, n::text);
 SELECT count(*) INTO ncount FROM contracts WHERE id=cid AND is_deleted=false; INSERT INTO res VALUES ('17 venda voltou as listas ativas', ncount=1, ncount::text);
 UPDATE contracts SET is_deleted=true, deleted_at=now(), deleted_by=adm, deletion_reason='TESTE-AUTOMATICO (limpeza final)', status='cancelado' WHERE id=cid;
 RESET ROLE;
END $$;
SELECT * FROM res;
