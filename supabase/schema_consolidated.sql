-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'gerente', 'revendedor', 'visualizador');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'visualizador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create stores table
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  email TEXT,
  manager_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create resellers table
CREATE TABLE public.resellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  cpf TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  commission_rate DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create vehicles table
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT,
  plate TEXT UNIQUE,
  chassis TEXT UNIQUE,
  renavam TEXT,
  mileage INTEGER DEFAULT 0,
  fuel_type TEXT,
  transmission TEXT,
  purchase_price DECIMAL(12,2),
  sale_price DECIMAL(12,2),
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'reservado', 'vendido')),
  images TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create contracts table
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT UNIQUE NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE RESTRICT NOT NULL,
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE RESTRICT NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE RESTRICT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_cpf TEXT NOT NULL,
  buyer_phone TEXT,
  buyer_email TEXT,
  buyer_address TEXT,
  sale_price DECIMAL(12,2) NOT NULL,
  down_payment DECIMAL(12,2) DEFAULT 0,
  installments INTEGER DEFAULT 1,
  installment_value DECIMAL(12,2),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'assinado', 'cancelado', 'concluido')),
  signed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE RESTRICT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create activity_logs table for security
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any elevated role
CREATE OR REPLACE FUNCTION public.has_elevated_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'gerente')
  )
$$;

-- Function to get user's store (for resellers)
CREATE OR REPLACE FUNCTION public.get_user_store_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id
  FROM public.resellers
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User roles policies (only admins can manage)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Stores policies
CREATE POLICY "Authenticated users can view active stores"
  ON public.stores FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_elevated_access(auth.uid()));

CREATE POLICY "Admins can manage stores"
  ON public.stores FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Resellers policies
CREATE POLICY "View resellers based on role"
  ON public.resellers FOR SELECT
  TO authenticated
  USING (
    public.has_elevated_access(auth.uid())
    OR user_id = auth.uid()
    OR store_id = public.get_user_store_id(auth.uid())
  );

CREATE POLICY "Admins and managers can manage resellers"
  ON public.resellers FOR ALL
  TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

-- Vehicles policies
CREATE POLICY "View vehicles based on role"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (
    public.has_elevated_access(auth.uid())
    OR store_id = public.get_user_store_id(auth.uid())
  );

CREATE POLICY "Admins and managers can manage vehicles"
  ON public.vehicles FOR ALL
  TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

-- Contracts policies
CREATE POLICY "View contracts based on role"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (
    public.has_elevated_access(auth.uid())
    OR reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
    OR store_id = public.get_user_store_id(auth.uid())
  );

CREATE POLICY "Create contracts"
  ON public.contracts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_elevated_access(auth.uid())
    OR reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage contracts"
  ON public.contracts FOR UPDATE
  TO authenticated
  USING (public.has_elevated_access(auth.uid()));

-- Payments policies
CREATE POLICY "View payments based on role"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    public.has_elevated_access(auth.uid())
    OR reseller_id IN (SELECT id FROM public.resellers WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

-- Activity logs policies
CREATE POLICY "Admins can view all logs"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_resellers_updated_at
  BEFORE UPDATE ON public.resellers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Fix function search path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
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
  'CONTRATO PARTICULAR DE COMPRA E VENDA DE VEÃCULO AUTOMOTOR',
  E'Pelo presente instrumento particular, de um lado {{LOJA_RAZAO_SOCIAL}}, inscrita no CNPJ sob nÂº {{LOJA_CNPJ}}, com sede em {{LOJA_ENDERECO}}, doravante denominada VENDEDORA, e de outro lado {{CLIENTE_NOME}}, portador(a) do CPF nÂº {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, e-mail {{CLIENTE_EMAIL}}, doravante denominado(a) COMPRADOR(A), tÃªm entre si justo e contratado a compra e venda do veÃ­culo abaixo descrito:\n\nVEÃCULO: {{VEICULO_MARCA}} {{VEICULO_MODELO}}\nANO: {{VEICULO_ANO}}\nCOR: {{VEICULO_COR}}\nCHASSI: {{VEICULO_CHASSI}}\nPLACA: {{VEICULO_PLACA}}\nRENAVAM: {{VEICULO_RENAVAM}}\n\nVALOR DA VENDA: {{VALOR_TOTAL}}\nENTRADA: {{VALOR_ENTRADA}}\nFORMA DE PAGAMENTO: {{FORMA_PAGAMENTO}}\nPARCELAS: {{PARCELAS}}',
  E'CLÃUSULA PRIMEIRA: A VENDEDORA vende e transfere ao COMPRADOR o veÃ­culo acima descrito, livre e desembaraÃ§ado de quaisquer Ã´nus.\n\nCLÃUSULA SEGUNDA: O COMPRADOR declara ter examinado o veÃ­culo e estar de acordo com seu estado de conservaÃ§Ã£o.\n\nCLÃUSULA TERCEIRA: A transferÃªncia de propriedade serÃ¡ realizada apÃ³s a quitaÃ§Ã£o total do valor acordado.\n\nCLÃUSULA QUARTA: As partes elegem o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer dÃºvidas oriundas deste contrato.',
  E'{{LOJA_CIDADE}}, {{DATA_CONTRATO}}\n\n\n_______________________________\nVENDEDORA: {{LOJA_RAZAO_SOCIAL}}\n\n\n_______________________________\nCOMPRADOR(A): {{CLIENTE_NOME}}\nCPF: {{CLIENTE_CPF}}',
  ARRAY[]::TEXT[]
),
(
  'Contrato de Venda - Moto',
  'venda_moto',
  true,
  'CONTRATO PARTICULAR DE COMPRA E VENDA DE MOTOCICLETA',
  E'Pelo presente instrumento particular, de um lado {{LOJA_RAZAO_SOCIAL}}, inscrita no CNPJ sob nÂº {{LOJA_CNPJ}}, com sede em {{LOJA_ENDERECO}}, doravante denominada VENDEDORA, e de outro lado {{CLIENTE_NOME}}, portador(a) do CPF nÂº {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, e-mail {{CLIENTE_EMAIL}}, doravante denominado(a) COMPRADOR(A), tÃªm entre si justo e contratado a compra e venda da motocicleta abaixo descrita:\n\nMOTOCICLETA: {{VEICULO_MARCA}} {{VEICULO_MODELO}}\nANO: {{VEICULO_ANO}}\nCOR: {{VEICULO_COR}}\nCHASSI: {{VEICULO_CHASSI}}\nPLACA: {{VEICULO_PLACA}}\nRENAVAM: {{VEICULO_RENAVAM}}\n\nVALOR DA VENDA: {{VALOR_TOTAL}}\nENTRADA: {{VALOR_ENTRADA}}\nFORMA DE PAGAMENTO: {{FORMA_PAGAMENTO}}\nPARCELAS: {{PARCELAS}}',
  E'CLÃUSULA PRIMEIRA: A VENDEDORA vende e transfere ao COMPRADOR a motocicleta acima descrita, livre e desembaraÃ§ada de quaisquer Ã´nus.\n\nCLÃUSULA SEGUNDA: O COMPRADOR declara ter examinado a motocicleta e estar de acordo com seu estado de conservaÃ§Ã£o.\n\nCLÃUSULA TERCEIRA: A transferÃªncia de propriedade serÃ¡ realizada apÃ³s a quitaÃ§Ã£o total do valor acordado.\n\nCLÃUSULA QUARTA: O EMPLACAMENTO Ã‰ DE RESPONSABILIDADE EXCLUSIVA DO COMPRADOR.\n\nCLÃUSULA QUINTA: As partes elegem o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer dÃºvidas oriundas deste contrato.',
  E'{{LOJA_CIDADE}}, {{DATA_CONTRATO}}\n\n\n_______________________________\nVENDEDORA: {{LOJA_RAZAO_SOCIAL}}\n\n\n_______________________________\nCOMPRADOR(A): {{CLIENTE_NOME}}\nCPF: {{CLIENTE_CPF}}',
  ARRAY['O EMPLACAMENTO Ã‰ DE RESPONSABILIDADE EXCLUSIVA DO COMPRADOR.']::TEXT[]
),
(
  'Contrato de Repasse',
  'repasse',
  true,
  'CONTRATO DE REPASSE DE VEÃCULO',
  E'Pelo presente instrumento particular, de um lado {{LOJA_RAZAO_SOCIAL}}, inscrita no CNPJ sob nÂº {{LOJA_CNPJ}}, com sede em {{LOJA_ENDERECO}}, doravante denominada CEDENTE, e de outro lado {{CLIENTE_NOME}}, portador(a) do CPF/CNPJ nÂº {{CLIENTE_CPF}}, com endereÃ§o em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, doravante denominado(a) CESSIONÃRIO(A), firmam o presente contrato de repasse:\n\nVEÃCULO: {{VEICULO_MARCA}} {{VEICULO_MODELO}}\nANO: {{VEICULO_ANO}}\nCOR: {{VEICULO_COR}}\nCHASSI: {{VEICULO_CHASSI}}\nPLACA: {{VEICULO_PLACA}}\n\nVALOR DO REPASSE: {{VALOR_TOTAL}}',
  E'CLÃUSULA PRIMEIRA: O CEDENTE transfere ao CESSIONÃRIO todos os direitos sobre o veÃ­culo acima descrito.\n\nCLÃUSULA SEGUNDA: O CESSIONÃRIO assume todas as responsabilidades legais e financeiras a partir da assinatura deste contrato.\n\nCLÃUSULA TERCEIRA: Eventuais dÃ©bitos anteriores Ã  data deste contrato sÃ£o de responsabilidade do CEDENTE.\n\nCLÃUSULA QUARTA: As partes elegem o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer dÃºvidas.',
  E'{{LOJA_CIDADE}}, {{DATA_CONTRATO}}\n\n\n_______________________________\nCEDENTE: {{LOJA_RAZAO_SOCIAL}}\n\n\n_______________________________\nCESSIONÃRIO(A): {{CLIENTE_NOME}}',
  ARRAY[]::TEXT[]
);
-- Adicionar campo vehicle_type na tabela vehicles
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'carro' CHECK (vehicle_type IN ('carro', 'moto'));

