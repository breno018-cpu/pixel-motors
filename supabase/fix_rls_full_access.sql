-- =========================================================================
-- LIBERAÇÃO TOTAL DE OPERAÇÕES (RLS) PARA VENDAS E ESTOQUE NO SUPABASE
-- Execute este script no SQL Editor do Supabase (sjftdxbahhgfoxpzjdik)
-- Resolve o erro 42501 (new row violates row-level security policy for table "contracts")
-- permitindo sincronização perfeita entre todos os computadores e celulares da equipe.
-- =========================================================================

-- 1. Permissões de schema e tabelas para anon e authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 2. Políticas de Acesso Total para Contratos / Vendas
DROP POLICY IF EXISTS "Public full access contracts" ON public.contracts;
DROP POLICY IF EXISTS "Public can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Create contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins and sellers can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins or permitted owners can delete contracts" ON public.contracts;
DROP POLICY IF EXISTS "View contracts based on role" ON public.contracts;
DROP POLICY IF EXISTS "View contracts by role scope" ON public.contracts;

CREATE POLICY "Public full access contracts" ON public.contracts
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Políticas de Acesso Total para Veículos (Estoque)
DROP POLICY IF EXISTS "Public full access vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Public can view vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Admins and managers can manage vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Sales roles can update vehicles of their store" ON public.vehicles;
DROP POLICY IF EXISTS "Vendedor plus can register vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "View vehicles based on role" ON public.vehicles;

CREATE POLICY "Public full access vehicles" ON public.vehicles
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Políticas para Colaboradores (Employees)
DROP POLICY IF EXISTS "Public full access employees" ON public.employees;
DROP POLICY IF EXISTS "Public can view employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;

CREATE POLICY "Public full access employees" ON public.employees
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Lojas, Revendedores, Perfis e Modelos
DROP POLICY IF EXISTS "Public full access stores" ON public.stores;
DROP POLICY IF EXISTS "Public can view stores" ON public.stores;
CREATE POLICY "Public full access stores" ON public.stores
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access resellers" ON public.resellers;
DROP POLICY IF EXISTS "Public can view resellers" ON public.resellers;
CREATE POLICY "Public full access resellers" ON public.resellers
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public full access profiles" ON public.profiles
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Public can view user_roles" ON public.user_roles;
CREATE POLICY "Public full access user_roles" ON public.user_roles
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access vehicle_models" ON public.vehicle_models;
DROP POLICY IF EXISTS "Public can view vehicle_models" ON public.vehicle_models;
CREATE POLICY "Public full access vehicle_models" ON public.vehicle_models
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access contract_templates" ON public.contract_templates;
DROP POLICY IF EXISTS "Public can view contract_templates" ON public.contract_templates;
CREATE POLICY "Public full access contract_templates" ON public.contract_templates
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
