-- Restrict seller visibility on contracts to only their own sales while preserving admin/manager/revendedor access
DROP POLICY IF EXISTS "View contracts based on role" ON public.contracts;

CREATE POLICY "View contracts based on role"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  public.has_elevated_access(auth.uid())
  OR created_by = auth.uid()
  OR reseller_id IN (
    SELECT r.id
    FROM public.resellers r
    WHERE r.user_id = auth.uid()
  )
);

-- Allow sellers to update only contracts they created; admins/managers retain broader access
DROP POLICY IF EXISTS "Admins can manage contracts" ON public.contracts;

CREATE POLICY "Admins and sellers can update contracts"
ON public.contracts
FOR UPDATE
TO authenticated
USING (
  public.has_elevated_access(auth.uid())
  OR created_by = auth.uid()
)
WITH CHECK (
  public.has_elevated_access(auth.uid())
  OR created_by = auth.uid()
);

-- Allow sellers to create contracts directly as operator while preserving reseller flow
DROP POLICY IF EXISTS "Create contracts" ON public.contracts;

CREATE POLICY "Create contracts"
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_elevated_access(auth.uid())
  OR created_by = auth.uid()
  OR reseller_id IN (
    SELECT r.id
    FROM public.resellers r
    WHERE r.user_id = auth.uid()
  )
);