-- Adicionar campo engine_cc (cilindrada) para motos
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS engine_cc INTEGER;
-- Adicionar coluna reseller_id na tabela vehicles para vinculaÃ§Ã£o com revendedores
ALTER TABLE public.vehicles 
ADD COLUMN reseller_id uuid REFERENCES public.resellers(id) ON DELETE SET NULL;

-- Criar Ã­ndice para melhor performance nas buscas
CREATE INDEX idx_vehicles_reseller_id ON public.vehicles(reseller_id);

-- ComentÃ¡rio explicativo
COMMENT ON COLUMN public.vehicles.reseller_id IS 'ID do revendedor responsÃ¡vel pelo veÃ­culo (null = estoque da loja)';
-- Allow admins to delete contracts
CREATE POLICY "Admins can delete contracts"
ON public.contracts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
-- Tabela para contratos de consignaÃ§Ã£o com revendedores
CREATE TABLE public.reseller_consignment_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  
  -- Valores do contrato
  vehicle_cost NUMERIC NOT NULL, -- Valor que o revendedor paga (diferente do valor de venda ao pÃºblico)
  payment_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' ou 'full'
  
  -- Para pagamento por porcentagem
  upfront_percentage NUMERIC DEFAULT 0, -- % pago antecipadamente
  upfront_amount NUMERIC DEFAULT 0, -- Valor calculado do upfront
  remaining_percentage NUMERIC DEFAULT 0, -- % pago apÃ³s venda
  remaining_amount NUMERIC DEFAULT 0, -- Valor calculado do restante
  
  -- Para pagamento 100%
  full_payment_amount NUMERIC DEFAULT 0,
  
  -- Controle de pagamentos
  upfront_paid BOOLEAN DEFAULT false,
  upfront_paid_at TIMESTAMPTZ,
  remaining_paid BOOLEAN DEFAULT false,
  remaining_paid_at TIMESTAMPTZ,
  
  -- Status do contrato
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo, quitado, cancelado
  
  -- Termos e observaÃ§Ãµes
  terms TEXT,
  notes TEXT,
  
  -- Auditoria
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reseller_consignment_contracts ENABLE ROW LEVEL SECURITY;

-- PolÃ­ticas RLS
CREATE POLICY "Elevated users can manage consignment contracts"
ON public.reseller_consignment_contracts
FOR ALL
USING (has_elevated_access(auth.uid()))
WITH CHECK (has_elevated_access(auth.uid()));

CREATE POLICY "View consignment contracts based on role"
ON public.reseller_consignment_contracts
FOR SELECT
USING (
  has_elevated_access(auth.uid()) OR
  reseller_id IN (SELECT id FROM resellers WHERE user_id = auth.uid()) OR
  store_id = get_user_store_id(auth.uid())
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_reseller_consignment_contracts_updated_at
BEFORE UPDATE ON public.reseller_consignment_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar coluna para identificar se usuÃ¡rio precisa trocar senha
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
-- Add 'vendedor' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor';

-- Create storage bucket for system backups
INSERT INTO storage.buckets (id, name, public) VALUES ('system-backups', 'system-backups', false)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to manage backups
CREATE POLICY "Admins can manage backups"
ON storage.objects
FOR ALL
USING (bucket_id = 'system-backups' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'system-backups' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins and managers to read backups  
CREATE POLICY "Elevated users can read backups"
ON storage.objects
FOR SELECT
USING (bucket_id = 'system-backups' AND public.has_elevated_access(auth.uid()));
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS created_by uuid;
-- Restrict seller visibility on contracts to only their own sales while preserving admin/manager/revendedor access
DROP POLICY IF EXISTS "View contracts based on role" ON public.contracts;

CREATE POLICY "View contracts based on role"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  public.has_elevated_access(auth.uid())
  OR created_by = auth.uid()
  OR reseller_id IN (
    SELECT r.id
    FROM public.resellers r
    WHERE r.user_id = auth.uid()
  )
);

-- Allow sellers to update only contracts they created; admins/managers retain broader access
DROP POLICY IF EXISTS "Admins can manage contracts" ON public.contracts;

CREATE POLICY "Admins and sellers can update contracts"
ON public.contracts
FOR UPDATE
TO authenticated
USING (
  public.has_elevated_access(auth.uid())
  OR created_by = auth.uid()
)
WITH CHECK (
  public.has_elevated_access(auth.uid())
  OR created_by = auth.uid()
);

-- Allow sellers to create contracts directly as operator while preserving reseller flow
DROP POLICY IF EXISTS "Create contracts" ON public.contracts;

CREATE POLICY "Create contracts"
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_elevated_access(auth.uid())
  OR created_by = auth.uid()
  OR reseller_id IN (
    SELECT r.id
    FROM public.resellers r
    WHERE r.user_id = auth.uid()
  )
);
-- Ensure sellers can see inventory from their store and only their own sales, while sales require manager/admin approval to finalize
DROP POLICY IF EXISTS "View vehicles based on role" ON public.vehicles;

