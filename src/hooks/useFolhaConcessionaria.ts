import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStores, DEFAULT_DEALERSHIP_STORES } from '@/hooks/useStores';
import { Employee, SalaryAddition, useEmployees, useUpsertEmployee } from '@/hooks/useEmployees';
import { Payslip, usePayslips, useUpsertPayslip } from '@/hooks/usePayslips';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_EMPRESA_FOLHA_CONFIG,
  DEFAULT_REGRAS_POR_CARGO,
  EmpresaFolhaConfig,
  FuncionarioFolhaMeta,
  RegraComissaoCargo,
  VariaveisFolhaEntrada,
  ResultadoFolhaFuncionario,
  calcularFolhaFuncionario,
  sanitizarResultadoFolha,
} from '@/lib/folhaCalculos';

const FOLHA_META_ID = '__folha_meta__';
const STORAGE_KEY_EMPRESA = 'motofolha_empresa_config_v1';

export interface FuncionarioConcessionaria extends FuncionarioFolhaMeta {
  id: string;
  profile_id: string | null;
  store_id: string | null;
  storeName: string;
  nome: string;
  cpf: string;
  cargoId: string;
  cargo: string;
  role: string;
  salarioBase: number;
  dataAdmissao: string;
  banco: string;
  agencia: string;
  conta: string;
  chavePix: string;
  email: string;
  telefone: string;
  status:
    | 'ATIVO'
    | 'PAUSA_ADMINISTRATIVA'
    | 'DEMITIDO'
    | 'SUSPENSO'
    | 'AFASTADO_LICENCA'
    | 'AVISO_PREVIO'
    | 'INATIVO';
  commissionRate: number;
  commissionType: 'percentage' | 'tiered' | 'fixed_value';
  managerCommissionRate: number;
  regularAdditions: SalaryAddition[];
  rawEmployee: Employee;
}

export interface FolhaMensalItem {
  id: string;
  payslip_number: string;
  funcionarioId: string;
  storeId: string | null;
  mesReferencia: string; // 'YYYY-MM'
  reference_month: number;
  reference_year: number;
  status: 'ABERTA' | 'FECHADA' | 'CANCELADA';
  rawStatus: 'pendente' | 'pago' | 'cancelado';
  variaveisEntrada: VariaveisFolhaEntrada;
  resultado: ResultadoFolhaFuncionario;
  rawPayslip: Payslip;
}

export interface ResumoVendasColaboradorMes {
  profileId: string;
  totalContratos: number;
  motosVendidas: number;
  carrosVendidos: number;
  motosMarketingLoja: number;
  motosMarketingProprio: number;
  valorTotalVendido: number;
  comissaoRetorno: number;
  comissaoMotoParceiro: number;
  motoParceiroQtd: number;
  comissoesCatalogo: Array<{
    id: string;
    nome: string;
    tipo?: string;
    referencia?: string;
    valor: number;
  }>;
  motosMontadas: number;
}

/**
 * Infere o departamento padrão a partir do role/cargo no sistema
 */
export function inferirDepartamento(
  role?: string | null,
  position?: string | null,
): 'VENDAS' | 'MECANICA' | 'ADMINISTRATIVO' | 'GERENCIA' {
  const r = (role || '').toLowerCase();
  const p = (position || '').toLowerCase();
  if (r.includes('gerente') || p.includes('gerente') || p.includes('diretor') || p.includes('gestor')) {
    return 'GERENCIA';
  }
  if (
    r.includes('mecanico') ||
    p.includes('mecânic') ||
    p.includes('mecanico') ||
    p.includes('oficina') ||
    p.includes('montador') ||
    p.includes('preparador') ||
    p.includes('lavador') ||
    p.includes('auxiliar')
  ) {
    return 'MECANICA';
  }
  if (
    r.includes('vendedor') ||
    r.includes('revendedor') ||
    p.includes('vendedor') ||
    p.includes('revendedor') ||
    p.includes('consultor') ||
    p.includes('comercial') ||
    p.includes('sdr')
  ) {
    return 'VENDAS';
  }
  return 'ADMINISTRATIVO';
}

/**
 * Infere de forma determinística o ID do cargo na concessionária (`cargoId`)
 * evitando qualquer ambiguidade entre Vendedor +, Vendedor ++, Auxiliar de Mecânica, F&I, etc.
 */
export function inferirCargoId(info: {
  cargoId?: string | null;
  cargo?: string | null;
  role?: string | null;
  departamento?: string | null;
  tipoContrato?: string | null;
  modeloComissaoVendedor?: string | null;
}): string {
  if (info.cargoId && info.cargoId.trim()) {
    return info.cargoId.trim();
  }
  const r = (info.role || '').toLowerCase().trim();
  const p = (info.cargo || '').toLowerCase().trim();
  const depto = (info.departamento || '').toUpperCase();
  const contrato = (info.tipoContrato || '').toUpperCase();
  const modelo = (info.modeloComissaoVendedor || '').toUpperCase();

  // Correspondência direta por ID de role salvo
  if (DEFAULT_REGRAS_POR_CARGO[r]) {
    return r;
  }

  // Terceirizados / Revendedores
  if (
    r === 'revendedor' ||
    p.includes('revendedor') ||
    p.includes('indicador') ||
    (contrato === 'TERCEIRIZADO' && depto === 'VENDAS')
  ) {
    return 'revendedor';
  }
  if (contrato === 'TERCEIRIZADO' || contrato === 'PJ' || r.startsWith('prestador') || p.includes('terceirizad') || p.includes('mei')) {
    return 'prestador_terceirizado';
  }

  // Gerência & Diretoria
  if (r === 'admin' || p.includes('diretor') || p.includes('sócio') || p.includes('socio')) {
    return 'admin';
  }
  if (depto === 'GERENCIA' || r.includes('gerente') || p.includes('gerente')) {
    return 'gerente';
  }

  // Oficina & Mecânica
  if (
    r === 'auxiliar_mecanica' ||
    p.includes('auxiliar') ||
    p.includes('preparador') ||
    p.includes('lavador') ||
    p.includes('ajudante')
  ) {
    return 'auxiliar_mecanica';
  }
  if (depto === 'MECANICA' || r.includes('mecanico') || p.includes('mecânic') || p.includes('mecanico') || p.includes('oficina')) {
    return 'mecanico_chefe';
  }

  // Administrativo & F&I
  if (
    r === 'analista_fi' ||
    p.includes('f&i') ||
    p.includes('financiamento') ||
    p.includes('documenta') ||
    p.includes('despachante') ||
    p.includes('faturamento')
  ) {
    return 'analista_fi';
  }
  if (depto === 'ADMINISTRATIVO' || r.includes('admin') || p.includes('administrativ') || p.includes('caixa') || p.includes('financeiro')) {
    return 'admin_geral_check';
  }

  // Vendas
  if (r === 'vendedor_externo' || p.includes('++') || p.includes('externo') || p.includes('regional') || p.includes('prospec')) {
    return 'vendedor_externo';
  }
  if (r === 'vendedor_plus' || modelo === 'PLUS' || p.includes('+') || p.includes('plus') || p.includes('captação') || p.includes('captacao') || p.includes('sênior')) {
    return 'vendedor_plus';
  }

  return 'vendedor';
}

function normalizarCargoIdResolvido(id: string): string {
  if (id === 'admin_geral_check') return 'analista_fi';
  return id;
}

/**
 * Extrai os metadados CLT/Concessionária salvos em salary_additions sem quebrar adições normais
 */
