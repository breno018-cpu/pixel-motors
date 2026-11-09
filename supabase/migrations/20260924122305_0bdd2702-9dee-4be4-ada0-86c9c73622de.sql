CREATE OR REPLACE FUNCTION public.can_register_vehicles(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_elevated_access(_user_id) OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('vendedor_plus', 'vendedor_externo')
  )
$$;