CREATE POLICY "View vehicles based on role"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
  public.has_elevated_access(auth.uid())
  OR store_id = public.get_user_store_id(auth.uid())
  OR reseller_id IN (
    SELECT r.id
    FROM public.resellers r
    WHERE r.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "View contracts based on role" ON public.contracts;

CREATE POLICY "View contracts based on role"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  public.has_elevated_access(auth.uid())
  OR created_by = auth.uid()
  OR reseller_id IN (
    SELECT r.id
    FROM public.resellers r
    WHERE r.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins and sellers can update contracts" ON public.contracts;

CREATE POLICY "Admins and sellers can update contracts"
ON public.contracts
FOR UPDATE
TO authenticated
USING (
  public.has_elevated_access(auth.uid())
  OR created_by = auth.uid()
)
WITH CHECK (
  public.has_elevated_access(auth.uid())
  OR created_by = auth.uid()
);

DROP POLICY IF EXISTS "Create contracts" ON public.contracts;

CREATE POLICY "Create contracts"
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_elevated_access(auth.uid())
  OR created_by = auth.uid()
  OR reseller_id IN (
    SELECT r.id
    FROM public.resellers r
    WHERE r.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view profiles based on role"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR has_elevated_access(auth.uid())
  );

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
-- WMI-only entries (sem modelo especÃ­fico)
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
('5YJ', 'Tesla', 'carro', NULL, NULL, NULL, 'ElÃ©trico');
UPDATE public.contract_templates
SET 
  header_content = '[center][b][size:14]CONTRATO DE COMPRA E VENDA DE MOTOCICLETA[/size][/b][/center]',
  body_content = '[b]VENDEDORA:[/b] {{LOJA_RAZAO_SOCIAL}} â€” {{LOJA_ENDERECO}}, {{LOJA_CIDADE}} â€” Tel: {{LOJA_TELEFONE}}

[b]COMPRADOR(A):[/b] {{CLIENTE_NOME}} â€” CPF/CNPJ: {{CLIENTE_CPF}}
EndereÃ§o: {{CLIENTE_ENDERECO}} â€” Tel: {{CLIENTE_TELEFONE}}

[b]MOTOCICLETA:[/b] {{VEICULO_MARCA}} {{VEICULO_MODELO}} â€” Ano: {{VEICULO_ANO}} â€” Cor: {{VEICULO_COR}}
Chassi: {{VEICULO_CHASSI}} â€” Placa: {{VEICULO_PLACA}} â€” Renavam: {{VEICULO_RENAVAM}}

[b]VALOR:[/b] {{VALOR_TOTAL}} â€” [b]Pagamento:[/b] {{FORMA_PAGAMENTO}} â€” Entrada: {{VALOR_ENTRADA}} â€” Parcelas: {{PARCELAS}} de {{VALOR_PARCELA}}',
  clauses_content = '[b]CLÃUSULAS:[/b]
[b]1.[/b] A VENDEDORA transfere ao(Ã ) COMPRADOR(A) a propriedade e posse da motocicleta acima descrita, livre de Ã´nus, na presente data.
[b]2.[/b] O(A) COMPRADOR(A) declara ter vistoriado a motocicleta e a recebe no estado em que se encontra, sem direito a reclamaÃ§Ãµes posteriores quanto a defeitos aparentes.
[b]3.[/b] A partir desta data, todas as responsabilidades civis, criminais e tributÃ¡rias (multas, IPVA, licenciamento) passam a ser exclusivas do(a) COMPRADOR(A).
[b]4.[/b] O emplacamento e a transferÃªncia junto ao DETRAN sÃ£o de responsabilidade exclusiva do(a) COMPRADOR(A), devendo ser realizados em atÃ© 30 dias.
[b]5.[/b] Fica eleito o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer questÃµes oriundas deste contrato.',
  signature_content = '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]


[center]_______________________________          _______________________________
[b]VENDEDORA[/b]                                              [b]COMPRADOR(A)[/b]
{{LOJA_RAZAO_SOCIAL}}                                {{CLIENTE_NOME}}[/center]',
  fixed_clauses = ARRAY['O emplacamento da motocicleta Ã© de responsabilidade exclusiva do(a) COMPRADOR(A).']::text[],
  updated_at = now()
WHERE template_type = 'venda_moto';
UPDATE public.contract_templates
SET 
  header_content = '[center][b][size:13]CONTRATO PARTICULAR DE COMPRA E VENDA DE MOTOCICLETA[/size][/b][/center]',
  body_content = 'Pelo presente instrumento particular, de um lado [b]{{LOJA_RAZAO_SOCIAL}}[/b], com sede em {{LOJA_ENDERECO}} â€” {{LOJA_CIDADE}}, telefone {{LOJA_TELEFONE}}, doravante denominada [b]VENDEDORA[/b], e de outro lado [b]{{CLIENTE_NOME}}[/b], portador(a) do CPF/CNPJ nÂº {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}, e-mail {{CLIENTE_EMAIL}}, doravante denominado(a) [b]COMPRADOR(A)[/b], tÃªm entre si justo e contratado a compra e venda da motocicleta abaixo descrita:

[b]MOTOCICLETA:[/b] {{VEICULO_MARCA}} {{VEICULO_MODELO}} â€” [b]Ano:[/b] {{VEICULO_ANO}} â€” [b]Cor:[/b] {{VEICULO_COR}}
[b]Chassi:[/b] {{VEICULO_CHASSI}} â€” [b]Placa:[/b] {{VEICULO_PLACA}} â€” [b]Renavam:[/b] {{VEICULO_RENAVAM}}

[b]VALOR DA VENDA:[/b] {{VALOR_TOTAL}} â€” [b]Forma de Pagamento:[/b] {{FORMA_PAGAMENTO}} â€” [b]Entrada:[/b] {{VALOR_ENTRADA}} â€” [b]Parcelas:[/b] {{PARCELAS}} de {{VALOR_PARCELA}}',
  clauses_content = '[center][b]TERMO DE RESPONSABILIDADE E GARANTIA[/b][/center]
Declaro que estou vendendo o veÃ­culo acima descrito e que assumo total responsabilidade por quaisquer ocorrÃªncias relacionadas ao mesmo atÃ© a presente data de venda, incluindo multas, danos materiais e pessoais, respondendo civil e criminalmente, bem como por todo e qualquer tipo de dÃ©bito, de qualquer espÃ©cie ou natureza. A partir desta venda, tais responsabilidades passam a ser integralmente do comprador acima identificado. Declaro ainda que, conforme a legislaÃ§Ã£o vigente, o veÃ­culo serÃ¡ de responsabilidade exclusiva do comprador a partir desta data.

[b]CLÃUSULAS:[/b]
[b]1.[/b] A VENDEDORA transfere ao(Ã ) COMPRADOR(A) a propriedade e posse da motocicleta acima descrita, livre de Ã´nus, na presente data.
[b]2.[/b] O(A) COMPRADOR(A) declara ter vistoriado a motocicleta e a recebe no estado em que se encontra, sem direito a reclamaÃ§Ãµes posteriores quanto a defeitos aparentes.
[b]3.[/b] A partir desta data, todas as responsabilidades civis, criminais e tributÃ¡rias (multas, IPVA, licenciamento) passam a ser exclusivas do(a) COMPRADOR(A).
[b]4.[/b] O emplacamento e a transferÃªncia junto ao DETRAN sÃ£o de responsabilidade exclusiva do(a) COMPRADOR(A), devendo ser realizados em atÃ© 30 dias.
[b]5.[/b] Fica eleito o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer questÃµes oriundas deste contrato.',
  signature_content = '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]


[center]_______________________________          _______________________________
[b]VENDEDORA[/b]                                              [b]COMPRADOR(A)[/b]
{{LOJA_RAZAO_SOCIAL}}                                {{CLIENTE_NOME}}[/center]',
  fixed_clauses = ARRAY['O EMPLACAMENTO Ã‰ DE RESPONSABILIDADE EXCLUSIVA DO COMPRADOR.']::text[],
  updated_at = now()
WHERE template_type = 'venda_moto';
UPDATE public.contract_templates
SET 
  signature_content = '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]


[signatures]VENDEDORA|{{LOJA_RAZAO_SOCIAL}}||COMPRADOR(A)|{{CLIENTE_NOME}}[/signatures]',
  updated_at = now()
WHERE template_type = 'venda_moto';

UPDATE public.contract_templates
SET 
  signature_content = '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}[/center]


[signatures]VENDEDORA|{{LOJA_RAZAO_SOCIAL}}||COMPRADOR(A)|{{CLIENTE_NOME}}[/signatures]',
  updated_at = now()
WHERE template_type IN ('venda_carro', 'repasse', 'generico')
  AND signature_content IS NOT NULL;
ALTER TABLE public.contracts ALTER COLUMN reseller_id DROP NOT NULL;
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

-- Tabela de funcionÃ¡rios (independente do auth, mas pode ser vinculada)
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  cpf TEXT,
  role TEXT NOT NULL DEFAULT 'funcionario',
  position TEXT,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  hire_date DATE,
  phone TEXT,
  email TEXT,
  pix_key TEXT,
  bank_info TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated users can manage employees"
ON public.employees FOR ALL TO authenticated
USING (public.has_elevated_access(auth.uid()))
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Employees can view own record"
ON public.employees FOR SELECT TO authenticated
USING (public.has_elevated_access(auth.uid()) OR profile_id = auth.uid());

CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de contracheques
CREATE TABLE public.payslips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payslip_number TEXT NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  reference_month INTEGER NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  reference_year INTEGER NOT NULL,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  commission_sales_total NUMERIC NOT NULL DEFAULT 0,
  bonus NUMERIC NOT NULL DEFAULT 0,
  overtime NUMERIC NOT NULL DEFAULT 0,
  inss_discount NUMERIC NOT NULL DEFAULT 0,
  irrf_discount NUMERIC NOT NULL DEFAULT 0,
  other_discounts NUMERIC NOT NULL DEFAULT 0,
  net_total NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, reference_month, reference_year)
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated users can manage payslips"
ON public.payslips FOR ALL TO authenticated
USING (public.has_elevated_access(auth.uid()))
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Employees can view own payslips"
ON public.payslips FOR SELECT TO authenticated
USING (
  public.has_elevated_access(auth.uid())
  OR employee_id IN (SELECT id FROM public.employees WHERE profile_id = auth.uid())
);

CREATE TRIGGER update_payslips_updated_at
BEFORE UPDATE ON public.payslips
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Commission tiers per employee (sales count -> value per sale)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS commission_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Contract template branding
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS watermark_url text,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS watermark_opacity numeric NOT NULL DEFAULT 0.10;

-- Public bucket for logos / watermarks / signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-assets', 'contract-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Public read contract assets" ON storage.objects;
CREATE POLICY "Public read contract assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contract-assets');

-- Elevated users (admin/gerente) can upload/update/delete
DROP POLICY IF EXISTS "Elevated upload contract assets" ON storage.objects;
CREATE POLICY "Elevated upload contract assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contract-assets' AND public.has_elevated_access(auth.uid()));

DROP POLICY IF EXISTS "Elevated update contract assets" ON storage.objects;
CREATE POLICY "Elevated update contract assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'contract-assets' AND public.has_elevated_access(auth.uid()));

DROP POLICY IF EXISTS "Elevated delete contract assets" ON storage.objects;
CREATE POLICY "Elevated delete contract assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'contract-assets' AND public.has_elevated_access(auth.uid()));

CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text NOT NULL,
  invoice_type text NOT NULL DEFAULT 'servico',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  store_id uuid,
  customer_name text NOT NULL,
  customer_document text,
  customer_address text,
  customer_email text,
  customer_phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_value numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'emitida',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated users can manage invoices"
ON public.invoices FOR ALL TO authenticated
USING (public.has_elevated_access(auth.uid()))
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bank_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  client_id TEXT,
  client_secret TEXT,
  api_environment TEXT NOT NULL DEFAULT 'sandbox',
  partner_code TEXT,
  extra_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, bank_code)
);

