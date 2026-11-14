import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    let list: Vehicle[] = [];
    const raw = localStorage.getItem(VEHICLES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
    }

    if (!list || list.length === 0) {
      for (const key of LEGACY_CACHE_KEYS) {
        const leg = localStorage.getItem(key);
        if (leg) {
          const parsed = JSON.parse(leg);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localStorage.setItem(VEHICLES_CACHE_KEY, leg);
            list = parsed;
            break;
          }
        }
      }
    }

    // Inicialização direta com a base oficial do pátio
    if (!list || list.length === 0) {
      if (typedOfficialSeed.length > 0) {
        localStorage.setItem(VEHICLES_CACHE_KEY, JSON.stringify(typedOfficialSeed));
        list = [...typedOfficialSeed];
      }
    }

    // Reconciliação com a Planilha Mensal: qualquer chassi já vendido/faturado é marcado como 'vendido'
    if (list.length > 0) {
      try {
        const rawSheet = localStorage.getItem('dealflow_cloud_monthly_sheet_v9');
        if (rawSheet) {
          const rows: any[] = JSON.parse(rawSheet);
          if (Array.isArray(rows) && rows.length > 0) {
            const soldChassis = new Set<string>();
            const reservedChassis = new Set<string>();

            rows.forEach((r) => {
              const ch = (r.chassi || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
              if (ch.length >= 6 && ch !== 'DISPENSADO') {
                if (r.tipo_registro === 'venda' || r.is_permitted) {
                  soldChassis.add(ch);
                } else if (r.tipo_registro === 'pre_venda') {
                  reservedChassis.add(ch);
                }
              }
            });

            let changed = false;
            list = list.map((v) => {
              const vCh = (v.chassis || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
              if (!vCh || vCh === 'DISPENSADO') return v;

              if (soldChassis.has(vCh) && v.status !== 'vendido') {
                changed = true;
                return { ...v, status: 'vendido' as const, updated_at: new Date().toISOString() };
              }
              if (reservedChassis.has(vCh) && v.status === 'disponivel') {
                changed = true;
                return { ...v, status: 'reservado' as const, updated_at: new Date().toISOString() };
              }
              return v;
            });

            if (changed) {
              localStorage.setItem(VEHICLES_CACHE_KEY, JSON.stringify(list));
            }
          }
        }
      } catch {}
    }

    return list.length > 0 ? list : typedOfficialSeed;
  } catch (err) {
    console.error('Erro ao ler cache local de veículos:', err);
  }
  return typedOfficialSeed;
}

/**
 * Marca um veículo como vendido ou reservado em todos os armazenamentos locais e remotos:
 * 1. dealflow_vehicles_cache_v2
 * 2. df_local_table_v5_vehicles
 * 3. Supabase (tabela vehicles)
 * 4. Dispara evento global de atualização
 */
