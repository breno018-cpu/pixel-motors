import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VehicleColor {
  id: string;
  name: string;
  hex: string | null;
  /** Segunda cor (classificação bicolor). Nulo quando a cor é sólida. */
  hex_secondary: string | null;
  /** Mantido por compatibilidade; a abrangência real vem de model_scope + vehicle_model_ids. */
  vehicle_model_id: string | null;
  /** Modelos selecionados (usados como lista ou como exceções). */
  vehicle_model_ids: string[];
  /** 'todos' = qualquer modelo; 'apenas' = só os selecionados; 'exceto' = todos menos os selecionados. */
  model_scope: ColorModelScope;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ColorModelScope = 'todos' | 'apenas' | 'exceto';

/** Decide se a cor está disponível para um modelo do catálogo. */
export function colorAppliesToModel(color: VehicleColor, modelId: string | null): boolean {
  const ids = color.vehicle_model_ids || [];
  const scope: ColorModelScope = color.model_scope || 'todos';
  if (scope === 'todos' || ids.length === 0) {
    return !color.vehicle_model_id || color.vehicle_model_id === modelId;
  }
  if (!modelId) return scope === 'exceto';
  return scope === 'apenas' ? ids.includes(modelId) : !ids.includes(modelId);
}

export function useVehicleColors() {
  return useQuery({
    queryKey: ['vehicle-colors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_colors')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as VehicleColor[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveVehicleColor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id?: string;
      data: {
        name: string;
        hex?: string | null;
        hex_secondary?: string | null;
        vehicle_model_id?: string | null;
        vehicle_model_ids?: string[];
        model_scope?: ColorModelScope;
        is_active?: boolean;
      };
    }) => {
      const payload = { ...data, name: data.name.replace(/\s+/g, ' ').trim().toUpperCase() };
      const query = id
        ? supabase.from('vehicle_colors').update(payload).eq('id', id).select().single()
        : supabase.from('vehicle_colors').insert(payload as never).select().single();
      const { data: row, error } = await query;
      if (error) throw error;
      return row as VehicleColor;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-colors'] });
      toast({ title: 'Cor salva', description: 'Catálogo de cores atualizado.' });
    },
    onError: (error: { message?: string; code?: string }) =>
      toast({
        variant: 'destructive',
        title: error?.code === '23505' ? 'Cor já cadastrada' : 'Erro ao salvar cor',
        description: error?.message || 'Tente novamente.',
      }),
  });
}

export function useDeleteVehicleColor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicle_colors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-colors'] });
      toast({ title: 'Cor removida' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao remover cor' }),
  });
}
