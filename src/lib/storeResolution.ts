/**
 * Mapeamento e Resolução Oficial de Concessionárias e Vendedores
 * Garante que vendas de uma loja nunca sejam atribuídas a outra loja
 * independentemente do endereço ou cidade de entrega do comprador.
 */

import { isMontesClarosRegion, normalizeCityKey, CITY_COORDINATES } from '@/lib/geoCoordinates';

export const STORE_DIVINOPOLIS_UUID = 'ccf8e097-09d7-4305-8077-5c16fc8b5634';
export const STORE_MONTESCLAROS_UUID = 'e8254a81-d669-464b-9806-457ba25ce7f0';
export const STORE_MONTESCLAROS_MULTIMARCAS_UUID = '6b3afc94-86b2-41b0-9427-6f58ae8dbf21';

/**
 * Normaliza e compara identificadores de loja aceitando tanto UUIDs quanto slugs locais
 * ('store-divinopolis', 'store-montesclaros'), além de lidar com estoque sem loja vinculada (null/unassigned).
 */
export function isMatchingStore(vehicleStoreId: string | null | undefined, filterStoreId: string): boolean {
  if (!filterStoreId || filterStoreId === 'all') return true;
  if (vehicleStoreId === filterStoreId) return true;

  const cleanFilter = filterStoreId.toLowerCase().trim();
  const cleanVehicleStore = (vehicleStoreId || '').toLowerCase().trim();

  // Matriz / Divinópolis
  const isDivinopolisFilter =
    cleanFilter === 'store-divinopolis' ||
    cleanFilter === STORE_DIVINOPOLIS_UUID ||
    cleanFilter.includes('divinopolis') ||
    cleanFilter.includes('matriz');

  if (isDivinopolisFilter) {
    if (!vehicleStoreId) return true;
    if (
      cleanVehicleStore === 'store-divinopolis' ||
      cleanVehicleStore === STORE_DIVINOPOLIS_UUID ||
      cleanVehicleStore.includes('divinopolis') ||
      cleanVehicleStore.includes('matriz')
    ) {
      return true;
    }
  }

  // Montes Claros (todas as unidades do polo Norte)
  const isMontesFilter =
    cleanFilter === 'store-montesclaros' ||
    cleanFilter === STORE_MONTESCLAROS_UUID ||
    cleanFilter === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
    cleanFilter.includes('montes') ||
    cleanFilter.includes('moc') ||
    cleanFilter.includes('polo norte');

  if (isMontesFilter) {
    if (
      cleanVehicleStore === 'store-montesclaros' ||
      cleanVehicleStore === STORE_MONTESCLAROS_UUID ||
      cleanVehicleStore === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
      cleanVehicleStore.includes('montes') ||
      cleanVehicleStore.includes('moc') ||
      cleanVehicleStore.includes('polo norte')
    ) {
      return true;
    }
  }

  return cleanFilter === cleanVehicleStore;
}

/**
 * Verifica de forma definitiva e à prova de falhas de caixa (case-insensitive)
 * se uma venda, linha de planilha ou registro pertence à concessionária de Montes Claros.
 */
export function isMontesClarosStore(storeOrSale?: {
  store_id?: string | null;
  raw_store_id?: string | null;
  store_name?: string | null;
  store?: { id?: string; name?: string; city?: string } | null;
  vendedor?: string | null;
  operator?: { full_name?: string } | null;
  regiao?: string | null;
  observacoes?: string | null;
} | null): boolean {
  if (!storeOrSale) return false;

  const sId = String(
    storeOrSale.store_id ||
    storeOrSale.raw_store_id ||
    storeOrSale.store?.id ||
    ''
  ).toLowerCase().trim();

  if (
    sId === 'store-montesclaros' ||
    sId === STORE_MONTESCLAROS_UUID ||
    sId === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
    sId.includes('montes') ||
    sId.includes('moc')
  ) {
    return true;
  }

  const sName = String(
    storeOrSale.store_name ||
    storeOrSale.store?.name ||
    storeOrSale.store?.city ||
    ''
  ).toLowerCase().trim();

  if (sName.includes('montes') || sName.includes('moc') || sName.includes('polo norte')) {
    return true;
  }

  // Verifica lotação canônica do consultor de vendas
  const vend = String(
    storeOrSale.vendedor ||
    storeOrSale.operator?.full_name ||
    ''
  ).toLowerCase().trim();

  if (vend) {
    for (const [key, storeId] of Object.entries(SELLER_TO_STORE_MAP)) {
      if (vend.includes(key)) {
        return storeId === 'store-montesclaros';
      }
    }
  }

  // Observações operacionais
  const obs = String(storeOrSale.observacoes || '').toLowerCase();
  if (obs.includes('montes claros') || obs.includes('moc') || obs.includes('polo norte')) {
    return true;
  }

  // Região ou cidade
  const reg = String(storeOrSale.regiao || '').toLowerCase();
  if (reg.includes('montes') || reg.includes('moc')) {
    return true;
  }

  return false;
}

