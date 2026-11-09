ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor_externo';

CREATE OR REPLACE FUNCTION public.can_create_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin','gerente','vendedor','vendedor_plus','vendedor_externo')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_external_seller(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'vendedor_externo'
  )
$$;