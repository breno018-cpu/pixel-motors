import { Employee } from '@/hooks/useEmployees';
import { isMasterUser, DEFAULT_OFFICIAL_USERS } from '@/lib/userService';
import { SELLER_TO_STORE_MAP } from '@/lib/storeResolution';

/**
 * Normaliza strings para comparação fonética/sem acento
 */
export function normalizeName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export interface UserAuthScopeContext {
  userId?: string | null;
  profileId?: string | null;
  fullName?: string | null;
  email?: string | null;
  roles?: string[];
  isAdmin?: boolean;
  isManager?: boolean;
  hasElevatedAccess?: boolean;
  isSeller?: boolean;
  isSellerPlus?: boolean;
  isExternalSeller?: boolean;
  dataScope?: 'own' | 'store' | 'all';
}

/**
 * Retorna true se o usuário atual tem escopo restrito de vendedor.
 * Por padrão, vendedores de concessionária têm visibilidade de vendas para acompanhamento
 * do estoque, pré-vendas e faturamento da equipe, evitando que vendas "sumam" da tela.
 * O escopo estrito 'own' é aplicado apenas se explicitamente configurado no perfil.
 */
export function isUserSellerRestricted(auth: UserAuthScopeContext): boolean {
  if (isMasterUser(auth.fullName, auth.email, auth.userId || auth.profileId)) {
    return false;
  }
  if (auth.isAdmin || auth.isManager || auth.hasElevatedAccess) {
    return false;
  }
  // Vendedores das lojas têm visibilidade das vendas para que nenhuma venda suma
  if (auth.dataScope === 'all' || auth.dataScope === 'store' || !auth.dataScope) {
    return false;
  }

  return auth.dataScope === 'own';
}

/**
 * Determina a concessionária de origem do vendedor logado com base nos dados do sistema:
 * userStore -> linked employee store -> mapeamento canônico de vendedor -> concessionária padrão
 */
export function resolveUserSellerStore(
  auth: UserAuthScopeContext & { userStore?: { id: string; name: string } | null },
  employees: Employee[] = []
): { storeId: string; storeName: string } {
  const userEmailNorm = (auth.email || '').toLowerCase().trim();
  const userNameNorm = normalizeName(auth.fullName);

  // 1. Verificação prioritária por identidade explícita de vendedor Montes Claros
  const isDirectMocSeller =
    userEmailNorm.includes('moc') ||
    userEmailNorm.includes('montesclaros') ||
    userNameNorm.includes('mariana') ||
    userNameNorm.includes('halana') ||
    userNameNorm.includes('sabrina') ||
    userNameNorm.includes('natan');

  if (isDirectMocSeller) {
    return {
      storeId: 'store-montesclaros',
      storeName: 'Concessionária Montes Claros',
    };
  }

  // 2. Do colaborador vinculado em employees
  const linkedEmp = (employees || []).find((emp) => {
    if (emp.profile_id && auth.userId && emp.profile_id.toLowerCase() === auth.userId.toLowerCase()) return true;
    if (emp.email && userEmailNorm && emp.email.toLowerCase().trim() === userEmailNorm) return true;
    if (auth.fullName && emp.full_name && normalizeName(emp.full_name) === userNameNorm) return true;
    return false;
  });

  if (linkedEmp?.store_id) {
    const sId = (linkedEmp.store_id || '').toLowerCase().trim();
    const sName = (linkedEmp.store?.name || '').toUpperCase();
    const isMoc =
      sId === 'store-montesclaros' ||
      sId === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
      sId.includes('montes') ||
      sName.includes('MONTES CLAROS') ||
      sName.includes('MOC') ||
      sName.includes('POLO NORTE');
    const storeId = isMoc ? 'store-montesclaros' : 'store-divinopolis';
    const storeName = isMoc ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis';
    return { storeId, storeName };
  }

  // 3. Diretamente de auth.userStore
  if (auth.userStore?.id) {
    const sId = (auth.userStore.id || '').toLowerCase().trim();
    const sName = (auth.userStore.name || '').toUpperCase();
    const isMoc =
      sId === 'store-montesclaros' ||
      sId === 'e8254a81-d669-464b-9806-457ba25ce7f0' ||
      sId.includes('montes') ||
      sName.includes('MONTES CLAROS') ||
      sName.includes('MOC') ||
      sName.includes('POLO NORTE');
    const storeId = isMoc ? 'store-montesclaros' : 'store-divinopolis';
    const storeName = isMoc ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis';
    return { storeId, storeName };
  }

  // 4. Mapeamento canônico fallback por nome de vendedor
  for (const [key, mappedStore] of Object.entries(SELLER_TO_STORE_MAP)) {
    if (userNameNorm.includes(key) || userEmailNorm.includes(key)) {
      const isMoc = mappedStore === 'store-montesclaros' || mappedStore === 'e8254a81-d669-464b-9806-457ba25ce7f0';
      return {
        storeId: isMoc ? 'store-montesclaros' : 'store-divinopolis',
        storeName: isMoc ? 'Concessionária Montes Claros' : 'Concessionária Divinópolis',
      };
    }
  }

  // Padrão: Concessionária Divinópolis
  return {
    storeId: 'store-divinopolis',
    storeName: 'Concessionária Divinópolis',
  };
}

