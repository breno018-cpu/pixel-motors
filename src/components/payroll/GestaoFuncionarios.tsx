import React, { useState, useMemo, useEffect } from 'react';
import {
  UserPlus,
  Edit,
  Trash2,
  AlertCircle,
  Link2,
  Store,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  PauseCircle,
  UserX,
  PlayCircle,
  Clock,
  ShieldAlert,
  Sliders,
  Briefcase,
  FileText,
} from 'lucide-react';
import { TerminationModal } from './TerminationModal';
import {
  FuncionarioConcessionaria,
  inferirCargoId,
  packEmployeeFolhaPayload,
} from '@/hooks/useFolhaConcessionaria';
import {
  DEFAULT_EMPRESA_FOLHA_CONFIG,
  DEFAULT_REGRAS_POR_CARGO,
  EmpresaFolhaConfig,
  RegraComissaoCargo,
} from '@/lib/folhaCalculos';
import { useUpsertEmployee, useDeleteEmployee } from '@/hooks/useEmployees';
import { maskCPFCNPJ, maskPhone, validateCPFCNPJ } from '@/lib/masks';
import { CARGOS_CONCESSIONARIA, CargoStatus, getCargoStatusOption } from '@/lib/payrollRoles';
import { PanelCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface GestaoFuncionariosProps {
  funcionarios: FuncionarioConcessionaria[];
  folhas?: any[];
  stores: Array<{ id: string; name: string; is_active?: boolean }>;
  perfisSistema: Array<{
    id: string;
    full_name: string;
    email: string;
    phone: string;
    store_id: string | null;
    role: string;
  }>;
  onSincronizarEquipe: () => Promise<void>;
  empresa?: EmpresaFolhaConfig;
  obterConfigParaLoja?: (storeId?: string | null) => EmpresaFolhaConfig;
  onAbrirConfigCargos?: () => void;
  cargoInicialParaCadastro?: string | null;
  onLimparCargoInicial?: () => void;
}

const DEPARTAMENTOS_CONCESSIONARIA: Array<{
  value: 'VENDAS' | 'MECANICA' | 'ADMINISTRATIVO' | 'GERENCIA' | 'LOGISTICA';
  label: string;
}> = [
  { value: 'VENDAS', label: 'Vendas & Comercial' },
  { value: 'MECANICA', label: 'Oficina & Pós-Venda' },
  { value: 'LOGISTICA', label: 'Logística & Transporte de Frotas' },
  { value: 'GERENCIA', label: 'Gerência & Diretoria' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo & F&I' },
];

export default function GestaoFuncionarios({
  funcionarios,
  folhas = [],
  stores,
  perfisSistema,
  onSincronizarEquipe,
  empresa,
  obterConfigParaLoja,
  onAbrirConfigCargos,
  cargoInicialParaCadastro,
  onLimparCargoInicial,
}: GestaoFuncionariosProps) {
  const upsertEmployee = useUpsertEmployee();
  const deleteEmployee = useDeleteEmployee();

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoFunc, setEditandoFunc] = useState<FuncionarioConcessionaria | null>(null);
  const [terminationModalOpen, setTerminationModalOpen] = useState(false);
  const [employeeForTermination, setEmployeeForTermination] = useState<FuncionarioConcessionaria | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [exibirMatrizCargos, setExibirMatrizCargos] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | CargoStatus>('TODOS');
  const [filtroSetorModal, setFiltroSetorModal] = useState<
    'TODOS' | 'VENDAS' | 'MECANICA' | 'GERENCIA' | 'ADMINISTRATIVO' | 'LOGISTICA' | 'TERCEIRIZADO'
  >('TODOS');

  const obterMapaCargosDaLoja = (storeId?: string | null): Record<string, RegraComissaoCargo> => {
    const cfg =
      storeId && obterConfigParaLoja
        ? obterConfigParaLoja(storeId)
        : empresa || DEFAULT_EMPRESA_FOLHA_CONFIG;
    return {
      ...DEFAULT_REGRAS_POR_CARGO,
      ...(cfg.regrasPorCargo || {}),
    };
  };

  const defaultStoreId = stores[0]?.id || '';
  const defaultCargoRegra =
    obterMapaCargosDaLoja(defaultStoreId).vendedor || DEFAULT_REGRAS_POR_CARGO.vendedor;

  const initialForm = {
    profile_id: '' as string,
    store_id: defaultStoreId,
    nome: '',
    cpf: '',
    telefone: '',
    email: '',
    cargoId: defaultCargoRegra.id,
    cargo: defaultCargoRegra.titulo,
    departamento: defaultCargoRegra.departamento as
      | 'VENDAS'
      | 'MECANICA'
      | 'ADMINISTRATIVO'
      | 'GERENCIA',
    salarioBase: defaultCargoRegra.salarioBasePadrao,
    cargaHoraria: defaultCargoRegra.cargaHorariaPadrao || 220,
    dataAdmissao: new Date().toISOString().split('T')[0],
    dependentes: 0,
    tipoContrato: defaultCargoRegra.tipoContrato as
      | 'CLT'
      | 'TERCEIRIZADO'
      | 'PJ'
      | 'ESTAGIO'
      | 'APRENDIZ',
    razaoSocialPrestador: '',
    cnpjPrestador: '',
    modeloComissaoVendedor: defaultCargoRegra.modeloComissao as
      | 'PADRAO'
      | 'PLUS'
      | 'PERCENTUAL',
    commissionRate: defaultCargoRegra.aliquotaPercentualVendas || 0,
    descontarINSS: defaultCargoRegra.descontarINSSPadrao,
    descontarIRRF: defaultCargoRegra.descontarIRRFPadrao,
    calcularFGTS: defaultCargoRegra.calcularFGTSPadrao,
    pagarDSRComissao: defaultCargoRegra.pagarDSRComissaoPadrao,
    grauInsalubridade: defaultCargoRegra.grauInsalubridadePadrao as
      | 'NENHUM'
      | 'MINIMO'
      | 'MEDIO'
      | 'MAXIMO',
    temPericulosidade: defaultCargoRegra.periculosidadePadrao,
    optanteVT: true,
    custoPassagemMensal: 0,
    descontoValeRefeicao: 0,
    descontoPlanoSaude: 0,
    chavePix: '',
    banco: '',
    agencia: '',
    conta: '',
    status: 'ATIVO' as CargoStatus,
    motivoStatus: '',
    dataStatus: '',
    dataRetornoPrevista: '',
    avisoPrevio: 'INDENIZADO' as 'INDENIZADO' | 'TRABALHADO' | 'DISPENSADO',
  };

  const [formData, setFormData] = useState(initialForm);

  const mapaCargosLojaAtual = useMemo(
    () => obterMapaCargosDaLoja(formData.store_id),
    [formData.store_id, empresa, obterConfigParaLoja],
  );

  const regraCargoSelecionado: RegraComissaoCargo =
    mapaCargosLojaAtual[formData.cargoId] ||
    DEFAULT_REGRAS_POR_CARGO[formData.cargoId] ||
    mapaCargosLojaAtual.vendedor ||
    DEFAULT_REGRAS_POR_CARGO.vendedor;

  const selecionarCargoNoFormulario = (cargoId: string, storeIdContext?: string) => {
    const mapa = obterMapaCargosDaLoja(storeIdContext ?? formData.store_id);
    const regra =
      mapa[cargoId] || DEFAULT_REGRAS_POR_CARGO[cargoId] || DEFAULT_REGRAS_POR_CARGO.vendedor;
    const isTerceiro = regra.tipoContrato === 'TERCEIRIZADO';

    setFormData((prev) => ({
      ...prev,
      cargoId: regra.id,
      cargo: regra.titulo,
      departamento: regra.departamento,
      tipoContrato: regra.tipoContrato,
      salarioBase: Number(regra.salarioBasePadrao) || 0,
      cargaHoraria: Number(regra.cargaHorariaPadrao) || (isTerceiro ? 0 : 220),
      modeloComissaoVendedor: regra.modeloComissao,
      commissionRate: Number(regra.aliquotaPercentualVendas) || 0,
      grauInsalubridade: regra.grauInsalubridadePadrao,
      temPericulosidade: Boolean(regra.periculosidadePadrao),
      descontarINSS: Boolean(regra.descontarINSSPadrao),
      descontarIRRF: Boolean(regra.descontarIRRFPadrao),
      calcularFGTS: Boolean(regra.calcularFGTSPadrao),
      pagarDSRComissao: Boolean(regra.pagarDSRComissaoPadrao),
      optanteVT: isTerceiro ? false : prev.optanteVT,
    }));
  };

  useEffect(() => {
    if (cargoInicialParaCadastro) {
      setEditandoFunc(null);
      setErroSalvar(null);
      setFiltroSetorModal('TODOS');
      setFormData(initialForm);
      selecionarCargoNoFormulario(cargoInicialParaCadastro, defaultStoreId);
      setModalAberto(true);
      onLimparCargoInicial?.();
    }
  }, [cargoInicialParaCadastro]);

  // Ação Rápida de Alteração de Situação / Cargo do Colaborador
  const handleAlterarStatusRapido = async (f: FuncionarioConcessionaria, novoStatus: CargoStatus) => {
    try {
      const payload = packEmployeeFolhaPayload(
        {
          ...f,
          status: novoStatus,
          dataStatus: new Date().toISOString().split('T')[0],
        },
        f.regularAdditions || []
      );
      await upsertEmployee.mutateAsync(payload);
    } catch (e: any) {
      alert('Erro ao alterar status: ' + (e?.message || 'Falha na conexão'));
    }
  };

  // Contadores de Status
  const contadores = useMemo(() => {
    return {
      total: funcionarios.length,
      ativos: funcionarios.filter((f) => f.status === 'ATIVO').length,
      pausas: funcionarios.filter((f) => f.status === 'PAUSA_ADMINISTRATIVA').length,
      demitidos: funcionarios.filter((f) => f.status === 'DEMITIDO').length,
      suspensos: funcionarios.filter((f) => f.status === 'SUSPENSO').length,
      outros: funcionarios.filter(
        (f) =>
          f.status === 'AFASTADO_LICENCA' ||
          f.status === 'AVISO_PREVIO' ||
          f.status === 'INATIVO'
      ).length,
    };
  }, [funcionarios]);

  // Lista Filtrada
  const funcionariosFiltrados = useMemo(() => {
    if (filtroStatus === 'TODOS') return funcionarios;
    return funcionarios.filter((f) => f.status === filtroStatus);
  }, [funcionarios, filtroStatus]);

  const abrirCriacao = () => {
    setEditandoFunc(null);
    setErroSalvar(null);
    setFiltroSetorModal('TODOS');
    setFormData(initialForm);
    selecionarCargoNoFormulario('vendedor', defaultStoreId);
    setModalAberto(true);
  };

  const abrirEdicao = (f: FuncionarioConcessionaria) => {
    setEditandoFunc(f);
    setErroSalvar(null);
    setFiltroSetorModal('TODOS');
    const resolvedCargoId =
      f.cargoId ||
      inferirCargoId({
        cargo: f.cargo,
        role: f.role,
        departamento: f.departamento,
        tipoContrato: f.tipoContrato,
        modeloComissaoVendedor: f.modeloComissaoVendedor,
      });

    setFormData({
      profile_id: f.profile_id || '',
      store_id: f.store_id || '',
      nome: f.nome || '',
      cpf: f.cpf || '',
      telefone: f.telefone || '',
      email: f.email || '',
      cargoId: resolvedCargoId,
      cargo: f.cargo || '',
      departamento: f.departamento || 'VENDAS',
      salarioBase: Number(f.salarioBase) || 0,
      cargaHoraria: Number(f.cargaHoraria) || 220,
      dataAdmissao: f.dataAdmissao || new Date().toISOString().split('T')[0],
      dependentes: Number(f.dependentes) || 0,
      tipoContrato: f.tipoContrato || 'CLT',
      razaoSocialPrestador: f.razaoSocialPrestador || '',
      cnpjPrestador: f.cnpjPrestador || '',
      modeloComissaoVendedor: f.modeloComissaoVendedor || 'PADRAO',
      commissionRate: Number(f.commissionRate) || 0,
      descontarINSS: Number(f.descontarINSS) === 1,
      descontarIRRF: Number(f.descontarIRRF) === 1,
      calcularFGTS: Number(f.calcularFGTS) === 1,
      pagarDSRComissao: Number(f.pagarDSRComissao) === 1,
      grauInsalubridade: f.grauInsalubridade || 'NENHUM',
      temPericulosidade: Boolean(f.temPericulosidade),
      optanteVT: Boolean(f.optanteVT),
      custoPassagemMensal: Number(f.custoPassagemMensal) || 0,
      descontoValeRefeicao: Number(f.descontoValeRefeicao) || 0,
      descontoPlanoSaude: Number(f.descontoPlanoSaude) || 0,
      chavePix: f.chavePix || '',
      banco: f.banco || '',
      agencia: f.agencia || '',
      conta: f.conta || '',
      status: (f.status || 'ATIVO') as CargoStatus,
      motivoStatus: f.motivoStatus || '',
      dataStatus: f.dataStatus || '',
      dataRetornoPrevista: f.dataRetornoPrevista || '',
      avisoPrevio: (f.avisoPrevio || 'INDENIZADO') as 'INDENIZADO' | 'TRABALHADO' | 'DISPENSADO',
    });
    setModalAberto(true);
  };

  const handleSelectPerfilSistema = (profileId: string) => {
    const p = perfisSistema.find((x) => x.id === profileId);
    if (!p) {
      setFormData({ ...formData, profile_id: '' });
      return;
    }
    const cargoIdDoPerfil = inferirCargoId({ role: p.role, cargo: p.role });
    const targetStoreId = p.store_id || formData.store_id;
    const mapa = obterMapaCargosDaLoja(targetStoreId);
    const regra =
      mapa[cargoIdDoPerfil] ||
      DEFAULT_REGRAS_POR_CARGO[cargoIdDoPerfil] ||
      DEFAULT_REGRAS_POR_CARGO.vendedor;

    setFormData((prev) => ({
      ...prev,
      profile_id: p.id,
      nome: prev.nome || p.full_name,
      email: prev.email || p.email,
      telefone: prev.telefone || p.phone,
      store_id: targetStoreId,
      cargoId: regra.id,
      cargo: regra.titulo,
      departamento: regra.departamento,
      tipoContrato: regra.tipoContrato,
      salarioBase: Number(regra.salarioBasePadrao) || prev.salarioBase,
      modeloComissaoVendedor: regra.modeloComissao,
      commissionRate: Number(regra.aliquotaPercentualVendas) || 0,
      grauInsalubridade: regra.grauInsalubridadePadrao,
      temPericulosidade: Boolean(regra.periculosidadePadrao),
    }));
  };

  const salvarFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroSalvar(null);

    if (formData.cpf && formData.cpf.replace(/\D/g, '').length > 0 && !validateCPFCNPJ(formData.cpf)) {
      setErroSalvar('O CPF/CNPJ informado não é válido.');
      return;
    }
    if (
      formData.cnpjPrestador &&
      formData.cnpjPrestador.replace(/\D/g, '').length > 0 &&
      !validateCPFCNPJ(formData.cnpjPrestador)
    ) {
      setErroSalvar('O CNPJ do Prestador informado não é válido.');
      return;
    }

    setSalvando(true);

    try {
      const payload = packEmployeeFolhaPayload(
        {
          ...(editandoFunc ? { id: editandoFunc.id } : {}),
          profile_id: formData.profile_id || null,
          store_id: formData.store_id || null,
          nome: formData.nome,
          cpf: formData.cpf,
          telefone: formData.telefone,
          email: formData.email,
          cargoId: formData.cargoId,
          role: formData.cargoId,
          cargo: formData.cargo,
          departamento: formData.departamento,
          salarioBase: Number(formData.salarioBase) || 0,
          cargaHoraria: Number(formData.cargaHoraria) || 220,
          dataAdmissao: formData.dataAdmissao,
          dependentes: Number(formData.dependentes) || 0,
          tipoContrato: formData.tipoContrato,
          razaoSocialPrestador: formData.razaoSocialPrestador,
          cnpjPrestador: formData.cnpjPrestador,
          modeloComissaoVendedor: formData.modeloComissaoVendedor,
          commissionRate:
            formData.modeloComissaoVendedor === 'PERCENTUAL'
              ? Number(formData.commissionRate) || 0
              : 0,
          descontarINSS:
            formData.tipoContrato === 'TERCEIRIZADO' ? 0 : formData.descontarINSS ? 1 : 0,
          descontarIRRF:
            formData.tipoContrato === 'TERCEIRIZADO' ? 0 : formData.descontarIRRF ? 1 : 0,
          calcularFGTS:
            formData.tipoContrato === 'TERCEIRIZADO' ? 0 : formData.calcularFGTS ? 1 : 0,
          pagarDSRComissao: formData.pagarDSRComissao ? 1 : 0,
          grauInsalubridade: formData.grauInsalubridade,
          temPericulosidade: formData.temPericulosidade ? 1 : 0,
          optanteVT: formData.optanteVT ? 1 : 0,
          custoPassagemMensal: Number(formData.custoPassagemMensal) || 0,
          descontoValeRefeicao: Number(formData.descontoValeRefeicao) || 0,
          descontoPlanoSaude: Number(formData.descontoPlanoSaude) || 0,
          chavePix: formData.chavePix,
          banco: formData.banco,
          agencia: formData.agencia,
          conta: formData.conta,
          status: formData.status,
          motivoStatus: formData.motivoStatus,
          dataStatus: formData.dataStatus,
          dataRetornoPrevista: formData.dataRetornoPrevista,
          avisoPrevio: formData.avisoPrevio,
        },
        editandoFunc?.regularAdditions || [],
      );

      await upsertEmployee.mutateAsync(payload as any);
      setModalAberto(false);
    } catch (err: any) {
      setErroSalvar(err?.message || 'Erro ao salvar colaborador.');
    } finally {
      setSalvando(false);
    }
  };

  const excluirFuncionario = async (id: string) => {
    if (!window.confirm('Deseja realmente remover este colaborador?')) return;
    await deleteEmployee.mutateAsync(id);
  };

  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      await onSincronizarEquipe();
    } finally {
      setSincronizando(false);
    }
  };

  const formatarMoeda = (v?: number) =>
    (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const cargosDisponiveisModal = useMemo(() => {
    return Object.values(mapaCargosLojaAtual).filter((c) => {
      if (c.ativo === false) return false;
      if (filtroSetorModal === 'TERCEIRIZADO') {
        return c.tipoContrato === 'TERCEIRIZADO';
      }
      if (filtroSetorModal !== 'TODOS') {
        return c.departamento === filtroSetorModal;
      }
      return true;
    });
  }, [mapaCargosLojaAtual, filtroSetorModal]);

  return (
    <div className="space-y-5">
      <PanelCard
        title="Quadro de Colaboradores"
        description="Gerencie vendedores, mecânicos, gerentes e prestadores vinculados às unidades"
        aside={
          <div className="flex flex-wrap items-center gap-2">
            {onAbrirConfigCargos && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-xs border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100"
                onClick={onAbrirConfigCargos}
              >
                <Sliders className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                Configurar comissões por cargo
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => setExibirMatrizCargos(!exibirMatrizCargos)}
            >
              <ClipboardCheck className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
              {exibirMatrizCargos ? 'Ocultar matriz de cargos' : 'Matriz de cargos'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={handleSincronizar}
              disabled={sincronizando}
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', sincronizando && 'animate-spin')} />
              {sincronizando ? 'Sincronizando...' : 'Importar usuários'}
            </Button>

            <Button type="button" size="sm" className="h-9 text-xs" onClick={abrirCriacao}>
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              Novo colaborador
            </Button>
          </div>
        }
      >
        {exibirMatrizCargos && (
          <div className="border-b border-border/60 bg-muted/20 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Matriz de Atribuições e Responsabilidades por Cargo
                </h3>
                <p className="text-xs text-muted-foreground">
                  Permissões operacionais, entregas obrigatórias e política salarial de cada função
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setExibirMatrizCargos(false)}
              >
                Fechar
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {CARGOS_CONCESSIONARIA.map((cargo) => (
                <div
                  key={cargo.id}
                  className="rounded-xl border border-border/70 bg-card p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {cargo.departamento} • {cargo.tipoContrato}
                      </span>
                      <h4 className="text-sm font-semibold text-foreground mt-0.5">
                        {cargo.titulo}
                      </h4>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Base: {formatarMoeda(cargo.salarioBaseSugerido)}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2 border border-border/60">
                    <strong className="text-foreground">Remuneração:</strong>{' '}
                    {cargo.resumoRemuneracao}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                        Permissões (Pode fazer)
                      </div>
                      <ul className="space-y-1 text-[11px] text-muted-foreground list-disc pl-4">
                        {cargo.podeFazer.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                        <ClipboardCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                        Obrigações (Precisa fazer)
                      </div>
                      <ul className="space-y-1 text-[11px] text-muted-foreground list-disc pl-4">
                        {cargo.precisaFazer.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {funcionarios.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              Nenhum colaborador cadastrado até o momento.
            </p>
            <div className="flex justify-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleSincronizar}>
                Importar do sistema
              </Button>
              <Button type="button" size="sm" onClick={abrirCriacao}>
                Cadastrar manualmente
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* BARRA DE FILTROS POR SITUAÇÃO OPERACIONAL */}
            <div className="flex flex-wrap items-center gap-1.5 p-3 border-b bg-muted/20 text-xs">
              <Button
                type="button"
                size="sm"
                variant={filtroStatus === 'TODOS' ? 'secondary' : 'ghost'}
                className="h-7 text-xs rounded-lg font-bold"
                onClick={() => setFiltroStatus('TODOS')}
              >
                Todos ({contadores.total})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filtroStatus === 'ATIVO' ? 'secondary' : 'ghost'}
                className="h-7 text-xs rounded-lg font-bold text-emerald-600 dark:text-emerald-400"
                onClick={() => setFiltroStatus('ATIVO')}
              >
                Ativos ({contadores.ativos})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filtroStatus === 'PAUSA_ADMINISTRATIVA' ? 'secondary' : 'ghost'}
                className="h-7 text-xs rounded-lg font-bold text-amber-600 dark:text-amber-400"
                onClick={() => setFiltroStatus('PAUSA_ADMINISTRATIVA')}
              >
                Pausa Administrativa ({contadores.pausas})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filtroStatus === 'DEMITIDO' ? 'secondary' : 'ghost'}
                className="h-7 text-xs rounded-lg font-bold text-rose-600 dark:text-rose-400"
                onClick={() => setFiltroStatus('DEMITIDO')}
              >
                Demitidos / Rescisão ({contadores.demitidos})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filtroStatus === 'SUSPENSO' ? 'secondary' : 'ghost'}
                className="h-7 text-xs rounded-lg font-bold text-purple-600 dark:text-purple-400"
                onClick={() => setFiltroStatus('SUSPENSO')}
              >
                Suspensos ({contadores.suspensos})
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Função & Unidade</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Salário Base</TableHead>
                  <TableHead className="text-center">Encargos</TableHead>
                  <TableHead>Adicionais & Benefícios</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funcionariosFiltrados.map((f) => {
                  const cobraINSS = Number(f.descontarINSS) === 1;
                  const cobraIRRF = Number(f.descontarIRRF) === 1;
                  const cobraFGTS = Number(f.calcularFGTS) === 1;
                  const cobraDSR = Number(f.pagarDSRComissao) === 1;
                  const statusOpt = getCargoStatusOption(f.status);

                  return (
                    <TableRow key={f.id} className={cn(
                      f.status === 'PAUSA_ADMINISTRATIVA' && 'bg-amber-500/5',
                      f.status === 'DEMITIDO' && 'bg-rose-500/5 opacity-80'
                    )}>
                      <TableCell>
                        <div className="font-medium text-xs text-foreground flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold">{f.nome}</span>
                          {f.profile_id && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                              <Link2 className="w-2.5 h-2.5 mr-1" />
                              Vinculado
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          CPF: {f.cpf || 'Não informado'}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium text-xs text-foreground flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold">{f.cargo}</span>
                          {f.tipoContrato === 'TERCEIRIZADO' && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Terceirizado
                            </Badge>
                          )}
                          {(f.modeloComissaoVendedor === 'PLUS' || (f.cargo || '').includes('+')) &&
                            f.tipoContrato !== 'TERCEIRIZADO' && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                Vendedor +
                              </Badge>
                            )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span>{f.departamento}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Store className="w-3 h-3" /> {f.storeName}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] px-2 py-0.5 font-bold gap-1', statusOpt.badgeClass)}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full', statusOpt.dotColor)} />
                          {statusOpt.label}
                        </Badge>
                        {f.dataStatus && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Desde {f.dataStatus}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {formatarMoeda(f.salarioBase)}
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center flex-wrap">
                          {[
                            { label: 'INSS', active: cobraINSS },
                            { label: 'IRRF', active: cobraIRRF },
                            { label: 'FGTS', active: cobraFGTS },
                            { label: 'DSR', active: cobraDSR },
                          ].map((tag) => (
                            <span
                              key={tag.label}
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-medium border',
                                tag.active
                                  ? 'bg-muted/50 text-foreground border-border'
                                  : 'text-muted-foreground/50 border-border/40 line-through',
                              )}
                            >
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {f.grauInsalubridade && f.grauInsalubridade !== 'NENHUM' && (
                            <Badge variant="outline" className="text-[10px] py-0 font-normal">
                              Insal. {f.grauInsalubridade}
                            </Badge>
                          )}
                          {f.temPericulosidade ? (
                            <Badge variant="outline" className="text-[10px] py-0 font-normal">
                              Peric. 30%
                            </Badge>
                          ) : null}
                          {f.optanteVT ? (
                            <Badge variant="outline" className="text-[10px] py-0 font-normal">
                              VT
                            </Badge>
                          ) : null}
                          {f.descontoValeRefeicao > 0 ? (
                            <Badge variant="outline" className="text-[10px] py-0 font-normal">
                              VR
                            </Badge>
                          ) : null}
                          {f.descontoPlanoSaude > 0 ? (
                            <Badge variant="outline" className="text-[10px] py-0 font-normal">
                              Saúde
                            </Badge>
                          ) : null}
                          {(!f.grauInsalubridade || f.grauInsalubridade === 'NENHUM') &&
                            !f.temPericulosidade &&
                            !f.optanteVT &&
                            !f.descontoValeRefeicao &&
                            !f.descontoPlanoSaude && (
                              <span className="text-muted-foreground">—</span>
                            )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          {f.status === 'ATIVO' ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[10px] gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-bold rounded-lg"
                                onClick={() => handleAlterarStatusRapido(f, 'PAUSA_ADMINISTRATIVA')}
                                title="Pausar acessos temporariamente para auditoria"
                              >
                                <PauseCircle className="w-3 h-3" />
                                Pausa
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[10px] gap-1 border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 font-bold rounded-lg"
                                onClick={() => {
                                  setEmployeeForTermination(f);
                                  setTerminationModalOpen(true);
                                }}
                                title="Sistema Completo de Demissão: Cálculo Automático, TRCT, Última Folha e Bloqueio de Credenciais"
                              >
                                <UserX className="w-3 h-3" />
                                Demitir
                              </Button>
                            </>
                          ) : (
                            <>
                              {f.status === 'DEMITIDO' && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[10px] gap-1 border-slate-500/30 text-foreground hover:bg-muted font-bold rounded-lg"
                                  onClick={() => {
                                    setEmployeeForTermination(f);
                                    setTerminationModalOpen(true);
                                  }}
                                  title="Ver / Baixar Termo TRCT e Última Folha Rescisória"
                                >
                                  <FileText className="w-3 h-3 text-primary" />
                                  TRCT
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[10px] gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold rounded-lg"
                                onClick={() => handleAlterarStatusRapido(f, 'ATIVO')}
                                title="Reativar colaborador para Ativo"
                              >
                                <PlayCircle className="w-3 h-3" />
                                Reativar
                              </Button>
                            </>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => abrirEdicao(f)}
                            title="Editar Dados Completos"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => excluirFuncionario(f.id)}
                            title="Excluir Colaborador"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </PanelCard>

      {/* Modal de Cadastro / Edição */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border p-0 gap-0">
          <DialogHeader className="sticky top-0 z-20 bg-card/95 backdrop-blur px-6 py-4 border-b border-border/70">
            <DialogTitle className="font-display text-base font-semibold">
              {editandoFunc ? 'Editar Colaborador' : 'Cadastrar Colaborador'}
            </DialogTitle>
          </DialogHeader>

          {erroSalvar && (
            <div className="mx-6 mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{erroSalvar}</span>
            </div>
          )}

          <form onSubmit={salvarFuncionario} className="px-6 py-5 space-y-5">
            {/* Vínculo Sistema e Unidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Vincular ao Usuário do Sistema</Label>
                <select
                  value={formData.profile_id}
                  onChange={(e) => handleSelectPerfilSistema(e.target.value)}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="">Sem vínculo direto</option>
                  {perfisSistema.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">Unidade / Loja</Label>
                <select
                  value={formData.store_id}
                  onChange={(e) => {
                    const novaLoja = e.target.value;
                    setFormData((prev) => ({ ...prev, store_id: novaLoja }));
                  }}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="">Matriz / Geral</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border/60 pt-4">
              <div>
                <Label className="text-xs">Nome Completo *</Label>
                <Input
                  required
                  placeholder="Nome completo"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="h-9 text-xs mt-1 bg-background"
                />
              </div>
              <div>
                <Label className="text-xs">CPF</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  onChange={(e) =>
                    setFormData({ ...formData, cpf: maskCPFCNPJ(e.target.value) })
                  }
                  className="h-9 text-xs mt-1 bg-background"
                />
              </div>
            </div>

            {/* NOVO SISTEMA DE PREENCHIMENTO DE CARGO (UNIFICADO, DETERMINÍSTICO E SEM BUGS) */}
            <div className="space-y-3 border-t border-border/60 pt-4">
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>1. Escolha o Cargo na Concessionária</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Ao clicar em um cargo, o sistema preenche automaticamente departamento, vínculo, salário base e regra de comissão da unidade.
                    </p>
                  </div>

                  {onAbrirConfigCargos && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setModalAberto(false);
                        onAbrirConfigCargos();
                      }}
                      className="h-7 text-[11px] border-indigo-300 text-indigo-700 bg-white hover:bg-indigo-50 shrink-0"
                    >
                      <Sliders className="w-3 h-3 mr-1" />
                      Configurar Comissões dos Cargos
                    </Button>
                  )}
                </div>

                {/* Abas de filtro de setor dentro do seletor de cargo */}
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: 'TODOS', label: 'Todos' },
                    { id: 'VENDAS', label: 'Vendas' },
                    { id: 'MECANICA', label: 'Oficina' },
                    { id: 'LOGISTICA', label: 'Logística' },
                    { id: 'GERENCIA', label: 'Gerência' },
                    { id: 'ADMINISTRATIVO', label: 'Admin / F&I' },
                    { id: 'TERCEIRIZADO', label: 'Terceirizados / PJ' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFiltroSetorModal(tab.id as any)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all',
                        filtroSetorModal === tab.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-background text-muted-foreground border border-border/60 hover:text-foreground',
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Grade de Cartões de Cargo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                  {cargosDisponiveisModal.map((c) => {
                    const ativo = formData.cargoId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selecionarCargoNoFormulario(c.id)}
                        className={cn(
                          'p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5',
                          ativo
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300 dark:ring-indigo-800'
                            : 'bg-background text-foreground border-border/80 hover:border-indigo-400',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 w-full">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={cn(
                                  'text-[9px] font-black uppercase px-1.5 py-0.5 rounded',
                                  ativo
                                    ? 'bg-white/20 text-white'
                                    : 'bg-muted text-muted-foreground',
                                )}
                              >
                                {c.departamento}
                              </span>
                              <span
                                className={cn(
                                  'text-[9px] font-black uppercase px-1.5 py-0.5 rounded',
                                  ativo
                                    ? 'bg-indigo-900/40 text-indigo-100'
                                    : c.tipoContrato === 'TERCEIRIZADO'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-blue-50 text-blue-700',
                                )}
                              >
                                {c.tipoContrato === 'TERCEIRIZADO' ? 'PJ / Terceiro' : 'CLT'}
                              </span>
                            </div>
                            <div className="text-xs font-bold mt-1 leading-tight">
                              {c.titulo}
                            </div>
                          </div>
                          {ativo && <CheckCircle2 className="w-4 h-4 text-white shrink-0" />}
                        </div>

                        <div
                          className={cn(
                            'flex items-center justify-between text-[10px] pt-1.5 border-t w-full font-semibold',
                            ativo
                              ? 'border-indigo-400/40 text-indigo-100'
                              : 'border-border/60 text-muted-foreground',
                          )}
                        >
                          <span>Base: {formatarMoeda(c.salarioBasePadrao)}</span>
                          <span>
                            {c.departamento === 'VENDAS' && c.modeloComissao === 'PLUS' && (
                              <>+ {formatarMoeda(c.valorMarketingProprioPorMoto)}/própria</>
                            )}
                            {c.departamento === 'VENDAS' && c.modeloComissao === 'PADRAO' && (
                              <>{c.faixasMotos?.length || 0} faixas loja</>
                            )}
                            {c.departamento === 'MECANICA' && (
                              <>
                                {formatarMoeda(c.valorPorMotoMontada)}/mont •{' '}
                                {formatarMoeda(c.valorPorRevisaoExecutada)}/rev
                              </>
                            )}
                            {c.departamento === 'GERENCIA' && (
                              <>{formatarMoeda(c.valorPorMotoVendidaLojaGerente)}/moto loja</>
                            )}
                            {c.departamento === 'ADMINISTRATIVO' && (
                              <>F&I {formatarMoeda(c.comissaoRetornoPadrao)}</>
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Resumo da Regra de Comissão do Cargo Selecionado */}
                <div className="rounded-xl bg-background border border-indigo-200/80 dark:border-indigo-900/50 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-600 text-white text-[10px]">
                        Cargo Ativo: {regraCargoSelecionado.titulo}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {regraCargoSelecionado.descricaoCurta}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold">
                      Salário Padrão: <strong>{formatarMoeda(regraCargoSelecionado.salarioBasePadrao)}</strong>
                    </span>
                    {regraCargoSelecionado.faixasMotos?.length > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                        Faixas Motos:{' '}
                        {regraCargoSelecionado.faixasMotos
                          .map((f) => `${f.de}-${f.ate}: R$${f.valorPorMoto}`)
                          .join(' | ')}
                      </span>
                    )}
                    {regraCargoSelecionado.valorMarketingProprioPorMoto > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold">
                        Captação Própria: {formatarMoeda(regraCargoSelecionado.valorMarketingProprioPorMoto)}/moto
                      </span>
                    )}
                    {(regraCargoSelecionado.valorPorMotoMontada > 0 ||
                      regraCargoSelecionado.valorPorRevisaoExecutada > 0) && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                        Oficina: {formatarMoeda(regraCargoSelecionado.valorPorMotoMontada)}/montagem •{' '}
                        {formatarMoeda(regraCargoSelecionado.valorPorRevisaoExecutada)}/revisão
                      </span>
                    )}
                    {regraCargoSelecionado.valorPorMotoVendidaLojaGerente > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
                        Volume Loja: {formatarMoeda(regraCargoSelecionado.valorPorMotoVendidaLojaGerente)}/moto
                      </span>
                    )}
                    {regraCargoSelecionado.bonusMetaAtingida > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                        Bônus Meta: {formatarMoeda(regraCargoSelecionado.bonusMetaAtingida)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Campos Editáveis de Ajuste Fino do Cargo (Título no Holerite e Setor) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label className="text-xs font-semibold">
                      Título do Cargo Impresso no Holerite *
                    </Label>
                    <Input
                      required
                      placeholder="Ex: Consultor de Vendas de Motos"
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                      className="h-9 text-xs mt-1 bg-background font-semibold"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Setor / Departamento</Label>
                    <select
                      value={formData.departamento}
                      onChange={(e) =>
                        setFormData({ ...formData, departamento: e.target.value as any })
                      }
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold"
                    >
                      {DEPARTAMENTOS_CONCESSIONARIA.map((dep) => (
                        <option key={dep.value} value={dep.value}>
                          {dep.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Regime de Contratação e Remuneração Base */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 border-t border-border/60 pt-4">
              <div>
                <Label className="text-xs">Vínculo</Label>
                <select
                  value={formData.tipoContrato}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    const isTerc = val === 'TERCEIRIZADO';
                    setFormData({
                      ...formData,
                      tipoContrato: val,
                      descontarINSS: !isTerc,
                      descontarIRRF: !isTerc,
                      calcularFGTS: !isTerc,
                      optanteVT: !isTerc ? formData.optanteVT : false,
                    });
                  }}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs"
                >
                  <option value="CLT">CLT</option>
                  <option value="TERCEIRIZADO">Terceirizado / PJ</option>
                </select>
              </div>

              <div>
                <Label className="text-xs">
                  {formData.tipoContrato === 'TERCEIRIZADO' ? 'Valor Mensal (R$)' : 'Salário Base (R$)'}
                </Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  value={formData.salarioBase}
                  onChange={(e) =>
                    setFormData({ ...formData, salarioBase: Number(e.target.value) })
                  }
                  className="h-9 text-xs mt-1 bg-background font-bold"
                />
              </div>

              <div>
                <Label className="text-xs">Admissão</Label>
                <Input
                  type="date"
                  value={formData.dataAdmissao}
                  onChange={(e) => setFormData({ ...formData, dataAdmissao: e.target.value })}
                  className="h-9 text-xs mt-1 bg-background"
                />
              </div>

              <div>
                <Label className="text-xs">Dependentes IRRF</Label>
                <Input
                  type="number"
                  disabled={formData.tipoContrato === 'TERCEIRIZADO'}
                  value={formData.tipoContrato === 'TERCEIRIZADO' ? 0 : formData.dependentes}
                  onChange={(e) =>
                    setFormData({ ...formData, dependentes: Number(e.target.value) })
                  }
                  className="h-9 text-xs mt-1 bg-background"
                />
              </div>
            </div>

            {formData.tipoContrato === 'TERCEIRIZADO' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Razão Social Prestadora</Label>
                  <Input
                    placeholder="Opcional"
                    value={formData.razaoSocialPrestador}
                    onChange={(e) =>
                      setFormData({ ...formData, razaoSocialPrestador: e.target.value })
                    }
                    className="h-9 text-xs mt-1 bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs">CNPJ Prestador</Label>
                  <Input
                    placeholder="Opcional"
                    value={formData.cnpjPrestador}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        cnpjPrestador: maskCPFCNPJ(e.target.value),
                      })
                    }
                    className="h-9 text-xs mt-1 bg-background"
                  />
                </div>
              </div>
            )}

            {/* Modelo de Comissão para Vendas */}
            {formData.departamento === 'VENDAS' && (
              <div className="space-y-2 border-t border-border/60 pt-4">
                <Label className="text-xs">Regime de Comissão de Vendas do Colaborador</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'PADRAO',
                      title: 'Padrão (Faixas Loja)',
                      desc: 'Usa as faixas progressivas do cargo',
                    },
                    {
                      id: 'PLUS',
                      title: 'Plus (+ Captação Própria)',
                      desc: 'Faixas loja + bônus por venda própria/externa',
                    },
                    {
                      id: 'PERCENTUAL',
                      title: 'Percentual (%)',
                      desc: 'Alíquota sobre faturamento R$',
                    },
                  ].map((mod) => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          modeloComissaoVendedor: mod.id as any,
                        })
                      }
                      className={cn(
                        'p-2.5 rounded-lg border text-left transition-colors',
                        formData.modeloComissaoVendedor === mod.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-background hover:bg-muted/40',
                      )}
                    >
                      <span className="text-xs font-medium block text-foreground">
                        {mod.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{mod.desc}</span>
                    </button>
                  ))}
                </div>

                {formData.modeloComissaoVendedor === 'PERCENTUAL' && (
                  <div className="flex items-center gap-3 pt-2">
                    <Label className="text-xs">Alíquota sobre vendas (%):</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.commissionRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          commissionRate: Number(e.target.value),
                        })
                      }
                      className="h-8 w-24 text-xs bg-background"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Impostos, Benefícios e Dados Bancários */}
            <div className="space-y-3 border-t border-border/60 pt-4">
              <div className="flex flex-wrap items-center gap-5">
                {[
                  { key: 'descontarINSS', label: 'Descontar INSS' },
                  { key: 'descontarIRRF', label: 'Descontar IRRF' },
                  { key: 'calcularFGTS', label: 'Calcular FGTS' },
                  { key: 'pagarDSRComissao', label: 'Pagar DSR s/ Comissão' },
                  { key: 'temPericulosidade', label: 'Periculosidade (30%)' },
                  { key: 'optanteVT', label: 'Optante Vale Transporte' },
                ].map((chk) => (
                  <label key={chk.key} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={Boolean((formData as any)[chk.key])}
                      onCheckedChange={(v) =>
                        setFormData({ ...formData, [chk.key]: Boolean(v) })
                      }
                    />
                    <span>{chk.label}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <Label className="text-xs">Insalubridade</Label>
                  <select
                    value={formData.grauInsalubridade}
                    onChange={(e) =>
                      setFormData({ ...formData, grauInsalubridade: e.target.value as any })
                    }
                    className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="NENHUM">Nenhuma</option>
                    <option value="MINIMO">Mínimo (10%)</option>
                    <option value="MEDIO">Médio (20%)</option>
                    <option value="MAXIMO">Máximo (40%)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Custo VT (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.custoPassagemMensal}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        custoPassagemMensal: Number(e.target.value),
                      })
                    }
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs">Desc. VR/VA (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.descontoValeRefeicao}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        descontoValeRefeicao: Number(e.target.value),
                      })
                    }
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs">Desc. Saúde (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.descontoPlanoSaude}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        descontoPlanoSaude: Number(e.target.value),
                      })
                    }
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={formData.telefone}
                    onChange={(e) =>
                      setFormData({ ...formData, telefone: maskPhone(e.target.value) })
                    }
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    type="email"
                    placeholder="email@dominio.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs">Chave PIX</Label>
                  <Input
                    placeholder="CPF, celular, e-mail..."
                    value={formData.chavePix}
                    onChange={(e) => setFormData({ ...formData, chavePix: e.target.value })}
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Banco</Label>
                  <Input
                    value={formData.banco}
                    onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs">Agência</Label>
                  <Input
                    value={formData.agencia}
                    onChange={(e) => setFormData({ ...formData, agencia: e.target.value })}
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs">Conta</Label>
                  <Input
                    value={formData.conta}
                    onChange={(e) => setFormData({ ...formData, conta: e.target.value })}
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold">Situação do Contrato (Status)</Label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as any,
                      })
                    }
                    className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold"
                  >
                    <option value="ATIVO">Ativo (Em Operação Plena)</option>
                    <option value="PAUSA_ADMINISTRATIVA">Pausa Administrativa (Congelamento / Auditoria)</option>
                    <option value="DEMITIDO">Demitido / Desligado (Rescisão TRCT)</option>
                    <option value="SUSPENSO">Suspenso (Afastamento Disciplinar)</option>
                    <option value="AFASTADO_LICENCA">Afastado (Licença Médica / INSS)</option>
                    <option value="AVISO_PREVIO">Aviso Prévio (Em Transição)</option>
                    <option value="INATIVO">Inativo / Arquivado</option>
                  </select>
                </div>
              </div>

              {/* CAMPOS CONDICIONAIS PARA PAUSA ADMINISTRATIVA */}
              {formData.status === 'PAUSA_ADMINISTRATIVA' && (
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3">
                  <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs">
                    <PauseCircle className="w-4 h-4 text-amber-500" />
                    <span>Parâmetros de Pausa Administrativa (Congelamento Preventivo)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Início da Pausa</Label>
                      <Input
                        type="date"
                        value={formData.dataStatus}
                        onChange={(e) => setFormData({ ...formData, dataStatus: e.target.value })}
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Previsão de Retorno</Label>
                      <Input
                        type="date"
                        value={formData.dataRetornoPrevista}
                        onChange={(e) =>
                          setFormData({ ...formData, dataRetornoPrevista: e.target.value })
                        }
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Motivo da Pausa</Label>
                      <Input
                        placeholder="Ex: Auditoria interna de estoque / Transição de loja"
                        value={formData.motivoStatus}
                        onChange={(e) =>
                          setFormData({ ...formData, motivoStatus: e.target.value })
                        }
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                    ⚠️ Durante a Pausa Administrativa, a emissão de novos contratos e propostas fica suspensa preventivamente até a reativação formal.
                  </p>
                </div>
              )}

              {/* CAMPOS CONDICIONAIS PARA SUSPENSÃO */}
              {formData.status === 'SUSPENSO' && (
                <div className="p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10 space-y-3">
                  <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-purple-500" />
                    <span>Parâmetros de Suspensão Disciplinar</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Data da Suspensão</Label>
                      <Input
                        type="date"
                        value={formData.dataStatus}
                        onChange={(e) => setFormData({ ...formData, dataStatus: e.target.value })}
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Data Prevista de Retorno</Label>
                      <Input
                        type="date"
                        value={formData.dataRetornoPrevista}
                        onChange={(e) =>
                          setFormData({ ...formData, dataRetornoPrevista: e.target.value })
                        }
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Motivo da Suspensão</Label>
                      <Input
                        placeholder="Ex: Advertência disciplinar / Infração do POP"
                        value={formData.motivoStatus}
                        onChange={(e) =>
                          setFormData({ ...formData, motivoStatus: e.target.value })
                        }
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CAMPOS CONDICIONAIS PARA DEMISSÃO / RESCISÃO */}
              {formData.status === 'DEMITIDO' && (
                <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 space-y-3">
                  <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold text-xs">
                    <UserX className="w-4 h-4 text-rose-500" />
                    <span>Parâmetros de Demissão / Rescisão Trabalhista (TRCT)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Data de Desligamento</Label>
                      <Input
                        type="date"
                        value={formData.dataStatus}
                        onChange={(e) => setFormData({ ...formData, dataStatus: e.target.value })}
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Aviso Prévio</Label>
                      <select
                        value={formData.avisoPrevio}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            avisoPrevio: e.target.value as any,
                          })
                        }
                        className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium"
                      >
                        <option value="INDENIZADO">Indenizado pelo Empregador</option>
                        <option value="TRABALHADO">Trabalhado</option>
                        <option value="DISPENSADO">Dispensado / Não Aplicável</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Motivo / Tipo de Rescisão</Label>
                      <Input
                        placeholder="Ex: Sem justa causa pelo empregador"
                        value={formData.motivoStatus}
                        onChange={(e) =>
                          setFormData({ ...formData, motivoStatus: e.target.value })
                        }
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-rose-800 dark:text-rose-300 font-medium">
                    🚫 O acesso ao sistema é revogado e a ficha do colaborador é encaminhada para liquidação na aba de Rescisões.
                  </p>
                </div>
              )}

              {/* CAMPOS CONDICIONAIS PARA AFASTAMENTO / LICENÇA */}
              {formData.status === 'AFASTADO_LICENCA' && (
                <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/10 space-y-3">
                  <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-400 font-bold text-xs">
                    <Clock className="w-4 h-4 text-sky-500" />
                    <span>Parâmetros de Afastamento Temporário (Licença / INSS)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Data do Afastamento</Label>
                      <Input
                        type="date"
                        value={formData.dataStatus}
                        onChange={(e) => setFormData({ ...formData, dataStatus: e.target.value })}
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Previsão de Retorno (INSS)</Label>
                      <Input
                        type="date"
                        value={formData.dataRetornoPrevista}
                        onChange={(e) =>
                          setFormData({ ...formData, dataRetornoPrevista: e.target.value })
                        }
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Tipo de Licença / Motivo</Label>
                      <Input
                        placeholder="Ex: Auxílio-doença, Licença Maternidade, Acidente de Trabalho"
                        value={formData.motivoStatus}
                        onChange={(e) =>
                          setFormData({ ...formData, motivoStatus: e.target.value })
                        }
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CAMPOS CONDICIONAIS PARA AVISO PRÉVIO */}
              {formData.status === 'AVISO_PREVIO' && (
                <div className="p-3.5 rounded-xl border border-orange-500/30 bg-orange-500/10 space-y-3">
                  <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400 font-bold text-xs">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span>Parâmetros de Aviso Prévio Trabalhista</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-semibold">Início do Aviso</Label>
                      <Input
                        type="date"
                        value={formData.dataStatus}
                        onChange={(e) => setFormData({ ...formData, dataStatus: e.target.value })}
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Último Dia Trabalhado</Label>
                      <Input
                        type="date"
                        value={formData.dataRetornoPrevista}
                        onChange={(e) =>
                          setFormData({ ...formData, dataRetornoPrevista: e.target.value })
                        }
                        className="h-8 text-xs mt-1 bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Modalidade</Label>
                      <select
                        value={formData.avisoPrevio}
                        onChange={(e) => setFormData({ ...formData, avisoPrevio: e.target.value as any })}
                        className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-medium"
                      >
                        <option value="TRABALHADO">Trabalhado</option>
                        <option value="INDENIZADO">Indenizado</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 z-20 bg-card/95 backdrop-blur py-3 border-t border-border/70 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setModalAberto(false)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="text-xs px-5" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar colaborador'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <TerminationModal
        open={terminationModalOpen}
        onOpenChange={setTerminationModalOpen}
        funcionario={employeeForTermination}
        folhas={folhas}
        onTerminationCompleted={() => {
          onSincronizarEquipe();
        }}
      />
    </div>
  );
}
