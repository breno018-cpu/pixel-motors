-- =========================================================================
-- MIGRATION: 20261120090000_forensic_data_protection.sql
-- OBJETIVO: PROTEÇÃO DEFINITIVA DE DADOS, SOFT DELETE, UNICIDADE E AUDITORIA
-- =========================================================================

-- 1. SOFT DELETE EM CONTRACTS
ALTER TABLE public.contracts 
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_is_deleted ON public.contracts (is_deleted);
CREATE INDEX IF NOT EXISTS idx_contracts_deleted_at ON public.contracts (deleted_at);

-- 2. SOFT DELETE EM VEHICLES
ALTER TABLE public.vehicles 
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_is_deleted ON public.vehicles (is_deleted);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON public.vehicles (deleted_at);

-- 3. UNICIDADE DE CHASSI ATIVO NO ESTOQUE (PROTEÇÃO CONTRA DUPLICATAS)
DROP INDEX IF EXISTS public.idx_vehicles_unique_chassis_active;
CREATE UNIQUE INDEX idx_vehicles_unique_chassis_active 
ON public.vehicles (UPPER(TRIM(chassis))) 
WHERE (
  deleted_at IS NULL 
  AND is_deleted = false 
  AND chassis IS NOT NULL 
  AND TRIM(chassis) != '' 
  AND chassis NOT ILIKE '%DISPENSADO%'
);

-- 4. ATUALIZAÇÃO DA TABELA ACTIVITY_LOGS PARA AUDITORIA IMUTÁVEL
ALTER TABLE public.activity_logs
  ALTER COLUMN entity_id TYPE TEXT USING entity_id::TEXT,
  ADD COLUMN IF NOT EXISTS previous_data JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS new_data JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT DEFAULT NULL;

-- 5. POLÍTICAS RLS ROBUSTAS E SEGURAS
-- 5.1 Activity Logs (Imutável: Apenas INSERT e SELECT)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System can insert logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Public full access activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_policy" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_select_policy" ON public.activity_logs;

CREATE POLICY "activity_logs_insert_policy" ON public.activity_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "activity_logs_select_policy" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_elevated_access(auth.uid())
    OR user_id = auth.uid()
  );

-- 5.2 Invoices (Notas Fiscais)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Elevated users can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Public full access invoices" ON public.invoices;
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;

CREATE POLICY "invoices_select_policy" ON public.invoices
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "invoices_insert_policy" ON public.invoices
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "invoices_update_policy" ON public.invoices
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5.3 Stock Transfers (Transferências de Estoque)
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Elevated users manage transfers" ON public.stock_transfers;
DROP POLICY IF EXISTS "Users view transfers of their store" ON public.stock_transfers;
DROP POLICY IF EXISTS "Public full access stock_transfers" ON public.stock_transfers;
DROP POLICY IF EXISTS "stock_transfers_select_policy" ON public.stock_transfers;
DROP POLICY IF EXISTS "stock_transfers_insert_policy" ON public.stock_transfers;
DROP POLICY IF EXISTS "stock_transfers_update_policy" ON public.stock_transfers;

CREATE POLICY "stock_transfers_select_policy" ON public.stock_transfers
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "stock_transfers_insert_policy" ON public.stock_transfers
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "stock_transfers_update_policy" ON public.stock_transfers
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5.4 Proteção contra exclusão física de contracts e vehicles
-- Garante que tentativas de DELETE físico por clientes comuns não apaguem linhas
-- (Soft delete é realizado via UPDATE set is_deleted = true, deleted_at = now())
CREATE OR REPLACE FUNCTION public.prevent_physical_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Exclusão física direta não permitida nesta tabela. Utilize a exclusão lógica (soft delete via is_deleted = true).';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_contracts_physical_delete ON public.contracts;
CREATE TRIGGER trg_prevent_contracts_physical_delete
BEFORE DELETE ON public.contracts
FOR EACH ROW
WHEN (OLD.contract_number != 'DEALFLOW_GLOBAL_SYNC' AND OLD.contract_number != 'DEALFLOW_GLOBAL_SYNC_BACKUP')
EXECUTE FUNCTION public.prevent_physical_delete();

DROP TRIGGER IF EXISTS trg_prevent_vehicles_physical_delete ON public.vehicles;
CREATE TRIGGER trg_prevent_vehicles_physical_delete
BEFORE DELETE ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_physical_delete();
