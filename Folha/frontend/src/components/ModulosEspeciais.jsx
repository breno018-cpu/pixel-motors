import React, { useState } from 'react';
import { Palmtree, Gift, UserMinus, Calculator, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function ModulosEspeciais() {
  const [moduloAtivo, setModuloAtivo] = useState('FERIAS'); // 'FERIAS', 'DECIMO_TERCEIRO', 'RESCISAO'

  // Estados Férias
  const [feriasSalario, setFeriasSalario] = useState(4500);
  const [feriasDias, setFeriasDias] = useState(30);
  const [feriasVende10, setFeriasVende10] = useState(false);
  const [feriasAdiantar13, setFeriasAdiantar13] = useState(false);
  const [feriasDependentes, setFeriasDependentes] = useState(1);
  const [resultadoFerias, setResultadoFerias] = useState(null);

  // Estados 13º Salário
  const [decimoSalario, setDecimoSalario] = useState(4500);
  const [decimoMeses, setDecimoMeses] = useState(12);
  const [decimoParcela, setDecimoParcela] = useState('PRIMEIRA'); // 'PRIMEIRA' ou 'SEGUNDA'
  const [decimoDependentes, setDecimoDependentes] = useState(1);
  const [resultadoDecimo, setResultadoDecimo] = useState(null);

  // Estados Rescisão
  const [rescisaoSalario, setRescisaoSalario] = useState(4500);
  const [rescisaoAdmissao, setRescisaoAdmissao] = useState('2023-01-10');
  const [rescisaoDemissao, setRescisaoDemissao] = useState('2026-10-02');
  const [rescisaoMotivo, setRescisaoMotivo] = useState('SEM_JUSTA_CAUSA');
  const [rescisaoAvisoIndenizado, setRescisaoAvisoIndenizado] = useState(true);
  const [rescisaoSaldoDias, setRescisaoSaldoDias] = useState(15);
  const [rescisaoFeriasVencidas, setRescisaoFeriasVencidas] = useState(false);
  const [rescisaoSaldoFGTS, setRescisaoSaldoFGTS] = useState(12500);
  const [resultadoRescisao, setResultadoRescisao] = useState(null);

  const formatarMoeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Disparar cálculos na API
  const calcularFeriasAPI = async () => {
    try {
      const res = await fetch('/api/operacoes/ferias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salarioBase: feriasSalario,
          diasGozo: feriasDias,
          vendeu10Dias: feriasVende10,
          adiantarDecimoTerceiro: feriasAdiantar13,
          dependentes: feriasDependentes
        })
      });
      const data = await res.json();
      setResultadoFerias(data);
    } catch (err) {
      console.error(err);
    }
  };

  const calcularDecimoAPI = async () => {
    try {
      const res = await fetch('/api/operacoes/decimo-terceiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salarioBase: decimoSalario,
          mesesTrabalhados: decimoMeses,
          parcela: decimoParcela,
          dependentes: decimoDependentes
        })
      });
      const data = await res.json();
      setResultadoDecimo(data);
    } catch (err) {
      console.error(err);
    }
  };

  const calcularRescisaoAPI = async () => {
    try {
      const res = await fetch('/api/operacoes/rescisao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salarioBase: rescisaoSalario,
          dataAdmissao: rescisaoAdmissao,
          dataDemissao: rescisaoDemissao,
          motivo: rescisaoMotivo,
          avisoPrevioIndenizado: rescisaoAvisoIndenizado,
          saldoSalarioDias: rescisaoSaldoDias,
          feriasVencidas: rescisaoFeriasVencidas,
          saldoFGTSAtual: rescisaoSaldoFGTS
        })
      });
      const data = await res.json();
      setResultadoRescisao(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Abas Superiores com rolagem responsiva */}
      <div className="flex border-b border-slate-200 gap-2 sm:gap-4 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setModuloAtivo('FERIAS')}
          className={`flex items-center gap-2 pb-3 font-semibold text-xs sm:text-sm transition border-b-2 whitespace-nowrap shrink-0 ${
            moduloAtivo === 'FERIAS'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Palmtree className="w-4 h-4 shrink-0" /> Férias CLT (com 1/3)
        </button>
        <button
          onClick={() => setModuloAtivo('DECIMO_TERCEIRO')}
          className={`flex items-center gap-2 pb-3 font-semibold text-xs sm:text-sm transition border-b-2 whitespace-nowrap shrink-0 ${
            moduloAtivo === 'DECIMO_TERCEIRO'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Gift className="w-4 h-4 shrink-0" /> 13º Salário (1ª e 2ª Parcelas)
        </button>
        <button
          onClick={() => setModuloAtivo('RESCISAO')}
          className={`flex items-center gap-2 pb-3 font-semibold text-xs sm:text-sm transition border-b-2 whitespace-nowrap shrink-0 ${
            moduloAtivo === 'RESCISAO'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserMinus className="w-4 h-4 shrink-0" /> Rescisão Trabalhista
        </button>
      </div>

      {/* 1. MÓDULO DE FÉRIAS */}
      {moduloAtivo === 'FERIAS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Palmtree className="text-indigo-600 w-5 h-5" /> Parâmetros de Férias
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Salário Base (R$)</label>
              <input
                type="number"
                value={feriasSalario}
                onChange={(e) => setFeriasSalario(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Dias de Gozo</label>
                <select
                  value={feriasDias}
                  onChange={(e) => setFeriasDias(Number(e.target.value))}
                  disabled={feriasVende10}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100"
                >
                  <option value={30}>30 dias integrais</option>
                  <option value={20}>20 dias</option>
                  <option value={15}>15 dias</option>
                  <option value={10}>10 dias</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Dependentes IRRF</label>
                <input
                  type="number"
                  value={feriasDependentes}
                  onChange={(e) => setFeriasDependentes(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feriasVende10}
                  onChange={(e) => setFeriasVende10(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Abono Pecuniário (Vender 10 dias de férias)</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feriasAdiantar13}
                  onChange={(e) => setFeriasAdiantar13(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>Adiantar 1ª Parcela do 13º Salário (50%)</span>
              </label>
            </div>

            <button
              onClick={calcularFeriasAPI}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow"
            >
              <Calculator className="w-5 h-5" /> Calcular Férias CLT
            </button>
          </div>

          {/* Resultado Férias */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                <h4 className="font-bold text-lg text-slate-100">Recibo Estimado de Férias</h4>
                <span className="text-xs bg-indigo-900/60 text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-700">
                  CLT Art. 129 a 145
                </span>
              </div>

              {resultadoFerias ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between text-slate-300">
                    <span>Remuneração dos Dias de Gozo ({resultadoFerias.diasGozo} dias):</span>
                    <span className="font-semibold text-white">{formatarMoeda(resultadoFerias.valorGozo)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>1/3 Constitucional sobre Gozo:</span>
                    <span className="font-semibold text-white">{formatarMoeda(resultadoFerias.tercoConstitucional)}</span>
                  </div>

                  {resultadoFerias.vendeu10Dias && (
                    <>
                      <div className="flex justify-between text-amber-300">
                        <span>Abono Pecuniário (10 dias isento INSS):</span>
                        <span className="font-semibold">{formatarMoeda(resultadoFerias.abonoPecuniario)}</span>
                      </div>
                      <div className="flex justify-between text-amber-300">
                        <span>1/3 sobre Abono Pecuniário:</span>
                        <span className="font-semibold">{formatarMoeda(resultadoFerias.tercoAbono)}</span>
                      </div>
                    </>
                  )}

                  {resultadoFerias.adiantamento13 > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Adiantamento 50% do 13º Salário:</span>
                      <span className="font-semibold">{formatarMoeda(resultadoFerias.adiantamento13)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-slate-200">
                    <span>Total Proventos Brutos:</span>
                    <span>{formatarMoeda(resultadoFerias.totalBruto)}</span>
                  </div>

                  <div className="flex justify-between text-rose-400">
                    <span>Desconto INSS Progressivo:</span>
                    <span>- {formatarMoeda(resultadoFerias.inss?.valor)}</span>
                  </div>
                  <div className="flex justify-between text-rose-400">
                    <span>Desconto IRRF Retido:</span>
                    <span>- {formatarMoeda(resultadoFerias.irrf?.valor)}</span>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-sm">
                  Preencha os parâmetros e clique em "Calcular Férias CLT" para ver o demonstrativo.
                </div>
              )}
            </div>

            {resultadoFerias && (
              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center bg-slate-800/80 p-4 rounded-xl">
                <div>
                  <span className="text-xs text-slate-400 block">VALOR LÍQUIDO A RECEBER</span>
                  <span className="text-2xl font-black text-emerald-400">{formatarMoeda(resultadoFerias.liquidoFerias)}</span>
                </div>
                <div className="text-right text-xs text-slate-400">
                  Prazo de Pagamento: <br/><strong className="text-slate-200">Até 2 dias antes do início</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. MÓDULO 13º SALÁRIO */}
      {moduloAtivo === 'DECIMO_TERCEIRO' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Gift className="text-indigo-600 w-5 h-5" /> Cálculo de Gratificação Natalina (13º)
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Salário Base (R$)</label>
              <input
                type="number"
                value={decimoSalario}
                onChange={(e) => setDecimoSalario(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Meses Trabalhados no Ano</label>
                <select
                  value={decimoMeses}
                  onChange={(e) => setDecimoMeses(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1} / 12 avos</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Parcela</label>
                <select
                  value={decimoParcela}
                  onChange={(e) => setDecimoParcela(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-semibold text-indigo-700"
                >
                  <option value="PRIMEIRA">1ª Parcela (Adiantamento 50%)</option>
                  <option value="SEGUNDA">2ª Parcela (Quitação com Impostos)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Dependentes IRRF</label>
              <input
                type="number"
                value={decimoDependentes}
                onChange={(e) => setDecimoDependentes(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <button
              onClick={calcularDecimoAPI}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow"
            >
              <Calculator className="w-5 h-5" /> Calcular 13º Salário
            </button>
          </div>

          {/* Resultado 13º */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                <h4 className="font-bold text-lg text-slate-100">Resultado 13º Salário</h4>
                <span className="text-xs bg-indigo-900/60 text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-700">
                  Lei 4.090/1962
                </span>
              </div>

              {resultadoDecimo ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between text-slate-300">
                    <span>Fração de Direito:</span>
                    <span className="font-semibold text-white">{resultadoDecimo.mesesTrabalhados} / 12 avos</span>
                  </div>

                  {decimoParcela === 'PRIMEIRA' ? (
                    <>
                      <div className="flex justify-between text-emerald-300">
                        <span>Valor Bruto da 1ª Parcela (50%):</span>
                        <span className="font-semibold">{formatarMoeda(resultadoDecimo.valorBruto)}</span>
                      </div>
                      <div className="text-xs text-slate-400 bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                        ℹ️ A 1ª parcela é isenta de descontos de INSS e IRRF na CLT. Deve ser paga até <strong>30 de Novembro</strong>.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-300">
                        <span>Valor Integral Proporcional:</span>
                        <span className="font-semibold text-white">{formatarMoeda(resultadoDecimo.valorIntegral)}</span>
                      </div>
                      <div className="flex justify-between text-amber-300">
                        <span>(-) Adiantamento da 1ª Parcela já paga:</span>
                        <span className="font-semibold">- {formatarMoeda(resultadoDecimo.adiantamentoJaPago)}</span>
                      </div>
                      <div className="flex justify-between text-rose-400">
                        <span>(-) INSS Retido (sobre o total integral):</span>
                        <span className="font-semibold">- {formatarMoeda(resultadoDecimo.inss?.valor)}</span>
                      </div>
                      <div className="flex justify-between text-rose-400">
                        <span>(-) IRRF Retido exclusivo na fonte:</span>
                        <span className="font-semibold">- {formatarMoeda(resultadoDecimo.irrf?.valor)}</span>
                      </div>
                      <div className="text-xs text-slate-400 bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                        ℹ️ A 2ª parcela deve ser quitada impreterivelmente até o dia <strong>20 de Dezembro</strong>.
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-sm">
                  Selecione a parcela desejada e clique em "Calcular 13º Salário".
                </div>
              )}
            </div>

            {resultadoDecimo && (
              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center bg-slate-800/80 p-4 rounded-xl">
                <div>
                  <span className="text-xs text-slate-400 block">LÍQUIDO DA PARCELA</span>
                  <span className="text-2xl font-black text-emerald-400">{formatarMoeda(resultadoDecimo.valorLiquido)}</span>
                </div>
                <div className="text-right text-xs text-slate-400">
                  FGTS (8% a cargo da empresa): <br/><strong className="text-slate-200">{formatarMoeda((resultadoDecimo.valorBruto || resultadoDecimo.valorIntegral) * 0.08)}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MÓDULO RESCISÃO CONTRATUAL */}
      {moduloAtivo === 'RESCISAO' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <UserMinus className="text-indigo-600 w-5 h-5" /> Parâmetros Rescisórios (TRCT)
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Data Admissão</label>
                <input
                  type="date"
                  value={rescisaoAdmissao}
                  onChange={(e) => setRescisaoAdmissao(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Data Demissão</label>
                <input
                  type="date"
                  value={rescisaoDemissao}
                  onChange={(e) => setRescisaoDemissao(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Salário Base (R$)</label>
                <input
                  type="number"
                  value={rescisaoSalario}
                  onChange={(e) => setRescisaoSalario(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Saldo Saldo FGTS Atual (R$)</label>
                <input
                  type="number"
                  value={rescisaoSaldoFGTS}
                  onChange={(e) => setRescisaoSaldoFGTS(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Motivo do Desligamento</label>
              <select
                value={rescisaoMotivo}
                onChange={(e) => setRescisaoMotivo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="SEM_JUSTA_CAUSA">Dispensa Sem Justa Causa (Empregador)</option>
                <option value="PEDIDO_DEMISSAO">Pedido de Demissão (Empregado)</option>
                <option value="ACORDO_MUTUO">Demissão por Acordo Mútuo (Art. 484-A CLT)</option>
                <option value="COM_JUSTA_CAUSA">Dispensa Com Justa Causa (Falta Grave)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Saldo de Salário (Dias)</label>
                <input
                  type="number"
                  value={rescisaoSaldoDias}
                  onChange={(e) => setRescisaoSaldoDias(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={rescisaoFeriasVencidas}
                    onChange={(e) => setRescisaoFeriasVencidas(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Possui Férias Vencidas</span>
                </label>
              </div>
            </div>

            {rescisaoMotivo === 'SEM_JUSTA_CAUSA' && (
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rescisaoAvisoIndenizado}
                  onChange={(e) => setRescisaoAvisoIndenizado(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Aviso Prévio Indenizado (Lei 12.506 Proporcional)</span>
              </label>
            )}

            <button
              onClick={calcularRescisaoAPI}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow"
            >
              <Calculator className="w-5 h-5" /> Calcular Rescisão TRCT
            </button>
          </div>

          {/* Resultado Rescisão */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-700">
                <h4 className="font-bold text-lg text-slate-100">Demonstrativo Rescisório</h4>
                <span className="text-xs bg-indigo-900/60 text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-700">
                  TRCT Homologação
                </span>
              </div>

              {resultadoRescisao ? (
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Tempo de Empresa / Aviso Prévio:</span>
                    <span className="font-semibold text-white">{resultadoRescisao.anosTrabalhados} anos ({resultadoRescisao.diasAvisoPrevio} dias de aviso)</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Saldo de Salário ({rescisaoSaldoDias} dias):</span>
                    <span className="font-semibold text-white">{formatarMoeda(resultadoRescisao.saldoSalario)}</span>
                  </div>
                  {resultadoRescisao.valorAvisoPrevio > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span>Aviso Prévio Indenizado Proporcional:</span>
                      <span className="font-semibold text-emerald-400">{formatarMoeda(resultadoRescisao.valorAvisoPrevio)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-300">
                    <span>13º Salário Proporcional:</span>
                    <span className="font-semibold text-white">{formatarMoeda(resultadoRescisao.decimoTerceiroProp)}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Férias Proporcionais + 1/3:</span>
                    <span className="font-semibold text-white">{formatarMoeda(resultadoRescisao.feriasProporcionais + resultadoRescisao.tercoFerias)}</span>
                  </div>
                  {resultadoRescisao.feriasVencidasValor > 0 && (
                    <div className="flex justify-between text-amber-300">
                      <span>Férias Vencidas Integrais:</span>
                      <span className="font-semibold">{formatarMoeda(resultadoRescisao.feriasVencidasValor)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-slate-300">
                    <span>Total Verbas Rescisórias Brutas:</span>
                    <span>{formatarMoeda(resultadoRescisao.totalBruto)}</span>
                  </div>

                  <div className="flex justify-between text-rose-400">
                    <span>(-) Total Descontos Legais (INSS):</span>
                    <span>- {formatarMoeda(resultadoRescisao.totalINSS)}</span>
                  </div>

                  {resultadoRescisao.multaFGTS > 0 && (
                    <div className="mt-2 p-2 bg-emerald-950/60 border border-emerald-800 rounded flex justify-between items-center text-emerald-300">
                      <span>Multa Rescisória FGTS (Depositada em conta vinculada):</span>
                      <span className="font-bold text-sm">{formatarMoeda(resultadoRescisao.multaFGTS)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-sm">
                  Configure o contrato e clique em "Calcular Rescisão TRCT".
                </div>
              )}
            </div>

            {resultadoRescisao && (
              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center bg-slate-800/80 p-4 rounded-xl">
                <div>
                  <span className="text-xs text-slate-400 block">LÍQUIDO A PAGAR AO EMPREGADO</span>
                  <span className="text-2xl font-black text-emerald-400">{formatarMoeda(resultadoRescisao.liquidoRescisao)}</span>
                </div>
                <div className="text-right text-xs text-slate-400">
                  Prazo de Quitação: <br/><strong className="text-slate-200">Até 10 dias corridos</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
