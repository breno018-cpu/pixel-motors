BEGIN;
SELECT set_config('t.uid',(SELECT id::text FROM auth.users WHERE email='shineraydivg@user.com'),true);
SELECT set_config('request.jwt.claims', json_build_object('sub',current_setting('t.uid'),'role','authenticated')::text, true);
CREATE TEMP TABLE res(teste text, linhas int);
GRANT ALL ON res TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE n int;
BEGIN
 UPDATE user_roles SET role='admin' WHERE user_id=current_setting('t.uid')::uuid; GET DIAGNOSTICS n = ROW_COUNT; INSERT INTO res VALUES ('promover_a_si_mesmo',n);
 UPDATE contracts SET notes=notes WHERE store_id='e8254a81-d669-464b-9806-457ba25ce7f0'; GET DIAGNOSTICS n = ROW_COUNT; INSERT INTO res VALUES ('editar_contratos_outra_loja',n);
 BEGIN DELETE FROM vehicles; GET DIAGNOSTICS n = ROW_COUNT; INSERT INTO res VALUES ('apagar_veiculos',n);
 EXCEPTION WHEN OTHERS THEN INSERT INTO res VALUES ('apagar_veiculos_ERRO_'||SQLERRM,0); END;
END $$;
SELECT * FROM res;
ROLLBACK;