export function unpackEmployeeFolha(emp: Employee): FuncionarioConcessionaria {
  const rawList = Array.isArray(emp.salary_additions) ? emp.salary_additions : [];
  const metaEntry = rawList.find((x: any) => x?.id === FOLHA_META_ID) as any;
  const regularAdditions = rawList.filter((x: any) => x?.id !== FOLHA_META_ID);

  let parsedNotesMeta: Partial<FuncionarioFolhaMeta> = {};
  if (typeof emp.notes === 'string' && emp.notes.trim().startsWith('{')) {
    try {
      const obj = JSON.parse(emp.notes);
      if (obj && obj.__folha_meta) {
        parsedNotesMeta = obj;
      }
    } catch {
      // ignore non-json notes
    }
  }

  const savedMeta: Partial<FuncionarioFolhaMeta> = {
    ...parsedNotesMeta,
    ...(metaEntry?.meta || {}),
  };

  const rawRole = emp.role || (emp as any).role_title || '';
  const rawPosition = emp.position || (emp as any).role_title || (emp as any).department || '';

  const isPrestadorRole = rawRole.startsWith('prestador') || rawRole === 'revendedor';
  const isVendedorPlusRole =
    rawRole === 'vendedor_plus' ||
    rawRole === 'vendedor_externo' ||
    rawPosition.toLowerCase().includes('plus') ||
    rawPosition.toLowerCase().includes('+') ||
    rawPosition.toLowerCase().includes('sênior') ||
    rawPosition.toLowerCase().includes('senior') ||
    rawPosition.toLowerCase().includes('externo') ||
    rawPosition.toLowerCase().includes('regional');

  const departamento =
    savedMeta.departamento || inferirDepartamento(rawRole, rawPosition);
  const tipoContrato =
    savedMeta.tipoContrato || (isPrestadorRole ? 'TERCEIRIZADO' : 'CLT');
  const modeloComissaoVendedor =
    savedMeta.modeloComissaoVendedor ||
    (isVendedorPlusRole
      ? 'PLUS'
      : emp.commission_type === 'percentage' && Number(emp.commission_rate) > 0
        ? 'PERCENTUAL'
        : 'PADRAO');

  const cargoId = normalizarCargoIdResolvido(
    inferirCargoId({
      cargoId: savedMeta.cargoId,
      cargo: rawPosition,
      role: rawRole,
      departamento,
      tipoContrato,
      modeloComissaoVendedor,
    }),
  );

  // Parse bank_info ("Banco | Ag: 0001 | Conta: 12345-6")
  let banco = '';
  let agencia = '';
  let conta = '';
  if (emp.bank_info) {
    const parts = emp.bank_info.split('|').map((s) => s.trim());
    banco = parts[0] || '';
    agencia = (parts[1] || '').replace(/^Ag:\s*/i, '');
    conta = (parts[2] || '').replace(/^Conta:\s*/i, '');
  }

  return {
    id: emp.id,
    profile_id: emp.profile_id,
    store_id: emp.store_id,
    storeName: emp.store?.name || 'Matriz / Geral',
    matricula: savedMeta.matricula || `MAT-${emp.id.slice(0, 5).toUpperCase()}`,
    nome: emp.full_name,
    cpf: emp.cpf || '',
    cargoId,
    cargo: emp.position || (emp as any).role_title || DEFAULT_REGRAS_POR_CARGO[cargoId]?.titulo || emp.role || 'Colaborador',
    role: emp.role || cargoId || 'vendedor',
    departamento,
    tipoContrato,
    modeloComissaoVendedor,
    salarioBase: Number(emp.base_salary) || 0,
    cargaHoraria: Number(savedMeta.cargaHoraria) || 220,
    dataAdmissao: emp.hire_date || new Date().toISOString().slice(0, 10),
    dependentes: Number(savedMeta.dependentes) || 0,
    grauInsalubridade:
      savedMeta.grauInsalubridade === 'MEDIO'
        ? 'NENHUM'
        : (savedMeta.grauInsalubridade || 'NENHUM'),
    temPericulosidade: savedMeta.temPericulosidade !== undefined ? Number(savedMeta.temPericulosidade) : 0,
    optanteVT:
      savedMeta.optanteVT !== undefined
        ? Number(savedMeta.optanteVT)
        : Number(emp.transport_allowance) > 0
          ? 1
          : 0,
    custoPassagemMensal:
      savedMeta.custoPassagemMensal !== undefined
        ? Number(savedMeta.custoPassagemMensal)
        : Number(emp.transport_allowance) || 0,
    descontoPlanoSaude:
      savedMeta.descontoPlanoSaude !== undefined ? Number(savedMeta.descontoPlanoSaude) : 0,
    descontoValeRefeicao:
      savedMeta.descontoValeRefeicao !== undefined
        ? Number(savedMeta.descontoValeRefeicao)
        : Number(emp.meal_allowance) || 0,
    descontarINSS:
      savedMeta.descontarINSS !== undefined
        ? Number(savedMeta.descontarINSS)
        : tipoContrato === 'TERCEIRIZADO'
          ? 0
          : 1,
    descontarIRRF:
      savedMeta.descontarIRRF !== undefined
        ? Number(savedMeta.descontarIRRF)
        : tipoContrato === 'TERCEIRIZADO'
          ? 0
          : 1,
    calcularFGTS:
      savedMeta.calcularFGTS !== undefined
        ? Number(savedMeta.calcularFGTS)
        : tipoContrato === 'TERCEIRIZADO'
          ? 0
          : 1,
    pagarDSRComissao:
      savedMeta.pagarDSRComissao !== undefined
        ? Number(savedMeta.pagarDSRComissao)
        : tipoContrato === 'TERCEIRIZADO'
          ? 0
          : 1,
    razaoSocialPrestador: savedMeta.razaoSocialPrestador || '',
    cnpjPrestador: savedMeta.cnpjPrestador || '',
    banco,
    agencia,
    conta,
    chavePix: emp.pix_key || '',
    email: emp.email || '',
    telefone: emp.phone || '',
    status: (savedMeta.status || (emp.is_active ? 'ATIVO' : 'INATIVO')) as
      | 'ATIVO'
      | 'PAUSA_ADMINISTRATIVA'
      | 'DEMITIDO'
      | 'SUSPENSO'
      | 'AFASTADO_LICENCA'
      | 'AVISO_PREVIO'
      | 'INATIVO',
    motivoStatus: savedMeta.motivoStatus || '',
    dataStatus: savedMeta.dataStatus || '',
    dataRetornoPrevista: savedMeta.dataRetornoPrevista || '',
    avisoPrevio: savedMeta.avisoPrevio || 'INDENIZADO',
    commissionRate: Number(emp.commission_rate) || 0,
    commissionType: emp.commission_type || 'tiered',
    managerCommissionRate: Number(emp.manager_commission_rate) || 0,
    regularAdditions,
    rawEmployee: emp,
  };
}

/**
 * Empacota os metadados CLT/Concessionária de volta no formato da tabela `employees` do Supabase
 */
export function packEmployeeFolhaPayload(
  form: Partial<FuncionarioConcessionaria> & { id?: string },
  existingAdditions: SalaryAddition[] = [],
) {
  const cleanAdditions = existingAdditions.filter((a: any) => a?.id !== FOLHA_META_ID);
  const statusAtual = form.status || 'ATIVO';
  const resolvedCargoId = normalizarCargoIdResolvido(
    inferirCargoId({
      cargoId: form.cargoId,
      cargo: form.cargo,
      role: form.role,
      departamento: form.departamento,
      tipoContrato: form.tipoContrato,
      modeloComissaoVendedor: form.modeloComissaoVendedor,
    }),
  );

  const metaObj: FuncionarioFolhaMeta = {
    __folha_meta: true,
    cargoId: resolvedCargoId,
    matricula: form.matricula,
    departamento: form.departamento || 'VENDAS',
    tipoContrato: form.tipoContrato || 'CLT',
    modeloComissaoVendedor: form.modeloComissaoVendedor || 'PADRAO',
    status: statusAtual,
    motivoStatus: form.motivoStatus || '',
    dataStatus: form.dataStatus || '',
    dataRetornoPrevista: form.dataRetornoPrevista || '',
    avisoPrevio: form.avisoPrevio || 'INDENIZADO',
    cargaHoraria: Number(form.cargaHoraria) || 220,
    dependentes: Number(form.dependentes) || 0,
    grauInsalubridade: form.grauInsalubridade || 'NENHUM',
    temPericulosidade: form.temPericulosidade ? 1 : 0,
    optanteVT: form.optanteVT ? 1 : 0,
    custoPassagemMensal: Number(form.custoPassagemMensal) || 0,
    descontoPlanoSaude: Number(form.descontoPlanoSaude) || 0,
    descontoValeRefeicao: Number(form.descontoValeRefeicao) || 0,
    descontarINSS: form.descontarINSS !== undefined ? (form.descontarINSS ? 1 : 0) : 1,
    descontarIRRF: form.descontarIRRF !== undefined ? (form.descontarIRRF ? 1 : 0) : 1,
    calcularFGTS: form.calcularFGTS !== undefined ? (form.calcularFGTS ? 1 : 0) : 1,
    pagarDSRComissao: form.pagarDSRComissao !== undefined ? (form.pagarDSRComissao ? 1 : 0) : 1,
    razaoSocialPrestador: form.razaoSocialPrestador || '',
    cnpjPrestador: form.cnpjPrestador || '',
  };

  const salary_additions: SalaryAddition[] = [
    ...cleanAdditions,
    {
      id: FOLHA_META_ID,
      name: FOLHA_META_ID,
      type: 'fixed' as const,
      value: 0,
      meta: metaObj,
    } as any,
  ];

  const bankParts = [
    form.banco?.trim(),
    form.agencia?.trim() ? `Ag: ${form.agencia.trim()}` : '',
    form.conta?.trim() ? `Conta: ${form.conta.trim()}` : '',
  ].filter(Boolean);

  // Map role preserving exact cargoId for compatibility with existing system
  let role = resolvedCargoId || form.role || 'vendedor';

  return {
    ...(form.id ? { id: form.id } : {}),
    profile_id: form.profile_id || null,
    store_id: form.store_id || null,
    full_name: form.nome || 'Sem Nome',
    cpf: form.cpf || null,
    role,
    position: form.cargo || DEFAULT_REGRAS_POR_CARGO[resolvedCargoId]?.titulo || null,
    base_salary: Number(form.salarioBase) || 0,
    commission_rate: Number(form.commissionRate) || 0,
    commission_type: (form.modeloComissaoVendedor === 'PERCENTUAL'
      ? 'percentage'
      : 'tiered') as 'percentage' | 'tiered' | 'fixed_value',
    manager_commission_rate: Number(form.managerCommissionRate) || 0,
    transport_allowance: Number(form.custoPassagemMensal) || 0,
    meal_allowance: Number(form.descontoValeRefeicao) || 0,
    salary_additions,
    hire_date: form.dataAdmissao || null,
    phone: form.telefone || null,
    email: form.email || null,
    pix_key: form.chavePix || null,
    bank_info: bankParts.length > 0 ? bankParts.join(' | ') : null,
    is_active: form.status === 'ATIVO',
  };
}

