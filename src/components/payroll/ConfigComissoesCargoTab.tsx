import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DEFAULT_REGRAS_POR_CARGO,
  EmpresaFolhaConfig,
  FaixaComissaoMoto,
  RegraComissaoCargo,
} from '@/lib/folhaCalculos';
import {
  FuncionarioConcessionaria,
  packEmployeeFolhaPayload,
} from '@/hooks/useFolhaConcessionaria';
import { useToast } from '@/hooks/use-toast';

const formatBRL = (v?: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  empresa: EmpresaFolhaConfig;
  stores?: Array<{ id: string; name: string; city?: string | null; state?: string | null }>;
  selectedStoreId?: string;
  onSelectStoreId?: (id: string) => void;
  onSalvarConfig: (
    novaConfig: Partial<EmpresaFolhaConfig>,
    aplicarParaTodas?: boolean,
  ) => Promise<void> | void;
  funcionarios: FuncionarioConcessionaria[];
  onAtualizarFuncionario?: (payload: any) => Promise<any>;
  onAbrirCadastroComCargo?: (cargoId: string) => void;
}

const SETORES_ORDEM: Array<{
  id: 'TODOS' | 'VENDAS' | 'MECANICA' | 'GERENCIA' | 'ADMINISTRATIVO' | 'LOGISTICA' | 'TERCEIRIZADO';
  label: string;
  icon: string;
}> = [
  { id: 'TODOS', label: 'Todos os Cargos', icon: 'fa-layer-group' },
  { id: 'VENDAS', label: 'Vendas & Comercial', icon: 'fa-motorcycle' },
  { id: 'MECANICA', label: 'Oficina & Pós-Venda', icon: 'fa-screwdriver-wrench' },
  { id: 'LOGISTICA', label: 'Logística & Frotas', icon: 'fa-truck' },
  { id: 'GERENCIA', label: 'Gerência & Diretoria', icon: 'fa-user-tie' },
  { id: 'ADMINISTRATIVO', label: 'Administrativo & F&I', icon: 'fa-file-invoice-dollar' },
  { id: 'TERCEIRIZADO', label: 'Terceirizados / Parceiros', icon: 'fa-handshake' },
];

