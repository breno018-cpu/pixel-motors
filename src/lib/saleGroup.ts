import { supabase } from '@/integrations/supabase/client';
import type { ContractVehicleLine } from '@/lib/contractPdf';

export interface SaleGroupResult {
  /** Linhas de veículos do contrato (uma por veículo vendido no mesmo contrato). */
  vehicles: ContractVehicleLine[];
  /** Soma dos valores de todos os veículos do grupo. */
  total: number;
  /** IDs dos contratos irmãos (inclui o próprio). */
  contractIds: string[];
  /** Números dos contratos irmãos, na ordem de criação. */
  contractNumbers: string[];
}

/**
 * Carrega todos os veículos vendidos junto com um contrato.
 * Vendas de várias motos criam um contrato por veículo, ligados por `sale_group_id`;
 * aqui eles voltam a formar um único documento.
 */
export async function fetchSaleGroup(contractId: string): Promise<SaleGroupResult | null> {
  const { data: base } = await supabase
    .from('contracts')
    .select('id, contract_number, sale_group_id, sale_price, vehicle_id, created_at')
    .eq('id', contractId)
    .maybeSingle();

  if (!base) return null;

  const groupId = (base as any).sale_group_id as string | null;
  let rows: any[] = [base];

  if (groupId) {
    const { data: siblings } = await supabase
      .from('contracts')
      .select('id, contract_number, sale_price, vehicle_id, created_at')
      .eq('sale_group_id', groupId)
      .order('created_at', { ascending: true });
    if (siblings && siblings.length > 0) rows = siblings;
  }

  const vehicleIds = rows.map((r) => r.vehicle_id).filter(Boolean);
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, brand, model, year, color, plate, chassis, renavam')
    .in('id', vehicleIds.length > 0 ? vehicleIds : ['00000000-0000-0000-0000-000000000000']);

  const byId = new Map((vehicles || []).map((v) => [v.id, v]));

  const lines: ContractVehicleLine[] = rows.map((r) => {
    const v = byId.get(r.vehicle_id);
    return {
      brand: v?.brand || '',
      model: v?.model || '',
      year: v?.year ?? null,
      color: v?.color ?? null,
      plate: v?.plate ?? null,
      chassis: v?.chassis ?? null,
      renavam: v?.renavam ?? null,
      price: Number(r.sale_price) || 0,
    };
  });

  return {
    vehicles: lines,
    total: lines.reduce((s, l) => s + (Number(l.price) || 0), 0),
    contractIds: rows.map((r) => r.id),
    contractNumbers: rows.map((r) => r.contract_number),
  };
}
