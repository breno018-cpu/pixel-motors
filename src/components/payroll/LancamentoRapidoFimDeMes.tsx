import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Zap,
  Save,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Bike,
  Wrench,
  Trophy,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Users,
  Search,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  FuncionarioConcessionaria,
  FolhaMensalItem,
} from '@/hooks/useFolhaConcessionaria';
import {
  EmpresaFolhaConfig,
  VariaveisFolhaEntrada,
  ResultadoFolhaFuncionario,
  calcularFolhaFuncionario,
} from '@/lib/folhaCalculos';
import { resolveSaleStore } from '@/lib/storeResolution';

interface LancamentoRapidoFimDeMesProps {
  funcionarios: FuncionarioConcessionaria[];
  folhas: FolhaMensalItem[];
  empresa: EmpresaFolhaConfig;
  obterConfigParaLoja: (storeId?: string | null) => EmpresaFolhaConfig;
  obterVendasSistemaColaborador?: (func: FuncionarioConcessionaria) => any;
  stores: Array<{ id: string; name: string }>;
  mesReferencia: string;
  onSalvarFolha: (func: FuncionarioConcessionaria, vars: VariaveisFolhaEntrada) => Promise<any>;
  onAbrirHolerite: (item: {
    empresa: EmpresaFolhaConfig;
    funcionario: FuncionarioConcessionaria;
    folha: ResultadoFolhaFuncionario;
    variaveis?: VariaveisFolhaEntrada;
    rawPayslip?: any;
  }) => void;
  vendasMes?: any;
}

interface LinhaEntradaRapida {
  funcionarioId: string;
  motosLoja: number;
  motosProprio: number;
  montagens0km: number;
  revisoesFeitas: number;
  servicosOficina: number;
  motosVolumeLojaGerente: number;
  metaBatida: boolean;
  bonusAvulso: number;
  ajudaCusto: number;
  faltasDias: number;
  horasExtras50: number;
}

