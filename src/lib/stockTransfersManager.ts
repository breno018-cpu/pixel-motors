/**
 * Gerenciador Executivo de Troca de Estoque e Transferências Interlojas
 * Controle de motos que saem para cada loja, motos que chegam de outras lojas
 * e entrada de motos vindas de lojas externas que não usam o aplicativo.
 */

import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/audit';
import { Vehicle, saveVehicleToCache, getCachedVehicles } from '@/hooks/useVehicles';
import { STORE_DIVINOPOLIS_UUID, STORE_MONTESCLAROS_UUID } from '@/lib/storeResolution';

export type ExchangeDirection = 'saida' | 'entrada';
export type ExchangeStatus = 'pendente' | 'em_transito' | 'concluida' | 'cancelada';

export interface StockExchangeRecord {
  id: string;
  vehicle_id: string;
  chassis: string;
  brand: string;
  model: string;
  color: string;
  year: number;
  direction: ExchangeDirection;
  from_store_id: string | null;
  from_store_name: string;
  to_store_id: string | null;
  to_store_name: string;
  is_external_store: boolean; // True quando veio de loja que não usa o app
  external_store_name?: string;
  external_store_city?: string;
  external_store_cnpj?: string;
  invoice_number?: string;
  agreed_amount: number;
  sale_price?: number;
  status: ExchangeStatus;
  transfer_date: string;
  driver_name?: string;
  driver_plate?: string;
  notes?: string;
  created_at: string;
}

const STORAGE_KEY_EXCHANGES = 'dealflow_executive_stock_transfers_v2';
const LEGACY_FAKE_EXCHANGE_IDS = new Set(['exc_001', 'exc_002', 'exc_003', 'exc_004', 'exc_005']);

// Sem dados fictícios — exibe apenas trocas reais registradas pela diretoria
export const DEFAULT_EXCHANGE_RECORDS: StockExchangeRecord[] = [];

export function getStockExchangeRecords(): StockExchangeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXCHANGES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((r: any) => r && !LEGACY_FAKE_EXCHANGE_IDS.has(String(r.id || '')));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY_EXCHANGES, JSON.stringify(cleaned));
        }
        return cleaned;
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar registros de troca de estoque:', e);
  }
  return [];
}

export function saveStockExchangeRecords(records: StockExchangeRecord[]): void {
  localStorage.setItem(STORAGE_KEY_EXCHANGES, JSON.stringify(records));
}

export interface AddExternalMotoInput {
  chassis: string;
  model: string;
  color: string;
  year: number;
  externalStoreName: string;
  externalStoreCity: string;
  externalStoreCnpj?: string;
  destinationStoreId: string;
  destinationStoreName: string;
  invoiceNumber?: string;
  agreedAmount: number;
  salePrice: number;
  mileage?: number;
  condition?: '0km' | 'seminova';
  notes?: string;
}

/**
 * Adiciona uma moto vinda de loja externa (que não usa o app) diretamente ao estoque
 * e registra no painel de trocas de estoque da Diretoria.
 */