export const ConfigComissoesCargoTab: React.FC<Props> = ({
  empresa = DEFAULT_EMPRESA_FOLHA_CONFIG,
  stores = [],
  selectedStoreId = 'all',
  onSelectStoreId,
  onSalvarConfig,
  funcionarios = [],
  onAtualizarFuncionario,
  onAbrirCadastroComCargo,
}) => {
  const { toast } = useToast();

  const [regrasMap, setRegrasMap] = useState<Record<string, RegraComissaoCargo>>(() => ({
    ...DEFAULT_REGRAS_POR_CARGO,
    ...(empresa?.regrasPorCargo || {}),
  }));

  const [cargoSelecionadoId, setCargoSelecionadoId] = useState<string>('vendedor');
  const [filtroSetor, setFiltroSetor] = useState<
    'TODOS' | 'VENDAS' | 'MECANICA' | 'GERENCIA' | 'ADMINISTRATIVO' | 'LOGISTICA' | 'TERCEIRIZADO'
  >('TODOS');
  const [buscaCargo, setBuscaCargo] = useState('');
  const [modalNovoCargoOpen, setModalNovoCargoOpen] = useState(false);
  const [novoCargoTitulo, setNovoCargoTitulo] = useState('');
  const [novoCargoDepto, setNovoCargoDepto] = useState<
    'VENDAS' | 'MECANICA' | 'ADMINISTRATIVO' | 'GERENCIA' | 'LOGISTICA'
  >('VENDAS');
  const [novoCargoVinculo, setNovoCargoVinculo] = useState<'CLT' | 'TERCEIRIZADO'>('CLT');
  const [novoCargoSalario, setNovoCargoSalario] = useState(2000);
  const [sincronizandoEquipe, setSincronizandoEquipe] = useState(false);

  const [modalNovaCidadeOpen, setModalNovaCidadeOpen] = useState(false);
  const [cidadeSelecionadaNome, setCidadeSelecionadaNome] = useState('');
  const [exibirDesativados, setExibirDesativados] = useState(false);

  // Cidades únicas extraídas das lojas cadastradas
  const cidadesDisponiveis = useMemo(() => {
    const setCidades = new Set<string>();
    stores.forEach((st) => {
      if (st.city && st.city.trim()) {
        setCidades.add(st.city.trim());
      }
    });
    // Adiciona cidades padrão de polo caso ainda não estejam nas lojas
    setCidades.add('Montes Claros');
    setCidades.add('Divinópolis');
    return Array.from(setCidades);
  }, [stores]);
  const [simMotosLoja, setSimMotosLoja] = useState(8);
  const [simMotosProprio, setSimMotosProprio] = useState(3);
  const [simVendasReais, setSimVendasReais] = useState(120000);
  const [simMontagens, setSimMontagens] = useState(15);
  const [simRevisoes, setSimRevisoes] = useState(20);
  const [simMotosGerente, setSimMotosGerente] = useState(35);
  const [simBateuMeta, setSimBateuMeta] = useState(true);

  // Controle de persistência e auto-save para nunca perder alterações
  const isDirtyRef = useRef(false);
  const selectedStoreIdRef = useRef(selectedStoreId);
  const [salvandoStatus, setSalvandoStatus] = useState<'idle' | 'salvando' | 'salvo'>('idle');

  // Só reinicializa do empresa prop se a loja mudar ou se não houver edições pendentes
  useEffect(() => {
    if (selectedStoreIdRef.current !== selectedStoreId) {
      selectedStoreIdRef.current = selectedStoreId;
      isDirtyRef.current = false;
      setRegrasMap({
        ...DEFAULT_REGRAS_POR_CARGO,
        ...(empresa?.regrasPorCargo || {}),
      });
      return;
    }
    // Se a loja não mudou, só sincroniza caso não haja alterações ativas do usuário
    if (!isDirtyRef.current) {
      setRegrasMap({
        ...DEFAULT_REGRAS_POR_CARGO,
        ...(empresa?.regrasPorCargo || {}),
      });
    }
  }, [empresa, selectedStoreId]);

  // Auto-save inteligente (debounce 1.2s): grava automaticamente no localStorage/concessionária
  useEffect(() => {
    if (!isDirtyRef.current) return;
    const timer = setTimeout(async () => {
      try {
        setSalvandoStatus('salvando');
        await onSalvarConfig({ regrasPorCargo: regrasMap }, false);
        isDirtyRef.current = false;
        setSalvandoStatus('salvo');
        setTimeout(() => setSalvandoStatus('idle'), 2500);
      } catch (err) {
        console.error('Erro no auto-save das regras:', err);
        setSalvandoStatus('idle');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [regrasMap, onSalvarConfig]);

  // Ao desmontar o componente (ex: ao trocar de aba), garante que edições pendentes são gravadas imediatamente
  useEffect(() => {
    return () => {
      if (isDirtyRef.current) {
        onSalvarConfig({ regrasPorCargo: regrasMap }, false).catch(() => {});
      }
    };
  }, [regrasMap, onSalvarConfig]);

  const listaCargos = useMemo(() => {
    return Object.values(regrasMap).filter((c) => {
      if (!exibirDesativados && c.ativo === false) return false;
      if (filtroSetor === 'TERCEIRIZADO') {
        if (c.tipoContrato !== 'TERCEIRIZADO') return false;
      } else if (filtroSetor !== 'TODOS') {
        if (c.departamento !== filtroSetor) return false;
      }
      if (buscaCargo.trim()) {
        const q = buscaCargo.toLowerCase();
        return (
          c.titulo.toLowerCase().includes(q) ||
          c.descricaoCurta.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [regrasMap, filtroSetor, buscaCargo, exibirDesativados]);

  const cargoAtual: RegraComissaoCargo =
    regrasMap[cargoSelecionadoId] ||
    regrasMap.vendedor ||
    DEFAULT_REGRAS_POR_CARGO.vendedor;

  const colaboradoresDesteCargo = useMemo(() => {
    return funcionarios.filter((f) => f.cargoId === cargoAtual.id);
  }, [funcionarios, cargoAtual.id]);

  const updateCargoAtual = (patch: Partial<RegraComissaoCargo>) => {
    isDirtyRef.current = true;
    setSalvandoStatus('salvando');
    setRegrasMap((prev) => ({
      ...prev,
      [cargoAtual.id]: {
        ...prev[cargoAtual.id],
        ...patch,
      },
    }));
  };

  const handleAddFaixa = () => {
    const faixas = cargoAtual.faixasMotos || [];
    const lastAte = faixas.length > 0 ? (faixas[faixas.length - 1].ate || 15) : 0;
    const novaFaixa: FaixaComissaoMoto = {
      de: lastAte + 1,
      ate: lastAte + 10,
      valorPorMoto: 350,
    };
    updateCargoAtual({ faixasMotos: [...faixas, novaFaixa] });
  };

  const handleUpdateFaixa = (idx: number, field: keyof FaixaComissaoMoto, val: number) => {
    const novas = [...(cargoAtual.faixasMotos || [])];
    novas[idx] = { ...novas[idx], [field]: val };
    updateCargoAtual({ faixasMotos: novas });
  };

  const handleRemoveFaixa = (idx: number) => {
    updateCargoAtual({
      faixasMotos: (cargoAtual.faixasMotos || []).filter((_, i) => i !== idx),
    });
  };

  const handleSalvarTudo = async (aplicarParaTodasLojas = false) => {
    setSalvandoStatus('salvando');
    try {
      await onSalvarConfig(
        {
          regrasPorCargo: regrasMap,
        },
        aplicarParaTodasLojas,
      );
      isDirtyRef.current = false;
      setSalvandoStatus('salvo');
      setTimeout(() => setSalvandoStatus('idle'), 3000);
    } catch (err: any) {
      setSalvandoStatus('idle');
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar regras',
        description: err?.message,
      });
    }
  };

  const handleRestaurarPadraoCargo = () => {
    const def = DEFAULT_REGRAS_POR_CARGO[cargoAtual.id];
    if (!def) {
      toast({
        variant: 'destructive',
        title: 'Este é um cargo personalizado criado por você.',
      });
      return;
    }
    setRegrasMap((prev) => ({
      ...prev,
      [cargoAtual.id]: { ...def, faixasMotos: [...def.faixasMotos] },
    }));
    toast({
      title: `Padrões de "${def.titulo}" restaurados`,
      description: 'Clique em "Salvar Regras de Comissões" para gravar.',
    });
  };

  const handleCriarNovoCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoCargoTitulo.trim()) return;
    const slug =
      'cargo_' +
      novoCargoTitulo
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

    const idFinal = regrasMap[slug] ? `${slug}_${Date.now().toString().slice(-3)}` : slug;
    const isTerceiro = novoCargoVinculo === 'TERCEIRIZADO';

    const novoCargo: RegraComissaoCargo = {
      id: idFinal,
      titulo: novoCargoTitulo.trim(),
      descricaoCurta: `Cargo personalizado (${novoCargoDepto})`,
      departamento: novoCargoDepto,
      tipoContrato: novoCargoVinculo,
      salarioBasePadrao: Number(novoCargoSalario) || 0,
      cargaHorariaPadrao: isTerceiro ? 0 : 220,
      modeloComissao: 'PADRAO',
      faixasMotos:
        novoCargoDepto === 'VENDAS'
          ? [...DEFAULT_REGRAS_POR_CARGO.vendedor.faixasMotos]
          : [],
      valorMarketingProprioPorMoto: novoCargoDepto === 'VENDAS' ? 400 : 0,
      aliquotaPercentualVendas: 0,
      valorPorMotoMontada: novoCargoDepto === 'MECANICA' ? 35 : 0,
      valorPorRevisaoExecutada: novoCargoDepto === 'MECANICA' ? 20 : 0,
      valorPorMotoVendidaLojaGerente: novoCargoDepto === 'GERENCIA' ? 20 : 0,
      metaGlobalMotosLoja: novoCargoDepto === 'GERENCIA' ? 30 : 0,
      bonusMetaAtingida: 300,
      comissaoRetornoPadrao: 150,
      comissaoMotoParceiroPorUnidade: 250,
      ajudaDeCustoIsentaPadrao: 0,
      grauInsalubridadePadrao: 'NENHUM',
      periculosidadePadrao: false,
      descontarINSSPadrao: !isTerceiro,
      descontarIRRFPadrao: !isTerceiro,
      calcularFGTSPadrao: !isTerceiro,
      pagarDSRComissaoPadrao: !isTerceiro,
      isPersonalizado: true,
    };

    const proximoMapa = {
      ...regrasMap,
      [idFinal]: novoCargo,
    };

    setRegrasMap(proximoMapa);
    setCargoSelecionadoId(idFinal);
    setModalNovoCargoOpen(false);
    setNovoCargoTitulo('');

    await onSalvarConfig({ regrasPorCargo: proximoMapa }, false);
    toast({
      title: `Cargo "${novoCargo.titulo}" criado com sucesso!`,
      description: 'Configure agora as regras de comissão dele no painel ao lado.',
    });
  };

  const handleExcluirCargoPersonalizado = async (cargoId: string) => {
    const isNativo = Boolean(DEFAULT_REGRAS_POR_CARGO[cargoId]);
    const titulo = regrasMap[cargoId]?.titulo || cargoId;

    if (isNativo) {
      // Para cargos nativos/fixos: permite desativar/ocultar das tabelas e seleções
      const copia = {
        ...regrasMap,
        [cargoId]: {
          ...regrasMap[cargoId],
          ativo: false,
        },
      };
      setRegrasMap(copia);
      const proximoAtivo = Object.values(copia).find((c) => c.ativo !== false)?.id || 'vendedor';
      setCargoSelecionadoId(proximoAtivo);
      await onSalvarConfig({ regrasPorCargo: copia }, false);
      toast({
        title: `Cargo "${titulo}" excluído / desativado com sucesso`,
        description: 'Ele não aparecerá mais nos formulários nem nas tabelas de seleção.',
      });
      return;
    }

    // Para cargos personalizados criados pelo usuário: exclusão completa do mapa
    const copia = { ...regrasMap };
    delete copia[cargoId];
    setRegrasMap(copia);
    const proximoAtivo = Object.values(copia).find((c) => c.ativo !== false)?.id || 'vendedor';
    setCargoSelecionadoId(proximoAtivo);
    await onSalvarConfig({ regrasPorCargo: copia }, false);
    toast({ title: `Cargo "${titulo}" excluído definitivamente.` });
  };

  const handleReativarCargo = async (cargoId: string) => {
    const copia = {
      ...regrasMap,
      [cargoId]: {
        ...regrasMap[cargoId],
        ativo: true,
      },
    };
    setRegrasMap(copia);
    await onSalvarConfig({ regrasPorCargo: copia }, false);
    toast({ title: `Cargo "${regrasMap[cargoId]?.titulo}" reativado!` });
  };

  const handleAplicarAosColaboradoresDoCargo = async () => {
    if (!onAtualizarFuncionario) return;
    if (colaboradoresDesteCargo.length === 0) {
      toast({
        title: 'Nenhum colaborador vinculado a este cargo no momento.',
        description: 'Ao cadastrar ou editar um colaborador e escolher este cargo, essas regras já serão preenchidas.',
      });
      return;
    }

    setSincronizandoEquipe(true);
    try {
      await handleSalvarTudo(false);
      let atualizados = 0;
      for (const func of colaboradoresDesteCargo) {
        const payload = packEmployeeFolhaPayload(
          {
            ...func,
            cargoId: cargoAtual.id,
            cargo: cargoAtual.titulo,
            role: cargoAtual.id,
            departamento: cargoAtual.departamento,
            tipoContrato: cargoAtual.tipoContrato,
            modeloComissaoVendedor: cargoAtual.modeloComissao,
            salarioBase: cargoAtual.salarioBasePadrao,
            cargaHoraria: cargoAtual.cargaHorariaPadrao || 220,
            commissionRate: cargoAtual.aliquotaPercentualVendas,
            grauInsalubridade: cargoAtual.grauInsalubridadePadrao,
            temPericulosidade: cargoAtual.periculosidadePadrao ? 1 : 0,
            descontarINSS: cargoAtual.descontarINSSPadrao ? 1 : 0,
            descontarIRRF: cargoAtual.descontarIRRFPadrao ? 1 : 0,
            calcularFGTS: cargoAtual.calcularFGTSPadrao ? 1 : 0,
            pagarDSRComissao: cargoAtual.pagarDSRComissaoPadrao ? 1 : 0,
          },
          func.regularAdditions,
        );
        await onAtualizarFuncionario(payload);
        atualizados += 1;
      }
      toast({
        title: `${atualizados} colaborador(es) atualizado(s)!`,
        description: `Salário base (${formatBRL(cargoAtual.salarioBasePadrao)}) e parâmetros do cargo "${cargoAtual.titulo}" aplicados com sucesso.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar colaboradores',
        description: err?.message || 'Tente novamente.',
      });
    } finally {
      setSincronizandoEquipe(false);
    }
  };

  // Cálculo da simulação ao vivo para o cargo selecionado
  const resultadoSimulacao = useMemo(() => {
    let comissaoMotosLoja = 0;
    let valorUnitFaixa = 0;
    if (cargoAtual.faixasMotos && cargoAtual.faixasMotos.length > 0 && simMotosLoja > 0) {
      const faixa =
        cargoAtual.faixasMotos.find(
          (r) => simMotosLoja >= r.de && simMotosLoja <= r.ate,
        ) || cargoAtual.faixasMotos[cargoAtual.faixasMotos.length - 1];
      valorUnitFaixa = Number(faixa?.valorPorMoto) || 0;
      comissaoMotosLoja = simMotosLoja * valorUnitFaixa;
    }

    const comissaoMarketingProprio =
      cargoAtual.modeloComissao === 'PLUS' || cargoAtual.valorMarketingProprioPorMoto > 0
        ? simMotosProprio * (Number(cargoAtual.valorMarketingProprioPorMoto) || 0)
        : 0;

    const comissaoPercentual =
      cargoAtual.modeloComissao === 'PERCENTUAL' || cargoAtual.aliquotaPercentualVendas > 0
        ? simVendasReais * ((Number(cargoAtual.aliquotaPercentualVendas) || 0) / 100)
        : 0;

    const comissaoOficina =
      simMontagens * (Number(cargoAtual.valorPorMotoMontada) || 0) +
      simRevisoes * (Number(cargoAtual.valorPorRevisaoExecutada) || 0);

    const comissaoGerente =
      simMotosGerente * (Number(cargoAtual.valorPorMotoVendidaLojaGerente) || 0);

    const bonusMeta = simBateuMeta ? Number(cargoAtual.bonusMetaAtingida) || 0 : 0;

    let totalComissoes = 0;
    if (cargoAtual.departamento === 'VENDAS') {
      totalComissoes =
        comissaoMotosLoja + comissaoMarketingProprio + comissaoPercentual + bonusMeta;
    } else if (cargoAtual.departamento === 'MECANICA') {
      totalComissoes = comissaoOficina + bonusMeta;
    } else if (cargoAtual.departamento === 'GERENCIA') {
      totalComissoes = comissaoGerente + comissaoPercentual + bonusMeta;
    } else {
      totalComissoes =
        comissaoPercentual +
        Number(cargoAtual.comissaoRetornoPadrao || 0) +
        bonusMeta;
    }

    const dsrEstimado =
      cargoAtual.pagarDSRComissaoPadrao && cargoAtual.tipoContrato === 'CLT'
        ? +(totalComissoes / 6).toFixed(2)
        : 0;

    const brutoEstimado =
      Number(cargoAtual.salarioBasePadrao || 0) +
      totalComissoes +
      dsrEstimado +
      Number(cargoAtual.ajudaDeCustoIsentaPadrao || 0);

    return {
      valorUnitFaixa,
      comissaoMotosLoja,
      comissaoMarketingProprio,
      comissaoPercentual,
      comissaoOficina,
      comissaoGerente,
      bonusMeta,
      totalComissoes,
      dsrEstimado,
      brutoEstimado,
    };
  }, [
    cargoAtual,
    simMotosLoja,
    simMotosProprio,
    simVendasReais,
    simMontagens,
    simRevisoes,
    simMotosGerente,
    simBateuMeta,
  ]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho com Seletor de Loja e Ações Globais */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
            <i className="fa-solid fa-sliders text-xl"></i>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Central de Cargos & Comissões
              </span>
              <span className="text-xs text-slate-400">
                Configure salário base, faixas de motos, bônus de captação, oficina, gerência e F&I de cada cargo
              </span>
            </div>
            <h3 className="text-xl font-black tracking-tight mt-1">
              Tabela de Comissões e Salários por Cargo
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {stores.length > 0 && onSelectStoreId && (
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl">
              <i className="fa-solid fa-store text-indigo-400 text-xs"></i>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none">
                  Unidade Configurada
                </span>
                <select
                  value={selectedStoreId}
                  onChange={(e) => onSelectStoreId(e.target.value)}
                  className="bg-transparent text-xs font-black text-white outline-none cursor-pointer mt-0.5"
                >
                  <option value="all" className="text-slate-900">
                    Padrão Global (Todas)
                  </option>
                  {stores.map((st) => (
                    <option key={st.id} value={st.id} className="text-slate-900">
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {salvandoStatus === 'salvando' && (
            <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-lg border border-amber-400/30 flex items-center gap-1.5 animate-pulse">
              <i className="fa-solid fa-circle-notch fa-spin"></i> Salvando alterações...
            </span>
          )}
          {salvandoStatus === 'salvo' && (
            <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-lg border border-emerald-400/30 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check"></i> Salvo automaticamente
            </span>
          )}

          <button
            type="button"
            onClick={() => setModalNovoCargoOpen(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all"
          >
            <i className="fa-solid fa-plus text-indigo-400"></i> Novo Cargo
          </button>

          {stores.length > 1 && (
            <button
              type="button"
              onClick={() => handleSalvarTudo(true)}
              className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-xl text-xs font-black flex items-center gap-2 transition-all"
              title="Salva e copia todas as regras de cargos para todas as lojas do grupo"
            >
              <i className="fa-solid fa-clone"></i> Replicar p/ Todas as Lojas
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSalvarTudo(false)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
          >
            <i className="fa-solid fa-floppy-disk"></i> Salvar Regras de Comissões
          </button>
        </div>
      </div>

      {/* Filtro de Setores */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {SETORES_ORDEM.map((setor) => {
            const active = filtroSetor === setor.id;
            return (
              <button
                key={setor.id}
                type="button"
                onClick={() => setFiltroSetor(setor.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <i className={`fa-solid ${setor.icon}`}></i>
                {setor.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={exibirDesativados}
              onChange={(e) => setExibirDesativados(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Exibir quadros excluídos / inativos</span>
          </label>

          <div className="relative w-full sm:w-64">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              value={buscaCargo}
              onChange={(e) => setBuscaCargo(e.target.value)}
              placeholder="Buscar cargo..."
              className="w-full pl-8 pr-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Grid Principal: Lista de Cargos à esquerda (4 colunas) + Editor Completo à direita (8 colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: Lista de Cargos */}
        <div className="lg:col-span-4 space-y-2.5">
          {listaCargos.map((c) => {
            const isSelected = c.id === cargoAtual.id;
            const qtdColabs = funcionarios.filter((f) => f.cargoId === c.id).length;
            const isCustom = !DEFAULT_REGRAS_POR_CARGO[c.id];

            return (
              <div
                key={c.id}
                onClick={() => setCargoSelecionadoId(c.id)}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : c.departamento === 'VENDAS'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : c.departamento === 'MECANICA'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : c.departamento === 'GERENCIA'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {c.departamento}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-indigo-900/40 text-indigo-100'
                            : c.tipoContrato === 'TERCEIRIZADO'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {c.tipoContrato === 'TERCEIRIZADO' ? 'PJ / Terceirizado' : 'CLT'}
                      </span>
                      {c.ativo === false && (
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          Excluído / Inativo
                        </span>
                      )}
                      {isCustom && (
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          Custom
                        </span>
                      )}
                    </div>
                    <h4 className="font-black text-sm leading-snug">{c.titulo}</h4>
                  </div>

                  <span
                    className={`text-[10px] font-black px-2 py-1 rounded-lg shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : qtdColabs > 0
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                    title="Colaboradores vinculados a este cargo"
                  >
                    <i className="fa-solid fa-users mr-1"></i>
                    {qtdColabs}
                  </span>
                </div>

                <p
                  className={`text-[11px] mt-1.5 line-clamp-2 ${
                    isSelected ? 'text-indigo-100' : 'text-slate-500'
                  }`}
                >
                  {c.descricaoCurta}
                </p>

                <div
                  className={`mt-3 pt-2.5 border-t flex items-center justify-between text-xs font-black ${
                    isSelected ? 'border-indigo-400/40 text-white' : 'border-slate-100 text-slate-700'
                  }`}
                >
                  <span>
                    Base:{' '}
                    <strong className={isSelected ? 'text-white' : 'text-indigo-600'}>
                      {formatBRL(c.salarioBasePadrao)}
                    </strong>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider opacity-90">
                    {c.departamento === 'VENDAS' && c.modeloComissao === 'PLUS' && (
                      <>Faixas + {formatBRL(c.valorMarketingProprioPorMoto)}/própria</>
                    )}
                    {c.departamento === 'VENDAS' && c.modeloComissao === 'PADRAO' && (
                      <>{c.faixasMotos?.length || 0} faixas de motos</>
                    )}
                    {c.departamento === 'VENDAS' && c.modeloComissao === 'PERCENTUAL' && (
                      <>{c.aliquotaPercentualVendas}% sobre vendas</>
                    )}
                    {c.departamento === 'MECANICA' && (
                      <>
                        {formatBRL(c.valorPorMotoMontada)}/mont. •{' '}
                        {formatBRL(c.valorPorRevisaoExecutada)}/rev.
                      </>
                    )}
                    {c.departamento === 'GERENCIA' && (
                      <>
                        {formatBRL(c.valorPorMotoVendidaLojaGerente)}/moto loja + Meta{' '}
                        {formatBRL(c.bonusMetaAtingida)}
                      </>
                    )}
                    {c.departamento === 'ADMINISTRATIVO' && (
                      <>
                        Bônus {formatBRL(c.bonusMetaAtingida)} • F&I{' '}
                        {formatBRL(c.comissaoRetornoPadrao)}
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Coluna Direita: Painel de Configuração do Cargo Selecionado */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Identificação, Salário Base e Encargos do Cargo */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                    ID: {cargoAtual.id}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {colaboradoresDesteCargo.length} colaborador(es) neste cargo
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  1. Dados Base e Salário do Cargo: <span className="text-indigo-600">{cargoAtual.titulo}</span>
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {cargoAtual.ativo === false ? (
                  <button
                    type="button"
                    onClick={() => handleReativarCargo(cargoAtual.id)}
                    className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-black flex items-center gap-1.5 shadow-xs"
                  >
                    <i className="fa-solid fa-check"></i> Reativar Cargo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleExcluirCargoPersonalizado(cargoAtual.id)}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold flex items-center gap-1.5"
                    title={
                      DEFAULT_REGRAS_POR_CARGO[cargoAtual.id]
                        ? 'Oculta/exclui este quadro da visualização e seleções'
                        : 'Exclui definitivamente este cargo personalizado'
                    }
                  >
                    <i className="fa-solid fa-trash"></i>{' '}
                    {DEFAULT_REGRAS_POR_CARGO[cargoAtual.id] ? 'Excluir Quadro' : 'Excluir Cargo'}
                  </button>
                )}

                {DEFAULT_REGRAS_POR_CARGO[cargoAtual.id] && (
                  <button
                    type="button"
                    onClick={handleRestaurarPadraoCargo}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-[11px] font-bold flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-rotate-left"></i> Restaurar Padrão
                  </button>
                )}

                {onAtualizarFuncionario && (
                  <button
                    type="button"
                    disabled={sincronizandoEquipe}
                    onClick={handleAplicarAosColaboradoresDoCargo}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    title="Atualiza o salário base e parâmetros trabalhistas de todos os colaboradores que possuem este cargo"
                  >
                    <i className="fa-solid fa-arrows-rotate"></i>
                    {sincronizandoEquipe
                      ? 'Aplicando...'
                      : `Aplicar Salário/Regras aos ${colaboradoresDesteCargo.length} Colaborador(es)`}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-6">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                  Nome / Título Oficial do Cargo
                </label>
                <input
                  type="text"
                  value={cargoAtual.titulo}
                  onChange={(e) => updateCargoAtual({ titulo: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-black text-slate-800"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                  Setor / Departamento
                </label>
                <select
                  value={cargoAtual.departamento}
                  onChange={(e) =>
                    updateCargoAtual({
                      departamento: e.target.value as
                        | 'VENDAS'
                        | 'MECANICA'
                        | 'ADMINISTRATIVO'
                        | 'GERENCIA',
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black bg-white"
                >
                  <option value="VENDAS">Vendas & Comercial</option>
                  <option value="MECANICA">Oficina & Mecânica</option>
                  <option value="GERENCIA">Gerência & Diretoria</option>
                  <option value="ADMINISTRATIVO">Administrativo & F&I</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                  Vínculo Padrão
                </label>
                <select
                  value={cargoAtual.tipoContrato}
                  onChange={(e) => {
                    const novoVinculo = e.target.value as 'CLT' | 'TERCEIRIZADO';
                    const isPJ = novoVinculo === 'TERCEIRIZADO';
                    updateCargoAtual({
                      tipoContrato: novoVinculo,
                      descontarINSSPadrao: !isPJ,
                      descontarIRRFPadrao: !isPJ,
                      calcularFGTSPadrao: !isPJ,
                      pagarDSRComissaoPadrao: !isPJ,
                    });
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black bg-white"
                >
                  <option value="CLT">CLT (Folha c/ Encargos)</option>
                  <option value="TERCEIRIZADO">Terceirizado / PJ / Parceiro</option>
                </select>
              </div>

              <div className="sm:col-span-12">
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                  Descrição Resumida da Função e Regra
                </label>
                <input
                  type="text"
                  value={cargoAtual.descricaoCurta}
                  onChange={(e) => updateCargoAtual({ descricaoCurta: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-600 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="sm:col-span-4 bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-200">
                <label className="block text-[10px] font-black text-indigo-900 uppercase mb-1">
                  {cargoAtual.tipoContrato === 'TERCEIRIZADO'
                    ? 'Valor Fixo Mensal / Retainer (R$)'
                    : 'Salário Base Padrão na Loja (R$)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cargoAtual.salarioBasePadrao}
                  onChange={(e) =>
                    updateCargoAtual({ salarioBasePadrao: Number(e.target.value) || 0 })
                  }
                  className="w-full p-2.5 border border-indigo-300 rounded-xl text-base font-black text-indigo-950 bg-white"
                />
                <p className="text-[10px] text-indigo-700 mt-1">
                  Preenchido automaticamente ao escolher este cargo.
                </p>
              </div>

              <div className="sm:col-span-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                  Ajuda de Custo Isenta Padrão (R$)
                </label>
                <input
                  type="number"
                  step="10"
                  value={cargoAtual.ajudaDeCustoIsentaPadrao}
                  onChange={(e) =>
                    updateCargoAtual({
                      ajudaDeCustoIsentaPadrao: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-black text-slate-800 bg-white"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Combustível / deslocamento operacional.
                </p>
              </div>

              <div className="sm:col-span-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                  Insalubridade Padrão do Cargo
                </label>
                <select
                  value={cargoAtual.grauInsalubridadePadrao}
                  onChange={(e) =>
                    updateCargoAtual({
                      grauInsalubridadePadrao: e.target.value as
                        | 'NENHUM'
                        | 'MINIMO'
                        | 'MEDIO'
                        | 'MAXIMO',
                    })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-black bg-white"
                >
                  <option value="NENHUM">Isento / Não se aplica</option>
                  <option value="MINIMO">Grau Mínimo (10% Sal. Mín.)</option>
                  <option value="MEDIO">Grau Médio (20% - Oficina)</option>
                  <option value="MAXIMO">Grau Máximo (40%)</option>
                </select>
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cargoAtual.periculosidadePadrao}
                    onChange={(e) =>
                      updateCargoAtual({ periculosidadePadrao: e.target.checked })
                    }
                    className="rounded text-indigo-600"
                  />
                  Adicional Periculosidade (30%)
                </label>
              </div>
            </div>

            {/* Flags de Encargos Padrão do Cargo */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] font-black uppercase text-slate-500">
                Incidências Trabalhistas Padrão deste Cargo:
              </span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cargoAtual.descontarINSSPadrao}
                    onChange={(e) =>
                      updateCargoAtual({ descontarINSSPadrao: e.target.checked })
                    }
                    className="rounded text-indigo-600"
                  />
                  Descontar INSS
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cargoAtual.descontarIRRFPadrao}
                    onChange={(e) =>
                      updateCargoAtual({ descontarIRRFPadrao: e.target.checked })
                    }
                    className="rounded text-indigo-600"
                  />
                  Descontar IRRF
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cargoAtual.calcularFGTSPadrao}
                    onChange={(e) =>
                      updateCargoAtual({ calcularFGTSPadrao: e.target.checked })
                    }
                    className="rounded text-indigo-600"
                  />
                  Recolher FGTS (8%)
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cargoAtual.pagarDSRComissaoPadrao}
                    onChange={(e) =>
                      updateCargoAtual({ pagarDSRComissaoPadrao: e.target.checked })
                    }
                    className="rounded text-indigo-600"
                  />
                  Pagar DSR sobre Comissões (Súmula 340 TST)
                </label>
              </div>
            </div>
          </div>

          {/* Card 2: Regras de Comissionamento do Cargo */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <i className="fa-solid fa-coins text-emerald-600"></i>
                  2. Regras de Comissão de <span className="text-indigo-600">{cargoAtual.titulo}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Personalize exatamente como o sistema calcula as comissões mensais para quem ocupa este cargo.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-slate-400">
                  Regime de Comissão:
                </span>
                <select
                  value={cargoAtual.modeloComissao}
                  onChange={(e) =>
                    updateCargoAtual({
                      modeloComissao: e.target.value as 'PADRAO' | 'PLUS' | 'PERCENTUAL',
                    })
                  }
                  className="p-2 border border-indigo-200 rounded-xl text-xs font-black bg-indigo-50 text-indigo-900"
                >
                  <option value="PADRAO">Padrão (Faixas / Produção Fixa)</option>
                  <option value="PLUS">Plus (+ Bônus por Captação Própria / Externa)</option>
                  <option value="PERCENTUAL">Percentual (% sobre Volume R$)</option>
                </select>
              </div>
            </div>

            {/* SEÇÃO A: Faixas Progressivas por Motos Vendidas e Bônus Captação Própria */}
            {(cargoAtual.departamento === 'VENDAS' ||
              (cargoAtual.faixasMotos && cargoAtual.faixasMotos.length > 0) ||
              cargoAtual.modeloComissao === 'PLUS') && (
              <div className="space-y-4 bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Comissão Comercial de Motos
                    </span>
                    <h4 className="text-sm font-black text-slate-800 mt-1">
                      Tabela Progressiva de Motos (R$ por Moto Vendida)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      O sistema conta quantas motos o colaborador vendeu no mês e multiplica pelo valor da faixa atingida.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFaixa}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    <i className="fa-solid fa-plus"></i> Adicionar Faixa
                  </button>
                </div>

                {(cargoAtual.faixasMotos || []).length === 0 ? (
                  <div className="p-4 bg-white rounded-xl border border-dashed border-emerald-300 text-center text-xs text-slate-500">
                    Nenhuma faixa progressiva de motos cadastrada para este cargo. Clique em{' '}
                    <strong>+ Adicionar Faixa</strong> caso este cargo receba por volume de motos.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-[10px] font-black text-slate-500 uppercase px-2">
                      <div className="col-span-3">De (Motos)</div>
                      <div className="col-span-3">Até (Motos)</div>
                      <div className="col-span-4">Valor / Moto (R$)</div>
                      <div className="col-span-2 text-right">Ação</div>
                    </div>
                    {(cargoAtual.faixasMotos || []).map((fx, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-emerald-200/80 shadow-sm"
                      >
                        <div className="col-span-3">
                          <input
                            type="number"
                            value={fx.de}
                            onChange={(e) =>
                              handleUpdateFaixa(idx, 'de', Number(e.target.value))
                            }
                            className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-center"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            value={fx.ate}
                            onChange={(e) =>
                              handleUpdateFaixa(idx, 'ate', Number(e.target.value))
                            }
                            className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold text-center"
                          />
                        </div>
                        <div className="col-span-4">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-700">
                              R$
                            </span>
                            <input
                              type="number"
                              step="10"
                              value={fx.valorPorMoto}
                              onChange={(e) =>
                                handleUpdateFaixa(idx, 'valorPorMoto', Number(e.target.value))
                              }
                              className="w-full pl-8 pr-2 py-2 border border-emerald-300 rounded-lg text-xs font-black text-emerald-800 bg-emerald-50/40"
                            />
                          </div>
                        </div>
                        <div className="col-span-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveFaixa(idx)}
                            className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Remover faixa"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Captação Própria / Venda Externa + Alíquota Percentual */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-emerald-200/70">
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-300">
                    <label className="block text-[10px] font-black text-emerald-900 uppercase mb-1">
                      Comissão Captação Própria / Externa (R$/moto)
                    </label>
                    <input
                      type="number"
                      step="10"
                      value={cargoAtual.valorMarketingProprioPorMoto}
                      onChange={(e) =>
                        updateCargoAtual({
                          valorMarketingProprioPorMoto: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full p-2 border border-emerald-300 rounded-lg text-sm font-black text-emerald-800"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Pago por moto quando o cliente veio do marketing/captação própria do vendedor.
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                      Alíquota Percentual s/ Vendas (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={cargoAtual.aliquotaPercentualVendas}
                      onChange={(e) =>
                        updateCargoAtual({
                          aliquotaPercentualVendas: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm font-black text-slate-800"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Usado quando o Regime de Comissão do cargo é Percentual (% sobre R$).
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                    <label className="block text-[10px] font-black text-slate-600 uppercase mb-1">
                      Comissão Moto de Parceiro / Repasse (R$)
                    </label>
                    <input
                      type="number"
                      step="10"
                      value={cargoAtual.comissaoMotoParceiroPorUnidade}
                      onChange={(e) =>
                        updateCargoAtual({
                          comissaoMotoParceiroPorUnidade: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm font-black text-slate-800"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Valor sugerido por moto captada de parceiro/consignado.
                    </p>
                  </div>
                </div>

                {/* DIFERENCIAÇÃO POR CIDADE / POLO REGIONAL (Vendedores recebem mais em certas cidades) */}
                <div className="mt-4 pt-4 border-t border-emerald-300/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded">
                        <i className="fa-solid fa-map-location-dot mr-1"></i> Tabela Diferenciada por Cidade / Polo
                      </span>
                      <h5 className="text-xs font-black text-slate-800 mt-1">
                        Acréscimos e Comissões Específicas por Município
                      </h5>
                      <p className="text-[11px] text-slate-500">
                        Vendedores alocados em cidades com metas ou custo de vida diferenciados (ex: Montes Claros, Divinópolis) recebem valor extra ou salário diferenciado.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setModalNovaCidadeOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
                    >
                      <i className="fa-solid fa-plus"></i> Adicionar Regra de Cidade
                    </button>
                  </div>

                  {Object.keys(cargoAtual.cidadesDiferenciadas || {}).length === 0 ? (
                    <div className="p-3 bg-white/80 rounded-xl border border-dashed border-emerald-300 text-center text-xs text-slate-500">
                      Nenhuma diferenciação regional configurada. Todas as cidades seguem a comissão base padrão. Clique em <strong>+ Adicionar Regra de Cidade</strong> para configurar acréscimo específico.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(cargoAtual.cidadesDiferenciadas || {}).map(([cidadeNome, cfg]) => (
                        <div
                          key={cidadeNome}
                          className="bg-white p-3.5 rounded-xl border border-emerald-300 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div className="min-w-[160px]">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <strong className="text-xs font-black text-slate-900">{cidadeNome}</strong>
                            </div>
                            <span className="text-[10px] text-slate-500">
                              Regra regional para colaboradores desta praça
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1">
                            <div>
                              <label className="block text-[9px] font-black text-emerald-900 uppercase">
                                Acréscimo / Moto (+R$)
                              </label>
                              <input
                                type="number"
                                step="10"
                                placeholder="0,00"
                                value={cfg.adicionalPorMoto || 0}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  const mapaCidades = { ...(cargoAtual.cidadesDiferenciadas || {}) };
                                  mapaCidades[cidadeNome] = { ...mapaCidades[cidadeNome], adicionalPorMoto: val };
                                  updateCargoAtual({ cidadesDiferenciadas: mapaCidades });
                                }}
                                className="w-full p-1.5 text-xs font-black border border-emerald-300 rounded-lg bg-emerald-50/50"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black text-slate-600 uppercase">
                                Salário Base Específico (R$)
                              </label>
                              <input
                                type="number"
                                step="50"
                                placeholder={`Padrão (${cargoAtual.salarioBasePadrao})`}
                                value={cfg.salarioBase || ''}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  const mapaCidades = { ...(cargoAtual.cidadesDiferenciadas || {}) };
                                  mapaCidades[cidadeNome] = { ...mapaCidades[cidadeNome], salarioBase: val };
                                  updateCargoAtual({ cidadesDiferenciadas: mapaCidades });
                                }}
                                className="w-full p-1.5 text-xs font-bold border border-slate-300 rounded-lg"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black text-slate-600 uppercase">
                                Captação Própria (R$)
                              </label>
                              <input
                                type="number"
                                step="10"
                                placeholder={`Padrão (${cargoAtual.valorMarketingProprioPorMoto})`}
                                value={cfg.valorMarketingProprioPorMoto || ''}
                                onChange={(e) => {
                                  const val = e.target.value ? Number(e.target.value) : undefined;
                                  const mapaCidades = { ...(cargoAtual.cidadesDiferenciadas || {}) };
                                  mapaCidades[cidadeNome] = { ...mapaCidades[cidadeNome], valorMarketingProprioPorMoto: val };
                                  updateCargoAtual({ cidadesDiferenciadas: mapaCidades });
                                }}
                                className="w-full p-1.5 text-xs font-bold border border-slate-300 rounded-lg"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const mapaCidades = { ...(cargoAtual.cidadesDiferenciadas || {}) };
                              delete mapaCidades[cidadeNome];
                              updateCargoAtual({ cidadesDiferenciadas: mapaCidades });
                              toast({ title: `Regra regional de ${cidadeNome} removida.` });
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 self-end md:self-center transition-colors"
                            title="Remover diferenciação desta cidade"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SEÇÃO B: Produção de Oficina & Pós-Venda (Montagem de Motos e Revisões) */}
            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Produção de Oficina & Pós-Venda
                  </span>
                  <h4 className="text-sm font-black text-slate-800 mt-1">
                    Comissões de Montagem (PDI) e Revisões Executadas
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-3.5 rounded-xl border border-amber-200">
                  <label className="block text-[10px] font-black text-amber-900 uppercase mb-1">
                    Moto 0km Montada / Preparada (R$)
                  </label>
                  <input
                    type="number"
                    step="5"
                    value={cargoAtual.valorPorMotoMontada}
                    onChange={(e) =>
                      updateCargoAtual({
                        valorPorMotoMontada: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 border border-amber-300 rounded-lg text-sm font-black text-amber-900"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Multiplicado pelo nº de motos montadas no mês.
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-amber-200">
                  <label className="block text-[10px] font-black text-amber-900 uppercase mb-1">
                    Revisão / Ordem de Serviço (R$)
                  </label>
                  <input
                    type="number"
                    step="5"
                    value={cargoAtual.valorPorRevisaoExecutada}
                    onChange={(e) =>
                      updateCargoAtual({
                        valorPorRevisaoExecutada: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 border border-amber-300 rounded-lg text-sm font-black text-amber-900"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Multiplicado pelo nº de revisões/OS concluídas.
                  </p>
                </div>
              </div>
            </div>

            {/* SEÇÃO C: Gerência, Bônus de Meta e Retorno F&I */}
            <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-200 space-y-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                  Gerência, Metas & F&I
                </span>
                <h4 className="text-sm font-black text-slate-800 mt-1">
                  Override sobre Volume da Loja, Premiação de Meta e Retorno de Financiamento
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-3.5 rounded-xl border border-purple-200">
                  <label className="block text-[10px] font-black text-purple-900 uppercase mb-1">
                    Override Gerente / Moto Loja (R$)
                  </label>
                  <input
                    type="number"
                    step="5"
                    value={cargoAtual.valorPorMotoVendidaLojaGerente}
                    onChange={(e) =>
                      updateCargoAtual({
                        valorPorMotoVendidaLojaGerente: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 border border-purple-300 rounded-lg text-sm font-black text-purple-900"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Pago por cada moto vendida na unidade toda.
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-purple-200">
                  <label className="block text-[10px] font-black text-purple-900 uppercase mb-1">
                    Meta Mensal da Loja (Motos)
                  </label>
                  <input
                    type="number"
                    value={cargoAtual.metaGlobalMotosLoja}
                    onChange={(e) =>
                      updateCargoAtual({
                        metaGlobalMotosLoja: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 border border-purple-300 rounded-lg text-sm font-black text-purple-900"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Referência de volume mensal da unidade.
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-emerald-200">
                  <label className="block text-[10px] font-black text-emerald-900 uppercase mb-1">
                    Bônus de Meta Batida (R$)
                  </label>
                  <input
                    type="number"
                    step="50"
                    value={cargoAtual.bonusMetaAtingida}
                    onChange={(e) =>
                      updateCargoAtual({
                        bonusMetaAtingida: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 border border-emerald-300 rounded-lg text-sm font-black text-emerald-800"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Premiação paga quando a meta do mês é atingida.
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-blue-200">
                  <label className="block text-[10px] font-black text-blue-900 uppercase mb-1">
                    Retorno Financiamento F&I (R$)
                  </label>
                  <input
                    type="number"
                    step="10"
                    value={cargoAtual.comissaoRetornoPadrao}
                    onChange={(e) =>
                      updateCargoAtual({
                        comissaoRetornoPadrao: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 border border-blue-300 rounded-lg text-sm font-black text-blue-900"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Comissão padrão por ficha aprovada / retorno bancário.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Simulador Ao Vivo do Cargo Selecionado */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                  Simulador Instantâneo do Cargo
                </span>
                <h4 className="text-base font-black">
                  Simulação de Ganhos: {cargoAtual.titulo}
                </h4>
              </div>
              {onAbrirCadastroComCargo && (
                <button
                  type="button"
                  onClick={() => onAbrirCadastroComCargo(cargoAtual.id)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-2 self-start sm:self-auto"
                >
                  <i className="fa-solid fa-user-plus"></i> Cadastrar Funcionário neste Cargo
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {cargoAtual.departamento === 'VENDAS' && (
                <>
                  <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">
                      Motos (Lead Loja)
                    </label>
                    <input
                      type="number"
                      value={simMotosLoja}
                      onChange={(e) => setSimMotosLoja(Number(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-sm font-black text-white"
                    />
                  </div>
                  <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                    <label className="block text-[9px] font-black uppercase text-emerald-400 mb-1">
                      Motos (Captação Própria)
                    </label>
                    <input
                      type="number"
                      value={simMotosProprio}
                      onChange={(e) => setSimMotosProprio(Number(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-sm font-black text-emerald-300"
                    />
                  </div>
                  <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                    <label className="block text-[9px] font-black uppercase text-slate-400 mb-1">
                      Volume Vendido (R$)
                    </label>
                    <input
                      type="number"
                      step="5000"
                      value={simVendasReais}
                      onChange={(e) => setSimVendasReais(Number(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-sm font-black text-white"
                    />
                  </div>
                </>
              )}

              {cargoAtual.departamento === 'MECANICA' && (
                <>
                  <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                    <label className="block text-[9px] font-black uppercase text-amber-400 mb-1">
                      Motos Montadas no Mês
                    </label>
                    <input
                      type="number"
                      value={simMontagens}
                      onChange={(e) => setSimMontagens(Number(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-sm font-black text-amber-300"
                    />
                  </div>
                  <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                    <label className="block text-[9px] font-black uppercase text-amber-400 mb-1">
                      Revisões Executadas
                    </label>
                    <input
                      type="number"
                      value={simRevisoes}
                      onChange={(e) => setSimRevisoes(Number(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-sm font-black text-amber-300"
                    />
                  </div>
                </>
              )}

              {cargoAtual.departamento === 'GERENCIA' && (
                <>
                  <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                    <label className="block text-[9px] font-black uppercase text-purple-400 mb-1">
                      Total Motos Vendidas Loja
                    </label>
                    <input
                      type="number"
                      value={simMotosGerente}
                      onChange={(e) => setSimMotosGerente(Number(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-sm font-black text-purple-300"
                    />
                  </div>
                </>
              )}

              <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700 flex items-center">
                <label className="flex items-center gap-2 text-xs font-bold text-emerald-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simBateuMeta}
                    onChange={(e) => setSimBateuMeta(e.target.checked)}
                    className="rounded text-emerald-500"
                  />
                  Bateu a Meta do Mês (+{formatBRL(cargoAtual.bonusMetaAtingida)})
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/80">
                <span className="block text-[9px] font-black uppercase text-slate-400">
                  Salário Base
                </span>
                <span className="text-base font-black text-white">
                  {formatBRL(cargoAtual.salarioBasePadrao)}
                </span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/80">
                <span className="block text-[9px] font-black uppercase text-emerald-400">
                  Total Comissões + Meta
                </span>
                <span className="text-base font-black text-emerald-400">
                  {formatBRL(resultadoSimulacao.totalComissoes)}
                </span>
              </div>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/80">
                <span className="block text-[9px] font-black uppercase text-indigo-300">
                  DSR s/ Comissão + Ajuda
                </span>
                <span className="text-base font-black text-indigo-300">
                  {formatBRL(
                    resultadoSimulacao.dsrEstimado +
                      Number(cargoAtual.ajudaDeCustoIsentaPadrao || 0),
                  )}
                </span>
              </div>
              <div className="bg-indigo-600/30 p-3 rounded-xl border border-indigo-500/50">
                <span className="block text-[9px] font-black uppercase text-indigo-200">
                  Remuneração Bruta Estimada
                </span>
                <span className="text-lg font-black text-white">
                  {formatBRL(resultadoSimulacao.brutoEstimado)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para Criar Novo Cargo Personalizado */}
      {modalNovoCargoOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-briefcase text-indigo-600"></i>
                Criar Novo Cargo na Concessionária
              </h4>
              <button
                type="button"
                onClick={() => setModalNovoCargoOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleCriarNovoCargo} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Nome do Cargo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Supervisor de Vendas Usadas, Lavador Técnico..."
                  value={novoCargoTitulo}
                  onChange={(e) => setNovoCargoTitulo(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Setor / Departamento
                  </label>
                  <select
                    value={novoCargoDepto}
                    onChange={(e) => setNovoCargoDepto(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                  >
                    <option value="VENDAS">Vendas & Comercial</option>
                    <option value="MECANICA">Oficina & Mecânica</option>
                    <option value="GERENCIA">Gerência & Diretoria</option>
                    <option value="ADMINISTRATIVO">Administrativo & F&I</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    Vínculo Padrão
                  </label>
                  <select
                    value={novoCargoVinculo}
                    onChange={(e) => setNovoCargoVinculo(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                  >
                    <option value="CLT">CLT</option>
                    <option value="TERCEIRIZADO">Terceirizado / PJ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Salário Base / Fixo Sugerido (R$)
                </label>
                <input
                  type="number"
                  step="50"
                  value={novoCargoSalario}
                  onChange={(e) => setNovoCargoSalario(Number(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-black"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNovoCargoOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black"
                >
                  Criar Cargo e Configurar Comissões
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Adicionar Regra de Cidade / Município */}
      {modalNovaCidadeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-city text-emerald-600"></i>
                Adicionar Cidade / Praça
              </h4>
              <button
                type="button"
                onClick={() => {
                  setModalNovaCidadeOpen(false);
                  setCidadeSelecionadaNome('');
                }}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Selecione uma Cidade Cadastrada
                </label>
                <select
                  value={cidadeSelecionadaNome}
                  onChange={(e) => setCidadeSelecionadaNome(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                >
                  <option value="">-- Escolha da lista ou digite abaixo --</option>
                  {cidadesDisponiveis.map((cid) => (
                    <option key={cid} value={cid}>
                      {cid}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  Ou Digite Outra Cidade
                </label>
                <input
                  type="text"
                  placeholder="Ex: Montes Claros, Janaúba, Pirapora..."
                  value={cidadeSelecionadaNome}
                  onChange={(e) => setCidadeSelecionadaNome(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalNovaCidadeOpen(false);
                    setCidadeSelecionadaNome('');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!cidadeSelecionadaNome.trim()}
                  onClick={() => {
                    const cid = cidadeSelecionadaNome.trim();
                    if (!cid) return;
                    const mapaCidades = { ...(cargoAtual.cidadesDiferenciadas || {}) };
                    if (!mapaCidades[cid]) {
                      mapaCidades[cid] = {
                        adicionalPorMoto: 50, // sugestão padrão de acréscimo
                        salarioBase: cargoAtual.salarioBasePadrao,
                        valorMarketingProprioPorMoto: cargoAtual.valorMarketingProprioPorMoto,
                      };
                      updateCargoAtual({ cidadesDiferenciadas: mapaCidades });
                    }
                    setModalNovaCidadeOpen(false);
                    setCidadeSelecionadaNome('');
                    toast({
                      title: `Regra para ${cid} adicionada!`,
                      description: 'Defina o acréscimo por moto ou salário específico nos campos exibidos.',
                    });
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-50"
                >
                  Confirmar Cidade
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
