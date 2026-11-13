/**
 * Mapeamento e Resolução Oficial de Concessionárias e Vendedores
 * Garante que vendas de uma loja nunca sejam atribuídas a outra loja
 * independentemente do endereço ou cidade de entrega do comprador.
 */

import { isMontesClarosRegion, normalizeCityKey, CITY_COORDINATES } from '@/lib/geoCoordinates';

export const STORE_DIVINOPOLIS_UUID = 'ccf8e097-09d7-4305-8077-5c16fc8b5634';
export const STORE_MONTESCLAROS_UUID = 'e8254a81-d669-464b-9806-457ba25ce7f0';

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

  // Montes Claros
  const isMontesFilter =
    cleanFilter === 'store-montesclaros' ||
    cleanFilter === STORE_MONTESCLAROS_UUID ||
    cleanFilter.includes('montes') ||
    cleanFilter.includes('moc') ||
    cleanFilter.includes('polo norte');

  if (isMontesFilter) {
    if (
      cleanVehicleStore === 'store-montesclaros' ||
      cleanVehicleStore === STORE_MONTESCLAROS_UUID ||
      cleanVehicleStore.includes('montes') ||
      cleanVehicleStore.includes('moc') ||
      cleanVehicleStore.includes('polo norte')
    ) {
      return true;
    }
  }

  return cleanFilter === cleanVehicleStore;
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
    storeName: 'Concessionária Divinópolis (Matriz Oeste)',
    city: 'Divinópolis',
    state: 'MG',
    cnpj: '18.456.789/0001-01',
    address: 'Av. Autorama, 1200 - Judeia, Divinópolis/MG',
    phone: '(37) 3222-1000',
    email: 'divinopolis@pixelmotors.com.br',
  },
  'store-montesclaros': {
    storeId: 'store-montesclaros',
    storeName: 'Concessionária Montes Claros (Polo Norte)',
    city: 'Montes Claros',
    state: 'MG',
    cnpj: '18.456.789/0002-82',
    address: 'Av. Deputado Esteves Rodrigues, 850 - Centro, Montes Claros/MG',
    phone: '(38) 3221-2000',
    email: 'montesclaros@pixelmotors.com.br',
  },
  'ccf8e097-09d7-4305-8077-5c16fc8b5634': {
    storeId: 'store-divinopolis',
    storeName: 'Concessionária Divinópolis (Matriz Oeste)',
    city: 'Divinópolis',
    state: 'MG',
    cnpj: '18.456.789/0001-01',
    address: 'Av. Autorama, 1200 - Judeia, Divinópolis/MG',
    phone: '(37) 3222-1000',
    email: 'divinopolis@pixelmotors.com.br',
  },
  'e8254a81-d669-464b-9806-457ba25ce7f0': {
    storeId: 'store-montesclaros',
    storeName: 'Concessionária Montes Claros (Polo Norte)',
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
    cleanRef === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
    cleanRef.includes('montes') ||
    cleanRef.includes('polo norte') ||
    cleanRef.includes('moc')
  ) {
    return OFFICIAL_STORES['store-montesclaros'];
  }

  if (
    cleanRef === 'store-divinopolis' ||
    cleanRef === 'ccf8e097-09d7-4305-8077-5c16fc8b5634' ||
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
        (found.id || '').toLowerCase() === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
        (found.id || '').toLowerCase() === 'store-montesclaros';
      return {
        storeId: isMontes ? 'store-montesclaros' : 'store-divinopolis',
        storeName: found.name || (isMontes ? 'Concessionária Montes Claros (Polo Norte)' : 'Concessionária Divinópolis (Matriz Oeste)'),
        city: found.city || (isMontes ? 'Montes Claros' : 'Divinópolis'),
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
  elias: 'store-montesclaros',
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
};

/**
 * Determina com precisão contábil e operacional a concessionária faturadora da venda.
 * Garante que vendas de Divinópolis fiquem estritamente em Divinópolis e de Montes Claros em Montes Claros.
 */
export function resolveSaleStore(
  saleOrContract: {
    store_id?: string | null;
    raw_store_id?: string | null;
    store?: { id?: string; name?: string } | null;
    vendedor?: string | null;
    operator?: { full_name?: string } | null;
    observacoes?: string | null;
    cliente?: string | null;
    regiao?: string | null;
    chassi?: string | null;
  },
  employeesList?: Array<{ full_name?: string; profile_id?: string | null; store_id?: string | null }>
): ResolvedStore {
  // 1. Prioridade Máxima: se a venda/contrato possui loja explicitamente gravada no banco
  const explicitStoreId = String(saleOrContract.store_id || saleOrContract.raw_store_id || saleOrContract.store?.id || '').toLowerCase().trim();
  const explicitStoreName = String(saleOrContract.store?.name || '').toLowerCase().trim();

  if (
    explicitStoreId === 'store-montesclaros' ||
    explicitStoreId === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
    explicitStoreName.includes('montes') ||
    explicitStoreName.includes('polo norte') ||
    explicitStoreName.includes('moc')
  ) {
    return OFFICIAL_STORES['store-montesclaros'];
  }

  if (
    explicitStoreId === 'store-divinopolis' ||
    explicitStoreId === 'ccf8e097-09d7-4305-8077-5c16fc8b5634' ||
    explicitStoreName.includes('divin') ||
    explicitStoreName.includes('matriz')
  ) {
    return OFFICIAL_STORES['store-divinopolis'];
  }

  if (explicitStoreId && OFFICIAL_STORES[explicitStoreId]) {
    return OFFICIAL_STORES[explicitStoreId];
  }

  // 2. Prioridade 2: Lotação do Vendedor no cadastro de colaboradores (employees) ou mapeamento canônico
  const sellerRaw = String(saleOrContract.vendedor || saleOrContract.operator?.full_name || '').trim().toLowerCase();
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
          empStoreId === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
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
  const obs = String(saleOrContract.observacoes || '').toLowerCase();
  if (obs.includes('montes claros') || obs.includes('polo norte') || obs.includes('moc')) {
    return OFFICIAL_STORES['store-montesclaros'];
  }
  if (obs.includes('divinopolis') || obs.includes('divinópolis') || obs.includes('matriz')) {
    return OFFICIAL_STORES['store-divinopolis'];
  }

  // 4. Prioridade 4: Região / Cidade da venda e entrega
  if (saleOrContract.regiao) {
    if (isMontesClarosRegion(saleOrContract.regiao)) {
      return OFFICIAL_STORES['store-montesclaros'];
    }
    const cleanCity = normalizeCityKey(saleOrContract.regiao);
    const geoMeta = CITY_COORDINATES[cleanCity];
    if (geoMeta?.poloAtendimento === 'MONTES CLAROS') {
      return OFFICIAL_STORES['store-montesclaros'];
    }
    if (geoMeta?.poloAtendimento === 'DIVINOPOLIS' || cleanCity.includes('DIVINOPOLIS')) {
      return OFFICIAL_STORES['store-divinopolis'];
    }
  }

  // 5. Padrão contábil: Concessionária Divinópolis (Matriz Oeste)
  return OFFICIAL_STORES['store-divinopolis'];
}
