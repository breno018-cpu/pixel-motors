import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SalesTarget {
  id: string;
  store_id: string | null;
  user_id: string | null;
  month: number;
  year: number;
  target_qty: number;
  target_value: number;
  bonus_on_target: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useSalesTargets(year?: number, month?: number) {
  return useQuery({
    queryKey: ['sales-targets', year, month],
    queryFn: async () => {
      let q = (supabase as any).from('sales_targets').select('*');
      if (year) q = q.eq('year', year);
      if (month) q = q.eq('month', month);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SalesTarget[];
    },
  });
}

export function useSaveSalesTarget() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: Partial<SalesTarget> & { month: number; year: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const row = { ...payload, created_by: user?.id };
      if (payload.id) {
        const { error } = await (supabase as any).from('sales_targets').update(payload).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('sales_targets').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-targets'] });
      toast({ title: 'Meta salva' });
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar meta', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteSalesTarget() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('sales_targets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-targets'] });
      toast({ title: 'Meta removida' });
    },
  });
}

export interface OperatorProfile {
  id: string;
  full_name: string;
}

export function useProfilesList() {
  return useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').order('full_name');
      if (error) throw error;
      return (data || []) as OperatorProfile[];
    },
  });
}