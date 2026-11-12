import { Employee } from '@/hooks/useEmployees';

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
 * Retorna true se o usuário atual tem escopo restrito de vendedor
 * (vendedores, vendedor+, vendedor++ e variantes devem acessar estritamente apenas suas próprias vendas).
 */
export function isUserSellerRestricted(auth: UserAuthScopeContext): boolean {
  // Administradores, gerentes ou usuários com acesso de gestão completo têm visão ampla
  if (auth.isAdmin || auth.isManager || auth.hasElevatedAccess) {
    return false;
  }

  // Se o escopo de dados for 'own', é estritamente restrito às próprias vendas
  if (auth.dataScope === 'own') {
    return true;
  }

  // Se possuir qualquer papel de vendedor (vendedor, vendedor+, vendedor++, etc.)
  const roles = (auth.roles || []).map((r) => r.toLowerCase().trim());
  const hasSellerRole =
    auth.isSeller ||
    auth.isSellerPlus ||
    auth.isExternalSeller ||
    roles.some(
      (r) =>
        r.includes('vendedor') ||
        r.includes('seller') ||
        r.includes('revendedor') ||
        r === 'vendedor+' ||
        r === 'vendedor++' ||
        r.includes('plus')
    );

  return Boolean(hasSellerRole);
}

/**
 * Determina a concessionária de origem do vendedor logado com base nos dados do sistema:
 * userStore -> linked employee store -> concessionária padrão
 */
export function resolveUserSellerStore(
  auth: UserAuthScopeContext & { userStore?: { id: string; name: string } | null },
  employees: Employee[] = []
): { storeId: string; storeName: string } {
  // 1. Diretamente de auth.userStore
  if (auth.userStore?.id) {
    const sId = auth.userStore.id;
    const isMoc = sId === 'store-montesclaros' || (auth.userStore.name || '').toUpperCase().includes('MONTES CLAROS');
    const storeId = isMoc ? 'store-montesclaros' : 'store-divinopolis';
    const storeName = isMoc ? 'Concessionária Montes Claros (Polo Norte)' : 'Concessionária Divinópolis (Matriz Oeste)';
    return { storeId, storeName };
  }

  // 2. Do colaborador vinculado em employees
  const userEmailNorm = (auth.email || '').toLowerCase().trim();
  const linkedEmp = (employees || []).find((emp) => {
    if (emp.profile_id && auth.userId && emp.profile_id.toLowerCase() === auth.userId.toLowerCase()) return true;
    if (emp.email && userEmailNorm && emp.email.toLowerCase().trim() === userEmailNorm) return true;
    if (auth.fullName && emp.full_name && normalizeName(emp.full_name) === normalizeName(auth.fullName)) return true;
    return false;
  });

  if (linkedEmp?.store_id) {
    const sId = linkedEmp.store_id;
    const isMoc = sId === 'store-montesclaros' || (linkedEmp.store?.name || '').toUpperCase().includes('MONTES CLAROS');
    const storeId = isMoc ? 'store-montesclaros' : 'store-divinopolis';
    const storeName = isMoc ? 'Concessionária Montes Claros (Polo Norte)' : 'Concessionária Divinópolis (Matriz Oeste)';
    return { storeId, storeName };
  }

  // Padrão: Concessionária Divinópolis (Matriz Oeste)
  return {
    storeId: 'store-divinopolis',
    storeName: 'Concessionária Divinópolis (Matriz Oeste)',
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
  const linkedEmp = (employees || []).find((emp) => {
    if (emp.profile_id && auth.userId && emp.profile_id.toLowerCase() === auth.userId.toLowerCase()) {
      return true;
    }
    if (emp.email && userEmailNorm && emp.email.toLowerCase().trim() === userEmailNorm) {
      return true;
    }
    if (auth.fullName && emp.full_name && normalizeName(emp.full_name) === normalizeName(auth.fullName)) {
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
  if (auth.isAdmin || auth.isManager || auth.hasElevatedAccess) {
    return true;
  }

  if (!auth.userId && !auth.profileId && !auth.fullName && !auth.email) {
    return false;
  }

  const { userIds, userNames } = getUserSalesIdentity(auth, employees);

  // 1. Verificação por IDs (UUID / Chave de criação / Reseller / Operador)
  const saleCreatedBy = (sale.created_by || '').trim().toLowerCase();
  const saleResellerId = (sale.reseller_id || '').trim().toLowerCase();
  const saleOperatorId = (sale.operator?.id || '').trim().toLowerCase();
  const saleUserId = (sale.user_id || '').trim().toLowerCase();

  if (saleCreatedBy && userIds.has(saleCreatedBy)) return true;
  if (saleResellerId && userIds.has(saleResellerId)) return true;
  if (saleOperatorId && userIds.has(saleOperatorId)) return true;
  if (saleUserId && userIds.has(saleUserId)) return true;

  // 2. Verificação por Nomes (Vendedor, Operador, Planilha)
  const saleSellerNames = [
    sale.operator?.full_name,
    sale.seller_name,
    sale.vendedor,
    sale.created_by, // na planilha ou contratos rápidos, created_by pode ser o nome "Lilian", "Geibriel"
    sale.external_data?.seller_name,
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
