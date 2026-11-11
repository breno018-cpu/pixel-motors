import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';

export interface Vehicle {
  id: string;
  store_id: string | null;
  reseller_id: string | null;
  brand: string;
  model: string;
  year: number;
  manufacture_year: number | null;
  color: string | null;
  plate: string | null;
  chassis: string | null;
  renavam: string | null;
  mileage: number;
  fuel_type: string | null;
  transmission: string | null;
  purchase_price: number | null;
  sale_price: number | null;
  status: 'disponivel' | 'reservado' | 'vendido';
  images: string[] | null;
  notes: string | null;
  vehicle_type: 'carro' | 'moto' | null;
  engine_cc: number | null;
  warranty_months: number | null;
  revision_period_months: number | null;
  revision_period_km: number | null;
  created_at: string;
  updated_at: string;
}

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      await ensureSupabaseSession();
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as Vehicle[];
    },
  });
}

export function useVehicleStats() {
  return useQuery({
    queryKey: ['vehicle-stats'],
    queryFn: async () => {
      await ensureSupabaseSession();
      const { data, error } = await supabase
        .from('vehicles')
        .select('status, vehicle_type');
      
      if (error) throw error;
      
      const total = data.length;
      const disponivel = data.filter(v => v.status === 'disponivel').length;
      const reservado = data.filter(v => v.status === 'reservado').length;
      const vendido = data.filter(v => v.status === 'vendido').length;
      
      // Count by vehicle type (only available/reserved)
      const activeVehicles = data.filter(v => v.status !== 'vendido');
      const carros = activeVehicles.filter(v => v.vehicle_type !== 'moto').length;
      const motos = activeVehicles.filter(v => v.vehicle_type === 'moto').length;
      
      return { total, disponivel, reservado, vendido, carros, motos };
    },
  });
}
