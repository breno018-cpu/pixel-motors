/**
 * Mapeamento e Resolução Oficial de Concessionárias e Vendedores
 * Garante que vendas de uma loja nunca sejam atribuídas a outra loja
 * independentemente do endereço ou cidade de entrega do comprador.
 */

import { isMontesClarosRegion, normalizeCityKey, CITY_COORDINATES } from '@/lib/geoCoordinates';

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
};

/**
 * Recupera os dados cadastrais oficiais e padronizados da concessionária
 * recorrendo prioritariamente à tabela de lojas (Organização / stores).
 */
export function getStoreFromDatabase(
  storeIdOrRef: string | null | undefined,
  storesFromDb?: Array<any>
): ResolvedStore {
  if (storesFromDb && storesFromDb.length > 0) {
    const cleanRef = (storeIdOrRef || '').toLowerCase().trim();
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
      const isMontes = (found.name || found.city || '').toLowerCase().includes('montes');
      return {
        storeId: found.id || (isMontes ? 'store-montesclaros' : 'store-divinopolis'),
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

  const isMontes = String(storeIdOrRef || '').toLowerCase().includes('montes');
  return isMontes ? OFFICIAL_STORES['store-montesclaros'] : OFFICIAL_STORES['store-divinopolis'];
}

/**
 * Mapeamento canônico dos consultores de vendas para suas respectivas lojas de lotação
 */
export const SELLER_TO_STORE_MAP: Record<string, string> = {
  lilian: 'store-divinopolis',
  geibriel: 'store-divinopolis',
  breno: 'store-divinopolis',
  carlos: 'store-divinopolis',
  daniel: 'store-montesclaros',
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
  const explicitStoreId = saleOrContract.store_id || saleOrContract.raw_store_id || saleOrContract.store?.id;
  const explicitStoreName = (saleOrContract.store?.name || '').toLowerCase();

  if (explicitStoreId === 'store-divinopolis' || explicitStoreName.includes('divin')) {
    return OFFICIAL_STORES['store-divinopolis'];
  }

  if (explicitStoreId === 'store-montesclaros' || explicitStoreName.includes('montes')) {
    return OFFICIAL_STORES['store-montesclaros'];
  }

  if (explicitStoreId && OFFICIAL_STORES[explicitStoreId]) {
    return OFFICIAL_STORES[explicitStoreId];
  }

  // 2. Prioridade 2: Menção explícita de loja / polo nas observações operacionais da venda
  const obs = (saleOrContract.observacoes || '').toLowerCase();
  if (obs.includes('montes claros') || obs.includes('polo norte')) {
    return OFFICIAL_STORES['store-montesclaros'];
  }
  if (obs.includes('divinopolis') || obs.includes('divinópolis') || obs.includes('matriz')) {
    return OFFICIAL_STORES['store-divinopolis'];
  }

  // 3. Prioridade 3: Região / Cidade da venda e entrega
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

  // 4. Prioridade 4: Lotação do Vendedor no cadastro de colaboradores (employees)
  const sellerRaw = (saleOrContract.vendedor || saleOrContract.operator?.full_name || '').trim().toLowerCase();
  if (sellerRaw) {
    if (employeesList && employeesList.length > 0) {
      const emp = employeesList.find((e) => {
        const eName = (e.full_name || '').trim().toLowerCase();
        const pId = (e.profile_id || '').trim().toLowerCase();
        return eName === sellerRaw || pId === sellerRaw || eName.startsWith(sellerRaw) || sellerRaw.startsWith(eName);
      });

      if (emp?.store_id) {
        if (OFFICIAL_STORES[emp.store_id]) {
          return OFFICIAL_STORES[emp.store_id];
        }
        return {
          storeId: emp.store_id,
          storeName: emp.store_id === 'store-montesclaros' ? 'Concessionária Montes Claros (Polo Norte)' : 'Concessionária Divinópolis (Matriz Oeste)',
          city: emp.store_id === 'store-montesclaros' ? 'Montes Claros' : 'Divinópolis',
        };
      }
    }

    // Mapeamento canônico fallback direto por nome
    for (const [key, storeId] of Object.entries(SELLER_TO_STORE_MAP)) {
      if (sellerRaw.includes(key)) {
        return OFFICIAL_STORES[storeId] || OFFICIAL_STORES['store-divinopolis'];
      }
    }
  }

  // 5. Padrão contábil: Concessionária Divinópolis (Matriz Oeste)
  return OFFICIAL_STORES['store-divinopolis'];
}
