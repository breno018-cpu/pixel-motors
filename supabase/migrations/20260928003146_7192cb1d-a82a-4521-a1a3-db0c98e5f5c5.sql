CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT 'neutral',
  data_scope text NOT NULL DEFAULT 'own' CHECK (data_scope IN ('own','store','all')),
  system_key text UNIQUE,
  base_role app_role NOT NULL DEFAULT 'visualizador',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_roles TO authenticated;
GRANT ALL ON public.custom_roles TO service_role;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read roles" ON public.custom_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.custom_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER custom_roles_updated_at BEFORE UPDATE ON public.custom_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read perms" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage perms" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- Seed system roles
INSERT INTO public.custom_roles (name, description, color, data_scope, system_key, base_role) VALUES
 ('Gerente','Gestão completa da loja','primary','all','gerente','gerente'),
 ('Vendedor','Vende o estoque da loja','neutral','own','vendedor','vendedor'),
 ('Vendedor +','Vende e cadastra veículos','primary','own','vendedor_plus','vendedor_plus'),
 ('Vendedor ++','Vendas internas e externas','warning','own','vendedor_externo','vendedor_externo'),
 ('Revendedor','Parceiro externo com estoque próprio','warning','own','revendedor','revendedor'),
 ('Visualizador','Apenas consulta','neutral','store','visualizador','visualizador');

INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, p FROM public.custom_roles r, unnest(CASE r.system_key
  WHEN 'gerente' THEN ARRAY['page.dashboard','page.vehicles','page.sales','page.external_sales','page.financing','page.contracts','page.consignments','page.moto_invoices','page.organization','page.payroll','page.ads','page.reports','page.settings','sales.create','sales.edit','sales.delete','vehicles.create','vehicles.edit','vehicles.delete','vehicles.unlock_all','finance.view_margins','data.export','contracts.manage','payroll.manage','access.elevated']
  WHEN 'vendedor' THEN ARRAY['page.dashboard','page.vehicles','page.sales','page.financing','page.settings','sales.create']
  WHEN 'vendedor_plus' THEN ARRAY['page.dashboard','page.vehicles','page.sales','page.financing','page.settings','sales.create','vehicles.create']
  WHEN 'vendedor_externo' THEN ARRAY['page.dashboard','page.vehicles','page.sales','page.external_sales','page.financing','page.settings','sales.create','vehicles.create','vehicles.unlock_year']
  WHEN 'revendedor' THEN ARRAY['page.dashboard','page.vehicles','page.settings']
  ELSE ARRAY['page.dashboard','page.vehicles','page.settings'] END) AS p;

UPDATE public.user_roles ur SET custom_role_id = cr.id
FROM public.custom_roles cr WHERE cr.system_key = ur.role::text AND ur.custom_role_id IS NULL;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.custom_roles cr ON cr.id = ur.custom_role_id AND cr.is_active
    JOIN public.role_permissions rp ON rp.role_id = cr.id
    WHERE ur.user_id = _user_id AND rp.permission = _perm)
$$;

CREATE OR REPLACE FUNCTION public.user_data_scope(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.has_role(_user_id,'admin') THEN 'all' ELSE COALESCE((
    SELECT CASE MAX(CASE cr.data_scope WHEN 'all' THEN 3 WHEN 'store' THEN 2 ELSE 1 END)
      WHEN 3 THEN 'all' WHEN 2 THEN 'store' ELSE 'own' END
    FROM public.user_roles ur JOIN public.custom_roles cr ON cr.id = ur.custom_role_id AND cr.is_active
    WHERE ur.user_id = _user_id), 'own') END
$$;

CREATE OR REPLACE FUNCTION public.has_elevated_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR public.has_permission(_user_id,'access.elevated')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='gerente' AND custom_role_id IS NULL)
$$;

CREATE OR REPLACE FUNCTION public.can_create_sales(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(_user_id,'sales.create') OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND custom_role_id IS NULL
      AND role::text IN ('admin','gerente','vendedor','vendedor_plus','vendedor_externo'))
$$;

CREATE OR REPLACE FUNCTION public.can_register_vehicles(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_elevated_access(_user_id) OR public.has_permission(_user_id,'vehicles.create') OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND custom_role_id IS NULL
      AND role::text IN ('vendedor_plus','vendedor_externo'))
$$;

CREATE POLICY "View contracts by role scope" ON public.contracts FOR SELECT TO authenticated
USING (public.user_data_scope(auth.uid()) = 'all'
  OR (public.user_data_scope(auth.uid()) = 'store' AND store_id = public.get_user_store_id(auth.uid())));