ALTER TABLE public.bank_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated users manage bank credentials"
ON public.bank_credentials FOR ALL TO authenticated
USING (has_elevated_access(auth.uid()))
WITH CHECK (has_elevated_access(auth.uid()));

CREATE TRIGGER bank_credentials_updated_at
BEFORE UPDATE ON public.bank_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.financing_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  vehicle_id UUID,
  bank_code TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_document TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_income NUMERIC,
  customer_birthdate DATE,
  vehicle_value NUMERIC NOT NULL,
  down_payment NUMERIC NOT NULL DEFAULT 0,
  installments INTEGER NOT NULL,
  financed_amount NUMERIC NOT NULL,
  monthly_rate NUMERIC,
  installment_value NUMERIC,
  total_amount NUMERIC,
  cet NUMERIC,
  status TEXT NOT NULL DEFAULT 'pendente',
  response_data JSONB,
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financing_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View simulations by role"
ON public.financing_simulations FOR SELECT TO authenticated
USING (has_elevated_access(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Create simulations"
ON public.financing_simulations FOR INSERT TO authenticated
WITH CHECK (has_elevated_access(auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Elevated update simulations"
ON public.financing_simulations FOR UPDATE TO authenticated
USING (has_elevated_access(auth.uid()))
WITH CHECK (has_elevated_access(auth.uid()));

CREATE POLICY "Elevated delete simulations"
ON public.financing_simulations FOR DELETE TO authenticated
USING (has_elevated_access(auth.uid()));

CREATE TRIGGER financing_simulations_updated_at
BEFORE UPDATE ON public.financing_simulations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS cnpj text;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS manager_commission_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowance numeric NOT NULL DEFAULT 0;

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS transport_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manager_commission numeric NOT NULL DEFAULT 0;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS salary_additions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS additions jsonb NOT NULL DEFAULT '[]'::jsonb;

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

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.stock_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id text,
  sheet_name text NOT NULL DEFAULT 'Estoque',
  enabled boolean NOT NULL DEFAULT false,
  function_url text,
  function_token text,
  last_pushed_at timestamptz,
  last_pulled_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_sync_config TO authenticated;
GRANT ALL ON public.stock_sync_config TO service_role;

ALTER TABLE public.stock_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_sync_config_select" ON public.stock_sync_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "stock_sync_config_manage" ON public.stock_sync_config
  FOR ALL TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE TRIGGER trg_stock_sync_config_updated_at
  BEFORE UPDATE ON public.stock_sync_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.stock_sync_config (sheet_name, enabled) VALUES ('Estoque', false);

CREATE OR REPLACE FUNCTION public.notify_stock_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg record;
BEGIN
  SELECT enabled, function_url, function_token, spreadsheet_id
    INTO cfg
  FROM public.stock_sync_config
  LIMIT 1;

  IF cfg IS NULL OR NOT cfg.enabled OR cfg.function_url IS NULL OR cfg.spreadsheet_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM extensions.http_post(
    url := cfg.function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(cfg.function_token, '')
    ),
    body := jsonb_build_object('action', 'push')
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_vehicles_stock_sync
AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
FOR EACH STATEMENT EXECUTE FUNCTION public.notify_stock_sync();
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS financing_bank text;
-- 1. contract_templates: optional_clauses + vehicle_types
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS optional_clauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vehicle_types text[] NOT NULL DEFAULT ARRAY['carro','moto']::text[];

-- 2. vehicles: warranty + revision periods
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS warranty_months integer,
  ADD COLUMN IF NOT EXISTS revision_period_months integer,
  ADD COLUMN IF NOT EXISTS revision_period_km integer;

-- 3. contracts: snapshot das clÃ¡usulas ativas
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS active_clause_ids text[] NOT NULL DEFAULT ARRAY[]::text[];

-- 4. Desativa modelos antigos (histÃ³rico preservado, contratos assinados continuam apontando)
UPDATE public.contract_templates SET is_active = false WHERE is_active = true;

-- 5. Seed do Contrato Mestre
INSERT INTO public.contract_templates (
  name, template_type, is_active, version, vehicle_types,
  header_content, body_content, clauses_content, signature_content,
  fixed_clauses, optional_clauses
) VALUES (
  'Contrato Mestre de Venda',
  'generico',
  true,
  1,
  ARRAY['carro','moto']::text[],
  '[center][size:16][b]CONTRATO DE COMPRA E VENDA DE VEÃCULO[/b][/size][/center]

[b]VENDEDORA:[/b] {{LOJA_RAZAO_SOCIAL}}, CNPJ {{LOJA_CNPJ}}, com sede em {{LOJA_ENDERECO}}, {{LOJA_CIDADE}}.

[b]COMPRADOR(A):[/b] {{CLIENTE_NOME}}, CPF/CNPJ {{CLIENTE_CPF}}, residente em {{CLIENTE_ENDERECO}}, telefone {{CLIENTE_TELEFONE}}.',
  '[b]OBJETO:[/b] O presente contrato tem por objeto a compra e venda do veÃ­culo abaixo descrito, livre e desembaraÃ§ado de quaisquer Ã´nus:

Marca/Modelo: {{VEICULO_MARCA}} {{VEICULO_MODELO}}
Ano: {{VEICULO_ANO}}   Cor: {{VEICULO_COR}}
Chassi: {{VEICULO_CHASSI}}   Placa: {{VEICULO_PLACA}}
Renavam: {{VEICULO_RENAVAM}}

[b]PREÃ‡O E PAGAMENTO:[/b] O valor total ajustado Ã© de R$ {{VALOR_TOTAL}}, pago na forma {{FORMA_PAGAMENTO}}. Entrada de R$ {{VALOR_ENTRADA}}, saldo em {{PARCELAS}} parcela(s) de R$ {{VALOR_PARCELA}}.',
  '[b]CLÃUSULA 1Âª â€” DA ENTREGA:[/b] O veÃ­culo Ã© entregue no estado em que se encontra, tendo o(a) comprador(a) plena ciÃªncia de suas condiÃ§Ãµes apÃ³s vistoria prÃ©via.

[b]CLÃUSULA 2Âª â€” DA DOCUMENTAÃ‡ÃƒO:[/b] A vendedora entrega o veÃ­culo com toda a documentaÃ§Ã£o em dia. Fica a cargo do(a) comprador(a) providenciar a transferÃªncia junto ao Ã³rgÃ£o competente no prazo legal.

[b]CLÃUSULA 3Âª â€” DO FORO:[/b] Fica eleito o foro da comarca de {{LOJA_CIDADE}} para dirimir quaisquer questÃµes oriundas deste contrato.',
  '[center]{{LOJA_CIDADE}}, {{DATA_CONTRATO}}.[/center]

_______________________________________
[center]{{LOJA_RAZAO_SOCIAL}}
VENDEDORA[/center]

_______________________________________
[center]{{CLIENTE_NOME}}
COMPRADOR(A)[/center]',
  ARRAY[]::text[],
  jsonb_build_array(
    jsonb_build_object(
      'id','emplacamento',
      'label','Emplacamento por conta da loja',
      'body_bbcode','[b]EMPLACAMENTO:[/b] A vendedora se compromete a providenciar o emplacamento do veÃ­culo, incluindo taxas de DETRAN, placa e primeiro licenciamento, sem custo adicional ao(Ã ) comprador(a).',
      'enabled_by_default', true,
      'vehicle_types', jsonb_build_array('moto')
    ),
    jsonb_build_object(
      'id','garantia',
      'label','Garantia contratual',
      'body_bbcode','[b]GARANTIA:[/b] O veÃ­culo possui garantia de {{GARANTIA_MESES}} meses contra defeitos de fabricaÃ§Ã£o ou vÃ­cios ocultos, contados da data deste contrato, limitada aos itens do motor e cÃ¢mbio, excluÃ­dos itens de desgaste natural.',
      'enabled_by_default', true,
      'vehicle_types', jsonb_build_array('carro','moto')
    ),
    jsonb_build_object(
      'id','revisoes',
      'label','Plano de revisÃµes',
      'body_bbcode','[b]REVISÃ•ES:[/b] Para manutenÃ§Ã£o da garantia, o(a) comprador(a) deverÃ¡ realizar revisÃµes periÃ³dicas a cada {{REVISAO_MESES}} meses ou {{REVISAO_KM}} km â€” o que ocorrer primeiro â€” em oficina credenciada.',
      'enabled_by_default', true,
      'vehicle_types', jsonb_build_array('carro','moto')
    ),
    jsonb_build_object(
      'id','transferencia',
      'label','TransferÃªncia de titularidade por conta do comprador',
      'body_bbcode','[b]TRANSFERÃŠNCIA:[/b] Fica sob responsabilidade exclusiva do(a) comprador(a) providenciar a transferÃªncia de titularidade junto ao DETRAN no prazo de 30 dias, arcando com todas as taxas envolvidas.',
      'enabled_by_default', false,
      'vehicle_types', jsonb_build_array('carro','moto')
    ),
    jsonb_build_object(
      'id','seguro',
      'label','Seguro opcional contratado',
      'body_bbcode','[b]SEGURO:[/b] O(a) comprador(a) declara ter contratado seguro do veÃ­culo por conta prÃ³pria, isentando a vendedora de qualquer responsabilidade por sinistros ocorridos apÃ³s a entrega.',
      'enabled_by_default', false,
      'vehicle_types', jsonb_build_array('carro','moto')
    ),
    jsonb_build_object(
      'id','acessorios',
      'label','AcessÃ³rios inclusos',
      'body_bbcode','[b]ACESSÃ“RIOS:[/b] Acompanham o veÃ­culo os acessÃ³rios originais de fÃ¡brica e itens listados no laudo de vistoria, sendo qualquer acessÃ³rio adicional cobrado Ã  parte.',
      'enabled_by_default', false,
      'vehicle_types', jsonb_build_array('carro','moto')
    ),
    jsonb_build_object(
      'id','troca_devolucao',
      'label','PolÃ­tica de troca/devoluÃ§Ã£o',
      'body_bbcode','[b]TROCA/DEVOLUÃ‡ÃƒO:[/b] O veÃ­culo, por se tratar de bem usado adquirido apÃ³s vistoria, nÃ£o admite devoluÃ§Ã£o ou troca, salvo por vÃ­cio oculto comprovado nos termos do CÃ³digo de Defesa do Consumidor.',
      'enabled_by_default', false,
      'vehicle_types', jsonb_build_array('carro','moto')
    )
  )
);

-- Expand contract_templates with categories for optional clauses grouping
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS clause_categories text[] NOT NULL DEFAULT ARRAY['Fiscal','Garantia','Financeiro','DocumentaÃ§Ã£o','Outros']::text[];

-- Expand contracts to track clause variables and current revision number
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS clause_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS revision_number int NOT NULL DEFAULT 1;

-- Revisions history
CREATE TABLE IF NOT EXISTS public.contract_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  revision_number int NOT NULL,
  active_clause_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  clause_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_reason text,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contract_id, revision_number)
);

GRANT SELECT, INSERT ON public.contract_revisions TO authenticated;
GRANT ALL ON public.contract_revisions TO service_role;

ALTER TABLE public.contract_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View revisions of accessible contracts"
  ON public.contract_revisions FOR SELECT
  TO authenticated
  USING (
    contract_id IN (
      SELECT id FROM public.contracts c
      WHERE public.has_elevated_access(auth.uid())
         OR c.created_by = auth.uid()
         OR c.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid())
    )
  );

CREATE POLICY "Create revisions for own contracts"
  ON public.contract_revisions FOR INSERT
  TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND contract_id IN (
      SELECT id FROM public.contracts c
      WHERE public.has_elevated_access(auth.uid()) OR c.created_by = auth.uid()
    )
  );

