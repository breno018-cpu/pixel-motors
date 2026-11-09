
CREATE TABLE public.chassis_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wmi_code text NOT NULL,
  brand text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'moto',
  model_pattern text,
  model_name text,
  engine_cc integer,
  fuel_type text DEFAULT 'Flex',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chassis_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view patterns"
ON public.chassis_patterns FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage patterns"
ON public.chassis_patterns FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_chassis_patterns_updated_at
BEFORE UPDATE ON public.chassis_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with existing hardcoded patterns
INSERT INTO public.chassis_patterns (wmi_code, brand, vehicle_type, model_pattern, model_name, engine_cc, fuel_type) VALUES
-- Honda motos
('9C2', 'Honda', 'moto', 'KC08', 'CG 160 Titan', 162, 'Flex'),
('9C2', 'Honda', 'moto', 'KC09', 'CG 160 Fan', 162, 'Flex'),
('9C2', 'Honda', 'moto', 'KC10', 'CG 160 Start', 162, 'Flex'),
('9C2', 'Honda', 'moto', 'KC16', 'CG 160 Cargo', 162, 'Flex'),
('9C2', 'Honda', 'moto', 'JC75', 'Biz 125', 124, 'Flex'),
('9C2', 'Honda', 'moto', 'JC81', 'Biz 110i', 109, 'Flex'),
('9C2', 'Honda', 'moto', 'JC67', 'Pop 110i', 109, 'Flex'),
('9C2', 'Honda', 'moto', 'KC13', 'NXR 160 Bros', 162, 'Flex'),
('9C2', 'Honda', 'moto', 'PC44', 'CB 250F Twister', 249, 'Flex'),
('9C2', 'Honda', 'moto', 'PC62', 'CB 300F Twister', 293, 'Flex'),
('9C2', 'Honda', 'moto', 'FC50', 'PCX 160', 156, 'Flex'),
('9C2', 'Honda', 'moto', 'JF60', 'Elite 125', 124, 'Flex'),
('9C2', 'Honda', 'moto', 'MC41', 'CBR 650R', 649, 'Flex'),
('9C2', 'Honda', 'moto', 'SC82', 'CB 1000R', 998, 'Flex'),
('9C2', 'Honda', 'moto', 'NC51', 'XRE 190', 190, 'Flex'),
('9C2', 'Honda', 'moto', 'NC56', 'XRE 300', 291, 'Flex'),
('9C2', 'Honda', 'moto', 'JC73', 'CRF 250F', 250, 'Flex'),
('9C2', 'Honda', 'moto', 'MD44', 'ADV 150', 149, 'Flex'),
('9C2', 'Honda', 'moto', 'NC75', 'Sahara 300', 291, 'Flex'),
-- Yamaha motos
('9C6', 'Yamaha', 'moto', 'BL31', 'Factor 150', 149, 'Flex'),
('9C6', 'Yamaha', 'moto', 'BL30', 'Factor 125', 125, 'Flex'),
('9C6', 'Yamaha', 'moto', 'B3L3', 'Fazer 250', 249, 'Flex'),
('9C6', 'Yamaha', 'moto', 'BR16', 'MT-03', 321, 'Flex'),
('9C6', 'Yamaha', 'moto', 'BS15', 'MT-07', 689, 'Flex'),
('9C6', 'Yamaha', 'moto', 'MTN', 'MT-09', 890, 'Flex'),
('9C6', 'Yamaha', 'moto', 'BN62', 'Crosser 150', 149, 'Flex'),
('9C6', 'Yamaha', 'moto', 'BW51', 'Lander 250', 249, 'Flex'),
('9C6', 'Yamaha', 'moto', 'B4R1', 'NMAX 160', 155, 'Flex'),
('9C6', 'Yamaha', 'moto', 'BR1E', 'R3', 321, 'Flex'),
('9C6', 'Yamaha', 'moto', 'BN93', 'NEO 125', 125, 'Flex'),
-- WMI-only entries (sem modelo específico)
('93H', 'Suzuki', 'moto', NULL, NULL, NULL, 'Flex'),
('953', 'Kawasaki', 'moto', NULL, NULL, NULL, 'Flex'),
('9CD', 'Dafra', 'moto', NULL, NULL, NULL, 'Flex'),
('9F2', 'Shineray', 'moto', NULL, NULL, NULL, 'Flex'),
('93F', 'Haojue', 'moto', NULL, NULL, NULL, 'Flex'),
('JYA', 'Yamaha', 'moto', NULL, NULL, NULL, 'Flex'),
('JH2', 'Honda', 'moto', NULL, NULL, NULL, 'Flex'),
('JS1', 'Suzuki', 'moto', NULL, NULL, NULL, 'Flex'),
('JKA', 'Kawasaki', 'moto', NULL, NULL, NULL, 'Flex'),
('ZDM', 'Ducati', 'moto', NULL, NULL, NULL, 'Flex'),
('WB1', 'BMW', 'moto', NULL, NULL, NULL, 'Flex'),
('SMT', 'Triumph', 'moto', NULL, NULL, NULL, 'Flex'),
('VTH', 'Husqvarna', 'moto', NULL, NULL, NULL, 'Flex'),
-- Carros
('9BW', 'Volkswagen', 'carro', NULL, NULL, NULL, 'Flex'),
('9BD', 'Fiat', 'carro', NULL, NULL, NULL, 'Flex'),
('9BG', 'Chevrolet', 'carro', NULL, NULL, NULL, 'Flex'),
('93Y', 'Renault', 'carro', NULL, NULL, NULL, 'Flex'),
('WBA', 'BMW', 'carro', NULL, NULL, NULL, NULL),
('WDB', 'Mercedes-Benz', 'carro', NULL, NULL, NULL, NULL),
('WAU', 'Audi', 'carro', NULL, NULL, NULL, NULL),
('5YJ', 'Tesla', 'carro', NULL, NULL, NULL, 'Elétrico');
