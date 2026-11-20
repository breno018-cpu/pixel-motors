BEGIN;
SELECT set_config('t.uid',(SELECT id::text FROM auth.users WHERE email='shineraymoc@user.com'),true);
SELECT set_config('request.jwt.claims', json_build_object('sub',current_setting('t.uid'),'role','authenticated')::text, true);
CREATE TEMP TABLE res(passo text, ok boolean, detalhe text); GRANT ALL ON res TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE vid uuid := gen_random_uuid(); cid uuid := gen_random_uuid(); n int;
BEGIN
 INSERT INTO vehicles (id, brand, model, year, status, chassis, store_id, notes) VALUES (vid,'TESTE','TESTE-AUTOMATICO',2026,'disponivel','TESTEAUTO0000001','e8254a81-d669-464b-9806-457ba25ce7f0','TESTE-AUTOMATICO');
 INSERT INTO res VALUES ('1 criar veiculo teste', true, vid::text);
 INSERT INTO contracts (id, contract_number, vehicle_id, store_id, buyer_name, buyer_cpf, sale_price, status, created_by, notes, external_data)
  VALUES (cid,'TESTE-0001',vid,'e8254a81-d669-464b-9806-457ba25ce7f0','TESTE-AUTOMATICO','00000000000',1,'concluido',current_setting('t.uid')::uuid,'TESTE-AUTOMATICO','{"seller_name":"Mariana Sabino","chassis":"TESTEAUTO0000001","teste":true}');
 INSERT INTO res VALUES ('2 criar venda teste (Mariana)', true, cid::text);
 UPDATE vehicles SET status='vendido' WHERE id=vid; GET DIAGNOSTICS n=ROW_COUNT; INSERT INTO res VALUES ('3 marcar veiculo vendido', n=1, n::text);
 BEGIN INSERT INTO vehicles (brand, model, year, status, chassis, store_id) VALUES ('TESTE','DUP',2026,'disponivel','testeauto0000001','ccf8e097-09d7-4305-8077-5c16fc8b5634');
  INSERT INTO res VALUES ('4 chassi duplicado bloqueado', false, 'PERMITIU DUPLICAR');
 EXCEPTION WHEN unique_violation THEN INSERT INTO res VALUES ('4 chassi duplicado bloqueado', true, 'unique_violation'); END;
 INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES (current_setting('t.uid')::uuid,'criar','venda',cid::text,'{"teste":true}');
 INSERT INTO res VALUES ('5 gravar auditoria (entity_id texto)', true, '');
END $$;
SELECT * FROM res;
COMMIT;
