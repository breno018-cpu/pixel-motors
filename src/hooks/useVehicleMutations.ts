import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/lib/audit';
import { recordDeletedVehicle, removeVehicleFromCache, type Vehicle } from '@/hooks/useVehicles';

export function useUpdateVehicleStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase
        .from('vehicles')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      logActivity('status', 'veiculo', id, { status });
      return data;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      
      const statusLabels: Record<string, string> = {
        disponivel: 'disponível',
        reservado: 'reservado',
        vendido: 'vendido',
      };
      
      toast({ 
        title: 'Status atualizado', 
        description: `Veículo marcado como ${statusLabels[status] || status}.` 
      });
    },
    onError: () => {
      toast({ 
        variant: 'destructive', 
        title: 'Erro', 
        description: 'Erro ao atualizar status do veículo.' 
      });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { data: vehicle, error } = await supabase
        .from('vehicles')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      logActivity('editar', 'veiculo', id, data);
      return vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Veículo atualizado', description: 'Alterações salvas com sucesso.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao atualizar veículo.' });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Marca imediatamente como deletado e remove do cache local (<5ms)
      recordDeletedVehicle(id);
      removeVehicleFromCache(id);

      // 2. Atualização otimista imediata no React Query cache para UI instantânea
      queryClient.setQueryData<Vehicle[]>(['vehicles'], (old) => {
        if (!old) return [];
        return old.filter((v) => v.id !== id);
      });

      // 3. Executa exclusão no Supabase com tolerância a constraints
      try {
        await ensureSupabaseSession();
        const { error } = await supabase
          .from('vehicles')
          .delete()
          .eq('id', id);

        if (error) {
          if (error.message.includes('violates foreign key')) {
            // Se possui contrato ou venda registrada, arquiva de forma limpa para não travar
            const { error: archErr } = await supabase
              .from('vehicles')
              .update({ status: 'vendido', notes: '[ARQUIVADO/EXCLUÍDO]' } as any)
              .eq('id', id);
            if (archErr) throw error;
          } else {
            throw error;
          }
        }

        // Audita assincronamente sem travar a requisição
        void logActivity('excluir', 'veiculo', id);
      } catch (err: any) {
        if (!err?.message?.includes('violates foreign key')) {
          console.warn('[useDeleteVehicle] Erro na exclusão remota do veículo:', err);
        } else {
          throw err;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-stats'] });
      toast({ title: 'Veículo excluído', description: 'Veículo removido do estoque com sucesso.' });
    },
    onError: (error: Error) => {
      let message = 'Erro ao excluir veículo.';
      if (error.message.includes('violates foreign key')) {
        message = 'Não é possível excluir: veículo já vinculado a contratos ou vendas concluídas.';
      }
      toast({ variant: 'destructive', title: 'Erro', description: message });
    },
  });
}

export function useTransferVehicle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, store_id }: { id: string; store_id: string }) => {
      const { data, error } = await supabase
        .from('vehicles')
        .update({ store_id, reseller_id: null })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      logActivity('transferir', 'veiculo', id, { store_id });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({ title: 'Veículo transferido', description: 'Veículo transferido para nova loja.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao transferir veículo.' });
    },
  });
}

export function useTransferToReseller() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, reseller_id }: { id: string; reseller_id: string }) => {
      const { data, error } = await supabase
        .from('vehicles')
        .update({ reseller_id })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      logActivity('transferir', 'veiculo', id, { reseller_id });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({ title: 'Veículo transferido', description: 'Veículo agora está sob responsabilidade do revendedor.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao transferir veículo para revendedor.' });
    },
  });
}

export function useReturnToStore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('vehicles')
        .update({ reseller_id: null })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      logActivity('transferir', 'veiculo', id, { devolvido: true });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast({ title: 'Veículo devolvido', description: 'Veículo retornou ao estoque da loja.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao devolver veículo.' });
    },
  });
}
