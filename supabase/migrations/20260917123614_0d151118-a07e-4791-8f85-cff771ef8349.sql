ALTER TABLE public.vehicle_colors ADD COLUMN IF NOT EXISTS hex_secondary text;
ALTER TABLE public.chassis_year_codes ADD COLUMN IF NOT EXISTS manufacture_year integer;