-- Digital acceptances
CREATE TABLE IF NOT EXISTS public.contract_acceptances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  acceptance_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  revision_number int NOT NULL DEFAULT 1,
  accepted_at timestamptz,
  accepted_ip text,
  accepted_user_agent text,
  buyer_name_typed text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS contract_acceptances_contract_id_idx ON public.contract_acceptances(contract_id);

GRANT SELECT, INSERT ON public.contract_acceptances TO authenticated;
GRANT ALL ON public.contract_acceptances TO service_role;

ALTER TABLE public.contract_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View acceptances of accessible contracts"
  ON public.contract_acceptances FOR SELECT
  TO authenticated
  USING (
    contract_id IN (
      SELECT id FROM public.contracts c
      WHERE public.has_elevated_access(auth.uid())
         OR c.created_by = auth.uid()
         OR c.reseller_id IN (SELECT r.id FROM public.resellers r WHERE r.user_id = auth.uid())
    )
  );

CREATE POLICY "Create acceptance tokens for own contracts"
  ON public.contract_acceptances FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND contract_id IN (
      SELECT id FROM public.contracts c
      WHERE public.has_elevated_access(auth.uid()) OR c.created_by = auth.uid()
    )
  );
-- Drop stock sync trigger (if it exists) â€” sync agora Ã© throttled server-side
DROP TRIGGER IF EXISTS trg_vehicles_stock_sync ON public.vehicles;
DROP TRIGGER IF EXISTS vehicles_stock_sync ON public.vehicles;
DROP TRIGGER IF EXISTS notify_stock_sync_trg ON public.vehicles;

-- Payroll batches
CREATE TABLE IF NOT EXISTS public.payroll_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year SMALLINT NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aprovado','fechado')),
  total_bruto NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_liquido NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_encargos NUMERIC(12,2) NOT NULL DEFAULT 0,
  employee_count INTEGER NOT NULL DEFAULT 0,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_batches TO authenticated;
GRANT ALL ON public.payroll_batches TO service_role;

