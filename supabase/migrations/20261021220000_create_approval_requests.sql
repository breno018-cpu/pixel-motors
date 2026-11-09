-- Criação da tabela de solicitações de aprovação de alçada comercial e margem
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_name TEXT NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  store_name TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  vehicle_label TEXT NOT NULL,
  original_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  requested_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  purchase_price NUMERIC(12,2),
  projected_profit NUMERIC(12,2),
  margin_percent NUMERIC(5,2),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'expirado')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_seller ON public.approval_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_vehicle ON public.approval_requests(vehicle_id);

-- Habilitar RLS
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS:
-- 1. Qualquer usuário autenticado pode criar solicitações
CREATE POLICY "Qualquer autenticado pode solicitar aprovação"
  ON public.approval_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. Visualização: Vendedor vê as próprias, gerentes e admins veem todas
CREATE POLICY "Visualização de aprovações por perfil"
  ON public.approval_requests
  FOR SELECT
  TO authenticated
  USING (
    seller_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'gerente')
    )
  );

-- 3. Atualização: Gerentes e admins podem aprovar/rejeitar
CREATE POLICY "Gestão de aprovações por gerentes e admins"
  ON public.approval_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'gerente')
    )
  );
