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
 * Administradores, Gerentes e Usuários Master possuem acesso universal (não restrito).
 * Vendedores têm acesso estritamente às suas próprias vendas ('own').
 */
export function isUserSellerRestricted(auth: UserAuthScopeContext): boolean {
  if (isMasterUser(auth.fullName, auth.email, auth.userId || auth.profileId)) {
    return false;
  }
  if (auth.isAdmin || auth.isManager || auth.hasElevatedAccess) {
    return false;
  }
  const roles = auth.roles || [];
  if (roles.includes('admin') || roles.includes('gerente')) {
    return false;
  }
  return true;
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

export const GENERIC_SELLER_WORDS = new Set([
  'vendedor',
  'vendedora',
  'shineray',
  'shineraymoc',
  'shineraymocn',
  'shineraymocs',
  'shineraymoch',
  'shineraydiv',
  'shineraydivl',
  'shineraydivg',
  'shineraydivd',
  'shineraydive',
  'motos',
  'moto',
  'concessionaria',
  'divinopolis',
  'montes',
  'claros',
  'admin',
  'administrador',
  'user',
  'usuario',
  'gerente',
  'loja',
]);

/**
 * Validação rigorosa de correspondência entre nomes de vendedor.
 * Impede falsos positivos entre vendedores com prefixos similares (ex: Mariana vs Natan).
 */
export function isSellerNameMatch(sellerOnSale: string, targetSeller: string): boolean {
  const sNorm = normalizeName(sellerOnSale);
  const tNorm = normalizeName(targetSeller);
  if (!sNorm || !tNorm) return false;
  if (GENERIC_SELLER_WORDS.has(sNorm) || GENERIC_SELLER_WORDS.has(tNorm)) return false;

  // Igualdade exata
  if (sNorm === tNorm) return true;

  // Unificação de grafias conhecidas (ex: Halana vs Halanna)
  const normS = sNorm.replace(/nn/g, 'n');
  const normT = tNorm.replace(/nn/g, 'n');
  if (normS === normT) return true;

  const sWords = sNorm.split(' ').filter((w) => w.length >= 3 && !GENERIC_SELLER_WORDS.has(w));
  const tWords = tNorm.split(' ').filter((w) => w.length >= 3 && !GENERIC_SELLER_WORDS.has(w));

  if (sWords.length === 0 || tWords.length === 0) return false;

  // Primeiro nome coincide exatamente (ex: "Mariana" === "Mariana", "Halana" === "Halanna")
  if (sWords[0] === tWords[0] || sWords[0].replace(/nn/g, 'n') === tWords[0].replace(/nn/g, 'n')) return true;

  // Se um for nome composto e contiver o outro termo inteiro (ex: "Mariana Sabino" contém "Sabino" ou "Mariana")
  if (sWords.length > 1 && tWords.length === 1 && sWords.includes(tWords[0])) return true;
  if (tWords.length > 1 && sWords.length === 1 && tWords.includes(sWords[0])) return true;

  return false;
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
  if (auth.email) {
    const cleanMail = auth.email.toLowerCase().trim();
    userIds.add(cleanMail);
    const emailPrefix = cleanMail.split('@')[0];
    if (emailPrefix) userIds.add(emailPrefix);
  }

  let displayName = auth.fullName || 'Vendedor';

  const addNameTokens = (fullName?: string | null) => {
    if (!fullName) return;
    const norm = normalizeName(fullName);
    if (!norm || GENERIC_SELLER_WORDS.has(norm)) return;
    userNames.add(norm);
    norm.split(' ').forEach((part) => {
      if (part.length >= 3 && !GENERIC_SELLER_WORDS.has(part)) {
        userNames.add(part);
      }
    });
  };

  addNameTokens(auth.fullName);

  // Mapeamento específico para Halana / Halanna para evitar desencontro de nomes
  if (
    userEmailNorm.includes('halan') ||
    userEmailNorm.includes('shineraymoch') ||
    userNameNorm.includes('halan')
  ) {
    userNames.add('halana');
    userNames.add('halanna');
    userNames.add('halanna dos santos silva');
    userNames.add('halana dos santos silva');
    userIds.add('02e3206a-a9b4-47b7-8d25-0c9092dc19dd');
    userIds.add('emp-halana');
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
    if (linkedEmp.email) userIds.add(linkedEmp.email.toLowerCase().trim());
    if (linkedEmp.full_name) {
      displayName = linkedEmp.full_name;
      addNameTokens(linkedEmp.full_name);
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
    if (matchedOfficial.email) userIds.add(matchedOfficial.email.toLowerCase());
    if (matchedOfficial.full_name) {
      if (!linkedEmp) displayName = matchedOfficial.full_name;
      addNameTokens(matchedOfficial.full_name);
    }
    matchedOfficial.aliases?.forEach((alias) => {
      const aliasClean = alias.toLowerCase().trim();
      userIds.add(aliasClean);
      if (!aliasClean.includes('@') && !GENERIC_SELLER_WORDS.has(aliasClean)) {
        addNameTokens(aliasClean);
      }
    });
  }

  return { userIds, userNames, displayName };
}

export interface SalesAccessDecision {
  allowed: boolean;
  factor: 'F1_ELEVATED' | 'F2_DISQUALIFIED_OTHER_SELLER' | 'F3A_ID_MATCH' | 'F3B_NAME_MATCH' | 'F4_ZERO_TRUST_BLOCK' | 'F0_UNAUTHENTICATED';
  reason: string;
}

/**
 * MOTOR DE VALIDAÇÃO DE FATORES DE ACESSO A VENDAS (DEFESA EM PROFUNDIDADE)
 *
 * Garante com certeza absoluta que um vendedor NUNCA visualizará vendas de outro vendedor:
 *
 * Fator 1: Verificação de Autoridade e Papel Elevado (Master, Admin, Gerente).
 * Fator 2: Desqualificação Negativa Incondicional se a venda contiver ID, e-mail ou nome de OUTRO vendedor conhecido.
 * Fator 3: Prova Positiva Rigorosa de Titularidade (UUID/ID comprovado ou Nome Canônico comprovado).
 * Fator 4: Bloqueio Seguro de Registros Órfãos / Genéricos (Zero-Trust Fallback).
 */
export function validateSellerSalesAccess(
  sale: any,
  auth: UserAuthScopeContext,
  employees: Employee[] = []
): SalesAccessDecision {
  if (!sale) {
    return { allowed: false, factor: 'F4_ZERO_TRUST_BLOCK', reason: 'Venda inexistente ou nula' };
  }

  // FATOR 1: Autoridade de Gestão (Breno, João Vitor, Admins e Gerentes têm acesso total de supervisão)
  if (isMasterUser(auth.fullName, auth.email, auth.userId || auth.profileId)) {
    return { allowed: true, factor: 'F1_ELEVATED', reason: 'Acesso master da diretoria aprovado' };
  }
  if (auth.isAdmin || auth.isManager || auth.hasElevatedAccess) {
    return { allowed: true, factor: 'F1_ELEVATED', reason: 'Privilégio administrativo / gerencial aprovado' };
  }
  const roles = auth.roles || [];
  if (roles.includes('admin') || roles.includes('gerente')) {
    return { allowed: true, factor: 'F1_ELEVATED', reason: 'Cargo corporativo elevado aprovado' };
  }

  // Se o usuário não possui credenciais mínimas para autenticação de titularidade
  if (!auth.userId && !auth.profileId && !auth.fullName && !auth.email) {
    return { allowed: false, factor: 'F0_UNAUTHENTICATED', reason: 'Sessão sem identificadores de titularidade' };
  }

  const { userIds: myIds, userNames: myNames } = getUserSalesIdentity(auth, employees);

  // Extrai todos os campos de identificação presentes na venda
  const saleCreatedBy = (sale.created_by || '').trim().toLowerCase();
  const saleResellerId = (sale.reseller_id || '').trim().toLowerCase();
  const saleOperatorId = (sale.operator?.id || '').trim().toLowerCase();
  const saleUserId = (sale.user_id || '').trim().toLowerCase();
  const saleEmployeeId = (sale.employee_id || '').trim().toLowerCase();
  const saleSellerId = (sale.seller_id || (sale as any).external_data?.seller_id || '').trim().toLowerCase();
  const saleExtCreatedBy = ((sale as any).external_data?.created_by || '').trim().toLowerCase();
  const saleExtUserId = ((sale as any).external_data?.user_id || '').trim().toLowerCase();

  const saleIds = [
    saleCreatedBy,
    saleResellerId,
    saleOperatorId,
    saleUserId,
    saleEmployeeId,
    saleSellerId,
    saleExtCreatedBy,
    saleExtUserId,
  ].filter(Boolean);

  const saleSellerNames = [
    sale.operator?.full_name,
    sale.seller_name,
    sale.vendedor,
    (sale as any).external_data?.seller_name,
    (sale as any).external_data?.vendedor,
    (sale as any).external_data?.operator?.full_name,
  ]
    .filter(Boolean)
    .map((s) => String(s).trim());

  // FATOR 2: Desqualificação Negativa Incondicional
  // Constrói a lista de TODOS os outros colaboradores do sistema (DEFAULT_OFFICIAL_USERS + employees)
  const otherUsers = DEFAULT_OFFICIAL_USERS.filter((u) => {
    const uEmail = (u.email || '').toLowerCase().trim();
    const uId = u.id.toLowerCase().trim();
    return !myIds.has(uEmail) && !myIds.has(uId);
  });

  const otherKnownIds = new Set<string>();
  const otherKnownNames = new Set<string>();

  otherUsers.forEach((u) => {
    if (u.id) otherKnownIds.add(u.id.toLowerCase().trim());
    if (u.email) otherKnownIds.add(u.email.toLowerCase().trim());
    if (u.full_name) otherKnownNames.add(u.full_name.trim());
    u.aliases?.forEach((a) => {
      const aClean = a.toLowerCase().trim();
      otherKnownIds.add(aClean);
      if (!aClean.includes('@') && !GENERIC_SELLER_WORDS.has(aClean)) {
        otherKnownNames.add(a.trim());
      }
    });
  });

  (employees || []).forEach((emp) => {
    const eEmail = (emp.email || '').toLowerCase().trim();
    const eId = (emp.id || '').toLowerCase().trim();
    const eProfId = (emp.profile_id || '').toLowerCase().trim();
    if (!myIds.has(eEmail) && !myIds.has(eId) && (!eProfId || !myIds.has(eProfId))) {
      if (emp.id) otherKnownIds.add(emp.id.toLowerCase().trim());
      if (emp.email) otherKnownIds.add(emp.email.toLowerCase().trim());
      if (emp.profile_id) otherKnownIds.add(emp.profile_id.toLowerCase().trim());
      if (emp.full_name) otherKnownNames.add(emp.full_name.trim());
    }
  });

  // 2A: Se algum ID da venda pertencer a outro vendedor -> BLOQUEADO IMEDIATAMENTE
  for (const sId of saleIds) {
    if (otherKnownIds.has(sId) && !myIds.has(sId)) {
      return {
        allowed: false,
        factor: 'F2_DISQUALIFIED_OTHER_SELLER',
        reason: `Venda associada ao identificador de outro colaborador (${sId})`,
      };
    }
  }

  // 2B: Se algum nome da venda pertencer a outro vendedor -> BLOQUEADO IMEDIATAMENTE
  for (const sName of saleSellerNames) {
    for (const oName of otherKnownNames) {
      if (isSellerNameMatch(sName, oName) && !isSellerNameMatch(sName, auth.fullName || '')) {
        return {
          allowed: false,
          factor: 'F2_DISQUALIFIED_OTHER_SELLER',
          reason: `Venda associada ao nome de outro vendedor (${sName} -> ${oName})`,
        };
      }
    }
  }

  // FATOR 3: Prova Positiva Rigorosa de Titularidade
  // 3A: Prova por ID / UUID exato do vendedor atual
  for (const sId of saleIds) {
    if (myIds.has(sId)) {
      return {
        allowed: true,
        factor: 'F3A_ID_MATCH',
        reason: `Titularidade comprovada por identificador do vendedor (${sId})`,
      };
    }
  }

  // 3B: Prova por Nome Canônico Autorizado do vendedor atual
  for (const sName of saleSellerNames) {
    for (const uName of myNames) {
      if (isSellerNameMatch(sName, uName)) {
        return {
          allowed: true,
          factor: 'F3B_NAME_MATCH',
          reason: `Titularidade comprovada por nome do vendedor (${sName})`,
        };
      }
    }
  }

  // FATOR 4: Zero-Trust Fallback (Sem comprovação positiva inequívoca = Bloqueado)
  return {
    allowed: false,
    factor: 'F4_ZERO_TRUST_BLOCK',
    reason: 'Venda sem comprovação positiva de titularidade para este vendedor',
  };
}

/**
 * Verifica se uma venda pertence ao usuário/vendedor atual utilizando o Motor de Validação de Fatores
 */
export function isSaleOwnedByCurrentUser(
  sale: any,
  auth: UserAuthScopeContext,
  employees: Employee[] = []
): boolean {
  return validateSellerSalesAccess(sale, auth, employees).allowed;
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
  return sales.filter((sale) => validateSellerSalesAccess(sale, auth, employees).allowed);
}
