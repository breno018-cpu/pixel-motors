import React, { useState } from 'react';
import {
  Save,
  Clock,
  AlertCircle,
  X,
  Bike,
  Wrench,
  Trophy,
  Receipt,
  DollarSign,
  Plus,
  RefreshCw,
  BookOpen,
  StickyNote,
  FileText,
  Trash2,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  EmpresaFolhaConfig,
  FaixaComissaoMoto,
  VariaveisFolhaEntrada,
  TipoComissaoCatalogo,
  calcularFolhaFuncionario,
  calcularInsalubridade,
} from '@/lib/folhaCalculos';
import { FuncionarioConcessionaria } from '@/hooks/useFolhaConcessionaria';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LancamentoVariaveisModalProps {
  funcionario: FuncionarioConcessionaria;
  variaveisIniciais?: VariaveisFolhaEntrada;
  mesReferencia: string;
  regrasComissao?: FaixaComissaoMoto[];
  empresa: EmpresaFolhaConfig;
  vendasSistema?: {
    motosVendidas: number;
    carrosVendidos: number;
    totalContratos: number;
    motosMarketingLoja: number;
    motosMarketingProprio: number;
    valorTotalVendido: number;
    motosLojaGerente: number;
    comissaoRetorno?: number;
    comissaoMotoParceiro?: number;
    motoParceiroQtd?: number;
    comissoesCatalogo?: Array<{
      id: string;
      nome: string;
      tipo: string;
      referencia: string;
      valor: number;
    }>;
    motosMontadas?: number;
    bateuMeta?: boolean;
    bonusMeta?: number;
  };
  onSalvar: (variaveis: VariaveisFolhaEntrada) => Promise<void> | void;
  onClose: () => void;
}

