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
 * (portanto, NÃO deve ver vendas de outros vendedores).
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

  // Se possuir papel de vendedor sem papel administrativo
  const roles = auth.roles || [];
  const hasSellerRole =
    auth.isSeller ||
    auth.isSellerPlus ||
    auth.isExternalSeller ||
    roles.includes('vendedor') ||
    roles.includes('vendedor_plus') ||
    roles.includes('vendedor_externo') ||
    roles.includes('revendedor');

  return Boolean(hasSellerRole);
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

  if (auth.userId) userIds.add(auth.userId.toLowerCase());
  if (auth.profileId) userIds.add(auth.profileId.toLowerCase());

  let displayName = auth.fullName || 'Vendedor';

  if (auth.fullName) {
    const norm = normalizeName(auth.fullName);
    if (norm) {
      userNames.add(norm);
      const first = norm.split(' ')[0];
      if (first.length >= 3) userNames.add(first);
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
    if (linkedEmp.id) userIds.add(linkedEmp.id.toLowerCase());
    if (linkedEmp.full_name) {
      displayName = linkedEmp.full_name;
      const empNorm = normalizeName(linkedEmp.full_name);
      if (empNorm) {
        userNames.add(empNorm);
        const empFirst = empNorm.split(' ')[0];
        if (empFirst.length >= 3) userNames.add(empFirst);
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
  if (!auth.userId && !auth.profileId && !auth.fullName) {
    return false;
  }

  const { userIds, userNames } = getUserSalesIdentity(auth, employees);

  // 1. Verificação por IDs (UUID / Chave de criação / Reseller / Operador)
  const saleCreatedBy = (sale.created_by || '').trim();
  const saleResellerId = (sale.reseller_id || '').trim();
  const saleOperatorId = (sale.operator?.id || '').trim();
  const saleUserId = (sale.user_id || '').trim();

  if (saleCreatedBy && userIds.has(saleCreatedBy.toLowerCase())) return true;
  if (saleResellerId && userIds.has(saleResellerId.toLowerCase())) return true;
  if (saleOperatorId && userIds.has(saleOperatorId.toLowerCase())) return true;
  if (saleUserId && userIds.has(saleUserId.toLowerCase())) return true;

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

      const sFirst = sName.split(' ')[0];
      const uFirst = uName.split(' ')[0];
      if (sFirst.length >= 3 && uFirst.length >= 3 && sFirst === uFirst) {
        return true;
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
