import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_OFFICIAL_USERS } from '@/lib/userService';
import { STORE_MONTESCLAROS_UUID, STORE_DIVINOPOLIS_UUID } from '@/lib/storeResolution';
import { isValidSellerName } from '@/lib/sellerSanitizer';

export interface CommissionTier {
  min_qty: number;
  max_qty: number | null; // null means open-ended (e.g. 10+)
  value_per_sale: number;
}

export type AdditionType =
  | 'fixed'           // valor fixo (R$) configurado
  | 'percent_salary'  // % do salário base
  | 'percent_sales'   // % do total vendido pelo funcionário no mês
  | 'per_sale'        // valor × qtd. de vendas do mês
  | 'manual';         // sempre vazio — digitar no contracheque

export interface SalaryAddition {
  id: string;
  name: string;
  type: AdditionType;
  value: number;
  is_discount?: boolean;
}

export interface Employee {
  id: string;
  profile_id: string | null;
  store_id: string | null;
  full_name: string;
  cpf: string | null;
  role: string;
  position: string | null;
  base_salary: number;
  commission_rate: number;
  commission_tiers: CommissionTier[];
  commission_type: 'percentage' | 'tiered' | 'fixed_value';
  manager_commission_rate: number;
  transport_allowance: number;
  meal_allowance: number;
  other_allowance: number;
  salary_additions: SalaryAddition[];
  hire_date: string | null;
  phone: string | null;
  email: string | null;
  pix_key: string | null;
  bank_info: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  store?: { id: string; name: string } | null;
}

const FALLBACK_EMPLOYEES: Employee[] = DEFAULT_OFFICIAL_USERS.map((u) => {
  const isMoc = (u.store_name || '').includes('Montes Claros') || (u.store_id || '').includes('montes');
  return {
    id: u.id,
    profile_id: u.id,
    store_id: isMoc ? STORE_MONTESCLAROS_UUID : STORE_DIVINOPOLIS_UUID,
    full_name: u.full_name,
    cpf: u.cpf || null,
    role: u.role,
    position:
      u.role === 'admin'
        ? 'Diretor Geral'
        : u.role === 'gerente'
        ? 'Gerente Geral'
        : u.role === 'vendedor_plus'
        ? 'Consultor(a) de Vendas Sênior'
        : 'Consultor(a) de Vendas',
    base_salary: 2200,
    commission_rate: 1.5,
    commission_tiers: [],
    commission_type: 'percentage',
    manager_commission_rate: 0,
    transport_allowance: 0,
    meal_allowance: 0,
    other_allowance: 0,
    salary_additions: [],
    hire_date: '2025-01-01',
    phone: null,
    email: u.email,
    pix_key: null,
    bank_info: null,
    is_active: u.is_active !== false,
    notes: null,
    created_at: u.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    store: {
      id: isMoc ? STORE_MONTESCLAROS_UUID : STORE_DIVINOPOLIS_UUID,
      name: isMoc ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis',
    },
  };
});

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      await ensureSupabaseSession();
      try {
        const { data, error } = await (supabase as any)
          .from('employees')
          .select('*, store:stores(id, name)')
          .order('full_name');
        if (!error && Array.isArray(data) && data.length > 0) {
          const valid = data.filter((e: any) => isValidSellerName(e.full_name));
          if (valid.length > 0) {
            return valid as Employee[];
          }
        }
      } catch {}
      return FALLBACK_EMPLOYEES;
    },
  });
}

export function useUpsertEmployee() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<Employee> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = { ...input };
      if (!input.id) payload.created_by = u.user?.id;
      const { data, error } = await (supabase as any)
        .from('employees')
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'Funcionário salvo' });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: 'Erro', description: e?.message }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('employees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'Funcionário removido' });
    },
  });
}