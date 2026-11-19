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
 * ('store-divinopolis', 'store-montesclaros', 'store-multimarcas'), além de lidar com estoque sem loja vinculada (null/unassigned).
 * Garante separação total entre SHINERAY MONTES CLAROS e L1MA MOTORS MULTIMARCAS.
 */
export function isMatchingStore(vehicleStoreId: string | null | undefined, filterStoreId: string): boolean {
  if (!filterStoreId || filterStoreId === 'all') return true;
  if (vehicleStoreId === filterStoreId) return true;

  const cleanFilter = filterStoreId.toLowerCase().trim();
  const cleanVehicleStore = (vehicleStoreId || '').toLowerCase().trim();

  const isMultimarcas = (idOrName: string) =>
    idOrName === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
    idOrName === 'store-multimarcas' ||
    idOrName.includes('multimarcas') ||
    idOrName.includes('multi marcas') ||
    idOrName.includes('seminovos');

  const isFilterMultimarcas = isMultimarcas(cleanFilter);
  const isVehicleMultimarcas = isMultimarcas(cleanVehicleStore);

  // 1. Multimarcas é estritamente isolada:
  // Se o filtro for Multimarcas, DEVE casar estritamente com Multimarcas
  if (isFilterMultimarcas) {
    return isVehicleMultimarcas;
  }

  // Se o item for Multimarcas, JAMAIS casa com Shineray Montes Claros ou Divinópolis
  if (isVehicleMultimarcas) {
    return false;
  }

  // 2. Matriz / Divinópolis
  const isDivinopolis = (idOrName: string) =>
    idOrName === 'store-divinopolis' ||
    idOrName === STORE_DIVINOPOLIS_UUID ||
    idOrName.includes('divinopolis') ||
    idOrName.includes('divinópolis') ||
    idOrName.includes('matriz');

  const isFilterDivinopolis = isDivinopolis(cleanFilter);
  const isVehicleDivinopolis = isDivinopolis(cleanVehicleStore);

  if (isFilterDivinopolis) {
    if (!vehicleStoreId) return true;
    return isVehicleDivinopolis;
  }

  // 3. Concessionária Shineray Montes Claros (excluindo Multimarcas)
  const isMontesClaros = (idOrName: string) =>
    (idOrName === 'store-montesclaros' ||
      idOrName === STORE_MONTESCLAROS_UUID ||
      idOrName.includes('montes') ||
      idOrName.includes('moc') ||
      idOrName.includes('polo norte')) &&
    !isMultimarcas(idOrName);

  const isFilterMontes = isMontesClaros(cleanFilter);
  const isVehicleMontes = isMontesClaros(cleanVehicleStore);

  if (isFilterMontes) {
    return isVehicleMontes;
  }

  return cleanFilter === cleanVehicleStore;
}

/**
 * Retorna o prefixo oficial do contrato ('MLT', 'MOC', 'DIV' ou dinâmico para novas filiais) de acordo com a loja.
 * - L1MA MOTORS MULTIMARCAS: 'MLT'
 * - SHINERAY MONTES CLAROS: 'MOC'
 * - SHINERAY DIVINÓPOLIS (Matriz): 'DIV'
 * - OUTRAS CONCESSIONÁRIAS: Sigla gerada dinamicamente (ex: Patos de Minas -> 'PTM')
 */
export function getContractPrefix(
  storeId?: string | null,
  storeName?: string | null
): string {
  const sId = (storeId || '').toLowerCase().trim();
  const sName = (storeName || '').toLowerCase().trim();

  // 1. Multimarcas tem precedência estrita
  if (
    sId === STORE_MONTESCLAROS_MULTIMARCAS_UUID.toLowerCase() ||
    sId === 'store-multimarcas' ||
    sId.includes('multimarcas') ||
    sId.includes('multi marcas') ||
    sId.includes('seminovos') ||
    sName.includes('multimarcas') ||
    sName.includes('multi marcas') ||
    sName.includes('seminovos')
  ) {
    return 'MLT';
  }

  // 2. Concessionária Montes Claros
  if (
    sId === STORE_MONTESCLAROS_UUID.toLowerCase() ||
    sId === 'store-montesclaros' ||
    sId.includes('montes') ||
    sId.includes('moc') ||
    sName.includes('montes') ||
    sName.includes('moc') ||
    sName.includes('polo norte')
  ) {
    return 'MOC';
  }

  // 3. Divinópolis
  if (
    sId === STORE_DIVINOPOLIS_UUID.toLowerCase() ||
    sId === 'store-divinopolis' ||
    sId.includes('divin') ||
    sId.includes('matriz') ||
    sName.includes('divin') ||
    sName.includes('matriz')
  ) {
    return 'DIV';
  }

  // 4. Nova Concessionária Dinâmica (ex: Patos de Minas -> PTM)
  const shortName = formatStoreShortName(storeName || storeId);
  const words = shortName.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim().split(/\s+/).filter(w => !['de', 'da', 'do', 'e'].includes(w.toLowerCase()));
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  }
  if (words.length === 2) {
    return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  }
  if (words.length === 1 && words[0].length >= 3) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return 'CON';
}

