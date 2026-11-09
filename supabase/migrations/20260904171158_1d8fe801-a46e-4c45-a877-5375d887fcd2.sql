CREATE OR REPLACE FUNCTION public.can_create_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin','gerente','vendedor','vendedor_plus')
  )
$$;

CREATE POLICY "Sales roles can update vehicles of their store"
ON public.vehicles
FOR UPDATE
TO authenticated
USING (
  public.can_create_sales(auth.uid())
  AND (public.has_elevated_access(auth.uid()) OR store_id = public.get_user_store_id(auth.uid()))
)
WITH CHECK (
  public.can_create_sales(auth.uid())
  AND (public.has_elevated_access(auth.uid()) OR store_id = public.get_user_store_id(auth.uid()))
);