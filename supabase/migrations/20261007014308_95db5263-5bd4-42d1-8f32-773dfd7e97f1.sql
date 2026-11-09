CREATE OR REPLACE FUNCTION public.can_register_vehicles(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.has_elevated_access(_user_id) OR public.has_permission(_user_id,'vehicles.create') OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND custom_role_id IS NULL
      AND role::text IN ('vendedor','vendedor_plus','vendedor_externo'))
$function$;