ALTER TABLE public.payroll_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated can view batches"
  ON public.payroll_batches FOR SELECT TO authenticated
  USING (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can insert batches"
  ON public.payroll_batches FOR INSERT TO authenticated
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can update batches"
  ON public.payroll_batches FOR UPDATE TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Admins can delete batches"
  ON public.payroll_batches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER payroll_batches_updated_at
  BEFORE UPDATE ON public.payroll_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payslips: batch link + breakdown + delivery marks
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.payroll_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS breakdown JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sent_email_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_whatsapp_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payslips_batch ON public.payslips(batch_id);

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS down_payment_pix numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS down_payment_cash numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS down_payment_card numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS down_payment_card_installments integer,
  ADD COLUMN IF NOT EXISTS financing_installments integer,
  ADD COLUMN IF NOT EXISTS financing_installment_value numeric;

ALTER TABLE public.chassis_patterns
  ADD COLUMN IF NOT EXISTS transmission text,
  ADD COLUMN IF NOT EXISTS warranty_months integer,
  ADD COLUMN IF NOT EXISTS service_interval_months integer,
  ADD COLUMN IF NOT EXISTS service_interval_km integer;

-- Sanitize any spreadsheet_id containing a full URL or /edit path
UPDATE public.stock_sync_config
SET spreadsheet_id = substring(spreadsheet_id from 'spreadsheets/d/([a-zA-Z0-9_-]+)')
WHERE spreadsheet_id ~ 'spreadsheets/d/';

UPDATE public.stock_sync_config
SET spreadsheet_id = split_part(split_part(spreadsheet_id, '/', 1), '?', 1)
WHERE spreadsheet_id ~ '[/?]';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS manufacture_year integer;
COMMENT ON COLUMN public.vehicles.manufacture_year IS 'Ano de fabricacao (controle interno). A coluna year representa o ano modelo usado em contratos.';
CREATE TABLE public.sales_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid,
  month smallint NOT NULL,
  year smallint NOT NULL,
  target_qty integer NOT NULL DEFAULT 0,
  target_value numeric NOT NULL DEFAULT 0,
  bonus_on_target numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_targets TO authenticated;
GRANT ALL ON public.sales_targets TO service_role;

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "targets_select_authenticated" ON public.sales_targets
FOR SELECT TO authenticated USING (true);

CREATE POLICY "targets_manage_elevated" ON public.sales_targets
FOR ALL TO authenticated
USING (public.has_elevated_access(auth.uid()))
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE TRIGGER update_sales_targets_updated_at
BEFORE UPDATE ON public.sales_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.eula_acceptances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version text NOT NULL,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  accepted_ip text,
  user_agent text,
  full_name_typed text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, version)
);

GRANT SELECT, INSERT ON public.eula_acceptances TO authenticated;
GRANT ALL ON public.eula_acceptances TO service_role;

ALTER TABLE public.eula_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eula_select_own" ON public.eula_acceptances
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "eula_insert_own" ON public.eula_acceptances
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_status_check CHECK (status IN ('disponivel','reservado','vendido','transferido'));

CREATE TABLE public.stock_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  transfer_type TEXT NOT NULL DEFAULT 'loja_para_revendedor' CHECK (transfer_type IN ('loja_para_loja','loja_para_revendedor','revendedor_para_loja','parceiro_externo')),
  from_store_id UUID REFERENCES public.stores(id),
  to_store_id UUID REFERENCES public.stores(id),
  from_reseller_id UUID REFERENCES public.resellers(id),
  to_reseller_id UUID REFERENCES public.resellers(id),
  partner_name TEXT,
  agreed_amount NUMERIC NOT NULL DEFAULT 0,
  received_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','concluida','cancelada')),
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_transfers TO authenticated;
GRANT ALL ON public.stock_transfers TO service_role;

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated users manage transfers"
ON public.stock_transfers FOR ALL TO authenticated
USING (public.has_elevated_access(auth.uid()))
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Users view transfers of their store"
ON public.stock_transfers FOR SELECT TO authenticated
USING (
  from_store_id = public.get_user_store_id(auth.uid())
  OR to_store_id = public.get_user_store_id(auth.uid())
);

CREATE TRIGGER update_stock_transfers_updated_at
BEFORE UPDATE ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.apply_stock_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluida' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'concluida') THEN
    IF NEW.transfer_type = 'parceiro_externo' THEN
      UPDATE public.vehicles SET status = 'transferido' WHERE id = NEW.vehicle_id;
    ELSE
      UPDATE public.vehicles
      SET store_id = COALESCE(NEW.to_store_id, store_id),
          reseller_id = CASE WHEN NEW.transfer_type = 'revendedor_para_loja' THEN NULL ELSE COALESCE(NEW.to_reseller_id, reseller_id) END
      WHERE id = NEW.vehicle_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_stock_transfer_ins
AFTER INSERT ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_transfer();

CREATE TRIGGER trg_apply_stock_transfer_upd
AFTER UPDATE ON public.stock_transfers
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_transfer();
-- 1. Resellers = parceiros externos apenas
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS partner_type text NOT NULL DEFAULT 'parceiro_externo';

DO $$ BEGIN
  ALTER TABLE public.resellers
    ADD CONSTRAINT resellers_partner_type_check
    CHECK (partner_type IN ('parceiro_externo','consignado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Employees = fonte oficial do vinculo interno (vendedores/gerentes)
CREATE UNIQUE INDEX IF NOT EXISTS employees_profile_id_unique
  ON public.employees(profile_id) WHERE profile_id IS NOT NULL;

-- 3. Vinculo de loja: funcionario primeiro, parceiro depois
CREATE OR REPLACE FUNCTION public.get_user_store_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT store_id FROM public.employees
      WHERE profile_id = _user_id AND is_active AND store_id IS NOT NULL LIMIT 1),
    (SELECT store_id FROM public.resellers
      WHERE user_id = _user_id AND store_id IS NOT NULL LIMIT 1)
  )
$function$;

-- 4. Hub: chaves de API para apps externos
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['read']::text[],
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage api keys" ON public.api_keys;
CREATE POLICY "Admins manage api keys" ON public.api_keys
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS api_keys_updated_at ON public.api_keys;
CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Configuracoes da folha de pagamento
CREATE TABLE IF NOT EXISTS public.payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_day smallint NOT NULL DEFAULT 30,
  reminder_days_before smallint NOT NULL DEFAULT 5,
  auto_reminder_enabled boolean NOT NULL DEFAULT true,
  default_dependents smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_settings TO authenticated;
GRANT ALL ON public.payroll_settings TO service_role;
ALTER TABLE public.payroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Elevated manage payroll settings" ON public.payroll_settings;
CREATE POLICY "Elevated manage payroll settings" ON public.payroll_settings
  FOR ALL TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

DROP TRIGGER IF EXISTS payroll_settings_updated_at ON public.payroll_settings;
CREATE TRIGGER payroll_settings_updated_at BEFORE UPDATE ON public.payroll_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.resellers DROP CONSTRAINT IF EXISTS resellers_partner_type_check;
ALTER TABLE public.resellers
  ADD CONSTRAINT resellers_partner_type_check
  CHECK (partner_type IN ('parceiro_externo','consignado','interno'));
