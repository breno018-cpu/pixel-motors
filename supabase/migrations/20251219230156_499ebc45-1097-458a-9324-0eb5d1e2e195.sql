-- Adicionar campo vehicle_type na tabela vehicles
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'carro' CHECK (vehicle_type IN ('carro', 'moto'));

-- Adicionar campo engine_cc (cilindrada) para motos
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS engine_cc INTEGER;