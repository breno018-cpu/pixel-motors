-- Adicionar coluna reseller_id na tabela vehicles para vinculação com revendedores
ALTER TABLE public.vehicles 
ADD COLUMN reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL;

-- Criar índice para melhor performance nas buscas
CREATE INDEX idx_vehicles_reseller_id ON public.vehicles(reseller_id);

-- Comentário explicativo
COMMENT ON COLUMN public.vehicles.reseller_id IS 'ID do revendedor responsável pelo veículo (null = estoque da loja)';