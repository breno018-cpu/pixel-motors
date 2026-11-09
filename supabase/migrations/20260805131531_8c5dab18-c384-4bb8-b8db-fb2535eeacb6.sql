ALTER TABLE public.resellers DROP CONSTRAINT IF EXISTS resellers_partner_type_check;
ALTER TABLE public.resellers
  ADD CONSTRAINT resellers_partner_type_check
  CHECK (partner_type IN ('parceiro_externo','consignado','interno'));