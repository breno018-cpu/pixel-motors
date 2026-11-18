-- =========================================================================
-- CORREÇÃO DE RLS (42501) PARA ACTIVITY_LOGS E INVOICES NO SUPABASE
-- Execute este comando no SQL Editor do Supabase (sjftdxbahhgfoxpzjdik)
-- Resolve o erro 42501: new row violates row-level security policy for table "activity_logs"
-- =========================================================================

-- 1. Garante permissões de schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Activity Logs (Auditoria e Sessões de Dispositivos)
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System can insert logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Public full access activity_logs" ON public.activity_logs;

CREATE POLICY "Public full access activity_logs" ON public.activity_logs
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Invoices (Notas Fiscais de Motos e Serviços)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins and managers can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "View invoices based on role" ON public.invoices;

CREATE POLICY "Public full access invoices" ON public.invoices
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Transferências de Estoque e Consignações
DROP POLICY IF EXISTS "Public full access stock_transfers" ON public.stock_transfers;
CREATE POLICY "Public full access stock_transfers" ON public.stock_transfers
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access reseller_consignment_contracts" ON public.reseller_consignment_contracts;
CREATE POLICY "Public full access reseller_consignment_contracts" ON public.reseller_consignment_contracts
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access store_ads" ON public.store_ads;
CREATE POLICY "Public full access store_ads" ON public.store_ads
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
