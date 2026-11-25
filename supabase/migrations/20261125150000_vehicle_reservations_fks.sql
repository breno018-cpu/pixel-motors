-- Permite embeds PostgREST (vehicle:vehicles, store:stores, reseller:resellers)
-- na aba "Reservas Ativas" do Estoque (antes retornava HTTP 400 por falta de FKs).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_reservations_vehicle_id_fkey') THEN
    ALTER TABLE public.vehicle_reservations
      ADD CONSTRAINT vehicle_reservations_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_reservations_store_id_fkey') THEN
    ALTER TABLE public.vehicle_reservations
      ADD CONSTRAINT vehicle_reservations_store_id_fkey
      FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_reservations_reseller_id_fkey') THEN
    ALTER TABLE public.vehicle_reservations
      ADD CONSTRAINT vehicle_reservations_reseller_id_fkey
      FOREIGN KEY (reseller_id) REFERENCES public.resellers(id) ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