/**
 * Abrevia nomes extensos de concessionárias removendo tudo que se repete
 * ("SHINERAY", "GRUPO L1MA MOTORS", "L1MA MOTORS", "CONCESSIONÁRIA").
 * Exemplos:
 * - "SHINERAY GRUPO L1MA MOTORS MONTES CLAROS" -> "Montes Claros"
 * - "SHINERAY GRUPO L1MA MOTORS DIVINOPOLIS" -> "Divinópolis"
 * - "SHINERAY GRUPO L1MA MOTORS PATOS DE MINAS" -> "Patos de Minas"
 * - "L1MA MOTORS MULTIMARCAS" -> "Multimarcas"
 */
export function formatStoreShortName(storeNameOrId?: string | null): string {
  if (!storeNameOrId) return 'Divinópolis';
  const clean = String(storeNameOrId).trim();
  const lower = clean.toLowerCase();

  // 1. Multimarcas
  if (
    lower === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
    lower === 'store-multimarcas' ||
    lower.includes('multimarcas') ||
    lower.includes('multi marcas') ||
    lower.includes('seminovos')
  ) {
    return 'Multimarcas';
  }

  // 2. Montes Claros
  if (
    lower === STORE_MONTESCLAROS_UUID ||
    lower === 'store-montesclaros' ||
    lower.includes('montes') ||
    lower.includes('moc')
  ) {
    return 'Montes Claros';
  }

  // 3. Divinópolis
  if (
    lower === STORE_DIVINOPOLIS_UUID ||
    lower === 'store-divinopolis' ||
    lower.includes('divin') ||
    lower.includes('matriz')
  ) {
    return 'Divinópolis';
  }

  // 4. Se for UUID de outra loja adicionada, consulta o cache persistente
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('dealflow_custom_stores_v1') : null;
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const match = list.find((s) => s.id === clean);
          if (match && match.name) {
            return formatStoreShortName(match.name);
          }
        }
      }
    } catch {}
  }

  // Caso seja outro nome/formato, remove palavras repetitivas
  return clean
    .replace(/^shineray\s+/i, '')
    .replace(/^grupo\s+l1ma\s+motors\s+/i, '')
    .replace(/^l1ma\s+motors\s+/i, '')
    .replace(/^concession[áa]ria\s+/i, '')
    .trim() || clean;
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
export function getStoreDisplayName(storeOrSale?: any): 'Multimarcas' | 'Montes Claros' | 'Divinópolis' {
  const short = formatStoreShortName(
    storeOrSale?.store_name ||
    storeOrSale?.name ||
    storeOrSale?.store_id ||
    storeOrSale?.store?.name ||
    storeOrSale?.store?.id ||
    storeOrSale
  );
  if (short === 'Multimarcas') return 'Multimarcas';
  if (short === 'Montes Claros') return 'Montes Claros';
  return 'Divinópolis';
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
    storeId: STORE_DIVINOPOLIS_UUID,
    storeName: 'SHINERAY GRUPO L1MA MOTORS DIVINOPOLIS',
    city: 'Divinópolis',
    state: 'MG',
    cnpj: '18.456.789/0001-01',
    address: 'RUA ESPIRITO SANTOS 307, VIA BELO HORIZONTE, Divinópolis/MG',
    phone: '(37) 99843-9319',
    email: 'shineraydivinopolisoficial@gmail.com',
  },
  'store-montesclaros': {
    storeId: STORE_MONTESCLAROS_UUID,
    storeName: 'SHINERAY GRUPO L1MA MOTORS MONTES CLAROS',
    city: 'Montes Claros',
    state: 'MG',
    cnpj: '18.456.789/0002-82',
    address: 'AV. JOAO XXIII, Nº 990, Montes Claros/MG',
    phone: '(38) 99938-1522',
    email: 'ADMBRENO@INDEX.COM',
  },
  'store-multimarcas': {
    storeId: STORE_MONTESCLAROS_MULTIMARCAS_UUID,
    storeName: 'L1MA MOTORS MULTIMARCAS',
    city: 'Montes Claros',
    state: 'MG',
    cnpj: '18.456.789/0002-82',
    address: 'AV. JOÃO XXIII N°990 B. EDGAR PEREIRA, Montes Claros/MG',
    phone: '(38) 99938-1522',
    email: 'multimarcas@pixelmotors.com.br',
  },
  [STORE_DIVINOPOLIS_UUID]: {
    storeId: STORE_DIVINOPOLIS_UUID,
    storeName: 'SHINERAY GRUPO L1MA MOTORS DIVINOPOLIS',
    city: 'Divinópolis',
    state: 'MG',
    cnpj: '18.456.789/0001-01',
    address: 'RUA ESPIRITO SANTOS 307, VIA BELO HORIZONTE, Divinópolis/MG',
    phone: '(37) 99843-9319',
    email: 'shineraydivinopolisoficial@gmail.com',
  },
  [STORE_MONTESCLAROS_UUID]: {
    storeId: STORE_MONTESCLAROS_UUID,
    storeName: 'SHINERAY GRUPO L1MA MOTORS MONTES CLAROS',
    city: 'Montes Claros',
    state: 'MG',
    cnpj: '18.456.789/0002-82',
    address: 'AV. JOAO XXIII, Nº 990, Montes Claros/MG',
    phone: '(38) 99938-1522',
    email: 'ADMBRENO@INDEX.COM',
  },
  [STORE_MONTESCLAROS_MULTIMARCAS_UUID]: {
    storeId: STORE_MONTESCLAROS_MULTIMARCAS_UUID,
    storeName: 'L1MA MOTORS MULTIMARCAS',
    city: 'Montes Claros',
    state: 'MG',
    cnpj: '18.456.789/0002-82',
    address: 'AV. JOÃO XXIII N°990 B. EDGAR PEREIRA, Montes Claros/MG',
    phone: '(38) 99938-1522',
    email: 'multimarcas@pixelmotors.com.br',
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

  // 1. Multimarcas PRIMEIRO para evitar colisão com Montes Claros
  if (
    cleanRef === 'store-multimarcas' ||
    cleanRef === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
    cleanRef.includes('multimarcas') ||
    cleanRef.includes('multi marcas') ||
    cleanRef.includes('seminovos')
  ) {
    return OFFICIAL_STORES['store-multimarcas'];
  }

  // 2. Concessionária Shineray Montes Claros
  if (
    cleanRef === 'store-montesclaros' ||
    cleanRef === STORE_MONTESCLAROS_UUID ||
    cleanRef.includes('montes') ||
    cleanRef.includes('polo norte') ||
    cleanRef.includes('moc')
  ) {
    return OFFICIAL_STORES['store-montesclaros'];
  }

  // 3. Matriz / Divinópolis
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
      const isMulti =
        (found.id || '').toLowerCase() === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
        (found.name || '').toLowerCase().includes('multimarcas');
      const isMontes =
        !isMulti &&
        ((found.name || found.city || '').toLowerCase().includes('montes') ||
          (found.city || '').toLowerCase().includes('moc') ||
          (found.id || '').toLowerCase() === STORE_MONTESCLAROS_UUID ||
          (found.id || '').toLowerCase() === 'store-montesclaros');
      return {
        storeId: isMulti ? STORE_MONTESCLAROS_MULTIMARCAS_UUID : isMontes ? STORE_MONTESCLAROS_UUID : (found.id || cleanRef),
        storeName: found.name || (isMulti ? 'L1MA MOTORS MULTIMARCAS' : isMontes ? 'SHINERAY GRUPO L1MA MOTORS MONTES CLAROS' : found.name || 'Concessionária'),
        city: found.city || (isMontes || isMulti ? 'Montes Claros' : 'Minas Gerais'),
        state: found.state || 'MG',
        cnpj: found.cnpj || (isMontes || isMulti ? '18.456.789/0002-82' : found.cnpj || null),
        address: found.address || null,
        phone: found.phone || null,
        email: found.email || null,
      };
    }
  }

  // Consulta cache local persistente para filiais adicionadas dinamicamente
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('dealflow_custom_stores_v1') : null;
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        const found = list.find((s) => {
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
          return {
            storeId: found.id || cleanRef,
            storeName: found.name || 'Concessionária',
            city: found.city || 'Minas Gerais',
            state: found.state || 'MG',
            cnpj: found.cnpj || null,
            address: found.address || null,
            phone: found.phone || null,
            email: found.email || null,
          };
        }
      }
    }
  } catch {}

  if (storeIdOrRef && OFFICIAL_STORES[storeIdOrRef]) {
    return OFFICIAL_STORES[storeIdOrRef];
  }

  // Se for UUID válido de nova filial, preserva o ID e resolve o nome amigável
  if (storeIdOrRef && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeIdOrRef)) {
    return {
      storeId: storeIdOrRef,
      storeName: formatStoreShortName(storeIdOrRef),
      city: 'Minas Gerais',
      state: 'MG',
    };
  }

  return OFFICIAL_STORES['store-divinopolis'];
}

