import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';

export interface Reseller {
  id: string;
  user_id: string | null;
  store_id: string | null;
  partner_type: 'parceiro_externo' | 'consignado' | 'interno';
  full_name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  commission_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Revendedores = parceiros EXTERNOS.
 * Vendedores internos ficam em `employees` (useEmployees) e nunca aparecem aqui.
 */
export function useResellers() {
  return useQuery({
    queryKey: ['resellers'],
    queryFn: async () => {
      await ensureSupabaseSession();
      const { data, error } = await supabase
        .from('resellers')
        .select('*')
        .neq('partner_type', 'interno')
        .order('full_name');
      
      if (error) throw error;
      return data as unknown as Reseller[];
    },
  });
}

export function useResellerStats() {
  return useQuery({
    queryKey: ['reseller-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resellers')
        .select('is_active')
        .neq('partner_type', 'interno');
      
      if (error) throw error;
      
      const total = data.length;
      const active = data.filter(r => r.is_active).length;
      
      return { total, active };
    },
  });
}