function buildMergedRegrasPorCargo(
  saved?: Partial<EmpresaFolhaConfig>,
): Record<string, RegraComissaoCargo> {
  const base: Record<string, RegraComissaoCargo> = {};
  for (const [k, v] of Object.entries(DEFAULT_REGRAS_POR_CARGO)) {
    base[k] = { ...v, faixasMotos: [...(v.faixasMotos || [])] };
  }

  // Se houver alterações legadas em `regrasComissoesCargos`, reflete na base antes de aplicar `regrasPorCargo`
  if (saved?.regrasComissoesCargos) {
    const leg = saved.regrasComissoesCargos;
    if (leg.vendedorPadrao) {
      base.vendedor = {
        ...base.vendedor,
        salarioBasePadrao: leg.vendedorPadrao.salarioBaseSugerido ?? base.vendedor.salarioBasePadrao,
        faixasMotos: leg.vendedorPadrao.faixas || base.vendedor.faixasMotos,
      };
    }
    if (leg.vendedorPlus) {
      base.vendedor_plus = {
        ...base.vendedor_plus,
        salarioBasePadrao: leg.vendedorPlus.salarioBaseSugerido ?? base.vendedor_plus.salarioBasePadrao,
        faixasMotos: leg.vendedorPlus.faixasMarketingLoja || base.vendedor_plus.faixasMotos,
        valorMarketingProprioPorMoto:
          leg.vendedorPlus.valorMarketingProprio ?? base.vendedor_plus.valorMarketingProprioPorMoto,
      };
    }
    if (leg.mecanico) {
      base.mecanico_chefe = {
        ...base.mecanico_chefe,
        salarioBasePadrao: leg.mecanico.salarioBaseSugerido ?? base.mecanico_chefe.salarioBasePadrao,
        valorPorMotoMontada: leg.mecanico.valorPorMotoMontada ?? base.mecanico_chefe.valorPorMotoMontada,
        valorPorRevisaoExecutada: leg.mecanico.valorPorRevisao ?? base.mecanico_chefe.valorPorRevisaoExecutada,
      };
    }
    if (leg.gerente) {
      base.gerente = {
        ...base.gerente,
        salarioBasePadrao: leg.gerente.salarioBaseSugerido ?? base.gerente.salarioBasePadrao,
        valorPorMotoVendidaLojaGerente:
          leg.gerente.valorPorMotoVendidaLoja ?? base.gerente.valorPorMotoVendidaLojaGerente,
        bonusMetaAtingida: leg.gerente.bonusMetaGlobal ?? base.gerente.bonusMetaAtingida,
      };
    }
  }

  if (saved?.regrasPorCargo) {
    for (const [k, v] of Object.entries(saved.regrasPorCargo)) {
      if (v === null || (v as any)?.desativado || (v as any)?.ativo === false) {
        // Cargo explicitamente excluído/desativado pelo usuário
        if (base[k]) {
          base[k] = { ...base[k], ativo: false };
        }
      } else if (v) {
        base[k] = {
          ...(base[k] || DEFAULT_REGRAS_POR_CARGO.vendedor),
          ...v,
          id: k,
          grauInsalubridadePadrao:
            v.grauInsalubridadePadrao === 'MEDIO'
              ? 'NENHUM'
              : (v.grauInsalubridadePadrao || 'NENHUM'),
          ativo: v.ativo !== false,
        };
      }
    }
  }

  return base;
}

/**
 * Hook para buscar configurações da Concessionária / Loja integrada às Stores do Supabase
 */
