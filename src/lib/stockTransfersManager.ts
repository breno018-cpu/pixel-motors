/**
 * Gerenciador Executivo de Troca de Estoque e Transferências Interlojas
 * Controle de motos que saem para cada loja, motos que chegam de outras lojas
 * e entrada de motos vindas de lojas externas que não usam o aplicativo.
 */

import { supabase } from '@/integrations/supabase/client';
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

// Seed inicial demonstrativo para a Diretoria visualizar o histórico da rede
export const DEFAULT_EXCHANGE_RECORDS: StockExchangeRecord[] = [
  {
    id: 'exc_001',
    vehicle_id: 'veh_shi_01',
    chassis: '95VJA1250RB001188',
    brand: 'Shineray',
    model: 'SHI 175 EFI',
    color: 'Preta Fosca',
    year: 2025,
    direction: 'saida',
    from_store_id: 'store-divinopolis',
    from_store_name: 'Shineray & Multimarcas Divinópolis',
    to_store_id: 'store-montesclaros',
    to_store_name: 'Shineray Montes Claros',
    is_external_store: false,
    invoice_number: 'NF-e 004812',
    agreed_amount: 14900,
    sale_price: 18490,
    status: 'concluida',
    transfer_date: '2026-11-15',
    driver_name: 'Carlos Mendes (Cegonha Interlojas)',
    driver_plate: 'RVE-4A20',
    notes: 'Transferência de lote para reforço de pronta entrega no Norte de Minas.',
    created_at: '2026-11-15T08:30:00Z',
  },
  {
    id: 'exc_002',
    vehicle_id: 'veh_jet_02',
    chassis: '95VJA1250RB002234',
    brand: 'Shineray',
    model: 'JET 125',
    color: 'Branca Perolizada',
    year: 2025,
    direction: 'entrada',
    from_store_id: 'store-montesclaros',
    from_store_name: 'Shineray Montes Claros',
    to_store_id: 'store-divinopolis',
    to_store_name: 'Shineray & Multimarcas Divinópolis',
    is_external_store: false,
    invoice_number: 'NF-e 003921',
    agreed_amount: 9800,
    sale_price: 11990,
    status: 'concluida',
    transfer_date: '2026-11-14',
    driver_name: 'Reboque Dedicado VIP',
    driver_plate: 'SHN-2B88',
    notes: 'Remessa solicitada para entrega imediata a cliente de Itaúna.',
    created_at: '2026-11-14T10:15:00Z',
  },
  {
    id: 'exc_003',
    vehicle_id: 'veh_ext_phoenix',
    chassis: '95VJA5000RB009841',
    brand: 'Shineray',
    model: 'PHOENIX 50',
    color: 'Vermelha',
    year: 2025,
    direction: 'entrada',
    from_store_id: null,
    from_store_name: 'Shineray BH Matriz (Loja Parceira)',
    to_store_id: 'store-divinopolis',
    to_store_name: 'Shineray & Multimarcas Divinópolis',
    is_external_store: true,
    external_store_name: 'Shineray BH Matriz',
    external_store_city: 'Belo Horizonte - MG',
    external_store_cnpj: '18.423.901/0001-44',
    invoice_number: 'NF-e 119402',
    agreed_amount: 6800,
    sale_price: 8490,
    status: 'concluida',
    transfer_date: '2026-11-16',
    notes: 'Moto recebida de loja parceira externa que não utiliza nosso sistema Dealflow. Entrada validada no pátio com PDI.',
    created_at: '2026-11-16T14:20:00Z',
  },
  {
    id: 'exc_004',
    vehicle_id: 'veh_titanium_01',
    chassis: '95VJA2500RB004512',
    brand: 'Shineray',
    model: 'TITANIUM 250',
    color: 'Cinza Nardo',
    year: 2026,
    direction: 'saida',
    from_store_id: 'store-divinopolis',
    from_store_name: 'Shineray & Multimarcas Divinópolis',
    to_store_id: 'store-montesclaros',
    to_store_name: 'Shineray Montes Claros',
    is_external_store: false,
    invoice_number: 'NF-e 004901',
    agreed_amount: 19800,
    sale_price: 24900,
    status: 'em_transito',
    transfer_date: '2026-11-17',
    driver_name: 'Fiat Toro Frota Loja (Placa RTO-8H15)',
    notes: 'Em trânsito via BR-135 com previsão de chegada hoje à tarde.',
    created_at: '2026-11-17T07:45:00Z',
  },
  {
    id: 'exc_005',
    vehicle_id: 'veh_ext_shi250',
    chassis: '95VJA2500RB007788',
    brand: 'Shineray',
    model: 'SHI 250 EFI',
    color: 'Azul Racing',
    year: 2026,
    direction: 'entrada',
    from_store_id: null,
    from_store_name: 'Concessionária Moto Norte (Sem App)',
    to_store_id: 'store-montesclaros',
    to_store_name: 'Shineray Montes Claros',
    is_external_store: true,
    external_store_name: 'Concessionária Moto Norte',
    external_store_city: 'Pirapora - MG',
    invoice_number: 'NF-e 007823',
    agreed_amount: 21500,
    sale_price: 26900,
    status: 'concluida',
    transfer_date: '2026-11-16',
    notes: 'Repasse entre concessionárias autorizado pela diretoria. Moto incorporada ao pátio de Montes Claros.',
    created_at: '2026-11-16T16:00:00Z',
  },
];

export function getStockExchangeRecords(): StockExchangeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXCHANGES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Erro ao carregar registros de troca de estoque:', e);
  }
  return DEFAULT_EXCHANGE_RECORDS;
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

  // 2. Salva no cache do estoque local
  saveVehicleToCache(newVehicle);

  // 3. Tenta salvar no Supabase se disponível
  try {
    await (supabase as any).from('vehicles').insert({
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
  } catch (err) {
    console.warn('Erro ao inserir veículo no Supabase (usando local fallback):', err);
  }

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
