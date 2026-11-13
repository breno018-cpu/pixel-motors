import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ensureSupabaseSession } from '@/lib/supabaseAuthHelper';
import { INITIAL_USER_BACKUP_CSV, parseBackupCsv, SheetRowV9 } from '@/lib/dealershipSheetParser';
import { resolveSaleStore } from '@/lib/storeResolution';
import officialContractsSeed from '@/data/officialContractsSeed.json';

export interface ContractVehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  color: string | null;
  plate: string | null;
  chassis: string | null;
  vehicle_type: string | null;
  status: string;
}

export interface ContractStore {
  id: string;
  name: string;
}

export interface ContractReseller {
  id: string;
  full_name: string;
}

export interface Contract {
  id: string;
  contract_number: string;
  vehicle_id: string;
  reseller_id: string | null;
  store_id: string;
  created_by: string | null;
  buyer_name: string;
  buyer_cpf: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  buyer_address: string | null;
  sale_price: number;
  down_payment: number;
  installments: number;
  installment_value: number | null;
  status: 'pre_venda' | 'pendente' | 'assinado' | 'cancelado' | 'concluido';
  payment_method: string | null;
  financing_bank: string | null;
  financing_installments: number | null;
  financing_installment_value: number | null;
  down_payment_pix: number | null;
  down_payment_cash: number | null;
  down_payment_card: number | null;
  down_payment_card_installments: number | null;
  lead_source: string | null;
  lead_source_detail: string | null;
  ad_id: string | null;
  campaign_name: string | null;
  signed_at: string | null;
  signed_contract_url: string | null;
  notes: string | null;
  active_clause_ids: string[] | null;
  clause_variables: Record<string, Record<string, string>> | null;
  revision_number: number;
  review_status: string | null;
  review_note: string | null;
  review_requested_at: string | null;
  review_resolved_at: string | null;
  template_id: string | null;
  sale_group_id: string | null;
  sale_channel: 'interna' | 'externa';
  evidence_paths: string[];
  external_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Joined data
  vehicle?: ContractVehicle;
  store?: ContractStore;
  reseller?: ContractReseller;
  operator?: { full_name: string } | null;
}

