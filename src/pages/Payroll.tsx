import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Users,
  Plus,
  FileText,
  Download,
  Edit2,
  Trash2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Building2,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  BarChart3,
  Bike,
  Sliders,
  Save,
  Wrench,
  Trophy,
  Upload,
  X,
  MessageCircle,
  RefreshCw,
  Store,
  Zap,
  Briefcase,
  Copy,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard, FilterBar, PanelCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useStores } from '@/hooks/useStores';
import { useAuth } from '@/contexts/AuthContext';
import { Payslip } from '@/hooks/usePayslips';
import { downloadPayslipPDF } from '@/lib/payslipPdf';
import { PayrollAlert } from '@/components/payroll/PayrollAlert';
import {
  Invoice,
  InvoiceItem,
  useInvoices,
  useUpsertInvoice,
  useDeleteInvoice,
} from '@/hooks/useInvoices';
import { downloadInvoicePDF } from '@/lib/invoicePdf';
import { maskCPFCNPJ, maskPhone, maskCurrency, parseCurrency, unmaskValue } from '@/lib/masks';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  useFolhaConcessionaria,
  packEmployeeFolhaPayload,
  FuncionarioConcessionaria,
  FolhaMensalItem,
} from '@/hooks/useFolhaConcessionaria';
import {
  analisarFolhaComIA,
  calcularFolhaFuncionario,
  sanitizarResultadoFolha,
  EmpresaFolhaConfig,
  VariaveisFolhaEntrada,
  ResultadoFolhaFuncionario,
} from '@/lib/folhaCalculos';
import HoleriteModal from '@/components/payroll/HoleriteModal';
import LancamentoVariaveisModal from '@/components/payroll/LancamentoVariaveisModal';
import ModulosEspeciais from '@/components/payroll/ModulosEspeciais';
import GestaoFuncionarios from '@/components/payroll/GestaoFuncionarios';
import LancamentoRapidoFimDeMes from '@/components/payroll/LancamentoRapidoFimDeMes';
import { ConfigComissoesCargoTab } from '@/components/payroll/ConfigComissoesCargoTab';
import { TabTransition } from '@/components/ui/TabTransition';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { resolveSaleStore } from '@/lib/storeResolution';

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function fmt(v: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(v) || 0,
  );
}

