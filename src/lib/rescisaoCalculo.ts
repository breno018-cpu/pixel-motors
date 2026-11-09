import { calcINSS, calcIRRF, calcFGTS } from './payrollTax';
import type { FuncionarioConcessionaria } from '@/hooks/useFolhaConcessionaria';

export type MotivoRescisao =
  | 'SEM_JUSTA_CAUSA'
  | 'PEDIDO_DEMISSAO'
  | 'ACORDO_MUTUO'
  | 'COM_JUSTA_CAUSA'
  | 'TERMINO_CONTRATO';

export type ModalidadeAvisoPrevio =
  | 'INDENIZADO_EMPREGADOR'
  | 'TRABALHADO'
  | 'DISPENSADO'
  | 'NAO_CUMPRIDO_DESCONTADO';

export interface AdicionalRescisorio {
  id: string;
  descricao: string;
  valor: number;
  tipo: 'provento' | 'desconto';
  motivoOuClausula?: string;
  incideINSS?: boolean;
}

export interface RescisaoInput {
  funcionario: FuncionarioConcessionaria;
  dataAdmissao: string;
  dataDemissao: string;
  motivo: MotivoRescisao;
  modalidadeAviso: ModalidadeAvisoPrevio;
  saldoFGTS: number;
  feriasVencidas: boolean;
  diasSaldoSalario?: number;
  mediaComissoes?: number;
  adicionaisContratuais?: AdicionalRescisorio[];
  observacoes?: string;
}

export interface RubricaRescisoria {
  codigo: string;
  descricao: string;
  referencia: string;
  provento: number;
  desconto: number;
}

export interface RescisaoResultado {
  motivo: MotivoRescisao;
  modalidadeAviso: ModalidadeAvisoPrevio;
  dataAdmissao: string;
  dataDemissao: string;
  dataProjetadaAviso: string;
  tempoServico: {
    anos: number;
    meses: number;
    dias: number;
    textoFormatado: string;
  };
  diasAvisoPrevio: number;
  baseCalculoRescisoria: number;
  salarioBase: number;
  adicionalInsalubridade: number;
  adicionalPericulosidade: number;
  mediaComissoes: number;

  // Verbas Rescisórias (Campos oficiais TRCT)
  saldoSalario: {
    dias: number;
    valor: number;
  };
  avisoPrevio: {
    dias: number;
    valor: number;
    tipo: 'provento' | 'desconto' | 'isento';
  };
  decimoTerceiro: {
    avosProp: number;
    valorProp: number;
    avosIndenizados: number;
    valorIndenizado: number;
    total: number;
  };
  ferias: {
    avosProp: number;
    valorProp: number;
    avosIndenizados: number;
    valorIndenizado: number;
    feriasVencidas: number;
    tercoConstitucional: number;
    total: number;
  };
  adicionaisExtras: {
    proventos: number;
    descontos: number;
    itens: AdicionalRescisorio[];
  };

  // Encargos & Descontos Legais
  descontos: {
    inssSaldo: number;
    inss13: number;
    totalINSS: number;
    irrfSaldo: number;
    irrf13: number;
    totalIRRF: number;
    avisoDescontado: number;
    outrosDescontos: number;
    totalDescontos: number;
  };

  // FGTS Rescisório
  fgts: {
    saldoInformado: number;
    multaRescisoria: number;
    percentualMulta: number;
    depositoRecisorioDoMes: number;
    depositoAvisoPrevio: number;
    deposito13Rescisorio: number;
    saqueLiberado: boolean;
    chaveConectividadeObrigatoria: boolean;
  };

  totalBruto: number;
  totalDescontos: number;
  liquidoRescisao: number;
  prazoPagamentoTexto: string;
  rubricasTRCT: RubricaRescisoria[];
}

const SALARIO_MINIMO_2025 = 1518.0;

function calcularMesesCompletos(inicio: Date, fim: Date): number {
  let meses = (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth());
  if (fim.getDate() < inicio.getDate()) {
    meses--;
  }
  return Math.max(0, meses);
}