/**
 * Garante que qualquer referência de loja (slug, nome, UUID) seja convertida
 * no UUID PostgreSQL real correspondente, nunca falhando constraints do banco.
 */
export function toValidStoreUuid(storeIdOrRef: string | null | undefined): string {
  if (!storeIdOrRef) return STORE_DIVINOPOLIS_UUID;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeIdOrRef);
  if (isUuid) return storeIdOrRef;
  const resolved = getStoreFromDatabase(storeIdOrRef);
  return resolved.storeId || STORE_DIVINOPOLIS_UUID;
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

  // Verifica MULTIMARCAS PRIMEIRO para nunca fundir com concessionária Shineray Montes Claros
  if (
    explicitStoreId === 'store-multimarcas' ||
    explicitStoreId === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
    explicitStoreName.includes('multimarcas') ||
    explicitStoreName.includes('multi marcas') ||
    explicitStoreName.includes('seminovos')
  ) {
    return OFFICIAL_STORES['store-multimarcas'];
  }

  // Concessionária Shineray Montes Claros
  if (
    explicitStoreId === 'store-montesclaros' ||
    explicitStoreId === STORE_MONTESCLAROS_UUID ||
    explicitStoreName.includes('montes') ||
    explicitStoreName.includes('polo norte') ||
    explicitStoreName.includes('moc') ||
    (saleOrContract.store?.city || '').toLowerCase().includes('montes')
  ) {
    return OFFICIAL_STORES['store-montesclaros'];
  }

  // Concessionária Shineray Divinópolis
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

  // Se a venda possui uma loja explícita registrada (banco / cache / objeto store)
  if (explicitStoreId) {
    const dbResolved = getStoreFromDatabase(explicitStoreId);
    if (dbResolved && dbResolved.storeId && dbResolved.storeId !== STORE_DIVINOPOLIS_UUID) {
      return dbResolved;
    }
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
        if (
          empStoreId === 'store-multimarcas' ||
          empStoreId === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
          empStoreId.includes('multimarcas')
        ) {
          return OFFICIAL_STORES['store-multimarcas'];
        }
        const isMoc =
          empStoreId === 'store-montesclaros' ||
          empStoreId === STORE_MONTESCLAROS_UUID ||
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
  if (obs.includes('multimarcas') || obs.includes('seminovos')) {
    return OFFICIAL_STORES['store-multimarcas'];
  }
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

  // 5. Se o objeto de venda carrega id/nome de concessionária válido
  if (saleOrContract.store?.id || saleOrContract.store?.name) {
    return {
      storeId: saleOrContract.store?.id || toValidStoreUuid(saleOrContract.store?.name),
      storeName: saleOrContract.store?.name || 'Concessionária',
      city: saleOrContract.store?.city || 'Minas Gerais',
      state: 'MG',
    };
  }

  // Padrão contábil: Concessionária Divinópolis
  return OFFICIAL_STORES['store-divinopolis'];
}