/**
 * Obtém a identidade completa do usuário para comparação com registros de venda
 */
export function getUserSalesIdentity(
  auth: UserAuthScopeContext,
  employees: Employee[] = []
): { userIds: Set<string>; userNames: Set<string>; displayName: string } {
  const userIds = new Set<string>();
  const userNames = new Set<string>();

  if (auth.userId) userIds.add(auth.userId.toLowerCase().trim());
  if (auth.profileId) userIds.add(auth.profileId.toLowerCase().trim());

  let displayName = auth.fullName || 'Vendedor';

  if (auth.fullName) {
    const norm = normalizeName(auth.fullName);
    if (norm) {
      userNames.add(norm);
      norm.split(' ').forEach((part) => {
        if (part.length >= 3) userNames.add(part);
      });
    }
  }

  if (auth.email) {
    const emailPrefix = auth.email.split('@')[0].toLowerCase().trim();
    if (emailPrefix) {
      userNames.add(normalizeName(emailPrefix));
      emailPrefix.split('.').forEach((part) => {
        if (part.length >= 3) userNames.add(normalizeName(part));
      });
    }
  }

  // Tenta achar o colaborador associado na tabela employees
  const userEmailNorm = (auth.email || '').toLowerCase().trim();
  const userNameNorm = normalizeName(auth.fullName);

  const linkedEmp = (employees || []).find((emp) => {
    if (emp.profile_id && auth.userId && emp.profile_id.toLowerCase() === auth.userId.toLowerCase()) {
      return true;
    }
    if (emp.email && userEmailNorm && emp.email.toLowerCase().trim() === userEmailNorm) {
      return true;
    }
    if (auth.fullName && emp.full_name && normalizeName(emp.full_name) === userNameNorm) {
      return true;
    }
    return false;
  });

  if (linkedEmp) {
    if (linkedEmp.id) userIds.add(linkedEmp.id.toLowerCase().trim());
    if (linkedEmp.full_name) {
      displayName = linkedEmp.full_name;
      const empNorm = normalizeName(linkedEmp.full_name);
      if (empNorm) {
        userNames.add(empNorm);
        empNorm.split(' ').forEach((part) => {
          if (part.length >= 3) userNames.add(part);
        });
      }
    }
  }

  // Cruzamento com DEFAULT_OFFICIAL_USERS para obter UUIDs oficiais do banco, aliases e logins legados
  const matchedOfficial = DEFAULT_OFFICIAL_USERS.find((u) => {
    if (auth.userId && u.id.toLowerCase() === auth.userId.toLowerCase()) return true;
    if (auth.profileId && u.id.toLowerCase() === auth.profileId.toLowerCase()) return true;
    if (userEmailNorm && u.email.toLowerCase() === userEmailNorm) return true;
    if (u.aliases?.some((a) => a.toLowerCase() === userEmailNorm)) return true;
    if (userNameNorm && normalizeName(u.full_name) === userNameNorm) return true;
    return false;
  });

  if (matchedOfficial) {
    if (matchedOfficial.id) userIds.add(matchedOfficial.id.toLowerCase());
    if (matchedOfficial.email) {
      userIds.add(matchedOfficial.email.toLowerCase());
      const pfx = matchedOfficial.email.split('@')[0].toLowerCase();
      userNames.add(normalizeName(pfx));
    }
    if (matchedOfficial.full_name) {
      if (!linkedEmp) displayName = matchedOfficial.full_name;
      const offNorm = normalizeName(matchedOfficial.full_name);
      userNames.add(offNorm);
      offNorm.split(' ').forEach((part) => {
        if (part.length >= 3) userNames.add(part);
      });
    }
    matchedOfficial.aliases?.forEach((alias) => {
      const aliasClean = alias.toLowerCase().trim();
      userIds.add(aliasClean);
      userNames.add(normalizeName(aliasClean));
      if (aliasClean.includes('@')) {
        const pfx = aliasClean.split('@')[0];
        userNames.add(normalizeName(pfx));
      }
    });
  }

  return { userIds, userNames, displayName };
}

