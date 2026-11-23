-- =============================================================================
-- MIGRAÇÃO: Permite leitura/atualização de DEALFLOW_GLOBAL_SYNC por usuários
-- autenticados de qualquer loja, mantendo isolamento estrito nos contratos reais.
-- Corrige erro 42501 ao entrar na área de Vendas em outras lojas (ex: Divinópolis).
-- =============================================================================

DROP POLICY IF EXISTS contracts_select ON public.contracts;
CREATE POLICY contracts_select ON public.contracts FOR SELECT TO authenticated
USING (
  contract_number = 'DEALFLOW_GLOBAL_SYNC'
  OR public.has_elevated_access(auth.uid())
  OR store_id = public.get_user_store_id(auth.uid())
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS contracts_insert ON public.contracts;
CREATE POLICY contracts_insert ON public.contracts FOR INSERT TO authenticated
WITH CHECK (
  (
    contract_number = 'DEALFLOW_GLOBAL_SYNC'
    AND (public.can_create_sales(auth.uid()) OR public.has_elevated_access(auth.uid()))
  )
  OR (
    public.can_create_sales(auth.uid())
    AND (
      public.has_elevated_access(auth.uid())
      OR store_id = public.get_user_store_id(auth.uid())
      OR public.get_user_store_id(auth.uid()) IS NULL
    )
  )
);

DROP POLICY IF EXISTS contracts_update ON public.contracts;
CREATE POLICY contracts_update ON public.contracts FOR UPDATE TO authenticated
USING (
  (
    contract_number = 'DEALFLOW_GLOBAL_SYNC'
    AND (public.can_create_sales(auth.uid()) OR public.has_elevated_access(auth.uid()))
  )
  OR public.has_elevated_access(auth.uid())
  OR store_id = public.get_user_store_id(auth.uid())
  OR created_by = auth.uid()
)
WITH CHECK (
  (
    contract_number = 'DEALFLOW_GLOBAL_SYNC'
    AND (public.can_create_sales(auth.uid()) OR public.has_elevated_access(auth.uid()))
  )
  OR public.has_elevated_access(auth.uid())
  OR store_id = public.get_user_store_id(auth.uid())
  OR created_by = auth.uid()
);

-- Auditoria: permite registro pelo próprio usuário autenticado
DROP POLICY IF EXISTS activity_logs_insert_policy ON public.activity_logs;
CREATE POLICY activity_logs_insert_policy ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
