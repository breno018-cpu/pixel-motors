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

      // Se a transferência estiver com status concluída, atualiza o pátio da loja no veículo
      if (input.status === 'concluida') {
        const vehiclePatch: Record<string, any> = {};
        if (input.to_store_id) {
          vehiclePatch.store_id = input.to_store_id;
          vehiclePatch.reseller_id = input.to_reseller_id || null;
        } else if (input.to_reseller_id) {
          vehiclePatch.reseller_id = input.to_reseller_id;
        }
        if (Object.keys(vehiclePatch).length > 0) {
          try {
            await (supabase as any)
              .from('vehicles')
              .update(vehiclePatch)
              .eq('id', input.vehicle_id);
          } catch (updateErr) {
            console.warn('Falha ao atualizar pátio do veículo pós-transferência:', updateErr);
          }
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Transferência registrada com sucesso!' });
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
      const { data, error } = await (supabase as any)
        .from('stock_transfers')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      if (patch.status === 'concluida') {
        const vehiclePatch: Record<string, any> = {};
        if (patch.to_store_id) {
          vehiclePatch.store_id = patch.to_store_id;
          vehiclePatch.reseller_id = patch.to_reseller_id || null;
        } else if (patch.to_reseller_id) {
          vehiclePatch.reseller_id = patch.to_reseller_id;
        }
        const targetVehicleId = patch.vehicle_id || data?.vehicle_id;
        if (targetVehicleId && Object.keys(vehiclePatch).length > 0) {
          try {
            await (supabase as any)
              .from('vehicles')
              .update(vehiclePatch)
              .eq('id', targetVehicleId);
          } catch (updateErr) {
            console.warn('Falha ao atualizar pátio do veículo pós-transferência:', updateErr);
          }
        }
      }
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