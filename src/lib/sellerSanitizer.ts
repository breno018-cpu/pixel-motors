import { DEFAULT_OFFICIAL_USERS, STORE_UUIDS } from '@/lib/userService';
import { STORE_DIVINOPOLIS_UUID, STORE_MONTESCLAROS_UUID, STORE_MONTESCLAROS_MULTIMARCAS_UUID, isMatchingStore, SELLER_TO_STORE_MAP } from '@/lib/storeResolution';
import { normalizeName } from '@/lib/salesScope';

/**
 * Verifica se uma string corresponde a um UUID (v4 ou padrão de 36 caracteres com hífens).
 */
export function isUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

/**
 * Verifica se a string é puramente numérica, código de sistema ou prefixo de id técnico.
 */
export function isNumericOrCode(str?: string | null): boolean {
  if (!str) return false;
  const clean = str.trim();
  // Apenas números (ex: "10420", "0", "1", "123")
  if (/^\d+$/.test(clean)) return true;
  // Prefixos técnicos de IDs ou linhas
  if (/^(?:row-v\d+|sheet-|seed-|emp-|user-|usr_|tmp-|sale-|ctr-)/i.test(clean)) return true;
  // Hashes ou códigos hexadecimais longos
  if (/^[0-9a-f]{16,}$/i.test(clean)) return true;
  return false;
}

/**
 * Verifica se o nome é um nome humano válido e aceitável para exibição como vendedor/colaborador.
 * Descarta terminantemente:
 * - UUIDs
 * - Códigos numéricos
 * - Placeholders genéricos ('Vendedor', 'Balcão', 'Outro', 'Sistema', etc.)
 * - Strings com menos de 3 caracteres
 */
export function isValidSellerName(name?: string | null): boolean {
  if (!name) return false;
  const clean = name.trim();
  if (clean.length < 3) return false;
  if (isUUID(clean)) return false;
  if (isNumericOrCode(clean)) return false;

  const lower = clean.toLowerCase();
  const blacklisted = [
    'vendedor',
    'vendedora',
    'vendedores',
    'consultor',
    'consultora',
    'comercial',
    'balcão',
    'balcao',
    'cliente',
    'cliente balcão',
    'cliente balcao',
    'sem vendedor',
    'não informado',
    'nao informado',
    'não definido',
    'nao definido',
    'outro',
    'outros',
    'sistema',
    'admin',
    'administrador',
    'null',
    'undefined',
    'nan',
    'teste',
    'test',
    '—',
    '-',
    'nenhum',
  ];

  if (blacklisted.includes(lower)) return false;
  return true;
}

/**
 * Resolve o nome de exibição oficial de um vendedor a partir de seu identificador
 * (UUID, email, alias, nome abreviado ou nome completo), garantindo que UUIDs
 * e códigos numéricos NUNCA vazem para a interface.
 */
