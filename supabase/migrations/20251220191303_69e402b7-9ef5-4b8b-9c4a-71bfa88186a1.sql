-- Allow admins to delete contracts
CREATE POLICY "Admins can delete contracts"
ON public.contracts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));