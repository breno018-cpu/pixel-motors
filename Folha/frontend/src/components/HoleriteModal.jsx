import React from 'react';
import { Printer, Download, X, Bike, ShieldCheck, CheckCircle2, Image } from 'lucide-react';

export default function HoleriteModal({ dados, onClose }) {
  if (!dados) return null;
  const { empresa, funcionario, folha } = dados;

  const formatarMoeda = (val) => {
    return (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handlePrint = () => {
    window.print();
  };

  const nomeConcessionaria = empresa?.razaoSocial || 'MOTO CONCESSIONÁRIA';
  const textoMarcaDagua = empresa?.textoMarcaDagua || nomeConcessionaria;
  const opacidadeMarcaDagua = empresa?.opacidadeMarcaDagua !== undefined ? empresa.opacidadeMarcaDagua : 0.05;
  const exibirMarcaDagua = empresa?.exibirMarcaDagua !== undefined ? Boolean(empresa.exibirMarcaDagua) : true;
  const logoUrl = empresa?.logoUrl || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 overflow-hidden">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col text-slate-800 border border-slate-200 overflow-hidden">
        
        {/* Barra superior de ações (Não sai na impressão) */}
        <div className="flex flex-wrap justify-between items-center px-6 py-4 border-b border-slate-200 gap-3 no-print bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Recibo de Pagamento de Salário (Holerite Oficial)
              </h3>
              <p className="text-xs text-slate-500">
                Competência: <strong className="text-indigo-600 font-bold">{folha?.mesReferencia}</strong> • Concessionária de Motos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-orange-100 transition"
            >
              <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTAINER DO RECIBO / CONTRACHEQUE COM SCROLL INTERNO E MARCA D'ÁGUA CONFIGURÁVEL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="relative border-2 border-slate-800 p-5 rounded-xl font-mono text-[11px] leading-relaxed bg-white overflow-hidden shadow-inner print-area">
            
            {/* MARCA D'ÁGUA EM BACKGROUND CONFIGURÁVEL */}
            {exibirMarcaDagua && (
              <div
                className="watermark-container absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
                style={{ opacity: opacidadeMarcaDagua }}
              >
                <div className="transform -rotate-25 flex flex-col items-center justify-center text-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="max-w-[420px] max-h-[420px] object-contain mb-4 grayscale" />
                  ) : (
                    <Bike className="w-96 h-96 text-slate-900 stroke-[1.2]" />
                  )}
                  <span className="text-5xl font-black tracking-widest uppercase text-slate-900 mt-2">
                    {textoMarcaDagua}
                  </span>
                  <span className="text-2xl font-bold tracking-widest uppercase text-slate-800">
                    COMPROVANTE OFICIAL DE PAGAMENTO
                  </span>
                </div>
              </div>
            )}

            {/* CONTEÚDO PRINCIPAL DO HOLERITE (Z-INDEX SUPERIOR À MARCA D'ÁGUA) */}
            <div className="relative z-10">
              {/* Cabeçalho Empregador com Suporte à Logo da Empresa */}
              <div className="border-b-2 border-slate-800 pb-3 flex justify-between items-start gap-4">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo Concessionária" className="w-16 h-16 object-contain rounded-lg border border-slate-200 p-1 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                      <Bike className="w-7 h-7" />
                    </div>
                  )}
                  <div className="space-y-0.5">
                    <div className="text-sm font-black uppercase text-slate-900 tracking-wide flex items-center gap-2">
                      <span>{nomeConcessionaria}</span>
                    </div>
                    <div className="text-slate-600 text-[11px]">
                      <strong>CNPJ:</strong> {empresa?.cnpj || 'NÃO INFORMADO'}
                    </div>
                    <div className="text-slate-600 text-[10px]">
                      {empresa?.endereco ? `${empresa.endereco} - ` : ''}
                      {empresa?.cidade ? `${empresa.cidade}/${empresa.uf}` : 'Concessionária Autorizada de Motocicletas'}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`text-xs font-black px-3 py-1 rounded tracking-wider uppercase ${
                    (funcionario?.tipoContrato === 'TERCEIRIZADO' || folha?.tipoContrato === 'TERCEIRIZADO')
                      ? 'bg-purple-900 text-white'
                      : 'bg-slate-900 text-white'
                  }`}>
                    {(funcionario?.tipoContrato === 'TERCEIRIZADO' || folha?.tipoContrato === 'TERCEIRIZADO')
                      ? 'DEMONSTRATIVO DE PAGAMENTO A TERCEIRO / PRESTADOR'
                      : 'RECIBO DE PAGAMENTO DE SALÁRIO'}
                  </div>
                  <div className="mt-1 text-slate-700 font-bold text-[11px]">
                    MÊS/ANO: <span className="bg-slate-100 px-1.5 py-0.5 border border-slate-300 rounded font-black">{folha?.mesReferencia}</span>
                  </div>
                </div>
              </div>

              {/* Dados do Colaborador / Prestador Terceirizado */}
              <div className="grid grid-cols-4 gap-2 py-2.5 border-b-2 border-slate-800 bg-slate-50/90 px-2.5 rounded mt-2 text-[11px]">
                <div>
                  <span className="font-bold block text-slate-500 text-[9px] uppercase">Código:</span>
                  <span className="font-black text-slate-900">#{funcionario?.id || folha?.funcionarioId}</span>
                </div>
                <div className="col-span-2">
                  <span className="font-bold block text-slate-500 text-[9px] uppercase">
                    {(funcionario?.tipoContrato === 'TERCEIRIZADO' || folha?.tipoContrato === 'TERCEIRIZADO')
                      ? 'Nome do Prestador / Terceiro:'
                      : 'Nome do Colaborador:'}
                  </span>
                  <span className="font-black text-slate-900 text-xs">{funcionario?.nome || folha?.funcionarioNome}</span>
                </div>
                <div>
                  <span className="font-bold block text-slate-500 text-[9px] uppercase">CPF / Doc:</span>
                  <span className="font-semibold text-slate-900">{funcionario?.cpf || folha?.cpf}</span>
                </div>
                <div>
                  <span className="font-bold block text-slate-500 text-[9px] uppercase">Função / Serviço:</span>
                  <span className="font-bold text-slate-900">{funcionario?.cargo || folha?.cargo}</span>
                </div>
                <div className="col-span-2">
                  <span className="font-bold block text-slate-500 text-[9px] uppercase">Departamento / Setor:</span>
                  <span className="font-bold text-indigo-900">{funcionario?.departamento || folha?.departamento}</span>
                </div>
                <div>
                  <span className="font-bold block text-slate-500 text-[9px] uppercase">
                    {(funcionario?.tipoContrato === 'TERCEIRIZADO' || folha?.tipoContrato === 'TERCEIRIZADO') ? 'Regime:' : 'Dep. IRRF:'}
                  </span>
                  <span className="font-bold text-slate-900">
                    {(funcionario?.tipoContrato === 'TERCEIRIZADO' || folha?.tipoContrato === 'TERCEIRIZADO') ? 'TERCEIRIZADO' : (funcionario?.dependentes || 0)}
                  </span>
                </div>
              </div>

              {/* Tabela de Rubricas (Proventos e Descontos) */}
              <div className="mt-3 min-h-[240px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-700 bg-slate-200/90 text-slate-800 text-[10px] font-black uppercase">
                      <th className="py-1.5 px-2 w-14">CÓD.</th>
                      <th className="py-1.5 px-2">DESCRIÇÃO DA RUBRICA</th>
                      <th className="py-1.5 px-2 text-center w-28">REFERÊNCIA</th>
                      <th className="py-1.5 px-2 text-right w-28">PROVENTOS (R$)</th>
                      <th className="py-1.5 px-2 text-right w-28">DESCONTOS (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {/* Proventos (Salário, Comissão de Motos, DSR, H.E., Adicionais) */}
                    {folha?.proventos?.map((p, idx) => (
                      <tr key={`p-${idx}`} className="hover:bg-slate-50/80">
                        <td className="py-1.5 px-2 text-slate-400 font-semibold">{101 + idx}</td>
                        <td className="py-1.5 px-2 font-bold text-slate-900">
                          {p.rubrica}
                          {p.rubrica.includes('Montagem de Motos') && (
                            <span className="ml-2 text-[9px] bg-orange-100 text-orange-950 font-black px-1.5 py-0.5 rounded border border-orange-300">
                              MECÂNICO MONTAGEM
                            </span>
                          )}
                          {p.rubrica.includes('Comissão de Vendas') && (
                            <span className={`ml-2 text-[9px] font-black px-1.5 py-0.5 rounded border ${
                              (funcionario?.cargo || folha?.cargo || '').includes('+')
                                ? 'bg-amber-400 text-amber-950 border-amber-500'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}>
                              {(funcionario?.cargo || folha?.cargo || '').includes('+') ? '⭐ VENDEDOR + MOTOS' : 'VENDAS MOTOS'}
                            </span>
                          )}
                          {p.rubrica.includes('Comissão de Oficina') && (
                            <span className="ml-2 text-[9px] bg-indigo-100 text-indigo-900 font-black px-1.5 py-0.5 rounded border border-indigo-300">
                              OFICINA / SERVIÇOS
                            </span>
                          )}
                          {p.rubrica.includes('Metas') && (
                            <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-900 font-black px-1.5 py-0.5 rounded border border-emerald-300">
                              GERÊNCIA / METAS
                            </span>
                          )}
                          {p.rubrica.startsWith('Comissão:') && (
                            <span className="ml-2 text-[9px] bg-purple-100 text-purple-900 font-black px-1.5 py-0.5 rounded border border-purple-300">
                              LEQUE CONCESSIONÁRIA
                            </span>
                          )}
                          {p.rubrica.includes('Ajuda de Custo') && (
                            <span className="ml-2 text-[9px] bg-blue-100 text-blue-900 font-black px-1.5 py-0.5 rounded border border-blue-300">
                              AJUDA DE CUSTO (ISENTO)
                            </span>
                          )}
                          {p.rubrica.includes('Reembolso de') && (
                            <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-900 font-black px-1.5 py-0.5 rounded border border-emerald-300">
                              REEMBOLSO DESPESAS
                            </span>
                          )}
                          {p.rubrica.includes('Gastos com a Loja') && (
                            <span className="ml-2 text-[9px] bg-amber-100 text-amber-950 font-black px-1.5 py-0.5 rounded border border-amber-400">
                              🏪 GASTOS COM A LOJA
                            </span>
                          )}
                          {p.rubrica.includes('Moto Parceiro') && (
                            <span className="ml-2 text-[9px] bg-teal-100 text-teal-950 font-black px-1.5 py-0.5 rounded border border-teal-400">
                              🤝 MOTO PARCEIRO
                            </span>
                          )}
                          {p.rubrica.includes('Retorno F&I') && (
                            <span className="ml-2 text-[9px] bg-cyan-100 text-cyan-950 font-black px-1.5 py-0.5 rounded border border-cyan-400">
                              📈 RETORNO F&I / BANCOS
                            </span>
                          )}
                          {p.rubrica.includes('Treinamento') && (
                            <span className="ml-2 text-[9px] bg-indigo-100 text-indigo-950 font-black px-1.5 py-0.5 rounded border border-indigo-400">
                              🎓 TREINAMENTO
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-center font-semibold text-slate-600">{p.referencia || '-'}</td>
                        <td className="py-1.5 px-2 text-right font-black text-emerald-800">{formatarMoeda(p.valor)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-300">-</td>
                      </tr>
                    ))}

                    {/* Descontos (INSS, IRRF, VT, VR, Faltas) */}
                    {folha?.descontos?.map((d, idx) => (
                      <tr key={`d-${idx}`} className="hover:bg-slate-50/80">
                        <td className="py-1.5 px-2 text-slate-400 font-semibold">{201 + idx}</td>
                        <td className="py-1.5 px-2 font-bold text-slate-800">{d.rubrica}</td>
                        <td className="py-1.5 px-2 text-center font-semibold text-slate-600">
                          {d.aliquota ? `${d.aliquota}%` : d.aliquotaEfetiva ? `${d.aliquotaEfetiva}%` : '-'}
                        </td>
                        <td className="py-1.5 px-2 text-right text-slate-300">-</td>
                        <td className="py-1.5 px-2 text-right font-black text-rose-700">{formatarMoeda(d.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Linha de Totais */}
              <div className="grid grid-cols-3 gap-2 border-t-2 border-b-2 border-slate-800 py-2.5 mt-4 bg-slate-50 text-right px-3 font-sans">
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Total Vencimentos:</span>
                  <span className="text-sm font-black text-emerald-800">{formatarMoeda(folha?.totalProventos)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Total Descontos:</span>
                  <span className="text-sm font-black text-rose-800">{formatarMoeda(folha?.totalDescontos)}</span>
                </div>
                <div className="bg-emerald-50 border-2 border-emerald-400 rounded-lg p-1.5 shadow-xs">
                  <span className="text-[9px] font-black text-emerald-950 block uppercase tracking-wider">
                    Valor Líquido a Receber:
                  </span>
                  <span className="text-base font-black text-emerald-900">{formatarMoeda(folha?.salarioLiquido)}</span>
                </div>
              </div>

              {/* Bases Legais de Contribuição e eSocial (Ou Dados de Prestação Terceirizada) */}
              {(funcionario?.tipoContrato === 'TERCEIRIZADO' || folha?.tipoContrato === 'TERCEIRIZADO') ? (
                <div className="grid grid-cols-2 gap-2 text-[9px] py-2 border-b border-purple-300 text-center bg-purple-50/80 mt-2 font-sans rounded">
                  <div>
                    <span className="block text-purple-700 font-bold uppercase">Modalidade de Pagamento</span>
                    <span className="font-bold text-slate-900">Prestação de Serviços Terceirizados</span>
                  </div>
                  <div>
                    <span className="block text-purple-700 font-bold uppercase">Encargos Trabalhistas / Vínculo</span>
                    <span className="font-bold text-slate-900">Sem Vínculo Empregatício CLT (Prestação Direta / Terceirizada)</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-2 text-[9px] py-2 border-b border-slate-300 text-center bg-slate-100/90 mt-2 font-sans rounded">
                  <div>
                    <span className="block text-slate-500 font-bold uppercase">Salário Base</span>
                    <span className="font-bold text-slate-900">{formatarMoeda(folha?.salarioBase)}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-bold uppercase">Sal. Contr. INSS</span>
                    <span className="font-bold text-slate-900">{formatarMoeda(folha?.baseINSS)}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-bold uppercase">Base FGTS</span>
                    <span className="font-bold text-slate-900">{formatarMoeda(folha?.baseFGTS)}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-bold uppercase">FGTS do Mês (8%)</span>
                    <span className="font-bold text-indigo-700">{formatarMoeda(folha?.fgts)}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-bold uppercase">Base IRRF</span>
                    <span className="font-bold text-slate-900">{formatarMoeda(folha?.baseIRRF)}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-bold uppercase">Faixa IRRF</span>
                    <span className="font-bold text-slate-900">{folha?.irrfDetalhe?.aliquota || 0}%</span>
                  </div>
                </div>
              )}

              {/* Canhoto de Quitação e Assinatura */}
              <div className="mt-8 pt-4 border-t border-dashed border-slate-400 text-[9px] flex justify-between items-end gap-6 font-sans">
                <div className="max-w-md text-slate-500 leading-snug">
                  {(funcionario?.tipoContrato === 'TERCEIRIZADO' || folha?.tipoContrato === 'TERCEIRIZADO')
                    ? 'DECLARO TER RECEBIDO O VALOR DISCRIMINADO NESTE DEMONSTRATIVO REFERENTE À PRESTAÇÃO DE SERVIÇOS NO MÊS DE COMPETÊNCIA INDICADO, DANDO PLENA E GERAL QUITAÇÃO.'
                    : 'DECLARO TER RECEBIDO A IMPORTÂNCIA LÍQUIDA DISCRIMINADA NESTE DEMONSTRATIVO DE PAGAMENTO, REFERENTE AOS SERVIÇOS PRESTADOS NO MÊS DE COMPETÊNCIA INDICADO, DANDO PLENA E GERAL QUITAÇÃO.'}
                </div>
                <div className="text-center w-72 border-t-2 border-slate-800 pt-1.5 shrink-0">
                  <span className="block font-black text-slate-900 text-[10px]">
                    {(funcionario?.tipoContrato === 'TERCEIRIZADO' || folha?.tipoContrato === 'TERCEIRIZADO')
                      ? 'ASSINATURA DO PRESTADOR / TERCEIRIZADO'
                      : 'ASSINATURA DO COLABORADOR'}
                  </span>
                  <span className="text-slate-400 text-[9px]">Data: ____ / ____ / ________</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé do Modal (Fixo) */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-3 no-print shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
          >
            Fechar Visualização
          </button>
        </div>
      </div>
    </div>
  );
}

