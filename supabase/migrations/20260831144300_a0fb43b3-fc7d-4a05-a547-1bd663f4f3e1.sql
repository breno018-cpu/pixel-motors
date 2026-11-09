ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor_plus';

CREATE OR REPLACE FUNCTION public.can_register_vehicles(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_elevated_access(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'vendedor_plus'
  )
$$;

CREATE POLICY "Vendedor plus can register vehicles"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_register_vehicles(auth.uid())
  AND (
    public.has_elevated_access(auth.uid())
    OR store_id = public.get_user_store_id(auth.uid())
  )
);