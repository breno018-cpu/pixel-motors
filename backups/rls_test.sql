BEGIN;
-- RLS por cargo e por loja. Remove as polÃ­ticas "Public full access" (que anulavam as
-- polÃ­ticas corretas jÃ¡ existentes) e cria polÃ­ticas individuais para contracts/vehicles.
-- Rollback: recriar as polÃ­ticas a partir de backups/policies_before_rls_2026-11-20.json

-- 1) Tabelas que JÃ tinham regras por cargo: basta remover a polÃ­tica aberta
DROP POLICY IF EXISTS "Public full access employees" ON public.employees;
DROP POLICY IF EXISTS "Public full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public full access resellers" ON public.resellers;
DROP POLICY IF EXISTS "Public full access stores" ON public.stores;
DROP POLICY IF EXISTS "Public full access user_roles" ON public.user_roles;

-- 2) contracts: leitura por loja/autoria; escrita por permissÃ£o de venda
DROP POLICY IF EXISTS "Public full access contracts" ON public.contracts;

CREATE POLICY contracts_select ON public.contracts FOR SELECT TO authenticated
USING (
  public.has_elevated_access(auth.uid())
  OR store_id = public.get_user_store_id(auth.uid())
  OR created_by = auth.uid()
);

CREATE POLICY contracts_insert ON public.contracts FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_sales(auth.uid())
  AND (
    public.has_elevated_access(auth.uid())
    OR store_id = public.get_user_store_id(auth.uid())
    OR public.get_user_store_id(auth.uid()) IS NULL
  )
);

CREATE POLICY contracts_update ON public.contracts FOR UPDATE TO authenticated
USING (
  public.has_elevated_access(auth.uid())
  OR store_id = public.get_user_store_id(auth.uid())
  OR created_by = auth.uid()
)
WITH CHECK (
  public.has_elevated_access(auth.uid())
  OR store_id = public.get_user_store_id(auth.uid())
  OR created_by = auth.uid()
);

-- ExclusÃ£o fÃ­sica: somente admin (e o trigger de proteÃ§Ã£o continua bloqueando)
CREATE POLICY contracts_delete ON public.contracts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3) vehicles: estoque visÃ­vel a todos os logados (necessÃ¡rio p/ vender e transferir)
DROP POLICY IF EXISTS "Public full access vehicles" ON public.vehicles;

CREATE POLICY vehicles_select ON public.vehicles FOR SELECT TO authenticated USING (true);

CREATE POLICY vehicles_insert ON public.vehicles FOR INSERT TO authenticated
WITH CHECK (public.can_register_vehicles(auth.uid()));

CREATE POLICY vehicles_update ON public.vehicles FOR UPDATE TO authenticated
USING (public.can_register_vehicles(auth.uid()) OR public.can_create_sales(auth.uid()))
WITH CHECK (public.can_register_vehicles(auth.uid()) OR public.can_create_sales(auth.uid()));

CREATE POLICY vehicles_delete ON public.vehicles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4) Tabelas auxiliares
DROP POLICY IF EXISTS "Public full access contract_templates" ON public.contract_templates;
CREATE POLICY contract_templates_select ON public.contract_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY contract_templates_write ON public.contract_templates FOR ALL TO authenticated
USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));

DROP POLICY IF EXISTS "Public full access vehicle_models" ON public.vehicle_models;
CREATE POLICY vehicle_models_write ON public.vehicle_models FOR ALL TO authenticated
USING (public.has_elevated_access(auth.uid())) WITH CHECK (public.has_elevated_access(auth.uid()));

-- invoices e stock_transfers: escrita sÃ³ por quem opera vendas/estoque
DROP POLICY IF EXISTS invoices_insert_policy ON public.invoices;
DROP POLICY IF EXISTS invoices_update_policy ON public.invoices;
CREATE POLICY invoices_insert_policy ON public.invoices FOR INSERT TO authenticated
WITH CHECK (public.can_create_sales(auth.uid()) OR public.has_elevated_access(auth.uid()));
CREATE POLICY invoices_update_policy ON public.invoices FOR UPDATE TO authenticated
USING (public.can_create_sales(auth.uid()) OR public.has_elevated_access(auth.uid()))
WITH CHECK (public.can_create_sales(auth.uid()) OR public.has_elevated_access(auth.uid()));

DROP POLICY IF EXISTS stock_transfers_insert_policy ON public.stock_transfers;
DROP POLICY IF EXISTS stock_transfers_update_policy ON public.stock_transfers;
CREATE POLICY stock_transfers_insert_policy ON public.stock_transfers FOR INSERT TO authenticated
WITH CHECK (public.can_register_vehicles(auth.uid()) OR public.has_elevated_access(auth.uid()));
CREATE POLICY stock_transfers_update_policy ON public.stock_transfers FOR UPDATE TO authenticated
USING (public.can_register_vehicles(auth.uid()) OR public.has_elevated_access(auth.uid()))
WITH CHECK (public.can_register_vehicles(auth.uid()) OR public.has_elevated_access(auth.uid()));

-- Auditoria: ninguÃ©m registra log em nome de outro usuÃ¡rio; sem UPDATE/DELETE (imutÃ¡vel)
DROP POLICY IF EXISTS activity_logs_insert_policy ON public.activity_logs;
CREATE POLICY activity_logs_insert_policy ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE TEMP TABLE r(email text, ctr int, veh int, roles int, profs int);
GRANT ALL ON r TO authenticated;
DO $$
DECLARE u record; c int; v int; ro int; p int;
BEGIN
 FOR u IN SELECT id, email FROM auth.users WHERE email IN ('admbreno@index.com','shineraymocj@gestor.com','shineraydivg@user.com','shineraymoc@user.com','shineraymoch@user.com','laurentinobreno08@gmail.com') LOOP
  PERFORM set_config('request.jwt.claims', json_build_object('sub',u.id,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO c FROM contracts WHERE contract_number<>'DEALFLOW_GLOBAL_SYNC';
  SELECT count(*) INTO v FROM vehicles;
  SELECT count(*) INTO ro FROM user_roles;
  SELECT count(*) INTO p FROM profiles;
  RESET ROLE;
  INSERT INTO r VALUES (u.email,c,v,ro,p);
 END LOOP;
END $$;
SELECT * FROM r ORDER BY 1;
ROLLBACK;
