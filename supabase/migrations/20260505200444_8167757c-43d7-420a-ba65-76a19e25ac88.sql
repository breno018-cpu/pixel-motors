
-- Tabela de funcionários (independente do auth, mas pode ser vinculada)
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