/**
 * Retorna o nome amigável e canônico da concessionária ('Montes Claros' | 'Divinópolis')
 */
export function getStoreDisplayName(storeOrSale?: any): 'Montes Claros' | 'Divinópolis' {
  return isMontesClarosStore(storeOrSale) ? 'Montes Claros' : 'Divinópolis';
}

export interface ResolvedStore {
  storeId: string;
  storeName: string;
  city: string;
  state?: string;
  cnpj?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export const OFFICIAL_STORES: Record<string, ResolvedStore> = {
  'store-divinopolis': {
    storeId: 'store-divinopolis',
    storeName: 'Concessionária Divinópolis',
    city: 'Divinópolis',
    state: 'MG',
    cnpj: '18.456.789/0001-01',
    address: 'Av. Autorama, 1200 - Judeia, Divinópolis/MG',
    phone: '(37) 3222-1000',
    email: 'divinopolis@pixelmotors.com.br',
  },
  'store-montesclaros': {
    storeId: 'store-montesclaros',
    storeName: 'Concessionária Montes Claros',
    city: 'Montes Claros',
    state: 'MG',
    cnpj: '18.456.789/0002-82',
    address: 'Av. Deputado Esteves Rodrigues, 850 - Centro, Montes Claros/MG',
    phone: '(38) 3221-2000',
    email: 'montesclaros@pixelmotors.com.br',
  },
  'ccf8e097-09d7-4305-8077-5c16fc8b5634': {
    storeId: 'store-divinopolis',
    storeName: 'Concessionária Divinópolis',
    city: 'Divinópolis',
    state: 'MG',
    cnpj: '18.456.789/0001-01',
    address: 'Av. Autorama, 1200 - Judeia, Divinópolis/MG',
    phone: '(37) 3222-1000',
    email: 'divinopolis@pixelmotors.com.br',
  },
  'e8254a81-d669-464b-9806-457ba25ce7f0': {
    storeId: 'store-montesclaros',
    storeName: 'Concessionária Montes Claros',
    city: 'Montes Claros',
    state: 'MG',
    cnpj: '18.456.789/0002-82',
    address: 'Av. Deputado Esteves Rodrigues, 850 - Centro, Montes Claros/MG',
    phone: '(38) 3221-2000',
    email: 'montesclaros@pixelmotors.com.br',
  },
  '6b3afc94-86b2-41b0-9427-6f58ae8dbf21': {
    storeId: 'store-montesclaros',
    storeName: 'Concessionária Montes Claros',
    city: 'Montes Claros',
    state: 'MG',
    cnpj: '18.456.789/0002-82',
    address: 'Av. Deputado Esteves Rodrigues, 850 - Centro, Montes Claros/MG',
    phone: '(38) 3221-2000',
    email: 'montesclaros@pixelmotors.com.br',
  },
};

/**
 * Recupera os dados cadastrais oficiais e padronizados da concessionária
 * recorrendo prioritariamente à tabela de lojas (Organização / stores).
 */
export function getStoreFromDatabase(
  storeIdOrRef: string | null | undefined,
  storesFromDb?: Array<any>
): ResolvedStore {
  const cleanRef = (storeIdOrRef || '').toLowerCase().trim();

  if (
    cleanRef === 'store-montesclaros' ||
    cleanRef === STORE_MONTESCLAROS_UUID ||
    cleanRef === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
    cleanRef.includes('montes') ||
    cleanRef.includes('polo norte') ||
    cleanRef.includes('moc')
  ) {
    return OFFICIAL_STORES['store-montesclaros'];
  }

  if (
    cleanRef === 'store-divinopolis' ||
    cleanRef === STORE_DIVINOPOLIS_UUID ||
    cleanRef.includes('divin') ||
    cleanRef.includes('matriz')
  ) {
    return OFFICIAL_STORES['store-divinopolis'];
  }

  if (storesFromDb && storesFromDb.length > 0) {
    const found = storesFromDb.find((s) => {
      const sId = (s.id || '').toLowerCase();
      const sName = (s.name || '').toLowerCase();
      const sCity = (s.city || '').toLowerCase();
      return (
        sId === cleanRef ||
        sName === cleanRef ||
        (cleanRef && (sName.includes(cleanRef) || cleanRef.includes(sName))) ||
        (cleanRef && (sCity.includes(cleanRef) || cleanRef.includes(sCity)))
      );
    });

    if (found) {
      const isMontes =
        (found.name || found.city || '').toLowerCase().includes('montes') ||
        (found.city || '').toLowerCase().includes('moc') ||
        (found.id || '').toLowerCase() === STORE_MONTESCLAROS_UUID ||
        (found.id || '').toLowerCase() === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
        (found.id || '').toLowerCase() === 'store-montesclaros';
      return {
        storeId: isMontes ? 'store-montesclaros' : 'store-divinopolis',
        storeName: isMontes ? 'Concessionária Montes Claros' : (found.name || 'Concessionária Divinópolis'),
        city: isMontes ? 'Montes Claros' : (found.city || 'Divinópolis'),
        state: found.state || 'MG',
        cnpj: found.cnpj || (isMontes ? '18.456.789/0002-82' : '18.456.789/0001-01'),
        address: found.address || (isMontes ? 'Av. Deputado Esteves Rodrigues, 850 - Centro, Montes Claros/MG' : 'Av. Autorama, 1200 - Judeia, Divinópolis/MG'),
        phone: found.phone || (isMontes ? '(38) 3221-2000' : '(37) 3222-1000'),
        email: found.email || (isMontes ? 'montesclaros@pixelmotors.com.br' : 'divinopolis@pixelmotors.com.br'),
      };
    }
  }

  if (storeIdOrRef && OFFICIAL_STORES[storeIdOrRef]) {
    return OFFICIAL_STORES[storeIdOrRef];
  }

  return OFFICIAL_STORES['store-divinopolis'];
}

/**
 * Mapeamento canônico dos consultores de vendas para suas respectivas lojas de lotação
 */
export const SELLER_TO_STORE_MAP: Record<string, string> = {
  // Montes Claros
  mariana: 'store-montesclaros',
  sabino: 'store-montesclaros',
  halana: 'store-montesclaros',
  sabrina: 'store-montesclaros',
  natan: 'store-montesclaros',
  renan: 'store-montesclaros',
  'henrique renan': 'store-montesclaros',
  'joao pedro': 'store-montesclaros',
  shineraymoc: 'store-montesclaros',
  moc: 'store-montesclaros',

  // Divinópolis
  lilian: 'store-divinopolis',
  geibriel: 'store-divinopolis',
  breno: 'store-divinopolis',
  carlos: 'store-divinopolis',
  vinicios: 'store-divinopolis',
  daniel: 'store-divinopolis',
  elias: 'store-divinopolis',
  shineraydiv: 'store-divinopolis',
  matriz: 'store-divinopolis',
};

/**
 * Determina com precisão contábil e operacional a concessionária faturadora da venda.
 * Garante que vendas de Divinópolis fiquem estritamente em Divinópolis e de Montes Claros em Montes Claros.
 */
export function resolveSaleStore(
  saleOrContract: {
    store_id?: string | null;
    raw_store_id?: string | null;
    store?: { id?: string; name?: string; city?: string } | null;
    vendedor?: string | null;
    operator?: { full_name?: string } | null;
    observacoes?: string | null;
    cliente?: string | null;
    regiao?: string | null;
    chassi?: string | null;
    external_data?: any;
  },
  employeesList?: Array<{ full_name?: string; profile_id?: string | null; store_id?: string | null }>
): ResolvedStore {
  const ext = (saleOrContract.external_data || {}) as any;

  // 1. Prioridade Máxima: se a venda/contrato possui loja explicitamente gravada no banco ou external_data
  const explicitStoreId = String(
    saleOrContract.store_id ||
    saleOrContract.raw_store_id ||
    saleOrContract.store?.id ||
    ext.store_id ||
    ''
  ).toLowerCase().trim();

  const explicitStoreName = String(
    saleOrContract.store?.name ||
    ext.store_name ||
    ''
  ).toLowerCase().trim();

  if (
    explicitStoreId === 'store-montesclaros' ||
    explicitStoreId === STORE_MONTESCLAROS_UUID ||
    explicitStoreId === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
    explicitStoreName.includes('montes') ||
    explicitStoreName.includes('polo norte') ||
    explicitStoreName.includes('moc') ||
    (saleOrContract.store?.city || '').toLowerCase().includes('montes')
  ) {
    return OFFICIAL_STORES['store-montesclaros'];
  }

  if (
    explicitStoreId === 'store-divinopolis' ||
    explicitStoreId === STORE_DIVINOPOLIS_UUID ||
    explicitStoreName.includes('divin') ||
    explicitStoreName.includes('matriz') ||
    (saleOrContract.store?.city || '').toLowerCase().includes('divin')
  ) {
    return OFFICIAL_STORES['store-divinopolis'];
  }

  if (explicitStoreId && OFFICIAL_STORES[explicitStoreId]) {
    return OFFICIAL_STORES[explicitStoreId];
  }

  // 2. Prioridade 2: Lotação do Vendedor no cadastro de colaboradores (employees) ou mapeamento canônico
  const sellerRaw = String(
    saleOrContract.vendedor ||
    saleOrContract.operator?.full_name ||
    ext.seller_name ||
    ext.operator_name ||
    ext.vendedor ||
    ''
  ).trim().toLowerCase();

  if (sellerRaw) {
    if (employeesList && employeesList.length > 0) {
      const emp = employeesList.find((e) => {
        const eName = String(e.full_name || '').trim().toLowerCase();
        const pId = String(e.profile_id || '').trim().toLowerCase();
        return (
          eName === sellerRaw ||
          pId === sellerRaw ||
          (sellerRaw.length > 2 && eName.includes(sellerRaw)) ||
          (eName.length > 2 && sellerRaw.includes(eName))
        );
      });

      if (emp?.store_id) {
        const empStoreId = String(emp.store_id).toLowerCase().trim();
        const isMoc =
          empStoreId === 'store-montesclaros' ||
          empStoreId === STORE_MONTESCLAROS_UUID ||
          empStoreId === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
          empStoreId.includes('montes') ||
          empStoreId.includes('moc');

        return isMoc ? OFFICIAL_STORES['store-montesclaros'] : OFFICIAL_STORES['store-divinopolis'];
      }
    }

    // Mapeamento canônico direto por nome do vendedor
    for (const [key, storeId] of Object.entries(SELLER_TO_STORE_MAP)) {
      if (sellerRaw.includes(key)) {
        return OFFICIAL_STORES[storeId] || OFFICIAL_STORES['store-divinopolis'];
      }
    }
  }

  // 3. Prioridade 3: Menção explícita de loja / polo nas observações operacionais da venda
  const obs = String(saleOrContract.observacoes || ext.observacoes || '').toLowerCase();
  if (obs.includes('montes claros') || obs.includes('polo norte') || obs.includes('moc')) {
    return OFFICIAL_STORES['store-montesclaros'];
  }
  if (obs.includes('divinopolis') || obs.includes('divinópolis') || obs.includes('matriz')) {
    return OFFICIAL_STORES['store-divinopolis'];
  }

  // 4. Prioridade 4: Região / Cidade da venda e entrega
  const targetRegion = String(saleOrContract.regiao || ext.regiao || ext.buyer_city || '').trim();
  if (targetRegion) {
    if (isMontesClarosRegion(targetRegion)) {
      return OFFICIAL_STORES['store-montesclaros'];
    }
    const cleanCity = normalizeCityKey(targetRegion);
    const geoMeta = CITY_COORDINATES[cleanCity];
    if (geoMeta?.poloAtendimento === 'MONTES CLAROS') {
      return OFFICIAL_STORES['store-montesclaros'];
    }
    if (geoMeta?.poloAtendimento === 'DIVINOPOLIS' || cleanCity.includes('DIVINOPOLIS')) {
      return OFFICIAL_STORES['store-divinopolis'];
    }
  }

  // 5. Padrão contábil: Concessionária Divinópolis
  return OFFICIAL_STORES['store-divinopolis'];
}
