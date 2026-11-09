import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FinancingSimulation {
  id: string;
  store_id: string;
  vehicle_id: string | null;
  bank_code: string;
  customer_name: string;
  customer_document: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_income: number | null;
  customer_birthdate: string | null;
  vehicle_value: number;
  down_payment: number;
  installments: number;
  financed_amount: number;
  monthly_rate: number | null;
  installment_value: number | null;
  total_amount: number | null;
  cet: number | null;
  status: 'pendente' | 'aprovada' | 'recusada' | 'erro';
  response_data: any;
  error_message: string | null;
  created_at: string;
  store?: { id: string; name: string } | null;
}

export function useFinancingSimulations() {
  return useQuery({
    queryKey: ['financing_simulations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('financing_simulations')
        .select('*, store:stores(id, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as FinancingSimulation[];
    },
  });
}

export interface SimulationInput {
  store_id: string;
  bank_code: string;
  customer_name: string;
  customer_document: string;
  customer_phone?: string;
  customer_email?: string;
  customer_income?: number;
  customer_birthdate?: string;
  vehicle_id?: string | null;
  vehicle_value: number;
  down_payment: number;
  installments: number;
}

export function useRunSimulation() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: SimulationInput) => {
      const { data, error } = await supabase.functions.invoke('bank-simulation', {
        body: input,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financing_simulations'] });
      toast({ title: 'Simulação concluída' });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: 'Erro na simulação', description: e?.message }),
  });
}

export function useDeleteSimulation() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('financing_simulations')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financing_simulations'] });
      toast({ title: 'Simulação removida' });
    },
  });
}