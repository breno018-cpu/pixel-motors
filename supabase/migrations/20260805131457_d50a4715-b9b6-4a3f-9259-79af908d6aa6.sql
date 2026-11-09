-- 1. Resellers = parceiros externos apenas
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS partner_type text NOT NULL DEFAULT 'parceiro_externo';

DO $$ BEGIN
  ALTER TABLE public.resellers
    ADD CONSTRAINT resellers_partner_type_check
    CHECK (partner_type IN ('parceiro_externo','consignado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Employees = fonte oficial do vinculo interno (vendedores/gerentes)
CREATE UNIQUE INDEX IF NOT EXISTS employees_profile_id_unique
  ON public.employees(profile_id) WHERE profile_id IS NOT NULL;

-- 3. Vinculo de loja: funcionario primeiro, parceiro depois
CREATE OR REPLACE FUNCTION public.get_user_store_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT store_id FROM public.employees
      WHERE profile_id = _user_id AND is_active AND store_id IS NOT NULL LIMIT 1),
    (SELECT store_id FROM public.resellers
      WHERE user_id = _user_id AND store_id IS NOT NULL LIMIT 1)
  )
$function$;

-- 4. Hub: chaves de API para apps externos
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['read']::text[],
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage api keys" ON public.api_keys;
CREATE POLICY "Admins manage api keys" ON public.api_keys
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS api_keys_updated_at ON public.api_keys;
CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Configuracoes da folha de pagamento
CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_day smallint NOT NULL DEFAULT 30,
  reminder_days_before smallint NOT NULL DEFAULT 5,
  auto_reminder_enabled boolean NOT NULL DEFAULT true,
  default_dependents smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_settings TO authenticated;
GRANT ALL ON public.payroll_settings TO service_role;
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Elevated manage payroll settings" ON public.payroll_settings;
CREATE POLICY "Elevated manage payroll settings" ON public.payroll_settings
  FOR ALL TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

DROP TRIGGER IF EXISTS payroll_settings_updated_at ON public.payroll_settings;
CREATE TRIGGER payroll_settings_updated_at BEFORE UPDATE ON public.payroll_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();