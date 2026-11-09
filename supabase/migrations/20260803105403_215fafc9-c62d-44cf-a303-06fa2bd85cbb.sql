CREATE TABLE public.eula_acceptances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version text NOT NULL,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_ip text,
  user_agent text,
  full_name_typed text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
);

GRANT SELECT, INSERT ON public.eula_acceptances TO authenticated;
GRANT ALL ON public.eula_acceptances TO service_role;

ALTER TABLE public.eula_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eula_select_own" ON public.eula_acceptances
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "eula_insert_own" ON public.eula_acceptances
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());