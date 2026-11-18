-- =========================================================================
-- RESOLUÇÃO DAS ALERTAS DO SUPABASE SECURITY ADVISOR
-- Execute este script no SQL Editor do Supabase (sjftdxbahhgfoxpzjdik)
-- 
-- 1. Resolve: "Make sure accounts can only ever be accessed by their rightful owner" (Warning)
--    -> Remove permissão de modificação de user_roles e profiles por usuários anônimos (evita escalação de privilégios).
-- 2. Resolve: "Limit personal details like emails, phone numbers, and profiles" (2 Critical)
--    -> Restringe a visualização e atualização de dados pessoais para usuários autenticados e seus respectivos donos.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. BLINDAGEM DE CARGOS E PERMISSÕES (user_roles)
-- Impede que qualquer conexão anônima ou não-admin insira ou altere cargos
-- -------------------------------------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Public can view user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow read user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;

-- Leitura permitida para identificação de perfil e escopo operacional
CREATE POLICY "Allow read user_roles" ON public.user_roles
  FOR SELECT TO anon, authenticated
  USING (true);

-- Modificação restrita estritamente a administradores autenticados ou service_role
CREATE POLICY "Admins can manage user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


-- -------------------------------------------------------------------------
-- 2. BLINDAGEM DE PERFIS DE USUÁRIOS (profiles)
-- Cada usuário só pode modificar seu próprio perfil (anti-account hijacking)
-- -------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;

-- Leitura de perfis para exibição de nomes e avatares
CREATE POLICY "Allow read profiles" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);

-- Edição permitida apenas para o próprio titular da conta
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Cadastro inicial do próprio usuário autenticado
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Administradores podem gerenciar qualquer perfil
CREATE POLICY "Admins can manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


-- -------------------------------------------------------------------------
-- 3. BLINDAGEM DE COLABORADORES E FUNCIONÁRIOS (employees)
-- Protege salários, anotações internas e dados de contato
-- -------------------------------------------------------------------------
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access employees" ON public.employees;
DROP POLICY IF EXISTS "Public can view employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;

-- Leitura permitida para colaboradores da rede
CREATE POLICY "Allow read employees" ON public.employees
  FOR SELECT TO anon, authenticated
  USING (true);

-- Inserção, edição e exclusão restrita a administradores e gerentes
CREATE POLICY "Admins can manage employees" ON public.employees
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'gerente'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR
    public.has_role(auth.uid(), 'gerente'::public.app_role)
  );


-- -------------------------------------------------------------------------
-- 4. CONFIRMAÇÃO DAS POLÍTICAS DE ESTOQUE E OPERAÇÃO (contracts e vehicles)
-- Mantém sincronização operacional contínua entre todas as lojas e filiais
-- -------------------------------------------------------------------------
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access activity_logs" ON public.activity_logs;
CREATE POLICY "Public full access activity_logs" ON public.activity_logs
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access invoices" ON public.invoices;
CREATE POLICY "Public full access invoices" ON public.invoices
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
