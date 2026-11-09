/**
 * Motor de Cálculo de Folha de Pagamento - CLT Atualizado
 * Tabelas oficiais vigentes de INSS progressivo, IRRF progressivo, FGTS, Adicionais, Comissões por Motos, Férias, 13º e Rescisões.
 */

// Tabela de INSS Progressiva (Vigência 2024 / 2025 / 2026)
// Teto Salário de Contribuição = R$ 7.786,02
const TABELA_INSS = [
  { ate: 1412.00, aliquota: 0.075, deducao: 0 },
  { ate: 2666.68, aliquota: 0.09, deducao: 21.18 },
  { ate: 4000.03, aliquota: 0.12, deducao: 101.18 },
  { ate: 7786.02, aliquota: 0.14, deducao: 181.18 }
];
const TETO_INSS = 908.86; // Máximo recolhimento mensal de INSS empregado

// Tabela de IRRF Progressiva com dedução legal e desconto simplificado
const DEDUCAO_DEPENDENTE_IRRF = 189.59;
const DESCONTO_SIMPLIFICADO_IRRF = 564.80; // Opção automática pela dedução mais vantajosa
const TABELA_IRRF = [
  { ate: 2259.20, aliquota: 0.0, deducao: 0.0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
  { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
  { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
  { ate: Infinity, aliquota: 0.275, deducao: 896.00 }
];

// Salário Mínimo de Referência
const SALARIO_MINIMO = 1412.00;

/**
 * Cálculo de INSS Progressivo Faixa a Faixa
 */
export function calcularINSS(baseINSS) {
  if (baseINSS <= 0) return { valor: 0, aliquotaEfetiva: 0, memoria: [] };

  const salarioCalculo = Math.min(baseINSS, 7786.02);
  let totalINSS = 0;
  const memoria = [];

  let faixaAnterior = 0;
  for (let i = 0; i < TABELA_INSS.length; i++) {
    const faixa = TABELA_INSS[i];
    if (salarioCalculo > faixaAnterior) {
      const baseFaixa = Math.min(salarioCalculo, faixa.ate) - faixaAnterior;
      const valorFaixa = +(baseFaixa * faixa.aliquota).toFixed(2);
      totalINSS += valorFaixa;
      memoria.push({
        faixa: i + 1,
        de: faixaAnterior,
        ate: Math.min(salarioCalculo, faixa.ate),
        aliquota: faixa.aliquota * 100,
        valor: valorFaixa
      });
      faixaAnterior = faixa.ate;
    }
  }

  // Arredondamento e conferência com o teto
  totalINSS = Math.min(+totalINSS.toFixed(2), TETO_INSS);
  const aliquotaEfetiva = +( (totalINSS / baseINSS) * 100 ).toFixed(2);

  return { valor: totalINSS, aliquotaEfetiva, memoria };
}

/**
 * Cálculo de IRRF considerando a regra mais vantajosa (Deduções Legais vs Simplificado)
 */
export function calcularIRRF(baseBruta, inssPago, dependentes = 0, pensaoAlimenticia = 0, outrasDeducoes = 0) {
  const deducaoDependentesTotal = dependentes * DEDUCAO_DEPENDENTE_IRRF;
  const deducaoLegal = inssPago + deducaoDependentesTotal + pensaoAlimenticia + outrasDeducoes;
  
  // Base legal normal
  const baseCalculoLegal = Math.max(0, baseBruta - deducaoLegal);
  
  // Base com desconto simplificado (se mais vantajoso que deduções legais)
  const baseCalculoSimplificado = Math.max(0, baseBruta - DESCONTO_SIMPLIFICADO_IRRF);
  
  // Escolhe a base menor (mais favorável ao trabalhador)
  const usarSimplificado = baseCalculoSimplificado < baseCalculoLegal;
  const baseCalculo = usarSimplificado ? baseCalculoSimplificado : baseCalculoLegal;

  let aliquota = 0;
  let deducaoFaixa = 0;

  for (const faixa of TABELA_IRRF) {
    if (baseCalculo <= faixa.ate) {
      aliquota = faixa.aliquota;
      deducaoFaixa = faixa.deducao;
      break;
    }
  }

  let valorIRRF = +( (baseCalculo * aliquota) - deducaoFaixa ).toFixed(2);
  if (valorIRRF < 0 || valorIRRF < 10) { // Dispensado recolhimento inferior a R$ 10,00
    valorIRRF = 0;
  }

  return {
    baseCalculo: +baseCalculo.toFixed(2),
    aliquota: aliquota * 100,
    deducaoFaixa,
    valor: valorIRRF,
    usouSimplificado: usarSimplificado,
    deducaoTotal: +(usarSimplificado ? DESCONTO_SIMPLIFICADO_IRRF : deducaoLegal).toFixed(2)
  };
}

/**
 * Cálculo de FGTS (Obrigação do Empregador - não desconta do salário)
 * Geral CLT = 8%, Jovem Aprendiz = 2%
 */
export function calcularFGTS(baseFGTS, tipoContrato = 'CLT') {
  const taxa = tipoContrato === 'APRENDIZ' ? 0.02 : 0.08;
  return +(baseFGTS * taxa).toFixed(2);
}

/**
 * Cálculo de Horas Extras
 */
export function calcularHorasExtras(salarioBase, cargaHorariaMensal = 220, horas50 = 0, horas100 = 0, percentualCustom = 0, qtdCustom = 0) {
  const valorHoraNormal = salarioBase / cargaHorariaMensal;
  
  const total50 = +(horas50 * (valorHoraNormal * 1.5)).toFixed(2);
  const total100 = +(horas100 * (valorHoraNormal * 2.0)).toFixed(2);
  const totalCustom = +(qtdCustom * (valorHoraNormal * (1 + (percentualCustom / 100)))).toFixed(2);
  
  return {
    valorHora: +valorHoraNormal.toFixed(2),
    total50,
    total100,
    totalCustom,
    totalHorasExtras: +(total50 + total100 + totalCustom).toFixed(2)
  };
}

/**
 * Cálculo de DSR (Descanso Semanal Remunerado) sobre Horas Extras, Comissões e Adicional Noturno
 * Lei 605/49 e Súmula 27 do TST (Comissões geram DSR obrigatório)
 */
export function calcularDSR(totalVariaveis, diasUteis = 25, domingosEFeriados = 5) {
  if (diasUteis <= 0 || totalVariaveis <= 0) return 0;
  return +( (totalVariaveis / diasUteis) * domingosEFeriados ).toFixed(2);
}

/**
 * Adicional Noturno (20% CLT no mínimo sobre a hora noturna de 52min30s)
 */
export function calcularAdicionalNoturno(salarioBase, cargaHorariaMensal = 220, horasNoturnas = 0, percentual = 20) {
  const valorHora = salarioBase / cargaHorariaMensal;
  const fatorReducao = 60 / 52.5;
  const horasNoturnasComputadas = horasNoturnas * fatorReducao;
  const valorTotal = +(horasNoturnasComputadas * valorHora * (percentual / 100)).toFixed(2);
  return {
    horasComputadas: +horasNoturnasComputadas.toFixed(2),
    valorTotal
  };
}

/**
 * Adicional de Insalubridade (Grau Mínimo 10%, Médio 20%, Máximo 40% sobre Salário Mínimo)
 */
export function calcularInsalubridade(grau = 'NENHUM', basePersonalizada = null) {
  const base = basePersonalizada || SALARIO_MINIMO;
  let perc = 0;
  if (grau === 'MINIMO') perc = 0.10;
  if (grau === 'MEDIO') perc = 0.20;
  if (grau === 'MAXIMO') perc = 0.40;
  return +(base * perc).toFixed(2);
}

/**
 * Adicional de Periculosidade (30% sobre o Salário Base do empregado)
 */
export function calcularPericulosidade(salarioBase, ativo = false) {
  if (!ativo) return 0;
  return +(salarioBase * 0.30).toFixed(2);
}

/**
 * Desconto de Vale Transporte (Até 6% do salário base, limitado ao custo real fornecido)
 */
export function calcularValeTransporte(salarioBase, custoRealVT = 0, optante = true) {
  if (!optante || custoRealVT <= 0) return 0;
  const tetoLegal = +(salarioBase * 0.06).toFixed(2);
  return Math.min(tetoLegal, custoRealVT);
}

/**
 * CÁLCULO DE COMISSÃO DE VENDEDOR DE MOTOS POR QUANTIDADE
 * Faixas configuráveis: ex.: 1 a 5 motos = R$ 50/moto; 6 a 10 = R$ 75/moto; 11 a 15 = R$ 100/moto; 16+ = R$ 150/moto
 */
export function calcularComissaoMotos(motosVendidas = 0, regrasComissao = null) {
  const qtd = Math.max(0, parseInt(motosVendidas, 10) || 0);
  if (qtd <= 0) {
    return {
      motosVendidas: 0,
      valorUnitarioFaixa: 0,
      totalComissao: 0,
      faixaAtingida: 'Nenhuma'
    };
  }

  const regras = regrasComissao && regrasComissao.length > 0 ? regrasComissao : [
    { de: 1, ate: 5, valorPorMoto: 50 },
    { de: 6, ate: 10, valorPorMoto: 75 },
    { de: 11, ate: 20, valorPorMoto: 100 },
    { de: 21, ate: 60, valorPorMoto: 150 },
    { de: 61, ate: 9999, valorPorMoto: 200 }
  ];

  // Encontra a faixa atingida pelo volume vendido
  let faixaEncontrada = regras.find(r => qtd >= r.de && qtd <= r.ate);
  if (!faixaEncontrada) {
    faixaEncontrada = regras[regras.length - 1]; // Pega a última faixa como teto
  }

  const valorUnitarioFaixa = Number(faixaEncontrada?.valorPorMoto) || 0;
  const totalComissao = +(qtd * valorUnitarioFaixa).toFixed(2);

  return {
    motosVendidas: qtd,
    valorUnitarioFaixa,
    totalComissao,
    faixaAtingida: `${faixaEncontrada.de} a ${faixaEncontrada.ate >= 9999 ? '+' : faixaEncontrada.ate} motos (R$ ${valorUnitarioFaixa}/moto)`
  };
}

/**
 * CÁLCULO DE COMISSÃO DE MECÂNICO POR MONTAGEM DE MOTOS (VALOR FIXO POR MOTO)
 */
export function calcularComissaoMontagem(motosMontadas = 0, valorPorMontagem = 0) {
  const qtd = Math.max(0, parseInt(motosMontadas, 10) || 0);
  const valorUnit = Math.max(0, Number(valorPorMontagem) || 0);
  const total = +(qtd * valorUnit).toFixed(2);
  return {
    motosMontadas: qtd,
    valorPorMontagem: valorUnit,
    totalComissao: total,
    descricao: qtd > 0 ? `${qtd} montagens x R$ ${valorUnit.toFixed(2)}` : 'Nenhuma montagem'
  };
}

/**
 * Cálculo Completo da Folha Mensal Individual
 */
export function calcularFolhaFuncionario(dados) {
  const {
    funcionario,
    mesReferencia, // 'YYYY-MM'
    motosVendidas = 0,
    motosMarketingLoja = 0,
    motosMarketingProprio = 0,
    valorMarketingProprio = 500,
    regrasComissao = null,
    motosMontadas = 0,
    valorPorMontagem = 0,
    comissaoServicos = 0,
    comissaoGeral = 0,
    descricaoComissaoGeral = '',
    comissoesDetalhadas = [],
    horas50 = 0,
    horas100 = 0,
    horasNoturnas = 0,
    diasUteis = 25,
    domingosEFeriados = 5,
    faltasDias = 0,
    atrasosMinutos = 0,
    custoValeTransporte = 0,
    optanteVT = true,
    descontoValeRefeicao = 0,
    descontoPlanoSaude = 0,
    outrosProventos = 0,
    outrosProventosDescricao = '',
    ajudaDeCusto = 0,
    ajudaDeCustoDescricao = '',
    reembolsoDespesas = 0,
    reembolsoDespesasDescricao = '',
    gastosDiversos = 0,
    gastosDiversosDescricao = '',
    comissaoMotoParceiro = 0,
    motoParceiroQtd = 0,
    motoParceiroDescricao = '',
    comissaoRetorno = 0,
    retornoDescricao = '',
    outrosDescontos = 0,
    outrosDescontosDescricao = '',
    pensaoAlimenticia = 0,
    comissaoTreinamento = 0,
    comissaoTreinamentoDescricao = ''
  } = dados;

  const salarioBase = Number(funcionario.salarioBase) || 0;
  const cargaHoraria = Number(funcionario.cargaHoraria) || 220;

  // 1. Proventos Fixos e Adicionais
  const insalubridade = calcularInsalubridade(funcionario.grauInsalubridade || 'NENHUM');
  const periculosidade = calcularPericulosidade(salarioBase, !!funcionario.temPericulosidade);

  // 2. Comissões da Concessionária
  // 2.1. Vendedor de Motos
  // Se houver divisão entre marketing da loja e marketing próprio (Regra do Vendedor +)
  const qtdMktLoja = Number(motosMarketingLoja) || 0;
  const qtdMktProprio = Number(motosMarketingProprio) || 0;
  const valorUnitProprio = Number(valorMarketingProprio) || 500;

  // Se foram informados mkt loja / mkt próprio, usa a soma para a faixa de vendas ou o total informado
  const qtdMotosGerais = (qtdMktLoja > 0 || qtdMktProprio > 0) ? (qtdMktLoja + qtdMktProprio) : Number(motosVendidas) || 0;

  // Comissão de motos vinda pelo Marketing da Loja (ou comissão normal por faixas)
  // Se houver distinção, a comissão normal incide sobre as motos do marketing da loja (ou sobre o volume conforme configurado)
  const motosBaseNormal = (qtdMktLoja > 0 || qtdMktProprio > 0) ? qtdMktLoja : qtdMotosGerais;
  const infoComissaoVenda = calcularComissaoMotos(motosBaseNormal, regrasComissao);
  const comissaoMotosValor = infoComissaoVenda.totalComissao;

  // Comissão de Motos Vendidas pelo Próprio Marketing (R$ 500 de todas as motos captadas por ele)
  const comissaoMarketingProprioValor = +(qtdMktProprio * valorUnitProprio).toFixed(2);

  // 2.2. Mecânico de Motos (Valor Fixo por moto montada / retirada da caixa)
  const infoMontagem = calcularComissaoMontagem(motosMontadas, valorPorMontagem);
  const comissaoMontagemValor = infoMontagem.totalComissao;

  // 2.3. Outros Serviços de Oficina & Peças
  const comissaoServicosValor = Number(comissaoServicos) || 0;

  // 2.4. Gerência / Metas Globais
  const comissaoGeralValor = Number(comissaoGeral) || 0;

  // 2.5. Leque de Comissões Únicas Configuráveis
  const listaComissoesCustom = Array.isArray(comissoesDetalhadas) ? comissoesDetalhadas : [];
  const comissoesCustomTotal = +(listaComissoesCustom.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0)).toFixed(2);

  // 2.6. Comissões Administrativas: Moto Parceiro & Retorno Financeiro (F&I / Banco)
  const comissaoMotoParceiroValor = +(Number(comissaoMotoParceiro) || 0).toFixed(2);
  const comissaoRetornoValor = +(Number(comissaoRetorno) || 0).toFixed(2);

  // 2.7. Comissão por Treinamento de Vendedores
  const comissaoTreinamentoValor = +(Number(comissaoTreinamento) || 0).toFixed(2);

  // Total de Comissões Somadas
  const totalTodasComissoes = +(
    comissaoMotosValor +
    comissaoMarketingProprioValor +
    comissaoMontagemValor +
    comissaoServicosValor +
    comissaoGeralValor +
    comissoesCustomTotal +
    comissaoMotoParceiroValor +
    comissaoRetornoValor +
    comissaoTreinamentoValor
  ).toFixed(2);

  // DSR sobre as Comissões (Súmula 27 TST) - Ativo por padrão ou desativado se configurado no colaborador
  const devePagarDSRComissao = funcionario.pagarDSRComissao !== undefined ? (Number(funcionario.pagarDSRComissao) === 1) : true;
  const dsrComissao = devePagarDSRComissao ? calcularDSR(totalTodasComissoes, diasUteis, domingosEFeriados) : 0;

  // 3. Horas Extras e Noturno
  const he = calcularHorasExtras(salarioBase, cargaHoraria, horas50, horas100);
  const adicNoturno = calcularAdicionalNoturno(salarioBase, cargaHoraria, horasNoturnas);
  
  // DSR sobre Horas Extras / Noturno
  const totalHorasVariaveis = he.totalHorasExtras + adicNoturno.valorTotal;
  const dsrHoras = calcularDSR(totalHorasVariaveis, diasUteis, domingosEFeriados);

  const totalDSRGeral = +(dsrComissao + dsrHoras).toFixed(2);

  // 4. Faltas e Atrasos
  const valorDia = salarioBase / 30;
  const valorHora = salarioBase / cargaHoraria;
  const valorFaltas = +(faltasDias * valorDia).toFixed(2);
  const valorAtrasos = +( (atrasosMinutos / 60) * valorHora ).toFixed(2);
  const dsrPerdidoFaltas = faltasDias > 0 ? +(Math.ceil(faltasDias / 6) * valorDia).toFixed(2) : 0;

  // Ajuda de Custo, Reembolsos e Gastos com a Loja (Art. 457, § 2º CLT - Indenizatório / Isento de INSS/FGTS)
  const ajudaDeCustoValor = +(Number(ajudaDeCusto) || 0).toFixed(2);
  const reembolsoDespesasValor = +(Number(reembolsoDespesas) || 0).toFixed(2);
  const gastosDiversosValor = +(Number(gastosDiversos) || 0).toFixed(2);

  // 5. Total de Proventos Brutos
  const totalProventos = +(
    salarioBase +
    comissaoMotosValor +
    comissaoMarketingProprioValor +
    comissaoMontagemValor +
    comissaoServicosValor +
    comissaoGeralValor +
    comissoesCustomTotal +
    comissaoMotoParceiroValor +
    comissaoRetornoValor +
    comissaoTreinamentoValor +
    dsrComissao +
    he.totalHorasExtras +
    adicNoturno.valorTotal +
    dsrHoras +
    insalubridade +
    periculosidade +
    Number(outrosProventos) +
    ajudaDeCustoValor +
    reembolsoDespesasValor +
    gastosDiversosValor
  ).toFixed(2);

  const isTerceirizado = funcionario.tipoContrato === 'TERCEIRIZADO' || funcionario.tipoContrato === 'PJ';

  // Base de Cálculo INSS (Salário + Comissões + DSR + Horas extras + Adicionais - Faltas)
  // NOTA CLT: Ajuda de Custo, Reembolso de Despesas e Gastos Indenizatórios NÃO integram a base de INSS/FGTS (Lei 13.467/2017)
  const baseINSS = isTerceirizado ? 0 : Math.max(0, +(totalProventos - ajudaDeCustoValor - reembolsoDespesasValor - gastosDiversosValor - valorFaltas - valorAtrasos - dsrPerdidoFaltas).toFixed(2));
  
  // Verifica se o colaborador deve sofrer desconto de impostos
  const deveCobrarINSS = isTerceirizado ? false : (funcionario.descontarINSS !== undefined ? (Number(funcionario.descontarINSS) === 1) : true);
  const deveCobrarIRRF = isTerceirizado ? false : (funcionario.descontarIRRF !== undefined ? (Number(funcionario.descontarIRRF) === 1) : true);
  const deveCalcularFGTS = isTerceirizado ? false : (funcionario.calcularFGTS !== undefined ? (Number(funcionario.calcularFGTS) === 1) : true);

  const inss = deveCobrarINSS ? calcularINSS(baseINSS) : { valor: 0, aliquotaEfetiva: 0, isento: true };

  // Base e Cálculo IRRF
  const dependentes = Number(funcionario.dependentes) || 0;
  const irrf = deveCobrarIRRF ? calcularIRRF(baseINSS, inss.valor, dependentes, pensaoAlimenticia) : { valor: 0, aliquota: 0, isento: true };

  // FGTS (Custo Empregador)
  const baseFGTS = baseINSS;
  const fgts = deveCalcularFGTS ? calcularFGTS(baseFGTS, funcionario.tipoContrato || 'CLT') : 0;

  // 6. Descontos do Colaborador
  const descontoVT = isTerceirizado ? 0 : calcularValeTransporte(salarioBase, custoValeTransporte, optanteVT);
  
  const listaDescontos = [
    ...(deveCobrarINSS && inss.valor > 0 ? [{ rubrica: 'INSS', tipo: 'LEGAL', valor: inss.valor, aliquotaEfetiva: inss.aliquotaEfetiva }] : []),
    ...(deveCobrarIRRF && irrf.valor > 0 ? [{ rubrica: 'IRRF', tipo: 'LEGAL', valor: irrf.valor, aliquota: irrf.aliquota }] : []),
    ...(isTerceirizado ? [] : [{ rubrica: 'Vale Transporte (6% teto)', tipo: 'BENEFICIO', valor: descontoVT }]),
    { rubrica: 'Vale Refeição / Alimentação', tipo: 'BENEFICIO', valor: +descontoValeRefeicao.toFixed(2) },
    { rubrica: 'Plano de Saúde / Odonto', tipo: 'BENEFICIO', valor: +descontoPlanoSaude.toFixed(2) },
    { rubrica: 'Faltas Injustificadas', tipo: 'PENALIDADE', valor: valorFaltas },
    { rubrica: 'Atrasos / Saídas Antecipadas', tipo: 'PENALIDADE', valor: valorAtrasos },
    { rubrica: 'DSR sobre Faltas', tipo: 'PENALIDADE', valor: dsrPerdidoFaltas },
    { rubrica: 'Pensão Alimentícia Judicial', tipo: 'LEGAL', valor: +Number(pensaoAlimenticia).toFixed(2) },
    { rubrica: outrosDescontosDescricao ? `Outro Gasto / Desconto: ${outrosDescontosDescricao}` : 'Outros Descontos / Gastos', tipo: 'OUTROS', valor: +Number(outrosDescontos).toFixed(2) }
  ].filter(d => d.valor > 0);

  const totalDescontos = +(listaDescontos.reduce((acc, curr) => acc + curr.valor, 0)).toFixed(2);

  // 7. Proventos Detalhados (com rubricas de Terceirização / Prestação de Serviço ou Salário Base CLT)
  const listaProventos = [
    {
      rubrica: isTerceirizado ? 'Prestação de Serviços (Terceirizado)' : 'Salário Base',
      tipo: 'FIXO',
      valor: salarioBase,
      referencia: isTerceirizado ? 'Serviços Prestados' : '30 dias'
    },
    {
      rubrica: qtdMktProprio > 0 ? 'Comissão Vendas (Marketing Loja)' : 'Comissão de Vendas de Motos',
      tipo: 'VARIAVEL',
      valor: comissaoMotosValor,
      referencia: `${infoComissaoVenda.motosVendidas} motos (R$ ${infoComissaoVenda.valorUnitarioFaixa}/un)`
    },
    ...(qtdMktProprio > 0 ? [{
      rubrica: 'Comissão Vendas (Próprio Marketing / Captação)',
      tipo: 'VARIAVEL',
      valor: comissaoMarketingProprioValor,
      referencia: `${qtdMktProprio} motos (R$ ${valorUnitProprio.toFixed(2)}/un)`
    }] : []),
    { rubrica: 'Comissão Montagem de Motos (Mecânico)', tipo: 'VARIAVEL', valor: comissaoMontagemValor, referencia: `${infoMontagem.motosMontadas} montagens (R$ ${infoMontagem.valorPorMontagem.toFixed(2)}/un)` },
    { rubrica: 'Comissão de Oficina / Mecânica / Peças', tipo: 'VARIAVEL', valor: comissaoServicosValor, referencia: 'Serviços' },
    { rubrica: descricaoComissaoGeral ? `Comissão: ${descricaoComissaoGeral}` : 'Comissão de Metas / Gerência', tipo: 'VARIAVEL', valor: comissaoGeralValor, referencia: 'Metas' },
    ...listaComissoesCustom.map(c => ({
      rubrica: `Comissão: ${c.nome || 'Personalizada'}`,
      tipo: 'VARIAVEL',
      valor: Number(c.valor) || 0,
      referencia: c.referencia || `${c.qtd || 1} un`
    })),
    { rubrica: 'DSR sobre Comissões', tipo: 'VARIAVEL', valor: dsrComissao, referencia: `${domingosEFeriados} dom/fer` },
    { rubrica: 'Horas Extras 50%', tipo: 'VARIAVEL', valor: he.total50, referencia: `${horas50}h` },
    { rubrica: 'Horas Extras 100%', tipo: 'VARIAVEL', valor: he.total100, referencia: `${horas100}h` },
    { rubrica: 'Adicional Noturno (20%)', tipo: 'VARIAVEL', valor: adicNoturno.valorTotal, referencia: `${horasNoturnas}h` },
    { rubrica: 'DSR sobre Horas Extras / Noturno', tipo: 'VARIAVEL', valor: dsrHoras, referencia: `${domingosEFeriados} dom/fer` },
    { rubrica: 'Adicional de Insalubridade', tipo: 'ADICIONAL', valor: insalubridade, referencia: funcionario.grauInsalubridade },
    { rubrica: 'Adicional de Periculosidade (30%)', tipo: 'ADICIONAL', valor: periculosidade, referencia: '30%' },
    { rubrica: ajudaDeCustoDescricao ? `Ajuda de Custo: ${ajudaDeCustoDescricao}` : 'Ajuda de Custo', tipo: 'INDENIZATORIO', valor: ajudaDeCustoValor, referencia: 'Isento Encargos' },
    { rubrica: reembolsoDespesasDescricao ? `Reembolso de Gastos: ${reembolsoDespesasDescricao}` : 'Reembolso de Despesas / Gastos', tipo: 'INDENIZATORIO', valor: reembolsoDespesasValor, referencia: 'Reembolso' },
    { rubrica: gastosDiversosDescricao ? `Gastos com a Loja: ${gastosDiversosDescricao}` : 'Gastos Diversos com a Loja', tipo: 'INDENIZATORIO', valor: gastosDiversosValor, referencia: 'Operacional' },
    { rubrica: motoParceiroDescricao ? `Comissão Moto Parceiro: ${motoParceiroDescricao}` : 'Comissão Moto Parceiro', tipo: 'VARIAVEL', valor: comissaoMotoParceiroValor, referencia: motoParceiroQtd > 0 ? `${motoParceiroQtd} un` : 'Parceiro' },
    { rubrica: retornoDescricao ? `Comissão Retorno F&I: ${retornoDescricao}` : 'Comissão Retorno Financeiro (F&I)', tipo: 'VARIAVEL', valor: comissaoRetornoValor, referencia: 'Retorno F&I' },
    { rubrica: comissaoTreinamentoDescricao ? `Comissão Treinamento: ${comissaoTreinamentoDescricao}` : 'Comissão por Treinamento de Vendedores', tipo: 'VARIAVEL', valor: comissaoTreinamentoValor, referencia: 'Treinamento' },
    { rubrica: outrosProventosDescricao ? `Outro Ganho: ${outrosProventosDescricao}` : 'Outros Proventos / Gratificações', tipo: 'VARIAVEL', valor: +Number(outrosProventos).toFixed(2), referencia: '' }
  ].filter(p => p.valor > 0);

  // 8. Salário Líquido Final
  const salarioLiquido = +(totalProventos - totalDescontos).toFixed(2);

  // 9. Custo Total Concessionária (Encargos Patronais CLT)
  const aliquotaPatronal = funcionario.regimeEmpresa === 'SIMPLES_NACIONAL' ? 0 : 0.288;
  const inssPatronal = +(baseINSS * aliquotaPatronal).toFixed(2);
  const custoTotalEmpresa = +(totalProventos + fgts + inssPatronal).toFixed(2);

  return {
    funcionarioId: funcionario.id,
    funcionarioNome: funcionario.nome,
    cargo: funcionario.cargo,
    cpf: funcionario.cpf,
    departamento: funcionario.departamento,
    tipoContrato: funcionario.tipoContrato || 'CLT',
    razaoSocialPrestador: funcionario.razaoSocialPrestador || '',
    cnpjPrestador: funcionario.cnpjPrestador || '',
    mesReferencia,
    salarioBase,
    motosVendidas: qtdMotosGerais,
    motosMarketingLoja: qtdMktLoja,
    motosMarketingProprio: qtdMktProprio,
    valorMarketingProprio: valorUnitProprio,
    comissaoMarketingProprio: comissaoMarketingProprioValor,
    motosMontadas: infoMontagem.motosMontadas,
    valorPorMontagem: infoMontagem.valorPorMontagem,
    comissaoMotos: comissaoMotosValor,
    comissaoMontagem: comissaoMontagemValor,
    comissaoServicos: comissaoServicosValor,
    comissaoGeral: comissaoGeralValor,
    comissoesDetalhadas: listaComissoesCustom,
    totalComissoes: totalTodasComissoes,
    comissaoDSR: dsrComissao,
    infoComissao: infoComissaoVenda,
    infoMontagem,
    ajudaDeCusto: ajudaDeCustoValor,
    ajudaDeCustoDescricao,
    reembolsoDespesas: reembolsoDespesasValor,
    reembolsoDespesasDescricao,
    gastosDiversos: gastosDiversosValor,
    gastosDiversosDescricao,
    comissaoMotoParceiro: comissaoMotoParceiroValor,
    motoParceiroQtd,
    motoParceiroDescricao,
    comissaoRetorno: comissaoRetornoValor,
    retornoDescricao,
    comissaoTreinamento: comissaoTreinamentoValor,
    comissaoTreinamentoDescricao,
    totalProventos,
    totalDescontos,
    salarioLiquido,
    fgts,
    inssPatronal,
    custoTotalEmpresa,
    baseINSS,
    baseFGTS,
    baseIRRF: irrf.baseCalculo,
    proventos: listaProventos,
    descontos: listaDescontos,
    inssDetalhe: inss,
    irrfDetalhe: irrf,
    geradoEm: new Date().toISOString()
  };
}

/**
 * Cálculo de Férias CLT (com 1/3 Constitucional, Abono Pecuniário opcional)
 */
export function calcularFerias(salarioBase, diasGozo = 30, vendeu10Dias = false, adiantarDecimoTerceiro = false, dependentes = 0) {
  const valorDia = salarioBase / 30;
  const diasEfetivosGozo = vendeu10Dias ? 20 : diasGozo;
  
  const valorGozo = +(diasEfetivosGozo * valorDia).toFixed(2);
  const tercoConstitucional = +(valorGozo / 3).toFixed(2);
  
  const abonoPecuniario = vendeu10Dias ? +(10 * valorDia).toFixed(2) : 0;
  const tercoAbono = vendeu10Dias ? +(abonoPecuniario / 3).toFixed(2) : 0;

  const baseINSSFerias = +(valorGozo + tercoConstitucional).toFixed(2);
  const inss = calcularINSS(baseINSSFerias);
  const irrf = calcularIRRF(baseINSSFerias, inss.valor, dependentes);

  const adiantamento13 = adiantarDecimoTerceiro ? +(salarioBase / 2).toFixed(2) : 0;

  const totalBruto = +(valorGozo + tercoConstitucional + abonoPecuniario + tercoAbono + adiantamento13).toFixed(2);
  const totalDescontos = +(inss.valor + irrf.valor).toFixed(2);
  const liquidoFerias = +(totalBruto - totalDescontos).toFixed(2);

  return {
    diasGozo: diasEfetivosGozo,
    vendeu10Dias,
    valorGozo,
    tercoConstitucional,
    abonoPecuniario,
    tercoAbono,
    adiantamento13,
    totalBruto,
    inss,
    irrf,
    totalDescontos,
    liquidoFerias
  };
}

/**
 * Cálculo de 13º Salário (1ª e 2ª Parcelas)
 */
export function calcularDecimoTerceiro(salarioBase, mesesTrabalhados = 12, parcela = 'PRIMEIRA', dependentes = 0) {
  const avos = Math.min(12, Math.max(1, mesesTrabalhados));
  const valorIntegralProporcional = +((salarioBase / 12) * avos).toFixed(2);

  if (parcela === 'PRIMEIRA') {
    const valorPrimeira = +(valorIntegralProporcional / 2).toFixed(2);
    return {
      parcela: '1ª Parcela',
      mesesTrabalhados: avos,
      valorBruto: valorPrimeira,
      inss: { valor: 0 },
      irrf: { valor: 0 },
      totalDescontos: 0,
      valorLiquido: valorPrimeira
    };
  } else {
    const adiantamentoJaPago = +(valorIntegralProporcional / 2).toFixed(2);
    const inss = calcularINSS(valorIntegralProporcional);
    const irrf = calcularIRRF(valorIntegralProporcional, inss.valor, dependentes);

    const totalDescontos = +(inss.valor + irrf.valor).toFixed(2);
    const valorLiquido = +(valorIntegralProporcional - adiantamentoJaPago - totalDescontos).toFixed(2);

    return {
      parcela: '2ª Parcela',
      mesesTrabalhados: avos,
      valorIntegral: valorIntegralProporcional,
      adiantamentoJaPago,
      inss,
      irrf,
      totalDescontos,
      valorLiquido
    };
  }
}

/**
 * Cálculo Rescisório Trabalhista CLT
 */
export function calcularRescisao({
  salarioBase,
  dataAdmissao,
  dataDemissao,
  motivo,
  avisoPrevioIndenizado = true,
  saldoSalarioDias = 0,
  feriasVencidas = false,
  saldoFGTSAtual = 0
}) {
  const dAdm = new Date(dataAdmissao);
  const dDem = new Date(dataDemissao);
  const anosCompletos = Math.max(0, Math.floor((dDem - dAdm) / (365.25 * 24 * 3600 * 1000)));

  const diasAvisoPrevio = Math.min(90, 30 + (anosCompletos * 3));
  const valorAvisoPrevio = avisoPrevioIndenizado ? +((salarioBase / 30) * diasAvisoPrevio).toFixed(2) : 0;
  const saldoSalario = +((salarioBase / 30) * saldoSalarioDias).toFixed(2);

  const mesDemissao = dDem.getMonth() + 1;
  const avos13 = dDem.getDate() >= 15 ? mesDemissao : mesDemissao - 1;
  const avosFerias = avos13;

  let decimoTerceiroProp = 0;
  let feriasProporcionais = 0;
  let feriasVencidasValor = 0;
  let tercoFerias = 0;
  let multaFGTS = 0;
  let saqueFGTSLiberado = false;

  const valorAvos13 = +((salarioBase / 12) * avos13).toFixed(2);
  const valorAvosFerias = +((salarioBase / 12) * avosFerias).toFixed(2);

  if (motivo === 'SEM_JUSTA_CAUSA') {
    decimoTerceiroProp = valorAvos13;
    feriasProporcionais = valorAvosFerias;
    if (feriasVencidas) feriasVencidasValor = salarioBase;
    tercoFerias = +((feriasProporcionais + feriasVencidasValor) / 3).toFixed(2);
    multaFGTS = +(saldoFGTSAtual * 0.40).toFixed(2);
    saqueFGTSLiberado = true;
  } else if (motivo === 'PEDIDO_DEMISSAO') {
    decimoTerceiroProp = valorAvos13;
    feriasProporcionais = valorAvosFerias;
    if (feriasVencidas) feriasVencidasValor = salarioBase;
    tercoFerias = +((feriasProporcionais + feriasVencidasValor) / 3).toFixed(2);
    multaFGTS = 0;
    saqueFGTSLiberado = false;
  } else if (motivo === 'ACORDO_MUTUO') {
    decimoTerceiroProp = valorAvos13;
    feriasProporcionais = valorAvosFerias;
    if (feriasVencidas) feriasVencidasValor = salarioBase;
    tercoFerias = +((feriasProporcionais + feriasVencidasValor) / 3).toFixed(2);
    multaFGTS = +(saldoFGTSAtual * 0.20).toFixed(2);
    saqueFGTSLiberado = true;
  } else if (motivo === 'COM_JUSTA_CAUSA') {
    if (feriasVencidas) {
      feriasVencidasValor = salarioBase;
      tercoFerias = +(feriasVencidasValor / 3).toFixed(2);
    }
  }

  const inssSaldo = calcularINSS(saldoSalario);
  const inss13 = calcularINSS(decimoTerceiroProp);
  const totalINSS = +(inssSaldo.valor + inss13.valor).toFixed(2);

  const totalBruto = +(
    saldoSalario +
    (motivo === 'SEM_JUSTA_CAUSA' && avisoPrevioIndenizado ? valorAvisoPrevio : 0) +
    decimoTerceiroProp +
    feriasProporcionais +
    feriasVencidasValor +
    tercoFerias
  ).toFixed(2);

  const liquidoRescisao = +(totalBruto - totalINSS).toFixed(2);

  return {
    motivo,
    anosTrabalhados: anosCompletos,
    diasAvisoPrevio,
    valorAvisoPrevio,
    saldoSalario,
    decimoTerceiroProp,
    feriasProporcionais,
    feriasVencidasValor,
    tercoFerias,
    multaFGTS,
    saqueFGTSLiberado,
    totalBruto,
    totalINSS,
    liquidoRescisao
  };
}