export function calcularRescisaoCompleta(input: RescisaoInput): RescisaoResultado {
  const {
    funcionario,
    dataAdmissao,
    dataDemissao,
    motivo,
    modalidadeAviso,
    saldoFGTS = 0,
    feriasVencidas = false,
    mediaComissoes = 0,
    adicionaisContratuais = [],
  } = input;

  const dAdm = new Date(`${dataAdmissao}T12:00:00`);
  const dDem = new Date(`${dataDemissao}T12:00:00`);

  // 1. Tempo de casa
  const diffTime = Math.max(0, dDem.getTime() - dAdm.getTime());
  const diffDaysTotal = Math.floor(diffTime / (1000 * 3600 * 24));
  const anosCompletos = Math.max(0, Math.floor(diffDaysTotal / 365.25));
  const mesesCompletos = calcularMesesCompletos(dAdm, dDem);
  const diasRestantes = Math.max(0, diffDaysTotal - Math.floor(anosCompletos * 365.25));

  // 2. Dias de Aviso Prévio (Lei 12.506/2011: 30 dias + 3 por ano trabalhado, até máx 90 dias)
  const diasAvisoPrevio = Math.min(90, 30 + anosCompletos * 3);

  // Data projetada do aviso prévio indenizado
  const dProjetada = new Date(dDem);
  if (modalidadeAviso === 'INDENIZADO_EMPREGADOR') {
    dProjetada.setDate(dProjetada.getDate() + diasAvisoPrevio);
  }
  const dataProjetadaAviso = dProjetada.toISOString().slice(0, 10);

  // 3. Adicionais regulares contratuais do funcionário
  let adicionalInsalubridade = 0;
  if (funcionario.grauInsalubridade === 'MINIMO') {
    adicionalInsalubridade = +(SALARIO_MINIMO_2025 * 0.1).toFixed(2);
  } else if (funcionario.grauInsalubridade === 'MEDIO') {
    adicionalInsalubridade = +(SALARIO_MINIMO_2025 * 0.2).toFixed(2);
  } else if (funcionario.grauInsalubridade === 'MAXIMO') {
    adicionalInsalubridade = +(SALARIO_MINIMO_2025 * 0.4).toFixed(2);
  }

  let adicionalPericulosidade = 0;
  if (funcionario.temPericulosidade) {
    adicionalPericulosidade = +(Number(funcionario.salarioBase || 0) * 0.3).toFixed(2);
  }

  // Maior remuneração para fins rescisórios (Salário + adicionais habituais + médias de comissão)
  const salarioBase = Number(funcionario.salarioBase || 0);
  const baseCalculoRescisoria = +(
    salarioBase +
    adicionalInsalubridade +
    adicionalPericulosidade +
    Number(mediaComissoes || 0)
  ).toFixed(2);

  // 4. Saldo de Salário
  // Dias trabalhados no mês do desligamento
  const diasSaldoSalario =
    input.diasSaldoSalario !== undefined && input.diasSaldoSalario >= 0
      ? input.diasSaldoSalario
      : dDem.getDate();

  const valorSaldoSalario = +( (baseCalculoRescisoria / 30) * diasSaldoSalario ).toFixed(2);

  // 5. Aviso Prévio
  let valorAvisoPrevio = 0;
  let tipoAviso: 'provento' | 'desconto' | 'isento' = 'isento';

  if (motivo === 'SEM_JUSTA_CAUSA' && modalidadeAviso === 'INDENIZADO_EMPREGADOR') {
    valorAvisoPrevio = +( (baseCalculoRescisoria / 30) * diasAvisoPrevio ).toFixed(2);
    tipoAviso = 'provento';
  } else if (motivo === 'ACORDO_MUTUO' && modalidadeAviso === 'INDENIZADO_EMPREGADOR') {
    // No acordo mútuo (Art. 484-A), o aviso indenizado é pago pela metade (50%)
    valorAvisoPrevio = +( ((baseCalculoRescisoria / 30) * diasAvisoPrevio) * 0.5 ).toFixed(2);
    tipoAviso = 'provento';
  } else if (motivo === 'PEDIDO_DEMISSAO' && modalidadeAviso === 'NAO_CUMPRIDO_DESCONTADO') {
    // Pedido de demissão não cumprido: empregador pode descontar o aviso prévio (30 dias)
    valorAvisoPrevio = +( (baseCalculoRescisoria / 30) * 30 ).toFixed(2);
    tipoAviso = 'desconto';
  }

  // 6. 13º Salário Proporcional e Indenizado
  // Avos de 13º no ano corrente até a data de demissão
  const anoDemissao = dDem.getFullYear();
  let mesInicio13 = 1;
  if (dAdm.getFullYear() === anoDemissao) {
    mesInicio13 = dAdm.getDate() <= 15 ? dAdm.getMonth() + 1 : dAdm.getMonth() + 2;
  }
  const mesFim13 = dDem.getDate() >= 15 ? dDem.getMonth() + 1 : dDem.getMonth();
  const avos13Prop = motivo === 'COM_JUSTA_CAUSA'
    ? 0
    : Math.max(0, Math.min(12, mesFim13 - mesInicio13 + 1));

  const valor13Prop = +( (baseCalculoRescisoria / 12) * avos13Prop ).toFixed(2);

  // Projeção do aviso prévio no 13º (Súmula 305 TST): se o aviso indenizado projetar mais 15 dias
  let avos13Indenizado = 0;
  if ((motivo === 'SEM_JUSTA_CAUSA' || motivo === 'ACORDO_MUTUO') && modalidadeAviso === 'INDENIZADO_EMPREGADOR') {
    const diasProjetadosRestantes = dProjetada.getDate();
    if (dProjetada.getMonth() !== dDem.getMonth() && diasProjetadosRestantes >= 15) {
      avos13Indenizado = 1;
    }
  }
  const valor13Indenizado = +( (baseCalculoRescisoria / 12) * avos13Indenizado ).toFixed(2);
  const total13 = +(valor13Prop + valor13Indenizado).toFixed(2);

  // 7. Férias Proporcionais, Férias Vencidas e Terço Constitucional
  let avosFeriasProp = 0;
  if (motivo !== 'COM_JUSTA_CAUSA') {
    // Calcula os avos proporcionais do período aquisitivo incompleto
    const inicioUltimoPeriodoAquisitivo = new Date(dAdm);
    inicioUltimoPeriodoAquisitivo.setFullYear(dAdm.getFullYear() + anosCompletos);
    
    // Meses entre início do período aquisitivo atual e demissão
    let mesesAquisitivos = (dDem.getFullYear() - inicioUltimoPeriodoAquisitivo.getFullYear()) * 12 +
      (dDem.getMonth() - inicioUltimoPeriodoAquisitivo.getMonth());
    if (dDem.getDate() >= 15) {
      mesesAquisitivos++;
    }
    avosFeriasProp = Math.max(0, Math.min(12, mesesAquisitivos));
  }

  const valorFeriasProp = +( (baseCalculoRescisoria / 12) * avosFeriasProp ).toFixed(2);

  // Férias indenizadas decorrentes da projeção do aviso prévio
  let avosFeriasIndenizadas = 0;
  if ((motivo === 'SEM_JUSTA_CAUSA' || motivo === 'ACORDO_MUTUO') && modalidadeAviso === 'INDENIZADO_EMPREGADOR') {
    if (dProjetada.getDate() >= 15) {
      avosFeriasIndenizadas = 1;
    }
  }
  const valorFeriasIndenizadas = +( (baseCalculoRescisoria / 12) * avosFeriasIndenizadas ).toFixed(2);

  // Férias Vencidas (se o colaborador completou 1 ano e ainda não gozou)
  const valorFeriasVencidas = feriasVencidas ? baseCalculoRescisoria : 0;

  // 1/3 Constitucional de Férias
  const baseTercoFerias = +(valorFeriasProp + valorFeriasIndenizadas + valorFeriasVencidas).toFixed(2);
  const valorTercoFerias = +(baseTercoFerias / 3).toFixed(2);

  const totalFerias = +(baseTercoFerias + valorTercoFerias).toFixed(2);

  // 8. Adicionais e Melhorias Contratuais Específicas
  let totalAdicionaisProventos = 0;
  let totalAdicionaisDescontos = 0;
  for (const item of adicionaisContratuais) {
    if (item.tipo === 'provento') {
      totalAdicionaisProventos += Number(item.valor || 0);
    } else {
      totalAdicionaisDescontos += Number(item.valor || 0);
    }
  }

  // 9. Encargos Legais e Deduções (INSS e IRRF)
  // INSS sobre Saldo de Salário
  const inssSaldo = calcINSS(valorSaldoSalario);
  // INSS sobre 13º Salário
  const inss13 = calcINSS(valor13Prop);
  const totalINSS = +(inssSaldo + inss13).toFixed(2);

  // IRRF sobre Saldo de Salário (deduzindo INSS e dependentes)
  const dep = Number(funcionario.dependentes) || 0;
  const irrfSaldo = calcIRRF(Math.max(0, valorSaldoSalario - inssSaldo), dep);
  // IRRF sobre 13º Salário (tributação exclusiva na fonte)
  const irrf13 = calcIRRF(Math.max(0, valor13Prop - inss13), dep);
  const totalIRRF = +(irrfSaldo + irrf13).toFixed(2);

  // Aviso prévio descontado (no pedido de demissão não cumprido)
  const avisoDescontado = tipoAviso === 'desconto' ? valorAvisoPrevio : 0;

  // Total de proventos brutos
  const totalBruto = +(
    valorSaldoSalario +
    (tipoAviso === 'provento' ? valorAvisoPrevio : 0) +
    total13 +
    totalFerias +
    totalAdicionaisProventos
  ).toFixed(2);

  // Total de deduções
  const totalDescontos = +(
    totalINSS +
    totalIRRF +
    avisoDescontado +
    totalAdicionaisDescontos
  ).toFixed(2);

  // Líquido final da rescisão a pagar
  const liquidoRescisao = +(Math.max(0, totalBruto - totalDescontos)).toFixed(2);

  // 10. FGTS Rescisório e Multa
  let percentualMulta = 0;
  let saqueLiberado = false;
  if (motivo === 'SEM_JUSTA_CAUSA') {
    percentualMulta = 40;
    saqueLiberado = true;
  } else if (motivo === 'ACORDO_MUTUO') {
    percentualMulta = 20;
    saqueLiberado = true;
  } else if (motivo === 'TERMINO_CONTRATO') {
    percentualMulta = 0;
    saqueLiberado = true;
  }

  const multaFGTS = +(Number(saldoFGTS || 0) * (percentualMulta / 100)).toFixed(2);
  const depositoRecisorioDoMes = calcFGTS(valorSaldoSalario);
  const depositoAvisoPrevio = tipoAviso === 'provento' ? calcFGTS(valorAvisoPrevio) : 0;
  const deposito13Rescisorio = calcFGTS(total13);

  // Prazo de Pagamento (Art. 477, § 6º da CLT)
  const prazoPagamentoTexto = 'Até 10 (dez) dias corridos a contar do término do contrato.';

  // 11. Montagem das Rubricas para o TRCT Oficial
  const rubricasTRCT: RubricaRescisoria[] = [
    {
      codigo: '50',
      descricao: `Saldo de Salário (${diasSaldoSalario} dias)`,
      referencia: `${diasSaldoSalario} dias`,
      provento: valorSaldoSalario,
      desconto: 0,
    },
  ];

  if (tipoAviso === 'provento') {
    rubricasTRCT.push({
      codigo: '69',
      descricao: `Aviso Prévio Indenizado (${diasAvisoPrevio} dias)`,
      referencia: `${diasAvisoPrevio} dias`,
      provento: valorAvisoPrevio,
      desconto: 0,
    });
  }

  if (valor13Prop > 0) {
    rubricasTRCT.push({
      codigo: '63',
      descricao: `13º Salário Proporcional (${avos13Prop}/12 avos)`,
      referencia: `${avos13Prop}/12`,
      provento: valor13Prop,
      desconto: 0,
    });
  }

  if (valor13Indenizado > 0) {
    rubricasTRCT.push({
      codigo: '70',
      descricao: `13º Salário Indenizado (${avos13Indenizado}/12 avo)`,
      referencia: `${avos13Indenizado}/12`,
      provento: valor13Indenizado,
      desconto: 0,
    });
  }

  if (valorFeriasVencidas > 0) {
    rubricasTRCT.push({
      codigo: '66',
      descricao: 'Férias Vencidas Simples',
      referencia: '12/12',
      provento: valorFeriasVencidas,
      desconto: 0,
    });
  }

  if (valorFeriasProp > 0) {
    rubricasTRCT.push({
      codigo: '65',
      descricao: `Férias Proporcionais (${avosFeriasProp}/12 avos)`,
      referencia: `${avosFeriasProp}/12`,
      provento: valorFeriasProp,
      desconto: 0,
    });
  }

  if (valorFeriasIndenizadas > 0) {
    rubricasTRCT.push({
      codigo: '71',
      descricao: `Férias Indenizadas (${avosFeriasIndenizadas}/12 avo)`,
      referencia: `${avosFeriasIndenizadas}/12`,
      provento: valorFeriasIndenizadas,
      desconto: 0,
    });
  }

  if (valorTercoFerias > 0) {
    rubricasTRCT.push({
      codigo: '68',
      descricao: 'Terço Constitucional de Férias (1/3)',
      referencia: '33.33%',
      provento: valorTercoFerias,
      desconto: 0,
    });
  }

  // Adicionais contratuais adicionados
  adicionaisContratuais.forEach((ad, i) => {
    if (ad.tipo === 'provento' && ad.valor > 0) {
      rubricasTRCT.push({
        codigo: `9${i + 1}`,
        descricao: ad.descricao,
        referencia: 'Contratual',
        provento: Number(ad.valor),
        desconto: 0,
      });
    }
  });

  // Deduções / Descontos
  if (inssSaldo > 0) {
    rubricasTRCT.push({
      codigo: '100',
      descricao: 'Previdência Social (INSS Saldo de Salário)',
      referencia: 'Progressiva',
      provento: 0,
      desconto: inssSaldo,
    });
  }

  if (inss13 > 0) {
    rubricasTRCT.push({
      codigo: '101',
      descricao: 'Previdência Social (INSS 13º Salário)',
      referencia: 'Progressiva',
      provento: 0,
      desconto: inss13,
    });
  }

  if (irrfSaldo > 0) {
    rubricasTRCT.push({
      codigo: '102',
      descricao: 'Imposto de Renda Retido na Fonte (IRRF)',
      referencia: 'Progressiva',
      provento: 0,
      desconto: irrfSaldo,
    });
  }

  if (irrf13 > 0) {
    rubricasTRCT.push({
      codigo: '103',
      descricao: 'IRRF s/ 13º Salário Rescisório',
      referencia: 'Exclusiva',
      provento: 0,
      desconto: irrf13,
    });
  }

  if (avisoDescontado > 0) {
    rubricasTRCT.push({
      codigo: '104',
      descricao: 'Aviso Prévio Não Cumprido (Art. 487 CLT)',
      referencia: '30 dias',
      provento: 0,
      desconto: avisoDescontado,
    });
  }

  adicionaisContratuais.forEach((ad, i) => {
    if (ad.tipo === 'desconto' && ad.valor > 0) {
      rubricasTRCT.push({
        codigo: `11${i + 5}`,
        descricao: ad.descricao,
        referencia: 'Dedução',
        provento: 0,
        desconto: Number(ad.valor),
      });
    }
  });

  return {
    motivo,
    modalidadeAviso,
    dataAdmissao,
    dataDemissao,
    dataProjetadaAviso,
    tempoServico: {
      anos: anosCompletos,
      meses: mesesCompletos,
      dias: diasRestantes,
      textoFormatado: `${anosCompletos} ano(s), ${mesesCompletos % 12} mês(es) e ${diasRestantes} dia(s)`,
    },
    diasAvisoPrevio,
    baseCalculoRescisoria,
    salarioBase,
    adicionalInsalubridade,
    adicionalPericulosidade,
    mediaComissoes: Number(mediaComissoes || 0),
    saldoSalario: {
      dias: diasSaldoSalario,
      valor: valorSaldoSalario,
    },
    avisoPrevio: {
      dias: diasAvisoPrevio,
      valor: valorAvisoPrevio,
      tipo: tipoAviso,
    },
    decimoTerceiro: {
      avosProp: avos13Prop,
      valorProp: valor13Prop,
      avosIndenizados: avos13Indenizado,
      valorIndenizado: valor13Indenizado,
      total: total13,
    },
    ferias: {
      avosProp: avosFeriasProp,
      valorProp: valorFeriasProp,
      avosIndenizados: avosFeriasIndenizadas,
      valorIndenizado: valorFeriasIndenizadas,
      feriasVencidas: valorFeriasVencidas,
      tercoConstitucional: valorTercoFerias,
      total: totalFerias,
    },
    adicionaisExtras: {
      proventos: totalAdicionaisProventos,
      descontos: totalAdicionaisDescontos,
      itens: adicionaisContratuais,
    },
    descontos: {
      inssSaldo,
      inss13,
      totalINSS,
      irrfSaldo,
      irrf13,
      totalIRRF,
      avisoDescontado,
      outrosDescontos: totalAdicionaisDescontos,
      totalDescontos,
    },
    fgts: {
      saldoInformado: Number(saldoFGTS || 0),
      multaRescisoria: multaFGTS,
      percentualMulta,
      depositoRecisorioDoMes,
      depositoAvisoPrevio,
      deposito13Rescisorio,
      saqueLiberado,
      chaveConectividadeObrigatoria: saqueLiberado,
    },
    totalBruto,
    totalDescontos,
    liquidoRescisao,
    prazoPagamentoTexto,
    rubricasTRCT,
  };
}
