-- Controle completo de Revendedores: Estoque, Pagamento do Estoque, Financiamentos e Pagamentos Enviados
BEGIN;

CREATE TABLE IF NOT EXISTS public.reseller_stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  vehicle_model text NOT NULL,
  chassis text,
  year integer,
  color text,
  total_value numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pendente' CHECK (payment_status IN ('pendente', 'parcial', 'pago')),
  stock_status text NOT NULL DEFAULT 'em_estoque' CHECK (stock_status IN ('em_estoque', 'vendido', 'devolvido')),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reseller_financings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE RESTRICT,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  stock_item_id uuid REFERENCES public.reseller_stock_items(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  vehicle_model text NOT NULL,
  chassis text,
  bank_name text NOT NULL,
  financed_amount numeric(12,2) NOT NULL DEFAULT 0,
  down_payment numeric(12,2) NOT NULL DEFAULT 0,
  installments integer DEFAULT 48,
  status text NOT NULL DEFAULT 'em_analise' CHECK (status IN ('em_analise', 'aprovado', 'liberado', 'quitado', 'recusado')),
  financing_date date NOT NULL DEFAULT CURRENT_DATE,
  release_date date,
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reseller_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE RESTRICT,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  stock_item_id uuid REFERENCES public.reseller_stock_items(id) ON DELETE SET NULL,
  financing_id uuid REFERENCES public.reseller_financings(id) ON DELETE SET NULL,
  payment_type text NOT NULL DEFAULT 'pagamento_estoque' CHECK (payment_type IN ('pagamento_estoque', 'repasse_financiamento', 'comissao', 'adiantamento', 'outro')),
  payment_method text NOT NULL DEFAULT 'pix' CHECK (payment_method IN ('pix', 'transferencia', 'dinheiro', 'boleto', 'cartao', 'outro')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_code text,
  description text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_stock_items_reseller ON public.reseller_stock_items(reseller_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_reseller_financings_reseller ON public.reseller_financings(reseller_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_reseller_payments_reseller ON public.reseller_payments(reseller_id) WHERE is_deleted = false;

ALTER TABLE public.reseller_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_financings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_payments ENABLE ROW LEVEL SECURITY;

-- Policies (authenticated + has_elevated_access covers admin, gerente, dono_loja)
DROP POLICY IF EXISTS reseller_stock_items_elevated_all ON public.reseller_stock_items;
CREATE POLICY reseller_stock_items_elevated_all ON public.reseller_stock_items
  FOR ALL TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

DROP POLICY IF EXISTS reseller_financings_elevated_all ON public.reseller_financings;
CREATE POLICY reseller_financings_elevated_all ON public.reseller_financings
  FOR ALL TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

DROP POLICY IF EXISTS reseller_payments_elevated_all ON public.reseller_payments;
CREATE POLICY reseller_payments_elevated_all ON public.reseller_payments
  FOR ALL TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

-- Ensure elevated users (including dono_loja) can also manage resellers
DROP POLICY IF EXISTS resellers_elevated_manage ON public.resellers;
CREATE POLICY resellers_elevated_manage ON public.resellers
  FOR ALL TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

COMMIT;