export default function LancamentoVariaveisModal({
  funcionario,
  variaveisIniciais,
  mesReferencia,
  regrasComissao,
  empresa,
  vendasSistema,
  onSalvar,
  onClose,
}: LancamentoVariaveisModalProps) {
  if (!funcionario) return null;

  const regraDoCargo = empresa?.regrasPorCargo?.[funcionario.cargoId];

  const valorPadraoMontagem =
    regraDoCargo?.valorPorMotoMontada ??
    empresa?.regrasComissoesCargos?.mecanico?.valorPorMotoMontada ??
    40;
  const valorPadraoRevisao =
    regraDoCargo?.valorPorRevisaoExecutada ??
    empresa?.regrasComissoesCargos?.mecanico?.valorPorRevisao ??
    25;
  const valorPadraoGerentePorMoto =
    regraDoCargo?.valorPorMotoVendidaLojaGerente ??
    empresa?.regrasComissoesCargos?.gerente?.valorPorMotoVendidaLoja ??
    20;
  const valorPadraoMktProprio =
    regraDoCargo?.valorMarketingProprioPorMoto ??
    empresa?.regrasComissoesCargos?.vendedorPlus?.valorMarketingProprio ??
    500;
  const valorPadraoMotoParceiroUn =
    regraDoCargo?.comissaoMotoParceiroPorUnidade ?? 150;
  const bonusMetaPadraoCargo =
    regraDoCargo?.bonusMetaAtingida ??
    empresa?.regrasComissoesCargos?.gerente?.bonusMetaGlobal ??
    0;

  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<VariaveisFolhaEntrada>({
    motosVendidas: variaveisIniciais?.motosVendidas ?? 0,
    motosMarketingLoja: variaveisIniciais?.motosMarketingLoja ?? 0,
    motosMarketingProprio: variaveisIniciais?.motosMarketingProprio ?? 0,
    valorMarketingProprio:
      variaveisIniciais?.valorMarketingProprio ?? valorPadraoMktProprio,
    vendasTotalReais: variaveisIniciais?.vendasTotalReais ?? vendasSistema?.valorTotalVendido ?? 0,
    motosMontadas: variaveisIniciais?.motosMontadas ?? 0,
    valorPorMontagem:
      variaveisIniciais?.valorPorMontagem !== undefined
        ? variaveisIniciais.valorPorMontagem
        : valorPadraoMontagem,
    revisoesExecutadas: variaveisIniciais?.revisoesExecutadas ?? 0,
    valorPorRevisao:
      variaveisIniciais?.valorPorRevisao !== undefined
        ? variaveisIniciais.valorPorRevisao
        : valorPadraoRevisao,
    comissaoServicos: variaveisIniciais?.comissaoServicos ?? 0,
    comissaoGeral: variaveisIniciais?.comissaoGeral ?? 0,
    descricaoComissaoGeral: variaveisIniciais?.descricaoComissaoGeral ?? '',
    comissoesDetalhadas: variaveisIniciais?.comissoesDetalhadas ?? [],
    cadernoAnotacoes: variaveisIniciais?.cadernoAnotacoes ?? '',
    horas50: variaveisIniciais?.horas50 ?? 0,
    horas100: variaveisIniciais?.horas100 ?? 0,
    horasNoturnas: variaveisIniciais?.horasNoturnas ?? 0,
    diasUteis: variaveisIniciais?.diasUteis ?? 25,
    domingosEFeriados: variaveisIniciais?.domingosEFeriados ?? 5,
    faltasDias: variaveisIniciais?.faltasDias ?? 0,
    atrasosMinutos: variaveisIniciais?.atrasosMinutos ?? 0,
    outrosProventos: variaveisIniciais?.outrosProventos ?? 0,
    outrosProventosDescricao: variaveisIniciais?.outrosProventosDescricao ?? '',
    ajudaDeCusto:
      variaveisIniciais?.ajudaDeCusto !== undefined
        ? variaveisIniciais.ajudaDeCusto
        : (regraDoCargo?.ajudaDeCustoIsentaPadrao ?? 0),
    ajudaDeCustoDescricao: variaveisIniciais?.ajudaDeCustoDescricao ?? '',
    reembolsoDespesas: variaveisIniciais?.reembolsoDespesas ?? 0,
    reembolsoDespesasDescricao: variaveisIniciais?.reembolsoDespesasDescricao ?? '',
    gastosDiversos: variaveisIniciais?.gastosDiversos ?? 0,
    gastosDiversosDescricao: variaveisIniciais?.gastosDiversosDescricao ?? '',
    comissaoMotoParceiro: variaveisIniciais?.comissaoMotoParceiro ?? 0,
    motoParceiroQtd: variaveisIniciais?.motoParceiroQtd ?? 0,
    motoParceiroDescricao: variaveisIniciais?.motoParceiroDescricao ?? '',
    comissaoRetorno: variaveisIniciais?.comissaoRetorno ?? 0,
    retornoDescricao: variaveisIniciais?.retornoDescricao ?? '',
    outrosDescontos: variaveisIniciais?.outrosDescontos ?? 0,
    outrosDescontosDescricao: variaveisIniciais?.outrosDescontosDescricao ?? '',
    pensaoAlimenticia: variaveisIniciais?.pensaoAlimenticia ?? 0,
    motosLojaGerente: variaveisIniciais?.motosLojaGerente ?? 0,
    valorComissaoGerentePorMoto:
      variaveisIniciais?.valorComissaoGerentePorMoto ?? valorPadraoGerentePorMoto,
    comissaoTreinamento: variaveisIniciais?.comissaoTreinamento ?? 0,
    comissaoTreinamentoDescricao: variaveisIniciais?.comissaoTreinamentoDescricao ?? '',
    bonusMetaBatida:
      variaveisIniciais?.bonusMetaBatida ??
      variaveisIniciais?.bonusMetas ??
      (vendasSistema?.bateuMeta ? vendasSistema.bonusMeta || bonusMetaPadraoCargo : 0),
    bonusMetas:
      variaveisIniciais?.bonusMetas ??
      variaveisIniciais?.bonusMetaBatida ??
      (vendasSistema?.bateuMeta ? vendasSistema.bonusMeta || bonusMetaPadraoCargo : 0),
  });

  const cargoLower = (funcionario.cargo || '').toLowerCase();
  const depLower = (funcionario.departamento || '').toLowerCase();
  const isVendedorPlus =
    funcionario.modeloComissaoVendedor === 'PLUS' ||
    regraDoCargo?.modeloComissao === 'PLUS' ||
    cargoLower.includes('+') ||
    cargoLower.includes('plus');
  const isPercentual =
    (funcionario.modeloComissaoVendedor === 'PERCENTUAL' ||
      regraDoCargo?.modeloComissao === 'PERCENTUAL') &&
    Number(funcionario.commissionRate || regraDoCargo?.aliquotaPercentualVendas) > 0;

  const tabelaParaCalculo =
    regraDoCargo?.faixasMotos && regraDoCargo.faixasMotos.length > 0
      ? regraDoCargo.faixasMotos
      : isVendedorPlus &&
          empresa?.regrasComissoesCargos?.vendedorPlus?.faixasMarketingLoja?.length > 0
        ? empresa.regrasComissoesCargos.vendedorPlus.faixasMarketingLoja
        : regrasComissao && regrasComissao.length > 0
          ? regrasComissao
          : [
              { de: 1, ate: 5, valorPorMoto: 50 },
              { de: 6, ate: 10, valorPorMoto: 75 },
              { de: 11, ate: 20, valorPorMoto: 100 },
              { de: 21, ate: 60, valorPorMoto: 150 },
              { de: 61, ate: 9999, valorPorMoto: 200 },
            ];

  const qtdMotosLoja = Number(form.motosMarketingLoja) || 0;
  const qtdMotosProprio = Number(form.motosMarketingProprio) || 0;
  const valorUnitProprio = Number(form.valorMarketingProprio) || 500;

  const qtdMotos =
    isVendedorPlus && (qtdMotosLoja > 0 || qtdMotosProprio > 0)
      ? qtdMotosLoja + qtdMotosProprio
      : Number(form.motosVendidas) || 0;

  const qtdMotosCalculoFaixa =
    isVendedorPlus && (qtdMotosLoja > 0 || qtdMotosProprio > 0) ? qtdMotosLoja : qtdMotos;
  let faixaEncontrada = tabelaParaCalculo.find(
    (r) => qtdMotosCalculoFaixa >= r.de && qtdMotosCalculoFaixa <= r.ate,
  );
  if (!faixaEncontrada && qtdMotosCalculoFaixa > 0) {
    faixaEncontrada = tabelaParaCalculo[tabelaParaCalculo.length - 1];
  }
  const valorUnitario = faixaEncontrada ? faixaEncontrada.valorPorMoto : 0;

  const comissaoMotosLojaPrevia = isPercentual
    ? +(((Number(form.vendasTotalReais) || 0) * Number(funcionario.commissionRate)) / 100).toFixed(
        2,
      )
    : qtdMotosCalculoFaixa * valorUnitario;
  const comissaoMotosProprioPrevia =
    !isPercentual && isVendedorPlus ? qtdMotosProprio * valorUnitProprio : 0;
  const comissaoMotosPrevia = comissaoMotosLojaPrevia + comissaoMotosProprioPrevia;

  const qtdMontagens = Number(form.motosMontadas) || 0;
  const valorUnitMontagem = Number(form.valorPorMontagem) || 0;
  const comissaoMontagemPrevia = qtdMontagens * valorUnitMontagem;

  const qtdRevisoes = Number(form.revisoesExecutadas) || 0;
  const valorUnitRevisao = Number(form.valorPorRevisao) || 0;
  const comissaoRevisoesPrevia = qtdRevisoes * valorUnitRevisao;

  const comissaoServicosPrevia = Number(form.comissaoServicos) || 0;
  const comissaoGeralPrevia = Number(form.comissaoGeral) || 0;
  const bonusMetaPrevia = Number(form.bonusMetaBatida ?? form.bonusMetas) || 0;
  const comissaoMotoParceiroPrevia = Number(form.comissaoMotoParceiro) || 0;
  const comissaoRetornoPrevia = Number(form.comissaoRetorno) || 0;
  const totalComissoesCustomPrevia = (form.comissoesDetalhadas || []).reduce(
    (acc, c) => acc + (Number(c.valor) || 0),
    0,
  );
  const comissaoTreinamentoPrevia = Number(form.comissaoTreinamento) || 0;

  const totalTodasComissoes =
    comissaoMotosPrevia +
    comissaoMontagemPrevia +
    comissaoRevisoesPrevia +
    comissaoServicosPrevia +
    comissaoGeralPrevia +
    bonusMetaPrevia +
    comissaoMotoParceiroPrevia +
    comissaoRetornoPrevia +
    totalComissoesCustomPrevia +
    comissaoTreinamentoPrevia;

  const pagarDSR = Number(funcionario.pagarDSRComissao) === 1;
  const dsrComissaoPrevia =
    pagarDSR && (form.diasUteis || 25) > 0
      ? +((totalTodasComissoes / (form.diasUteis || 25)) * (form.domingosEFeriados || 5)).toFixed(2)
      : 0;

  const handlePuxarVendasDoSistema = () => {
    if (!vendasSistema) return;
    if (isVendedorPlus) {
      setForm((prev) => ({
        ...prev,
        motosMarketingLoja: vendasSistema.motosMarketingLoja,
        motosMarketingProprio: vendasSistema.motosMarketingProprio,
        motosVendidas: vendasSistema.motosMarketingLoja + vendasSistema.motosMarketingProprio,
        vendasTotalReais: vendasSistema.valorTotalVendido,
        comissaoRetorno:
          (vendasSistema.comissaoRetorno || 0) > 0
            ? vendasSistema.comissaoRetorno!
            : prev.comissaoRetorno,
        comissaoMotoParceiro:
          (vendasSistema.comissaoMotoParceiro || 0) > 0
            ? vendasSistema.comissaoMotoParceiro!
            : prev.comissaoMotoParceiro,
        motoParceiroQtd:
          (vendasSistema.motoParceiroQtd || 0) > 0
            ? vendasSistema.motoParceiroQtd!
            : prev.motoParceiroQtd,
        comissoesDetalhadas:
          vendasSistema.comissoesCatalogo && vendasSistema.comissoesCatalogo.length > 0
            ? vendasSistema.comissoesCatalogo
            : prev.comissoesDetalhadas,
        bonusMetaBatida: vendasSistema.bateuMeta ? vendasSistema.bonusMeta : prev.bonusMetaBatida,
        bonusMetas: vendasSistema.bateuMeta ? vendasSistema.bonusMeta : prev.bonusMetas,
      }));
    } else {
      const totalVendas = vendasSistema.totalContratos || vendasSistema.motosVendidas;
      const valorGerente = Number(form.valorComissaoGerentePorMoto) || valorPadraoGerentePorMoto;
      setForm((prev) => ({
        ...prev,
        motosVendidas: totalVendas,
        motosMontadas:
          (vendasSistema.motosMontadas || 0) > 0
            ? vendasSistema.motosMontadas!
            : prev.motosMontadas,
        motosLojaGerente: vendasSistema.motosLojaGerente,
        comissaoGeral:
          funcionario.departamento === 'GERENCIA'
            ? +(vendasSistema.motosLojaGerente * valorGerente).toFixed(2)
            : prev.comissaoGeral,
        vendasTotalReais: vendasSistema.valorTotalVendido,
        comissaoRetorno:
          (vendasSistema.comissaoRetorno || 0) > 0
            ? vendasSistema.comissaoRetorno!
            : prev.comissaoRetorno,
        comissaoMotoParceiro:
          (vendasSistema.comissaoMotoParceiro || 0) > 0
            ? vendasSistema.comissaoMotoParceiro!
            : prev.comissaoMotoParceiro,
        motoParceiroQtd:
          (vendasSistema.motoParceiroQtd || 0) > 0
            ? vendasSistema.motoParceiroQtd!
            : prev.motoParceiroQtd,
        comissoesDetalhadas:
          vendasSistema.comissoesCatalogo && vendasSistema.comissoesCatalogo.length > 0
            ? vendasSistema.comissoesCatalogo
            : prev.comissoesDetalhadas,
        bonusMetaBatida: vendasSistema.bateuMeta ? vendasSistema.bonusMeta : prev.bonusMetaBatida,
        bonusMetas: vendasSistema.bateuMeta ? vendasSistema.bonusMeta : prev.bonusMetas,
      }));
    }
  };

  const handleAdicionarComissaoDoCatalogo = (tipoCatalogo: TipoComissaoCatalogo) => {
    const nova = {
      id: Date.now().toString(),
      nome: tipoCatalogo.nome,
      tipo: tipoCatalogo.tipo,
      referencia:
        tipoCatalogo.tipo === 'POR_UNIDADE'
          ? `1 un x R$ ${tipoCatalogo.valorPadrao}`
          : tipoCatalogo.tipo === 'PERCENTUAL'
            ? `${tipoCatalogo.valorPadrao}%`
            : '1 un',
      valor: tipoCatalogo.valorPadrao || 0,
      observacao: '',
    };
    setForm({
      ...form,
      comissoesDetalhadas: [...(form.comissoesDetalhadas || []), nova],
    });
  };

  const handleAdicionarItemLivre = () => {
    const nova = {
      id: Date.now().toString(),
      nome: '',
      tipo: 'VALOR_FIXO',
      referencia: '1 un',
      valor: 0,
      observacao: '',
    };
    setForm({
      ...form,
      comissoesDetalhadas: [...(form.comissoesDetalhadas || []), nova],
    });
  };

  const handleRemoverComissaoCustom = (index: number) => {
    const novas = (form.comissoesDetalhadas || []).filter((_, idx) => idx !== index);
    setForm({ ...form, comissoesDetalhadas: novas });
  };

  const handleAlterarComissaoCustom = (index: number, campo: string, val: any) => {
    const novas = [...(form.comissoesDetalhadas || [])];
    novas[index] = { ...novas[index], [campo]: campo === 'valor' ? Number(val) : val };
    setForm({ ...form, comissoesDetalhadas: novas });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await onSalvar(form);
      onClose();
    } finally {
      setSalvando(false);
    }
  };

  const isMecanico =
    depLower === 'mecanica' ||
    cargoLower.includes('mecân') ||
    cargoLower.includes('mecan') ||
    cargoLower.includes('oficin');
  const isVendedor =
    depLower === 'vendas' ||
    cargoLower.includes('vend') ||
    cargoLower.includes('comerc') ||
    cargoLower.includes('consultor');
  const isAdministrativo =
    depLower === 'administrativo' ||
    cargoLower.includes('admin') ||
    cargoLower.includes('financ') ||
    cargoLower.includes('caixa');
  const isGerencia =
    depLower === 'gerencia' ||
    cargoLower.includes('gerent') ||
    cargoLower.includes('diret') ||
    cargoLower.includes('superv');

  const getInitialCargoTab = () => {
    if (isVendedorPlus) return 'VENDEDOR_PLUS';
    if (isVendedor) return 'VENDAS';
    if (isMecanico) return 'MECANICA';
    if (isAdministrativo) return 'ADMINISTRATIVO';
    if (isGerencia) return 'GERENCIA';
    return 'TODOS';
  };

  const [cargoTab, setCargoTab] = useState(getInitialCargoTab);

  const catalogoEmpresa = empresa?.tiposComissoesLoja || [];
  const catalogoFiltrado = catalogoEmpresa.filter((item) => {
    if (!item.setor || item.setor === 'TODOS') return true;
    return item.setor === funcionario.departamento;
  });

  const formatMoney = (v: number) =>
    (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const adicionalInsalubridade = calcularInsalubridade(funcionario.grauInsalubridade || 'NENHUM');

  const previewFolha = calcularFolhaFuncionario({
    funcionario: { ...funcionario, regimeEmpresa: empresa?.regimeTributario },
    mesReferencia,
    regrasComissao: tabelaParaCalculo,
    ...form,
    optanteVT: Boolean(funcionario.optanteVT),
    custoValeTransporte: Number(funcionario.custoPassagemMensal) || 0,
    descontoValeRefeicao: Number(funcionario.descontoValeRefeicao) || 0,
    descontoPlanoSaude: Number(funcionario.descontoPlanoSaude) || 0,
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0 bg-card border-border/80">
        <DialogHeader className="px-6 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-center justify-between gap-4 pr-6">
            <div>
              <DialogTitle className="text-base font-display font-semibold tracking-tight text-foreground">
                Lançamento de Variáveis e Comissões
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {funcionario.nome} • <span className="font-medium text-foreground">{funcionario.cargo}</span> ({funcionario.departamento}) • Competência <span className="font-mono font-medium text-foreground">{mesReferencia}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <Badge variant="outline" className="text-[11px] font-mono">
                Base: {formatMoney(funcionario.salarioBase)}
              </Badge>
              {adicionalInsalubridade > 0 && (
                <Badge variant="outline" className="text-[11px] font-mono border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                  Insalubridade ({funcionario.grauInsalubridade}): +{formatMoney(adicionalInsalubridade)}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* BARRA DE SINCRONIZAÇÃO COM VENDAS DO SISTEMA */}
            {vendasSistema && (
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Dados apurados automaticamente nas vendas ({mesReferencia})
                  </div>
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    <span>Contratos: <strong className="text-foreground">{vendasSistema.totalContratos}</strong></span>
                    <span>Mkt Loja: <strong className="text-foreground">{vendasSistema.motosMarketingLoja}</strong></span>
                    <span>Captação Própria: <strong className="text-foreground">{vendasSistema.motosMarketingProprio}</strong></span>
                    {(vendasSistema.motosMontadas || 0) > 0 && (
                      <span>Montagens: <strong className="text-foreground">{vendasSistema.motosMontadas}</strong></span>
                    )}
                    {vendasSistema.bateuMeta && (
                      <span className="text-success font-medium">
                        Meta atingida (+{formatMoney(vendasSistema.bonusMeta || 0)})
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePuxarVendasDoSistema}
                  className="h-8 text-xs shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Sincronizar do Sistema
                </Button>
              </div>
            )}

            {/* SELETOR DE ESCOPO POR CARGO */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Comissões e Produtividade
                </span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: 'VENDEDOR_PLUS', label: 'Vendedor +' },
                    { id: 'VENDAS', label: 'Vendas Padrão' },
                    { id: 'MECANICA', label: 'Oficina' },
                    { id: 'ADMINISTRATIVO', label: 'Adm / F&I' },
                    { id: 'GERENCIA', label: 'Gerência' },
                    { id: 'TODOS', label: 'Todos' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCargoTab(tab.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        cargoTab === tab.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. VENDEDOR + */}
              {(cargoTab === 'VENDEDOR_PLUS' || (cargoTab === 'TODOS' && isVendedorPlus)) && (
                <div className="rounded-lg border border-border/70 bg-background p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-muted-foreground" />
                      Comissão Vendedor + (Mkt Loja vs Captação Própria)
                    </span>
                    <span className="text-xs font-mono font-semibold text-foreground">
                      Subtotal: {formatMoney(comissaoMotosPrevia)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-md border border-border/60 bg-muted/15 p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Motos Mkt da Loja (Escalão)</Label>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {qtdMotosLoja > 0 ? `${formatMoney(valorUnitario)}/un` : 'Faixa progressiva'}
                        </span>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        value={form.motosMarketingLoja}
                        onChange={(e) => {
                          const loja = Math.max(0, parseInt(e.target.value) || 0);
                          const prop = Number(form.motosMarketingProprio) || 0;
                          setForm({
                            ...form,
                            motosMarketingLoja: loja,
                            motosVendidas: loja + prop,
                          });
                        }}
                        className="h-9"
                      />
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {tabelaParaCalculo.map((r, idx) => {
                          const ativa = qtdMotosLoja >= r.de && qtdMotosLoja <= r.ate && qtdMotosLoja > 0;
                          return (
                            <span
                              key={idx}
                              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                ativa
                                  ? 'bg-primary/10 text-primary border-primary/30 font-semibold'
                                  : 'bg-background text-muted-foreground border-border/60'
                              }`}
                            >
                              {r.de}-{r.ate >= 999 ? '+' : r.ate}: R$ {r.valorPorMoto}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-md border border-border/60 bg-muted/15 p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Motos Captação Própria</Label>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          Total: {formatMoney(comissaoMotosProprioPrevia)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Qtd. Motos</Label>
                          <Input
                            type="number"
                            min="0"
                            value={form.motosMarketingProprio}
                            onChange={(e) => {
                              const prop = Math.max(0, parseInt(e.target.value) || 0);
                              const loja = Number(form.motosMarketingLoja) || 0;
                              setForm({
                                ...form,
                                motosMarketingProprio: prop,
                                motosVendidas: loja + prop,
                              });
                            }}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Valor Fixo/Un (R$)</Label>
                          <Input
                            type="number"
                            step="10"
                            value={form.valorMarketingProprio}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                valorMarketingProprio: Number(e.target.value) || 0,
                              })
                            }
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. VENDEDOR PADRÃO */}
              {(cargoTab === 'VENDAS' || (cargoTab === 'TODOS' && !isVendedorPlus)) && (
                <div className="rounded-lg border border-border/70 bg-background p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Bike className="w-3.5 h-3.5 text-muted-foreground" />
                      {isPercentual
                        ? `Comissão Percentual (${funcionario.commissionRate}% sobre vendas)`
                        : 'Comissão de Vendas por Faixa (Unidades)'}
                    </span>
                    <span className="text-xs font-mono font-semibold text-foreground">
                      Subtotal: {formatMoney(comissaoMotosPrevia)}
                    </span>
                  </div>

                  {isPercentual ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Volume Total de Vendas (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.vendasTotalReais}
                          onChange={(e) =>
                            setForm({ ...form, vendasTotalReais: Number(e.target.value) || 0 })
                          }
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Qtd. Contratos Fechados</Label>
                        <Input
                          type="number"
                          min="0"
                          value={form.motosVendidas}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              motosVendidas: Math.max(0, parseInt(e.target.value) || 0),
                            })
                          }
                          className="h-9"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Total de Veículos Vendidos</Label>
                        <Input
                          type="number"
                          min="0"
                          value={form.motosVendidas}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              motosVendidas: Math.max(0, parseInt(e.target.value) || 0),
                            })
                          }
                          className="h-9"
                        />
                      </div>
                      <div className="sm:col-span-2 flex flex-wrap gap-1.5 pb-1">
                        {tabelaParaCalculo.map((r, idx) => {
                          const ativa = qtdMotos >= r.de && qtdMotos <= r.ate && qtdMotos > 0;
                          return (
                            <span
                              key={idx}
                              className={`text-[11px] px-2 py-1 rounded border ${
                                ativa
                                  ? 'bg-primary/10 text-primary border-primary/30 font-semibold'
                                  : 'bg-muted/20 text-muted-foreground border-border/60'
                              }`}
                            >
                              {r.de} a {r.ate >= 999 ? '+' : r.ate} un: R$ {r.valorPorMoto}/un
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. OFICINA & MECÂNICO */}
              {(cargoTab === 'MECANICA' || cargoTab === 'TODOS') && (
                <div className="rounded-lg border border-border/70 bg-background p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
                      Oficina: Montagem de Motos 0km, Revisões e O.S.
                    </span>
                    <span className="text-xs font-mono font-semibold text-foreground">
                      Subtotal: {formatMoney(comissaoMontagemPrevia + comissaoRevisoesPrevia + comissaoServicosPrevia + comissaoTreinamentoPrevia)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Motos 0km Montadas</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.motosMontadas}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            motosMontadas: Math.max(0, parseInt(e.target.value) || 0),
                          })
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor por Montagem (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.valorPorMontagem}
                        onChange={(e) =>
                          setForm({ ...form, valorPorMontagem: Number(e.target.value) })
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Revisões Periódicas</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.revisoesExecutadas}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            revisoesExecutadas: Math.max(0, parseInt(e.target.value) || 0),
                          })
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor por Revisão (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.valorPorRevisao}
                        onChange={(e) =>
                          setForm({ ...form, valorPorRevisao: Number(e.target.value) })
                        }
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Comissão O.S. / Peças (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.comissaoServicos}
                        onChange={(e) =>
                          setForm({ ...form, comissaoServicos: Number(e.target.value) })
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Bônus Treinamento Técnico (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.comissaoTreinamento}
                        onChange={(e) =>
                          setForm({ ...form, comissaoTreinamento: Number(e.target.value) })
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Descrição do Curso / Certificação</Label>
                      <Input
                        type="text"
                        placeholder="Ex: Certificação Técnica / Treinamento"
                        value={form.comissaoTreinamentoDescricao}
                        onChange={(e) =>
                          setForm({ ...form, comissaoTreinamentoDescricao: e.target.value })
                        }
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 4. ADMINISTRATIVO / F&I / PARCERIAS */}
              {(cargoTab === 'ADMINISTRATIVO' ||
                cargoTab === 'VENDAS' ||
                cargoTab === 'VENDEDOR_PLUS' ||
                cargoTab === 'TODOS') && (
                <div className="rounded-lg border border-border/70 bg-background p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                      F&I, Moto Parceiro e Reembolsos / Ajudas de Custo
                    </span>
                    <span className="text-xs font-mono font-semibold text-foreground">
                      F&I + Parceiro: {formatMoney(comissaoRetornoPrevia + comissaoMotoParceiroPrevia)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-md border border-border/60 bg-muted/15 p-3 space-y-2">
                      <Label className="text-xs font-semibold">Comissão Retorno F&I / Bancos (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.comissaoRetorno}
                        onChange={(e) =>
                          setForm({ ...form, comissaoRetorno: Number(e.target.value) })
                        }
                        className="h-9"
                      />
                      <Input
                        type="text"
                        placeholder="Instituição / Operação (ex: Santander, BV)"
                        value={form.retornoDescricao}
                        onChange={(e) => setForm({ ...form, retornoDescricao: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="rounded-md border border-border/60 bg-muted/15 p-3 space-y-2">
                      <Label className="text-xs font-semibold">Comissão Moto Parceiro / Repasse</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          type="number"
                          min="0"
                          placeholder="Qtd"
                          value={form.motoParceiroQtd}
                          onChange={(e) => {
                            const qtd = Math.max(0, parseInt(e.target.value) || 0);
                            setForm({
                              ...form,
                              motoParceiroQtd: qtd,
                              comissaoMotoParceiro:
                                valorPadraoMotoParceiroUn > 0
                                  ? +(qtd * valorPadraoMotoParceiroUn).toFixed(2)
                                  : form.comissaoMotoParceiro,
                            });
                          }}
                          className="h-9 text-xs"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Valor R$"
                          value={form.comissaoMotoParceiro}
                          onChange={(e) =>
                            setForm({ ...form, comissaoMotoParceiro: Number(e.target.value) })
                          }
                          className="col-span-2 h-9"
                        />
                      </div>
                      <Input
                        type="text"
                        placeholder="Parceiro / Indicação"
                        value={form.motoParceiroDescricao}
                        onChange={(e) =>
                          setForm({ ...form, motoParceiroDescricao: e.target.value })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/50">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ajuda de Custo Isenta (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.ajudaDeCusto}
                        onChange={(e) =>
                          setForm({ ...form, ajudaDeCusto: Number(e.target.value) })
                        }
                        className="h-9"
                      />
                      <Input
                        type="text"
                        placeholder="Descrição (ex: Combustível / Deslocamento)"
                        value={form.ajudaDeCustoDescricao}
                        onChange={(e) =>
                          setForm({ ...form, ajudaDeCustoDescricao: e.target.value })
                        }
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Reembolso de Despesas (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.reembolsoDespesas}
                        onChange={(e) =>
                          setForm({ ...form, reembolsoDespesas: Number(e.target.value) })
                        }
                        className="h-9"
                      />
                      <Input
                        type="text"
                        placeholder="Descrição (ex: Cartório / Correios / Despachante)"
                        value={form.reembolsoDespesasDescricao}
                        onChange={(e) =>
                          setForm({ ...form, reembolsoDespesasDescricao: e.target.value })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. GERÊNCIA & METAS */}
              {(cargoTab === 'GERENCIA' || cargoTab === 'TODOS') && (
                <div className="rounded-lg border border-border/70 bg-background p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
                      Gerência: Volume da Loja e Bônus de Meta Mensal
                    </span>
                    <span className="text-xs font-mono font-semibold text-foreground">
                      Comissão Loja: {formatMoney(comissaoGeralPrevia)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Motos Vendidas pela Loja</Label>
                      <Input
                        type="number"
                        min="0"
                        value={form.motosLojaGerente}
                        onChange={(e) => {
                          const motos = Math.max(0, parseInt(e.target.value) || 0);
                          const valorUnit = Number(form.valorComissaoGerentePorMoto) || 0;
                          setForm({
                            ...form,
                            motosLojaGerente: motos,
                            comissaoGeral: +(motos * valorUnit).toFixed(2),
                          });
                        }}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor por Moto da Loja (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.valorComissaoGerentePorMoto}
                        onChange={(e) => {
                          const valorUnit = Number(e.target.value) || 0;
                          const motos = Number(form.motosLojaGerente) || 0;
                          setForm({
                            ...form,
                            valorComissaoGerentePorMoto: valorUnit,
                            comissaoGeral: +(motos * valorUnit).toFixed(2),
                          });
                        }}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Bônus de Meta Atingida (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.bonusMetaBatida ?? form.bonusMetas ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setForm({ ...form, bonusMetaBatida: val, bonusMetas: val });
                        }}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CADERNO DE ATIVIDADES & SERVIÇOS REALIZADOS */}
              <div className="rounded-lg border border-border/70 bg-background p-4 space-y-4">
                <div className="space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-primary" />
                      Caderno de Atividades & Serviços Realizados (Consórcio, Seguro, Acessórios)
                    </span>

                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={handleAdicionarItemLivre}
                      className="h-7 px-2.5 text-[11px] font-bold bg-primary text-primary-foreground shadow-xs gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Atividade / Serviço
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Especifique detalhadamente tudo o que foi realizado pelo colaborador. Os lançamentos serão exibidos no demonstrativo com a descrição exata, sem o termo comissão.
                  </p>
                </div>

                {catalogoFiltrado.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">
                      Atalhos rápidos:
                    </span>
                    {catalogoFiltrado.map((tipo) => (
                      <Button
                        key={tipo.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleAdicionarComissaoDoCatalogo(tipo)}
                        className="h-6 px-2 text-[10px] border-border/80 hover:bg-muted font-medium"
                      >
                        <Plus className="w-2.5 h-2.5 mr-1 text-primary" /> {tipo.nome}
                      </Button>
                    ))}
                  </div>
                )}

                {/* LISTA DE ITENS ESPECIFICADOS */}
                {!form.comissoesDetalhadas || form.comissoesDetalhadas.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 p-3.5 text-center">
                    <p className="text-xs text-muted-foreground">
                      Nenhum item específico adicionado. Use os atalhos acima ou clique em <strong>Adicionar Atividade / Serviço</strong> para registrar os itens realizados.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {form.comissoesDetalhadas.map((comissao, idx) => (
                      <div
                        key={idx}
                        className="space-y-1.5 bg-muted/20 p-2.5 rounded-lg border border-border/60"
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={comissao.nome}
                            onChange={(e) =>
                              handleAlterarComissaoCustom(idx, 'nome', e.target.value)
                            }
                            placeholder="Descrição do que foi feito (ex: Consórcio Grupo 45, Seguro Proteção, Venda Capacete)"
                            className="flex-1 h-8 text-xs font-medium"
                          />
                          <Input
                            type="text"
                            value={comissao.referencia || ''}
                            onChange={(e) =>
                              handleAlterarComissaoCustom(idx, 'referencia', e.target.value)
                            }
                            placeholder="Data / Ref (ex: 15/10 ou 2 un)"
                            className="w-32 h-8 text-xs text-center"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={comissao.valor}
                            onChange={(e) =>
                              handleAlterarComissaoCustom(idx, 'valor', e.target.value)
                            }
                            className="w-28 h-8 text-xs font-mono font-bold"
                            placeholder="R$ 0,00"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoverComissaoCustom(idx)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                            title="Remover este item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <Input
                          type="text"
                          value={comissao.observacao || ''}
                          onChange={(e) =>
                            handleAlterarComissaoCustom(idx, 'observacao', e.target.value)
                          }
                          placeholder="Anotação do caderno: cliente atendido, proposta, moto, detalhes adicionais..."
                          className="h-7 text-[11px] italic bg-background/50 border-dashed text-muted-foreground focus:text-foreground"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* BLOCO DO CADERNO DE ANOTAÇÕES GERAL (DIÁRIO DE BORDO DO COLABORADOR) */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-400 flex items-center gap-1.5">
                      <StickyNote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      Caderno de Anotações & Diário de Bordo do Colaborador (Geral do Mês)
                    </span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                      Registro de Atividades
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Caderno livre para registrar o histórico de tudo o que foi feito pelo colaborador no mês (atendimentos, suporte a clientes, tarefas cumpridas, metas e ocorrências).
                  </p>
                  <Textarea
                    value={form.cadernoAnotacoes || ''}
                    onChange={(e) => setForm({ ...form, cadernoAnotacoes: e.target.value })}
                    placeholder="Escreva aqui as anotações do colaborador como em um caderno pautado...&#10;Ex:&#10;- 08/10: Fechamento de consórcio Shineray para o cliente Marcos (cota contemplada)&#10;- 14/10: Atendimento e entrega técnica de 2 motos na oficina&#10;- 22/10: Apoio no treinamento de vendas e pós-venda"
                    className="min-h-[85px] text-xs font-sans bg-background/90 border-border/80 resize-y leading-relaxed"
                  />
                </div>

                <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Total de Atividades e Serviços: </span>
                    <strong className="font-mono text-foreground font-bold">{formatMoney(totalTodasComissoes)}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reflexo DSR: </span>
                    <strong className="font-mono text-foreground">
                      {pagarDSR ? formatMoney(dsrComissaoPrevia) : 'Isento'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* HORAS EXTRAS, FALTAS E OUTROS LANÇAMENTOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Horas Extras */}
              <div className="rounded-lg border border-border/70 bg-background p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Horas Extras e Calendário DSR
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px]">H.E. 50% (h)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={form.horas50}
                      onChange={(e) => setForm({ ...form, horas50: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">H.E. 100% (h)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={form.horas100}
                      onChange={(e) => setForm({ ...form, horas100: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Noturno (h)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={form.horasNoturnas}
                      onChange={(e) => setForm({ ...form, horasNoturnas: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-border/50">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Dias Úteis no Mês</Label>
                    <Input
                      type="number"
                      value={form.diasUteis}
                      onChange={(e) => setForm({ ...form, diasUteis: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Domingos / Feriados</Label>
                    <Input
                      type="number"
                      value={form.domingosEFeriados}
                      onChange={(e) =>
                        setForm({ ...form, domingosEFeriados: Number(e.target.value) })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Faltas e Atrasos */}
              <div className="rounded-lg border border-border/70 bg-background p-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Ausências, Adiantamentos e Descontos
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Faltas (Dias)</Label>
                    <Input
                      type="number"
                      value={form.faltasDias}
                      onChange={(e) => setForm({ ...form, faltasDias: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Atrasos (Min)</Label>
                    <Input
                      type="number"
                      value={form.atrasosMinutos}
                      onChange={(e) => setForm({ ...form, atrasosMinutos: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Pensão (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.pensaoAlimenticia}
                      onChange={(e) =>
                        setForm({ ...form, pensaoAlimenticia: Number(e.target.value) })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-border/50">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Outro Provento (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.outrosProventos}
                      onChange={(e) => setForm({ ...form, outrosProventos: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="text"
                      placeholder="Descrição do provento"
                      value={form.outrosProventosDescricao}
                      onChange={(e) =>
                        setForm({ ...form, outrosProventosDescricao: e.target.value })
                      }
                      className="h-7 text-[11px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Adiantamento / Desconto (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.outrosDescontos}
                      onChange={(e) => setForm({ ...form, outrosDescontos: Number(e.target.value) })}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="text"
                      placeholder="Ex: Vale / Adiantamento"
                      value={form.outrosDescontosDescricao}
                      onChange={(e) =>
                        setForm({ ...form, outrosDescontosDescricao: e.target.value })
                      }
                      className="h-7 text-[11px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 border-t border-border/60 bg-muted/20 shrink-0">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="text-[10px] uppercase text-muted-foreground block">Bruto Total</span>
                <strong className="font-mono text-foreground">{formatMoney(previewFolha.totalProventos)}</strong>
              </div>
              {adicionalInsalubridade > 0 && (
                <div>
                  <span className="text-[10px] uppercase text-muted-foreground block">Insalubridade</span>
                  <strong className="font-mono text-amber-600 dark:text-amber-400">+{formatMoney(adicionalInsalubridade)}</strong>
                </div>
              )}
              <div>
                <span className="text-[10px] uppercase text-muted-foreground block">Comissões + DSR</span>
                <strong className="font-mono text-primary">
                  {formatMoney((previewFolha.totalComissoes || 0) + (previewFolha.comissaoDSR || 0))}
                </strong>
              </div>
              <div>
                <span className="text-[10px] uppercase text-muted-foreground block">INSS / IRRF / Desc.</span>
                <strong className="font-mono text-destructive">-{formatMoney(previewFolha.totalDescontos)}</strong>
              </div>
              <div className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25">
                <span className="text-[10px] uppercase text-emerald-700 dark:text-emerald-400 font-semibold block">
                  Líquido a Pagar
                </span>
                <strong className="font-mono text-sm text-emerald-700 dark:text-emerald-400">
                  {formatMoney(previewFolha.salarioLiquido)}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={salvando}>
                <Save className="w-4 h-4 mr-1.5" />
                {salvando ? 'Processando...' : 'Recalcular e Salvar Folha'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