export async function markVehicleAsSold(
  vehicleIdOrChassis: string,
  newStatus: 'vendido' | 'reservado' = 'vendido',
  assignedChassis?: string | null
): Promise<void> {
  if (typeof window === 'undefined' || !vehicleIdOrChassis) return;

  const rawClean = vehicleIdOrChassis.trim();
  const cleanVinTarget = rawClean.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let matchedId: string | null = null;
  const cleanAssigned = assignedChassis ? assignedChassis.trim().toUpperCase() : null;

  // 1. Atualiza VEHICLES_CACHE_KEY
  try {
    const list = getCachedVehicles();
    let updated = false;
    const nextList = list.map((v) => {
      const vCh = (v.chassis || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const isIdMatch = v.id && v.id.toLowerCase() === rawClean.toLowerCase();
      const isChMatch =
        cleanVinTarget.length >= 5 &&
        vCh &&
        (vCh === cleanVinTarget || (cleanVinTarget.length >= 6 && (vCh.endsWith(cleanVinTarget) || cleanVinTarget.endsWith(vCh))));

      if (isIdMatch || isChMatch) {
        updated = true;
        matchedId = v.id;
        return {
          ...v,
          status: newStatus,
          chassis: cleanAssigned || v.chassis,
          updated_at: new Date().toISOString(),
        };
      }
      return v;
    });

    if (updated) {
      localStorage.setItem(VEHICLES_CACHE_KEY, JSON.stringify(nextList));
    }
  } catch (err) {
    console.error('Erro ao atualizar status do veículo no cache:', err);
  }

  // 2. Atualiza df_local_table_v5_vehicles
  try {
    const rawLocal = localStorage.getItem('df_local_table_v5_vehicles');
    if (rawLocal) {
      const list = JSON.parse(rawLocal);
      if (Array.isArray(list)) {
        let localUpdated = false;
        const nextList = list.map((v: any) => {
          const vCh = (v.chassis || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const isIdMatch = v.id && v.id.toLowerCase() === rawClean.toLowerCase();
          const isChMatch =
            cleanVinTarget.length >= 5 &&
            vCh &&
            (vCh === cleanVinTarget || (cleanVinTarget.length >= 6 && (vCh.endsWith(cleanVinTarget) || cleanVinTarget.endsWith(vCh))));

          if (isIdMatch || isChMatch) {
            localUpdated = true;
            matchedId = matchedId || v.id;
            return {
              ...v,
              status: newStatus,
              chassis: cleanAssigned || v.chassis,
              updated_at: new Date().toISOString(),
            };
          }
          return v;
        });
        if (localUpdated) {
          localStorage.setItem('df_local_table_v5_vehicles', JSON.stringify(nextList));
        }
      }
    }
  } catch {}

  // 3. Atualiza no Supabase se houver conexão
  try {
    const targetId = matchedId || rawClean;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
    const updatePayload: Record<string, any> = { status: newStatus };
    if (cleanAssigned) updatePayload.chassis = cleanAssigned;

    if (isUuid) {
      await (supabase as any).from('vehicles').update(updatePayload).eq('id', targetId);
    } else if (cleanVinTarget.length >= 6) {
      await (supabase as any).from('vehicles').update(updatePayload).ilike('chassis', `%${cleanVinTarget}%`);
    }
  } catch {}

  // 4. Dispara evento global para reatividade instantânea em todas as telas
  try {
    window.dispatchEvent(
      new CustomEvent('dealflow:vehicle-status-updated', {
        detail: {
          target: vehicleIdOrChassis,
          matchedId,
          status: newStatus,
        },
      })
    );
  } catch {}
}

/**
 * Verifica se um determinado chassi já foi vendido ou faturado anteriormente
 */
export function isChassisAlreadySold(
  chassis: string,
  vehiclesList: Vehicle[] = [],
  ignoreVehicleId?: string | null
): { isSold: boolean; reason?: string; vehicle?: Vehicle } {
  if (!chassis) return { isSold: false };
  const cleanTarget = chassis.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (
    !cleanTarget ||
    cleanTarget.length < 5 ||
    cleanTarget === 'DISPENSADO' ||
    cleanTarget.includes('DEFINIR') ||
    cleanTarget.includes('PENDENTE') ||
    cleanTarget.includes('PROVISORIO')
  ) {
    return { isSold: false };
  }

  // 1. Verifica no estoque de veículos
  const foundInStock = (vehiclesList || []).find((v) => {
    if (ignoreVehicleId && v.id === ignoreVehicleId) return false;
    const vCh = (v.chassis || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return vCh && (vCh === cleanTarget || (cleanTarget.length >= 7 && (vCh.endsWith(cleanTarget) || cleanTarget.endsWith(vCh))));
  });

  if (foundInStock && foundInStock.status === 'vendido') {
    return {
      isSold: true,
      reason: `O chassi final ...${cleanTarget.slice(-6)} já consta como VENDIDO no estoque (${foundInStock.brand} ${foundInStock.model}).`,
      vehicle: foundInStock,
    };
  }

  // 2. Verifica nas vendas faturadas da planilha mensal
  try {
    const rawSheet = localStorage.getItem('dealflow_cloud_monthly_sheet_v9');
    if (rawSheet) {
      const rows: any[] = JSON.parse(rawSheet);
      if (Array.isArray(rows)) {
        const soldRow = rows.find((r) => {
          if (r.tipo_registro === 'venda' || r.is_permitted) {
            const rCh = (r.chassi || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            return rCh && (rCh === cleanTarget || (cleanTarget.length >= 7 && (rCh.endsWith(cleanTarget) || cleanTarget.endsWith(rCh))));
          }
          return false;
        });

        if (soldRow) {
          return {
            isSold: true,
            reason: `O chassi final ...${cleanTarget.slice(-6)} já foi faturado anteriormente para o cliente ${soldRow.cliente || 'outro comprador'}.`,
          };
        }
      }
    }
  } catch {}

  return { isSold: false };
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

export const DELETED_VEHICLES_KEY = 'dealflow_deleted_vehicles_v1';

export function getDeletedVehicleIds(): Set<string> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(DELETED_VEHICLES_KEY) : null;
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function recordDeletedVehicle(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const set = getDeletedVehicleIds();
    set.add(id);
    localStorage.setItem(DELETED_VEHICLES_KEY, JSON.stringify(Array.from(set)));
    removeVehicleFromCache(id);
  } catch {}
}

export function removeVehicleFromCache(vehicleId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getCachedVehicles().filter((v) => v.id !== vehicleId);
    localStorage.setItem(VEHICLES_CACHE_KEY, JSON.stringify(list));
  } catch {}
}

export function useVehicles() {
  const qc = useQueryClient();

  useEffect(() => {
    const handleUpdate = () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    };
    window.addEventListener('dealflow:vehicle-status-updated', handleUpdate);
    window.addEventListener('dealflow:sales-updated', handleUpdate);
    return () => {
      window.removeEventListener('dealflow:vehicle-status-updated', handleUpdate);
      window.removeEventListener('dealflow:sales-updated', handleUpdate);
    };
  }, [qc]);

  return useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const deletedIds = getDeletedVehicleIds();
      // 1. Obtém o estoque imediatamente disponível filtrando excluídos
      let currentList = getCachedVehicles().filter((v) => !deletedIds.has(v.id));

      // 2. Tenta sincronização remota com o Supabase
      try {
        await ensureSupabaseSession();
        const { data, error } = await supabase
          .from('vehicles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          const filteredRemote = (data as Vehicle[]).filter((v) => !deletedIds.has(v.id));
          // O banco de dados Supabase é a autoridade absoluta do estoque
          // Sobrescreve o cache local para purgar imediatamente qualquer fantasma ou duplicata
          try {
            localStorage.setItem(VEHICLES_CACHE_KEY, JSON.stringify(filteredRemote));
          } catch {}
          return filteredRemote;
        }
      } catch (err) {
        console.warn('Consulta remota de veículos falhou, usando estoque local:', err);
      }

      // 3. Fallback garantido
      if (currentList.length > 0) {
        return currentList;
      }

      const seedFiltered = typedOfficialSeed.filter((v) => !deletedIds.has(v.id));
      if (seedFiltered.length > 0) {
        saveVehiclesToCache(seedFiltered);
        return seedFiltered;
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
