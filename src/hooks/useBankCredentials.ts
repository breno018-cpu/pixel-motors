import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BankCredential {
  id: string;
  store_id: string;
  bank_code: string;
  bank_name: string;
  client_id: string | null;
  client_secret: string | null;
  api_environment: 'sandbox' | 'producao';
  partner_code: string | null;
  extra_config: Record<string, any>;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  store?: { id: string; name: string } | null;
}

export const SUPPORTED_BANKS = [
  { code: 'altis', name: 'ALTIS Financiamentos' },
  { code: 'motrix', name: 'MOTRIX Financeira' },
  { code: 'pan', name: 'Banco Pan' },
  { code: 'bradesco', name: 'Bradesco Financiamentos' },
  { code: 'santander', name: 'Santander Financiamentos (Use Car / F1)' },
  { code: 'bv', name: 'BV Financeira' },
  { code: 'itau', name: 'Itaú Financiamentos' },
  { code: 'omni', name: 'Omni Banco' },
  { code: 'safra', name: 'Safra Financeira' },
  { code: 'caixa', name: 'Caixa Econômica' },
];

export function useBankCredentials() {
  return useQuery({
    queryKey: ['bank_credentials'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('bank_credentials')
        .select('*, store:stores(id, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as BankCredential[];
    },
  });
}

export function useUpsertBankCredential() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<BankCredential> & { id?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = { ...input };
      delete payload.store;
      if (!input.id) payload.created_by = u.user?.id;
      const { data, error } = await (supabase as any)
        .from('bank_credentials')
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_credentials'] });
      toast({ title: 'Credencial salva' });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: 'Erro', description: e?.message }),
  });
}

export function useDeleteBankCredential() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('bank_credentials')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank_credentials'] });
      toast({ title: 'Credencial removida' });
    },
  });
}