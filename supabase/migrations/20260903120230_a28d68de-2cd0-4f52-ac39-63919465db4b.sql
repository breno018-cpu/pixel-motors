CREATE OR REPLACE FUNCTION public.normalize_contract_payment_values()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.down_payment_pix := COALESCE(NEW.down_payment_pix, 0);
  NEW.down_payment_cash := COALESCE(NEW.down_payment_cash, 0);
  NEW.down_payment_card := COALESCE(NEW.down_payment_card, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_contract_payment_values_before_write ON public.contracts;

CREATE TRIGGER normalize_contract_payment_values_before_write
BEFORE INSERT OR UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.normalize_contract_payment_values();