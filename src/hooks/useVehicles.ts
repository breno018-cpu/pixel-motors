import { useQuery } from '@tanstack/react-query';
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

const VEHICLES_CACHE_KEY = 'dealflow_vehicles_cache_v2';
const LEGACY_CACHE_KEYS = ['dealflow_vehicles_cache_v1', 'df_local_table_v5_vehicles'];

export function getCachedVehicles(): Vehicle[] {
  if (typeof window === 'undefined') return [];
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
  } catch (err) {
    console.error('Erro ao ler cache local de veículos:', err);
  }
  return [];
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
      try {
        await ensureSupabaseSession();
        const { data, error } = await supabase
          .from('vehicles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const local = getCachedVehicles();
          const remoteIds = new Set(data.map((v) => v.id));
          const localOnly = local.filter((v) => !remoteIds.has(v.id));
          const merged = [...(data as Vehicle[]), ...localOnly];
          saveVehiclesToCache(merged);
          return merged;
        }
      } catch (err) {
        console.warn('Consulta remota de veículos falhou, usando cache local:', err);
      }

      // Fallback para cache local
      const cached = getCachedVehicles();
      if (cached.length > 0) {
        return cached;
      }

      // Se o cache estiver vazio, tenta recuperar lotes de recebimento de carga gravados
      try {
        const rawBatches = localStorage.getItem('pixel_inbound_cargo_batches_v3');
        if (rawBatches) {
          const batches = JSON.parse(rawBatches);
          if (Array.isArray(batches)) {
            const extracted: Vehicle[] = [];
            batches.forEach((b: any) => {
              (b.items || []).forEach((item: any) => {
                if (item.chassis) {
                  extracted.push({
                    id: item.id || `inbound-${item.chassis}`,
                    store_id: b.target_store_id || 'store-divinopolis',
                    reseller_id: null,
                    brand: item.brand || 'SHINERAY',
                    model: item.model || 'MOTO SHINERAY',
                    year: new Date().getFullYear(),
                    manufacture_year: new Date().getFullYear(),
                    color: item.color || 'Preta',
                    plate: null,
                    chassis: item.chassis,
                    renavam: null,
                    mileage: 0,
                    fuel_type: 'gasolina',
                    transmission: 'manual',
                    purchase_price: null,
                    sale_price: null,
                    status: item.status === 'divergente' ? 'reservado' : 'disponivel',
                    images: null,
                    notes: `Recebido no lote ${b.batch_number || ''}`,
                    vehicle_type: 'moto',
                    engine_cc: 125,
                    warranty_months: 12,
                    revision_period_months: 6,
                    revision_period_km: 1000,
                    created_at: b.created_at || new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                }
              });
            });
            if (extracted.length > 0) {
              saveVehiclesToCache(extracted);
              return extracted;
            }
          }
        }
      } catch {}

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
