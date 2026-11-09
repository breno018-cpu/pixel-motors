
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_reservations TO authenticated;
GRANT ALL ON public.vehicle_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.sync_vehicle_status_from_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.vehicles SET status = 'reservado' WHERE id = NEW.vehicle_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelada' AND OLD.status <> 'cancelada' THEN
      UPDATE public.vehicles SET status = 'disponivel' WHERE id = NEW.vehicle_id;
    ELSIF NEW.status = 'convertida' AND OLD.status <> 'convertida' THEN
      UPDATE public.vehicles SET status = 'vendido' WHERE id = NEW.vehicle_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_vehicle_status_from_reservation_ins ON public.vehicle_reservations;
DROP TRIGGER IF EXISTS trg_sync_vehicle_status_from_reservation_upd ON public.vehicle_reservations;

CREATE TRIGGER trg_sync_vehicle_status_from_reservation_ins
AFTER INSERT ON public.vehicle_reservations
FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_status_from_reservation();

CREATE TRIGGER trg_sync_vehicle_status_from_reservation_upd
AFTER UPDATE ON public.vehicle_reservations
FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_status_from_reservation();