export function useEmpresaFolhaConfig(selectedStoreId?: string) {
  const qc = useQueryClient();
  const { data: stores } = useStores();
  const { toast } = useToast();

  const [configsByStore, setConfigsByStore] = useState<Record<string, EmpresaFolhaConfig>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_EMPRESA);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const storeKey = selectedStoreId && selectedStoreId !== 'all' ? selectedStoreId : 'global';

  const activeStore = useMemo(() => {
    if (!stores || stores.length === 0) return null;
    if (selectedStoreId && selectedStoreId !== 'all') {
      return stores.find((s) => s.id === selectedStoreId) || stores[0];
    }
    return stores.find((s) => s.is_active) || stores[0];
  }, [stores, selectedStoreId]);

  const empresa = useMemo<EmpresaFolhaConfig>(() => {
    const savedGlobal = configsByStore.global || {};
    const savedStore = storeKey !== 'global' ? configsByStore[storeKey] || {} : {};
    const saved: Partial<EmpresaFolhaConfig> = {
      ...savedGlobal,
      ...savedStore,
      regrasPorCargo: {
        ...(savedGlobal.regrasPorCargo || {}),
        ...(savedStore.regrasPorCargo || {}),
      },
    };
    const mergedRegrasPorCargo = buildMergedRegrasPorCargo(saved);
    return {
      ...DEFAULT_EMPRESA_FOLHA_CONFIG,
      ...saved,
      storeId: activeStore?.id || null,
      razaoSocial: saved.razaoSocial || activeStore?.name || DEFAULT_EMPRESA_FOLHA_CONFIG.razaoSocial,
      cnpj: saved.cnpj || activeStore?.cnpj || DEFAULT_EMPRESA_FOLHA_CONFIG.cnpj,
      endereco: saved.endereco || activeStore?.address || DEFAULT_EMPRESA_FOLHA_CONFIG.endereco,
      cidade: saved.cidade || activeStore?.city || DEFAULT_EMPRESA_FOLHA_CONFIG.cidade,
      uf: saved.uf || activeStore?.state || DEFAULT_EMPRESA_FOLHA_CONFIG.uf,
      salarioBaseVendedor:
        mergedRegrasPorCargo.vendedor?.salarioBasePadrao ??
        saved.salarioBaseVendedor ??
        DEFAULT_EMPRESA_FOLHA_CONFIG.salarioBaseVendedor,
      salarioBaseMecanico:
        mergedRegrasPorCargo.mecanico_chefe?.salarioBasePadrao ??
        saved.salarioBaseMecanico ??
        DEFAULT_EMPRESA_FOLHA_CONFIG.salarioBaseMecanico,
      salarioBaseGerente:
        mergedRegrasPorCargo.gerente?.salarioBasePadrao ??
        saved.salarioBaseGerente ??
        DEFAULT_EMPRESA_FOLHA_CONFIG.salarioBaseGerente,
      salarioBaseAdministrativo:
        mergedRegrasPorCargo.auxiliar_admin?.salarioBasePadrao ??
        saved.salarioBaseAdministrativo ??
        DEFAULT_EMPRESA_FOLHA_CONFIG.salarioBaseAdministrativo,
      regrasComissao:
        mergedRegrasPorCargo.vendedor?.faixasMotos ||
        saved.regrasComissao ||
        DEFAULT_EMPRESA_FOLHA_CONFIG.regrasComissao,
      regrasComissaoPlus: {
        faixas:
          mergedRegrasPorCargo.vendedor_plus?.faixasMotos ||
          saved.regrasComissaoPlus?.faixas ||
          DEFAULT_EMPRESA_FOLHA_CONFIG.regrasComissaoPlus.faixas,
        valorMarketingProprio:
          mergedRegrasPorCargo.vendedor_plus?.valorMarketingProprioPorMoto ??
          saved.regrasComissaoPlus?.valorMarketingProprio ??
          DEFAULT_EMPRESA_FOLHA_CONFIG.regrasComissaoPlus.valorMarketingProprio,
      },
      tiposComissoesLoja:
        saved.tiposComissoesLoja || DEFAULT_EMPRESA_FOLHA_CONFIG.tiposComissoesLoja,
      regrasComissoesCargos: {
        ...DEFAULT_EMPRESA_FOLHA_CONFIG.regrasComissoesCargos,
        ...(saved.regrasComissoesCargos || {}),
      },
      regrasPorCargo: mergedRegrasPorCargo,
    };
  }, [configsByStore, storeKey, activeStore]);

  const salvarEmpresaConfig = useCallback(
    async (novaConfig: Partial<EmpresaFolhaConfig>, aplicarParaTodas = false) => {
      const nextRegrasPorCargo = novaConfig.regrasPorCargo
        ? {
            ...(empresa.regrasPorCargo || DEFAULT_REGRAS_POR_CARGO),
            ...novaConfig.regrasPorCargo,
          }
        : { ...(empresa.regrasPorCargo || DEFAULT_REGRAS_POR_CARGO) };

      // Sincronização bidirecional: formulário de configuração geral -> regras por cargo
      if (novaConfig.salarioBaseVendedor !== undefined && nextRegrasPorCargo.vendedor) {
        nextRegrasPorCargo.vendedor = {
          ...nextRegrasPorCargo.vendedor,
          salarioBasePadrao: Number(novaConfig.salarioBaseVendedor) || 0,
        };
      }
      if (novaConfig.salarioBaseMecanico !== undefined && nextRegrasPorCargo.mecanico_chefe) {
        nextRegrasPorCargo.mecanico_chefe = {
          ...nextRegrasPorCargo.mecanico_chefe,
          salarioBasePadrao: Number(novaConfig.salarioBaseMecanico) || 0,
        };
      }
      if (novaConfig.salarioBaseGerente !== undefined && nextRegrasPorCargo.gerente) {
        nextRegrasPorCargo.gerente = {
          ...nextRegrasPorCargo.gerente,
          salarioBasePadrao: Number(novaConfig.salarioBaseGerente) || 0,
        };
      }
      if (novaConfig.salarioBaseAdministrativo !== undefined && nextRegrasPorCargo.auxiliar_admin) {
        nextRegrasPorCargo.auxiliar_admin = {
          ...nextRegrasPorCargo.auxiliar_admin,
          salarioBasePadrao: Number(novaConfig.salarioBaseAdministrativo) || 0,
        };
      }
      if (novaConfig.regrasComissao && nextRegrasPorCargo.vendedor) {
        nextRegrasPorCargo.vendedor = {
          ...nextRegrasPorCargo.vendedor,
          faixasMotos: novaConfig.regrasComissao,
        };
      }
      if (novaConfig.regrasComissaoPlus?.faixas && nextRegrasPorCargo.vendedor_plus) {
        nextRegrasPorCargo.vendedor_plus = {
          ...nextRegrasPorCargo.vendedor_plus,
          faixasMotos: novaConfig.regrasComissaoPlus.faixas,
          valorMarketingProprioPorMoto:
            novaConfig.regrasComissaoPlus.valorMarketingProprio ??
            nextRegrasPorCargo.vendedor_plus.valorMarketingProprioPorMoto,
        };
      }

      // Sincronização inversa: regras do cargo -> campos de topo
      const salarioBaseVendedorFinal =
        nextRegrasPorCargo.vendedor?.salarioBasePadrao ??
        novaConfig.salarioBaseVendedor ??
        empresa.salarioBaseVendedor;
      const salarioBaseMecanicoFinal =
        nextRegrasPorCargo.mecanico_chefe?.salarioBasePadrao ??
        novaConfig.salarioBaseMecanico ??
        empresa.salarioBaseMecanico;
      const salarioBaseGerenteFinal =
        nextRegrasPorCargo.gerente?.salarioBasePadrao ??
        novaConfig.salarioBaseGerente ??
        empresa.salarioBaseGerente;
      const salarioBaseAdminFinal =
        nextRegrasPorCargo.auxiliar_admin?.salarioBasePadrao ??
        novaConfig.salarioBaseAdministrativo ??
        empresa.salarioBaseAdministrativo;

      // Mantém sincronizado também `regrasComissoesCargos` legado para qualquer tela que o consulte
      const syncedRegrasComissoesCargos = {
        ...DEFAULT_EMPRESA_FOLHA_CONFIG.regrasComissoesCargos,
        ...(empresa.regrasComissoesCargos || {}),
        ...(novaConfig.regrasComissoesCargos || {}),
        vendedorPadrao: {
          salarioBaseSugerido: salarioBaseVendedorFinal ?? 1850,
          faixas: nextRegrasPorCargo.vendedor?.faixasMotos || DEFAULT_EMPRESA_FOLHA_CONFIG.regrasComissao,
        },
        vendedorPlus: {
          salarioBaseSugerido: nextRegrasPorCargo.vendedor_plus?.salarioBasePadrao ?? 2000,
          faixasMarketingLoja:
            nextRegrasPorCargo.vendedor_plus?.faixasMotos ||
            DEFAULT_EMPRESA_FOLHA_CONFIG.regrasComissaoPlus.faixas,
          valorMarketingProprio:
            nextRegrasPorCargo.vendedor_plus?.valorMarketingProprioPorMoto ?? 500,
        },
        mecanico: {
          salarioBaseSugerido: salarioBaseMecanicoFinal ?? 2400,
          valorPorMotoMontada: nextRegrasPorCargo.mecanico_chefe?.valorPorMotoMontada ?? 40,
          valorPorRevisao: nextRegrasPorCargo.mecanico_chefe?.valorPorRevisaoExecutada ?? 25,
          comissaoOficinaAtiva: true,
        },
        gerente: {
          salarioBaseSugerido: salarioBaseGerenteFinal ?? 4500,
          valorPorMotoVendidaLoja:
            nextRegrasPorCargo.gerente?.valorPorMotoVendidaLojaGerente ?? 20,
          bonusMetaGlobal: nextRegrasPorCargo.gerente?.bonusMetaAtingida ?? 600,
          metaGlobalAtiva: true,
        },
      };

      const merged: EmpresaFolhaConfig = {
        ...empresa,
        ...novaConfig,
        salarioBaseVendedor: salarioBaseVendedorFinal,
        salarioBaseMecanico: salarioBaseMecanicoFinal,
        salarioBaseGerente: salarioBaseGerenteFinal,
        salarioBaseAdministrativo: salarioBaseAdminFinal,
        regrasPorCargo: nextRegrasPorCargo,
        regrasComissoesCargos: syncedRegrasComissoesCargos,
        regrasComissao:
          nextRegrasPorCargo.vendedor?.faixasMotos ||
          novaConfig.regrasComissao ||
          empresa.regrasComissao,
        regrasComissaoPlus: {
          faixas:
            nextRegrasPorCargo.vendedor_plus?.faixasMotos ||
            novaConfig.regrasComissaoPlus?.faixas ||
            empresa.regrasComissaoPlus.faixas,
          valorMarketingProprio:
            nextRegrasPorCargo.vendedor_plus?.valorMarketingProprioPorMoto ??
            novaConfig.regrasComissaoPlus?.valorMarketingProprio ??
            empresa.regrasComissaoPlus.valorMarketingProprio,
        },
      };

      const next: Record<string, EmpresaFolhaConfig> = { ...configsByStore };

      if (aplicarParaTodas) {
        next.global = merged;
        (stores || []).forEach((st) => {
          next[st.id] = {
            ...merged,
            storeId: st.id,
            storeName: st.name,
            razaoSocial: st.name || merged.razaoSocial,
            cnpj: st.cnpj || merged.cnpj,
            endereco: st.address || merged.endereco,
            cidade: st.city || merged.cidade,
            uf: st.state || merged.uf,
          };
        });
      } else {
        next[storeKey] = merged;
        if (storeKey === 'global') {
          next.global = merged;
        }
      }

      setConfigsByStore(next);
      try {
        localStorage.setItem(STORAGE_KEY_EMPRESA, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }

      // Sincroniza diretamente com o cadastro oficial da loja no Supabase (Aba Organização)
      const targetStoreId = novaConfig.storeId || (storeKey !== 'global' ? storeKey : activeStore?.id);
      if (targetStoreId) {
        try {
          const updatePayload: Record<string, any> = {};
          if (merged.razaoSocial) updatePayload.name = merged.razaoSocial;
          if (merged.cnpj) updatePayload.cnpj = merged.cnpj;
          if (merged.endereco) updatePayload.address = merged.endereco;
          if (merged.cidade) updatePayload.city = merged.cidade;
          if (merged.uf) updatePayload.state = merged.uf;
          if (merged.telefone) updatePayload.phone = merged.telefone;

          if (Object.keys(updatePayload).length > 0) {
            await supabase
              .from('stores')
              .update(updatePayload)
              .eq('id', targetStoreId);
            qc.invalidateQueries({ queryKey: ['stores'] });
          }
        } catch {
          // Non-blocking
        }
      }

      toast({
        title: aplicarParaTodas
          ? 'Regras aplicadas para todas as unidades!'
          : `Configurações da unidade (${activeStore?.name || 'Global'}) salvas com sucesso!`,
      });
    },
    [empresa, configsByStore, storeKey, activeStore, stores, qc, toast],
  );

  const obterConfigParaLoja = useCallback(
    (storeId?: string | null): EmpresaFolhaConfig => {
      const key = storeId && storeId !== 'all' ? storeId : 'global';
      const savedGlobal = configsByStore.global || {};
      const savedStore = key !== 'global' ? configsByStore[key] || {} : {};
      const saved: Partial<EmpresaFolhaConfig> = {
        ...savedGlobal,
        ...savedStore,
        regrasPorCargo: {
          ...(savedGlobal.regrasPorCargo || {}),
          ...(savedStore.regrasPorCargo || {}),
        },
      };
      const st =
        stores?.find((s) => s.id === storeId) ||
        (storeId === 'store-divinopolis' ? DEFAULT_DEALERSHIP_STORES[0] : null) ||
        (storeId === 'store-montesclaros' ? DEFAULT_DEALERSHIP_STORES[1] : null);
      const mergedRegrasPorCargo = buildMergedRegrasPorCargo(saved);
      return {
        ...DEFAULT_EMPRESA_FOLHA_CONFIG,
        ...saved,
        storeId: st?.id || null,
        storeName: st?.name || saved.storeName || '',
        // Prioridade 1: Dados centrais da loja cadastrada na aba Organização
        razaoSocial:
          st?.name || saved.razaoSocial || DEFAULT_EMPRESA_FOLHA_CONFIG.razaoSocial,
        cnpj: st?.cnpj || saved.cnpj || DEFAULT_EMPRESA_FOLHA_CONFIG.cnpj,
        endereco:
          st?.address || saved.endereco || DEFAULT_EMPRESA_FOLHA_CONFIG.endereco,
        cidade: st?.city || saved.cidade || DEFAULT_EMPRESA_FOLHA_CONFIG.cidade,
        uf: st?.state || saved.uf || DEFAULT_EMPRESA_FOLHA_CONFIG.uf,
        telefone: st?.phone || saved.telefone || DEFAULT_EMPRESA_FOLHA_CONFIG.telefone,
        salarioBaseVendedor:
          mergedRegrasPorCargo.vendedor?.salarioBasePadrao ??
          saved.salarioBaseVendedor ??
          DEFAULT_EMPRESA_FOLHA_CONFIG.salarioBaseVendedor,
        salarioBaseMecanico:
          mergedRegrasPorCargo.mecanico_chefe?.salarioBasePadrao ??
          saved.salarioBaseMecanico ??
          DEFAULT_EMPRESA_FOLHA_CONFIG.salarioBaseMecanico,
        salarioBaseGerente:
          mergedRegrasPorCargo.gerente?.salarioBasePadrao ??
          saved.salarioBaseGerente ??
          DEFAULT_EMPRESA_FOLHA_CONFIG.salarioBaseGerente,
        salarioBaseAdministrativo:
          mergedRegrasPorCargo.auxiliar_admin?.salarioBasePadrao ??
          saved.salarioBaseAdministrativo ??
          DEFAULT_EMPRESA_FOLHA_CONFIG.salarioBaseAdministrativo,
        regrasComissao:
          mergedRegrasPorCargo.vendedor?.faixasMotos ||
          saved.regrasComissao ||
          DEFAULT_EMPRESA_FOLHA_CONFIG.regrasComissao,
        regrasComissaoPlus: {
          faixas:
            mergedRegrasPorCargo.vendedor_plus?.faixasMotos ||
            saved.regrasComissaoPlus?.faixas ||
            DEFAULT_EMPRESA_FOLHA_CONFIG.regrasComissaoPlus.faixas,
          valorMarketingProprio:
            mergedRegrasPorCargo.vendedor_plus?.valorMarketingProprioPorMoto ??
            saved.regrasComissaoPlus?.valorMarketingProprio ??
            DEFAULT_EMPRESA_FOLHA_CONFIG.regrasComissaoPlus.valorMarketingProprio,
        },
        tiposComissoesLoja:
          saved.tiposComissoesLoja || DEFAULT_EMPRESA_FOLHA_CONFIG.tiposComissoesLoja,
        regrasComissoesCargos: {
          ...DEFAULT_EMPRESA_FOLHA_CONFIG.regrasComissoesCargos,
          ...(saved.regrasComissoesCargos || {}),
        },
        regrasPorCargo: mergedRegrasPorCargo,
      };
    },
    [configsByStore, stores],
  );

  return {
    empresa,
    salvarEmpresaConfig,
    obterConfigParaLoja,
    activeStore,
    stores: stores || [],
    configsByStore,
  };
}

