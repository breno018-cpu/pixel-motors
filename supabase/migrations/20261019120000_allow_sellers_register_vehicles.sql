-- Liberar cadastro de veículos para todos os vendedores (vendedor, vendedor_plus, vendedor_externo)

-- 1. Garantir permissão 'vehicles.create' nos cargos de sistema de vendedores
INSERT INTO public.role_permissions (role_id, permission)
SELECT id, 'vehicles.create'
FROM public.custom_roles
WHERE system_key IN ('vendedor', 'vendedor_plus', 'vendedor_externo')
ON CONFLICT (role_id, permission) DO NOTHING;

-- 2. Atualizar função can_register_vehicles para considerar todos os cargos de vendedor (com ou sem custom_role_id)
CREATE OR REPLACE FUNCTION public.can_register_vehicles(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_elevated_access(_user_id)
    OR public.has_permission(_user_id, 'vehicles.create')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text IN ('admin', 'gerente', 'vendedor', 'vendedor_plus', 'vendedor_externo')
    )
$function$;

-- 3. Atualizar política de INSERT em public.vehicles para permitir cadastro por vendedores mesmo se get_user_store_id for nulo
DROP POLICY IF EXISTS "Vendedor plus can register vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Sellers can register vehicles" ON public.vehicles;

CREATE POLICY "Sellers can register vehicles"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_register_vehicles(auth.uid())
  AND (
    public.has_elevated_access(auth.uid())
    OR public.get_user_store_id(auth.uid()) IS NULL
    OR store_id = public.get_user_store_id(auth.uid())
  )
);
