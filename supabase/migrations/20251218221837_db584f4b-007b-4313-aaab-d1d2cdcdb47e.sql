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