export function getMonthlySheetRows(): SheetRowV9[] {
  try {
    const stored = localStorage.getItem('dealflow_cloud_monthly_sheet_v9');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return parseBackupCsv(INITIAL_USER_BACKUP_CSV, '2026-10').rows;
}

export function sheetRowToContract(r: SheetRowV9): Contract {
  const resolved = resolveSaleStore({
    store_id: (r as any).store_id,
    vendedor: r.vendedor,
    observacoes: r.observacoes,
    cliente: r.cliente,
    regiao: r.regiao,
  });
  const storeId = resolved.storeId;
  const storeName = resolved.storeName;

  const regUpper = (r.regiao || '').toUpperCase();
  const isMoc = storeId === 'store-montesclaros';
  const isHubCity = regUpper.includes('DIVINOPOLIS') || regUpper.includes('DIVINÓPOLIS') || regUpper.includes('MONTES CLAROS');
  const channel: 'interna' | 'externa' = isHubCity ? 'interna' : 'externa';

  let createdAt = new Date().toISOString();
  if (r.data) {
    const parts = r.data.split('/');
    if (parts.length === 3) {
      createdAt = new Date(
        parseInt(parts[2], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[0], 10),
        12,
        0,
        0,
      ).toISOString();
    }
  }

  const downPayment = (r.dinheiro || 0) + (r.pix || 0) + (r.cartao || 0) + (r.carta_credito || 0);

  return {
    id: r.id || `sheet-${r.qt}`,
    contract_number: `${isMoc ? 'MOC' : 'DIV'}-${r.qt || '00'}`,
    vehicle_id: (r as any).vehicle_id || `veh-${r.id || r.qt}`,
    reseller_id: (r as any).reseller_id || null,
    store_id: storeId,
    created_by: (r as any).created_by || (r as any).user_id || r.vendedor || 'Vendedor',
    user_id: (r as any).user_id || (r as any).created_by || null,
    vendedor: r.vendedor,
    buyer_name: r.cliente || 'Cliente não informado',
    buyer_cpf: r.lead_mapping || '—',
    buyer_phone: (r as any).buyer_phone || null,
    buyer_email: (r as any).buyer_email || null,
    buyer_address: `${r.regiao || 'Divinópolis'} - MG`,
    sale_price: r.valor || 0,
    down_payment: downPayment,
    installments: 1,
    installment_value: null,
    status: (r.is_permitted || (r as any).tipo_registro === 'venda') && (r as any).tipo_registro !== 'pre_venda' ? 'concluido' : 'pre_venda',
    payment_method: r.banco || (r.financiamento > 0 ? 'Financiamento' : 'À Vista'),
    financing_bank: r.banco || null,
    financing_installments: null,
    financing_installment_value: null,
    down_payment_pix: r.pix || 0,
    down_payment_cash: r.dinheiro || 0,
    down_payment_card: r.cartao || 0,
    down_payment_card_installments: null,
    lead_source: r.lead_mapping || 'Balcão',
    lead_source_detail: r.regiao || null,
    ad_id: null,
    campaign_name: null,
    signed_at: createdAt,
    signed_contract_url: null,
    notes: r.observacoes || null,
    active_clause_ids: null,
    clause_variables: null,
    revision_number: 1,
    review_status: null,
    review_note: null,
    review_requested_at: null,
    review_resolved_at: null,
    template_id: null,
    sale_group_id: null,
    sale_channel: channel,
    evidence_paths: r.comp ? [r.comp] : [],
    external_data: {
      ...((r as any).external_data || {}),
      vehicle_model_custom: r.modelo,
      chassis: r.chassi,
      banco: r.banco,
      financiamento: r.financiamento,
      dinheiro: r.dinheiro,
      pix: r.pix,
      cartao: r.cartao,
      regiao: r.regiao,
      buyer_city: r.regiao,
      seller_name: r.vendedor,
      sale_date: r.data,
      contact_platform: r.lead_mapping || 'WhatsApp / Balcão',
    },
    created_at: createdAt,
    updated_at: createdAt,
    vehicle: {
      id: (r as any).vehicle_id || `veh-${r.id || r.qt}`,
      brand: 'SHINERAY',
      model: r.modelo || 'Moto',
      year: 2026,
      color: (r as any).cor || 'Padrão',
      plate: (r as any).placa || null,
      chassis: r.chassi || null,
      vehicle_type: 'moto',
      status: 'vendido',
    },
    store: {
      id: storeId,
      name: storeName,
    },
    operator: (r as any).operator || {
      id: (r as any).user_id || (r as any).created_by || null,
      full_name: r.vendedor || 'Vendedor',
    },
  };
}

async function fetchConsolidatedContracts(): Promise<Contract[]> {
  let dbContracts: Contract[] = [];
  try {
    await ensureSupabaseSession();
    const { data } = await supabase
      .from('contracts')
      .select(`
        *,
        vehicle:vehicles(id, brand, model, year, color, plate, chassis, vehicle_type, status),
        store:stores(id, name),
        reseller:resellers(id, full_name)
      `)
      .order('created_at', { ascending: false });

    if (data && Array.isArray(data)) {
      dbContracts = data as Contract[];
    }
  } catch (err) {
    console.warn('Consulta ao Supabase contracts falhou, usando base consolidada:', err);
  }

  const createdByIds = [...new Set(dbContracts.filter((c) => c.created_by).map((c) => c.created_by as string))];
  let operatorMap: Record<string, string> = {};
  if (createdByIds.length > 0) {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', createdByIds);
      if (profiles) {
        operatorMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.full_name]));
      }
    } catch {}
  }

  const hydratedDb = dbContracts.map((c) => ({
    ...c,
    operator: c.operator || (c.created_by ? { full_name: operatorMap[c.created_by] || c.created_by } : null),
  }));

  const sheetRows = getMonthlySheetRows();
  const seenIds = new Set(hydratedDb.map((c) => c.id));

  const fromSheet = sheetRows
    .map(sheetRowToContract)
    .filter((sc) => !seenIds.has(sc.id));
  fromSheet.forEach((sc) => seenIds.add(sc.id));

  const typedSeed = (officialContractsSeed as unknown as Contract[]) || [];
  const fromSeed = typedSeed.filter((sc) => !seenIds.has(sc.id));

  return [...hydratedDb, ...fromSheet, ...fromSeed];
}

export function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: fetchConsolidatedContracts,
  });
}

export function useExternalContracts() {
  return useQuery({
    queryKey: ['contracts', 'external'],
    queryFn: async () => {
      const all = await fetchConsolidatedContracts();
      return all.filter((c) => c.sale_channel === 'externa');
    },
  });
}

export function useContractStats() {
  return useQuery({
    queryKey: ['contract-stats'],
    queryFn: async () => {
      const data = await fetchConsolidatedContracts();
      const total = data.length;
      const pendente = data.filter((c) => c.status === 'pendente' || c.status === 'pre_venda').length;
      const assinado = data.filter((c) => c.status === 'assinado').length;
      const concluido = data.filter((c) => c.status === 'concluido').length;
      const totalValue = data.reduce((sum, c) => sum + Number(c.sale_price), 0);

      return { total, pendente, assinado, concluido, totalValue };
    },
  });
}
