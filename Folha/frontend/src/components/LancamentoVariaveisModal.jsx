import React, { useState } from 'react';
import { Save, FileText, Clock, AlertCircle, Edit3, X, Bike, Wrench, Trophy, Receipt, DollarSign, Plus, ShoppingBag } from 'lucide-react';


export default function LancamentoVariaveisModal({ funcionario, mesReferencia, regrasComissao, empresa, onSalvar, onClose }) {
  if (!funcionario) return null;

  const valorPadraoMontagem = empresa?.regrasComissoesCargos?.valorPorMontagemMecanico || 40;

  const [form, setForm] = useState({
    motosVendidas: funcionario.variaveisEntrada?.motosVendidas || funcionario.motosVendidas || 0,
    motosMarketingLoja: funcionario.variaveisEntrada?.motosMarketingLoja ?? (funcionario.motosMarketingLoja || 0),
    motosMarketingProprio: funcionario.variaveisEntrada?.motosMarketingProprio ?? (funcionario.motosMarketingProprio || 0),
    valorMarketingProprio: funcionario.variaveisEntrada?.valorMarketingProprio ?? (funcionario.valorMarketingProprio || 500),
    motosMontadas: funcionario.variaveisEntrada?.motosMontadas || funcionario.motosMontadas || 0,
    valorPorMontagem: funcionario.variaveisEntrada?.valorPorMontagem !== undefined ? funcionario.variaveisEntrada.valorPorMontagem : valorPadraoMontagem,
    comissaoServicos: funcionario.variaveisEntrada?.comissaoServicos || funcionario.comissaoServicos || 0,
    comissaoGeral: funcionario.variaveisEntrada?.comissaoGeral || funcionario.comissaoGeral || 0,
    descricaoComissaoGeral: funcionario.variaveisEntrada?.descricaoComissaoGeral || '',
    comissoesDetalhadas: funcionario.variaveisEntrada?.comissoesDetalhadas || funcionario.comissoesDetalhadas || [],
    horas50: funcionario.variaveisEntrada?.horas50 || 0,
    horas100: funcionario.variaveisEntrada?.horas100 || 0,
    horasNoturnas: funcionario.variaveisEntrada?.horasNoturnas || 0,
    diasUteis: funcionario.variaveisEntrada?.diasUteis || 25,
    domingosEFeriados: funcionario.variaveisEntrada?.domingosEFeriados || 5,
    faltasDias: funcionario.variaveisEntrada?.faltasDias || 0,
    atrasosMinutos: funcionario.variaveisEntrada?.atrasosMinutos || 0,
    outrosProventos: funcionario.variaveisEntrada?.outrosProventos || 0,
    outrosProventosDescricao: funcionario.variaveisEntrada?.outrosProventosDescricao || '',
    ajudaDeCusto: funcionario.variaveisEntrada?.ajudaDeCusto ?? (funcionario.ajudaDeCusto || 0),
    ajudaDeCustoDescricao: funcionario.variaveisEntrada?.ajudaDeCustoDescricao ?? (funcionario.ajudaDeCustoDescricao || ''),
    reembolsoDespesas: funcionario.variaveisEntrada?.reembolsoDespesas ?? (funcionario.reembolsoDespesas || 0),
    reembolsoDespesasDescricao: funcionario.variaveisEntrada?.reembolsoDespesasDescricao ?? (funcionario.reembolsoDespesasDescricao || ''),
    gastosDiversos: funcionario.variaveisEntrada?.gastosDiversos ?? (funcionario.gastosDiversos || 0),
    gastosDiversosDescricao: funcionario.variaveisEntrada?.gastosDiversosDescricao ?? (funcionario.gastosDiversosDescricao || ''),
    comissaoMotoParceiro: funcionario.variaveisEntrada?.comissaoMotoParceiro ?? (funcionario.comissaoMotoParceiro || 0),
    motoParceiroQtd: funcionario.variaveisEntrada?.motoParceiroQtd ?? (funcionario.motoParceiroQtd || 0),
    motoParceiroDescricao: funcionario.variaveisEntrada?.motoParceiroDescricao ?? (funcionario.motoParceiroDescricao || ''),
    comissaoRetorno: funcionario.variaveisEntrada?.comissaoRetorno ?? (funcionario.comissaoRetorno || 0),
    retornoDescricao: funcionario.variaveisEntrada?.retornoDescricao ?? (funcionario.retornoDescricao || ''),
    outrosDescontos: funcionario.variaveisEntrada?.outrosDescontos || 0,
    outrosDescontosDescricao: funcionario.variaveisEntrada?.outrosDescontosDescricao || '',
    pensaoAlimenticia: funcionario.variaveisEntrada?.pensaoAlimenticia || 0,
    motosLojaGerente: funcionario.variaveisEntrada?.motosLojaGerente ?? (funcionario.motosLojaGerente || 0),
    valorComissaoGerentePorMoto: funcionario.variaveisEntrada?.valorComissaoGerentePorMoto ?? (empresa?.regrasComissoesCargos?.valorComissaoGerentePorMoto || 30),
    comissaoTreinamento: funcionario.variaveisEntrada?.comissaoTreinamento ?? (funcionario.comissaoTreinamento || 0),
    comissaoTreinamentoDescricao: funcionario.variaveisEntrada?.comissaoTreinamentoDescricao ?? (funcionario.comissaoTreinamentoDescricao || ''),
  });

  // Cálculo prévio em tempo real da comissão para o modal
  const cargoLower = (funcionario.cargo || '').toLowerCase();
  const depLower = (funcionario.departamento || '').toLowerCase();
  const isVendedorPlus = funcionario.modeloComissaoVendedor === 'VENDEDOR_PLUS' || 
                         funcionario.variaveisEntrada?.funcionario?.modeloComissaoVendedor === 'VENDEDOR_PLUS' ||
                         cargoLower.includes('+') || cargoLower.includes('plus');

  const tabelaParaCalculo = isVendedorPlus && empresa?.regrasComissaoPlus && empresa.regrasComissaoPlus.length > 0
    ? empresa.regrasComissaoPlus
    : (regrasComissao && regrasComissao.length > 0 ? regrasComissao : [
        { de: 1, ate: 5, valorPorMoto: 50 },
        { de: 6, ate: 10, valorPorMoto: 75 },
        { de: 11, ate: 20, valorPorMoto: 100 },
        { de: 21, ate: 60, valorPorMoto: 150 },
        { de: 61, ate: 9999, valorPorMoto: 200 }
      ]);

  // 1. Vendas de motos
  // Se for Vendedor +, podemos ter motos do marketing da loja e do próprio marketing (R$ 500/moto de todas)
  const qtdMotosLoja = Number(form.motosMarketingLoja) || 0;
  const qtdMotosProprio = Number(form.motosMarketingProprio) || 0;
  const valorUnitProprio = Number(form.valorMarketingProprio) || 500;
  
  // Qtd total de motos vendidas
  const qtdMotos = isVendedorPlus && (qtdMotosLoja > 0 || qtdMotosProprio > 0)
    ? (qtdMotosLoja + qtdMotosProprio)
    : (Number(form.motosVendidas) || 0);

  // Motos do marketing da loja entram na tabela normal escalonada
  const qtdMotosCalculoFaixa = isVendedorPlus && (qtdMotosLoja > 0 || qtdMotosProprio > 0) ? qtdMotosLoja : qtdMotos;
  let faixaEncontrada = tabelaParaCalculo.find(r => qtdMotosCalculoFaixa >= r.de && qtdMotosCalculoFaixa <= r.ate);
  if (!faixaEncontrada && qtdMotosCalculoFaixa > 0) faixaEncontrada = tabelaParaCalculo[tabelaParaCalculo.length - 1];
  const valorUnitario = faixaEncontrada ? faixaEncontrada.valorPorMoto : 0;
  
  const comissaoMotosLojaPrevia = qtdMotosCalculoFaixa * valorUnitario;
  const comissaoMotosProprioPrevia = isVendedorPlus ? (qtdMotosProprio * valorUnitProprio) : 0;
  const comissaoMotosPrevia = comissaoMotosLojaPrevia + comissaoMotosProprioPrevia;

  // 2. Montagem de motos mecânico (FIXA POR UNIDADE MONTADA)
  const qtdMontagens = Number(form.motosMontadas) || 0;
  const valorUnitMontagem = Number(form.valorPorMontagem) || 0;
  const comissaoMontagemPrevia = qtdMontagens * valorUnitMontagem;

  // 3. Oficina serviços e metas
  const comissaoServicosPrevia = Number(form.comissaoServicos) || 0;
  const comissaoGeralPrevia = Number(form.comissaoGeral) || 0;

  // 4. Comissões Administrativas: Moto Parceiro e Retorno
  const comissaoMotoParceiroPrevia = Number(form.comissaoMotoParceiro) || 0;
  const comissaoRetornoPrevia = Number(form.comissaoRetorno) || 0;

  // 5. Comissões do Leque Customizado
  const totalComissoesCustomPrevia = (form.comissoesDetalhadas || []).reduce((acc, c) => acc + (Number(c.valor) || 0), 0);

  // 6. Comissão de Treinamento de Vendedores
  const comissaoTreinamentoPrevia = Number(form.comissaoTreinamento) || 0;

  const totalTodasComissoes = comissaoMotosPrevia + comissaoMontagemPrevia + comissaoServicosPrevia + comissaoGeralPrevia + comissaoMotoParceiroPrevia + comissaoRetornoPrevia + totalComissoesCustomPrevia + comissaoTreinamentoPrevia;
  
  // Respeita a preferência de DSR do funcionário
  const pagarDSR = funcionario.pagarDSRComissao !== undefined ? (Number(funcionario.pagarDSRComissao) === 1) : (funcionario.variaveisEntrada?.funcionario?.pagarDSRComissao !== undefined ? Number(funcionario.variaveisEntrada.funcionario.pagarDSRComissao) === 1 : false);
  const dsrComissaoPrevia = (pagarDSR && form.diasUteis > 0) ? +((totalTodasComissoes / form.diasUteis) * form.domingosEFeriados).toFixed(2) : 0;

  // Adicionar comissão do leque ao funcionário
  const handleAdicionarComissaoDoCatalogo = (tipoCatalogo) => {
    const nova = {
      id: Date.now().toString(),
      nome: tipoCatalogo.nome,
      tipo: tipoCatalogo.tipo,
      referencia: tipoCatalogo.tipo === 'FIXO_UNIDADE' ? `1 un x R$ ${tipoCatalogo.valorPadrao}` : `${tipoCatalogo.valorPadrao}%`,
      valor: tipoCatalogo.valorPadrao || 0
    };
    setForm({
      ...form,
      comissoesDetalhadas: [...(form.comissoesDetalhadas || []), nova]
    });
  };

  const handleRemoverComissaoCustom = (index) => {
    const novas = (form.comissoesDetalhadas || []).filter((_, idx) => idx !== index);
    setForm({ ...form, comissoesDetalhadas: novas });
  };

  const handleAlterarComissaoCustom = (index, campo, val) => {
    const novas = [...(form.comissoesDetalhadas || [])];
    novas[index] = { ...novas[index], [campo]: campo === 'valor' ? Number(val) : val };
    setForm({ ...form, comissoesDetalhadas: novas });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSalvar({
      funcionarioId: funcionario.id || funcionario.funcionarioId,
      mesReferencia,
      ...form
    });
  };

  const isMecanico = (funcionario.cargo || '').toLowerCase().includes('mecân') || (funcionario.cargo || '').toLowerCase().includes('mecan') || (funcionario.cargo || '').toLowerCase().includes('oficin');
  const isVendedor = (funcionario.cargo || '').toLowerCase().includes('vend') || (funcionario.cargo || '').toLowerCase().includes('comerc') || (funcionario.cargo || '').toLowerCase().includes('consultor');
  const isGerencia = (funcionario.cargo || '').toLowerCase().includes('geren') || (funcionario.cargo || '').toLowerCase().includes('gest') || (funcionario.cargo || '').toLowerCase().includes('diret') || (funcionario.cargo || '').toLowerCase().includes('coord');
  const isAdministrativo = depLower.includes('admin') || depLower.includes('finan') || depLower.includes('cont') || depLower.includes('rh') ||
                           cargoLower.includes('admin') || cargoLower.includes('auxiliar') || cargoLower.includes('assist') || cargoLower.includes('faturamento') || cargoLower.includes('caixa');

  // Inicializa a aba com base no cargo do funcionário
  const defaultTab = isAdministrativo ? 'ADMINISTRATIVO' : (isVendedor ? 'VENDAS' : (isMecanico ? 'MECANICA' : (isGerencia ? 'GERENCIA' : 'TODOS')));
  const [cargoTab, setCargoTab] = useState(defaultTab);

  // Filtragem dos tipos do leque de acordo com a aba selecionada ou cargo
  const catalogoComissoes = empresa?.tiposComissoesLoja || [];
  const catalogoFiltrado = catalogoComissoes.filter(t => {
    if (cargoTab === 'TODOS') return true;
    const catCargo = (t.cargoSugerido || '').toUpperCase();
    if (!catCargo || catCargo === 'TODOS' || catCargo === 'OUTRO') return true;
    if (cargoTab === 'VENDAS' && (catCargo === 'VENDEDOR' || catCargo === 'VENDAS' || catCargo === 'VENDEDOR_PLUS')) return true;
    if (cargoTab === 'MECANICA' && (catCargo === 'MECANICO' || catCargo === 'OFICINA')) return true;
    if (cargoTab === 'GERENCIA' && catCargo === 'GERENTE') return true;
    if (cargoTab === 'ADMINISTRATIVO' && (catCargo === 'ADMIN' || catCargo === 'ADMINISTRATIVO')) return true;
    return false;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col text-slate-800 shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 shrink-0 bg-slate-50/80">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bike className="w-5 h-5 text-indigo-600" /> Lançamentos de Folha: {mesReferencia}
            </h3>
            <p className="text-xs text-indigo-600 font-semibold flex items-center gap-2 mt-0.5">
              <span>{funcionario.funcionarioNome}</span>
              <span className="text-slate-300">•</span>
              <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-bold">{funcionario.cargo}</span>
              {isVendedorPlus && (
                <span className="bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full text-[10px] font-black shadow-xs">
                  ⭐ VENDEDOR +
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            
            {/* MÓDULO EXCLUSIVO: COMISSÕES DA CONCESSIONÁRIA COM SELEÇÃO POR CARGO */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-200 space-y-3">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-2.5">
                <div>
                  <div className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                    <Bike className="w-4 h-4 text-orange-600" /> Comissões & Variáveis por Setor / Cargo
                  </div>
                  <p className="text-[11px] text-amber-900/80">
                    Selecione a visualização do cargo ou visualize tudo para lançar variáveis:
                  </p>
                </div>
                
                {/* Abas de Divisão por Cargo */}
                <div className="flex items-center gap-1 bg-amber-100/80 p-1 rounded-xl border border-amber-300 self-start sm:self-auto flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCargoTab('ADMINISTRATIVO')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                      cargoTab === 'ADMINISTRATIVO'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-amber-900 hover:bg-amber-200/70'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" /> Administrativo
                  </button>

                  <button
                    type="button"
                    onClick={() => setCargoTab('VENDAS')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                      cargoTab === 'VENDAS'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-amber-900 hover:bg-amber-200/70'
                    }`}
                  >
                    <Bike className="w-3.5 h-3.5" /> Vendas {isVendedorPlus ? '(+)' : ''}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCargoTab('MECANICA')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                      cargoTab === 'MECANICA'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-amber-900 hover:bg-amber-200/70'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" /> Mecânica
                  </button>

                  <button
                    type="button"
                    onClick={() => setCargoTab('GERENCIA')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                      cargoTab === 'GERENCIA'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-amber-900 hover:bg-amber-200/70'
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5" /> Gerência
                  </button>

                  <button
                    type="button"
                    onClick={() => setCargoTab('TODOS')}
                    className={`px-2 py-1 text-xs font-bold rounded-lg transition ${
                      cargoTab === 'TODOS'
                        ? 'bg-amber-900 text-white shadow-xs'
                        : 'text-amber-900 hover:bg-amber-200/70'
                    }`}
                  >
                    Ver Todos
                  </button>
                </div>
              </div>

              {/* CARGO: VENDAS (VENDEDOR NORMAL OU VENDEDOR +) */}
              {(cargoTab === 'VENDAS' || cargoTab === 'TODOS') && (
                <div className={`p-3.5 rounded-xl border-2 transition ${isVendedor ? 'bg-amber-100/60 border-amber-400 ring-2 ring-amber-300' : 'bg-white border-amber-200'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Bike className="w-4 h-4 text-amber-600" />
                      {isVendedorPlus ? 'Vendedor + (Divisão: Mkt Loja vs Próprio Marketing)' : 'Vendedor: Vendas de Motos no Mês'}
                    </label>
                    <div className="flex items-center gap-1">
                      {isVendedor && (
                        <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                          Cargo do Colaborador
                        </span>
                      )}
                      {isVendedorPlus && (
                        <span className="text-[10px] bg-amber-400 text-amber-950 font-black px-2 py-0.5 rounded shadow-2xs">
                          ⭐ VENDEDOR +
                        </span>
                      )}
                    </div>
                  </div>

                  {isVendedorPlus ? (
                    <div className="space-y-2 mt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Marketing da Loja */}
                        <div className="bg-white p-2.5 rounded-lg border border-amber-300 shadow-2xs">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            🏢 Motos pelo Marketing da Loja
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={form.motosMarketingLoja}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setForm({ ...form, motosMarketingLoja: val, motosVendidas: val + (Number(form.motosMarketingProprio) || 0) });
                              }}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-black text-amber-900 outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">motos</span>
                          </div>
                          <div className="mt-1.5 text-[10px] text-slate-600 font-medium">
                            {qtdMotosCalculoFaixa > 0 ? `${qtdMotosCalculoFaixa} un x R$ ${valorUnitario} = R$ ${comissaoMotosLojaPrevia.toFixed(2)} (Tabela Plus)` : 'Segue faixa progressiva da loja'}
                          </div>
                        </div>

                        {/* Próprio Marketing */}
                        <div className="bg-emerald-50/50 p-2.5 rounded-lg border-2 border-emerald-400 shadow-2xs">
                          <div className="flex justify-between items-center mb-1">
                            <label className="block text-[11px] font-black text-emerald-950">
                              ⭐ Motos pelo Próprio Marketing
                            </label>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded">
                              R$ 500 / moto
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={form.motosMarketingProprio}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setForm({ ...form, motosMarketingProprio: val, motosVendidas: (Number(form.motosMarketingLoja) || 0) + val });
                              }}
                              className="w-full px-2.5 py-1.5 border-2 border-emerald-400 rounded-lg text-sm font-black text-emerald-950 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="absolute right-2 top-2 text-[10px] text-emerald-700 font-bold">motos</span>
                          </div>
                          <div className="mt-1.5 text-[10px] text-emerald-800 font-bold flex justify-between">
                            <span>{qtdMotosProprio} un x R$ {valorUnitProprio}</span>
                            <span>= R$ {comissaoMotosProprioPrevia.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-amber-100/90 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-950 flex justify-between items-center border border-amber-300">
                        <span>Total Geral de Vendas: {qtdMotos} motos</span>
                        <span className="text-emerald-800 font-black">Comissão Vendedor +: R$ {comissaoMotosPrevia.toFixed(2)}</span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Quantidade de Motos Vendidas</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={form.motosVendidas}
                              onChange={(e) => setForm({ ...form, motosVendidas: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full px-3 py-1.5 border-2 border-amber-300 rounded-lg text-sm font-black text-amber-900 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <span className="absolute right-2.5 top-2 text-[10px] text-slate-400 font-bold">motos</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-center bg-amber-50/70 p-2 rounded-lg border border-amber-200">
                          <div className="text-[11px] font-bold text-slate-700">Faixa Aplicada:</div>
                          <div className="text-xs font-black text-emerald-800">
                            {qtdMotos > 0 ? `${qtdMotos} un x R$ ${valorUnitario} = R$ ${comissaoMotosPrevia.toFixed(2)}` : 'R$ 0,00'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Gastos Diversos com a Loja (Vendas) */}
                  <div className="mt-3 pt-3 border-t border-amber-200/80 bg-white p-3 rounded-xl border border-amber-300 shadow-2xs">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-amber-600" /> Gastos Diversos com a Loja (Folha / Reembolso)
                      </label>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                        Isento Encargos (Art. 457 §2 CLT)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Informe o valor gasto pelo consultor de vendas em prol da loja e descreva onde o dinheiro foi aplicado.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Valor do Gasto (R$)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={form.gastosDiversos}
                            onChange={(e) => setForm({ ...form, gastosDiversos: Number(e.target.value) })}
                            className="w-full pl-8 pr-2.5 py-1.5 border-2 border-amber-300 rounded-lg text-sm font-black text-emerald-900 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Onde foi colocado esse dinheiro? (Descrição / Justificativa)</label>
                        <input
                          type="text"
                          placeholder="Ex: Abastecimento de motos de teste, compra de material para entrega, café para cliente"
                          value={form.gastosDiversosDescricao}
                          onChange={(e) => setForm({ ...form, gastosDiversosDescricao: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                    {Number(form.gastosDiversos) > 0 && (
                      <div className="mt-2 text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex justify-between items-center">
                        <span>🏪 Entrará na folha como crédito indenizatório com a loja:</span>
                        <span className="font-black text-xs">+ R$ {(Number(form.gastosDiversos) || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Comissão por Treinamento de Vendedores */}
                  <div className="mt-3 pt-3 border-t border-amber-200/80 bg-white p-3 rounded-xl border border-amber-300 shadow-2xs">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        🎓 Comissão por Treinamento de Vendedores
                      </label>
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-300">
                        Comissão Extra / Variável
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Para vendedores que recebem comissão adicional por realizar ou participar de treinamentos no mês.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Valor do Treinamento (R$)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={form.comissaoTreinamento}
                            onChange={(e) => setForm({ ...form, comissaoTreinamento: Number(e.target.value) })}
                            className="w-full pl-8 pr-2.5 py-1.5 border-2 border-indigo-300 rounded-lg text-sm font-black text-indigo-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Descrição do Treinamento</label>
                        <input
                          type="text"
                          placeholder="Ex: Treinamento Honda / Yamaha, Curso de Técnica de Vendas, Capacitação Consórcio"
                          value={form.comissaoTreinamentoDescricao}
                          onChange={(e) => setForm({ ...form, comissaoTreinamentoDescricao: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    {Number(form.comissaoTreinamento) > 0 && (
                      <div className="mt-2 text-[10px] text-indigo-800 font-bold bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 flex justify-between items-center">
                        <span>🎓 Comissão de treinamento entra na folha como variável:</span>
                        <span className="font-black text-xs">+ R$ {(Number(form.comissaoTreinamento) || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CARGO: MECÂNICA & OFICINA */}
              {(cargoTab === 'MECANICA' || cargoTab === 'TODOS') && (
                <div className={`p-3.5 rounded-xl border-2 transition ${isMecanico ? 'bg-amber-100/60 border-amber-400 ring-2 ring-amber-300' : 'bg-white border-amber-200'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-amber-600" /> Mecânico: Montagem de Motos na Caixa & Serviços
                    </label>
                    {isMecanico && (
                      <span className="text-[10px] font-black uppercase bg-amber-300 text-amber-950 px-2 py-0.5 rounded">
                        Cargo do Colaborador
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Motos Montadas no Mês (Qtd)</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={form.motosMontadas}
                          onChange={(e) => setForm({ ...form, motosMontadas: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-full px-3 py-1.5 border-2 border-amber-300 rounded-lg text-sm font-black text-amber-950 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="absolute right-2.5 top-2 text-[10px] font-bold text-slate-400">motos montadas</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Valor Fixo por Montagem (R$)</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                        <input
                          type="number"
                          step="1"
                          placeholder="40.00"
                          value={form.valorPorMontagem}
                          onChange={(e) => setForm({ ...form, valorPorMontagem: Number(e.target.value) })}
                          className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-[11px] font-bold text-amber-950 flex justify-between bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-200">
                    <span>Cálculo Montagem: {qtdMontagens} motos x R$ {valorUnitMontagem.toFixed(2)}</span>
                    <span className="text-emerald-800 font-black">+ R$ {comissaoMontagemPrevia.toFixed(2)}</span>
                  </div>

                  {/* Outros Serviços de Oficina */}
                  <div className="mt-3 pt-2.5 border-t border-amber-200/80">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-indigo-600" /> Outros Serviços de Oficina / Revisões (R$)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.comissaoServicos}
                        onChange={(e) => setForm({ ...form, comissaoServicos: Number(e.target.value) })}
                        className="w-full sm:w-1/2 px-2.5 py-1.5 border-2 border-indigo-200 rounded-lg text-sm font-bold text-indigo-900 bg-white outline-none"
                      />
                      <span className="text-[10px] text-slate-500 self-center">Comissão sobre mão de obra e serviços extras</span>
                    </div>
                  </div>
                </div>
              )}

              {/* CARGO / SETOR: ADMINISTRATIVO (AJUDA DE CUSTOS, REEMBOLSOS E GASTOS) */}
              {(cargoTab === 'ADMINISTRATIVO' || cargoTab === 'TODOS') && (
                <div className={`p-3.5 rounded-xl border-2 transition ${isAdministrativo ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-300' : 'bg-white border-indigo-200'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-indigo-600" /> Administrativo: Ajuda de Custos & Reembolso de Gastos
                    </label>
                    <div className="flex items-center gap-1">
                      {isAdministrativo && (
                        <span className="text-[10px] font-black uppercase bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded">
                          Cargo / Setor Administrativo
                        </span>
                      )}
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                        Isento INSS/FGTS (Art. 457 §2 CLT)
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Ajuda de Custo */}
                    <div className="bg-white p-2.5 rounded-lg border border-indigo-200">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-bold text-slate-700">Ajuda de Custo (R$)</label>
                        <span className="text-[9px] text-slate-400">Deslocamento / Alimentação</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={form.ajudaDeCusto}
                          onChange={(e) => setForm({ ...form, ajudaDeCusto: Number(e.target.value) })}
                          className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm font-black text-indigo-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Motivo / Descrição (ex: Auxílio Transporte / Visitas)"
                        value={form.ajudaDeCustoDescricao}
                        onChange={(e) => setForm({ ...form, ajudaDeCustoDescricao: e.target.value })}
                        className="mt-1.5 w-full px-2 py-1 border border-slate-200 rounded text-[11px] outline-none"
                      />
                    </div>

                    {/* Reembolso de Gastos / Despesas */}
                    <div className="bg-white p-2.5 rounded-lg border border-indigo-200">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-bold text-slate-700">Reembolso de Despesas (R$)</label>
                        <span className="text-[9px] text-slate-400">Gastos com nota fiscal</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={form.reembolsoDespesas}
                          onChange={(e) => setForm({ ...form, reembolsoDespesas: Number(e.target.value) })}
                          className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm font-black text-emerald-900 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Motivo / Descrição (ex: Correios, Cartório, Combustível)"
                        value={form.reembolsoDespesasDescricao}
                        onChange={(e) => setForm({ ...form, reembolsoDespesasDescricao: e.target.value })}
                        className="mt-1.5 w-full px-2 py-1 border border-slate-200 rounded text-[11px] outline-none"
                      />
                    </div>
                  </div>

                  {/* Gastos Diversos com a Loja (Administrativo) */}
                  <div className="mt-3 bg-white p-3 rounded-xl border border-indigo-200 shadow-2xs">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-indigo-600" /> Gastos Diversos com a Loja (Folha / Reembolso)
                      </label>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                        Isento Encargos (Art. 457 §2 CLT)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Informe o valor gasto pelo colaborador administrativo com a concessionária e explique onde foi colocado esse dinheiro.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Valor do Gasto (R$)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={form.gastosDiversos}
                            onChange={(e) => setForm({ ...form, gastosDiversos: Number(e.target.value) })}
                            className="w-full pl-8 pr-2.5 py-1.5 border-2 border-indigo-300 rounded-lg text-sm font-black text-emerald-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Onde foi colocado esse dinheiro? (Descrição / Justificativa)</label>
                        <input
                          type="text"
                          placeholder="Ex: Material de escritório, despesas de cartório, manutenção da loja, compras de insumos"
                          value={form.gastosDiversosDescricao}
                          onChange={(e) => setForm({ ...form, gastosDiversosDescricao: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    {Number(form.gastosDiversos) > 0 && (
                      <div className="mt-2 text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex justify-between items-center">
                        <span>🏪 Entrará na folha como crédito indenizatório com a loja:</span>
                        <span className="font-black text-xs">+ R$ {(Number(form.gastosDiversos) || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* NOVOS CAMPOS EXCLUSIVOS: COMISSÃO MOTO PARCEIRO & RETORNO FINANCEIRO */}
                  <div className="mt-3 pt-3 border-t border-indigo-200/80">
                    <div className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-2">
                      <Bike className="w-4 h-4 text-amber-600" /> Comissões Administrativas / F&I: Moto Parceiro & Retorno Financeiro
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Comissão Moto Parceiro */}
                      <div className="bg-white p-2.5 rounded-lg border-2 border-amber-300 shadow-2xs">
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[11px] font-black text-amber-950">
                            🤝 Comissão Moto Parceiro (R$)
                          </label>
                          <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                            Parcerias / Lojas
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="col-span-1">
                            <label className="block text-[9px] text-slate-500 font-bold mb-0.5">Qtd Motos</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={form.motoParceiroQtd}
                              onChange={(e) => setForm({ ...form, motoParceiroQtd: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold text-slate-800 text-center outline-none"
                            />
                          </div>

                          <div className="col-span-2">
                            <label className="block text-[9px] text-slate-500 font-bold mb-0.5">Valor Total da Comissão</label>
                            <div className="relative">
                              <span className="absolute left-2 top-1 text-xs font-bold text-slate-400">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={form.comissaoMotoParceiro}
                                onChange={(e) => setForm({ ...form, comissaoMotoParceiro: Number(e.target.value) })}
                                className="w-full pl-7 pr-2 py-1 border-2 border-amber-300 rounded text-xs font-black text-amber-950 bg-white outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                          </div>
                        </div>

                        <input
                          type="text"
                          placeholder="Loja ou Parceiro (ex: Moto Repasse Centro / Indicação)"
                          value={form.motoParceiroDescricao}
                          onChange={(e) => setForm({ ...form, motoParceiroDescricao: e.target.value })}
                          className="mt-1.5 w-full px-2 py-1 border border-slate-200 rounded text-[11px] outline-none"
                        />
                      </div>

                      {/* Comissão Retorno Financeiro / Bancos */}
                      <div className="bg-white p-2.5 rounded-lg border-2 border-emerald-300 shadow-2xs">
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[11px] font-black text-emerald-950">
                            📈 Comissão Retorno Financeiro (R$)
                          </label>
                          <span className="text-[9px] bg-emerald-100 text-emerald-900 font-bold px-1.5 py-0.5 rounded">
                            Retorno F&I / Bancos
                          </span>
                        </div>
                        
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={form.comissaoRetorno}
                            onChange={(e) => setForm({ ...form, comissaoRetorno: Number(e.target.value) })}
                            className="w-full pl-8 pr-3 py-1.5 border-2 border-emerald-300 rounded-lg text-sm font-black text-emerald-900 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <input
                          type="text"
                          placeholder="Banco / Operação (ex: Retorno BV Financeira / Santander)"
                          value={form.retornoDescricao}
                          onChange={(e) => setForm({ ...form, retornoDescricao: e.target.value })}
                          className="mt-1.5 w-full px-2 py-1 border border-slate-200 rounded text-[11px] outline-none"
                        />
                      </div>
                    </div>

                    {/* Venda de Motos no Administrativo / Venda Direta */}
                    <div className="mt-3 bg-white p-2.5 rounded-lg border-2 border-amber-300 shadow-2xs">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-black text-amber-950 flex items-center gap-1.5">
                          <Bike className="w-3.5 h-3.5 text-amber-600" /> Vendas de Motos no Mês (Comissão por Moto Vendida)
                        </label>
                        <span className="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                          Tabela da Loja
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                        <div>
                          <label className="block text-[9px] text-slate-500 font-bold mb-0.5">Quantidade de Motos Vendidas</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={form.motosVendidas}
                              onChange={(e) => setForm({ ...form, motosVendidas: Math.max(0, parseInt(e.target.value) || 0) })}
                              className="w-full px-2.5 py-1.5 border-2 border-amber-300 rounded-lg text-sm font-black text-amber-950 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">motos</span>
                          </div>
                        </div>
                        <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs">
                          <div className="text-[10px] font-bold text-slate-600 flex justify-between">
                            <span>Comissão Calculada:</span>
                            <span className="text-[10px] text-amber-900 font-extrabold">
                              {qtdMotos <= 60 ? 'Faixa até 60 motos (R$ 150/un)' : 'Faixa a partir de 61 motos (R$ 200/un)'}
                            </span>
                          </div>
                          <div className="font-black text-emerald-800 text-sm mt-0.5">
                            {qtdMotos > 0 ? `${qtdMotos} un x R$ ${valorUnitario} = R$ ${comissaoMotosPrevia.toFixed(2)}` : 'R$ 0,00'}
                          </div>
                          <div className="text-[9px] text-slate-500 mt-1">
                            ℹ️ 57 motos = R$ 150 unitário | A partir de 61 motos = R$ 200 unitário
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CARGO: GERÊNCIA & METAS */}
              {(cargoTab === 'GERENCIA' || cargoTab === 'TODOS') && (
                <div className={`p-3.5 rounded-xl border-2 transition ${isGerencia ? 'bg-amber-100/60 border-amber-400 ring-2 ring-amber-300' : 'bg-white border-amber-200'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-emerald-600" /> Gerência: Comissão por Moto da Loja & Bônus de Meta
                    </label>
                    {isGerencia && (
                      <span className="text-[10px] font-black uppercase bg-amber-300 text-amber-950 px-2 py-0.5 rounded">
                        Cargo do Colaborador
                      </span>
                    )}
                  </div>

                  {/* COMISSÃO DO GERENTE: Valor fixo por moto vendida pela LOJA toda */}
                  <div className="bg-amber-50/80 p-3 rounded-xl border-2 border-amber-300 shadow-2xs mb-3">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                        <Bike className="w-4 h-4 text-amber-600" /> Comissão Gerente: Motos Vendidas pela Loja no Mês
                      </label>
                      <span className="text-[9px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">
                        Valor fixo por moto (todas as vendas da loja)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Total de Motos Vendidas pela Loja</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={form.motosLojaGerente}
                            onChange={(e) => {
                              const motos = Math.max(0, parseInt(e.target.value) || 0);
                              const valorUnit = Number(form.valorComissaoGerentePorMoto) || 0;
                              setForm({
                                ...form,
                                motosLojaGerente: motos,
                                comissaoGeral: +(motos * valorUnit).toFixed(2)
                              });
                            }}
                            className="w-full px-2.5 py-1.5 border-2 border-amber-300 rounded-lg text-sm font-black text-amber-950 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">motos</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Valor Fixo por Moto (R$)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="30.00"
                            value={form.valorComissaoGerentePorMoto}
                            onChange={(e) => {
                              const valorUnit = Number(e.target.value) || 0;
                              const motos = Number(form.motosLojaGerente) || 0;
                              setForm({
                                ...form,
                                valorComissaoGerentePorMoto: valorUnit,
                                comissaoGeral: +(motos * valorUnit).toFixed(2)
                              });
                            }}
                            className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col justify-center bg-white p-2.5 rounded-lg border border-amber-200">
                        <div className="text-[10px] font-bold text-slate-600">Comissão Calculada:</div>
                        <div className="text-sm font-black text-emerald-800">
                          {Number(form.motosLojaGerente) > 0
                            ? `${form.motosLojaGerente} × R$ ${Number(form.valorComissaoGerentePorMoto).toFixed(2)} = R$ ${(Number(form.motosLojaGerente) * Number(form.valorComissaoGerentePorMoto)).toFixed(2)}`
                            : 'R$ 0,00'}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">Lançado em "Comissão Geral"</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] text-amber-900 bg-amber-100 px-2.5 py-1.5 rounded border border-amber-300">
                      ℹ️ O gerente recebe um valor fixo por CADA moto vendida por todos os vendedores da loja, independente de quem vendeu.
                    </div>
                  </div>

                  {/* BÔNUS DE META: Adicional por atingir ou superar meta */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">🏆 Bônus Adicional / Meta Extra (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.outrosProventos}
                        onChange={(e) => setForm({ ...form, outrosProventos: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 border-2 border-emerald-200 rounded-lg text-sm font-bold text-emerald-900 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Descrição do Bônus</label>
                      <input
                        type="text"
                        placeholder="Ex: Bônus Meta Geral da Loja Batida"
                        value={form.outrosProventosDescricao}
                        onChange={(e) => setForm({ ...form, outrosProventosDescricao: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SEÇÃO 3: LEQUE DE COMISSÕES PERSONALIZADAS CADASTRADAS */}
              <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" /> Leque de Comissões Extras da Loja
                  </div>
                  
                  {/* Menu de atalhos rápidos filtrados pela aba de cargo */}
                  {catalogoFiltrado.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {catalogoFiltrado.map(tipo => (
                        <button
                          key={tipo.id}
                          type="button"
                          onClick={() => handleAdicionarComissaoDoCatalogo(tipo)}
                          className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-lg border border-indigo-200 flex items-center gap-1 transition"
                        >
                          <Plus className="w-3 h-3" /> {tipo.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {(!form.comissoesDetalhadas || form.comissoesDetalhadas.length === 0) ? (
                  <p className="text-[11px] text-slate-400 italic">
                    Nenhuma comissão extra adicionada para este colaborador. Clique nos botões acima para puxar do catálogo configurado na concessionária (ex: Consórcio, Financiamento, Acessórios).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.comissoesDetalhadas.map((comissao, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <input
                          type="text"
                          value={comissao.nome}
                          onChange={(e) => handleAlterarComissaoCustom(idx, 'nome', e.target.value)}
                          placeholder="Nome da Comissão"
                          className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs font-semibold bg-white"
                        />
                        <input
                          type="text"
                          value={comissao.referencia || ''}
                          onChange={(e) => handleAlterarComissaoCustom(idx, 'referencia', e.target.value)}
                          placeholder="Ref (ex: 2 un)"
                          className="w-24 px-2 py-1 border border-slate-300 rounded text-xs bg-white text-center"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-slate-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={comissao.valor}
                            onChange={(e) => handleAlterarComissaoCustom(idx, 'valor', e.target.value)}
                            className="w-24 px-2 py-1 border border-slate-300 rounded text-xs font-bold text-emerald-800 bg-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoverComissaoCustom(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                          title="Remover"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumo da Comissão e DSR */}
              <div className="bg-white/95 p-3 rounded-xl border-2 border-amber-300 flex justify-between items-center text-xs">
                <div className="font-bold text-slate-700">
                  Total de Comissões Somadas: <span className="text-emerald-700 font-black text-sm">{totalTodasComissoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div className="text-[11px] text-slate-600">
                  DSR (Lei 605/49): <span className="font-bold text-indigo-700">{pagarDSR ? dsrComissaoPrevia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Isento (Desativado no Cadastro)'}</span>
                </div>
              </div>
            </div>

          {/* Horas Extras & Noturno */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" /> Horas Extras e Trabalho Noturno
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">H.E. 50% (Horas)</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.horas50}
                  onChange={(e) => setForm({ ...form, horas50: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">H.E. 100% (Dom/Fer)</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.horas100}
                  onChange={(e) => setForm({ ...form, horas100: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Noturno (Horas)</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.horasNoturnas}
                  onChange={(e) => setForm({ ...form, horasNoturnas: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Dias Úteis do Mês</label>
                <input
                  type="number"
                  value={form.diasUteis}
                  onChange={(e) => setForm({ ...form, diasUteis: Number(e.target.value) })}
                  className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Domingos e Feriados (DSR)</label>
                <input
                  type="number"
                  value={form.domingosEFeriados}
                  onChange={(e) => setForm({ ...form, domingosEFeriados: Number(e.target.value) })}
                  className="w-full px-2.5 py-1 border border-slate-300 rounded text-xs"
                />
              </div>
            </div>
          </div>

          {/* Faltas e Penalidades */}
          <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 space-y-3">
            <div className="text-xs font-bold text-rose-800 uppercase tracking-wide flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600" /> Faltas e Atrasos Injustificados
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Faltas Integrais (Dias)</label>
                <input
                  type="number"
                  value={form.faltasDias}
                  onChange={(e) => setForm({ ...form, faltasDias: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Atrasos (Minutos)</label>
                <input
                  type="number"
                  value={form.atrasosMinutos}
                  onChange={(e) => setForm({ ...form, atrasosMinutos: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          </div>

          {/* OUTROS GASTOS, ADIANTAMENTOS E GRATIFICAÇÕES DA FOLHA */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-slate-600" /> Outros Gastos, Adiantamentos & Lançamentos em Folha
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Outro Ganho / Provento (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.outrosProventos}
                  onChange={(e) => setForm({ ...form, outrosProventos: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-emerald-800"
                />
                <input
                  type="text"
                  placeholder="Descrição (ex: Prêmio Produtividade)"
                  value={form.outrosProventosDescricao}
                  onChange={(e) => setForm({ ...form, outrosProventosDescricao: e.target.value })}
                  className="mt-1 w-full px-2 py-0.5 border border-slate-200 rounded text-[10px] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Outro Gasto / Desconto (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.outrosDescontos}
                  onChange={(e) => setForm({ ...form, outrosDescontos: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-rose-500 font-bold text-rose-800"
                />
                <input
                  type="text"
                  placeholder="Descrição (ex: Adiantamento Salarial / Vale)"
                  value={form.outrosDescontosDescricao}
                  onChange={(e) => setForm({ ...form, outrosDescontosDescricao: e.target.value })}
                  className="mt-1 w-full px-2 py-0.5 border border-slate-200 rounded text-[10px] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pensão Judicial (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.pensaoAlimenticia}
                  onChange={(e) => setForm({ ...form, pensaoAlimenticia: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
          </div>


          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/80 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition"
            >
              <Save className="w-4 h-4" /> Recalcular e Salvar Folha
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
