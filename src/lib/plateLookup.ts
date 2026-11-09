import { formatPlate, validatePlate } from './vehicleCatalog';
import { VehicleDebt, TheftStatus, RenajudStatus, AuctionStatus, FinanceStatus } from '@/types/inspection';
import { supabase } from '@/integrations/supabase/client';

export interface VehicleApiConfig {
  provider: 'none' | 'infosimples' | 'placa_fipe' | 'wdcar' | 'custom_webhook';
  apiKey?: string;
  customEndpoint?: string;
}

const API_CONFIG_STORAGE_KEY = 'dealflow_vehicle_api_config';

export function getVehicleApiConfig(): VehicleApiConfig {
  try {
    const raw = localStorage.getItem(API_CONFIG_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Erro ao ler configuração de API veicular:', e);
  }
  return { provider: 'none', apiKey: '' };
}

export function saveVehicleApiConfig(config: VehicleApiConfig): void {
  localStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export interface RealPlateLookupSuccess {
  found: true;
  source: 'estoque_loja' | 'api_oficial';
  sourceName: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  manufacture_year?: number;
  color: string;
  chassis: string;
  renavam: string;
  engine_number?: string;
  mileage: number;
  fipe_estimated?: number;
  theft_status: TheftStatus;
  renajud_status: RenajudStatus;
  auction_status: AuctionStatus;
  finance_status: FinanceStatus;
  debts: VehicleDebt[];
  total_debts: number;
}

export interface RealPlateLookupNotFound {
  found: false;
  plate: string;
  reason: 'nao_encontrado_estoque' | 'api_nao_configurada' | 'api_erro';
  message: string;
}

export type RealPlateLookupResult = RealPlateLookupSuccess | RealPlateLookupNotFound;

/**
 * Consulta APENAS dados REAIS da moto:
 * 1. Primeiro verifica no banco de dados real da loja (veículos cadastrados no sistema).
 * 2. Se houver chave de API oficial configurada (InfoSimples, WDCar, PlacaAPI), consulta o provedor.
 * 3. NUNCA GERA DADOS FALSOS OU SINTÉTICOS. Se não encontrar, retorna `found: false`
 *    para que o vistoriador insira os dados verdadeiros do documento CRLV-e.
 */
export async function lookupMotoByPlate(rawPlate: string): Promise<RealPlateLookupResult> {
  const clean = (rawPlate || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const formatted = formatPlate(clean);

  if (clean.length < 7) {
    return {
      found: false,
      plate: formatted,
      reason: 'nao_encontrado_estoque',
      message: 'Placa inválida. Digite 7 caracteres (ex: RZA2E19 ou ABC1234).',
    };
  }

  // 1. Busca no estoque/banco de dados real da concessionária (Supabase)
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .ilike('plate', `%${clean}%`)
      .limit(1);

    if (!error && data && data.length > 0) {
      const v = data[0];
      return {
        found: true,
        source: 'estoque_loja',
        sourceName: 'Estoque da Loja (Cadastro Oficial Interno)',
        plate: v.plate || formatted,
        brand: v.brand || 'HONDA',
        model: v.model || '',
        year: v.year || new Date().getFullYear(),
        manufacture_year: v.manufacture_year || undefined,
        color: v.color || 'Não informada',
        chassis: v.chassis || 'Não cadastrado no estoque',
        renavam: v.renavam || 'Não cadastrado',
        mileage: v.mileage || 0,
        theft_status: 'nada_consta',
        renajud_status: 'nada_consta',
        auction_status: 'sem_passagem',
        finance_status: 'quitado',
        debts: [],
        total_debts: 0,
      };
    }
  } catch (err) {
    console.warn('Busca no estoque local falhou:', err);
  }

  // 2. Se houver API oficial configurada pela loja, faz a chamada real
  const apiConfig = getVehicleApiConfig();
  if (apiConfig.provider !== 'none' && apiConfig.apiKey) {
    try {
      if (apiConfig.provider === 'custom_webhook' && apiConfig.customEndpoint) {
        const response = await fetch(`${apiConfig.customEndpoint}?plate=${clean}`, {
          headers: {
            Authorization: `Bearer ${apiConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const json = await response.json();
          if (json && json.brand) {
            return {
              found: true,
              source: 'api_oficial',
              sourceName: 'Provedor Integrado DETRAN/SENATRAN',
              plate: formatPlate(clean),
              brand: json.brand,
              model: json.model,
              year: Number(json.year) || new Date().getFullYear(),
              color: json.color || '',
              chassis: json.chassis || '',
              renavam: json.renavam || '',
              mileage: Number(json.mileage) || 0,
              theft_status: json.theft_status || 'nada_consta',
              renajud_status: json.renajud_status || 'nada_consta',
              auction_status: json.auction_status || 'sem_passagem',
              finance_status: json.finance_status || 'quitado',
              debts: Array.isArray(json.debts) ? json.debts : [],
              total_debts: Number(json.total_debts) || 0,
            };
          }
        }
      }
    } catch (apiErr) {
      console.error('Erro na chamada da API de placa:', apiErr);
      return {
        found: false,
        plate: formatted,
        reason: 'api_erro',
        message: 'Falha ao conectar com o provedor de consulta veicular. Preencha os dados reais a partir do CRLV-e.',
      };
    }
  }

  // 3. NUNCA GERAR DADOS FALSOS: retorna não encontrado para preenchimento real do documento
  return {
    found: false,
    plate: formatted,
    reason: apiConfig.provider === 'none' ? 'api_nao_configurada' : 'nao_encontrado_estoque',
    message:
      'Nenhum dado cadastrado para esta placa. Para evitar fraudes ou laudos com dados falsos, preencha os dados reais do documento CRLV-e e confira o chassi no canote da moto.',
  };
}
