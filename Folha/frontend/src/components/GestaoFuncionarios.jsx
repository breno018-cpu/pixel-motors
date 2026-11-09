import React, { useState } from 'react';
import { UserPlus, Edit, Trash2, X, Bike, AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';

export default function GestaoFuncionarios({ funcionarios, onAtualizar }) {
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [erroSalvar, setErroSalvar] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // Cargos e setores da concessionária de motos
  const DEPARTAMENTOS_CONCESSIONARIA = [
    'Vendas de Motocicletas (Novas e Seminovas)',
    'Oficina Mecânica & Pós-Venda',
    'Boutique, Peças & Acessórios',
    'F&I (Financiamento, Seguros e Consórcios)',
    'Administrativo, Fiscal & Financeiro',
    'Lavagem e Preparação',
    'Serviços Terceirizados & Limpeza / Conservação'
  ];

  const CARGOS_SUGERIDOS = [
    'Consultor de Vendas de Motos',
    'Consultor de Vendas de Motos + (Comissão Diferenciada)',
    'Mecânico de Motocicletas Chefe',
    'Mecânico de Motos Especialista',
    'Auxiliar de Mecânica',
    'Vendedor de Peças e Acessórios',
    'Gerente Geral de Concessionária',
    'Analista de F&I (Financiamento e Consórcio)',
    'Lavador e Polidor de Motocicletas',
    'Estoquista de Peças',
    'Recepcionista de Oficina / Consultor Técnico',
    'Auxiliar de Limpeza e Conservação (Terceirizado)',
    'Prestador de Serviços Gerais (Terceirizado)'
  ];

  const initialForm = {
    nome: '',
    cpf: '',
    cargo: 'Consultor de Vendas de Motos',
    departamento: 'Vendas de Motocicletas (Novas e Seminovas)',
    salarioBase: 2500,
    dataAdmissao: new Date().toISOString().split('T')[0],
    dependentes: 0,
    tipoContrato: 'CLT', // 'CLT' ou 'TERCEIRIZADO'
    razaoSocialPrestador: '',
    cnpjPrestador: '',
    modeloComissaoVendedor: 'PADRAO', // 'PADRAO', 'VENDEDOR_PLUS', 'PERSONALIZADO'
    regrasComissaoCustomJSON: '',
    descontarINSS: true,
    descontarIRRF: true,
    calcularFGTS: true,
    pagarDSRComissao: false, // Por padrão desligado/não cobrado
    grauInsalubridade: 'NENHUM',
    temPericulosidade: false,
    optanteVT: true,
    custoValeTransporte: 0,
    descontoValeRefeicao: 0,
    descontoPlanoSaude: 0,
    chavePix: '',
    bancoConta: ''
  };

  const [formData, setFormData] = useState(initialForm);

  const abrirCriacao = () => {
    setEditandoId(null);
    setErroSalvar(null);
    setFormData(initialForm);
    setModalAberto(true);
  };

  const abrirEdicao = (f) => {
    setEditandoId(f.id);
    setErroSalvar(null);
    setFormData({
      nome: f.nome || '',
      cpf: f.cpf || '',
      cargo: f.cargo || '',
      departamento: f.departamento || 'Vendas de Motocicletas (Novas e Seminovas)',
      salarioBase: Number(f.salarioBase) || 0,
      dataAdmissao: f.dataAdmissao || new Date().toISOString().split('T')[0],
      dependentes: Number(f.dependentes) || 0,
      tipoContrato: f.tipoContrato || 'CLT',
      razaoSocialPrestador: f.razaoSocialPrestador || '',
      cnpjPrestador: f.cnpjPrestador || '',
      modeloComissaoVendedor: f.modeloComissaoVendedor || ((f.cargo || '').includes('+') ? 'VENDEDOR_PLUS' : 'PADRAO'),
      regrasComissaoCustomJSON: f.regrasComissaoCustomJSON || '',
      descontarINSS: f.descontarINSS !== undefined ? (Number(f.descontarINSS) === 1) : true,
      descontarIRRF: f.descontarIRRF !== undefined ? (Number(f.descontarIRRF) === 1) : true,
      calcularFGTS: f.calcularFGTS !== undefined ? (Number(f.calcularFGTS) === 1) : true,
      pagarDSRComissao: f.pagarDSRComissao !== undefined ? (Number(f.pagarDSRComissao) === 1) : false,
      grauInsalubridade: f.grauInsalubridade || 'NENHUM',
      temPericulosidade: !!f.temPericulosidade,
      optanteVT: f.optanteVT !== undefined ? !!f.optanteVT : true,
      custoValeTransporte: Number(f.custoValeTransporte) || 0,
      descontoValeRefeicao: Number(f.descontoValeRefeicao) || 0,
      descontoPlanoSaude: Number(f.descontoPlanoSaude) || 0,
      chavePix: f.chavePix || '',
      bancoConta: f.bancoConta || ''
    });
    setModalAberto(true);
  };

  const salvarFuncionario = async (e) => {
    e.preventDefault();
    setErroSalvar(null);
    setSalvando(true);

    try {
      const url = editandoId ? `/api/funcionarios/${editandoId}` : '/api/funcionarios';
      const method = editandoId ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        salarioBase: Number(formData.salarioBase) || 0,
        dependentes: Number(formData.dependentes) || 0,
        tipoContrato: formData.tipoContrato || 'CLT',
        razaoSocialPrestador: formData.razaoSocialPrestador || '',
        cnpjPrestador: formData.cnpjPrestador || '',
        modeloComissaoVendedor: formData.modeloComissaoVendedor || 'PADRAO',
        regrasComissaoCustomJSON: formData.regrasComissaoCustomJSON || '',
        descontarINSS: formData.tipoContrato === 'TERCEIRIZADO' ? 0 : (formData.descontarINSS ? 1 : 0),
        descontarIRRF: formData.tipoContrato === 'TERCEIRIZADO' ? 0 : (formData.descontarIRRF ? 1 : 0),
        calcularFGTS: formData.tipoContrato === 'TERCEIRIZADO' ? 0 : (formData.calcularFGTS ? 1 : 0),
        pagarDSRComissao: formData.pagarDSRComissao ? 1 : 0,
        custoValeTransporte: Number(formData.custoValeTransporte) || 0,
        descontoValeRefeicao: Number(formData.descontoValeRefeicao) || 0,
        descontoPlanoSaude: Number(formData.descontoPlanoSaude) || 0,
        temPericulosidade: formData.temPericulosidade ? 1 : 0,
        optanteVT: formData.optanteVT ? 1 : 0
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.error || 'Erro ao salvar colaborador no servidor.');
      }

      setModalAberto(false);
      onAtualizar();
    } catch (err) {
      console.error('Erro ao salvar funcionário:', err);
      setErroSalvar(err.message || 'Falha na comunicação ao salvar os dados.');
    } finally {
      setSalvando(false);
    }
  };

  const excluirFuncionario = async (id) => {
    if (!confirm('Deseja realmente remover este colaborador da concessionária?')) return;
    try {
      const res = await fetch(`/api/funcionarios/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onAtualizar();
      } else {
        alert('Erro ao excluir colaborador.');
      }
    } catch (err) {
      console.error(err);
      alert('Falha ao comunicar com o servidor.');
    }
  };

  const formatarMoeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 gap-4 shadow-xs">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Bike className="w-5 h-5 text-indigo-600" /> Equipe da Concessionária de Motos
          </h3>
          <p className="text-xs text-slate-500">
            Cadastre consultores de vendas, mecânicos e equipe administrativa com controle individual de impostos.
          </p>
        </div>
        <button
          onClick={abrirCriacao}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition"
        >
          <UserPlus className="w-4 h-4" /> Cadastrar Colaborador
        </button>
      </div>

      {funcionarios.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bike className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-slate-800">Nenhum funcionário cadastrado ainda</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Comece cadastrando sua equipe de consultores de vendas, mecânicos ou equipe de peças da concessionária.
          </p>
          <button
            onClick={abrirCriacao}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow transition"
          >
            <UserPlus className="w-4 h-4" /> Cadastrar Primeiro Colaborador
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[720px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs font-semibold">
                <tr>
                  <th className="py-3 px-4">Nome / CPF</th>
                  <th className="py-3 px-4">Cargo & Setor</th>
                  <th className="py-3 px-4">Salário Fixo Base</th>
                  <th className="py-3 px-4 text-center">Cobrança de Impostos</th>
                  <th className="py-3 px-4">Adicionais</th>
                  <th className="py-3 px-4 text-center">Benefícios</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {funcionarios.map((f) => {
                  const cobraINSS = f.descontarINSS !== undefined ? (Number(f.descontarINSS) === 1) : true;
                  const cobraIRRF = f.descontarIRRF !== undefined ? (Number(f.descontarIRRF) === 1) : true;
                  const cobraFGTS = f.calcularFGTS !== undefined ? (Number(f.calcularFGTS) === 1) : true;

                  return (
                    <tr key={f.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{f.nome}</div>
                        <div className="text-xs text-slate-400">CPF: {f.cpf}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                          <span>{f.cargo}</span>
                          {f.tipoContrato === 'TERCEIRIZADO' && (
                            <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-300 font-black px-1.5 py-0.5 rounded shadow-2xs">
                              🤝 TERCEIRIZADO
                            </span>
                          )}
                          {(f.modeloComissaoVendedor === 'VENDEDOR_PLUS' || (f.cargo || '').includes('+')) && f.tipoContrato !== 'TERCEIRIZADO' && (
                            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-black px-1.5 py-0.5 rounded shadow-2xs">
                              ⭐ VENDEDOR +
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-indigo-600 font-medium">
                          {f.tipoContrato === 'TERCEIRIZADO' && f.razaoSocialPrestador ? `Contratada: ${f.razaoSocialPrestador} • ` : ''}
                          {f.departamento}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        {formatarMoeda(f.salarioBase)}
                        {f.tipoContrato === 'TERCEIRIZADO' && (
                          <span className="block text-[9px] text-slate-400 font-medium">Valor Contratual / Fatura</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex gap-1 justify-center flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${cobraINSS ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-400 border-slate-200 line-through'}`}>
                            INSS
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${cobraIRRF ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-400 border-slate-200 line-through'}`}>
                            IRRF
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${cobraFGTS ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-slate-100 text-slate-400 border-slate-200 line-through'}`}>
                            FGTS
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${(f.pagarDSRComissao !== undefined ? Number(f.pagarDSRComissao) === 1 : false) ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-slate-100 text-slate-400 border-slate-200 line-through'}`}>
                            DSR
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {f.grauInsalubridade && f.grauInsalubridade !== 'NENHUM' && (
                          <span className="inline-block bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-semibold mr-1">
                            Insal. ({f.grauInsalubridade})
                          </span>
                        )}
                        {f.temPericulosidade ? (
                          <span className="inline-block bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded font-semibold">
                            Peric. (30%)
                          </span>
                        ) : null}
                        {(!f.grauInsalubridade || f.grauInsalubridade === 'NENHUM') && !f.temPericulosidade && (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-xs">
                        <div className="flex gap-1 justify-center">
                          {f.optanteVT ? <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-bold">VT</span> : null}
                          {f.descontoValeRefeicao > 0 ? <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold">VR</span> : null}
                          {f.descontoPlanoSaude > 0 ? <span className="bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] font-bold">Saúde</span> : null}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => abrirEdicao(f)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => excluirFuncionario(f.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Cadastro / Edição com Botões de Pergunta sobre Cobrança de Imposto */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-hidden">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col text-slate-800 shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 shrink-0 bg-slate-50/80">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <Bike className="w-5 h-5 text-indigo-600" />
                {editandoId ? 'Editar Colaborador da Concessionária' : 'Cadastrar Colaborador na Concessionária'}
              </h3>
              <button onClick={() => setModalAberto(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {erroSalvar && (
              <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{erroSalvar}</span>
              </div>
            )}

            <form onSubmit={salvarFuncionario} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nome Completo</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: João da Silva"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">CPF</label>
                  <input
                    required
                    type="text"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Setor / Departamento</label>
                  <select
                    value={formData.departamento}
                    onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {DEPARTAMENTOS_CONCESSIONARIA.map((dep, idx) => (
                      <option key={idx} value={dep}>{dep}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cargo na Concessionária</label>
                  <input
                    required
                    type="text"
                    list="cargos-sugeridos"
                    placeholder="Selecione ou digite o cargo..."
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id="cargos-sugeridos">
                    {CARGOS_SUGERIDOS.map((cargo, idx) => (
                      <option key={idx} value={cargo} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* SELEÇÃO DO REGIME DE CONTRATAÇÃO: CLT vs TERCEIRIZADO */}
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Regime de Contratação / Vínculo:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, tipoContrato: 'CLT' })}
                    className={`p-2.5 rounded-lg text-left text-xs font-bold transition flex items-center justify-between border ${
                      formData.tipoContrato === 'CLT'
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>Colaborador CLT (Salário em Folha)</span>
                    {formData.tipoContrato === 'CLT' && <span>✓</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      tipoContrato: 'TERCEIRIZADO',
                      descontarINSS: false,
                      descontarIRRF: false,
                      calcularFGTS: false,
                      optanteVT: false
                    })}
                    className={`p-2.5 rounded-lg text-left text-xs font-bold transition flex items-center justify-between border ${
                      formData.tipoContrato === 'TERCEIRIZADO'
                        ? 'bg-purple-700 text-white border-purple-800 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>Terceirizado (Limpeza / Prestador)</span>
                    {formData.tipoContrato === 'TERCEIRIZADO' && <span>✓</span>}
                  </button>
                </div>

                {formData.tipoContrato === 'TERCEIRIZADO' && (
                  <div className="pt-2 border-t border-purple-200 mt-2 bg-purple-50/70 p-2.5 rounded-lg text-[11px] text-purple-950 font-medium">
                    🤝 <strong>Colaborador Terceirizado / Limpeza:</strong> O demonstrativo será gerado sem qualquer menção a salário e sem retenção/cálculo de tributos de CLT (INSS, FGTS, IRRF).
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {formData.tipoContrato === 'TERCEIRIZADO' ? 'Valor Contratual / Fatura (R$)' : 'Salário Fixo Base (R$)'}
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={formData.salarioBase}
                    onChange={(e) => setFormData({ ...formData, salarioBase: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {formData.tipoContrato === 'TERCEIRIZADO' ? 'Início do Contrato' : 'Data de Admissão'}
                  </label>
                  <input
                    type="date"
                    value={formData.dataAdmissao}
                    onChange={(e) => setFormData({ ...formData, dataAdmissao: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Dependentes IRRF</label>
                  <input
                    type="number"
                    disabled={formData.tipoContrato === 'TERCEIRIZADO'}
                    value={formData.tipoContrato === 'TERCEIRIZADO' ? 0 : formData.dependentes}
                    onChange={(e) => setFormData({ ...formData, dependentes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              {/* SEÇÃO EXCLUSIVA: MODELO DE COMISSÃO DE VENDAS (VENDEDOR PADRÃO OU VENDEDOR +) */}
              {((formData.cargo || '').toLowerCase().includes('vend') || (formData.cargo || '').toLowerCase().includes('consultor') || (formData.departamento || '').toLowerCase().includes('vendas')) && (
                <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-amber-950 flex items-center gap-1.5 uppercase">
                      <Bike className="w-4 h-4 text-orange-600" /> Política de Comissão de Motos do Colaborador:
                    </span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded">
                      Vendas de Motos
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, modeloComissaoVendedor: 'PADRAO' })}
                      className={`p-2.5 rounded-lg border text-left transition flex flex-col ${
                        formData.modeloComissaoVendedor === 'PADRAO'
                          ? 'bg-white border-amber-400 ring-2 ring-amber-300 shadow-xs'
                          : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                      }`}
                    >
                      <span className="text-xs font-bold text-slate-900">Vendedor Normal (Padrão)</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">Segue a tabela geral da concessionária.</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        modeloComissaoVendedor: 'VENDEDOR_PLUS',
                        cargo: formData.cargo.includes('+') ? formData.cargo : (formData.cargo ? `${formData.cargo} +` : 'Consultor de Vendas +')
                      })}
                      className={`p-2.5 rounded-lg border text-left transition flex flex-col ${
                        formData.modeloComissaoVendedor === 'VENDEDOR_PLUS' || (formData.cargo || '').includes('+')
                          ? 'bg-amber-100/90 border-amber-500 ring-2 ring-amber-400 shadow-xs'
                          : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                      }`}
                    >
                      <span className="text-xs font-black text-amber-950 flex items-center gap-1">
                        ⭐ Vendedor + (Diferenciada)
                      </span>
                      <span className="text-[10px] text-amber-900 mt-0.5">Faixas especiais de comissão superior.</span>
                    </button>
                  </div>
                </div>
              )}

              {/* BOTÕES DE PERGUNTA: COBRANÇA DE IMPOSTOS & ENCARGOS */}
              <div className="p-4 bg-gradient-to-r from-slate-50 to-indigo-50/40 rounded-xl border border-indigo-100 space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Cobrança de Impostos & Encargos no Colaborador:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  
                  {/* Pergunta INSS */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="block text-[11px] font-bold text-slate-700 mb-1.5">Cobrar INSS?</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, descontarINSS: true })}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
                          formData.descontarINSS
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        SIM
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, descontarINSS: false })}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
                          !formData.descontarINSS
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        NÃO
                      </button>
                    </div>
                  </div>

                  {/* Pergunta IRRF */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="block text-[11px] font-bold text-slate-700 mb-1.5">Cobrar IRRF?</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, descontarIRRF: true })}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
                          formData.descontarIRRF
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        SIM
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, descontarIRRF: false })}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
                          !formData.descontarIRRF
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        NÃO
                      </button>
                    </div>
                  </div>

                  {/* Pergunta FGTS */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="block text-[11px] font-bold text-slate-700 mb-1.5">Calcular FGTS?</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, calcularFGTS: true })}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
                          formData.calcularFGTS
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        SIM
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, calcularFGTS: false })}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
                          !formData.calcularFGTS
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        NÃO
                      </button>
                    </div>
                  </div>

                  {/* Pergunta DSR sobre Comissões */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="block text-[11px] font-bold text-slate-700 mb-1.5">Calcular DSR Comissão?</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, pagarDSRComissao: true })}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
                          formData.pagarDSRComissao
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        SIM
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, pagarDSRComissao: false })}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold transition ${
                          !formData.pagarDSRComissao
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        NÃO
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Insalubridade (Oficina / Óleos)
                </label>
                <select
                  value={formData.grauInsalubridade}
                  onChange={(e) => setFormData({ ...formData, grauInsalubridade: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                >
                  <option value="NENHUM">Nenhuma (0%)</option>
                  <option value="MINIMO">Grau Mínimo (10%)</option>
                  <option value="MEDIO">Grau Médio - Mecânicos/Graxa (20%)</option>
                  <option value="MAXIMO">Grau Máximo - Solventes/Pintura (40%)</option>
                </select>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="font-semibold text-xs text-slate-700 mb-2">Benefícios e Descontos Opcionais</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Custo VT (R$/mês)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.custoValeTransporte}
                      onChange={(e) => setFormData({ ...formData, custoValeTransporte: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Desc. VR/VA (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.descontoValeRefeicao}
                      onChange={(e) => setFormData({ ...formData, descontoValeRefeicao: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Desc. Saúde (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.descontoPlanoSaude}
                      onChange={(e) => setFormData({ ...formData, descontoPlanoSaude: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs"
                    />
                  </div>
                </div>

                <div className="flex gap-4 mt-3">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.temPericulosidade}
                      onChange={(e) => setFormData({ ...formData, temPericulosidade: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Periculosidade (30%)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.optanteVT}
                      onChange={(e) => setFormData({ ...formData, optanteVT: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Optante por Vale Transporte</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chave PIX para Depósito</label>
                    <input
                      type="text"
                      placeholder="CPF, e-mail, celular ou chave aleatória"
                      value={formData.chavePix}
                      onChange={(e) => setFormData({ ...formData, chavePix: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Banco / Agência / Conta</label>
                    <input
                      type="text"
                      placeholder="Ex: Banco do Brasil - Ag 1234 CC 5678-9"
                      value={formData.bancoConta}
                      onChange={(e) => setFormData({ ...formData, bancoConta: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
              </div>



              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-100 transition"
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow transition flex items-center gap-2"
                >
                  {salvando ? 'Salvando...' : 'Salvar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