export function LancamentoRapidoFimDeMes({
  funcionarios = [],
  folhas = [],
  empresa,
  obterConfigParaLoja,
  obterVendasSistemaColaborador,
  stores = [],
  mesReferencia,
  onSalvarFolha,
  onAbrirHolerite,
  vendasMes,
}: LancamentoRapidoFimDeMesProps) {
  const { toast } = useToast();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');
  const [salvandoTodos, setSalvandoTodos] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroDepto, setFiltroDepto] = useState<string>('all');

  const buildEntradasMap = useCallback(() => {
    const map: Record<string, LinhaEntradaRapida> = {};

    funcionarios.forEach((f) => {
      const folhaExistente = folhas.find((p) => p.funcionarioId === f.id);
      const vars = folhaExistente?.variaveisEntrada;
      const storeId = f.store_id || resolveSaleStore({ vendedor: f.nome }).storeId;
      const configLoja = obterConfigParaLoja(storeId);
      const regraDoCargo = configLoja.regrasPorCargo?.[f.cargoId];

      if (vars) {
        map[f.id] = {
          funcionarioId: f.id,
          motosLoja: Number(vars.motosMarketingLoja ?? vars.motosVendidas) || 0,
          motosProprio: Number(vars.motosMarketingProprio) || 0,
          montagens0km: Number(vars.motosMontadas) || 0,
          revisoesFeitas: Number(vars.revisoesExecutadas) || 0,
          servicosOficina: Number(vars.comissaoServicos) || 0,
          motosVolumeLojaGerente: Number(vars.motosLojaGerente) || 0,
          metaBatida: Boolean(
            vars.metaBatida ||
              (vars.bonusMetaBatida && vars.bonusMetaBatida > 0) ||
              (vars.bonusMetas && vars.bonusMetas > 0),
          ),
          bonusAvulso: Number(vars.outrosProventos) || 0,
          ajudaCusto:
            vars.ajudaDeCusto !== undefined
              ? Number(vars.ajudaDeCusto) || 0
              : Number(regraDoCargo?.ajudaDeCustoIsentaPadrao) || 0,
          faltasDias: Number(vars.faltasDias) || 0,
          horasExtras50: Number(vars.horas50) || 0,
        };
      } else {
        const vendasAuto = obterVendasSistemaColaborador
          ? obterVendasSistemaColaborador(f)
          : null;
        const isPlus =
          f.modeloComissaoVendedor === 'PLUS' ||
          regraDoCargo?.modeloComissao === 'PLUS';

        map[f.id] = {
          funcionarioId: f.id,
          motosLoja:
            f.departamento === 'VENDAS'
              ? isPlus
                ? Number(vendasAuto?.motosMarketingLoja) || 0
                : Number(vendasAuto?.totalContratos || vendasAuto?.motosVendidas) || 0
              : 0,
          motosProprio:
            f.departamento === 'VENDAS' && isPlus
              ? Number(vendasAuto?.motosMarketingProprio) || 0
              : 0,
          montagens0km:
            f.departamento === 'MECANICA'
              ? Number(vendasAuto?.motosMontadas) || 0
              : 0,
          revisoesFeitas: 0,
          servicosOficina: 0,
          motosVolumeLojaGerente:
            f.departamento === 'GERENCIA'
              ? Number(vendasAuto?.motosLojaGerente) || 0
              : 0,
          metaBatida: Boolean(vendasAuto?.bateuMeta),
          bonusAvulso: 0,
          ajudaCusto: Number(regraDoCargo?.ajudaDeCustoIsentaPadrao) || 0,
          faltasDias: 0,
          horasExtras50: 0,
        };
      }
    });

    return map;
  }, [funcionarios, folhas, obterConfigParaLoja, empresa, obterVendasSistemaColaborador]);

  // Estado local das quantidades digitadas para cada colaborador
  const [entradas, setEntradas] = useState<Record<string, LinhaEntradaRapida>>(() =>
    buildEntradasMap(),
  );

  // Rastreia quais colaboradores tiveram campos editados pelo usuário
  const [dirtyFuncIds, setDirtyFuncIds] = useState<Set<string>>(new Set());

  // Mantém a grade sincronizada quando funcionários, folhas ou competência mudam,
  // mas preserva linhas que o usuário está ativamente editando e ainda não gravou
  useEffect(() => {
    const mapaAtualizado = buildEntradasMap();
    setEntradas((prev) => {
      const merged = { ...mapaAtualizado };
      dirtyFuncIds.forEach((id) => {
        if (prev[id]) {
          merged[id] = prev[id];
        }
      });
      return merged;
    });
  }, [buildEntradasMap, mesReferencia]);

  // Atualiza campo de um colaborador específico
  const handleInputChange = (
    funcId: string,
    field: keyof LinhaEntradaRapida,
    value: any,
  ) => {
    setDirtyFuncIds((prev) => {
      const copy = new Set(prev);
      copy.add(funcId);
      return copy;
    });
    setEntradas((prev) => ({
      ...prev,
      [funcId]: {
        ...(prev[funcId] || {
          funcionarioId: funcId,
          motosLoja: 0,
          motosProprio: 0,
          montagens0km: 0,
          revisoesFeitas: 0,
          servicosOficina: 0,
          motosVolumeLojaGerente: 0,
          metaBatida: false,
          bonusAvulso: 0,
          ajudaCusto: 0,
          faltasDias: 0,
          horasExtras50: 0,
        }),
        [field]: value,
      },
    }));
  };

  // Puxar Vendas Reais do Sistema Automaticamente
  const handlePuxarVendasAutomaticas = () => {
    let atualizados = 0;
    const next = { ...entradas };

    funcionarios.forEach((f) => {
      const vendasAuto = obterVendasSistemaColaborador
        ? obterVendasSistemaColaborador(f)
        : null;

      if (f.departamento === 'VENDAS') {
        const vendasVendedor = vendasAuto || vendasMes?.porProfile?.[f.profile_id || ''] || {};
        const isPlus = f.modeloComissaoVendedor === 'PLUS';
        next[f.id] = {
          ...(next[f.id] || { funcionarioId: f.id }),
          motosLoja: isPlus
            ? vendasVendedor.motosMarketingLoja || 0
            : vendasVendedor.totalContratos || vendasVendedor.motosVendidas || 0,
          motosProprio: isPlus ? vendasVendedor.motosMarketingProprio || 0 : 0,
          metaBatida: Boolean(vendasVendedor.bateuMeta || next[f.id]?.metaBatida),
        } as LinhaEntradaRapida;
        atualizados++;
      } else if (f.departamento === 'GERENCIA') {
        const motosTotalLoja =
          vendasAuto?.motosLojaGerente ??
          (f.store_id
            ? (vendasMes?.motosPorLoja?.[f.store_id] ?? vendasMes?.totalMotosGeral ?? 0)
            : (vendasMes?.totalMotosGeral ?? 0));

        next[f.id] = {
          ...(next[f.id] || { funcionarioId: f.id }),
          motosVolumeLojaGerente: motosTotalLoja,
          metaBatida: Boolean(vendasAuto?.bateuMeta || motosTotalLoja >= 20),
        } as LinhaEntradaRapida;
        atualizados++;
      } else if (f.departamento === 'MECANICA' && (vendasAuto?.motosMontadas || 0) > 0) {
        next[f.id] = {
          ...(next[f.id] || { funcionarioId: f.id }),
          montagens0km: vendasAuto.motosMontadas,
        } as LinhaEntradaRapida;
        atualizados++;
      }
    });

    setEntradas(next);
    toast({
      title: 'Vendas do Sistema Puxadas!',
      description: `Quantidades de vendas e montagens preenchidas para ${atualizados} colaboradores com base nos contratos registrados.`,
    });
  };

  // Filtra funcionários pela loja e departamento selecionados
  const funcionariosFiltrados = useMemo(() => {
    return funcionarios.filter((f) => {
      if (f.status === 'DEMITIDO') return false; // Exclui demitidos do lançamento mensal ativo
      if (selectedStoreId !== 'all' && f.store_id !== selectedStoreId) return false;
      if (filtroDepto !== 'all' && f.departamento !== filtroDepto) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        if (
          !f.nome.toLowerCase().includes(q) &&
          !f.cargo.toLowerCase().includes(q) &&
          !(f.cpf || '').includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [funcionarios, selectedStoreId, filtroDepto, searchTerm]);

  // Cálculos Ao Vivo da Grade de Colaboradores
  const linhasCalculadas = useMemo(() => {
    return funcionariosFiltrados.map((func) => {
      const storeId = func.store_id || resolveSaleStore({ vendedor: func.nome }).storeId;
      const configLoja = obterConfigParaLoja(storeId);
      const entrada = entradas[func.id] || {
        funcionarioId: func.id,
        motosLoja: 0,
        motosProprio: 0,
        montagens0km: 0,
        revisoesFeitas: 0,
        servicosOficina: 0,
        motosVolumeLojaGerente: 0,
        metaBatida: false,
        bonusAvulso: 0,
        ajudaCusto: 0,
        faltasDias: 0,
        horasExtras50: 0,
      };

      // Regras de comissão do cargo e da loja específica deste funcionário
      const regraDoCargo = configLoja.regrasPorCargo?.[func.cargoId];
      const regrasCargos = configLoja.regrasComissoesCargos;
      const valorMontagemPadrao =
        regraDoCargo?.valorPorMotoMontada ??
        regrasCargos?.mecanico?.valorPorMotoMontada ??
        40;
      const valorRevisaoPadrao =
        regraDoCargo?.valorPorRevisaoExecutada ??
        regrasCargos?.mecanico?.valorPorRevisao ??
        25;
      const valorGerentePorMoto =
        regraDoCargo?.valorPorMotoVendidaLojaGerente ??
        regrasCargos?.gerente?.valorPorMotoVendidaLoja ??
        20;
      const bonusMetaCargoValor =
        regraDoCargo?.bonusMetaAtingida ??
        regrasCargos?.gerente?.bonusMetaGlobal ??
        600;
      const bonusMetaAplicado = entrada.metaBatida ? bonusMetaCargoValor : 0;
      const valorMktProprio =
        regraDoCargo?.valorMarketingProprioPorMoto ??
        regrasCargos?.vendedorPlus?.valorMarketingProprio ??
        500;

      const varsEntrada: VariaveisFolhaEntrada = {
        motosMarketingLoja: entrada.motosLoja,
        motosMarketingProprio: entrada.motosProprio,
        valorMarketingProprio: valorMktProprio,
        motosVendidas: entrada.motosLoja + entrada.motosProprio,
        motosMontadas: entrada.montagens0km,
        valorPorMontagem: valorMontagemPadrao,
        revisoesExecutadas: entrada.revisoesFeitas,
        valorPorRevisao: valorRevisaoPadrao,
        comissaoServicos: entrada.servicosOficina,
        motosLojaGerente: entrada.motosVolumeLojaGerente,
        valorComissaoGerentePorMoto: valorGerentePorMoto,
        comissaoGeral:
          func.departamento === 'GERENCIA'
            ? +(entrada.motosVolumeLojaGerente * valorGerentePorMoto).toFixed(2)
            : 0,
        metaBatida: entrada.metaBatida,
        bonusMetaBatida: bonusMetaAplicado,
        bonusMetas: bonusMetaAplicado,
        outrosProventos: entrada.bonusAvulso,
        ajudaDeCusto: entrada.ajudaCusto,
        faltasDias: entrada.faltasDias,
        horas50: entrada.horasExtras50,
        optanteVT: Boolean(func.optanteVT),
        custoValeTransporte: Number(func.custoPassagemMensal) || 0,
        descontoValeRefeicao: Number(func.descontoValeRefeicao) || 0,
        descontoPlanoSaude: Number(func.descontoPlanoSaude) || 0,
      };

      const faixasCargo =
        regraDoCargo?.faixasMotos && regraDoCargo.faixasMotos.length > 0
          ? regraDoCargo.faixasMotos
          : func.modeloComissaoVendedor === 'PLUS'
            ? regrasCargos?.vendedorPlus?.faixasMarketingLoja || configLoja.regrasComissao
            : regrasCargos?.vendedorPadrao?.faixas || configLoja.regrasComissao;

      const resultado = calcularFolhaFuncionario({
        funcionario: { ...func, regimeEmpresa: configLoja.regimeTributario },
        mesReferencia,
        regrasComissao: faixasCargo,
        ...varsEntrada,
      });

      return {
        func,
        configLoja,
        regraDoCargo,
        bonusMetaCargoValor,
        entrada,
        varsEntrada,
        resultado,
      };
    });
  }, [funcionariosFiltrados, entradas, obterConfigParaLoja, empresa, mesReferencia]);

  // Totais Consolidados da Grade em Tempo Real
  const totaisGrade = useMemo(() => {
    let brutoTotal = 0;
    let liquidoTotal = 0;
    let comissoesTotal = 0;
    let encargosTotal = 0;
    let totalMotos = 0;
    let totalMontagens = 0;
    let totalRevisoes = 0;

    linhasCalculadas.forEach(({ resultado, entrada }) => {
      brutoTotal += resultado.totalProventos;
      liquidoTotal += resultado.salarioLiquido;
      comissoesTotal += resultado.totalComissoes;
      encargosTotal += resultado.fgts + resultado.inssPatronal;
      totalMotos += entrada.motosLoja + entrada.motosProprio;
      totalMontagens += entrada.montagens0km;
      totalRevisoes += entrada.revisoesFeitas;
    });

    return {
      brutoTotal,
      liquidoTotal,
      comissoesTotal,
      encargosTotal,
      totalMotos,
      totalMontagens,
      totalRevisoes,
      countColaboradores: linhasCalculadas.length,
    };
  }, [linhasCalculadas]);

  // Salvar Todos os Lançamentos do Mês
  const handleSalvarTodos = async () => {
    setSalvandoTodos(true);
    let salvos = 0;
    try {
      for (const item of linhasCalculadas) {
        await onSalvarFolha(item.func, item.varsEntrada);
        salvos++;
      }
      setDirtyFuncIds(new Set());
      toast({
        title: '✅ Folha de Fim de Mês Atualizada!',
        description: `Todos os ${salvos} colaboradores foram processados e os contracheques foram salvos com sucesso.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar lançamentos',
        description: err.message || 'Falha na gravação.',
      });
    } finally {
      setSalvandoTodos(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Bar Executiva: Seleção de Loja, Competência e Ações */}
      <div className="p-5 rounded-2xl border border-primary/20 bg-card/80 backdrop-blur-md shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground font-display flex items-center gap-2">
                Lançamento Rápido de Fim de Mês (Por Quantidade)
                <Badge className="bg-primary text-primary-foreground text-[10px] uppercase font-bold">
                  {mesReferencia}
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Informe apenas as quantidades realizadas por cada colaborador. O sistema calcula base, comissão da unidade e encargos ao vivo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePuxarVendasAutomaticas}
              className="h-9 text-xs gap-1.5 font-semibold bg-background"
            >
              <RefreshCw className="w-3.5 h-3.5 text-primary" />
              Puxar Vendas do Sistema
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSalvarTodos}
              disabled={salvandoTodos || linhasCalculadas.length === 0}
              className="h-9 text-xs gap-1.5 font-bold bg-primary text-primary-foreground shadow-sm shadow-primary/20"
            >
              <Save className="w-3.5 h-3.5" />
              {salvandoTodos ? 'Gravando no Banco...' : 'Salvar Todas as Folhas da Unidade'}
            </Button>
          </div>
        </div>

        {/* Filtros de Loja e Departamento */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/60">
          <div className="flex items-center gap-2 min-w-[220px]">
            <Label className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-primary" /> Unidade:
            </Label>
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="h-8 text-xs font-medium bg-background rounded-lg">
                <SelectValue placeholder="Selecione a loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🏢 Todas as Concessionárias</SelectItem>
                {stores.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    📍 {st.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 min-w-[180px]">
            <Label className="text-xs font-semibold text-muted-foreground shrink-0">
              Setor:
            </Label>
            <Select value={filtroDepto} onValueChange={setFiltroDepto}>
              <SelectTrigger className="h-8 text-xs font-medium bg-background rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Setores</SelectItem>
                <SelectItem value="VENDAS">Vendas (Comercial)</SelectItem>
                <SelectItem value="MECANICA">Oficina (Mecânicos)</SelectItem>
                <SelectItem value="GERENCIA">Gerência & Direção</SelectItem>
                <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar colaborador por nome, cargo ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs bg-background rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Cards de Resumo em Tempo Real */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Colaboradores
            </span>
            <div className="text-2xl font-black font-display text-foreground">
              {totaisGrade.countColaboradores}
            </div>
            <span className="text-[10px] text-muted-foreground">Na unidade selecionada</span>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
              Comissões da Loja
            </span>
            <div className="text-2xl font-black font-display text-primary">
              {totaisGrade.comissoesTotal.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 0,
              })}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {totaisGrade.totalMotos} motos • {totaisGrade.totalMontagens} mont. • {totaisGrade.totalRevisoes} rev.
            </span>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Folha Bruta Total
            </span>
            <div className="text-2xl font-black font-display text-foreground">
              {totaisGrade.brutoTotal.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 0,
              })}
            </div>
            <span className="text-[10px] text-muted-foreground">Salários + Comissões + DSR</span>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">
              Encargos (INSS/FGTS)
            </span>
            <div className="text-2xl font-black font-display text-amber-600">
              {totaisGrade.encargosTotal.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 0,
              })}
            </div>
            <span className="text-[10px] text-muted-foreground">Custo tributário patronal</span>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60">
          <CardContent className="p-3.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
              Líquido a Pagar
            </span>
            <div className="text-2xl font-black font-display text-emerald-600">
              {totaisGrade.liquidoTotal.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 0,
              })}
            </div>
            <span className="text-[10px] text-muted-foreground">Depósito bancário líquido</span>
          </CardContent>
        </Card>
      </div>

      {/* Grade / Tabela Interativa de Lançamento por Quantidades */}
      <Card className="border-border/60 bg-card/60 overflow-hidden shadow-xs">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Planilha de Quantidades do Mês
              </CardTitle>
              <CardDescription className="text-xs">
                Valores unitários puxados automaticamente das regras configuradas para a unidade de cada colaborador.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[11px] font-mono">
              {linhasCalculadas.length} colaboradores
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-56 text-xs">Colaborador & Unidade</TableHead>
                <TableHead className="text-xs">Salário Base</TableHead>
                <TableHead className="text-xs min-w-[280px]">
                  Quantidades do Mês (Só Digitar)
                </TableHead>
                <TableHead className="text-xs text-right">Comissões</TableHead>
                <TableHead className="text-xs text-right">Bruto</TableHead>
                <TableHead className="text-xs text-right font-bold text-emerald-600">
                  Líquido a Pagar
                </TableHead>
                <TableHead className="text-right w-24">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhasCalculadas.map(({ func, configLoja, regraDoCargo, bonusMetaCargoValor, entrada, varsEntrada, resultado }) => {
                const depto = func.departamento;
                const valorMontagemLoja =
                  regraDoCargo?.valorPorMotoMontada ??
                  configLoja.regrasComissoesCargos?.mecanico?.valorPorMotoMontada ??
                  40;
                const valorRevisaoLoja =
                  regraDoCargo?.valorPorRevisaoExecutada ??
                  configLoja.regrasComissoesCargos?.mecanico?.valorPorRevisao ??
                  25;
                const valorGerenteLoja =
                  regraDoCargo?.valorPorMotoVendidaLojaGerente ??
                  configLoja.regrasComissoesCargos?.gerente?.valorPorMotoVendidaLoja ??
                  20;

                return (
                  <TableRow key={func.id} className="hover:bg-muted/30 transition-colors">
                    {/* Colaborador & Unidade */}
                    <TableCell className="py-3">
                      <div>
                        <span className="font-bold text-xs text-foreground block">
                          {func.nome}
                        </span>
                        <span className="text-[11px] text-muted-foreground block">
                          {func.cargo}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {depto}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-2.5 h-2.5" />
                            {func.storeName}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Salário Base */}
                    <TableCell className="text-xs font-semibold text-foreground py-3">
                      {func.salarioBase.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </TableCell>

                    {/* Inputs de Quantidades Conforme o Cargo */}
                    <TableCell className="py-3">
                      {depto === 'VENDAS' && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Label className="text-[10px] text-muted-foreground">Motos Loja:</Label>
                            <Input
                              type="number"
                              min="0"
                              value={entrada.motosLoja}
                              onChange={(e) =>
                                handleInputChange(func.id, 'motosLoja', Number(e.target.value) || 0)
                              }
                              className="h-7 w-16 text-xs text-center font-bold"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <Label className="text-[10px] text-muted-foreground">Próprias:</Label>
                            <Input
                              type="number"
                              min="0"
                              value={entrada.motosProprio}
                              onChange={(e) =>
                                handleInputChange(func.id, 'motosProprio', Number(e.target.value) || 0)
                              }
                              className="h-7 w-16 text-xs text-center font-bold text-primary"
                            />
                          </div>
                        </div>
                      )}

                      {depto === 'MECANICA' && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Label className="text-[10px] text-muted-foreground" title={`R$ ${valorMontagemLoja}/un na loja`}>
                              Montagens 0km:
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              value={entrada.montagens0km}
                              onChange={(e) =>
                                handleInputChange(func.id, 'montagens0km', Number(e.target.value) || 0)
                              }
                              className="h-7 w-16 text-xs text-center font-bold"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <Label className="text-[10px] text-muted-foreground" title={`R$ ${valorRevisaoLoja}/un na loja`}>
                              Revisões Feitas:
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              value={entrada.revisoesFeitas}
                              onChange={(e) =>
                                handleInputChange(func.id, 'revisoesFeitas', Number(e.target.value) || 0)
                              }
                              className="h-7 w-16 text-xs text-center font-bold text-emerald-600"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <Label className="text-[10px] text-muted-foreground">Serviços R$:</Label>
                            <Input
                              type="number"
                              min="0"
                              value={entrada.servicosOficina}
                              onChange={(e) =>
                                handleInputChange(func.id, 'servicosOficina', Number(e.target.value) || 0)
                              }
                              className="h-7 w-20 text-xs text-center font-bold"
                            />
                          </div>
                        </div>
                      )}

                      {depto === 'GERENCIA' && (
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <Label className="text-[10px] text-muted-foreground" title={`R$ ${valorGerenteLoja}/moto vendida na loja`}>
                              Motos Vendidas na Loja:
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              value={entrada.motosVolumeLojaGerente}
                              onChange={(e) =>
                                handleInputChange(
                                  func.id,
                                  'motosVolumeLojaGerente',
                                  Number(e.target.value) || 0,
                                )
                              }
                              className="h-7 w-18 text-xs text-center font-bold"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Checkbox
                              id={`meta-${func.id}`}
                              checked={entrada.metaBatida}
                              onCheckedChange={(c) =>
                                handleInputChange(func.id, 'metaBatida', Boolean(c))
                              }
                            />
                            <Label htmlFor={`meta-${func.id}`} className="text-[11px] cursor-pointer font-semibold text-emerald-600">
                              🏆 Meta Batida (+R$ {bonusMetaCargoValor})
                            </Label>
                          </div>
                        </div>
                      )}

                      {depto === 'ADMINISTRATIVO' && (
                        <div className="flex items-center gap-2 text-xs">
                          <Label className="text-[10px] text-muted-foreground">Bônus / Gratificação R$:</Label>
                          <Input
                            type="number"
                            min="0"
                            value={entrada.bonusAvulso}
                            onChange={(e) =>
                              handleInputChange(func.id, 'bonusAvulso', Number(e.target.value) || 0)
                            }
                            className="h-7 w-24 text-xs text-center font-bold"
                          />
                        </div>
                      )}
                    </TableCell>

                    {/* Total Comissões */}
                    <TableCell className="text-xs text-right font-bold text-primary py-3">
                      {resultado.totalComissoes.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </TableCell>

                    {/* Salário Bruto */}
                    <TableCell className="text-xs text-right font-medium text-foreground py-3">
                      {resultado.totalProventos.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </TableCell>

                    {/* Salário Líquido a Pagar */}
                    <TableCell className="text-xs text-right font-black text-emerald-600 py-3">
                      {resultado.salarioLiquido.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </TableCell>

                    {/* Ações */}
                    <TableCell className="text-right py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Ver holerite calculado"
                          onClick={() => {
                            const storeId = func.store_id || resolveSaleStore({ vendedor: func.nome }).storeId;
                            onAbrirHolerite({
                              empresa: obterConfigParaLoja(storeId),
                              funcionario: { ...func, store_id: storeId },
                              folha: resultado,
                              variaveis: varsEntrada,
                            });
                          }}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className={`h-7 w-7 ${dirtyFuncIds.has(func.id) ? 'border-amber-500 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' : 'text-primary hover:bg-primary/10'}`}
                          title={dirtyFuncIds.has(func.id) ? 'Alterações não salvas - clique para salvar' : 'Salvar esta folha'}
                          onClick={async () => {
                            await onSalvarFolha(func, varsEntrada);
                            setDirtyFuncIds((prev) => {
                              const copy = new Set(prev);
                              copy.delete(func.id);
                              return copy;
                            });
                            toast({
                              title: `Folha de ${func.nome} salva!`,
                              description: `Líquido a pagar: ${resultado.salarioLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                            });
                          }}
                        >
                          <Save className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {linhasCalculadas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                    Nenhum colaborador encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Barra flutuante de alerta quando há edições pendentes */}
      {dirtyFuncIds.size > 0 && (
        <div className="sticky bottom-4 z-30 mx-auto max-w-2xl bg-slate-900/95 backdrop-blur text-white px-5 py-3 rounded-2xl shadow-2xl border border-amber-500/40 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span className="text-xs font-bold text-amber-200">
              Você tem {dirtyFuncIds.size} colaborador(es) com lançamentos alterados pendentes de gravação.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleSalvarTodos}
            disabled={salvandoTodos}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/30 shrink-0"
          >
            {salvandoTodos ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Gravando...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar Todos Agora
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default LancamentoRapidoFimDeMes;
