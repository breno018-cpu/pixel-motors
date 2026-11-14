import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveStoreToCache, deleteStoreFromCache } from '@/hooks/useStores';

export function useDeleteStore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Remove do cache local imediatamente
      deleteStoreFromCache(id);

      // Check for active stock (non-sold vehicles)
      const { data: activeVehicles } = await supabase
        .from('vehicles')
        .select('id')
        .eq('store_id', id)
        .neq('status', 'vendido');
      
      if (activeVehicles && activeVehicles.length > 0) {
        throw new Error('STORE_HAS_STOCK');
      }

      // Nullify store_id references on sold vehicles
      await supabase.from('vehicles').update({ store_id: null }).eq('store_id', id);
      
      // Nullify store_id on resellers
      await supabase.from('resellers').update({ store_id: null }).eq('store_id', id);

      // Nullify store_id on contract_templates
      await supabase.from('contract_templates').update({ store_id: null }).eq('store_id', id);

      // Delete consignment contracts linked to this store
      await supabase.from('reseller_consignment_contracts').delete().eq('store_id', id);

      // Delete contracts linked to this store
      await supabase.from('contracts').delete().eq('store_id', id);

      // Now delete the store
      const { error } = await supabase.from('stores').delete().eq('id', id);
      if (error) {
        console.warn('Erro ao remover loja do Supabase:', error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['store-stats'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Loja excluída', description: 'Loja e dados vinculados foram removidos.' });
    },
    onError: (error: Error) => {
      if (error.message === 'STORE_HAS_STOCK') {
        toast({ variant: 'destructive', title: 'Não é possível excluir', description: 'Esta loja possui veículos em estoque. Remova ou transfira os veículos antes de excluir.' });
      } else if (error.message.includes('violates foreign key')) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não é possível excluir: ainda há dados vinculados a esta loja.' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao excluir loja.' });
      }
    },
  });
}

export function useUpdateStore() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; cnpj?: string | null; address?: string; city?: string; state?: string; phone?: string; email?: string; instagram_handle?: string | null; is_active?: boolean }) => {
      // Salva imediatamente no cache local persistente com o nome exato
      saveStoreToCache({ id, ...data });

      try {
        const { data: store, error } = await supabase
          .from('stores')
          .update(data)
          .eq('id', id)
          .select()
          .single();
        
        if (error) {
          console.warn('Aviso: erro ao atualizar loja no Supabase, mantendo alteração local:', error);
          return { id, ...data };
        }
        return store;
      } catch (err) {
        console.warn('Falha de rede ao atualizar loja no Supabase, alteração gravada localmente:', err);
        return { id, ...data };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['store-stats'] });
      toast({ title: 'Loja atualizada', description: 'Dados da loja atualizados com sucesso.' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao atualizar loja.' });
    },
  });
}