export async function addExternalStoreMotoToStock(
  input: AddExternalMotoInput
): Promise<{ vehicle: Vehicle; exchange: StockExchangeRecord }> {
  const newVehicleId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const dateStr = nowIso.slice(0, 10);
  const cleanChassis = input.chassis.trim().toUpperCase();

  // Resolve UUID real da loja para compatibilidade com o Supabase
  let realStoreUuid = STORE_DIVINOPOLIS_UUID;
  if (
    input.destinationStoreId === STORE_MONTESCLAROS_UUID ||
    input.destinationStoreId === 'store-montesclaros' ||
    (input.destinationStoreName && input.destinationStoreName.toLowerCase().includes('montes'))
  ) {
    realStoreUuid = STORE_MONTESCLAROS_UUID;
  } else if (
    input.destinationStoreId &&
    input.destinationStoreId.length === 36 &&
    input.destinationStoreId.includes('-')
  ) {
    realStoreUuid = input.destinationStoreId;
  }

  // 1. Constrói o objeto do veículo para o estoque
  const notesFormatted = `[ORIGEM_LOJA_EXTERNA_SEM_APP] Loja: ${input.externalStoreName.trim()} (${input.externalStoreCity.trim()}) | NF: ${
    input.invoiceNumber?.trim() || 'S/N'
  } | ${input.notes?.trim() || ''}`.trim();

  const newVehicle: Vehicle = {
    id: newVehicleId,
    store_id: realStoreUuid,
    reseller_id: null,
    brand: 'Shineray',
    model: input.model.trim(),
    year: input.year || 2025,
    manufacture_year: input.year || 2025,
    color: input.color.trim() || 'Cor Padrão',
    plate: null,
    chassis: cleanChassis,
    renavam: null,
    mileage: input.mileage || 0,
    fuel_type: 'gasolina',
    transmission: 'manual',
    purchase_price: Number(input.agreedAmount) || 0,
    sale_price: Number(input.salePrice) || 0,
    status: 'disponivel',
    images: [],
    notes: notesFormatted,
    vehicle_type: 'moto',
    engine_cc: null,
    warranty_months: 12,
    revision_period_months: 6,
    revision_period_km: 1000,
    created_at: nowIso,
    updated_at: nowIso,
  };

  // 2. Salva no Supabase primeiro (garante que nunca perca a moto silenciosamente)
  const { error: insertErr } = await (supabase as any).from('vehicles').insert({
    id: newVehicle.id,
    store_id: realStoreUuid,
    brand: newVehicle.brand,
    model: newVehicle.model,
    year: newVehicle.year,
    manufacture_year: newVehicle.manufacture_year,
    color: newVehicle.color,
    chassis: newVehicle.chassis,
    status: 'disponivel',
    vehicle_type: 'moto',
    purchase_price: newVehicle.purchase_price,
    sale_price: newVehicle.sale_price,
    mileage: newVehicle.mileage,
    notes: newVehicle.notes,
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (insertErr) {
    throw new Error(`Falha ao gravar veículo na troca de estoque: ${insertErr.message}`);
  }

  // 3. Atualiza cache local após confirmação no banco e registra auditoria
  saveVehicleToCache(newVehicle);
  void logActivity('criar', 'veiculo', newVehicle.id, {
    origem: 'troca_estoque',
    chassi: newVehicle.chassis,
    modelo: `${newVehicle.brand} ${newVehicle.model}`.trim(),
    cor: newVehicle.color,
    loja_id: realStoreUuid,
  });

  // 4. Cria o registro de troca de estoque para a Diretoria
  const newExchange: StockExchangeRecord = {
    id: `exc_${Date.now()}`,
    vehicle_id: newVehicle.id,
    chassis: cleanChassis,
    brand: 'Shineray',
    model: input.model.trim(),
    color: input.color.trim(),
    year: input.year || 2025,
    direction: 'entrada',
    from_store_id: null,
    from_store_name: `${input.externalStoreName.trim()} (Sem App)`,
    to_store_id: input.destinationStoreId,
    to_store_name: input.destinationStoreName,
    is_external_store: true,
    external_store_name: input.externalStoreName.trim(),
    external_store_city: input.externalStoreCity.trim(),
    external_store_cnpj: input.externalStoreCnpj?.trim(),
    invoice_number: input.invoiceNumber?.trim(),
    agreed_amount: Number(input.agreedAmount) || 0,
    sale_price: Number(input.salePrice) || 0,
    status: 'concluida',
    transfer_date: dateStr,
    notes: input.notes?.trim() || 'Entrada manual de moto originária de loja externa parceira.',
    created_at: nowIso,
  };

  const currentRecords = getStockExchangeRecords();
  const updatedRecords = [newExchange, ...currentRecords];
  saveStockExchangeRecords(updatedRecords);

  // Também tenta registrar na tabela stock_transfers do Supabase
  try {
    await (supabase as any).from('stock_transfers').insert({
      vehicle_id: newVehicle.id,
      transfer_type: 'parceiro_externo',
      from_store_id: null,
      to_store_id: realStoreUuid,
      partner_name: `${input.externalStoreName.trim()} (${input.externalStoreCity.trim()})`,
      agreed_amount: Number(input.agreedAmount) || 0,
      received_amount: Number(input.agreedAmount) || 0,
      status: 'concluida',
      transfer_date: dateStr,
      notes: notesFormatted,
    });
  } catch (err) {
    console.warn('Erro ao registrar em stock_transfers no Supabase:', err);
  }

  // Notifica o sistema para recarregar queries e pátios
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('dealflow:vehicle-status-updated', { detail: { target: newVehicle.id } })
    );
    window.dispatchEvent(new CustomEvent('dealflow:sales-updated'));
  }

  return { vehicle: newVehicle, exchange: newExchange };
}

export interface CreateStoreToStoreTransferInput {
  vehicleId: string;
  fromStoreId: string;
  fromStoreName: string;
  toStoreId: string;
  toStoreName: string;
  agreedAmount: number;
  invoiceNumber?: string;
  driverName?: string;
  driverPlate?: string;
  notes?: string;
}

/**
 * Cria uma transferência de moto entre lojas da própria rede (ex: Divinópolis -> Montes Claros)
 */
export function createStoreToStoreTransfer(
  input: CreateStoreToStoreTransferInput
): StockExchangeRecord | null {
  const vehicles = getCachedVehicles();
  const vehicle = vehicles.find((v) => v.id === input.vehicleId);
  if (!vehicle) return null;

  const nowIso = new Date().toISOString();
  const dateStr = nowIso.slice(0, 10);

  const newExchange: StockExchangeRecord = {
    id: `exc_${Date.now()}`,
    vehicle_id: vehicle.id,
    chassis: vehicle.chassis || 'S/ CHASSI',
    brand: vehicle.brand || 'Shineray',
    model: vehicle.model || 'Motocicleta',
    color: vehicle.color || 'Padrão',
    year: vehicle.year || 2025,
    direction: 'saida',
    from_store_id: input.fromStoreId,
    from_store_name: input.fromStoreName,
    to_store_id: input.toStoreId,
    to_store_name: input.toStoreName,
    is_external_store: false,
    invoice_number: input.invoiceNumber?.trim(),
    agreed_amount: Number(input.agreedAmount) || Number(vehicle.purchase_price) || 0,
    sale_price: Number(vehicle.sale_price) || 0,
    status: 'em_transito',
    transfer_date: dateStr,
    driver_name: input.driverName?.trim(),
    driver_plate: input.driverPlate?.trim(),
    notes: input.notes?.trim(),
    created_at: nowIso,
  };

  const records = getStockExchangeRecords();
  saveStockExchangeRecords([newExchange, ...records]);

  return newExchange;
}
