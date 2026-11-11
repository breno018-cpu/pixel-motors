-- =========================================================================
-- SCRIPT DE LIBERAÇÃO DE LEITURA (RLS) PARA ESTOQUE E VENDAS NO SUPABASE
-- Execute este script no SQL Editor do Supabase (sjftdxbahhgfoxpzjdik)
-- =========================================================================

-- 1. Garante permissão de uso do schema e leitura das tabelas para anon e authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;

-- 2. Políticas de Leitura para Veículos (Estoque)
DROP POLICY IF EXISTS "Public can view vehicles" ON public.vehicles;
CREATE POLICY "Public can view vehicles" ON public.vehicles
  FOR SELECT TO anon, authenticated
  USING (true);

-- 3. Políticas de Leitura para Contratos / Vendas
DROP POLICY IF EXISTS "Public can view contracts" ON public.contracts;
CREATE POLICY "Public can view contracts" ON public.contracts
  FOR SELECT TO anon, authenticated
  USING (true);

-- 4. Políticas de Leitura para Lojas
DROP POLICY IF EXISTS "Public can view stores" ON public.stores;
CREATE POLICY "Public can view stores" ON public.stores
  FOR SELECT TO anon, authenticated
  USING (true);

-- 5. Políticas de Leitura para Resellers (Parceiros / Revendedores)
DROP POLICY IF EXISTS "Public can view resellers" ON public.resellers;
CREATE POLICY "Public can view resellers" ON public.resellers
  FOR SELECT TO anon, authenticated
  USING (true);

-- 6. Políticas de Leitura para Modelos e Cores
DROP POLICY IF EXISTS "Public can view vehicle_models" ON public.vehicle_models;
CREATE POLICY "Public can view vehicle_models" ON public.vehicle_models
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public can view vehicle_colors" ON public.vehicle_colors;
CREATE POLICY "Public can view vehicle_colors" ON public.vehicle_colors
  FOR SELECT TO anon, authenticated
  USING (true);

-- 7. Políticas de Leitura para Modelos de Contratos (Templates)
DROP POLICY IF EXISTS "Public can view contract_templates" ON public.contract_templates;
CREATE POLICY "Public can view contract_templates" ON public.contract_templates
  FOR SELECT TO anon, authenticated
  USING (true);

-- 8. Políticas de Leitura para Perfis e Cargos
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public can view profiles" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public can view user_roles" ON public.user_roles;
CREATE POLICY "Public can view user_roles" ON public.user_roles
  FOR SELECT TO anon, authenticated
  USING (true);
