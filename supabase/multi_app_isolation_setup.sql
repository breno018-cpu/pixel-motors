-- ==============================================================================
-- PIXEL MOTORS / CONCESSIONÁRIA - ISOLAMENTO MULTI-APP (3 APLICATIVOS)
-- Banco de Dados Supabase: sjftdxbahhgfoxpzjdik
-- ==============================================================================
-- Este script divide o mesmo banco de dados PostgreSQL em 3 zonas de segurança
-- completamente isoladas, blindadas e independentes entre si.
--
-- ZONA 1 (App Atual): Schema 'public' (Pixel Motors - Vendas, Estoque, Pátio)
-- ZONA 2 (App 2):     Schema 'app_dois' (Segundo aplicativo da concessionária)
-- ZONA 3 (App 3):     Schema 'app_tres' (Terceiro aplicativo da concessionária)
-- ==============================================================================

-- 1. CRIAÇÃO DOS SCHEMAS DEDICADOS PARA OS OUTROS 2 APLICATIVOS
CREATE SCHEMA IF NOT EXISTS app_dois;
CREATE SCHEMA IF NOT EXISTS app_tres;

-- Comentários descritivos
COMMENT ON SCHEMA public IS 'Zona 1: Pixel Motors (Vendas, Estoque, Pátio, Clientes, Contratos)';
COMMENT ON SCHEMA app_dois IS 'Zona 2: Aplicativo Secundário da Concessionária (Totalmente Isolado)';
COMMENT ON SCHEMA app_tres IS 'Zona 3: Terceiro Aplicativo da Concessionária (Totalmente Isolado)';

-- ==============================================================================
-- 2. BLOQUEIO E REVOGAÇÃO DE ACESSO CRUZADO (ZERO-TRUST SECURITY)
-- ==============================================================================

-- Bloqueia o schema do App 2 para que usuários comuns do public não consigam acessar
REVOKE ALL ON SCHEMA app_dois FROM public;
REVOKE ALL ON SCHEMA app_tres FROM public;

-- Garante que apenas roles autorizados do Supabase gerenciem as permissões
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA app_dois TO authenticated, service_role;
GRANT USAGE ON SCHEMA app_tres TO authenticated, service_role;

-- ==============================================================================
-- 3. FUNÇÃO DE VERIFICAÇÃO DE IDENTIDADE DO APP (JWT CLAIM)
-- ==============================================================================
-- Permite que as políticas de RLS saibam exatamente qual app está fazendo a requisição.
-- Cada app pode enviar nos seus headers de login um token com a claim 'app_id':
-- App 1 (Pixel Motors): 'pixel_motors'
-- App 2: 'app_dois'
-- App 3: 'app_tres'

CREATE OR REPLACE FUNCTION public.current_app_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'app_id', ''),
    'pixel_motors' -- Padrão caso não seja enviado claim específica
  );
$$;

-- ==============================================================================
-- 4. TABELA CENTRAL DE IDENTIFICAÇÃO E REGISTRO DOS APLICATIVOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.dealership_apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ativa RLS na tabela de apps
ALTER TABLE public.dealership_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas administradores podem gerenciar aplicativos cadastrados"
  ON public.dealership_apps
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

CREATE POLICY "Leitura de apps ativos para usuários autenticados"
  ON public.dealership_apps
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Cadastra os 3 projetos oficiais da concessionária
INSERT INTO public.dealership_apps (id, name, schema_name, description)
VALUES 
  ('pixel_motors', 'Pixel Motors / Dealflow Hub', 'public', 'Sistema principal de vendas, estoque de veículos, pátio e descarga de cegonha'),
  ('app_dois', 'Aplicativo 2 da Concessionária', 'app_dois', 'Segundo sistema autônomo com banco de dados próprio e isolado'),
  ('app_tres', 'Aplicativo 3 da Concessionária', 'app_tres', 'Terceiro sistema autônomo com banco de dados próprio e isolado')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  schema_name = EXCLUDED.schema_name,
  description = EXCLUDED.description;

-- ==============================================================================
-- 5. MODELO DE TABELAS EXEMPLO PARA OS OUTROS 2 APPS
-- ==============================================================================

-- Exemplo: Tabelas no schema 'app_dois'
CREATE TABLE IF NOT EXISTS app_dois.registros_gerais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  dados JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_dois.registros_gerais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso restrito do App 2 aos seus próprios registros"
  ON app_dois.registros_gerais
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.current_app_id() = 'app_dois');

-- Exemplo: Tabelas no schema 'app_tres'
CREATE TABLE IF NOT EXISTS app_tres.atendimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pendente',
  detalhes JSONB DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_tres.atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso restrito do App 3 aos seus próprios atendimentos"
  ON app_tres.atendimentos
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.current_app_id() = 'app_tres');

-- ==============================================================================
-- 6. CONFIGURAÇÃO DE EXPOSIÇÃO NA API DO SUPABASE (PostgREST)
-- ==============================================================================
-- Para que os 3 schemas fiquem disponíveis na API REST do Supabase,
-- vá em: Supabase Dashboard > Project Settings > API > "Exposed schemas"
-- e adicione: public, app_dois, app_tres
--
-- No código do cliente Supabase de cada app:
-- App 1: supabase.from('vehicles') (acessa public.vehicles)
-- App 2: supabase.schema('app_dois').from('registros_gerais')
-- App 3: supabase.schema('app_tres').from('atendimentos')
-- ==============================================================================
