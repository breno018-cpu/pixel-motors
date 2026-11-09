INSERT INTO public.role_permissions (role_id, permission)
SELECT id, p FROM public.custom_roles, unnest(ARRAY['sales.edit','sales.delete']) p
WHERE system_key = 'vendedor_plus'
ON CONFLICT (role_id, permission) DO NOTHING;

DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;
CREATE POLICY "Admins or permitted owners can delete contracts" ON public.contracts
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin')
  OR (created_by = auth.uid() AND (public.has_permission(auth.uid(),'sales.delete')
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND custom_role_id IS NULL AND role::text = 'vendedor_plus'))));