export function resolveSellerDisplayName(
  raw?: string | null,
  employees?: Array<{ id?: string; profile_id?: string | null; full_name?: string; email?: string | null }>
): string | null {
  if (!raw) return null;
  const clean = raw.trim();
  if (!clean) return null;

  // 1. Se for um UUID, busca no cadastro de funcionários ou usuários oficiais
  if (isUUID(clean)) {
    const cleanLower = clean.toLowerCase();
    const fromEmp = (employees || []).find(
      (e) => (e.id && e.id.toLowerCase() === cleanLower) || (e.profile_id && e.profile_id.toLowerCase() === cleanLower)
    );
    if (fromEmp?.full_name && isValidSellerName(fromEmp.full_name)) {
      return fromEmp.full_name.trim();
    }
    const fromOff = DEFAULT_OFFICIAL_USERS.find(
      (u) => u.id.toLowerCase() === cleanLower || u.aliases?.some((a) => a.toLowerCase() === cleanLower)
    );
    if (fromOff?.full_name && isValidSellerName(fromOff.full_name)) {
      return fromOff.full_name.trim();
    }
    return null; // NUNCA retorna o UUID cru
  }

  // 2. Se for código numérico ou de sistema, descarta
  if (isNumericOrCode(clean)) {
    return null;
  }

  // 3. Se for email, tenta resolver pelo usuário oficial
  if (clean.includes('@')) {
    const emailLower = clean.toLowerCase();
    const fromOff = DEFAULT_OFFICIAL_USERS.find(
      (u) => u.email.toLowerCase() === emailLower || u.aliases?.some((a) => a.toLowerCase() === emailLower)
    );
    if (fromOff?.full_name) return fromOff.full_name.trim();
    const fromEmp = (employees || []).find((e) => e.email?.toLowerCase() === emailLower);
    if (fromEmp?.full_name) return fromEmp.full_name.trim();
    return null;
  }

  // 4. Se for nome textual, tenta casar com o nome canônico completo
  if (!isValidSellerName(clean)) return null;
  const norm = normalizeName(clean);

  // Busca em employees
  const matchedEmp = (employees || []).find((e) => {
    if (!e.full_name) return false;
    const empNorm = normalizeName(e.full_name);
    return empNorm === norm || empNorm.startsWith(norm) || norm.startsWith(empNorm);
  });
  if (matchedEmp?.full_name) {
    return matchedEmp.full_name.trim();
  }

  // Busca em DEFAULT_OFFICIAL_USERS
  const matchedOff = DEFAULT_OFFICIAL_USERS.find((u) => {
    if (!u.full_name) return false;
    const offNorm = normalizeName(u.full_name);
    if (offNorm === norm || offNorm.startsWith(norm) || norm.startsWith(offNorm)) return true;
    if (u.aliases?.some((a) => normalizeName(a) === norm)) return true;
    return false;
  });
  if (matchedOff?.full_name) {
    return matchedOff.full_name.trim();
  }

  return clean;
}

export interface CleanSellerOption {
  id: string;
  name: string;
  storeId: string;
  storeLabel: string;
}

/**
 * Constrói a lista limpa e auditada de vendedores para dropdowns e filtros em todo o sistema.
 * Prioriza estritamente os colaboradores do banco de dados (employees e DEFAULT_OFFICIAL_USERS).
 * NUNCA insere UUIDs, códigos numéricos ou placeholders genéricos.
 */
