-- Create enum for contract template types
CREATE TYPE public.contract_template_type AS ENUM ('venda_carro', 'venda_moto', 'repasse', 'generico');

-- Create table for contract templates/models
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_type contract_template_type NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Content blocks
  header_content TEXT,
  body_content TEXT NOT NULL,
  clauses_content TEXT,
  signature_content TEXT,
  
  -- Fixed clauses that cannot be removed
  fixed_clauses TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Store reference (null = available to all stores)
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  
  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique name per type
  UNIQUE(name, template_type)
);

-- Enable RLS
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active templates"
ON public.contract_templates
FOR SELECT
TO authenticated
USING (is_active = true OR public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated users can create templates"
ON public.contract_templates
FOR INSERT
TO authenticated
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated users can update templates"
ON public.contract_templates
FOR UPDATE
TO authenticated
USING (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated users can delete templates"
ON public.contract_templates
FOR DELETE
TO authenticated
USING (public.has_elevated_access(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add signed_contract_url column to contracts table for uploaded signed contracts
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS signed_contract_url TEXT,
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.contract_templates(id),
ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'venda';

-- Create storage bucket for signed contracts
INSERT INTO storage.buckets (id, name, public)
VALUES ('signed-contracts', 'signed-contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for signed contracts
CREATE POLICY "Authenticated users can upload signed contracts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'signed-contracts');

CREATE POLICY "Authenticated users can view signed contracts"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'signed-contracts');

-- Insert default contract templates
INSERT INTO public.contract_templates (name, template_type, is_active, header_content, body_content, clauses_content, signature_content, fixed_clauses) VALUES
(
  'Contrato de Venda - Carro',
  'venda_carro',
  true,
  'CONTRATO PARTICULAR DE COMPRA E VENDA DE VEÍCULO AUTOMOTOR',
  E'Pelo presente instrumento particular, de um lado {{LOJA_RAZAO_SOCIAL}}, inscrita no CNPJ sob nº {{LOJA_CNPJ}}, com sede em {{LOJA_ENDERECO}}, doravante denominada VENDEDORA, e de outro lado {{CLIENTE_NOME}}, portador(a) do CPF nº {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, e-mail {{CLIENTE_EMAIL}}, doravante denominado(a) COMPRADOR(A), têm entre si justo e contratado a compra e venda do veículo abaixo descrito:\n\nVEÍCULO: {{VEICULO_MARCA}} {{VEICULO_MODELO}}\nANO: {{VEICULO_ANO}}\nCOR: {{VEICULO_COR}}\nCHASSI: {{VEICULO_CHASSI}}\nPLACA: {{VEICULO_PLACA}}\nRENAVAM: {{VEICULO_RENAVAM}}\n\nVALOR DA VENDA: {{VALOR_TOTAL}}\nENTRADA: {{VALOR_ENTRADA}}\nFORMA DE PAGAMENTO: {{FORMA_PAGAMENTO}}\nPARCELAS: {{PARCELAS}}',
  E'CLÁUSULA PRIMEIRA: A VENDEDORA vende e transfere ao COMPRADOR o veículo acima descrito, livre e desembaraçado de quaisquer ônus.\n\nCLÁUSULA SEGUNDA: O COMPRADOR declara ter examinado o veículo e estar de acordo com seu estado de conservação.\n\nCLÁUSULA TERCEIRA: A transferência de propriedade será realizada após a quitação total do valor acordado.\n\nCLÁUSULA QUARTA: As partes elegem o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer dúvidas oriundas deste contrato.',
  E'{{LOJA_CIDADE}}, {{DATA_CONTRATO}}\n\n\n_______________________________\nVENDEDORA: {{LOJA_RAZAO_SOCIAL}}\n\n\n_______________________________\nCOMPRADOR(A): {{CLIENTE_NOME}}\nCPF: {{CLIENTE_CPF}}',
  ARRAY[]::TEXT[]
),
(
  'Contrato de Venda - Moto',
  'venda_moto',
  true,
  'CONTRATO PARTICULAR DE COMPRA E VENDA DE MOTOCICLETA',
  E'Pelo presente instrumento particular, de um lado {{LOJA_RAZAO_SOCIAL}}, inscrita no CNPJ sob nº {{LOJA_CNPJ}}, com sede em {{LOJA_ENDERECO}}, doravante denominada VENDEDORA, e de outro lado {{CLIENTE_NOME}}, portador(a) do CPF nº {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, e-mail {{CLIENTE_EMAIL}}, doravante denominado(a) COMPRADOR(A), têm entre si justo e contratado a compra e venda da motocicleta abaixo descrita:\n\nMOTOCICLETA: {{VEICULO_MARCA}} {{VEICULO_MODELO}}\nANO: {{VEICULO_ANO}}\nCOR: {{VEICULO_COR}}\nCHASSI: {{VEICULO_CHASSI}}\nPLACA: {{VEICULO_PLACA}}\nRENAVAM: {{VEICULO_RENAVAM}}\n\nVALOR DA VENDA: {{VALOR_TOTAL}}\nENTRADA: {{VALOR_ENTRADA}}\nFORMA DE PAGAMENTO: {{FORMA_PAGAMENTO}}\nPARCELAS: {{PARCELAS}}',
  E'CLÁUSULA PRIMEIRA: A VENDEDORA vende e transfere ao COMPRADOR a motocicleta acima descrita, livre e desembaraçada de quaisquer ônus.\n\nCLÁUSULA SEGUNDA: O COMPRADOR declara ter examinado a motocicleta e estar de acordo com seu estado de conservação.\n\nCLÁUSULA TERCEIRA: A transferência de propriedade será realizada após a quitação total do valor acordado.\n\nCLÁUSULA QUARTA: O EMPLACAMENTO É DE RESPONSABILIDADE EXCLUSIVA DO COMPRADOR.\n\nCLÁUSULA QUINTA: As partes elegem o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer dúvidas oriundas deste contrato.',
  E'{{LOJA_CIDADE}}, {{DATA_CONTRATO}}\n\n\n_______________________________\nVENDEDORA: {{LOJA_RAZAO_SOCIAL}}\n\n\n_______________________________\nCOMPRADOR(A): {{CLIENTE_NOME}}\nCPF: {{CLIENTE_CPF}}',
  ARRAY['O EMPLACAMENTO É DE RESPONSABILIDADE EXCLUSIVA DO COMPRADOR.']::TEXT[]
),
(
  'Contrato de Repasse',
  'repasse',
  true,
  'CONTRATO DE REPASSE DE VEÍCULO',
  E'Pelo presente instrumento particular, de um lado {{LOJA_RAZAO_SOCIAL}}, inscrita no CNPJ sob nº {{LOJA_CNPJ}}, com sede em {{LOJA_ENDERECO}}, doravante denominada CEDENTE, e de outro lado {{CLIENTE_NOME}}, portador(a) do CPF/CNPJ nº {{CLIENTE_CPF}}, com endereço em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, doravante denominado(a) CESSIONÁRIO(A), firmam o presente contrato de repasse:\n\nVEÍCULO: {{VEICULO_MARCA}} {{VEICULO_MODELO}}\nANO: {{VEICULO_ANO}}\nCOR: {{VEICULO_COR}}\nCHASSI: {{VEICULO_CHASSI}}\nPLACA: {{VEICULO_PLACA}}\n\nVALOR DO REPASSE: {{VALOR_TOTAL}}',
  E'CLÁUSULA PRIMEIRA: O CEDENTE transfere ao CESSIONÁRIO todos os direitos sobre o veículo acima descrito.\n\nCLÁUSULA SEGUNDA: O CESSIONÁRIO assume todas as responsabilidades legais e financeiras a partir da assinatura deste contrato.\n\nCLÁUSULA TERCEIRA: Eventuais débitos anteriores à data deste contrato são de responsabilidade do CEDENTE.\n\nCLÁUSULA QUARTA: As partes elegem o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer dúvidas.',
  E'{{LOJA_CIDADE}}, {{DATA_CONTRATO}}\n\n\n_______________________________\nCEDENTE: {{LOJA_RAZAO_SOCIAL}}\n\n\n_______________________________\nCESSIONÁRIO(A): {{CLIENTE_NOME}}',
  ARRAY[]::TEXT[]
);