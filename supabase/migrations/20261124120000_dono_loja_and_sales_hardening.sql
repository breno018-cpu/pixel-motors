-- Add dono_loja (Dono do Grupo - todas as lojas) to app_role enum and harden sales RLS functions
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dono_loja';

-- Update has_elevated_access to include dono_loja (all-store visibility via RLS)
CREATE OR REPLACE FUNCTION public.has_elevated_access(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id,'admin')
    OR public.has_permission(_user_id,'access.elevated')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='gerente' AND custom_role_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='dono_loja' AND custom_role_id IS NULL)
$function$;

-- Update can_create_sales to include dono_loja and active employees fallback
CREATE OR REPLACE FUNCTION public.can_create_sales(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_elevated_access(_user_id)
    OR public.has_permission(_user_id, 'sales.create')
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND custom_role_id IS NULL
        AND role::text IN ('admin', 'gerente', 'dono_loja', 'vendedor', 'vendedor_plus', 'vendedor_externo')
    )
    OR EXISTS (
      SELECT 1 FROM public.employees
      WHERE profile_id = _user_id
        AND is_active = true
    )
$function$;

-- Update can_register_vehicles to include dono_loja and active employees fallback
CREATE OR REPLACE FUNCTION public.can_register_vehicles(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_elevated_access(_user_id)
    OR public.has_permission(_user_id, 'vehicles.create')
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND custom_role_id IS NULL
        AND role::text IN ('admin', 'gerente', 'dono_loja', 'vendedor', 'vendedor_plus', 'vendedor_externo')
    )
    OR EXISTS (
      SELECT 1 FROM public.employees
      WHERE profile_id = _user_id
        AND is_active = true
    )
$function$;

-- Contracts RLS: allow Montes Claros sellers to also operate on Multimarcas Montes Claros + created_by = auth.uid()
DROP POLICY IF EXISTS contracts_insert ON public.contracts;
CREATE POLICY contracts_insert ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    (contract_number = 'DEALFLOW_GLOBAL_SYNC'::text AND (public.can_create_sales(auth.uid()) OR public.has_elevated_access(auth.uid())))
    OR (
      public.can_create_sales(auth.uid()) AND (
        public.has_elevated_access(auth.uid())
        OR store_id = public.get_user_store_id(auth.uid())
        OR public.get_user_store_id(auth.uid()) IS NULL
        OR (
          public.get_user_store_id(auth.uid()) = 'e8254a81-d669-464b-9806-457ba25ce7f0'::uuid
          AND store_id = '6b3afc94-86b2-41b0-9427-6f58ae8dbf21'::uuid
        )
        OR created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS contracts_select ON public.contracts;
CREATE POLICY contracts_select ON public.contracts
  FOR SELECT TO authenticated
  USING (
    contract_number = 'DEALFLOW_GLOBAL_SYNC'::text
    OR public.has_elevated_access(auth.uid())
    OR store_id = public.get_user_store_id(auth.uid())
    OR (
      public.get_user_store_id(auth.uid()) = 'e8254a81-d669-464b-9806-457ba25ce7f0'::uuid
      AND store_id = '6b3afc94-86b2-41b0-9427-6f58ae8dbf21'::uuid
    )
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS contracts_update ON public.contracts;
CREATE POLICY contracts_update ON public.contracts
  FOR UPDATE TO authenticated
  USING (
    (contract_number = 'DEALFLOW_GLOBAL_SYNC'::text AND (public.can_create_sales(auth.uid()) OR public.has_elevated_access(auth.uid())))
    OR public.has_elevated_access(auth.uid())
    OR store_id = public.get_user_store_id(auth.uid())
    OR (
      public.get_user_store_id(auth.uid()) = 'e8254a81-d669-464b-9806-457ba25ce7f0'::uuid
      AND store_id = '6b3afc94-86b2-41b0-9427-6f58ae8dbf21'::uuid
    )
    OR created_by = auth.uid()
  )
  WITH CHECK (
    (contract_number = 'DEALFLOW_GLOBAL_SYNC'::text AND (public.can_create_sales(auth.uid()) OR public.has_elevated_access(auth.uid())))
    OR public.has_elevated_access(auth.uid())
    OR store_id = public.get_user_store_id(auth.uid())
    OR (
      public.get_user_store_id(auth.uid()) = 'e8254a81-d669-464b-9806-457ba25ce7f0'::uuid
      AND store_id = '6b3afc94-86b2-41b0-9427-6f58ae8dbf21'::uuid
    )
    OR created_by = auth.uid()
  );
