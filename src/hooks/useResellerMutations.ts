import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useDeactivateReseller() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('resellers')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
      queryClient.invalidateQueries({ queryKey: ['reseller-stats'] });
      toast({ 
        title: is_active ? 'Revendedor ativado' : 'Revendedor desativado', 
        description: is_active 
          ? 'O revendedor pode realizar vendas novamente.' 
          : 'O revendedor foi desativado do sistema.' 
      });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Erro', description: 'Erro ao atualizar status do revendedor.' });
    },
  });
}

export function useUpdateReseller() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; full_name?: string; cpf?: string; phone?: string; email?: string; store_id?: string; commission_rate?: number }) => {
      const { data: reseller, error } = await supabase
        .from('resellers')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return reseller;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resellers'] });
      toast({ title: 'Revendedor atualizado', description: 'Dados do revendedor atualizados.' });
    },
    onError: (error: Error) => {
      let message = 'Erro ao atualizar revendedor.';
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        message = 'CPF já cadastrado para outro revendedor.';
      }
      toast({ variant: 'destructive', title: 'Erro', description: message });
    },
  });
}
