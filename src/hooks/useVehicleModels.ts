import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';
import { useToast } from '@/hooks/use-toast';

export interface VehicleModel {
  id: string;
  brand: string;
  model: string;
  vehicle_type: 'carro' | 'moto';
  engine_cc: number | null;
  fuel_type: string | null;
  transmission: string | null;
  warranty_months: number | null;
  revision_period_months: number | null;
  revision_period_km: number | null;
  default_purchase_price: number | null;
  default_sale_price: number | null;
  promo_price: number | null;
  promo_active: boolean;
  promo_label: string | null;
  promo_ends_on: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type VehicleModelInput = Omit<VehicleModel, 'id' | 'created_at' | 'updated_at'>;

/**
 * Preço vigente do modelo.
 * Regra: o preço de tabela, quando preenchido, é FIXO — promoções não o alteram.
 * A promoção só vale como preço vigente quando o modelo não tem preço de tabela.
 */
export function effectiveModelPrice(model: {
  default_sale_price: number | null;
  promo_price?: number | null;
  promo_active?: boolean | null;
  promo_ends_on?: string | null;
}): { price: number | null; isPromo: boolean } {
  const table = model.default_sale_price;
  if (table != null && table > 0) return { price: table, isPromo: false };

  const expired = model.promo_ends_on ? new Date(`${model.promo_ends_on}T23:59:59`) < new Date() : false;
  if (model.promo_active && model.promo_price != null && model.promo_price > 0 && !expired) {
    return { price: model.promo_price, isPromo: true };
  }
  return { price: null, isPromo: false };
}

export function useVehicleModels() {
  return useQuery({
    queryKey: ['vehicle-models'],
    queryFn: async () => {
      await ensureSupabaseSession();
      const { data, error } = await supabase
        .from('vehicle_models')
        .select('*')
        .order('brand')
        .order('model');
      if (error) throw error;
      return (data || []) as VehicleModel[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveVehicleModel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Partial<VehicleModelInput> }) => {
      const payload = {
        ...data,
        brand: data.brand?.trim(),
        model: data.model?.trim(),
      };
      const query = id
        ? supabase.from('vehicle_models').update(payload).eq('id', id).select().single()
        : supabase.from('vehicle_models').insert(payload as never).select().single();
      const { data: row, error } = await query;
      if (error) throw error;
      return row as VehicleModel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-models'] });
      toast({ title: 'Modelo salvo', description: 'Catálogo de modelos atualizado.' });
    },
    onError: (error: { message?: string; code?: string }) => {
      const duplicate = error?.code === '23505';
      toast({
        variant: 'destructive',
        title: duplicate ? 'Modelo já existe' : 'Erro ao salvar modelo',
        description: duplicate
          ? 'Já existe um modelo com essa marca e nome para este tipo de veículo.'
          : error?.message || 'Tente novamente.',
      });
    },
  });
}

export function useDeleteVehicleModel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicle_models').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-models'] });
      toast({ title: 'Modelo removido' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao remover modelo' }),
  });
}