/**
 * Hook que busca as Vendas Reais (tabela `contracts` + `vehicles` + `sales_targets`) do mês/ano selecionado
 * para alimentar automaticamente as comissões de vendedores e gerentes!
 */
export function useVendasMesConcessionaria(month: number, year: number) {
  return useQuery({
    queryKey: ['folha-vendas-mes', year, month],
    queryFn: async () => {
      const start = new Date(year, month - 1, 1).toISOString();
      const end = new Date(year, month, 1).toISOString();

      const [{ data, error }, { data: targetsData }] = await Promise.all([
        supabase
          .from('contracts')
          .select(
            'id, created_by, store_id, sale_price, status, lead_source, lead_source_detail, sale_channel, ad_id, external_data, created_at, vehicle:vehicles(id, vehicle_type, brand, model)',
          )
          .gte('created_at', start)
          .lt('created_at', end)
          .in('status', ['concluido', 'assinado', 'quitado']),
        supabase
          .from('sales_targets')
          .select('user_id, store_id, target_qty, target_value, bonus_on_target')
          .eq('month', month)
          .eq('year', year),
      ]);

      if (error) throw error;
      const rows = (data || []) as any[];
      const targets = (targetsData || []) as any[];

      const createEmptyResumo = (idKey: string): ResumoVendasColaboradorMes => ({
        profileId: idKey,
        totalContratos: 0,
        motosVendidas: 0,
        carrosVendidos: 0,
        motosMarketingLoja: 0,
        motosMarketingProprio: 0,
        valorTotalVendido: 0,
        comissaoRetorno: 0,
        comissaoMotoParceiro: 0,
        motoParceiroQtd: 0,
        comissoesCatalogo: [],
        motosMontadas: 0,
      });

      const porProfile: Record<string, ResumoVendasColaboradorMes> = {};
      const motosPorLoja: Record<string, number> = {};
      let totalMotosGeral = 0;
      let totalVendasReaisGeral = 0;

      for (const r of rows) {
        const pid = r.created_by || 'sem_vendedor';
        if (!porProfile[pid]) {
          porProfile[pid] = createEmptyResumo(pid);
        }

        const item = porProfile[pid];
        const preco = Number(r.sale_price) || 0;
        item.totalContratos += 1;
        item.valorTotalVendido += preco;
        totalVendasReaisGeral += preco;

        const vType = (r.vehicle?.vehicle_type || 'moto').toLowerCase();
        const isCar = vType === 'carro' || vType === 'car' || vType === 'automovel';

        if (isCar) {
          item.carrosVendidos += 1;
        } else {
          item.motosVendidas += 1;
        }

        const folhaMeta = r.external_data?.folha_sale_meta || null;
        const captacaoExplicita = folhaMeta?.captacao_tipo; // 'LOJA' | 'PROPRIO'

        const leadSrc = (r.lead_source || '').toLowerCase();
        const leadDetail = (r.lead_source_detail || '').toLowerCase();
        const channel = (r.sale_channel || '').toLowerCase();
        const isProprioMarketing =
          captacaoExplicita === 'PROPRIO'
            ? true
            : captacaoExplicita === 'LOJA'
              ? false
              : channel === 'externa' ||
                channel === 'externo' ||
                leadSrc === 'indicacao' ||
                leadSrc === 'cliente_recorrente' ||
                leadSrc.includes('proprio') ||
                leadSrc.includes('próprio') ||
                leadSrc.includes('vendedor') ||
                leadSrc.includes('indicacao') ||
                leadSrc.includes('indicação') ||
                leadSrc.includes('prospeccao') ||
                leadSrc.includes('prospecção') ||
                leadDetail.includes('proprio') ||
                leadDetail.includes('próprio');

        if (isProprioMarketing) {
          item.motosMarketingProprio += 1;
        } else {
          item.motosMarketingLoja += 1;
        }

        if (folhaMeta?.commissions_extra && folhaMeta.is_primary_in_batch !== false) {
          const ce = folhaMeta.commissions_extra;
          item.comissaoRetorno += Number(ce.retorno_financiamento) || 0;
          item.comissaoMotoParceiro += Number(ce.moto_parceiro) || 0;
          if (Number(ce.moto_parceiro) > 0) {
            item.motoParceiroQtd += Number(ce.moto_parceiro_qtd) || 1;
          }
          if (Array.isArray(ce.itens_catalogo)) {
            for (const ic of ce.itens_catalogo) {
              if (Number(ic.valor) > 0) {
                item.comissoesCatalogo.push({
                  id: `${r.id}-${ic.id || ic.nome}`,
                  nome: ic.nome || 'Comissão Extra',
                  tipo: ic.tipo || 'FIXO',
                  referencia: ic.referencia || 'Venda registrada',
                  valor: Number(ic.valor) || 0,
                });
              }
            }
          }
        }

        totalMotosGeral += 1;
        if (r.store_id) {
          motosPorLoja[r.store_id] = (motosPorLoja[r.store_id] || 0) + 1;
        }
      }

      return {
        contratos: rows,
        targets,
        porProfile,
        motosPorLoja,
        totalMotosGeral,
        totalVendasReaisGeral,
      };
    },
  });
}

/**
 * Hook para buscar os perfis de usuários do sistema (`profiles` + `user_roles`)
 * para vincular ou importar vendedores/gerentes para a folha com 1 clique
 */
export function usePerfisSistema() {
  return useQuery({
    queryKey: ['folha-perfis-sistema'],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, phone, is_active, store_id'),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      const roleMap = new Map<string, string>();
      (roles || []).forEach((r: any) => {
        roleMap.set(r.user_id, r.role);
      });

      return (profiles || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || p.email || 'Usuário',
        email: p.email || '',
        phone: p.phone || '',
        is_active: p.is_active !== false,
        store_id: p.store_id || null,
        role: roleMap.get(p.id) || 'vendedor',
      }));
    },
  });
}

/**
 * Hook Principal Unificado da Folha de Pagamento da Concessionária
 */
