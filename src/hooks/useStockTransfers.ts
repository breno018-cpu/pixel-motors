import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type TransferType =
  | 'loja_para_loja'
  | 'loja_para_revendedor'
  | 'revendedor_para_loja'
  | 'parceiro_externo';

export type TransferStatus = 'pendente' | 'concluida' | 'cancelada';

export interface StockTransfer {
  id: string;
  vehicle_id: string;
  transfer_type: TransferType;
  from_store_id: string | null;
  to_store_id: string | null;
  from_reseller_id: string | null;
  to_reseller_id: string | null;
  partner_name: string | null;
  agreed_amount: number;
  received_amount: number;
  status: TransferStatus;
  transfer_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  vehicle?: {
    id: string;
    brand: string;
    model: string;
    year: number;
    color: string | null;
    chassis: string | null;
    vehicle_type: string | null;
    status: string;
  } | null;
  from_store?: { id: string; name: string } | null;
  to_store?: { id: string; name: string } | null;
  to_reseller?: { id: string; full_name: string } | null;
}

export const TRANSFER_TYPE_LABEL: Record<TransferType, string> = {
  loja_para_loja: 'Entre lojas',
  loja_para_revendedor: 'Loja → Revendedor',
  revendedor_para_loja: 'Revendedor → Loja',
  parceiro_externo: 'Venda a parceiro externo',
};

export function useStockTransfers() {
  return useQuery({
    queryKey: ['stock-transfers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('stock_transfers')
        .select(`
          *,
          vehicle:vehicles(id, brand, model, year, color, chassis, vehicle_type, status),
          from_store:stores!stock_transfers_from_store_id_fkey(id, name),
          to_store:stores!stock_transfers_to_store_id_fkey(id, name),
          to_reseller:resellers!stock_transfers_to_reseller_id_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as StockTransfer[];
    },
  });
}

export interface CreateTransferInput {
  vehicle_id: string;
  transfer_type: TransferType;
  from_store_id?: string | null;
  to_store_id?: string | null;
  from_reseller_id?: string | null;
  to_reseller_id?: string | null;
  partner_name?: string | null;
  agreed_amount: number;
  received_amount: number;
  status: TransferStatus;
  transfer_date: string;
  notes?: string | null;
}

export function useCreateStockTransfer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateTransferInput) => {
      const { data: userResp } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from('stock_transfers')
        .insert({ ...input, created_by: userResp.user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Transferência registrada' });
    },
    onError: (err: any) =>
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar transferência',
        description: err?.message || 'Tente novamente.',
      }),
  });
}

export function useUpdateStockTransfer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<CreateTransferInput>) => {
      const { error } = await (supabase as any)
        .from('stock_transfers')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Transferência atualizada' });
    },
    onError: (err: any) =>
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: err?.message }),
  });
}

export function useDeleteStockTransfer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('stock_transfers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      toast({ title: 'Transferência excluída' });
    },
    onError: (err: any) =>
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: err?.message }),
  });
}