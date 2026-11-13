import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';
import officialVehiclesSeed from '@/data/officialVehiclesSeed.json';

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

const VEHICLES_CACHE_KEY = 'dealflow_vehicles_cache_v2';
const LEGACY_CACHE_KEYS = ['dealflow_vehicles_cache_v1', 'df_local_table_v5_vehicles'];

const typedOfficialSeed = (officialVehiclesSeed as unknown as Vehicle[]) || [];

export function getCachedVehicles(): Vehicle[] {
  if (typeof window === 'undefined') return typedOfficialSeed;
  try {
    const raw = localStorage.getItem(VEHICLES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    for (const key of LEGACY_CACHE_KEYS) {
      const leg = localStorage.getItem(key);
      if (leg) {
        const parsed = JSON.parse(leg);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localStorage.setItem(VEHICLES_CACHE_KEY, leg);
          return parsed;
        }
      }
    }
    // Inicialização direta com a base oficial do pátio
    if (typedOfficialSeed.length > 0) {
      localStorage.setItem(VEHICLES_CACHE_KEY, JSON.stringify(typedOfficialSeed));
      return typedOfficialSeed;
    }
  } catch (err) {
    console.error('Erro ao ler cache local de veículos:', err);
  }
  return typedOfficialSeed;
}

export function saveVehicleToCache(vehicle: Vehicle): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getCachedVehicles();
    const idx = list.findIndex((v) => v.id === vehicle.id || (vehicle.chassis && v.chassis === vehicle.chassis));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...vehicle };
    } else {
      list.unshift(vehicle);
    }
    localStorage.setItem(VEHICLES_CACHE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Erro ao salvar veículo no cache:', err);
  }
}

export function saveVehiclesToCache(newVehicles: Vehicle[]): void {
  if (typeof window === 'undefined' || !newVehicles.length) return;
  try {
    const list = getCachedVehicles();
    const map = new Map<string, Vehicle>();
    list.forEach((v) => map.set(v.id, v));
    newVehicles.forEach((v) => map.set(v.id, { ...(map.get(v.id) || {}), ...v }));
    const combined = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    localStorage.setItem(VEHICLES_CACHE_KEY, JSON.stringify(combined));
  } catch (err) {
    console.error('Erro ao salvar veículos em lote no cache:', err);
  }
}

export function removeVehicleFromCache(vehicleId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getCachedVehicles().filter((v) => v.id !== vehicleId);
    localStorage.setItem(VEHICLES_CACHE_KEY, JSON.stringify(list));
  } catch {}
}

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      // 1. Obtém o estoque imediatamente disponível (cache do navegador ou catálogo oficial incorporado)
      let currentList = getCachedVehicles();

      // 2. Tenta sincronização remota com o Supabase
      try {
        await ensureSupabaseSession();
        const { data, error } = await supabase
          .from('vehicles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const remoteIds = new Set(data.map((v) => v.id));
          const localOnly = currentList.filter((v) => !remoteIds.has(v.id));
          const merged = [...(data as Vehicle[]), ...localOnly];
          saveVehiclesToCache(merged);
          return merged;
        }
      } catch (err) {
        console.warn('Consulta remota de veículos falhou, usando estoque local:', err);
      }

      // 3. Fallback garantido: assegura que o vendedor sempre tenha todo o catálogo disponível para vendas e consultas
      if (currentList.length > 0) {
        return currentList;
      }

      if (typedOfficialSeed.length > 0) {
        saveVehiclesToCache(typedOfficialSeed);
        return typedOfficialSeed;
      }

      return [];
    },
    staleTime: 30 * 1000,
  });
}

export function useVehicleStats() {
  const { data: vehicles = [] } = useVehicles();

  return useQuery({
    queryKey: ['vehicle-stats', vehicles.length],
    queryFn: async () => {
      let list = vehicles;
      if (!list || list.length === 0) {
        list = getCachedVehicles();
      }

      const total = list.length;
      const disponivel = list.filter((v) => v.status === 'disponivel').length;
      const reservado = list.filter((v) => v.status === 'reservado').length;
      const vendido = list.filter((v) => v.status === 'vendido').length;

      // Count by vehicle type (only available/reserved)
      const activeVehicles = list.filter((v) => v.status !== 'vendido');
      const carros = activeVehicles.filter((v) => v.vehicle_type !== 'moto').length;
      const motos = activeVehicles.filter((v) => v.vehicle_type === 'moto').length;

      return { total, disponivel, reservado, vendido, carros, motos };
    },
    staleTime: 30 * 1000,
  });
}