export function useFolhaConcessionaria(mesReferencia: string, selectedStoreId = 'all') {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: rawEmployees, isLoading: loadingEmployees } = useEmployees();
  const { data: rawPayslips, isLoading: loadingPayslips } = usePayslips();
  const upsertEmployee = useUpsertEmployee();
  const upsertPayslip = useUpsertPayslip();

  const [yearStr, monthStr] = mesReferencia.split('-');
  const referenceYear = Number(yearStr) || new Date().getFullYear();
  const referenceMonth = Number(monthStr) || new Date().getMonth() + 1;

  const { empresa, salvarEmpresaConfig, obterConfigParaLoja, stores, configsByStore } = useEmpresaFolhaConfig(selectedStoreId);
  const { data: vendasMes, refetch: refetchVendasMes } = useVendasMesConcessionaria(
    referenceMonth,
    referenceYear,
  );
  const { data: perfisSistema } = usePerfisSistema();

  // Lista de funcionários enriquecida com os metadados CLT/Concessionária
  const funcionarios = useMemo<FuncionarioConcessionaria[]>(() => {
    const list = (rawEmployees || []).map(unpackEmployeeFolha);
    if (selectedStoreId && selectedStoreId !== 'all') {
      return list.filter((f) => f.store_id === selectedStoreId);
    }
    return list;
  }, [rawEmployees, selectedStoreId]);

  // Helper para obter regras de comissão aplicáveis a um funcionário (considerando a unidade e o cargoId dele)
  const getRegrasComissaoParaFuncionario = useCallback(
    (func: FuncionarioConcessionaria) => {
      const cfg = func.store_id ? obterConfigParaLoja(func.store_id) : empresa;
      const regraDoCargo = cfg.regrasPorCargo?.[func.cargoId];
      if (regraDoCargo?.faixasMotos && regraDoCargo.faixasMotos.length > 0) {
        return regraDoCargo.faixasMotos;
      }
      if (func.modeloComissaoVendedor === 'PLUS') {
        return (
          cfg.regrasComissoesCargos?.vendedorPlus?.faixasMarketingLoja ||
          cfg.regrasComissaoPlus?.faixas ||
          cfg.regrasComissao
        );
      }
      return (
        cfg.regrasComissoesCargos?.vendedorPadrao?.faixas || cfg.regrasComissao
      );
    },
    [empresa, obterConfigParaLoja],
  );

  // Converte os `payslips` do mês em `FolhaMensalItem` com `resultado` completo
  const folhas = useMemo<FolhaMensalItem[]>(() => {
    const allPayslips = (rawPayslips || []).filter(
      (p) =>
        p.reference_month === referenceMonth &&
        p.reference_year === referenceYear &&
        (selectedStoreId === 'all' || p.store_id === selectedStoreId || p.store?.id === selectedStoreId),
    );

    return allPayslips.map((p) => {
      const breakdown = (p as any).breakdown as any;
      const func =
        funcionarios.find((f) => f.id === p.employee_id) ||
        (rawEmployees || []).map(unpackEmployeeFolha).find((f) => f.id === p.employee_id);

      const funcFallback: any = func
        ? { ...func, regimeEmpresa: empresa.regimeTributario }
        : {
            id: p.employee_id,
            nome: p.employee?.full_name || 'Colaborador',
            cargo: p.employee?.position || p.employee?.role || 'Colaborador',
            cpf: p.employee?.cpf || '',
            departamento: inferirDepartamento(p.employee?.role, p.employee?.position),
            tipoContrato: (p.employee?.role || '').startsWith('prestador') ? 'TERCEIRIZADO' : 'CLT',
            salarioBase: Number(p.base_salary) || 0,
            cargaHoraria: 220,
            dependentes: 0,
            descontarINSS: 1,
            descontarIRRF: 1,
            calcularFGTS: 1,
            pagarDSRComissao: 1,
            regimeEmpresa: empresa.regimeTributario,
          };

      if (breakdown?.folha_v2 && breakdown?.resultado) {
        return {
          id: p.id,
          payslip_number: p.payslip_number,
          funcionarioId: p.employee_id,
          storeId: p.store_id,
          mesReferencia,
          reference_month: p.reference_month,
          reference_year: p.reference_year,
          status:
            p.status === 'pago'
              ? 'FECHADA'
              : p.status === 'cancelado'
                ? 'CANCELADA'
                : 'ABERTA',
          rawStatus: p.status,
          variaveisEntrada: breakdown.variaveisEntrada || {},
          resultado: sanitizarResultadoFolha(breakdown.resultado, func || funcFallback),
          rawPayslip: p,
        };
      }

      // Reconstrói cálculo para contracheques legados
      const variaveisLegadas: VariaveisFolhaEntrada = {
        comissaoGeral: Number(p.commission_amount || 0) + Number(p.manager_commission || 0),
        outrosProventos: Number(p.bonus || 0),
        ajudaDeCusto: Number(p.other_allowance || 0),
        custoValeTransporte: Number(funcFallback.custoPassagemMensal || p.transport_allowance || 0),
        optanteVT: Boolean(funcFallback.optanteVT),
        descontoValeRefeicao: Number(funcFallback.descontoValeRefeicao || 0),
        descontoPlanoSaude: Number(funcFallback.descontoPlanoSaude || 0),
        outrosDescontos: Number(p.other_discounts || 0),
      };

      const resultadoCalculado = calcularFolhaFuncionario({
        funcionario: funcFallback,
        mesReferencia,
        regrasComissao: func ? getRegrasComissaoParaFuncionario(func) : empresa.regrasComissao,
        ...variaveisLegadas,
      });

      return {
        id: p.id,
        payslip_number: p.payslip_number,
        funcionarioId: p.employee_id,
        storeId: p.store_id,
        mesReferencia,
        reference_month: p.reference_month,
        reference_year: p.reference_year,
        status:
          p.status === 'pago'
            ? 'FECHADA'
            : p.status === 'cancelado'
              ? 'CANCELADA'
              : 'ABERTA',
        rawStatus: p.status,
        variaveisEntrada: variaveisLegadas,
        resultado: resultadoCalculado,
        rawPayslip: p,
      };
    });
  }, [
    rawPayslips,
    referenceMonth,
    referenceYear,
    selectedStoreId,
    funcionarios,
    rawEmployees,
    empresa,
    mesReferencia,
    getRegrasComissaoParaFuncionario,
  ]);

  /**
   * Obtém os números reais de vendas do sistema (`contracts` + `sales_targets`) para um colaborador no mês atual
   */
  const obterVendasSistemaColaborador = useCallback(
    (func: FuncionarioConcessionaria) => {
      if (!func || !func.id) {
        return {
          motosVendidas: 0,
          carrosVendidos: 0,
          totalContratos: 0,
          motosMarketingLoja: 0,
          motosMarketingProprio: 0,
          valorTotalVendido: 0,
          motosLojaGerente: 0,
          comissaoRetorno: 0,
          comissaoMotoParceiro: 0,
          motoParceiroQtd: 0,
          comissoesCatalogo: [],
          motosMontadas: 0,
          bateuMeta: false,
          bonusMeta: 0,
        };
      }
      const contratos = vendasMes?.contratos || [];
      let totalContratos = 0;
      let motosVendidas = 0;
      let carrosVendidos = 0;
      let motosMarketingLoja = 0;
      let motosMarketingProprio = 0;
      let valorTotalVendido = 0;
      let comissaoRetorno = 0;
      let comissaoMotoParceiro = 0;
      let motoParceiroQtd = 0;
      const comissoesCatalogo: Array<{
        id: string;
        nome: string;
        tipo: string;
        referencia: string;
        valor: number;
      }> = [];
      let motosMontadas = 0;

      for (const r of contratos) {
        const folhaMeta = r.external_data?.folha_sale_meta || null;

        // Contagem de montagem de motos vinculadas ao mecânico (Standby / Oficina)
        if (folhaMeta?.mechanic_employee_id && folhaMeta.mechanic_employee_id === func.id) {
          motosMontadas += 1;
        }

        // Verifica se a venda pertence a este colaborador (pelo employee_id explícito na venda ou pelo profile_id)
        const matchesEmployee = folhaMeta?.employee_id
          ? folhaMeta.employee_id === func.id
          : Boolean(func.profile_id && r.created_by === func.profile_id);

        if (!matchesEmployee) continue;

        const preco = Number(r.sale_price) || 0;
        totalContratos += 1;
        valorTotalVendido += preco;

        const vType = (r.vehicle?.vehicle_type || 'moto').toLowerCase();
        const isCar = vType === 'carro' || vType === 'car' || vType === 'automovel';
        if (isCar) {
          carrosVendidos += 1;
        } else {
          motosVendidas += 1;
        }

        const captacaoExplicita = folhaMeta?.captacao_tipo; // 'LOJA' | 'PROPRIO'
        const leadSrc = (r.lead_source || '').toLowerCase();
        const leadDetail = (r.lead_source_detail || '').toLowerCase();
        const channel = (r.sale_channel || '').toLowerCase();
        const isProprioMarketing =
          captacaoExplicita === 'PROPRIO'
            ? true
            : captacaoExplicita === 'LOJA'
              ? false
              : channel === 'externa' ||
                channel === 'externo' ||
                leadSrc === 'indicacao' ||
                leadSrc === 'cliente_recorrente' ||
                leadSrc.includes('proprio') ||
                leadSrc.includes('próprio') ||
                leadSrc.includes('vendedor') ||
                leadSrc.includes('indicacao') ||
                leadSrc.includes('indicação') ||
                leadSrc.includes('prospeccao') ||
                leadSrc.includes('prospecção') ||
                leadDetail.includes('proprio') ||
                leadDetail.includes('próprio');

        if (isProprioMarketing) {
          motosMarketingProprio += 1;
        } else {
          motosMarketingLoja += 1;
        }

        if (folhaMeta?.commissions_extra && folhaMeta.is_primary_in_batch !== false) {
          const ce = folhaMeta.commissions_extra;
          comissaoRetorno += Number(ce.retorno_financiamento) || 0;
          comissaoMotoParceiro += Number(ce.moto_parceiro) || 0;
          if (Number(ce.moto_parceiro) > 0) {
            motoParceiroQtd += Number(ce.moto_parceiro_qtd) || 1;
          }
          if (Array.isArray(ce.itens_catalogo)) {
            for (const ic of ce.itens_catalogo) {
              if (Number(ic.valor) > 0) {
                comissoesCatalogo.push({
                  id: `${r.id}-${ic.id || ic.nome}`,
                  nome: ic.nome || 'Comissão Extra',
                  tipo: ic.tipo || 'FIXO',
                  referencia: ic.referencia || 'Venda registrada',
                  valor: Number(ic.valor) || 0,
                });
              }
            }
          }
        }
      }

      const motosLoja = func.store_id
        ? (vendasMes?.motosPorLoja[func.store_id] ?? vendasMes?.totalMotosGeral ?? 0)
        : (vendasMes?.totalMotosGeral ?? 0);

      // Verifica se o colaborador bateu a meta mensal em `sales_targets`
      const targets = vendasMes?.targets || [];
      const userTarget =
        (func.profile_id ? targets.find((t: any) => t.user_id === func.profile_id) : null) ||
        (func.store_id ? targets.find((t: any) => !t.user_id && t.store_id === func.store_id) : null) ||
        targets.find((t: any) => !t.user_id && !t.store_id);

      const bateuMeta = Boolean(
        userTarget &&
          (userTarget.target_qty > 0 || userTarget.target_value > 0) &&
          (userTarget.target_qty ? totalContratos >= userTarget.target_qty : true) &&
          (userTarget.target_value ? valorTotalVendido >= userTarget.target_value : true),
      );
      const bonusMeta = bateuMeta ? Number(userTarget?.bonus_on_target) || 0 : 0;

      return {
        motosVendidas,
        carrosVendidos,
        totalContratos,
        motosMarketingLoja,
        motosMarketingProprio,
        valorTotalVendido,
        comissaoRetorno,
        comissaoMotoParceiro,
        motoParceiroQtd,
        comissoesCatalogo,
        motosMontadas,
        motosLojaGerente: motosLoja,
        bateuMeta,
        bonusMeta,
      };
    },
    [vendasMes],
  );

  /**
   * Calcula e salva a folha de um colaborador no Supabase (`payslips`)
   */
  const salvarFolhaFuncionario = useCallback(
    async (func: FuncionarioConcessionaria, variaveis: VariaveisFolhaEntrada) => {
      const configLoja = func.store_id ? obterConfigParaLoja(func.store_id) : empresa;
      const regraDoCargo = configLoja.regrasPorCargo?.[func.cargoId];
      const regrasAplicaveis = getRegrasComissaoParaFuncionario(func);
      const valorMarketingProprioConfig =
        variaveis.valorMarketingProprio ??
        regraDoCargo?.valorMarketingProprioPorMoto ??
        configLoja.regrasComissoesCargos?.vendedorPlus?.valorMarketingProprio ??
        configLoja.regrasComissaoPlus?.valorMarketingProprio ??
        500;
      const valorMontagemPadrao =
        variaveis.valorPorMontagem !== undefined
          ? Number(variaveis.valorPorMontagem)
          : regraDoCargo?.valorPorMotoMontada !== undefined
            ? Number(regraDoCargo.valorPorMotoMontada)
            : Number(configLoja.regrasComissoesCargos?.mecanico?.valorPorMotoMontada) || 40;
      const valorRevisaoPadrao =
        variaveis.valorPorRevisao !== undefined
          ? Number(variaveis.valorPorRevisao)
          : regraDoCargo?.valorPorRevisaoExecutada !== undefined
            ? Number(regraDoCargo.valorPorRevisaoExecutada)
            : Number(configLoja.regrasComissoesCargos?.mecanico?.valorPorRevisao) || 25;

      // Comissão de gerente por moto vendida na loja
      const qtdMotosLojaGerente = Number(variaveis.motosLojaGerente) || 0;
      const valorUnitGerente =
        variaveis.valorComissaoGerentePorMoto !== undefined
          ? Number(variaveis.valorComissaoGerentePorMoto)
          : regraDoCargo?.valorPorMotoVendidaLojaGerente !== undefined
            ? Number(regraDoCargo.valorPorMotoVendidaLojaGerente)
            : Number(configLoja.regrasComissoesCargos?.gerente?.valorPorMotoVendidaLoja) || 20;
      const comissaoVolumeLojaGerente = +(qtdMotosLojaGerente * valorUnitGerente).toFixed(2);

      const bonusMetaGerente =
        variaveis.bonusMetaBatida !== undefined
          ? Number(variaveis.bonusMetaBatida)
          : variaveis.metaBatida
            ? regraDoCargo?.bonusMetaAtingida !== undefined
              ? Number(regraDoCargo.bonusMetaAtingida)
              : Number(configLoja.regrasComissoesCargos?.gerente?.bonusMetaGlobal) || 600
            : 0;

      const variaveisConsolidadas: VariaveisFolhaEntrada = {
        ...variaveis,
        motosLojaGerente: qtdMotosLojaGerente,
        valorComissaoGerentePorMoto: valorUnitGerente,
        valorMarketingProprio: valorMarketingProprioConfig,
        valorPorMontagem: valorMontagemPadrao,
        revisoesExecutadas: Number(variaveis.revisoesExecutadas) || 0,
        valorPorRevisao: valorRevisaoPadrao,
        bonusMetaBatida: bonusMetaGerente,
        custoValeTransporte:
          variaveis.custoValeTransporte ?? func.custoPassagemMensal ?? 0,
        optanteVT: variaveis.optanteVT ?? Boolean(func.optanteVT),
        descontoValeRefeicao:
          variaveis.descontoValeRefeicao ?? func.descontoValeRefeicao ?? 0,
        descontoPlanoSaude:
          variaveis.descontoPlanoSaude ?? func.descontoPlanoSaude ?? 0,
      };

      const resultado = calcularFolhaFuncionario({
        funcionario: { ...func, regimeEmpresa: empresa.regimeTributario },
        mesReferencia,
        regrasComissao: regrasAplicaveis,
        ...variaveisConsolidadas,
        descricaoComissaoGeral:
          qtdMotosLojaGerente > 0
            ? `${variaveis.descricaoComissaoGeral ? variaveis.descricaoComissaoGeral + ' + ' : ''}${qtdMotosLojaGerente} motos loja`
            : variaveis.descricaoComissaoGeral || '',
      });

      // Verifica se já existe payslip neste mês/ano para este funcionário
      const existente = (rawPayslips || []).find(
        (p) =>
          p.employee_id === func.id &&
          p.reference_month === referenceMonth &&
          p.reference_year === referenceYear,
      );

      const he50 = resultado.proventos.find((p) => p.rubrica.includes('50%'))?.valor || 0;
      const he100 = resultado.proventos.find((p) => p.rubrica.includes('100%'))?.valor || 0;
      const noturno = resultado.proventos.find((p) => p.rubrica.includes('Noturno'))?.valor || 0;
      const dsrHoras =
        resultado.proventos.find((p) => p.rubrica.includes('DSR sobre Horas'))?.valor || 0;
      const insalub =
        resultado.proventos.find((p) => p.rubrica.includes('Insalubridade'))?.valor || 0;
      const pericul =
        resultado.proventos.find((p) => p.rubrica.includes('Periculosidade'))?.valor || 0;

      const totalIndenizatorios =
        resultado.ajudaDeCusto + resultado.reembolsoDespesas + resultado.gastosDiversos;

      const descontosSemImpostos = +(
        resultado.totalDescontos -
        resultado.inssDetalhe.valor -
        resultado.irrfDetalhe.valor
      ).toFixed(2);

      const payload: any = {
        ...(existente ? { id: existente.id, payslip_number: existente.payslip_number } : {}),
        employee_id: func.id,
        store_id: func.store_id || null,
        reference_month: referenceMonth,
        reference_year: referenceYear,
        base_salary: resultado.salarioBase,
        commission_amount: +(
          resultado.totalComissoes -
          comissaoVolumeLojaGerente +
          resultado.comissaoDSR
        ).toFixed(2),
        commission_sales_total: Number(variaveis.vendasTotalReais) || 0,
        manager_commission: comissaoVolumeLojaGerente,
        overtime: +(he50 + he100 + noturno + dsrHoras).toFixed(2),
        bonus: +(
          Number(variaveis.outrosProventos || 0) +
          insalub +
          pericul
        ).toFixed(2),
        transport_allowance: 0,
        meal_allowance: 0,
        other_allowance: totalIndenizatorios,
        additions: [],
        inss_discount: resultado.inssDetalhe.valor,
        irrf_discount: resultado.irrfDetalhe.valor,
        other_discounts: Math.max(0, descontosSemImpostos),
        net_total: resultado.salarioLiquido,
        status: existente?.status || 'pendente',
        breakdown: {
          folha_v2: true,
          variaveisEntrada: variaveisConsolidadas,
          resultado,
        },
      };

      const { data: u } = await supabase.auth.getUser();
      if (!existente) {
        payload.created_by = u.user?.id;
        payload.payslip_number = `HF-${referenceYear}${String(referenceMonth).padStart(2, '0')}-${func.id.slice(0, 4).toUpperCase()}`;
      }

      const { data, error } = await (supabase as any)
        .from('payslips')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['payslips'] });
      return data;
    },
    [
      empresa,
      getRegrasComissaoParaFuncionario,
      mesReferencia,
      rawPayslips,
      referenceMonth,
      referenceYear,
      qc,
    ],
  );

  /**
   * Processa / Recalcula a folha mensal de todos os colaboradores ativos,
   * puxando automaticamente as vendas de motos registradas no sistema (`contracts`)
   * e sincronizando com `payroll_batches`!
   */
  const processarFolhaMensalCompleta = useCallback(
    async (sincronizarVendasSistema = true) => {
      const ativos = funcionarios.filter((f) => f.status === 'ATIVO');
      if (ativos.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Nenhum colaborador ativo encontrado para processar.',
        });
        return;
      }

      if (sincronizarVendasSistema) {
        await refetchVendasMes();
      }

      let processados = 0;
      let somaBruto = 0;
      let somaLiquido = 0;
      let somaEncargos = 0;

      for (const func of ativos) {
        const folhaExistente = folhas.find((fl) => fl.funcionarioId === func.id);
        const varsAtuais: VariaveisFolhaEntrada = folhaExistente?.variaveisEntrada
          ? { ...folhaExistente.variaveisEntrada }
          : {};

        if (sincronizarVendasSistema) {
          const vendasAuto = obterVendasSistemaColaborador(func);
          if (func.departamento === 'VENDAS') {
            if (func.modeloComissaoVendedor === 'PLUS') {
              varsAtuais.motosMarketingLoja = vendasAuto.motosMarketingLoja;
              varsAtuais.motosMarketingProprio = vendasAuto.motosMarketingProprio;
              varsAtuais.motosVendidas =
                vendasAuto.motosMarketingLoja + vendasAuto.motosMarketingProprio;
            } else {
              varsAtuais.motosVendidas = vendasAuto.totalContratos || vendasAuto.motosVendidas;
            }
            varsAtuais.vendasTotalReais = vendasAuto.valorTotalVendido;
            if (vendasAuto.comissaoRetorno > 0) {
              varsAtuais.comissaoRetorno = vendasAuto.comissaoRetorno;
            }
            if (vendasAuto.comissaoMotoParceiro > 0) {
              varsAtuais.comissaoMotoParceiro = vendasAuto.comissaoMotoParceiro;
              varsAtuais.motoParceiroQtd = vendasAuto.motoParceiroQtd;
            }
            if (vendasAuto.comissoesCatalogo?.length > 0 && (!varsAtuais.comissoesDetalhadas || varsAtuais.comissoesDetalhadas.length === 0)) {
              varsAtuais.comissoesDetalhadas = vendasAuto.comissoesCatalogo;
            }
            if (vendasAuto.bonusMeta > 0 && !varsAtuais.bonusMetaBatida && !varsAtuais.bonusMetas) {
              varsAtuais.bonusMetaBatida = vendasAuto.bonusMeta;
              varsAtuais.bonusMetas = vendasAuto.bonusMeta;
            }
          } else if (func.departamento === 'GERENCIA') {
            varsAtuais.motosLojaGerente = vendasAuto.motosLojaGerente;
            if (vendasAuto.bateuMeta) {
              varsAtuais.metaBatida = true;
            }
          } else if (
            (func.departamento === 'MECANICA' || (func.departamento as string) === 'OFICINA') &&
            vendasAuto.motosMontadas > 0
          ) {
            varsAtuais.motosMontadas = vendasAuto.motosMontadas;
          }
        }

        const savedRow = await salvarFolhaFuncionario(func, varsAtuais);
        const resSaved: ResultadoFolhaFuncionario | undefined = savedRow?.breakdown?.resultado;
        if (resSaved) {
          somaBruto += Number(resSaved.totalProventos) || 0;
          somaLiquido += Number(resSaved.salarioLiquido) || 0;
          somaEncargos += (Number(resSaved.fgts) || 0) + (Number(resSaved.inssPatronal) || 0);
        }
        processados += 1;
      }

      // Sincroniza / atualiza `payroll_batches` para que `PayrollAlert` e relatórios reconheçam o lote gerado
      try {
        const { data: u } = await supabase.auth.getUser();
        const { data: existingBatch } = await (supabase as any)
          .from('payroll_batches')
          .select('id')
          .eq('month', referenceMonth)
          .eq('year', referenceYear)
          .maybeSingle();

        if (existingBatch?.id) {
          await (supabase as any)
            .from('payroll_batches')
            .update({
              total_bruto: +somaBruto.toFixed(2),
              total_liquido: +somaLiquido.toFixed(2),
              total_encargos: +somaEncargos.toFixed(2),
              employee_count: ativos.length,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBatch.id);
        } else {
          await (supabase as any)
            .from('payroll_batches')
            .insert({
              month: referenceMonth,
              year: referenceYear,
              status: 'aprovado',
              total_bruto: +somaBruto.toFixed(2),
              total_liquido: +somaLiquido.toFixed(2),
              total_encargos: +somaEncargos.toFixed(2),
              employee_count: ativos.length,
              created_by: u.user?.id,
            });
        }
        qc.invalidateQueries({ queryKey: ['payroll-batches'] });
      } catch {
        // Non-blocking if payroll_batches table policies restrict
      }

      toast({
        title: `Folha de ${mesReferencia} processada!`,
        description: `${processados} colaborador(es) calculado(s) com integração automática ao sistema.`,
      });
    },
    [
      funcionarios,
      folhas,
      refetchVendasMes,
      obterVendasSistemaColaborador,
      salvarFolhaFuncionario,
      referenceMonth,
      referenceYear,
      qc,
      toast,
      mesReferencia,
    ],
  );

  /**
   * Importa / Sincroniza vendedores e gerentes da tabela `profiles` que ainda não estão em `employees`
   */
  const sincronizarEquipeDoSistema = useCallback(async () => {
    if (!perfisSistema || perfisSistema.length === 0) {
      toast({ title: 'Nenhum usuário encontrado no sistema para importar.' });
      return;
    }

    const allEmps = (rawEmployees || []).map(unpackEmployeeFolha);
    let criados = 0;

    for (const p of perfisSistema) {
      if (!p.is_active) continue;
      const jaExiste = allEmps.some(
        (e) =>
          e.profile_id === p.id ||
          (p.email && e.email.toLowerCase() === p.email.toLowerCase()) ||
          e.nome.toLowerCase() === p.full_name.toLowerCase(),
      );
      if (jaExiste) continue;

      const depto = inferirDepartamento(p.role, p.role);
      const isPlus = p.role === 'vendedor_plus' || p.role === 'vendedor_externo';

      const payload = packEmployeeFolhaPayload({
        profile_id: p.id,
        store_id: p.store_id || (selectedStoreId !== 'all' ? selectedStoreId : null),
        nome: p.full_name,
        email: p.email,
        telefone: p.phone,
        cargo:
          p.role === 'gerente'
            ? 'Gerente de Vendas'
            : isPlus
              ? 'Vendedor + (Captação)'
              : p.role === 'admin'
                ? 'Diretor / Gestor'
                : 'Consultor de Vendas',
        role: p.role,
        departamento: depto,
        tipoContrato: 'CLT',
        modeloComissaoVendedor: isPlus ? 'PLUS' : 'PADRAO',
        salarioBase: depto === 'GERENCIA' ? 4500 : 1850,
        cargaHoraria: 220,
        status: 'ATIVO',
      });

      await upsertEmployee.mutateAsync(payload as any);
      criados += 1;
    }

    if (criados > 0) {
      toast({
        title: `${criados} membro(s) da equipe importado(s)!`,
        description: 'Eles já estão vinculados às vendas e contratos do sistema.',
      });
    } else {
      toast({
        title: 'Equipe já sincronizada',
        description: 'Todos os usuários ativos do sistema já estão cadastrados na folha.',
      });
    }
  }, [perfisSistema, rawEmployees, selectedStoreId, upsertEmployee, toast]);

  return {
    empresa,
    salvarEmpresaConfig,
    obterConfigParaLoja,
    configsByStore,
    stores,
    funcionarios,
    folhas,
    vendasMes,
    perfisSistema: perfisSistema || [],
    loading: loadingEmployees || loadingPayslips,
    obterVendasSistemaColaborador,
    salvarFolhaFuncionario,
    processarFolhaMensalCompleta,
    sincronizarEquipeDoSistema,
    upsertEmployee,
    upsertPayslip,
  };
}
