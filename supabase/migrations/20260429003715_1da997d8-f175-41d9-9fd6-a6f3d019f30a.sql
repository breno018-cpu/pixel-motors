-- Add 'reserva' to contract template types
ALTER TYPE public.contract_template_type ADD VALUE IF NOT EXISTS 'reserva';

-- Create vehicle_reservations table
CREATE TABLE public.vehicle_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_number TEXT NOT NULL UNIQUE,
  vehicle_id UUID NOT NULL,
  store_id UUID NOT NULL,
  reseller_id UUID,
  created_by UUID,
  buyer_name TEXT NOT NULL,
  buyer_cpf TEXT NOT NULL,
  buyer_phone TEXT,
  buyer_email TEXT,
  buyer_address TEXT,
  vehicle_price NUMERIC NOT NULL,
  reservation_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  reservation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at DATE,
  status TEXT NOT NULL DEFAULT 'ativa', -- ativa | convertida | cancelada | expirada
  converted_contract_id UUID,
  signed_contract_url TEXT,
  template_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View reservations based on role"
ON public.vehicle_reservations FOR SELECT
TO authenticated
USING (
  has_elevated_access(auth.uid())
  OR created_by = auth.uid()
  OR reseller_id IN (SELECT r.id FROM resellers r WHERE r.user_id = auth.uid())
);

CREATE POLICY "Create reservations"
ON public.vehicle_reservations FOR INSERT
TO authenticated
WITH CHECK (
  has_elevated_access(auth.uid())
  OR created_by = auth.uid()
  OR reseller_id IN (SELECT r.id FROM resellers r WHERE r.user_id = auth.uid())
);

CREATE POLICY "Update reservations based on role"
ON public.vehicle_reservations FOR UPDATE
TO authenticated
USING (has_elevated_access(auth.uid()) OR created_by = auth.uid())
WITH CHECK (has_elevated_access(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Admins can delete reservations"
ON public.vehicle_reservations FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_vehicle_reservations_updated_at
BEFORE UPDATE ON public.vehicle_reservations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Drop the payments table (replaced by reservations)
DROP TABLE IF EXISTS public.payments CASCADE;