
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view profiles based on role"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR has_elevated_access(auth.uid())
  );