export function getCleanSellerOptions(params: {
  employees?: Array<{ id?: string; profile_id?: string | null; full_name?: string; store_id?: string | null; is_active?: boolean; role?: string }>;
  allSales?: Array<any>;
  storeFilter?: string;
  isRestrictedSeller?: boolean;
  currentUserFullName?: string | null;
}): CleanSellerOption[] {
  const {
    employees = [],
    allSales = [],
    storeFilter = 'all',
    isRestrictedSeller = false,
    currentUserFullName = null,
  } = params;

  if (isRestrictedSeller) {
    const myName = currentUserFullName || 'Minhas Vendas';
    return [{ id: myName, name: myName, storeId: 'all', storeLabel: 'Minhas Vendas' }];
  }

  const map = new Map<string, CleanSellerOption>();

  const addOption = (fullName: string, storeIdOrSlug?: string | null) => {
    const cleanName = fullName.trim();
    if (!isValidSellerName(cleanName)) return;

    // Resolve a loja canônica do vendedor
    let resolvedStoreId = STORE_DIVINOPOLIS_UUID;
    const sId = (storeIdOrSlug || '').toLowerCase().trim();

    if (
      sId === 'store-multimarcas' ||
      sId === STORE_MONTESCLAROS_MULTIMARCAS_UUID ||
      sId.includes('multimarcas') ||
      sId.includes('seminovos')
    ) {
      resolvedStoreId = STORE_MONTESCLAROS_MULTIMARCAS_UUID;
    } else if (
      sId === 'store-montesclaros' ||
      sId === STORE_MONTESCLAROS_UUID ||
      sId.includes('montes') ||
      sId.includes('moc')
    ) {
      resolvedStoreId = STORE_MONTESCLAROS_UUID;
    } else {
      // Verifica no mapa de vendedores
      const norm = normalizeName(cleanName);
      for (const [key, mappedStore] of Object.entries(SELLER_TO_STORE_MAP)) {
        if (norm.includes(key)) {
          resolvedStoreId = mappedStore === 'store-montesclaros' ? STORE_MONTESCLAROS_UUID : STORE_DIVINOPOLIS_UUID;
          break;
        }
      }
    }

    if (storeFilter !== 'all' && !isMatchingStore(resolvedStoreId, storeFilter)) {
      return;
    }

    const storeLabel =
      resolvedStoreId === STORE_MONTESCLAROS_MULTIMARCAS_UUID
        ? 'Multimarcas'
        : resolvedStoreId === STORE_MONTESCLAROS_UUID
        ? 'Montes Claros'
        : 'Divinópolis';
    const key = cleanName.toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        id: cleanName,
        name: cleanName,
        storeId: resolvedStoreId,
        storeLabel,
      });
    }
  };

  // 1. Colaboradores cadastrados no banco de dados (employees)
  employees.forEach((emp) => {
    if (emp.is_active !== false && emp.full_name) {
      addOption(emp.full_name, emp.store_id);
    }
  });

  // 2. Colaboradores oficiais do sistema (DEFAULT_OFFICIAL_USERS)
  DEFAULT_OFFICIAL_USERS.forEach((u) => {
    if (u.is_active !== false && u.full_name) {
      addOption(u.full_name, u.store_id);
    }
  });

  // 3. Vendedores das vendas consolidadas — somente se passarem na validação estrita
  allSales.forEach((s: any) => {
    const raw = s.operator?.full_name || s.vendedor || s.seller_name || s.external_data?.seller_name;
    const resolved = resolveSellerDisplayName(raw, employees);
    if (resolved && isValidSellerName(resolved)) {
      addOption(resolved, s.store_id || s.raw_store_id);
    }
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Verifica se uma venda pertence ao vendedor filtrado, com casamento robusto
 * por nome, ID de operador, created_by e aliases oficiais.
 */
export function matchesSellerFilter(
  sale: any,
  selectedSeller: string,
  employees?: Array<{ id?: string; profile_id?: string | null; full_name?: string }>
): boolean {
  if (!selectedSeller || selectedSeller === 'all') return true;

  const target = normalizeName(selectedSeller);
  if (!target) return true;

  // 1. Compara nomes textuais na venda
  const ext = (sale.external_data || {}) as any;
  const operatorName = normalizeName(sale.operator?.full_name);
  const vendedor = normalizeName(sale.vendedor);
  const sellerName = normalizeName(sale.seller_name || ext.seller_name || ext.operator_name || ext.vendedor);

  if (operatorName && (operatorName === target || operatorName.includes(target) || target.includes(operatorName))) return true;
  if (vendedor && (vendedor === target || vendedor.includes(target) || target.includes(vendedor))) return true;
  if (sellerName && (sellerName === target || sellerName.includes(target) || target.includes(sellerName))) return true;

  // 2. Compara via ID de colaborador / created_by
  const createdBy = (sale.created_by || sale.operator?.id || '').toLowerCase().trim();
  if (createdBy) {
    const emp = (employees || []).find(
      (e) => (e.id && e.id.toLowerCase() === createdBy) || (e.profile_id && e.profile_id.toLowerCase() === createdBy)
    );
    if (emp?.full_name && normalizeName(emp.full_name).includes(target)) return true;

    const off = DEFAULT_OFFICIAL_USERS.find(
      (u) => u.id.toLowerCase() === createdBy || u.aliases?.some((a) => a.toLowerCase() === createdBy)
    );
    if (off?.full_name && normalizeName(off.full_name).includes(target)) return true;
  }

  return false;
}