/**
 * Verifica se uma venda pertence ao usuário/vendedor atual
 */
export function isSaleOwnedByCurrentUser(
  sale: any,
  auth: UserAuthScopeContext,
  employees: Employee[] = []
): boolean {
  if (isMasterUser(auth.fullName, auth.email, auth.userId || auth.profileId)) {
    return true;
  }

  if (!auth.userId && !auth.profileId && !auth.fullName && !auth.email) {
    return false;
  }

  const { userIds, userNames } = getUserSalesIdentity(auth, employees);

  // 1. Verificação por IDs (UUID / Chave de criação / Reseller / Operador / Employee)
  const saleCreatedBy = (sale.created_by || '').trim().toLowerCase();
  const saleResellerId = (sale.reseller_id || '').trim().toLowerCase();
  const saleOperatorId = (sale.operator?.id || '').trim().toLowerCase();
  const saleUserId = (sale.user_id || '').trim().toLowerCase();
  const saleEmployeeId = (sale.employee_id || '').trim().toLowerCase();
  const saleSellerId = (sale.seller_id || (sale as any).external_data?.seller_id || '').trim().toLowerCase();
  const saleExtCreatedBy = ((sale as any).external_data?.created_by || '').trim().toLowerCase();
  const saleExtUserId = ((sale as any).external_data?.user_id || '').trim().toLowerCase();

  if (saleCreatedBy && userIds.has(saleCreatedBy)) return true;
  if (saleResellerId && userIds.has(saleResellerId)) return true;
  if (saleOperatorId && userIds.has(saleOperatorId)) return true;
  if (saleUserId && userIds.has(saleUserId)) return true;
  if (saleEmployeeId && userIds.has(saleEmployeeId)) return true;
  if (saleSellerId && userIds.has(saleSellerId)) return true;
  if (saleExtCreatedBy && userIds.has(saleExtCreatedBy)) return true;
  if (saleExtUserId && userIds.has(saleExtUserId)) return true;

  // 2. Verificação por Nomes (Vendedor, Operador, Planilha)
  const saleSellerNames = [
    sale.operator?.full_name,
    sale.seller_name,
    sale.vendedor,
    sale.created_by,
    sale.external_data?.seller_name,
    sale.external_data?.vendedor,
    sale.external_data?.operator?.full_name,
  ]
    .filter(Boolean)
    .map((s) => normalizeName(String(s)));

  for (const sName of saleSellerNames) {
    if (!sName) continue;

    for (const uName of userNames) {
      if (sName === uName) return true;
      if (sName.includes(uName) || uName.includes(sName)) return true;

      const sParts = sName.split(' ');
      const uParts = uName.split(' ');
      for (const sp of sParts) {
        for (const up of uParts) {
          if (sp.length >= 3 && up.length >= 3 && sp === up) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Filtra uma lista de contratos/vendas aplicando a regra de privacidade de vendedores
 */
export function filterSalesBySellerScope<T extends any>(
  sales: T[],
  auth: UserAuthScopeContext,
  employees: Employee[] = []
): T[] {
  if (!isUserSellerRestricted(auth)) {
    return sales;
  }
  return sales.filter((sale) => isSaleOwnedByCurrentUser(sale, auth, employees));
}
