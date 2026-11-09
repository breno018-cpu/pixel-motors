import React, { useState, useEffect } from 'react';
import {
  Users,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  AlertTriangle,
  Lightbulb,
  Building2,
  Calendar,
  Layers,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  BarChart3,
  Edit2,
  Bike,
  Plus,
  Trash2,
  Image,
  Eye,
  Sliders,
  Save,
  Wrench,
  Trophy,
  Upload,
  X
} from 'lucide-react';

import HoleriteModal from './components/HoleriteModal';
import ModulosEspeciais from './components/ModulosEspeciais';
import GestaoFuncionarios from './components/GestaoFuncionarios';
import LancamentoVariaveisModal from './components/LancamentoVariaveisModal';

export default function App() {
  const [abaPrincipal, setAbaPrincipal] = useState('DASHBOARD'); // 'DASHBOARD', 'FUNCIONARIOS', 'ESPECIAIS', 'CONFIG'
  const [mesReferencia, setMesReferencia] = useState(new Date().toISOString().slice(0, 7)); // 'YYYY-MM'
  
  const [dadosFolha, setDadosFolha] = useState(null);
  const [listaFuncionarios, setListaFuncionarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  
  // Modais
  const [holeriteSelecionado, setHoleriteSelecionado] = useState(null);
  const [colaboradorLancamento, setColaboradorLancamento] = useState(null);

  // Dados da Empresa (Concessionária de Motocicletas com Marca d'água e Logo)
  const [empresa, setEmpresa] = useState({
    razaoSocial: 'Moto Show Concessionária e Serviços Ltda',
    cnpj: '',
    endereco: '',
    cidade: '',
    uf: '',
    regimeTributario: 'SIMPLES_NACIONAL',
    textoMarcaDagua: 'MOTO SHOW CONCESSIONÁRIA',
    opacidadeMarcaDagua: 0.05,
    exibirMarcaDagua: true,
    logoUrl: '',
    regrasComissao: [
      { de: 1, ate: 5, valorPorMoto: 50 },
      { de: 6, ate: 10, valorPorMoto: 75 },
      { de: 11, ate: 20, valorPorMoto: 100 },
      { de: 21, ate: 60, valorPorMoto: 150 },
      { de: 61, ate: 9999, valorPorMoto: 200 }
    ],
    regrasComissaoPlus: [
      { de: 1, ate: 5, valorPorMoto: 70 },
      { de: 6, ate: 10, valorPorMoto: 120 },
      { de: 11, ate: 15, valorPorMoto: 180 },
      { de: 16, ate: 9999, valorPorMoto: 250 }
    ],
    tiposComissoesLoja: [
      { id: '1', nome: 'Montagem de Motos na Caixa (Mecânico)', tipo: 'FIXO_UNIDADE', valorPadrao: 40, cargoSugerido: 'Mecânico' },
      { id: '2', nome: 'Venda de Consórcio / Financiamento (F&I)', tipo: 'FIXO_UNIDADE', valorPadrao: 100, cargoSugerido: 'Vendedor / F&I' },
      { id: '3', nome: 'Comissão de Peças & Balcão', tipo: 'PERCENTUAL', valorPadrao: 5, cargoSugerido: 'Vendedor de Peças' },
      { id: '4', nome: 'Bônus de Meta Superada', tipo: 'VALOR_LIVRE', valorPadrao: 500, cargoSugerido: 'Gerente / Todos' }
    ],
    regrasComissoesCargos: {
      valorPorMontagemMecanico: 40,
      percentualOficinaMecanico: 10, // % sobre mão de obra/serviços
      percentualVendedorPecas: 5,     // % sobre peças e acessórios
      percentualGerenteVendas: 1.5,   // % sobre faturamento global ou bônus
      valorFixoMetaGerente: 1000,     // Bônus fixo de superação de metas
      valorComissaoGerentePorMoto: 30 // R$ por moto vendida pela loja (comissão fixa do gerente)
    }
  });

  const carregarDadosCompletos = async (mes = mesReferencia) => {
    try {
      setCarregando(true);
      const [resFolha, resFunc] = await Promise.all([
        fetch(`/api/folha/calcular-mes?mes=${mes}`),
        fetch('/api/funcionarios')
      ]);

      const dataFolha = await resFolha.json();
      const dataFunc = await resFunc.json();

      setDadosFolha(dataFolha);
      setListaFuncionarios(Array.isArray(dataFunc) ? dataFunc : []);

      if (dataFolha && dataFolha.empresa) {
        setEmpresa(prev => ({
          ...prev,
          ...dataFolha.empresa,
          razaoSocial: dataFolha.empresa.razaoSocial || prev.razaoSocial || '',
          cnpj: dataFolha.empresa.cnpj || '',
          endereco: dataFolha.empresa.endereco || '',
          cidade: dataFolha.empresa.cidade || '',
          uf: dataFolha.empresa.uf || '',
          textoMarcaDagua: dataFolha.empresa.textoMarcaDagua || dataFolha.empresa.razaoSocial || 'MOTO SHOW CONCESSIONÁRIA',
          opacidadeMarcaDagua: dataFolha.empresa.opacidadeMarcaDagua !== undefined && dataFolha.empresa.opacidadeMarcaDagua !== null ? Number(dataFolha.empresa.opacidadeMarcaDagua) : 0.05,
          exibirMarcaDagua: dataFolha.empresa.exibirMarcaDagua !== undefined ? Boolean(dataFolha.empresa.exibirMarcaDagua) : true,
          logoUrl: dataFolha.empresa.logoUrl || '',
          regrasComissao: Array.isArray(dataFolha.empresa.regrasComissao) && dataFolha.empresa.regrasComissao.length > 0 
            ? dataFolha.empresa.regrasComissao 
            : prev.regrasComissao,
          regrasComissaoPlus: Array.isArray(dataFolha.empresa.regrasComissaoPlus) && dataFolha.empresa.regrasComissaoPlus.length > 0 
            ? dataFolha.empresa.regrasComissaoPlus 
            : prev.regrasComissaoPlus,
          tiposComissoesLoja: Array.isArray(dataFolha.empresa.tiposComissoesLoja) 
            ? dataFolha.empresa.tiposComissoesLoja 
            : prev.tiposComissoesLoja,
          regrasComissoesCargos: {
            ...prev.regrasComissoesCargos,
            ...(dataFolha.empresa.regrasComissoesCargos || {})
          }
        }));
      }
    } catch (err) {
      console.error('Erro ao carregar dados do sistema:', err);
    } finally {
      setCarregando(false);
    }
  };


  useEffect(() => {
    carregarDadosCompletos(mesReferencia);
  }, [mesReferencia]);

  const handleSalvarVariaveis = async (dados) => {
    try {
      // Garante que funcionarioId sempre seja um número válido
      const funcionarioId = Number(dados.funcionarioId || dados.funcionario?.id || dados.funcionario?.funcionarioId);
      if (!funcionarioId) {
        alert('Erro: ID do funcionário não encontrado. Recarregue a página e tente novamente.');
        return;
      }
      const payload = { ...dados, funcionarioId };
      console.log('[SAVE] Enviando para backend:', { funcionarioId: payload.funcionarioId, mesReferencia: payload.mesReferencia, motosVendidas: payload.motosVendidas });

      const res = await fetch('/api/folha/salvar-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      console.log('[SAVE] Resposta do backend:', res.status, json.error || 'OK');
      if (res.ok) {
        setColaboradorLancamento(null);
        await carregarDadosCompletos(mesReferencia);
      } else {
        alert('Erro ao salvar folha: ' + (json.error || 'Falha na requisição') + '\nStatus: ' + res.status);
      }
    } catch (err) {
      console.error('[SAVE] Erro de conexão:', err);
      alert('Erro de conexão ao salvar: ' + err.message);
    }
  };

  const salvarDadosEmpresa = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empresa)
      });
      if (res.ok) {
        alert('Configurações da Concessionária, Marca d’Água, Logo e Comissões salvas com sucesso!');
        carregarDadosCompletos(mesReferencia);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatarMoeda = (val) => (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Totais calculados
  const totalSalariosBrutos = dadosFolha?.colaboradores?.reduce((acc, c) => acc + c.totalProventos, 0) || 0;
  const totalLiquidoGeral = dadosFolha?.colaboradores?.reduce((acc, c) => acc + c.salarioLiquido, 0) || 0;
  const totalComissoesGeral = dadosFolha?.colaboradores?.reduce((acc, c) => acc + (c.comissaoMotos || 0), 0) || 0;
  const totalMotosVendidas = dadosFolha?.colaboradores?.reduce((acc, c) => acc + (c.motosVendidas || 0), 0) || 0;
  const totalEncargosFGTS = dadosFolha?.colaboradores?.reduce((acc, c) => acc + c.fgts, 0) || 0;
  const totalCustoEmpresa = dadosFolha?.colaboradores?.reduce((acc, c) => acc + c.custoTotalEmpresa, 0) || 0;

  // Funções de manipulação das faixas de comissão
  const handleRegraChange = (index, campo, valor) => {
    const regrasAtuais = Array.isArray(empresa.regrasComissao) ? empresa.regrasComissao : [];
    const novasRegras = [...regrasAtuais];
    novasRegras[index] = { ...novasRegras[index], [campo]: Number(valor) };
    setEmpresa({ ...empresa, regrasComissao: novasRegras });
  };

  const adicionarFaixaComissao = () => {
    const regrasAtuais = Array.isArray(empresa.regrasComissao) ? empresa.regrasComissao : [];
    const ult = regrasAtuais[regrasAtuais.length - 1];
    const de = ult ? ult.ate + 1 : 1;
    const ate = de + 5;
    setEmpresa({
      ...empresa,
      regrasComissao: [...regrasAtuais, { de, ate, valorPorMoto: 100 }]
    });
  };

  const removerFaixaComissao = (index) => {
    const regrasAtuais = Array.isArray(empresa.regrasComissao) ? empresa.regrasComissao : [];
    if (regrasAtuais.length <= 1) return;
    const novas = regrasAtuais.filter((_, i) => i !== index);
    setEmpresa({ ...empresa, regrasComissao: novas });
  };


  // Funções de manipulação das faixas de comissão do Vendedor +
  const handleRegraPlusChange = (index, campo, valor) => {
    const novasRegras = [...(empresa.regrasComissaoPlus || [])];
    novasRegras[index] = { ...novasRegras[index], [campo]: Number(valor) };
    setEmpresa({ ...empresa, regrasComissaoPlus: novasRegras });
  };

  const adicionarFaixaComissaoPlus = () => {
    const list = empresa.regrasComissaoPlus || [];
    const ult = list[list.length - 1];
    const de = ult ? ult.ate + 1 : 1;
    const ate = de + 5;
    setEmpresa({
      ...empresa,
      regrasComissaoPlus: [...list, { de, ate, valorPorMoto: 150 }]
    });
  };

  const removerFaixaComissaoPlus = (index) => {
    if ((empresa.regrasComissaoPlus || []).length <= 1) return;
    const novas = empresa.regrasComissaoPlus.filter((_, i) => i !== index);
    setEmpresa({ ...empresa, regrasComissaoPlus: novas });
  };

  // Gerenciamento do Leque de Comissões Únicas Configuráveis
  const adicionarTipoComissao = () => {
    const novaComissao = {
      id: Date.now().toString(),
      nome: 'Nova Comissão (ex: Lavador, F&I, Meta)',
      tipo: 'FIXO_UNIDADE', // 'FIXO_UNIDADE', 'PERCENTUAL', 'VALOR_LIVRE'
      valorPadrao: 50,
      cargoSugerido: 'Geral'
    };
    setEmpresa({
      ...empresa,
      tiposComissoesLoja: [...(empresa.tiposComissoesLoja || []), novaComissao]
    });
  };

  const atualizarTipoComissao = (id, campo, valor) => {
    const atualizadas = (empresa.tiposComissoesLoja || []).map(t => {
      if (t.id === id) {
        return { ...t, [campo]: campo === 'valorPadrao' ? Number(valor) : valor };
      }
      return t;
    });
    setEmpresa({ ...empresa, tiposComissoesLoja: atualizadas });
  };

  const removerTipoComissao = (id) => {
    const atualizadas = (empresa.tiposComissoesLoja || []).filter(t => t.id !== id);
    setEmpresa({ ...empresa, tiposComissoesLoja: atualizadas });
  };

  // Upload de arquivo de imagem do computador para a Logo (Base64)
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, JPEG, SVG ou WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('O arquivo selecionado é maior que 5MB. Por favor, escolha uma imagem mais leve.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      if (base64) {
        setEmpresa(prev => ({ ...prev, logoUrl: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoverLogo = () => {
    setEmpresa(prev => ({ ...prev, logoUrl: '' }));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Barra de Navegação Superior Responsiva */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 shrink-0">
            {empresa.logoUrl ? (
              <img src={empresa.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-xl border border-slate-200 p-0.5 shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-indigo-700 flex items-center justify-center text-white shadow-md font-black shrink-0">
                <Bike className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight flex items-center gap-2 truncate">
                MotoFolha Pro <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 shrink-0">Concessionária</span>
              </span>
              <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-md">{empresa.razaoSocial || 'Concessionária de Motos'}</p>
            </div>
          </div>

          {/* Abas do Menu com rolagem horizontal suave */}
          <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none shrink-0">
            <button
              onClick={() => setAbaPrincipal('DASHBOARD')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                abaPrincipal === 'DASHBOARD'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Folha Mensal
            </button>

            <button
              onClick={() => setAbaPrincipal('FUNCIONARIOS')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                abaPrincipal === 'FUNCIONARIOS'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" /> Colaboradores ({listaFuncionarios.length})
            </button>

            <button
              onClick={() => setAbaPrincipal('ESPECIAIS')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                abaPrincipal === 'ESPECIAIS'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-4 h-4" /> Férias, 13º e Rescisões
            </button>

            <button
              onClick={() => setAbaPrincipal('CONFIG')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                abaPrincipal === 'CONFIG'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4" /> Concessionária & Logo
            </button>
          </nav>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* ============================================================ */}
        {/* 1. ABA DASHBOARD & FOLHA MENSAL */}
        {/* ============================================================ */}
        {abaPrincipal === 'DASHBOARD' && (
          <div className="space-y-6">
            
            {/* Barra de Filtro de Mês e Status */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap justify-between items-center gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <span className="text-sm font-bold text-slate-700">Competência da Folha:</span>
                <input
                  type="month"
                  value={mesReferencia}
                  onChange={(e) => setMesReferencia(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl">
                  <Bike className="w-4 h-4" /> {totalMotosVendidas} Motos Vendidas no Mês
                </div>
                <div className="text-xs bg-indigo-50 text-indigo-700 font-bold px-3 py-1.5 rounded-xl border border-indigo-200">
                  {dadosFolha?.colaboradores?.length || 0} Colaboradores
                </div>
              </div>
            </div>

            {/* Painel de Indicadores Financeiros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <span className="truncate">Proventos Brutos</span>
                  <DollarSign className="w-4 h-4 text-indigo-600 shrink-0" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2 truncate">{formatarMoeda(totalSalariosBrutos)}</div>
                <span className="text-[11px] sm:text-xs text-slate-400 mt-1 block truncate">Salários + Comissões + H.E.</span>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <span className="truncate">Comissões (Total)</span>
                  <Bike className="w-4 h-4 text-amber-600 shrink-0" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-600 mt-2 truncate">{formatarMoeda(totalComissoesGeral)}</div>
                <span className="text-[11px] sm:text-xs text-slate-400 mt-1 block truncate">{totalMotosVendidas} motos entregues</span>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <span className="truncate">Líquido a Pagar</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-2 truncate">{formatarMoeda(totalLiquidoGeral)}</div>
                <span className="text-[11px] sm:text-xs text-slate-400 mt-1 block truncate">Depósito em conta da equipe</span>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <span className="truncate">Custo Concessionária</span>
                  <Building2 className="w-4 h-4 text-violet-600 shrink-0" />
                </div>
                <div className="text-xl sm:text-2xl font-black text-violet-700 mt-2 truncate">{formatarMoeda(totalCustoEmpresa)}</div>
                <span className="text-[11px] sm:text-xs text-slate-400 mt-1 block truncate">Salários + Encargos Totais</span>
              </div>
            </div>

            {/* Tabela de Fechamento da Folha */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-slate-800">Folha de Pagamento do Mês ({mesReferencia})</h4>
                  <p className="text-xs text-slate-500">Mecânica, Vendas com Comissões por Moto, Peças, F&I e Administração</p>
                </div>
              </div>

              {dadosFolha?.colaboradores?.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-xs">
                  Nenhum colaborador na base. Vá na aba <strong>"Colaboradores"</strong> para cadastrar a equipe da concessionária.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[760px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Colaborador / Setor</th>
                        <th className="py-3 px-4">Salário Fixo</th>
                        <th className="py-3 px-4 text-center">Motos / Comissão</th>
                        <th className="py-3 px-4">Horas Extras / Adic.</th>
                        <th className="py-3 px-4">Total Bruto</th>
                        <th className="py-3 px-4">INSS</th>
                        <th className="py-3 px-4">IRRF</th>
                        <th className="py-3 px-4 font-bold text-slate-900">Salário Líquido</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dadosFolha?.colaboradores?.map((colab) => {
                        const horasExtras = colab.proventos.filter(p => (p.rubrica.includes('Horas') || p.rubrica.includes('Noturno')) && !p.rubrica.includes('Comissão'));
                        const totalHorasExtrasValor = horasExtras.reduce((sum, h) => sum + h.valor, 0);

                        return (
                          <tr key={colab.funcionarioId} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 max-w-[200px]">
                              <div className="font-bold text-slate-900 truncate">{colab.funcionarioNome}</div>
                              <div className="text-[11px] text-slate-400 truncate">{colab.cargo} • {colab.departamento}</div>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">{formatarMoeda(colab.salarioBase)}</td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              {colab.motosVendidas > 0 ? (
                                <div className="inline-block bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg text-left">
                                  <div className="font-black text-amber-900 text-xs flex items-center gap-1">
                                    <Bike className="w-3.5 h-3.5 text-amber-600 shrink-0" /> {colab.motosVendidas} motos
                                  </div>
                                  <div className="text-[10px] text-amber-700 font-bold">
                                    {formatarMoeda(colab.comissaoMotos)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">0 motos</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                              {totalHorasExtrasValor > 0 ? (
                                <span className="font-semibold text-indigo-600">{formatarMoeda(totalHorasExtrasValor)}</span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{formatarMoeda(colab.totalProventos)}</td>
                            <td className="py-3 px-4 text-rose-600 font-medium whitespace-nowrap">
                              {colab.inssDetalhe?.valor > 0 ? (
                                <>
                                  - {formatarMoeda(colab.inssDetalhe?.valor)}
                                  <span className="block text-[10px] text-slate-400">{colab.inssDetalhe?.aliquotaEfetiva}%</span>
                                </>
                              ) : (
                                <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  Não Cobrado
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-rose-600 font-medium whitespace-nowrap">
                              {colab.irrfDetalhe?.valor > 0 ? (
                                <>
                                  - {formatarMoeda(colab.irrfDetalhe?.valor)}
                                  <span className="block text-[10px] text-slate-400">{colab.irrfDetalhe?.aliquota}%</span>
                                </>
                              ) : (
                                <span className="text-slate-500 font-normal">Isento</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-extrabold text-sm text-emerald-700 bg-emerald-50/50 whitespace-nowrap">
                              {formatarMoeda(colab.salarioLiquido)}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => setColaboradorLancamento(colab)}
                                  className="px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg font-semibold flex items-center gap-1 transition text-xs"
                                  title="Lançar Vendas de Motos, Horas e Faltas"
                                >
                                  <Edit2 className="w-3.5 h-3.5" /> Lançar Motos
                                </button>
                                <button
                                  onClick={() => setHoleriteSelecionado({
                                    empresa,
                                    funcionario: colab,
                                    folha: colab
                                  })}
                                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1 shadow-xs transition text-xs"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Holerite
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 2. ABA DE GESTÃO DE COLABORADORES */}
        {/* ============================================================ */}
        {abaPrincipal === 'FUNCIONARIOS' && (
          <GestaoFuncionarios
            funcionarios={listaFuncionarios}
            onAtualizar={() => carregarDadosCompletos(mesReferencia)}
          />
        )}

        {/* ============================================================ */}
        {/* 3. ABA DE MÓDULOS ESPECIAIS (FÉRIAS, 13º, RESCISÃO) */}
        {/* ============================================================ */}
        {abaPrincipal === 'ESPECIAIS' && <ModulosEspeciais />}

        {/* ============================================================ */}
        {/* 4. ABA DE CONFIGURAÇÕES DA CONCESSIONÁRIA, LOGO E MARCA D'ÁGUA */}
        {/* ============================================================ */}
        {abaPrincipal === 'CONFIG' && (
          <form onSubmit={salvarDadosEmpresa} className="space-y-6 max-w-4xl mx-auto">
            
            {/* Barra superior de Ação Rápida */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-4 rounded-2xl flex justify-between items-center shadow-lg">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-indigo-400" /> Painel de Configurações da Concessionária
                </h3>
                <p className="text-xs text-indigo-200">
                  Salve os dados cadastrais, regras de comissão e marca d'água do holerite.
                </p>
              </div>
              <button
                type="submit"
                className="bg-indigo-500 hover:bg-indigo-600 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-md transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Salvar Tudo
              </button>
            </div>

            {/* SEÇÃO 1: LOGOTIPO E MARCA D'ÁGUA CONFIGURÁVEIS DO HOLERITE */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Sliders className="text-indigo-600 w-5 h-5" /> Configuração da Marca d’Água & Logotipo do Contracheque
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina o texto, a opacidade da marca d'água no fundo do recibo e adicione o link do logotipo da sua concessionária.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Texto da Marca d’Água</label>
                    <input
                      type="text"
                      placeholder="Ex: MOTO SHOW CONCESSIONÁRIA"
                      value={empresa.textoMarcaDagua || ''}
                      onChange={(e) => setEmpresa({ ...empresa, textoMarcaDagua: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-bold"
                    />
                  </div>

                  {/* LOGOTIPO: UPLOAD DE ARQUIVO DO COMPUTADOR OU LINK */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Logotipo da Concessionária (Arquivo do Computador ou Link)
                    </label>
                    
                    <div className="flex gap-2 items-center">
                      {/* Botão de Enviar Arquivo Local */}
                      <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition shrink-0">
                        <Upload className="w-4 h-4" /> Escolher Arquivo
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>

                      {/* Input de URL alternativo */}
                      <input
                        type="text"
                        placeholder="Ou cole a URL da imagem aqui"
                        value={empresa.logoUrl && typeof empresa.logoUrl === 'string' && empresa.logoUrl.startsWith('data:image') ? '[Imagem em Arquivo Carregada]' : (empresa.logoUrl || '')}
                        onChange={(e) => setEmpresa({ ...empresa, logoUrl: e.target.value })}
                        disabled={Boolean(empresa.logoUrl && typeof empresa.logoUrl === 'string' && empresa.logoUrl.startsWith('data:image'))}
                        className={`w-full px-3 py-2 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 ${
                          empresa.logoUrl && typeof empresa.logoUrl === 'string' && empresa.logoUrl.startsWith('data:image')
                            ? 'bg-slate-100 text-slate-500 font-bold border-indigo-200'

                            : 'bg-white border-slate-300'
                        }`}
                      />

                      {/* Botão de Remover Imagem se houver logo */}
                      {empresa.logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoverLogo}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition shrink-0"
                          title="Remover logotipo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Mini prévia da logo carregada */}
                    {empresa.logoUrl && (
                      <div className="mt-2.5 flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200">
                        <img
                          src={empresa.logoUrl}
                          alt="Pré-visualização do Logotipo"
                          className="w-12 h-12 object-contain rounded border border-slate-100 bg-slate-50 p-1"
                        />
                        <div className="text-[11px] text-slate-600">
                          <span className="font-bold text-emerald-700 block flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Logotipo ativo no Contracheque
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {typeof empresa.logoUrl === 'string' && empresa.logoUrl.startsWith('data:image') ? 'Carregado direto do seu computador (Arquivo Local)' : 'Carregado via URL/Link Web'}
                          </span>

                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-2">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-700">Opacidade da Marca d’Água:</label>
                      <span className="text-xs font-black text-indigo-600">{(Number(empresa.opacidadeMarcaDagua || 0.05) * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.01"
                      max="0.25"
                      step="0.01"
                      value={Number(empresa.opacidadeMarcaDagua || 0.05)}
                      onChange={(e) => setEmpresa({ ...empresa, opacidadeMarcaDagua: parseFloat(e.target.value) || 0.05 })}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(empresa.exibirMarcaDagua)}
                        onChange={(e) => setEmpresa({ ...empresa, exibirMarcaDagua: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span>Exibir Marca d’Água no Contracheque</span>
                    </label>
                  </div>

                </div>
              </div>
            </div>

            {/* SEÇÃO 2: TABELA DE COMISSÕES DE VENDEDOR DE MOTOS */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Bike className="text-amber-600 w-5 h-5" /> Regras de Comissão por Quantidade de Motos
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina quanto o vendedor ganha por moto vendida de acordo com a faixa de volume alcançada no mês.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={adicionarFaixaComissao}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  <Plus className="w-4 h-4" /> Adicionar Faixa
                </button>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[420px]">

                  <thead>
                    <tr className="text-slate-600 font-bold border-b border-slate-200 pb-2">
                      <th className="py-2">De (Motos)</th>
                      <th className="py-2">Até (Motos)</th>
                      <th className="py-2">Valor Fixo por Moto (R$)</th>
                      <th className="py-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {empresa.regrasComissao?.map((regra, idx) => (
                      <tr key={idx} className="py-2">
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            value={regra.de}
                            onChange={(e) => handleRegraChange(idx, 'de', e.target.value)}
                            className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg font-semibold bg-white outline-none"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            value={regra.ate}
                            onChange={(e) => handleRegraChange(idx, 'ate', e.target.value)}
                            className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg font-semibold bg-white outline-none"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-500">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={regra.valorPorMoto}
                              onChange={(e) => handleRegraChange(idx, 'valorPorMoto', e.target.value)}
                              className="w-28 px-2 py-1.5 border border-slate-300 rounded-lg font-bold text-amber-900 bg-white outline-none"
                            />
                            <span className="text-slate-400 text-[11px]">/ moto</span>
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removerFaixaComissao(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200 transition"
                            title="Remover faixa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SEÇÃO 2.0.1: TABELA DE COMISSÕES DIFERENCIADA PARA VENDEDOR + */}
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 p-6 rounded-2xl border-2 border-amber-400 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-amber-950 flex items-center gap-2">
                    <Bike className="text-orange-600 w-5 h-5" /> ⭐ Tabela de Comissão Especial: Cargo Vendedor +
                  </h3>
                  <p className="text-xs text-amber-900 font-medium">
                    Configure a comissão diferenciada para vendedores que ocupam a função <strong>Vendedor +</strong> na loja.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={adicionarFaixaComissaoPlus}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  <Plus className="w-4 h-4" /> Adicionar Faixa Vendedor +
                </button>
              </div>

              <div className="bg-white p-4 rounded-xl border border-amber-300 overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[420px]">

                  <thead>
                    <tr className="text-slate-700 font-bold border-b border-amber-200 pb-2">
                      <th className="py-2">De (Motos)</th>
                      <th className="py-2">Até (Motos)</th>
                      <th className="py-2">Valor Diferenciado por Moto (R$)</th>
                      <th className="py-2 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {empresa.regrasComissaoPlus?.map((regra, idx) => (
                      <tr key={idx} className="py-2">
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            value={regra.de}
                            onChange={(e) => handleRegraPlusChange(idx, 'de', e.target.value)}
                            className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg font-semibold bg-white outline-none"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            type="number"
                            value={regra.ate}
                            onChange={(e) => handleRegraPlusChange(idx, 'ate', e.target.value)}
                            className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg font-semibold bg-white outline-none"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-amber-800">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={regra.valorPorMoto}
                              onChange={(e) => handleRegraPlusChange(idx, 'valorPorMoto', e.target.value)}
                              className="w-28 px-2 py-1.5 border-2 border-amber-300 rounded-lg font-black text-amber-950 bg-amber-50/50 outline-none"
                            />
                            <span className="text-amber-800 text-[11px] font-bold">/ moto</span>
                          </div>
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removerFaixaComissaoPlus(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                            title="Remover faixa Vendedor +"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SEÇÃO 2.1: COMISSÃO DE MECÂNICO POR MONTAGEM DE MOTOS (VALOR FIXO POR MOTO) */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-2xl border-2 border-amber-300 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-amber-950 flex items-center gap-2">
                    <Wrench className="text-orange-600 w-5 h-5" /> Comissão de Mecânico: Fixa por Montagem de Motos
                  </h3>
                  <p className="text-xs text-amber-800">
                    O mecânico recebe um <strong>valor fixo por cada moto montada</strong> (retirada da caixa e ativada).
                  </p>
                </div>
                <span className="text-xs bg-amber-200 text-amber-950 font-black px-3 py-1 rounded-full border border-amber-400">
                  Regra Exclusiva Mecânica
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-amber-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Valor Fixo Padrão por Moto Montada (R$)</label>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-500">R$</span>
                    <input
                      type="number"
                      step="1"
                      value={empresa.regrasComissoesCargos?.valorPorMontagemMecanico || 40}
                      onChange={(e) => setEmpresa({
                        ...empresa,
                        regrasComissoesCargos: {
                          ...empresa.regrasComissoesCargos,
                          valorPorMontagemMecanico: Number(e.target.value)
                        }
                      })}
                      className="w-full px-3 py-2 border-2 border-amber-300 rounded-lg text-base font-black text-amber-900 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">/ moto montada</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Ex: R$ 40,00 por montagem realizada no mês.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Comissão Serviços Gerais Oficina (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      value={empresa.regrasComissoesCargos?.percentualOficinaMecanico || 10}
                      onChange={(e) => setEmpresa({
                        ...empresa,
                        regrasComissoesCargos: {
                          ...empresa.regrasComissoesCargos,
                          percentualOficinaMecanico: Number(e.target.value)
                        }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold bg-white outline-none"
                    />
                    <span className="text-xs text-slate-500 font-semibold">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Sobre revisões pagas e consertos avulsos.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Comissão Peças & Acessórios (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      value={empresa.regrasComissoesCargos?.percentualVendedorPecas || 5}
                      onChange={(e) => setEmpresa({
                        ...empresa,
                        regrasComissoesCargos: {
                          ...empresa.regrasComissoesCargos,
                          percentualVendedorPecas: Number(e.target.value)
                        }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold bg-white outline-none"
                    />
                    <span className="text-xs text-slate-500 font-semibold">%</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Para estoquista ou balconista de peças.</p>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2.1b: COMISSÃO DO GERENTE: Valor Fixo por Moto Vendida pela Loja */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-2xl border-2 border-emerald-300 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black text-emerald-950 flex items-center gap-2">
                    <Trophy className="text-emerald-600 w-5 h-5" /> Comissão do Gerente: Valor Fixo por Moto da Loja
                  </h3>
                  <p className="text-xs text-emerald-800">
                    O gerente recebe um <strong>valor fixo por cada moto vendida pelos vendedores da loja</strong>, independente de quem vendeu. É diferente da comissão do vendedor (que tem faixas progressivas).
                  </p>
                </div>
                <span className="text-xs bg-emerald-200 text-emerald-950 font-black px-3 py-1 rounded-full border border-emerald-400">
                  Regra Exclusiva Gerência
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-emerald-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Comissão Fixa do Gerente por Moto (R$)</label>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-500">R$</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={empresa.regrasComissoesCargos?.valorComissaoGerentePorMoto || 30}
                      onChange={(e) => setEmpresa({
                        ...empresa,
                        regrasComissoesCargos: {
                          ...empresa.regrasComissoesCargos,
                          valorComissaoGerentePorMoto: Number(e.target.value)
                        }
                      })}
                      className="w-full px-3 py-2 border-2 border-emerald-300 rounded-lg text-base font-black text-emerald-900 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">/ moto da loja</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Ex: Se a loja vendeu 57 motos e o valor é R$ 30,00, o gerente ganha R$ {(57 * (empresa.regrasComissoesCargos?.valorComissaoGerentePorMoto || 30)).toLocaleString('pt-BR', {style:'currency',currency:'BRL'})}.
                  </p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <div className="text-xs font-bold text-emerald-900 mb-1">📊 Diferença entre Gerente e Vendedor:</div>
                  <div className="text-[11px] text-emerald-800 space-y-1">
                    <div>🏆 <strong>Gerente:</strong> R$ {empresa.regrasComissoesCargos?.valorComissaoGerentePorMoto || 30} × total de motos da loja (fixo, por cada moto)</div>
                    <div>🏍️ <strong>Vendedor:</strong> Faixa progressiva (ex: até 60 motos = R$ 150/un) pelas motos que ELE vendeu</div>
                  </div>
                </div>
              </div>
            </div>

            {/* SEÇÃO 2.2: LEQUE DE COMISSÕES ÚNICAS E CONFIGURÁVEIS DA CONCESSIONÁRIA */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Trophy className="text-indigo-600 w-5 h-5" /> Leque de Comissões Únicas & Configuráveis
                  </h3>
                  <p className="text-xs text-slate-500">
                    Crie tipos personalizados de comissões para atender todos os cargos da sua loja (F&I, Vendas, Lavador, Gerência, Metas).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={adicionarTipoComissao}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Plus className="w-4 h-4" /> Adicionar Nova Comissão
                </button>
              </div>

              <div className="space-y-3">
                {(!empresa.tiposComissoesLoja || empresa.tiposComissoesLoja.length === 0) ? (
                  <div className="p-4 bg-slate-50 text-center text-xs text-slate-400 rounded-xl border border-dashed border-slate-300">
                    Nenhuma comissão extra cadastrada. Clique no botão acima para adicionar.
                  </div>
                ) : (
                  empresa.tiposComissoesLoja.map((comissao) => (
                    <div key={comissao.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Nome da Comissão</label>
                        <input
                          type="text"
                          value={comissao.nome}
                          onChange={(e) => atualizarTipoComissao(comissao.id, 'nome', e.target.value)}
                          placeholder="Ex: Financiamento F&I / Lavagem / Consórcio"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white outline-none"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Cargo / Função Destino</label>
                        <input
                          type="text"
                          value={comissao.cargoSugerido || ''}
                          onChange={(e) => atualizarTipoComissao(comissao.id, 'cargoSugerido', e.target.value)}
                          placeholder="Ex: Mecânico, Vendedor, Lavador"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white outline-none"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Modelo de Cálculo</label>
                        <select
                          value={comissao.tipo}
                          onChange={(e) => atualizarTipoComissao(comissao.id, 'tipo', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white outline-none"
                        >
                          <option value="FIXO_UNIDADE">Fixo por Unidade (R$)</option>
                          <option value="PERCENTUAL">Percentual (%)</option>
                          <option value="VALOR_LIVRE">Valor Livre (R$)</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Valor Padrão</label>
                        <input
                          type="number"
                          step="0.01"
                          value={comissao.valorPadrao || 0}
                          onChange={(e) => atualizarTipoComissao(comissao.id, 'valorPadrao', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-indigo-900 bg-white outline-none"
                        />
                      </div>

                      <div className="md:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removerTipoComissao(comissao.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Remover tipo de comissão"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SEÇÃO 3: DADOS CADASTRAIS DA CONCESSIONÁRIA */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                <Building2 className="text-indigo-600 w-5 h-5" /> Dados Cadastrais da Concessionária
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Razão social, CNPJ e endereço para emissão de contracheques e relatórios.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Razão Social da Concessionária</label>
                    <input
                      type="text"
                      placeholder="Ex: Moto Veloce Comércio de Motos Ltda"
                      value={empresa.razaoSocial || ''}
                      onChange={(e) => setEmpresa({ ...empresa, razaoSocial: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">CNPJ</label>
                    <input
                      type="text"
                      placeholder="00.000.000/0001-00"
                      value={empresa.cnpj || ''}
                      onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Endereço (Loja / Oficina de Motos)</label>
                  <input
                    type="text"
                    placeholder="Ex: Av. das Motocicletas, 500"
                    value={empresa.endereco || ''}
                    onChange={(e) => setEmpresa({ ...empresa, endereco: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Cidade</label>
                    <input
                      type="text"
                      placeholder="Sua cidade"
                      value={empresa.cidade || ''}
                      onChange={(e) => setEmpresa({ ...empresa, cidade: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">UF (Estado)</label>
                    <input
                      type="text"
                      placeholder="UF"
                      value={empresa.uf || ''}
                      onChange={(e) => setEmpresa({ ...empresa, uf: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>


                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow transition flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Salvar Todas as Configurações
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>

      {/* Modal de Holerite */}
      {holeriteSelecionado && (
        <HoleriteModal
          dados={holeriteSelecionado}
          onClose={() => setHoleriteSelecionado(null)}
        />
      )}

      {/* Modal de Lançamentos Mensais (Motos vendidas, Montagens mecânicos, Comissões custom, Horas extras, faltas) */}
      {colaboradorLancamento && (
        <LancamentoVariaveisModal
          funcionario={colaboradorLancamento}
          mesReferencia={mesReferencia}
          empresa={empresa}
          regrasComissao={empresa.regrasComissao}
          onSalvar={handleSalvarVariaveis}
          onClose={() => setColaboradorLancamento(null)}
        />
      )}
    </div>
  );
}
