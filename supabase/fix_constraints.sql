UPDATE public.vehicles SET chassis = NULL WHERE chassis ILIKE '%DEFINIR%' OR chassis ILIKE '%DISPENSADO%';
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_chassis_key;
CREATE UNIQUE INDEX IF NOT EXISTS vehicles_chassis_unique_idx ON public.vehicles (chassis) WHERE chassis IS NOT NULL AND chassis != '' AND chassis NOT ILIKE '%DEFINIR%' AND chassis NOT ILIKE '%DISPENSADO%';
ALTER TABLE public.contracts ALTER COLUMN vehicle_id DROP NOT NULL;
