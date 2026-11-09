
-- Expand contract_templates with categories for optional clauses grouping
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS clause_categories text[] NOT NULL DEFAULT ARRAY['Fiscal','Garantia','Financeiro','Documentação','Outros']::text[];

-- Expand contracts to track clause variables and current revision number
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS clause_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS revision_number int NOT NULL DEFAULT 1;

-- Revisions history
CREATE TABLE IF NOT EXISTS public.contract_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  revision_number int NOT NULL,
  active_clause_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  clause_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_reason text,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id, revision_number)
);

GRANT SELECT, INSERT ON public.contract_revisions TO authenticated;
GRANT ALL ON public.contract_revisions TO service_role;

ALTER TABLE public.contract_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View revisions of accessible contracts"
  ON public.contract_revisions FOR SELECT
  TO authenticated
  USING (
    contract_id IN (
      SELECT id FROM public.contracts c
      WHERE public.has_elevated_access(auth.uid())
         OR c.created_by = auth.uid()
         OR c.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid())
    )
  );

CREATE POLICY "Create revisions for own contracts"
  ON public.contract_revisions FOR INSERT
  TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND contract_id IN (
      SELECT id FROM public.contracts c
      WHERE public.has_elevated_access(auth.uid()) OR c.created_by = auth.uid()
    )
  );

-- Digital acceptances
CREATE TABLE IF NOT EXISTS public.contract_acceptances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  acceptance_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  revision_number int NOT NULL DEFAULT 1,
  accepted_at timestamptz,
  accepted_ip text,
  accepted_user_agent text,
  buyer_name_typed text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS contract_acceptances_contract_id_idx ON public.contract_acceptances(contract_id);

GRANT SELECT, INSERT ON public.contract_acceptances TO authenticated;
GRANT ALL ON public.contract_acceptances TO service_role;

ALTER TABLE public.contract_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View acceptances of accessible contracts"
  ON public.contract_acceptances FOR SELECT
  TO authenticated
  USING (
    contract_id IN (
      SELECT id FROM public.contracts c
      WHERE public.has_elevated_access(auth.uid())
         OR c.created_by = auth.uid()
         OR c.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid())
    )
  );

CREATE POLICY "Create acceptance tokens for own contracts"
  ON public.contract_acceptances FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND contract_id IN (
      SELECT id FROM public.contracts c
      WHERE public.has_elevated_access(auth.uid()) OR c.created_by = auth.uid()
    )
  );