CREATE TABLE public.vehicle_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  model text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'moto',
  engine_cc integer,
  fuel_type text,
  transmission text,
  warranty_months integer,
  revision_period_months integer,
  revision_period_km integer,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX vehicle_models_unique_idx ON public.vehicle_models (lower(brand), lower(model), vehicle_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_models TO authenticated;
GRANT ALL ON public.vehicle_models TO service_role;

ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vehicle models"
ON public.vehicle_models FOR SELECT TO authenticated USING (true);

CREATE POLICY "Elevated can insert vehicle models"
ON public.vehicle_models FOR INSERT TO authenticated
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can update vehicle models"
ON public.vehicle_models FOR UPDATE TO authenticated
USING (public.has_elevated_access(auth.uid()))
WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can delete vehicle models"
ON public.vehicle_models FOR DELETE TO authenticated
USING (public.has_elevated_access(auth.uid()));

CREATE TRIGGER vehicle_models_updated_at
BEFORE UPDATE ON public.vehicle_models
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.chassis_year_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_code text NOT NULL,
  model_year integer NOT NULL,
  brand text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX chassis_year_codes_code_brand_idx
  ON public.chassis_year_codes (upper(year_code), coalesce(upper(brand), ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chassis_year_codes TO authenticated;
GRANT ALL ON public.chassis_year_codes TO service_role;

ALTER TABLE public.chassis_year_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view year codes"
  ON public.chassis_year_codes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Elevated can insert year codes"
  ON public.chassis_year_codes FOR INSERT TO authenticated
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can update year codes"
  ON public.chassis_year_codes FOR UPDATE TO authenticated
  USING (public.has_elevated_access(auth.uid()))
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can delete year codes"
  ON public.chassis_year_codes FOR DELETE TO authenticated
  USING (public.has_elevated_access(auth.uid()));

CREATE TRIGGER chassis_year_codes_updated_at
  BEFORE UPDATE ON public.chassis_year_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.financing_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX financing_banks_name_key ON public.financing_banks (upper(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financing_banks TO authenticated;
GRANT ALL ON public.financing_banks TO service_role;

ALTER TABLE public.financing_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view financing banks"
  ON public.financing_banks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Elevated can insert financing banks"
  ON public.financing_banks FOR INSERT TO authenticated
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can update financing banks"
  ON public.financing_banks FOR UPDATE TO authenticated
  USING (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can delete financing banks"
  ON public.financing_banks FOR DELETE TO authenticated
  USING (public.has_elevated_access(auth.uid()));

CREATE TRIGGER financing_banks_updated_at
  BEFORE UPDATE ON public.financing_banks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.financing_banks (name, sort_order) VALUES
  ('BANCO ITAÃš', 1), ('SANTANDER', 2), ('BV FINANCEIRA', 3), ('BRADESCO', 4),
  ('OMNI BANCO', 5), ('BANCO PAN', 6), ('SAFRA', 7), ('CAIXA ECONÃ”MICA', 8);
ALTER TABLE public.vehicle_models
  ADD COLUMN IF NOT EXISTS default_purchase_price numeric,
  ADD COLUMN IF NOT EXISTS default_sale_price numeric;

CREATE TABLE IF NOT EXISTS public.vehicle_colors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  hex text,
  vehicle_model_id uuid REFERENCES public.vehicle_models(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_colors_unique_name
  ON public.vehicle_colors (upper(name), COALESCE(vehicle_model_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_colors TO authenticated;
GRANT ALL ON public.vehicle_colors TO service_role;

ALTER TABLE public.vehicle_colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view colors"
  ON public.vehicle_colors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Elevated can insert colors"
  ON public.vehicle_colors FOR INSERT TO authenticated
  WITH CHECK (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can update colors"
  ON public.vehicle_colors FOR UPDATE TO authenticated
  USING (public.has_elevated_access(auth.uid()));

CREATE POLICY "Elevated can delete colors"
  ON public.vehicle_colors FOR DELETE TO authenticated
  USING (public.has_elevated_access(auth.uid()));

CREATE TRIGGER vehicle_colors_updated_at
  BEFORE UPDATE ON public.vehicle_colors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS lead_source_detail text;
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor_plus';

CREATE OR REPLACE FUNCTION public.can_register_vehicles(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_elevated_access(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'vendedor_plus'
  )
$$;

CREATE POLICY "Vendedor plus can register vehicles"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_register_vehicles(auth.uid())
  AND (
    public.has_elevated_access(auth.uid())
    OR store_id = public.get_user_store_id(auth.uid())
  )
);
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS review_requested_by uuid,
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_resolved_by uuid,
  ADD COLUMN IF NOT EXISTS review_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_response text;

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_review_status_check;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_review_status_check
  CHECK (review_status IN ('ok','questionada','corrigida'));

CREATE INDEX IF NOT EXISTS idx_contracts_review_status ON public.contracts (review_status);
ALTER TABLE public.contracts DROP CONSTRAINT contracts_status_check;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_status_check CHECK (status = ANY (ARRAY['pre_venda'::text,'pendente'::text,'assinado'::text,'cancelado'::text,'concluido'::text]));
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
CREATE OR REPLACE FUNCTION public.can_create_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin','gerente','vendedor','vendedor_plus')
  )
$$;

CREATE POLICY "Sales roles can update vehicles of their store"
ON public.vehicles
FOR UPDATE
TO authenticated
USING (
  public.can_create_sales(auth.uid())
  AND (public.has_elevated_access(auth.uid()) OR store_id = public.get_user_store_id(auth.uid()))
)
WITH CHECK (
  public.can_create_sales(auth.uid())
  AND (public.has_elevated_access(auth.uid()) OR store_id = public.get_user_store_id(auth.uid()))
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs (entity_type, entity_id);
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS instagram_handle text;

CREATE TABLE public.store_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  campaign_name text NOT NULL,
  title text NOT NULL,
  platform text NOT NULL DEFAULT 'instagram',
  image_url text,
  caption text,
  ad_url text,
  started_at date,
  ended_at date,
  budget_spent numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ads TO authenticated;
GRANT ALL ON public.store_ads TO service_role;

ALTER TABLE public.store_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view store ads" ON public.store_ads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Elevated can insert store ads" ON public.store_ads
  FOR INSERT TO authenticated WITH CHECK (public.has_elevated_access(auth.uid()));
CREATE POLICY "Elevated can update store ads" ON public.store_ads
  FOR UPDATE TO authenticated USING (public.has_elevated_access(auth.uid()));
CREATE POLICY "Elevated can delete store ads" ON public.store_ads
  FOR DELETE TO authenticated USING (public.has_elevated_access(auth.uid()));

CREATE TRIGGER store_ads_updated_at BEFORE UPDATE ON public.store_ads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_store_ads_store ON public.store_ads(store_id, status);

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS ad_id uuid REFERENCES public.store_ads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_name text;

CREATE INDEX idx_contracts_ad ON public.contracts(ad_id);
CREATE POLICY "Authenticated can view ad creatives" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'ad-creatives');
CREATE POLICY "Elevated can upload ad creatives" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ad-creatives' AND public.has_elevated_access(auth.uid()));
CREATE POLICY "Elevated can update ad creatives" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'ad-creatives' AND public.has_elevated_access(auth.uid()));
CREATE POLICY "Elevated can delete ad creatives" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'ad-creatives' AND public.has_elevated_access(auth.uid()));
ALTER TABLE public.chassis_patterns
  ADD COLUMN IF NOT EXISTS default_purchase_price numeric,
  ADD COLUMN IF NOT EXISTS default_sale_price numeric;
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor_externo';

CREATE OR REPLACE FUNCTION public.can_create_sales(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin','gerente','vendedor','vendedor_plus','vendedor_externo')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_external_seller(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'vendedor_externo'
  )
$$;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS sale_group_id uuid;
CREATE INDEX IF NOT EXISTS contracts_sale_group_id_idx ON public.contracts (sale_group_id);
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS sale_channel text NOT NULL DEFAULT 'interna',
  ADD COLUMN IF NOT EXISTS evidence_paths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS external_data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS contracts_sale_channel_idx ON public.contracts (sale_channel);
CREATE POLICY "Authenticated can read sale evidence"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sale-evidence');

CREATE POLICY "Authenticated can upload sale evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sale-evidence');

CREATE POLICY "Authenticated can update sale evidence"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'sale-evidence');
ALTER TABLE public.vehicle_models
  ADD COLUMN IF NOT EXISTS promo_price numeric,
  ADD COLUMN IF NOT EXISTS promo_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_label text,
  ADD COLUMN IF NOT EXISTS promo_ends_on date;
ALTER TABLE public.vehicle_colors ADD COLUMN IF NOT EXISTS hex_secondary text;
ALTER TABLE public.chassis_year_codes ADD COLUMN IF NOT EXISTS manufacture_year integer;
ALTER TABLE public.vehicle_colors
  ADD COLUMN IF NOT EXISTS vehicle_model_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS model_scope text NOT NULL DEFAULT 'todos';

ALTER TABLE public.vehicle_colors DROP CONSTRAINT IF EXISTS vehicle_colors_model_scope_check;
ALTER TABLE public.vehicle_colors
  ADD CONSTRAINT vehicle_colors_model_scope_check CHECK (model_scope IN ('todos', 'apenas', 'exceto'));

UPDATE public.vehicle_colors
SET vehicle_model_ids = ARRAY[vehicle_model_id],
    model_scope = 'apenas'
WHERE vehicle_model_id IS NOT NULL
  AND model_scope = 'todos'
  AND vehicle_model_ids = '{}'::uuid[];
CREATE OR REPLACE FUNCTION public.can_register_vehicles(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_elevated_access(_user_id) OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('vendedor_plus', 'vendedor_externo')
  )
$$;
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT 'neutral',
  data_scope text NOT NULL DEFAULT 'own' CHECK (data_scope IN ('own','store','all')),
  system_key text UNIQUE,
  base_role app_role NOT NULL DEFAULT 'visualizador',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_roles TO authenticated;
GRANT ALL ON public.custom_roles TO service_role;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read roles" ON public.custom_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage roles" ON public.custom_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER custom_roles_updated_at BEFORE UPDATE ON public.custom_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read perms" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage perms" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- Seed system roles
INSERT INTO public.custom_roles (name, description, color, data_scope, system_key, base_role) VALUES
 ('Gerente','GestÃ£o completa da loja','primary','all','gerente','gerente'),
 ('Vendedor','Vende o estoque da loja','neutral','own','vendedor','vendedor'),
 ('Vendedor +','Vende e cadastra veÃ­culos','primary','own','vendedor_plus','vendedor_plus'),
 ('Vendedor ++','Vendas internas e externas','warning','own','vendedor_externo','vendedor_externo'),
 ('Revendedor','Parceiro externo com estoque prÃ³prio','warning','own','revendedor','revendedor'),
 ('Visualizador','Apenas consulta','neutral','store','visualizador','visualizador');

INSERT INTO public.role_permissions (role_id, permission)
SELECT r.id, p FROM public.custom_roles r, unnest(CASE r.system_key
  WHEN 'gerente' THEN ARRAY['page.dashboard','page.vehicles','page.sales','page.external_sales','page.financing','page.contracts','page.consignments','page.moto_invoices','page.organization','page.payroll','page.ads','page.reports','page.settings','sales.create','sales.edit','sales.delete','vehicles.create','vehicles.edit','vehicles.delete','vehicles.unlock_all','finance.view_margins','data.export','contracts.manage','payroll.manage','access.elevated']
  WHEN 'vendedor' THEN ARRAY['page.dashboard','page.vehicles','page.sales','page.financing','page.settings','sales.create']
  WHEN 'vendedor_plus' THEN ARRAY['page.dashboard','page.vehicles','page.sales','page.financing','page.settings','sales.create','vehicles.create']
  WHEN 'vendedor_externo' THEN ARRAY['page.dashboard','page.vehicles','page.sales','page.external_sales','page.financing','page.settings','sales.create','vehicles.create','vehicles.unlock_year']
  WHEN 'revendedor' THEN ARRAY['page.dashboard','page.vehicles','page.settings']
  ELSE ARRAY['page.dashboard','page.vehicles','page.settings'] END) AS p;

UPDATE public.user_roles ur SET custom_role_id = cr.id
FROM public.custom_roles cr WHERE cr.system_key = ur.role::text AND ur.custom_role_id IS NULL;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.custom_roles cr ON cr.id = ur.custom_role_id AND cr.is_active
    JOIN public.role_permissions rp ON rp.role_id = cr.id
    WHERE ur.user_id = _user_id AND rp.permission = _perm)
$$;

CREATE OR REPLACE FUNCTION public.user_data_scope(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.has_role(_user_id,'admin') THEN 'all' ELSE COALESCE((
    SELECT CASE MAX(CASE cr.data_scope WHEN 'all' THEN 3 WHEN 'store' THEN 2 ELSE 1 END)
      WHEN 3 THEN 'all' WHEN 2 THEN 'store' ELSE 'own' END
    FROM public.user_roles ur JOIN public.custom_roles cr ON cr.id = ur.custom_role_id AND cr.is_active
    WHERE ur.user_id = _user_id), 'own') END
$$;

CREATE OR REPLACE FUNCTION public.has_elevated_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR public.has_permission(_user_id,'access.elevated')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='gerente' AND custom_role_id IS NULL)
$$;

CREATE OR REPLACE FUNCTION public.can_create_sales(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(_user_id,'sales.create') OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND custom_role_id IS NULL
      AND role::text IN ('admin','gerente','vendedor','vendedor_plus','vendedor_externo'))
$$;

CREATE OR REPLACE FUNCTION public.can_register_vehicles(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_elevated_access(_user_id) OR public.has_permission(_user_id,'vehicles.create') OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND custom_role_id IS NULL
      AND role::text IN ('vendedor_plus','vendedor_externo'))
$$;

CREATE POLICY "View contracts by role scope" ON public.contracts FOR SELECT TO authenticated
USING (public.user_data_scope(auth.uid()) = 'all'
  OR (public.user_data_scope(auth.uid()) = 'store' AND store_id = public.get_user_store_id(auth.uid())));
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_data_scope(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_data_scope(uuid) TO authenticated;
ALTER TABLE public.financing_banks ADD COLUMN IF NOT EXISTS lien_holder text;
INSERT INTO public.role_permissions (role_id, permission)
SELECT id, p FROM public.custom_roles, unnest(ARRAY['sales.edit','sales.delete']) p
WHERE system_key = 'vendedor_plus'
ON CONFLICT (role_id, permission) DO NOTHING;

DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;
CREATE POLICY "Admins or permitted owners can delete contracts" ON public.contracts
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin')
  OR (created_by = auth.uid() AND (public.has_permission(auth.uid(),'sales.delete')
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND custom_role_id IS NULL AND role::text = 'vendedor_plus'))));
CREATE OR REPLACE FUNCTION public.can_register_vehicles(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.has_elevated_access(_user_id) OR public.has_permission(_user_id,'vehicles.create') OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND custom_role_id IS NULL
      AND role::text IN ('vendedor','vendedor_plus','vendedor_externo'))
$function$;
-- Liberar cadastro de veÃ­culos para todos os vendedores (vendedor, vendedor_plus, vendedor_externo)

-- 1. Garantir permissÃ£o 'vehicles.create' nos cargos de sistema de vendedores
INSERT INTO public.role_permissions (role_id, permission)
SELECT id, 'vehicles.create'
FROM public.custom_roles
WHERE system_key IN ('vendedor', 'vendedor_plus', 'vendedor_externo')
ON CONFLICT (role_id, permission) DO NOTHING;

-- 2. Atualizar funÃ§Ã£o can_register_vehicles para considerar todos os cargos de vendedor (com ou sem custom_role_id)
CREATE OR REPLACE FUNCTION public.can_register_vehicles(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_elevated_access(_user_id)
    OR public.has_permission(_user_id, 'vehicles.create')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text IN ('admin', 'gerente', 'vendedor', 'vendedor_plus', 'vendedor_externo')
    )
$function$;

-- 3. Atualizar polÃ­tica de INSERT em public.vehicles para permitir cadastro por vendedores mesmo se get_user_store_id for nulo
DROP POLICY IF EXISTS "Vendedor plus can register vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Sellers can register vehicles" ON public.vehicles;

CREATE POLICY "Sellers can register vehicles"
ON public.vehicles
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_register_vehicles(auth.uid())
  AND (
    public.has_elevated_access(auth.uid())
    OR public.get_user_store_id(auth.uid()) IS NULL
    OR store_id = public.get_user_store_id(auth.uid())
  )
);
-- CriaÃ§Ã£o da tabela de solicitaÃ§Ãµes de aprovaÃ§Ã£o de alÃ§ada comercial e margem
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_name TEXT NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  store_name TEXT,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  vehicle_label TEXT NOT NULL,
  original_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  requested_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  purchase_price NUMERIC(12,2),
  projected_profit NUMERIC(12,2),
  margin_percent NUMERIC(5,2),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'expirado')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ãndices de consulta rÃ¡pida
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_seller ON public.approval_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_vehicle ON public.approval_requests(vehicle_id);

-- Habilitar RLS
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- PolÃ­ticas de RLS:
-- 1. Qualquer usuÃ¡rio autenticado pode criar solicitaÃ§Ãµes
CREATE POLICY "Qualquer autenticado pode solicitar aprovaÃ§Ã£o"
  ON public.approval_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. VisualizaÃ§Ã£o: Vendedor vÃª as prÃ³prias, gerentes e admins veem todas
CREATE POLICY "VisualizaÃ§Ã£o de aprovaÃ§Ãµes por perfil"
  ON public.approval_requests
  FOR SELECT
  TO authenticated
  USING (
    seller_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'gerente')
    )
  );

-- 3. AtualizaÃ§Ã£o: Gerentes e admins podem aprovar/rejeitar
CREATE POLICY "GestÃ£o de aprovaÃ§Ãµes por gerentes e admins"
  ON public.approval_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'gerente')
    )
  );
