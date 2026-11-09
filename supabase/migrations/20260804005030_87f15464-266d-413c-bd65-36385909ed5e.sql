ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_status_check CHECK (status IN ('disponivel','reservado','vendido','transferido'));

CREATE TABLE public.stock_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  transfer_type TEXT NOT NULL DEFAULT 'loja_para_revendedor' CHECK (transfer_type IN ('loja_para_loja','loja_para_revendedor','revendedor_para_loja','parceiro_externo')),
  from_store_id UUID REFERENCES public.stores(id),
  to_store_id UUID REFERENCES public.stores(id),
  from_reseller_id UUID REFERENCES public.resellers(id),
  to_reseller_id UUID REFERENCES public.resellers(id),
  partner_name TEXT,
  agreed_amount NUMERIC NOT NULL DEFAULT 0,
  received_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida','cancelada')),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated users manage transfers"
ON public.stock_transfers FOR ALL TO authenticated
USING (public.has_elevated_access(auth.uid()))
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Users view transfers of their store"
ON public.stock_transfers FOR SELECT TO authenticated
USING (
  from_store_id = public.get_user_store_id(auth.uid())
  OR to_store_id = public.get_user_store_id(auth.uid())
);

CREATE TRIGGER update_stock_transfers_updated_at
BEFORE UPDATE ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.apply_stock_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    IF NEW.transfer_type = 'parceiro_externo' THEN
      UPDATE public.vehicles SET status = 'transferido' WHERE id = NEW.vehicle_id;
    ELSE
      UPDATE public.vehicles
      SET store_id = COALESCE(NEW.to_store_id, store_id),
          reseller_id = CASE WHEN NEW.transfer_type = 'revendedor_para_loja' THEN NULL ELSE COALESCE(NEW.to_reseller_id, reseller_id) END
      WHERE id = NEW.vehicle_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_stock_transfer_ins
AFTER INSERT ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_transfer();

CREATE TRIGGER trg_apply_stock_transfer_upd
AFTER UPDATE ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_transfer();