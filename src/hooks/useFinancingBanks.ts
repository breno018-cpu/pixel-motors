import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FinancingBank {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  lien_holder?: string | null;
  created_at: string;
}

/** Texto de alienação: usa a razão social configurada no banco (ex.: MOTRIX → QI TECH SCD S.A.). */
export function alienationText(bankName: string | null | undefined, banks: FinancingBank[] = []) {
  const name = (bankName || '').trim();
  if (!name) return 'ALIENADO — BANCO A INFORMAR';
  const b = banks.find((x) => x.name.trim().toUpperCase() === name.toUpperCase());
  const holder = (b?.lien_holder || '').trim();
  return `ALIENADO AO ${(holder || name).toUpperCase()}`;
}

export async function fetchAlienationText(bankName: string | null | undefined) {
  const { data } = await (supabase as any).from('financing_banks').select('*');
  return alienationText(bankName, (data || []) as FinancingBank[]);
}

export function useFinancingBanks() {
  return useQuery({
    queryKey: ['financing_banks'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('financing_banks')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as FinancingBank[];
    },
  });
}

export function useSaveFinancingBank() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<FinancingBank> & { id?: string }) => {
      const payload: any = { ...input };
      if (payload.name) payload.name = String(payload.name).trim().toUpperCase();
      if (payload.id) {
        const { id, ...patch } = payload;
        const { data, error } = await (supabase as any)
          .from('financing_banks')
          .update(patch)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as FinancingBank;
      }
      const { data, error } = await (supabase as any)
        .from('financing_banks')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as FinancingBank;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financing_banks'] });
      toast({ title: 'Banco salvo' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Erro', description: e?.message }),
  });
}

export function useDeleteFinancingBank() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('financing_banks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financing_banks'] });
      toast({ title: 'Banco removido' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Erro', description: e?.message }),
  });
}
