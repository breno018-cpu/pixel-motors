-- Ensure sellers can see inventory from their store and only their own sales, while sales require manager/admin approval to finalize
DROP POLICY IF EXISTS "View vehicles based on role" ON public.vehicles;

CREATE POLICY "View vehicles based on role"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  public.has_elevated_access(auth.uid())
  OR store_id = public.get_user_store_id(auth.uid())
  OR reseller_id IN (
    SELECT r.id
    FROM public.resellers r
    WHERE r.user_id = auth.uid()
  )
);

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

DROP POLICY IF EXISTS "Admins and sellers can update contracts" ON public.contracts;

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