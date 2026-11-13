import { SheetRowV9 } from './dealershipSheetParser';
import { calculateDeliveryRoute, resolveCityCoordinates, haversineDistanceKm } from './geoCoordinates';
import { TRANSPORT_LOGISTICS_METHODS, calculateFreightCost } from './transportLogistics';

export type DeliveryStatus = 'aguardando_despacho' | 'em_transporte' | 'entregue';

export interface DeliveryRecord {
  saleId: string;
  cliente: string;
  chassi: string;
  modelo: string;
  regiao: string;
  uf: string;
  valor: number;
  vendedor: string;
  dataVenda: string;
  poloOrigemId: string;
  poloOrigemNome: string;
  status: DeliveryStatus;
  metodoTransporteId: string;
  metodoTransporteNome: string;
  motoristaNome?: string;
  motoristaCpf?: string;
  motoristaTelefone?: string;
  motoristaPlaca?: string;
  transportadora?: string;
  distanciaKm: number;
  custoFreteEstimado: number;
  prazoEstimado: string;
  dataPrevisaoEntrega?: string;
  dataConclusao?: string;
  observacoes?: string;
  assinaturaGov?: {
    assinadoPor?: string;
    cpf?: string;
    dataHora?: string;
    hashValidacao?: string;
  };
}

const STORAGE_KEY = 'dealflow_logistics_deliveries_v2';

export function getCustomDeliveries(): Record<string, Partial<DeliveryRecord>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Erro ao ler custom deliveries:', e);
  }
  return {};
}

export function saveCustomDelivery(saleId: string, updates: Partial<DeliveryRecord>) {
  const all = getCustomDeliveries();
  all[saleId] = { ...(all[saleId] || {}), ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all[saleId];
}

/**
 * Consolida todas as vendas reais em registros operacionais de logística
 */
export function buildLogisticsDeliveries(sales: any[]): DeliveryRecord[] {
  const customs = getCustomDeliveries();

  return sales.map((s) => {
    const saleId = String(s.id || s.chassi || `${s.cliente}-${s.data}`);
    const custom = customs[saleId] || {};

    const isMoc =
      s.store_id === 'store-montesclaros' ||
      (s.store_name || '').toLowerCase().includes('montes') ||
      (s.regiao || '').toUpperCase().includes('MONTES CLAROS') ||
      (s.regiao || '').toUpperCase().includes('BOCAINA') ||
      (s.regiao || '').toUpperCase().includes('JANAUBA') ||
      (s.regiao || '').toUpperCase().includes('PIRAPORA');

    const poloOrigemId = isMoc ? 'store-montesclaros' : 'store-divinopolis';
    const poloOrigemNome = isMoc
      ? 'Concessionária Montes Claros'
      : 'Concessionária Divinópolis';
    const hubLat = isMoc ? -16.7282 : -20.1444;
    const hubLng = isMoc ? -43.8644 : -44.8872;

    const destCity = s.regiao || (isMoc ? 'Montes Claros' : 'Divinópolis');
    const coords = resolveCityCoordinates(destCity, hubLat, hubLng);
    const haversine = haversineDistanceKm(hubLat, hubLng, coords.lat, coords.lng);
    const roadKm = Math.max(10, Math.round(haversine * 1.22));

    const defaultMethod =
      roadKm > 200 ? 'cegonha_coletiva' : roadKm > 40 ? 'reboque_dedicado' : 'retirada_balcao';

    const metodoId = custom.metodoTransporteId || defaultMethod;
    const metodoDef =
      TRANSPORT_LOGISTICS_METHODS.find((m) => m.id === metodoId) ||
      TRANSPORT_LOGISTICS_METHODS[0];

    const freightBreakdown = calculateFreightCost(metodoId, roadKm, 1);

    // Status padrão baseado no faturamento e entrega da planilha
    let defaultStatus: DeliveryStatus = 'aguardando_despacho';
    if (s.is_permitted === true) {
      defaultStatus = 'entregue';
    } else if (custom.status) {
      defaultStatus = custom.status;
    }

    return {
      saleId,
      cliente: s.cliente || 'Cliente Comercial',
      chassi: s.chassi || 'CHASSI-PENDENTE',
      modelo: s.modelo || 'Moto',
      regiao: destCity.toUpperCase(),
      uf: coords.uf || 'MG',
      valor: Number(s.valor) || 0,
      vendedor: s.vendedor || 'Consultor Comercial',
      dataVenda: s.dateStr || s.data || new Date().toLocaleDateString('pt-BR'),
      poloOrigemId,
      poloOrigemNome,
      status: custom.status || defaultStatus,
      metodoTransporteId: metodoId,
      metodoTransporteNome: metodoDef.nome,
      motoristaNome: custom.motoristaNome || (defaultStatus === 'entregue' ? 'Transportador Oficial' : undefined),
      motoristaCpf: custom.motoristaCpf,
      motoristaTelefone: custom.motoristaTelefone,
      motoristaPlaca: custom.motoristaPlaca,
      transportadora: custom.transportadora,
      distanciaKm: roadKm,
      custoFreteEstimado: freightBreakdown.totalFrete,
      prazoEstimado: freightBreakdown.prazoEstimado,
      dataPrevisaoEntrega: custom.dataPrevisaoEntrega,
      dataConclusao: custom.dataConclusao,
      observacoes: custom.observacoes,
      assinaturaGov: custom.assinaturaGov,
    };
  });
}