export default function Payroll() {
  const { hasElevatedAccess } = useAuth();
  const { toast } = useToast();

  const [abaPrincipal, setAbaPrincipal] = useState<
    | 'DASHBOARD'
    | 'LANCAMENTO_RAPIDO'
    | 'FUNCIONARIOS'
    | 'COMISSOES_CARGOS'
    | 'ESPECIAIS'
    | 'INVOICES'
    | 'CONFIG'
  >('DASHBOARD');
  const [cargoInicialCadastro, setCargoInicialCadastro] = useState<string | null>(null);
  const [mesReferencia, setMesReferencia] = useState<string>(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [processandoLote, setProcessandoLote] = useState(false);
  const [exibirAuditoriaIA, setExibirAuditoriaIA] = useState(false);
  const [buscaFolhaMensal, setBuscaFolhaMensal] = useState<string>('');
  const [filtroSetorFolha, setFiltroSetorFolha] = useState<string>('all');
  const [filtroSituacaoFolha, setFiltroSituacaoFolha] = useState<string>('all');

  // Modais
  const [holeriteSelecionado, setHoleriteSelecionado] = useState<{
    empresa: EmpresaFolhaConfig;
    funcionario: FuncionarioConcessionaria;
    folha: ResultadoFolhaFuncionario;
    variaveis?: VariaveisFolhaEntrada;
    rawPayslip?: Payslip | null;
  } | null>(null);
  const [colaboradorLancamento, setColaboradorLancamento] = useState<{
    funcionario: FuncionarioConcessionaria;
    variaveisIniciais?: VariaveisFolhaEntrada;
  } | null>(null);

  const {
    empresa: empresaHook,
    salvarEmpresaConfig,
    obterConfigParaLoja,
    stores,
    funcionarios,
    folhas,
    vendasMes,
    perfisSistema,
    loading,
    obterVendasSistemaColaborador,
    salvarFolhaFuncionario,
    processarFolhaMensalCompleta,
    sincronizarEquipeDoSistema,
    upsertEmployee,
    upsertPayslip,
  } = useFolhaConcessionaria(mesReferencia, selectedStoreId);

  // Estado editável para a aba de Configurações da Concessionária
  const [empresaForm, setEmpresaForm] = useState<EmpresaFolhaConfig>(empresaHook);
  const isEmpresaFormDirtyRef = useRef(false);
  useEffect(() => {
    if (!isEmpresaFormDirtyRef.current) {
      setEmpresaForm(empresaHook);
    }
  }, [empresaHook]);

  // Para cada funcionário ativo, usa a folha já salva no Supabase para o mês ou calcula uma prévia em tempo real (integrada com as vendas do mês!)
  const linhasFolhaMes = useMemo(() => {
    return funcionarios
      .filter((f) => f.status === 'ATIVO')
      .map((func) => {
        const folhaSalva = folhas.find((fl) => fl.funcionarioId === func.id);
        const vendasAuto = obterVendasSistemaColaborador(func);

        if (folhaSalva) {
          return {
            funcionario: func,
            folhaItem: folhaSalva,
            variaveis: folhaSalva.variaveisEntrada,
            resultado: sanitizarResultadoFolha(folhaSalva.resultado, func),
            vendasSistema: vendasAuto,
            salvoNoBanco: true,
          };
        }

        // Prévia automática usando as vendas reais do sistema no mês e regras do cargo/unidade do colaborador (com dados centrais da Organização)
        const resolvedStoreId = func.store_id || resolveSaleStore({ vendedor: func.nome }, perfisSistema).storeId;
        const configLoja = obterConfigParaLoja(resolvedStoreId);
        const regraDoCargo = configLoja.regrasPorCargo?.[func.cargoId];
        const isPlus = func.modeloComissaoVendedor === 'PLUS';

        // Checa se a unidade/cidade do vendedor possui acréscimo específico ou salário diferenciado
        const cidadeLoja =
          stores.find((s) => s.id === func.store_id)?.city?.trim() || configLoja.cidade?.trim() || '';
        const regraRegionalCidade = cidadeLoja && regraDoCargo?.cidadesDiferenciadas
          ? regraDoCargo.cidadesDiferenciadas[cidadeLoja]
          : undefined;

        const bonusMetaCalculado = vendasAuto.bateuMeta
          ? vendasAuto.bonusMeta ||
            regraRegionalCidade?.bonusMetaAtingida ||
            regraDoCargo?.bonusMetaAtingida ||
            configLoja.regrasComissoesCargos?.gerente?.bonusMetaGlobal ||
            0
          : 0;
        const valorUnitGerente =
          regraDoCargo?.valorPorMotoVendidaLojaGerente ??
          configLoja.regrasComissoesCargos?.gerente?.valorPorMotoVendidaLoja ??
          20;

        const variaveisAuto: VariaveisFolhaEntrada = {
          motosVendidas:
            func.departamento === 'VENDAS'
              ? isPlus
                ? vendasAuto.motosMarketingLoja + vendasAuto.motosMarketingProprio
                : vendasAuto.totalContratos || vendasAuto.motosVendidas
              : 0,
          motosMarketingLoja:
            func.departamento === 'VENDAS' && isPlus ? vendasAuto.motosMarketingLoja : 0,
          motosMarketingProprio:
            func.departamento === 'VENDAS' && isPlus ? vendasAuto.motosMarketingProprio : 0,
          valorMarketingProprio:
            regraRegionalCidade?.valorMarketingProprioPorMoto ??
            regraDoCargo?.valorMarketingProprioPorMoto ??
            configLoja.regrasComissoesCargos?.vendedorPlus?.valorMarketingProprio ??
            500,
          adicionalCidadePorMoto: regraRegionalCidade?.adicionalPorMoto || 0,
          vendasTotalReais: vendasAuto.valorTotalVendido,
          comissaoRetorno:
            func.departamento === 'VENDAS' ? vendasAuto.comissaoRetorno || 0 : 0,
          comissaoMotoParceiro:
            func.departamento === 'VENDAS' ? vendasAuto.comissaoMotoParceiro || 0 : 0,
          motoParceiroQtd:
            func.departamento === 'VENDAS' ? vendasAuto.motoParceiroQtd || 0 : 0,
          comissoesDetalhadas:
            func.departamento === 'VENDAS' ? vendasAuto.comissoesCatalogo || [] : [],
          motosMontadas:
            func.departamento === 'MECANICA' || (func.departamento as string) === 'OFICINA'
              ? vendasAuto.motosMontadas || 0
              : 0,
          valorPorMontagem:
            regraDoCargo?.valorPorMotoMontada ??
            configLoja.regrasComissoesCargos?.mecanico?.valorPorMotoMontada ??
            40,
          revisoesExecutadas: 0,
          valorPorRevisao:
            regraDoCargo?.valorPorRevisaoExecutada ??
            configLoja.regrasComissoesCargos?.mecanico?.valorPorRevisao ??
            25,
          motosLojaGerente:
            func.departamento === 'GERENCIA' ? vendasAuto.motosLojaGerente : 0,
          valorComissaoGerentePorMoto: valorUnitGerente,
          comissaoGeral:
            func.departamento === 'GERENCIA'
              ? +(vendasAuto.motosLojaGerente * valorUnitGerente).toFixed(2)
              : 0,
          bonusMetaBatida: bonusMetaCalculado,
          bonusMetas: bonusMetaCalculado,
          custoValeTransporte: func.custoPassagemMensal,
          optanteVT: Boolean(func.optanteVT),
          descontoValeRefeicao: func.descontoValeRefeicao,
          descontoPlanoSaude: func.descontoPlanoSaude,
        };

        const regras =
          regraDoCargo?.faixasMotos && regraDoCargo.faixasMotos.length > 0
            ? regraDoCargo.faixasMotos
            : func.modeloComissaoVendedor === 'PLUS'
              ? configLoja.regrasComissoesCargos?.vendedorPlus?.faixasMarketingLoja ||
                configLoja.regrasComissao
              : configLoja.regrasComissoesCargos?.vendedorPadrao?.faixas ||
                configLoja.regrasComissao;

        const salarioBaseEfetivo =
          regraRegionalCidade?.salarioBase ?? func.salarioBase;

        const resultadoPreview = calcularFolhaFuncionario({
          funcionario: {
            ...func,
            salarioBase: salarioBaseEfetivo,
            regimeEmpresa: configLoja.regimeTributario,
          },
          mesReferencia,
          regrasComissao: regras,
          ...variaveisAuto,
        });

        return {
          funcionario: func,
          folhaItem: null as FolhaMensalItem | null,
          variaveis: variaveisAuto,
          resultado: resultadoPreview,
          vendasSistema: vendasAuto,
          salvoNoBanco: false,
        };
      });
  }, [funcionarios, folhas, obterVendasSistemaColaborador, obterConfigParaLoja, empresaHook, mesReferencia]);

  // Relatório de Auditoria IA & Compliance CLT
  const relatorioIA = useMemo(() => {
    return analisarFolhaComIA(linhasFolhaMes.map((l) => l.resultado));
  }, [linhasFolhaMes]);

  if (!hasElevatedAccess) return <Navigate to="/" replace />;

  // Indicadores consolidados do mês
  const totalSalariosBrutos = linhasFolhaMes.reduce(
    (acc, l) => acc + (Number(l.resultado?.totalProventos) || 0),
    0,
  );
  const totalLiquidoGeral = linhasFolhaMes.reduce(
    (acc, l) => acc + (Number(l.resultado?.salarioLiquido) || 0),
    0,
  );
  const totalComissoesGeral = linhasFolhaMes.reduce(
    (acc, l) => acc + (Number(l.resultado?.totalComissoes) || 0),
    0,
  );
  const totalMotosVendidasFolha = linhasFolhaMes.reduce(
    (acc, l) => acc + (Number(l.resultado?.motosVendidas) || 0),
    0,
  );
  const totalCustoEmpresa = linhasFolhaMes.reduce(
    (acc, l) => acc + (Number(l.resultado?.custoTotalEmpresa) || 0),
    0,
  );
  const totalMotosSistemaMes =
    selectedStoreId !== 'all'
      ? (vendasMes?.motosPorLoja[selectedStoreId] ?? 0)
      : (vendasMes?.totalMotosGeral ?? 0);

  const qtdPagosMes = linhasFolhaMes.filter((l) => l.folhaItem?.rawStatus === 'pago').length;
  const qtdPendentesMes = linhasFolhaMes.length - qtdPagosMes;
  const valorPendenteLiquido = linhasFolhaMes
    .filter((l) => l.folhaItem?.rawStatus !== 'pago')
    .reduce((acc, l) => acc + l.resultado.salarioLiquido, 0);

  const linhasFolhaFiltradas = linhasFolhaMes.filter((l) => {
    const f = l.funcionario;
    const isPago = l.folhaItem?.rawStatus === 'pago';
    if (filtroSetorFolha !== 'all' && f.departamento !== filtroSetorFolha) return false;
    if (filtroSituacaoFolha === 'PAGO' && !isPago) return false;
    if (filtroSituacaoFolha === 'PENDENTE' && isPago) return false;
    if (filtroSituacaoFolha === 'PREVIA' && l.salvoNoBanco) return false;
    if (buscaFolhaMensal.trim()) {
      const q = buscaFolhaMensal.toLowerCase();
      if (
        !f.nome.toLowerCase().includes(q) &&
        !f.cargo.toLowerCase().includes(q) &&
        !(f.cpf || '').toLowerCase().includes(q) &&
        !(f.chavePix || '').toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const handleExportarRelatorioPagamentosCSV = () => {
    if (linhasFolhaFiltradas.length === 0) return;
    const headers = [
      'Colaborador',
      'CPF',
      'Cargo',
      'Setor',
      'Unidade',
      'Banco',
      'Agencia',
      'Conta',
      'Chave PIX',
      'Salario Base (R$)',
      'Comissoes (R$)',
      'DSR (R$)',
      'Total Bruto (R$)',
      'INSS (R$)',
      'IRRF (R$)',
      'Total Descontos (R$)',
      'Liquido a Pagar (R$)',
      'FGTS (R$)',
      'Situacao',
    ];
    const rows = linhasFolhaFiltradas.map((l) => {
      const f = l.funcionario;
      const r = l.resultado;
      const sit =
        l.folhaItem?.rawStatus === 'pago'
          ? 'PAGO'
          : l.salvoNoBanco
            ? 'PENDENTE'
            : 'PREVIA';
      return [
        `"${(f.nome || '').replace(/"/g, '""')}"`,
        `"${f.cpf || ''}"`,
        `"${(f.cargo || '').replace(/"/g, '""')}"`,
        `"${f.departamento || ''}"`,
        `"${(f.storeName || '').replace(/"/g, '""')}"`,
        `"${f.banco || ''}"`,
        `"${f.agencia || ''}"`,
        `"${f.conta || ''}"`,
        `"${f.chavePix || ''}"`,
        (r.salarioBase || 0).toFixed(2).replace('.', ','),
        (r.totalComissoes || 0).toFixed(2).replace('.', ','),
        (r.comissaoDSR || 0).toFixed(2).replace('.', ','),
        (r.totalProventos || 0).toFixed(2).replace('.', ','),
        (r.inssDetalhe?.valor || 0).toFixed(2).replace('.', ','),
        (r.irrfDetalhe?.valor || 0).toFixed(2).replace('.', ','),
        (r.totalDescontos || 0).toFixed(2).replace('.', ','),
        (r.salarioLiquido || 0).toFixed(2).replace('.', ','),
        (r.fgts || 0).toFixed(2).replace('.', ','),
        `"${sit}"`,
      ].join(';');
    });
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `folha_pagamento_pix_${mesReferencia}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Relatório de Pagamentos exportado!',
      description: `Planilha CSV com ${linhasFolhaFiltradas.length} colaboradores (incluindo chaves PIX e dados bancários) gerada com sucesso.`,
    });
  };

  const handleProcessarMes = async () => {
    setProcessandoLote(true);
    try {
      await processarFolhaMensalCompleta(true);
    } finally {
      setProcessandoLote(false);
    }
  };

  const handleQuitarTodos = async () => {
    setProcessandoLote(true);
    try {
      let quitados = 0;
      for (const linha of linhasFolhaMes) {
        let targetPayslip = linha.folhaItem?.rawPayslip;
        if (!targetPayslip) {
          targetPayslip = await salvarFolhaFuncionario(linha.funcionario, linha.variaveis);
        }
        if (targetPayslip?.id && targetPayslip.status !== 'pago') {
          await upsertPayslip.mutateAsync({
            id: targetPayslip.id,
            status: 'pago',
            payment_date: new Date().toISOString().slice(0, 10),
          } as any);
          quitados++;
        }
      }
      toast({
        title: 'Pagamentos confirmados!',
        description: `${quitados} holerite(s) marcados como PAGO na competência ${mesReferencia}.`,
      });
    } finally {
      setProcessandoLote(false);
    }
  };

  const handleMarcarPago = async (folhaItem: FolhaMensalItem | null, func: FuncionarioConcessionaria, variaveis: VariaveisFolhaEntrada) => {
    let targetPayslip = folhaItem?.rawPayslip;
    if (!targetPayslip) {
      targetPayslip = await salvarFolhaFuncionario(func, variaveis);
    }
    if (targetPayslip?.id) {
      const novoStatus = targetPayslip.status === 'pago' ? 'pendente' : 'pago';
      await upsertPayslip.mutateAsync({
        id: targetPayslip.id,
        status: novoStatus,
        payment_date:
          novoStatus === 'pago' ? new Date().toISOString().slice(0, 10) : null,
      } as any);
    }
  };

  const handleSendWhatsapp = (
    func: FuncionarioConcessionaria,
    res: ResultadoFolhaFuncionario,
    rawPayslip?: Payslip | null,
  ) => {
    const phone = func.telefone ? String(func.telefone).replace(/\D/g, '') : '';
    const [yr, mo] = mesReferencia.split('-');
    const ref = `${MONTHS[(Number(mo) || 1) - 1]}/${yr}`;
    const msg = encodeURIComponent(
      `Olá ${func.nome}, segue o demonstrativo da sua folha de pagamento referente a ${ref} (${empresaHook.razaoSocial}).\n• Total Bruto: ${fmt(res.totalProventos)}\n• Comissões: ${fmt(res.totalComissoes)}\n• Líquido a Receber: ${fmt(res.salarioLiquido)}\nQualquer dúvida estamos à disposição!`,
    );
    const url = phone ? `https://wa.me/55${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank', 'noopener');
    if (rawPayslip?.id) {
      (supabase as any)
        .from('payslips')
        .update({ sent_whatsapp_at: new Date().toISOString() })
        .eq('id', rawPayslip.id)
        .then(() => {});
    }
  };

  const handleDownloadPdf = async (
    func: FuncionarioConcessionaria,
    variaveis: VariaveisFolhaEntrada,
    folhaItem: FolhaMensalItem | null,
  ) => {
    let payslip = folhaItem?.rawPayslip;
    if (!payslip) {
      payslip = await salvarFolhaFuncionario(func, variaveis);
    }
    if (payslip) {
      downloadPayslipPDF(
        {
          ...payslip,
          employee: {
            id: func.id,
            full_name: func.nome,
            cpf: func.cpf,
            role: func.role,
            position: func.cargo,
            profile_id: func.profile_id,
          },
          store: {
            id: func.store_id || '',
            name: empresaHook.razaoSocial,
            cnpj: empresaHook.cnpj,
          },
        },
        {
          store_cnpj: empresaHook.cnpj,
          pix_key: func.chavePix || null,
          bank_info:
            func.banco || func.conta
              ? `${func.banco || ''} Ag:${func.agencia || '—'} Cc:${func.conta || '—'}`
              : null,
        },
      );
    }
  };

  // Manipulação de faixas de comissão nas configurações
  const handleRegraChange = (index: number, campo: string, valor: any) => {
    const regrasAtuais = Array.isArray(empresaForm.regrasComissao)
      ? [...empresaForm.regrasComissao]
      : [];
    regrasAtuais[index] = { ...regrasAtuais[index], [campo]: Number(valor) };
    setEmpresaForm({
      ...empresaForm,
      regrasComissao: regrasAtuais,
      regrasComissoesCargos: {
        ...empresaForm.regrasComissoesCargos,
        vendedorPadrao: { faixas: regrasAtuais },
      },
    });
  };

  const adicionarFaixaComissao = () => {
    const regrasAtuais = Array.isArray(empresaForm.regrasComissao)
      ? [...empresaForm.regrasComissao]
      : [];
    const ult = regrasAtuais[regrasAtuais.length - 1];
    const de = ult ? ult.ate + 1 : 1;
    const ate = de + 5;
    const novas = [...regrasAtuais, { de, ate, valorPorMoto: 100 }];
    setEmpresaForm({
      ...empresaForm,
      regrasComissao: novas,
      regrasComissoesCargos: {
        ...empresaForm.regrasComissoesCargos,
        vendedorPadrao: { faixas: novas },
      },
    });
  };

  const removerFaixaComissao = (index: number) => {
    const regrasAtuais = Array.isArray(empresaForm.regrasComissao)
      ? [...empresaForm.regrasComissao]
      : [];
    if (regrasAtuais.length <= 1) return;
    const novas = regrasAtuais.filter((_, i) => i !== index);
    setEmpresaForm({
      ...empresaForm,
      regrasComissao: novas,
      regrasComissoesCargos: {
        ...empresaForm.regrasComissoesCargos,
        vendedorPadrao: { faixas: novas },
      },
    });
  };

  const faixasPlusAtuais =
    empresaForm.regrasComissoesCargos?.vendedorPlus?.faixasMarketingLoja ||
    empresaForm.regrasComissaoPlus?.faixas ||
    [];

  const handleRegraPlusChange = (index: number, campo: string, valor: any) => {
    const novas = [...faixasPlusAtuais];
    novas[index] = { ...novas[index], [campo]: Number(valor) };
    setEmpresaForm({
      ...empresaForm,
      regrasComissaoPlus: {
        ...empresaForm.regrasComissaoPlus,
        faixas: novas,
      },
      regrasComissoesCargos: {
        ...empresaForm.regrasComissoesCargos,
        vendedorPlus: {
          ...empresaForm.regrasComissoesCargos.vendedorPlus,
          faixasMarketingLoja: novas,
        },
      },
    });
  };

  const adicionarFaixaComissaoPlus = () => {
    const ult = faixasPlusAtuais[faixasPlusAtuais.length - 1];
    const de = ult ? ult.ate + 1 : 1;
    const ate = de + 5;
    const novas = [...faixasPlusAtuais, { de, ate, valorPorMoto: 150 }];
    setEmpresaForm({
      ...empresaForm,
      regrasComissaoPlus: {
        ...empresaForm.regrasComissaoPlus,
        faixas: novas,
      },
      regrasComissoesCargos: {
        ...empresaForm.regrasComissoesCargos,
        vendedorPlus: {
          ...empresaForm.regrasComissoesCargos.vendedorPlus,
          faixasMarketingLoja: novas,
        },
      },
    });
  };

  const removerFaixaComissaoPlus = (index: number) => {
    if (faixasPlusAtuais.length <= 1) return;
    const novas = faixasPlusAtuais.filter((_, i) => i !== index);
    setEmpresaForm({
      ...empresaForm,
      regrasComissaoPlus: {
        ...empresaForm.regrasComissaoPlus,
        faixas: novas,
      },
      regrasComissoesCargos: {
        ...empresaForm.regrasComissoesCargos,
        vendedorPlus: {
          ...empresaForm.regrasComissoesCargos.vendedorPlus,
          faixasMarketingLoja: novas,
        },
      },
    });
  };

  const adicionarTipoComissao = () => {
    const novaComissao = {
      id: Date.now().toString(),
      nome: 'Nova Comissão (ex: Lavador, F&I, Meta)',
      tipo: 'POR_UNIDADE' as const,
      valorPadrao: 50,
      setor: 'TODOS' as const,
    };
    setEmpresaForm({
      ...empresaForm,
      tiposComissoesLoja: [...(empresaForm.tiposComissoesLoja || []), novaComissao],
    });
  };

  const atualizarTipoComissao = (id: string, campo: string, valor: any) => {
    const atualizadas = (empresaForm.tiposComissoesLoja || []).map((t) => {
      if (t.id === id) {
        return { ...t, [campo]: campo === 'valorPadrao' ? Number(valor) : valor };
      }
      return t;
    });
    setEmpresaForm({ ...empresaForm, tiposComissoesLoja: atualizadas });
  };

  const removerTipoComissao = (id: string) => {
    const atualizadas = (empresaForm.tiposComissoesLoja || []).filter((t) => t.id !== id);
    setEmpresaForm({ ...empresaForm, tiposComissoesLoja: atualizadas });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Selecione um arquivo de imagem válido (PNG, JPG, SVG ou WEBP).',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setEmpresaForm((prev) => ({ ...prev, logoUrl: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSalvarConfigEmpresa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    isEmpresaFormDirtyRef.current = false;
    await salvarEmpresaConfig(empresaForm);
  };

  return (
    <div className="space-y-5 pb-8">
      <PayrollAlert />

      <PageHeader
        title="Folha de Pagamento"
        description={`${empresaHook.razaoSocial}${empresaHook.cnpj ? ` • CNPJ ${empresaHook.cnpj}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="h-9 w-[200px] text-xs bg-card">
                <Store className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Todas as unidades ({stores.length})
                </SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap items-center rounded-lg border border-border bg-card p-1 gap-0.5">
              {(
                [
                  { id: 'DASHBOARD', label: 'Folha Mensal', icon: BarChart3 },
                  { id: 'LANCAMENTO_RAPIDO', label: 'Fim de Mês (Por Qtd)', icon: Zap },
                  { id: 'FUNCIONARIOS', label: `Equipe (${funcionarios.length})`, icon: Users },
                  { id: 'COMISSOES_CARGOS', label: 'Comissões por Cargo', icon: Briefcase },
                  { id: 'CONFIG', label: 'Dados da Unidade', icon: Sliders },
                  { id: 'ESPECIAIS', label: 'Férias, 13º e Rescisões', icon: Calendar },
                  { id: 'INVOICES', label: 'Notas Fiscais', icon: FileText },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = abaPrincipal === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAbaPrincipal(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        }
      />

      {/* ============================================================ */}
      {/* 1. ABA DASHBOARD & FOLHA MENSAL */}
      {/* ============================================================ */}
      {abaPrincipal === 'DASHBOARD' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar a folha mensal">
          <div className="space-y-5">
          <FilterBar className="justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  Competência:
                </Label>
                <Input
                  type="month"
                  value={mesReferencia}
                  onChange={(e) => setMesReferencia(e.target.value)}
                  className="h-9 w-[165px] text-xs bg-background"
                />
              </div>

              <div className="h-4 w-px bg-border hidden sm:block" />

              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>Vendas apuradas no mês:</span>
                <strong className="text-foreground">{totalMotosSistemaMes} veículos</strong>
                <span>({fmt(vendasMes?.totalVendasReaisGeral || 0)})</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportarRelatorioPagamentosCSV}
                disabled={linhasFolhaFiltradas.length === 0}
                className="h-9 text-xs"
                title="Exportar planilha com valores líquidos, bancos e chaves PIX"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Exportar PIX / CSV
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExibirAuditoriaIA(!exibirAuditoriaIA)}
                className="h-9 text-xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                Compliance CLT ({relatorioIA.scoreSaudeFolha}%)
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleQuitarTodos}
                disabled={processandoLote || linhasFolhaMes.length === 0 || qtdPendentesMes === 0}
                className="h-9 text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-success" />
                Quitar todos ({qtdPendentesMes})
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleProcessarMes}
                disabled={processandoLote}
                className="h-9 text-xs"
              >
                <RefreshCw
                  className={cn('w-3.5 h-3.5 mr-1.5', processandoLote && 'animate-spin')}
                />
                {processandoLote
                  ? 'Processando folha...'
                  : 'Sincronizar vendas e fechar mês'}
              </Button>
            </div>
          </FilterBar>

          {exibirAuditoriaIA && (
            <PanelCard
              title="Diagnóstico de Compliance Trabalhista (CLT)"
              description={relatorioIA.parecerExecutivo}
              aside={
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Índice: {relatorioIA.scoreSaudeFolha}%
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Encargos: {relatorioIA.percentualEncargos}
                  </Badge>
                </div>
              }
            >
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                    Pontos de Atenção ({relatorioIA.alertas.length})
                  </div>
                  {relatorioIA.alertas.length === 0 ? (
                    <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/20 p-3">
                      Nenhuma inconsistência trabalhista identificada nesta competência.
                    </p>
                  ) : (
                    relatorioIA.alertas.map((a, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs space-y-0.5"
                      >
                        <div className="font-medium text-foreground">{a.titulo}</div>
                        <div className="text-muted-foreground text-[11px]">{a.mensagem}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-primary" />
                    Parâmetros Aplicados ({relatorioIA.sugestoes.length})
                  </div>
                  {relatorioIA.sugestoes.length === 0 ? (
                    <p className="text-xs text-muted-foreground rounded-lg border border-border/60 bg-muted/20 p-3">
                      Tabelas progressivas de INSS e IRRF aplicadas conforme legislação vigente.
                    </p>
                  ) : (
                    relatorioIA.sugestoes.slice(0, 4).map((s, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs space-y-0.5"
                      >
                        <div className="font-medium text-foreground">{s.titulo}</div>
                        <div className="text-muted-foreground text-[11px]">{s.mensagem}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </PanelCard>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Proventos Brutos"
              value={fmt(totalSalariosBrutos)}
              icon={DollarSign}
              tone="neutral"
              hint="Fixo + Variáveis"
            />
            <StatCard
              label="Total de Comissões"
              value={fmt(totalComissoesGeral)}
              icon={TrendingUp}
              tone="primary"
              hint={`${totalMotosVendidasFolha} vendas`}
            />
            <StatCard
              label="Líquido a Pagar"
              value={fmt(totalLiquidoGeral)}
              icon={CheckCircle2}
              tone="success"
              hint="Folha líquida"
            />
            <StatCard
              label="Custo Total Empresa"
              value={fmt(totalCustoEmpresa)}
              icon={Building2}
              tone="warning"
              hint="Com encargos"
            />
          </div>

          <PanelCard
            title={`Demonstrativo Mensal (${mesReferencia})`}
            description="Cálculo consolidado com vendas, comissões por cargo, encargos, PIX e controle de baixa de pagamentos"
            aside={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[11px] border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                  Pagos: {qtdPagosMes}
                </Badge>
                <Badge variant="outline" className="text-[11px] border-amber-500/30 bg-amber-500/10 text-amber-600">
                  A pagar: {qtdPendentesMes} ({fmt(valorPendenteLiquido)})
                </Badge>
              </div>
            }
          >
            {/* Barra de Busca e Filtros de Pagamento */}
            <div className="px-4 py-3 border-b border-border/60 bg-muted/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, cargo, CPF ou PIX..."
                  value={buscaFolhaMensal}
                  onChange={(e) => setBuscaFolhaMensal(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select value={filtroSetorFolha} onValueChange={setFiltroSetorFolha}>
                  <SelectTrigger className="h-8 w-[160px] text-xs bg-background">
                    <SelectValue placeholder="Setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todos os Setores</SelectItem>
                    <SelectItem value="VENDAS" className="text-xs">Vendas (Comercial)</SelectItem>
                    <SelectItem value="MECANICA" className="text-xs">Oficina / Mecânica</SelectItem>
                    <SelectItem value="GERENCIA" className="text-xs">Gerência</SelectItem>
                    <SelectItem value="ADMINISTRATIVO" className="text-xs">Administrativo / F&I</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center rounded-md border border-border bg-background p-0.5 gap-0.5">
                  {[
                    { id: 'all', label: `Todos (${linhasFolhaMes.length})` },
                    { id: 'PENDENTE', label: `A Pagar (${qtdPendentesMes})` },
                    { id: 'PAGO', label: `Pagos (${qtdPagosMes})` },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setFiltroSituacaoFolha(st.id)}
                      className={cn(
                        'px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
                        filtroSituacaoFolha === st.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-muted-foreground text-xs">
                Carregando dados da folha...
              </div>
            ) : linhasFolhaFiltradas.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-muted-foreground text-xs">
                  Nenhum colaborador encontrado para os filtros selecionados.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBuscaFolhaMensal('');
                    setFiltroSetorFolha('all');
                    setFiltroSituacaoFolha('all');
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Salário Base</TableHead>
                      <TableHead>Comissões & DSR</TableHead>
                      <TableHead>H.E. / Indeniz.</TableHead>
                      <TableHead>Total Bruto</TableHead>
                      <TableHead>INSS</TableHead>
                      <TableHead>IRRF</TableHead>
                      <TableHead>Líquido</TableHead>
                      <TableHead className="text-center">Situação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhasFolhaFiltradas.map((linha) => {
                      const { funcionario: func, resultado: colab, folhaItem, variaveis } = linha;
                      const proventosSeguros = Array.isArray(colab?.proventos) ? colab.proventos : [];
                      const horasExtras = proventosSeguros.filter(
                        (p) =>
                          p &&
                          p.rubrica &&
                          (p.rubrica.includes('Horas') || p.rubrica.includes('Noturno')) &&
                          !p.rubrica.includes('Comissão'),
                      );
                      const totalHorasExtrasValor = horasExtras.reduce(
                        (sum, h) => sum + (Number(h?.valor) || 0),
                        0,
                      );
                      const totalIndeniz =
                        (Number(colab?.ajudaDeCusto) || 0) +
                        (Number(colab?.reembolsoDespesas) || 0) +
                        (Number(colab?.gastosDiversos) || 0);
                      const isPago = folhaItem?.rawStatus === 'pago';

                      return (
                        <TableRow key={func.id}>
                          <TableCell className="max-w-[220px]">
                            <div className="font-medium text-xs text-foreground truncate flex items-center gap-1.5">
                              <span>{colab.funcionarioNome}</span>
                              {func.modeloComissaoVendedor === 'PLUS' && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Vendedor +
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {colab.cargo} • {func.storeName}
                            </div>
                            {func.chavePix && (
                              <div className="text-[10px] font-mono text-primary/80 truncate mt-0.5">
                                PIX: {func.chavePix}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="text-xs whitespace-nowrap">
                            {fmt(colab.salarioBase)}
                          </TableCell>

                          <TableCell className="text-xs whitespace-nowrap">
                            {colab.totalComissoes > 0 || colab.motosVendidas > 0 ? (
                              <div>
                                <div className="font-medium text-foreground">
                                  {fmt(colab.totalComissoes)}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {colab.motosVendidas > 0
                                    ? `${colab.motosVendidas} venda(s)`
                                    : colab.motosMontadas > 0
                                      ? `${colab.motosMontadas} montagem(ns)`
                                      : 'Variável'}
                                  {colab.comissaoDSR > 0 && ` • +${fmt(colab.comissaoDSR)} DSR`}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-xs whitespace-nowrap">
                            {totalHorasExtrasValor > 0 || totalIndeniz > 0 ? (
                              <div className="space-y-0.5">
                                {totalHorasExtrasValor > 0 && (
                                  <span className="block text-foreground">
                                    H.E: {fmt(totalHorasExtrasValor)}
                                  </span>
                                )}
                                {totalIndeniz > 0 && (
                                  <span className="block text-muted-foreground text-[11px]">
                                    Indeniz: {fmt(totalIndeniz)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-xs font-medium whitespace-nowrap">
                            {fmt(colab.totalProventos)}
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {colab.inssDetalhe?.valor > 0 ? (
                              <>
                                - {fmt(colab.inssDetalhe?.valor)}
                                <span className="block text-[10px]">
                                  {colab.inssDetalhe?.aliquotaEfetiva}%
                                </span>
                              </>
                            ) : (
                              <span>Isento</span>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {colab.irrfDetalhe?.valor > 0 ? (
                              <>
                                - {fmt(colab.irrfDetalhe?.valor)}
                                <span className="block text-[10px]">
                                  {colab.irrfDetalhe?.aliquota}%
                                </span>
                              </>
                            ) : (
                              <span>Isento</span>
                            )}
                          </TableCell>

                          <TableCell className="text-xs font-semibold text-foreground whitespace-nowrap">
                            {fmt(colab.salarioLiquido)}
                          </TableCell>

                          <TableCell className="text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleMarcarPago(folhaItem, func, variaveis)}
                              className={cn(
                                'px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                                isPago
                                  ? 'bg-success/10 text-success'
                                  : linha.salvoNoBanco
                                    ? 'bg-warning/10 text-warning'
                                    : 'bg-muted text-muted-foreground',
                              )}
                              title="Alternar situação de pagamento"
                            >
                              {isPago ? 'Pago' : linha.salvoNoBanco ? 'Pendente' : 'Prévia'}
                            </button>
                          </TableCell>

                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex justify-end items-center gap-1">
                              {func.chavePix && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    navigator.clipboard.writeText(func.chavePix!);
                                    toast({
                                      title: 'Chave PIX copiada!',
                                      description: `${func.chavePix} (${func.nome}) — Líquido: ${fmt(colab.salarioLiquido)}`,
                                    });
                                  }}
                                  title={`Copiar PIX: ${func.chavePix}`}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-xs"
                                onClick={() =>
                                  setColaboradorLancamento({
                                    funcionario: func,
                                    variaveisIniciais: variaveis,
                                  })
                                }
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Variáveis
                              </Button>

                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-7 px-2.5 text-xs"
                                onClick={() => {
                                  const resolvedStoreId = func.store_id || resolveSaleStore({ vendedor: func.nome }, perfisSistema).storeId;
                                  setHoleriteSelecionado({
                                    empresa: obterConfigParaLoja(resolvedStoreId),
                                    funcionario: { ...func, store_id: resolvedStoreId },
                                    folha: colab,
                                    variaveis,
                                    rawPayslip: folhaItem?.rawPayslip || null,
                                  });
                                }}
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                Holerite
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleDownloadPdf(func, variaveis, folhaItem)}
                                title="Baixar PDF"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  handleSendWhatsapp(func, colab, folhaItem?.rawPayslip)
                                }
                                title="Enviar resumo via WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
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
        </div>
      </ErrorBoundary>
      )}

      {/* ============================================================ */}
      {/* ABA: LANÇAMENTO RÁPIDO DE FIM DE MÊS (POR QUANTIDADE)       */}
      {/* ============================================================ */}
      {abaPrincipal === 'LANCAMENTO_RAPIDO' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar o lançamento rápido de fim de mês">
          <TabTransition isLoading={loading && funcionarios.length === 0} skeletonType="table">
            <LancamentoRapidoFimDeMes
              funcionarios={funcionarios}
              folhas={folhas}
              empresa={empresaHook}
              obterConfigParaLoja={obterConfigParaLoja}
              obterVendasSistemaColaborador={obterVendasSistemaColaborador}
              stores={stores}
              mesReferencia={mesReferencia}
              onSalvarFolha={salvarFolhaFuncionario}
              onAbrirHolerite={setHoleriteSelecionado}
              vendasMes={vendasMes}
            />
          </TabTransition>
        </ErrorBoundary>
      )}

      {/* ============================================================ */}
      {/* 2. ABA DE GESTÃO DE COLABORADORES */}
      {/* ============================================================ */}
      {abaPrincipal === 'FUNCIONARIOS' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar a gestão de colaboradores">
          <TabTransition isLoading={loading && funcionarios.length === 0} skeletonType="table">
            <GestaoFuncionarios
              funcionarios={funcionarios}
              folhas={folhas}
              stores={stores}
              perfisSistema={perfisSistema}
              onSincronizarEquipe={sincronizarEquipeDoSistema}
              empresa={empresaHook}
              obterConfigParaLoja={obterConfigParaLoja}
              onAbrirConfigCargos={() => setAbaPrincipal('COMISSOES_CARGOS')}
              cargoInicialParaCadastro={cargoInicialCadastro}
              onLimparCargoInicial={() => setCargoInicialCadastro(null)}
            />
          </TabTransition>
        </ErrorBoundary>
      )}

      {/* ============================================================ */}
      {/* 2.5 ABA DEDICADA: CONFIGURAÇÃO DE COMISSÕES POR CARGO         */}
      {/* ============================================================ */}
      {abaPrincipal === 'COMISSOES_CARGOS' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar as configurações de comissão por cargo">
          <TabTransition isLoading={false} skeletonType="cards">
            <ConfigComissoesCargoTab
              empresa={empresaHook}
              stores={stores}
              selectedStoreId={selectedStoreId}
              onSelectStoreId={setSelectedStoreId}
              onSalvarConfig={salvarEmpresaConfig}
              funcionarios={funcionarios}
              onAtualizarFuncionario={(payload) => upsertEmployee.mutateAsync(payload)}
              onAbrirCadastroComCargo={(cargoId) => {
                setCargoInicialCadastro(cargoId);
                setAbaPrincipal('FUNCIONARIOS');
              }}
            />
          </TabTransition>
        </ErrorBoundary>
      )}

      {/* ============================================================ */}
      {/* 3. ABA DE MÓDULOS ESPECIAIS (FÉRIAS, 13º, RESCISÃO) */}
      {/* ============================================================ */}
      {abaPrincipal === 'ESPECIAIS' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar módulos especiais de folha">
          <TabTransition skeletonType="cards">
            <ModulosEspeciais
              funcionarios={funcionarios}
              folhas={folhas}
              onDesligarColaborador={async (func, motivo, dataDemissao) => {
                const payload = packEmployeeFolhaPayload(
                  {
                    ...func,
                    status: 'DEMITIDO',
                    motivoStatus: `Rescisão TRCT (${motivo})`,
                    dataStatus: dataDemissao,
                  },
                  func.regularAdditions,
                );
                await upsertEmployee.mutateAsync(payload as any);
              }}
            />
          </TabTransition>
        </ErrorBoundary>
      )}

      {/* ============================================================ */}
      {/* 4. ABA DE NOTAS FISCAIS */}
      {/* ============================================================ */}
      {abaPrincipal === 'INVOICES' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar notas fiscais">
          <TabTransition skeletonType="table">
            <InvoicesTab />
          </TabTransition>
        </ErrorBoundary>
      )}

      {/* ============================================================ */}
      {/* 5. ABA DE CONFIGURAÇÕES DA CONCESSIONÁRIA, LOGO E COMISSÕES */}
      {/* ============================================================ */}
      {abaPrincipal === 'CONFIG' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar configurações da folha">
          <TabTransition skeletonType="cards">
          <form onSubmit={handleSalvarConfigEmpresa} className="space-y-5 max-w-4xl">
            <PanelCard
              title="Parâmetros e Regras de Comissionamento por Unidade"
              description="Configure os salários base da loja, faixas de vendas, montagens 0km, revisões periódicas e bônus de metas"
              aside={
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs"
                    onClick={async () => {
                      isEmpresaFormDirtyRef.current = false;
                      await salvarEmpresaConfig(empresaForm, true);
                    }}
                    title="Aplica exatamente estas regras em todas as unidades cadastradas"
                  >
                    Replicar para Todas as Lojas
                  </Button>
                  <Button type="submit" size="sm" className="h-9 text-xs">
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Salvar configurações
                  </Button>
                </div>
              }
            >
              <div className="p-6 space-y-6">
                {/* IDENTIFICAÇÃO DA UNIDADE ATIVA */}
                <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-foreground">
                        Unidade em Edição: {stores.find((s) => s.id === selectedStoreId)?.name || 'Padrão / Global'}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        As regras abaixo são salvas exclusivamente para esta concessionária.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    ID: {selectedStoreId === 'all' ? 'GLOBAL' : selectedStoreId.slice(0, 8)}
                  </Badge>
                </div>

                {/* SALÁRIOS BASE DA UNIDADE */}
                <div className="space-y-3 border-t border-border/60 pt-5">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Salários Base da Unidade por Cargo
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Valores base adotados para colaboradores desta loja
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Vendedor Padrão (R$)</Label>
                      <Input
                        type="number"
                        value={empresaForm.salarioBaseVendedor ?? 1650}
                        onChange={(e) =>
                          setEmpresaForm({ ...empresaForm, salarioBaseVendedor: Number(e.target.value) })
                        }
                        className="h-9 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Mecânico / Oficina (R$)</Label>
                      <Input
                        type="number"
                        value={empresaForm.salarioBaseMecanico ?? 2100}
                        onChange={(e) =>
                          setEmpresaForm({ ...empresaForm, salarioBaseMecanico: Number(e.target.value) })
                        }
                        className="h-9 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Gerente da Loja (R$)</Label>
                      <Input
                        type="number"
                        value={empresaForm.salarioBaseGerente ?? 4500}
                        onChange={(e) =>
                          setEmpresaForm({ ...empresaForm, salarioBaseGerente: Number(e.target.value) })
                        }
                        className="h-9 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Administrativo (R$)</Label>
                      <Input
                        type="number"
                        value={empresaForm.salarioBaseAdministrativo ?? 1800}
                        onChange={(e) =>
                          setEmpresaForm({ ...empresaForm, salarioBaseAdministrativo: Number(e.target.value) })
                        }
                        className="h-9 text-xs mt-1"
                      />
                    </div>
                  </div>
                </div>
              {/* DADOS CADASTRAIS */}
              <div className="space-y-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Dados da Empresa
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Razão Social</Label>
                    <Input
                      value={empresaForm.razaoSocial || ''}
                      onChange={(e) =>
                        setEmpresaForm({ ...empresaForm, razaoSocial: e.target.value })
                      }
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">CNPJ</Label>
                    <Input
                      value={empresaForm.cnpj || ''}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, cnpj: e.target.value })}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Endereço</Label>
                    <Input
                      value={empresaForm.endereco || ''}
                      onChange={(e) =>
                        setEmpresaForm({ ...empresaForm, endereco: e.target.value })
                      }
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cidade</Label>
                    <Input
                      value={empresaForm.cidade || ''}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, cidade: e.target.value })}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">UF</Label>
                    <Input
                      value={empresaForm.uf || ''}
                      onChange={(e) => setEmpresaForm({ ...empresaForm, uf: e.target.value })}
                      className="h-9 text-xs mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Regime Tributário (Impacto em INSS Patronal)</Label>
                    <Select
                      value={empresaForm.regimeTributario || 'LUCRO_PRESUMIDO'}
                      onValueChange={(
                        v: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL',
                      ) => setEmpresaForm({ ...empresaForm, regimeTributario: v })}
                    >
                      <SelectTrigger className="h-9 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SIMPLES_NACIONAL" className="text-xs">
                          Simples Nacional (Anexo I / III — Isento de CPP Patronal 28,8%)
                        </SelectItem>
                        <SelectItem value="LUCRO_PRESUMIDO" className="text-xs">
                          Lucro Presumido (Com INSS Patronal + RAT + Terceiros ~28,8%)
                        </SelectItem>
                        <SelectItem value="LUCRO_REAL" className="text-xs">
                          Lucro Real (Com INSS Patronal + RAT + Terceiros ~28,8%)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* MARCA D'ÁGUA E LOGO */}
              <div className="space-y-3 border-t border-border/60 pt-5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Identidade Visual do Contracheque
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Texto da Marca d’Água</Label>
                    <Input
                      placeholder="Ex: CONCESSIONÁRIA"
                      value={empresaForm.textoMarcaDagua || ''}
                      onChange={(e) =>
                        setEmpresaForm({ ...empresaForm, textoMarcaDagua: e.target.value })
                      }
                      className="h-9 text-xs mt-1 uppercase"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Logotipo</Label>
                    <div className="flex gap-2 items-center mt-1">
                      <label className="cursor-pointer inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 text-xs font-medium shrink-0">
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        Enviar arquivo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      <Input
                        placeholder="Ou informe a URL da imagem"
                        value={
                          empresaForm.logoUrl?.startsWith('data:image')
                            ? '[Imagem carregada]'
                            : empresaForm.logoUrl || ''
                        }
                        onChange={(e) =>
                          setEmpresaForm({ ...empresaForm, logoUrl: e.target.value })
                        }
                        disabled={Boolean(empresaForm.logoUrl?.startsWith('data:image'))}
                        className="h-9 text-xs"
                      />
                      {empresaForm.logoUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-destructive"
                          onClick={() => setEmpresaForm({ ...empresaForm, logoUrl: '' })}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* FAIXAS VENDEDOR PADRÃO */}
              <div className="space-y-3 border-t border-border/60 pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Faixas Progressivas — Vendedor Padrão
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Valor pago por unidade conforme o volume mensal atingido
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={adicionarFaixaComissao}
                    className="h-8 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Nova faixa
                  </Button>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>De (un.)</TableHead>
                        <TableHead>Até (un.)</TableHead>
                        <TableHead>Valor por Unidade (R$)</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {empresaForm.regrasComissao?.map((regra, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input
                              type="number"
                              value={regra.de}
                              onChange={(e) => handleRegraChange(idx, 'de', e.target.value)}
                              className="h-8 w-24 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={regra.ate}
                              onChange={(e) => handleRegraChange(idx, 'ate', e.target.value)}
                              className="h-8 w-24 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={regra.valorPorMoto}
                              onChange={(e) =>
                                handleRegraChange(idx, 'valorPorMoto', e.target.value)
                              }
                              className="h-8 w-32 text-xs font-medium"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removerFaixaComissao(idx)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* FAIXAS VENDEDOR + */}
              <div className="space-y-3 border-t border-border/60 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Faixas Progressivas — Vendedor +
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Faixas para leads da loja e valor fixo para captação própria
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">
                        Captação Própria (R$/un.):
                      </Label>
                      <Input
                        type="number"
                        value={
                          empresaForm.regrasComissoesCargos?.vendedorPlus?.valorMarketingProprio ||
                          500
                        }
                        onChange={(e) =>
                          setEmpresaForm({
                            ...empresaForm,
                            regrasComissaoPlus: {
                              ...empresaForm.regrasComissaoPlus,
                              valorMarketingProprio: Number(e.target.value),
                            },
                            regrasComissoesCargos: {
                              ...empresaForm.regrasComissoesCargos,
                              vendedorPlus: {
                                ...empresaForm.regrasComissoesCargos.vendedorPlus,
                                valorMarketingProprio: Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="h-8 w-24 text-xs font-medium"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={adicionarFaixaComissaoPlus}
                      className="h-8 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Nova faixa
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>De (un.)</TableHead>
                        <TableHead>Até (un.)</TableHead>
                        <TableHead>Valor por Unidade — Marketing Loja (R$)</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faixasPlusAtuais.map((regra, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input
                              type="number"
                              value={regra.de}
                              onChange={(e) => handleRegraPlusChange(idx, 'de', e.target.value)}
                              className="h-8 w-24 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={regra.ate}
                              onChange={(e) => handleRegraPlusChange(idx, 'ate', e.target.value)}
                              className="h-8 w-24 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={regra.valorPorMoto}
                              onChange={(e) =>
                                handleRegraPlusChange(idx, 'valorPorMoto', e.target.value)
                              }
                              className="h-8 w-32 text-xs font-medium"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removerFaixaComissaoPlus(idx)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* REGRAS ESPECÍFICAS: MECÂNICA & OFICINA E GERÊNCIA DE UNIDADE */}
              <div className="space-y-4 border-t border-border/60 pt-5">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                    Parâmetros de Produção — Oficina e Gerência de Loja
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Valores aplicados para apuração automática de montagens, revisões periódicas e bonificações
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bloco Mecânica / Oficina */}
                  <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">
                          Oficina / Mecânica
                        </span>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={
                            empresaForm.regrasComissoesCargos?.mecanico?.comissaoOficinaAtiva ?? true
                          }
                          onCheckedChange={(checked) =>
                            setEmpresaForm({
                              ...empresaForm,
                              regrasComissoesCargos: {
                                ...empresaForm.regrasComissoesCargos,
                                mecanico: {
                                  ...empresaForm.regrasComissoesCargos.mecanico,
                                  comissaoOficinaAtiva: Boolean(checked),
                                },
                              },
                            })
                          }
                        />
                        <span className="text-muted-foreground text-[11px]">Ativo</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <Label className="text-xs">Valor por Moto Montada 0km (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={
                            empresaForm.regrasComissoesCargos?.mecanico?.valorPorMotoMontada ?? 40
                          }
                          onChange={(e) =>
                            setEmpresaForm({
                              ...empresaForm,
                              regrasComissoesCargos: {
                                ...empresaForm.regrasComissoesCargos,
                                mecanico: {
                                  ...empresaForm.regrasComissoesCargos.mecanico,
                                  valorPorMotoMontada: Number(e.target.value),
                                },
                              },
                            })
                          }
                          className="h-9 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Valor por Revisão / Manutenção (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={
                            empresaForm.regrasComissoesCargos?.mecanico?.valorPorRevisao ?? 25
                          }
                          onChange={(e) =>
                            setEmpresaForm({
                              ...empresaForm,
                              regrasComissoesCargos: {
                                ...empresaForm.regrasComissoesCargos,
                                mecanico: {
                                  ...empresaForm.regrasComissoesCargos.mecanico,
                                  valorPorRevisao: Number(e.target.value),
                                },
                              },
                            })
                          }
                          className="h-9 text-xs mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bloco Gerência de Loja */}
                  <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">
                          Gerência de Loja
                        </span>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={
                            empresaForm.regrasComissoesCargos?.gerente?.metaGlobalAtiva ?? true
                          }
                          onCheckedChange={(checked) =>
                            setEmpresaForm({
                              ...empresaForm,
                              regrasComissoesCargos: {
                                ...empresaForm.regrasComissoesCargos,
                                gerente: {
                                  ...empresaForm.regrasComissoesCargos.gerente,
                                  metaGlobalAtiva: Boolean(checked),
                                },
                              },
                            })
                          }
                        />
                        <span className="text-muted-foreground text-[11px]">Bônus Ativo</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <Label className="text-xs">Comissão por Moto Vendida Loja (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={
                            empresaForm.regrasComissoesCargos?.gerente?.valorPorMotoVendidaLoja ?? 20
                          }
                          onChange={(e) =>
                            setEmpresaForm({
                              ...empresaForm,
                              regrasComissoesCargos: {
                                ...empresaForm.regrasComissoesCargos,
                                gerente: {
                                  ...empresaForm.regrasComissoesCargos.gerente,
                                  valorPorMotoVendidaLoja: Number(e.target.value),
                                },
                              },
                            })
                          }
                          className="h-9 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Bônus Meta Global Batida (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={
                            empresaForm.regrasComissoesCargos?.gerente?.bonusMetaGlobal ?? 600
                          }
                          onChange={(e) =>
                            setEmpresaForm({
                              ...empresaForm,
                              regrasComissoesCargos: {
                                ...empresaForm.regrasComissoesCargos,
                                gerente: {
                                  ...empresaForm.regrasComissoesCargos.gerente,
                                  bonusMetaGlobal: Number(e.target.value),
                                },
                              },
                            })
                          }
                          className="h-9 text-xs mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CATÁLOGO DE ATIVIDADES E SERVIÇOS EXTRAS */}
              <div className="space-y-3 border-t border-border/60 pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Catálogo de Atividades, Serviços & Produtos (Consórcio, Seguro, Acessórios)
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Itens e serviços selecionáveis para o caderno de atividades e demonstrativo dos colaboradores (exibidos com sua própria descrição)
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={adicionarTipoComissao}
                    className="h-8 text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar atividade / item
                  </Button>
                </div>

                <div className="space-y-2">
                  {(empresaForm.tiposComissoesLoja || []).map((comissao) => (
                    <div
                      key={comissao.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center"
                    >
                      <div className="md:col-span-6">
                        <Input
                          value={comissao.nome}
                          onChange={(e) =>
                            atualizarTipoComissao(comissao.id, 'nome', e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Select
                          value={comissao.setor || 'TODOS'}
                          onValueChange={(v) =>
                            atualizarTipoComissao(comissao.id, 'setor', v)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TODOS" className="text-xs">Todos os Setores</SelectItem>
                            <SelectItem value="VENDAS" className="text-xs">Vendas</SelectItem>
                            <SelectItem value="MECANICA" className="text-xs">Oficina</SelectItem>
                            <SelectItem value="GERENCIA" className="text-xs">Gerência</SelectItem>
                            <SelectItem value="ADMINISTRATIVO" className="text-xs">Administrativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={comissao.valorPadrao || 0}
                          onChange={(e) =>
                            atualizarTipoComissao(comissao.id, 'valorPadrao', e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removerTipoComissao(comissao.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PanelCard>
        </form>
      </TabTransition>
    </ErrorBoundary>
  )}

      {/* Modal de Holerite */}
      {holeriteSelecionado && (
        <HoleriteModal
          dados={{
            empresa: holeriteSelecionado.empresa || empresaHook,
            funcionario: holeriteSelecionado.funcionario,
            folha: holeriteSelecionado.folha,
            isPago:
              (folhas.find((f) => f.funcionarioId === holeriteSelecionado.funcionario?.id)
                ?.rawStatus || holeriteSelecionado.rawPayslip?.status) === 'pago',
            dataPagamento:
              folhas.find((f) => f.funcionarioId === holeriteSelecionado.funcionario?.id)
                ?.rawPayslip?.payment_date ||
              holeriteSelecionado.rawPayslip?.payment_date ||
              null,
            onTogglePago: () => {
              const funcId = holeriteSelecionado.funcionario?.id;
              const itemAtual =
                (funcId ? folhas.find((f) => f.funcionarioId === funcId) : null) || null;
              if (holeriteSelecionado.funcionario) {
                handleMarcarPago(
                  itemAtual,
                  holeriteSelecionado.funcionario,
                  holeriteSelecionado.variaveis || itemAtual?.variaveisEntrada || {},
                );
              }
            },
            onDownloadPdf: () => {
              if (holeriteSelecionado.funcionario) {
                const funcId = holeriteSelecionado.funcionario.id;
                handleDownloadPdf(
                  holeriteSelecionado.funcionario,
                  holeriteSelecionado.variaveis || {},
                  (funcId ? folhas.find((f) => f.funcionarioId === funcId) : null) || null,
                );
              }
            },
            onSendWhatsapp: () => {
              if (holeriteSelecionado.funcionario && holeriteSelecionado.folha) {
                handleSendWhatsapp(
                  holeriteSelecionado.funcionario,
                  holeriteSelecionado.folha,
                  holeriteSelecionado.rawPayslip,
                );
              }
            },
            onSalvarEmpresa: async (novaConfig: Partial<EmpresaFolhaConfig>) => {
              await salvarEmpresaConfig(novaConfig);
              setHoleriteSelecionado((prev) =>
                prev
                  ? {
                      ...prev,
                      empresa: { ...(prev.empresa || empresaHook), ...novaConfig },
                    }
                  : null,
              );
            },
          }}
          onClose={() => setHoleriteSelecionado(null)}
        />
      )}

      {/* Modal de Lançamentos Mensais */}
      {colaboradorLancamento && colaboradorLancamento.funcionario && (
        <LancamentoVariaveisModal
          funcionario={colaboradorLancamento.funcionario}
          variaveisIniciais={colaboradorLancamento.variaveisIniciais}
          mesReferencia={mesReferencia}
          empresa={
            obterConfigParaLoja(
              colaboradorLancamento.funcionario.store_id ||
              resolveSaleStore({ vendedor: colaboradorLancamento.funcionario.nome }, perfisSistema).storeId
            )
          }
          regrasComissao={
            (() => {
              const sId =
                colaboradorLancamento.funcionario.store_id ||
                resolveSaleStore({ vendedor: colaboradorLancamento.funcionario.nome }, perfisSistema).storeId;
              const cfg = obterConfigParaLoja(sId);
              return (
                cfg.regrasPorCargo?.[colaboradorLancamento.funcionario.cargoId]?.faixasMotos ||
                cfg.regrasComissao
              );
            })()
          }
          vendasSistema={obterVendasSistemaColaborador(colaboradorLancamento.funcionario)}
          onSalvar={async (vars) => {
            if (colaboradorLancamento?.funcionario) {
              await salvarFolhaFuncionario(colaboradorLancamento.funcionario, vars);
              toast({
                title: 'Folha atualizada',
                description: `Lançamentos de ${colaboradorLancamento.funcionario.nome} salvos.`,
              });
            }
          }}
          onClose={() => setColaboradorLancamento(null)}
        />
      )}
    </div>
  );
}

/* ─── INVOICES TAB (Preserved from original Payroll module) ─── */

function InvoicesTab() {
  const { data: invoices, isLoading } = useInvoices();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const del = useDeleteInvoice();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova nota fiscal
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : (invoices || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Nenhuma nota fiscal emitida.
                  </TableCell>
                </TableRow>
              ) : (
                (invoices || []).map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm capitalize">{inv.invoice_type}</TableCell>
                    <TableCell className="text-sm">{inv.customer_name}</TableCell>
                    <TableCell className="text-sm">
                      {inv.issue_date && !isNaN(new Date(inv.issue_date).getTime())
                        ? new Date(inv.issue_date).toLocaleDateString('pt-BR')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-primary">
                      {fmt(inv.total)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          inv.status === 'emitida'
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => downloadInvoicePDF(inv)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditing(inv);
                            setOpen(true);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(inv)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <InvoiceDialog open={open} onOpenChange={setOpen} invoice={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover nota fiscal?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTarget &&
                del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
              }
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InvoiceDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoice: Invoice | null;
}) {
  const { data: stores } = useStores();
  const upsert = useUpsertInvoice();

  const [form, setForm] = useState({
    invoice_type: 'servico' as 'servico' | 'produto',
    issue_date: new Date().toISOString().slice(0, 10),
    store_id: '',
    customer_name: '',
    customer_document: '',
    customer_address: '',
    customer_email: '',
    customer_phone: '',
    tax_rate: '0',
    status: 'emitida' as 'emitida' | 'cancelada',
    notes: '',
  });
  const [items, setItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    if (invoice) {
      setForm({
        invoice_type: invoice.invoice_type,
        issue_date: invoice.issue_date,
        store_id: invoice.store_id || '',
        customer_name: invoice.customer_name,
        customer_document: invoice.customer_document || '',
        customer_address: invoice.customer_address || '',
        customer_email: invoice.customer_email || '',
        customer_phone: invoice.customer_phone || '',
        tax_rate: String(invoice.tax_rate || 0),
        status: invoice.status,
        notes: invoice.notes || '',
      });
      setItems(Array.isArray(invoice.items) ? invoice.items : []);
    } else if (open) {
      setForm({
        invoice_type: 'servico',
        issue_date: new Date().toISOString().slice(0, 10),
        store_id: '',
        customer_name: '',
        customer_document: '',
        customer_address: '',
        customer_email: '',
        customer_phone: '',
        tax_rate: '0',
        status: 'emitida',
        notes: '',
      });
      setItems([{ description: '', quantity: 1, unit_value: 0 }]);
    }
  }, [invoice, open]);

  const subtotal = items.reduce(
    (s, i) => s + Number(i.quantity || 0) * Number(i.unit_value || 0),
    0,
  );
  const taxValue = subtotal * (Number(form.tax_rate) / 100);
  const total = subtotal + taxValue;

  const save = async () => {
    if (!form.customer_name || items.length === 0) return;
    await upsert.mutateAsync({
      ...(invoice ? { id: invoice.id } : {}),
      invoice_type: form.invoice_type,
      issue_date: form.issue_date,
      store_id: form.store_id || null,
      customer_name: form.customer_name,
      customer_document: form.customer_document ? unmaskValue(form.customer_document) : null,
      customer_address: form.customer_address || null,
      customer_email: form.customer_email || null,
      customer_phone: form.customer_phone || null,
      items,
      tax_rate: Number(form.tax_rate) || 0,
      status: form.status,
      notes: form.notes || null,
    } as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice ? 'Editar nota fiscal' : 'Nova nota fiscal'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={form.invoice_type}
                onValueChange={(v: any) => setForm({ ...form, invoice_type: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="servico">Serviço</SelectItem>
                  <SelectItem value="produto">Produto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Emissão *</Label>
              <Input
                type="date"
                value={form.issue_date}
                onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Loja emitente</Label>
              <Select
                value={form.store_id}
                onValueChange={(v) => setForm({ ...form, store_id: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {stores
                    ?.filter((s) => s.is_active)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium">Cliente</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Nome / Razão Social *</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CPF/CNPJ</Label>
                <Input
                  value={form.customer_document}
                  onChange={(e) =>
                    setForm({ ...form, customer_document: maskCPFCNPJ(e.target.value) })
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: maskPhone(e.target.value) })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Endereço</Label>
                <Input
                  value={form.customer_address}
                  onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">E-mail</Label>
                <Input
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Itens</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setItems([...items, { description: '', quantity: 1, unit_value: 0 }])
                }
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar item
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum item adicionado.</p>
            ) : (
              items.map((it, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_80px_120px_auto] gap-2 items-end"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      value={it.description}
                      onChange={(e) => {
                        const v = [...items];
                        v[i] = { ...it, description: e.target.value };
                        setItems(v);
                      }}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Qtd</Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={it.quantity}
                      onChange={(e) => {
                        const v = [...items];
                        v[i] = { ...it, quantity: Number(e.target.value) || 0 };
                        setItems(v);
                      }}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor unitário</Label>
                    <Input
                      value={maskCurrency(Number(it.unit_value))}
                      onChange={(e) => {
                        const v = [...items];
                        v[i] = { ...it, unit_value: parseCurrency(e.target.value) };
                        setItems(v);
                      }}
                      className="h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-destructive"
                    onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4 grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Imposto (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v: any) => setForm({ ...form, status: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emitida">Emitida</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>

          <Card className="bg-muted/40">
            <CardContent className="p-3 text-sm grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="font-medium">{fmt(subtotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Imposto</p>
                <p className="font-medium">{fmt(taxValue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-semibold text-primary text-base">{fmt(total)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={save}
            disabled={upsert.isPending || !form.customer_name || items.length === 0}
          >
            {upsert.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}