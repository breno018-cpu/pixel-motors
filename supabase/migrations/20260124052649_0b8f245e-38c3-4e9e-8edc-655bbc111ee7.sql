-- Tabela para contratos de consignação com revendedores
CREATE TABLE public.reseller_consignment_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  
  -- Valores do contrato
  vehicle_cost NUMERIC NOT NULL, -- Valor que o revendedor paga (diferente do valor de venda ao público)
  payment_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' ou 'full'
  
  -- Para pagamento por porcentagem
  upfront_percentage NUMERIC DEFAULT 0, -- % pago antecipadamente
  upfront_amount NUMERIC DEFAULT 0, -- Valor calculado do upfront
  remaining_percentage NUMERIC DEFAULT 0, -- % pago após venda
  remaining_amount NUMERIC DEFAULT 0, -- Valor calculado do restante
  
  -- Para pagamento 100%
  full_payment_amount NUMERIC DEFAULT 0,
  
  -- Controle de pagamentos
  upfront_paid BOOLEAN DEFAULT false,
  upfront_paid_at TIMESTAMPTZ,
  remaining_paid BOOLEAN DEFAULT false,
  remaining_paid_at TIMESTAMPTZ,
  
  -- Status do contrato
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo, quitado, cancelado
  
  -- Termos e observações
  terms TEXT,
  notes TEXT,
  
  -- Auditoria
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reseller_consignment_contracts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Elevated users can manage consignment contracts"
ON public.reseller_consignment_contracts
FOR ALL
USING (has_elevated_access(auth.uid()))
WITH CHECK (has_elevated_access(auth.uid()));

CREATE POLICY "View consignment contracts based on role"
ON public.reseller_consignment_contracts
FOR SELECT
USING (
  has_elevated_access(auth.uid()) OR
  reseller_id IN (SELECT id FROM resellers WHERE user_id = auth.uid()) OR
  store_id = get_user_store_id(auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_reseller_consignment_contracts_updated_at
BEFORE UPDATE ON public.reseller_consignment_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar coluna para identificar se usuário precisa trocar senha
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;